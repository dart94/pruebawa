// Webhook de WhatsApp Cloud API - sin dependencias externas
// Requiere Node 18 o superior (usa fetch nativo)

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { responder, alAvisar } = require('./bot');
const { avisarDueno } = require('./notificar');
const { texto, payload, textoPlano } = require('./mensajes');

// ---------- Configuracion ----------

function cargarEnv(ruta) {
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const i = limpia.indexOf('=');
    if (i === -1) continue;
    const clave = limpia.slice(0, i).trim();
    let valor = limpia.slice(i + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (!process.env[clave]) process.env[clave] = valor;
  }
}

cargarEnv(path.join(__dirname, '.env'));

const PORT           = process.env.PORT || 3000;
const VERIFY_TOKEN   = process.env.VERIFY_TOKEN || '';
const TOKEN          = process.env.WHATSAPP_TOKEN || '';
const PHONE_ID       = process.env.PHONE_NUMBER_ID || '';
const APP_SECRET     = process.env.APP_SECRET || '';
const VERSION        = process.env.API_VERSION || 'v26.0';
const API            = `https://graph.facebook.com/${VERSION}`;
const PRODUCCION     = process.env.NODE_ENV === 'production';
const DRY_RUN        = process.env.DRY_RUN === '1';   // no llama a Meta, solo registra
const LOG_CONTENIDO  = process.env.LOG_CONTENIDO === '1'; // por defecto no se registra texto ni nombres de clientes
const MAX_BODY       = 1024 * 1024;   // 1 MB, Meta manda payloads de pocos KB

if (!VERIFY_TOKEN) {
  console.error('[fatal] Falta VERIFY_TOKEN en el entorno o en .env');
  process.exit(1);
}
if (PRODUCCION && !APP_SECRET) {
  console.error('[fatal] En produccion APP_SECRET es obligatorio para validar la firma de Meta');
  process.exit(1);
}

function enmascarar(numero) {
  const n = String(numero || '');
  return n.length > 4 ? '***' + n.slice(-4) : '***';
}

// IDs de mensajes ya procesados (Meta reintenta entregas). Se guarda un maximo para no crecer sin limite.
const procesados = new Set();
function yaProcesado(id) {
  if (!id) return false;
  if (procesados.has(id)) return true;
  procesados.add(id);
  if (procesados.size > 5000) procesados.delete(procesados.values().next().value);
  return false;
}

// ---------- Envio a la API ----------

async function llamarMensajes(cuerpo) {
  return fetch(`${API}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cuerpo)
  });
}

// Envia un mensaje (texto, botones o lista). Si Meta rechaza uno interactivo, reintenta como texto plano.
async function enviar(para, msg) {
  if (DRY_RUN) {
    console.log(`[dry-run] ${msg.tipo} para ${enmascarar(para)}${LOG_CONTENIDO ? ':\n' + JSON.stringify(payload(para, msg).interactive || payload(para, msg).text, null, 1) : ''}`);
    return;
  }
  if (!TOKEN || !PHONE_ID) {
    console.log('[aviso] Falta WHATSAPP_TOKEN o PHONE_NUMBER_ID en .env, no se envia nada.');
    return;
  }
  const res = await llamarMensajes(payload(para, msg));
  if (res.ok) {
    console.log(`[envio] ${res.status} ${msg.tipo} a ${enmascarar(para)}`);
    return;
  }
  console.log(`[envio-error] ${res.status} ${await res.text()}`);   // el error de Meta no incluye datos del cliente
  if (msg.tipo !== 'texto') {
    const respaldo = await llamarMensajes(payload(para, texto(textoPlano(msg))));
    console.log(`[envio-respaldo] ${respaldo.status} texto plano a ${enmascarar(para)}`);
  }
}

// Envia un payload ya armado (plantilla de aviso al dueno). Devuelve true si Meta lo acepto.
async function enviarPayload(cuerpo) {
  if (DRY_RUN) {
    console.log(`[dry-run] aviso al dueno (${enmascarar(cuerpo.to)}) plantilla ${cuerpo.template.name}${LOG_CONTENIDO ? ': ' + JSON.stringify(cuerpo.template.components[0].parameters.map((x) => x.text)) : ''}`);
    return true;
  }
  if (!TOKEN || !PHONE_ID) return false;
  const res = await llamarMensajes(cuerpo);
  console.log(res.ok ? `[aviso-dueno] ${res.status} enviado` : `[aviso-dueno-error] ${res.status} ${await res.text()}`);
  return res.ok;
}
alAvisar((evento) => avisarDueno(evento, enviarPayload));

async function marcarLeido(idMensaje) {
  if (DRY_RUN || !TOKEN || !PHONE_ID) return;
  await fetch(`${API}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: idMensaje })
  }).catch(() => {});
}

// Convierte un mensaje entrante de Meta en la entrada que entiende el bot
function entradaDe(mensaje) {
  if (mensaje.type === 'text') return { tipo: 'texto', texto: mensaje.text.body, de: mensaje.from };
  if (mensaje.type === 'interactive') {
    const r = mensaje.interactive.button_reply || mensaje.interactive.list_reply;
    if (r) return { tipo: 'seleccion', id: r.id, de: mensaje.from };
  }
  return { tipo: 'otro', de: mensaje.from };
}

// ---------- Firma de Meta ----------

function firmaValida(cuerpoCrudo, cabecera) {   // cuerpoCrudo: Buffer
  if (!APP_SECRET) return !PRODUCCION;     // sin secreto solo se acepta fuera de produccion (pruebas locales)
  if (!cabecera) return false;
  const esperado = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(cuerpoCrudo).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(cabecera);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Servidor ----------

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Verificacion inicial que hace Meta al guardar el webhook
  if (req.method === 'GET' && (url.pathname === '/webhook' || url.searchParams.has('hub.mode'))) {
    const modo = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const reto = url.searchParams.get('hub.challenge');
    if (modo === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[webhook] Verificacion correcta');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(reto);
    }
    console.log('[webhook] Verificacion rechazada');
    res.writeHead(403);
    return res.end('Token incorrecto');
  }

  // Mensajes entrantes
  if (req.method === 'POST' && (url.pathname === '/webhook' || url.pathname === '/')) {
    const trozos = [];
    let tam = 0;
    let excedido = false;
    req.on('data', (c) => {
      tam += c.length;
      if (tam > MAX_BODY) { excedido = true; return; }
      trozos.push(c);
    });
    req.on('end', async () => {
      if (excedido) {
        res.writeHead(413);
        return res.end();
      }
      const crudo = Buffer.concat(trozos);
      if (!firmaValida(crudo, req.headers['x-hub-signature-256'])) {
        console.log('[webhook] Firma invalida');
        res.writeHead(401);
        return res.end();
      }

      // Contestar rapido a Meta, procesar despues
      res.writeHead(200);
      res.end('EVENT_RECEIVED');

      try {
        const datos = JSON.parse(crudo.toString('utf8'));
        for (const entrada of datos.entry || []) {
          for (const cambio of entrada.changes || []) {
            const valor = cambio.value || {};

            for (const estado of valor.statuses || []) {
              console.log(`[estado] ${estado.id} -> ${estado.status}`);
            }

            for (const mensaje of valor.messages || []) {
              if (yaProcesado(mensaje.id)) {
                console.log(`[duplicado] ${mensaje.id} ignorado`);
                continue;
              }
              const de = mensaje.from;
              try {
                const detalle = LOG_CONTENIDO && mensaje.type === 'text' ? `: ${mensaje.text.body}` : '';
                console.log(`[entrante] ${enmascarar(de)} tipo ${mensaje.type}${detalle}`);
                await marcarLeido(mensaje.id);
                await enviar(de, await responder(entradaDe(mensaje)));
              } catch (e) {
                console.log(`[error] mensaje ${mensaje.id}: ${e.message}`);
              }
            }
          }
        }
      } catch (e) {
        console.log('[error] ' + e.message);
      }
    });
    return;
  }

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Webhook de WhatsApp activo');
  }

  res.writeHead(404);
  res.end();
});

// Railway envia SIGTERM al redesplegar: dejar de aceptar conexiones y terminar las en curso
process.on('SIGTERM', () => {
  console.log('[apagado] SIGTERM recibido, cerrando');
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
});

servidor.listen(PORT, () => {
  console.log(`Webhook escuchando en http://localhost:${PORT}`);
  console.log(`PHONE_NUMBER_ID: ${PHONE_ID ? 'configurado' : '(sin configurar)'}`);
  if (DRY_RUN) console.log('MODO DRY_RUN: no se envia nada a WhatsApp');
  console.log(`Firma de Meta: ${APP_SECRET ? 'se valida' : 'no se valida (falta APP_SECRET)'}`);
});
