const path = require("path");
const timeOut = 1000*60; //1h
var losCarros = [];
var preContratos = [];

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // set this to true for detailed logging:
  logger: false
});

const io = require('socket.io')(fastify.server);

// Setup our static files
fastify.register(require("fastify-static"), {
  root: path.join(__dirname, "public"),
  prefix: "/" // optional: default '/'
});

// fastify-formbody lets us parse incoming forms
fastify.register(require("fastify-formbody"));

// point-of-view is a templating manager for fastify
fastify.register(require("point-of-view"), {
  engine: {
    handlebars: require("handlebars")
  }
});

//Allow requests from anywhere
fastify.register(require('fastify-cors'), { 
    origin:'*'
})

//key-value database
fastify.register(
  require('fastify-leveldb'),
  { name: 'db' }
)

io.on('connection', (socket) => {
     //purgar choferes con tiempo de inactividad > timeOut
     var time = new Date().getTime() 
     losCarros = losCarros.filter(item => item.time + timeOut > time);
     console.log('......', 'Conectado!', time);
     socket.on('conectado',rol=>{
       if (rol.rol=='cliente'){
         console.log('Conectado un cliente',rol.nombre)
         io.emit('carros', losCarros);
       } else {
         if (rol.rol=='chofer'){
           console.log('Conectado un chofer',rol.nombre)
           io.emit('pre-contratos', {"chofer":rol.telef,"pre":preContratos}); 
         }
       }
     }) 
     socket.on('chat message', (msg) => {
       console.log('message: ' + msg); 
     });
     
     //Recibe pago de CUBACEL 
     socket.on('pago', async (msg) => {
       await this.level.db.put(msg.tel, msg.time_stamp)
       console.log('message: ' + msg); 
     });

     socket.on('posicion', (pos) => {
       pos["time"] = new Date().getTime()
       console.log('coordenadas: ',pos); 
             
       //Obtener choferes
       const index = losCarros.findIndex(carro=>carro.tel==pos.tel)
       if (index === -1) {
         losCarros.push(pos)
       } else {
         losCarros[index].lat=pos.lat
         losCarros[index].long=pos.long
       }   
       //Enviar choferes al cliente
       io.emit('carros', losCarros);  
     });
  
     //Ocupar el carro con un cliente 
     socket.on('ocupar',(carro)=>{
       console.log('ocupando: ',carro); 
       const index = losCarros.findIndex(c=>c.tel==carro.tchofer)
       if (index != -1) {
         losCarros.splice(index,1); //Quitar carro de la lista
        //Desactivar carro
         io.emit('desactivar', carro); 
        //Enviar nueva lista de choferes al cliente
         io.emit('carros', losCarros); 
        //Eliminar pre-contrato
         const i = preContratos.findIndex(c=>(c.tchofer==carro.tchofer) && (c.tcliente==carro.tcliente))
         if (i != -1) {
            preContratos.splice(i,1);
         }
         io.emit('pre-contratos', {"chofer":carro.tchofer,"pre":preContratos});
       }          
     }); 
  
    //Quitar carro de la lista a petición de chofer
     socket.on('quitar-carro',(carro)=>{
       console.log('quitando: ',carro); 
       const index = losCarros.findIndex(c=>c.tel==carro)
       if (index != -1) {
         losCarros.splice(index,1); //Quitar carro de la lista
        //Enviar nueva lista de choferes al cliente
         io.emit('carros', losCarros); 
       }          
     }); 
  
     //Rechazar cliente 
     socket.on('rechazar',(carro)=>{
       console.log('rechazando: ',carro); 
       //Eliminar pre-contrato
       const i = preContratos.findIndex(c=>{return (c.tchofer==carro.tchofer) && (c.tcliente==carro.tcliente)})
       if (i != -1) {
          preContratos.splice(i,1);
          io.emit('pre-contratos', {"chofer":carro.tchofer,"pre":preContratos});
       }
       
     });  
  
     //Petición Cliente-Chofer 
     socket.on('cliente-chofer',(pc)=>{
       console.log('cliente-chofer: ',pc); 
       const i = preContratos.findIndex(c=>{return (c.tchofer==pc.tchofer) && (c.tcliente==pc.tcliente)})
       if (i === -1) {
         preContratos.push(pc);
         io.emit('pre-contratos', {"chofer":pc.tchofer,"pre":preContratos});
       } else {
         if (preContratos[i].dest != pc.dest) {
           preContratos[i].dest = pc.dest;
           io.emit('pre-contratos', {"chofer":pc.tchofer,"pre":preContratos});
         }
       }
     }); 
     //Respuesta al chat 
     socket.on('chat',(msg)=>{
       console.log('mensaje: ',msg); 
       io.emit('chat-response', msg);
     }); 
    //Recibir foto recien sacada
     socket.on('foto',(foto)=>{
       console.log('chofer:',foto.chofer, 'tamaño:',foto.foto.length); 
       //io.emit('chat-response', msg);
     });   
})

// Our main GET home page route, pulls from src/pages/index.hbs
fastify.get("/", function(request, reply) {
  // params is an object we'll pass to our handlebars template
  let params = {
    greeting: "Hello Nodeee!"
  };
  // request.query.paramName <-- a querystring example
  //reply.view("/src/pages/index.hbs", params);
  reply.view("/src/pages/index.html");
});

//Abrir página del chofer
fastify.get("/servicio.html", function(request, reply) {

  reply.view("/src/pages/servicio.html");
});

//Abrir página del protocolo
fastify.get("/protocolo.html", function(request, reply) {

  reply.view("/src/pages/protocolo.html");
});

//Abrir página del protocolo del chofer
fastify.get("/protochof.html", function(request, reply) {

  reply.view("/src/pages/protochof.html");
});

// A POST route to handle form submissions
fastify.post("/", function(request, reply) {
  let params = {
    greeting: "Hello Form!"
  };
  // request.body.paramName <-- a form post example
  reply.view("/src/pages/index.hbs", params);
});

// Run the server and report out to the logs
fastify.listen(process.env.PORT, function(err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Your app is listening on ${address}`);
  fastify.log.info(`server listening on ${address}`);
});
