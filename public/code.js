function setCookie(cname, cvalue, exhor) {
    const d = new Date();
    d.setTime(d.getTime() + (exhor * 3600 * 1000));
    let expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
  let name = cname + "=";
  let ca = document.cookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function mensaje(texto,destino,socket){
  //var elTexto = document.getElementById('decir').value;
  socket.emit('chat',{"texto":texto, "dest":destino})
  var conversacion = document.getElementById('chat');
  var item = document.createElement('div');
  item.innerHTML = texto;
  item.classList.add("chat-send")
  conversacion.appendChild(item);  
  conversacion.scrollTop = conversacion.scrollHeight;
  document.getElementById('decir').value = ""
}
