const path = require("path");
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


io.on('connection', (socket) => {
     console.log('......', 'Conectado!');
     socket.on('conectado',rol=>{
       if (rol=='cliente'){
         console.log('Conectado un cliente')
         io.emit('carros', losCarros);
       } else {
         if (rol=='chofer'){
           console.log('Conectado un chofer')
           io.emit('pre-contratos', preContratos); 
         }
       }
     }) 
     socket.on('chat message', (msg) => {
       console.log('message: ' + msg); 
     });
     socket.on('posicion', (pos) => {
       console.log('coordenadas: ',pos); 
       
       //Obtener choferes
       const index = losCarros.findIndex(carro=>carro.nombre==pos.nombre)
       if (index === -1) {
         losCarros.push(pos)
       } else {
         losCarros[index].lat=pos.lat
         losCarros[index].long=pos.long
       }   
       //Enviar choferes al cliente
       io.emit('carros', losCarros);  
     });
     socket.on('ocupar',(carro)=>{
       console.log('ocupando: ',carro); 
       const index = losCarros.findIndex(c=>c.nombre==carro)
       if (index != -1) {
         losCarros.splice(index,1);
        //Enviar nueva lista de choferes al cliente
         io.emit('carros', losCarros);  
       }          
     }); 
     socket.on('cliente-chofer',(pc)=>{
       console.log('cliente-chofer: ',pc); 
       preContratos.push(pc);
       io.emit('pre-contratos', preContratos);
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
