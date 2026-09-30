// Traductor de Instagram Messaging: convierte los mensajes del bot al formato de Instagram
// y lee los eventos del webhook de Instagram. No envia nada: eso lo hace server.js.
//
// Formatos tomados de la documentacion de Meta y de guias de terceros; NO estan probados con Instagram real.
// Verificar con una prueba real: forma del webhook (entry[].messaging[]), quick_replies y limite de texto.
//   quick replies: hasta 13, titulo 20 | texto: 1000 caracteres (limite conservador)

const { textoPlano, truncar } = require('./mensajes');

const LIM = { titulo: 20, texto: 1000 };
const MAX_RESPUESTAS = 13;

function respuestasRapidas(opciones) {
  return opciones.slice(0, MAX_RESPUESTAS).map((o) => ({
    content_type: 'text',
    title: truncar(o.titulo, LIM.titulo),
    payload: String(o.id)
  }));
}

// Cuerpo de la parte "message" de POST /{ig-user-id}/messages.
// Instagram no tiene listas ni pie: las filas se listan en el texto y tambien salen como respuestas rapidas.
function mensajeIG(msg) {
  if (msg.tipo === 'texto') return { text: truncar(msg.cuerpo, LIM.texto) };
  const pie = msg.pie ? `\n\n${msg.pie}` : '';
  if (msg.tipo === 'botones') {
    return { text: truncar(msg.cuerpo + pie, LIM.texto), quick_replies: respuestasRapidas(msg.opciones) };
  }
  // lista: el texto con todo el detalle (titulo completo y descripcion); los botones llevan el titulo corto
  const filas = msg.filas.map((f, i) => `${i + 1}. ${f.titulo}${f.descripcion ? ' - ' + f.descripcion : ''}`);
  return {
    text: truncar(`${msg.cuerpo}\n\n${filas.join('\n')}${pie}`, LIM.texto),
    quick_replies: respuestasRapidas(msg.filas)
  };
}

// Version solo texto, si Instagram rechaza las respuestas rapidas
function mensajeIGPlano(msg) {
  return { text: truncar(textoPlano(msg), LIM.texto) };
}

// Extrae los eventos que importan de un webhook de Instagram: { id, de, entrada, eco }.
// entrada tiene la misma forma que entiende bot.js, con canal: 'instagram'.
// Los ecos (mensajes enviados desde la propia cuenta, por ejemplo por el dueno desde la app) llevan eco: true.
function eventosDeWebhook(datos) {
  const eventos = [];
  if (!datos || datos.object !== 'instagram') return eventos;
  for (const entrada of datos.entry || []) {
    for (const ev of entrada.messaging || []) {
      const m = ev.message;
      const de = ev.sender && ev.sender.id;
      if (m) {
        if (m.is_echo) {
          eventos.push({ id: m.mid, de: ev.recipient && ev.recipient.id, entrada: null, eco: true });
        } else if (m.is_deleted) {
          continue;
        } else if (m.quick_reply && m.quick_reply.payload) {
          eventos.push({ id: m.mid, de, eco: false, entrada: { tipo: 'seleccion', id: m.quick_reply.payload, de, canal: 'instagram' } });
        } else if (typeof m.text === 'string' && m.text) {
          eventos.push({ id: m.mid, de, eco: false, entrada: { tipo: 'texto', texto: m.text, de, canal: 'instagram' } });
        } else {
          eventos.push({ id: m.mid, de, eco: false, entrada: { tipo: 'otro', de, canal: 'instagram' } });   // fotos, reels, stickers...
        }
      } else if (ev.postback && ev.postback.payload) {
        eventos.push({ id: ev.postback.mid, de, eco: false, entrada: { tipo: 'seleccion', id: ev.postback.payload, de, canal: 'instagram' } });
      }
    }
  }
  return eventos;
}

module.exports = { mensajeIG, mensajeIGPlano, eventosDeWebhook, LIM };
