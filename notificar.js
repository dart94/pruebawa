// Aviso al dueno por WhatsApp usando una plantilla aprobada (no depende de la ventana de 24 h).
//
// Plantilla esperada (categoria Utilidad), con 3 variables de cuerpo:
//   Nuevo aviso de ToyLoco 🔔 / Tipo: {{1}} / Producto: {{2}} / Cliente: {{3}} / Escribele a ese numero...
//
// Variables de entorno:
//   DUENO_WHATSAPP    numero que recibe los avisos (ej. 5216621234567). Sin el, no se avisa a nadie.
//   PLANTILLA_AVISO   nombre de la plantilla aprobada (por defecto aviso_cliente)
//   PLANTILLA_IDIOMA  codigo de idioma de la plantilla (por defecto es_MX)

const { negocio } = require('./negocio');

const TIPOS = negocio.aviso_tipos;   // etiqueta del tipo de aviso que ve el dueno
const ANTIREPETIR_MS = 10 * 60 * 1000;   // el mismo cliente + tipo + producto no vuelve a avisar en 10 min
const recientes = new Map();
let avisoConfigFaltante = false;

// Los parametros de plantilla no admiten saltos de linea, tabulaciones ni mas de 4 espacios seguidos
function limpio(valor, max) {
  const t = String(valor == null ? '' : valor).replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return (t || '-').slice(0, max);
}

function payloadAviso(evento, cfg) {
  return {
    messaging_product: 'whatsapp',
    to: cfg.dueno,
    type: 'template',
    template: {
      name: cfg.plantilla,
      language: { code: cfg.idioma },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: limpio(TIPOS[evento.tipo] || evento.tipo, 60) },
          { type: 'text', text: limpio(evento.producto, 100) },
          { type: 'text', text: limpio(evento.cliente ? '+' + evento.cliente : '', 30) }
        ]
      }]
    }
  };
}

function configuracion() {
  return {
    dueno: (process.env.DUENO_WHATSAPP || '').replace(/\D/g, ''),
    plantilla: process.env.PLANTILLA_AVISO || 'aviso_cliente',
    idioma: process.env.PLANTILLA_IDIOMA || 'es_MX'
  };
}

// evento: { tipo: 'persona' | 'interes', producto?, cliente }. enviarJson(payload) hace la llamada a la API.
// Nunca lanza: un fallo en el aviso no debe afectar la respuesta al cliente.
async function avisarDueno(evento, enviarJson) {
  try {
    const cfg = configuracion();
    if (!cfg.dueno) {
      if (!avisoConfigFaltante) {
        avisoConfigFaltante = true;
        console.log('[aviso-dueno] Falta DUENO_WHATSAPP: no se avisara a nadie de los pedidos de clientes');
      }
      return false;
    }
    const clave = `${evento.cliente}|${evento.tipo}|${evento.producto || ''}`;
    const ahora = Date.now();
    if ((recientes.get(clave) || 0) > ahora - ANTIREPETIR_MS) return false;
    recientes.set(clave, ahora);
    if (recientes.size > 2000) recientes.delete(recientes.keys().next().value);
    return await enviarJson(payloadAviso(evento, cfg));
  } catch (e) {
    console.log(`[aviso-dueno-error] ${e.message}`);
    return false;
  }
}

function reiniciarParaPruebas() { recientes.clear(); avisoConfigFaltante = false; }

module.exports = { avisarDueno, payloadAviso, limpio, reiniciarParaPruebas };
