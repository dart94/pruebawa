// Constructores de mensajes de WhatsApp: texto, botones de respuesta y listas.
// Aplica los limites de la API de Meta (verificar en su documentacion si cambian):
//   boton: titulo 20 | lista: boton 20, titulo de fila 24, descripcion 72, titulo de seccion 24
//   cuerpo 1024 | pie 60 | hasta 3 botones | hasta 10 filas

const LIM = { boton: 20, botonLista: 20, fila: 24, descripcion: 72, seccion: 24, cuerpo: 1024, pie: 60 };
const MAX_BOTONES = 3;
const MAX_FILAS = 10;

function truncar(texto, max) {
  const t = String(texto == null ? '' : texto).trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

function texto(cuerpo) {
  return { tipo: 'texto', cuerpo };
}

function botones(cuerpo, opciones, pie) {
  return { tipo: 'botones', cuerpo, pie, opciones: opciones.slice(0, MAX_BOTONES) };   // opciones: [{id, titulo}]
}

function lista(cuerpo, etiquetaBoton, filas, pie, seccion = 'Opciones') {
  return { tipo: 'lista', cuerpo, pie, etiquetaBoton, seccion, filas: filas.slice(0, MAX_FILAS) };   // filas: [{id, titulo, descripcion}]
}

// Cuerpo JSON que se envia a /messages
function payload(para, msg) {
  const base = { messaging_product: 'whatsapp', to: para };
  if (msg.tipo === 'texto') {
    return { ...base, type: 'text', text: { body: truncar(msg.cuerpo, 4096) } };
  }
  const interactive = { body: { text: truncar(msg.cuerpo, LIM.cuerpo) } };
  if (msg.pie) interactive.footer = { text: truncar(msg.pie, LIM.pie) };
  if (msg.tipo === 'botones') {
    interactive.type = 'button';
    interactive.action = {
      buttons: msg.opciones.map((o) => ({ type: 'reply', reply: { id: o.id, title: truncar(o.titulo, LIM.boton) } }))
    };
  } else {
    interactive.type = 'list';
    interactive.action = {
      button: truncar(msg.etiquetaBoton, LIM.botonLista),
      sections: [{
        title: truncar(msg.seccion, LIM.seccion),
        rows: msg.filas.map((f) => {
          const fila = { id: f.id, title: truncar(f.titulo, LIM.fila) };
          if (f.descripcion) fila.description = truncar(f.descripcion, LIM.descripcion);
          return fila;
        })
      }]
    };
  }
  return { ...base, type: 'interactive', interactive };
}

// Version solo texto, por si Meta rechaza el mensaje interactivo o el cliente no lo soporta
function textoPlano(msg) {
  if (msg.tipo === 'texto') return msg.cuerpo;
  const lineas = msg.tipo === 'botones'
    ? msg.opciones.map((o, i) => `${i + 1}. ${o.titulo}`)
    : msg.filas.map((f) => `• ${f.titulo}${f.descripcion ? ' - ' + f.descripcion : ''}`);
  return `${msg.cuerpo}\n\n${lineas.join('\n')}`;
}

module.exports = { texto, botones, lista, payload, textoPlano, truncar, LIM };
