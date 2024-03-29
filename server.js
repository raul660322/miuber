const path = require("path");
const TIMEOUT = 1000*60*60; // Timeout for drivers (1h)
const PC_TIMEOUT = 1000*60*5 //Time out for pre-contratos (5min)
const MES = 1000*3600*24*30;
const PAGO_ACORDADO = 1; //Tentativamente 100
const level = require('fastify-leveldb')
var losCarros = [];
var preContratos = [];
const moment = require('moment')

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
});

//key-value database
fastify.register(
  level,
  { name: 'db' }
);

io.on('connection', (socket) => {
     
     //purgar choferes con tiempo de inactividad > timeOut 
     var time = new Date().getTime(); 
     losCarros = losCarros.filter(item => item.time + TIMEOUT > time);
     //Purgar pre-contratos con tiempo > PC_TIMEOUT
     preContratos = preContratos.filter(item => item.time + PC_TIMEOUT > time);
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
     
     //Recibe pago de CUBACEL y lo guarda en la base de datos
     socket.on('pago', async (msg) => {
       var elPago = getPago(msg);
       if (elPago){
         await fastify.level.db.put(elPago.tel, elPago.time_stamp);
       }  
       console.log(msg);
       console.log(' Pagando telefono: ' + elPago.tel, 'fecha: ' + elPago.time_stamp);
       //console.log(new Date(elPago.time_stamp)).customFormat("#DD#/#MM#/#YYYY#");
     });
     
     //Devuelve inmediatamente al chofer la fecha (time stamp) del vencimiento
     //del autorizo de operación, mediante la función callback
     //Si el autorizo está vencido o no existe, devuelve fecha "0"
     socket.on('checkpago', async function(telefono,callback) {
       try {
           const fecha = await fastify.level.db.get(telefono);
           const fechaActual = new Date().getTime();
           if (fecha && (fecha + MES > fechaActual)){
             callback(null,{'telefono':telefono, 'fecha':Number(fecha)+MES});
             //console.log(moment(new Date(Number(fecha)))).format('l');
           } else {
             callback(null,{'telefono':telefono, 'fecha':0});
           } 
       } 
       catch (e) {
           console.log(telefono);
           callback(null,{'telefono':telefono, 'fecha':0});
       }
      });        
      
      //El servidor recibe la posición y los datos de un chofer
      //lo agrega a la lista y envía la lista a los clientes
      socket.on('posicion', (pos) => {
       //Poner time stamp a la oferta del carro
       pos["time"] = new Date().getTime()
       console.log('coordenadas: ',pos.nombre); 
             
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
         io.emit('cliente-aceptado',carro);
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
       io.emit('cliente-rechazado',carro);
     }); 
  
      //Anular chofer
     socket.on('anular-chofer',(carro)=>{
       console.log('anulando: ',carro); 
       //Eliminar pre-contrato
       const i = preContratos.findIndex(c=>{return (c.tchofer==carro.tchofer) && (c.tcliente==carro.tcliente)})
       if (i != -1) {
          preContratos.splice(i,1);
          io.emit('pre-contratos', {"chofer":carro.tchofer,"pre":preContratos});
       }
       io.emit('chofer-anulado',carro);
     });   
  
  
     //Petición Cliente-Chofer 
     socket.on('cliente-chofer',(pc)=>{
       pc["time"] = new Date().getTime();//Agregar time stamp al pre-contrato
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
       console.log('pre-contratos: ',preContratos);
     }); 
  
     //Respuesta al chat 
     socket.on('chat',(msg)=>{
       console.log('mensaje: ',msg); 
       io.emit('chat-response', msg);
     }); 
  
     // 
     socket.on('chat-otros',(msg)=>{
       console.log('mensaje: ',msg); 
       io.emit('chat-response-otros', msg);
     });
  
    //Recibir foto recien sacada
     socket.on('foto',(foto)=>{
       console.log('chofer:',foto.chofer, 'tamaño:',foto.foto.length); 
       //io.emit('chat-response', msg);
     });  
  
      
});

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

//Verifica en el msg que se paga lo acordado (100 CUP) 
//y se devuelve el par telefono-fecha actual
function getPago(msg){
  var ln = msg.split(' ');
  var resultado = "";
  if ((ln[0]+ln[1]+ln[2] == "Ustedharecibido") && (ln[4]="CUP")
      && parseFloat(ln[3]) >= PAGO_ACORDADO) {
    const telefono = parseInt(ln[7]); 
    resultado = {'tel':telefono,'time_stamp':new Date().getTime()}; 
  }
  return resultado;
}
