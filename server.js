// Webhook de WhatsApp Cloud API - sin dependencias externas
// Requiere Node 18 o superior (usa fetch nativo)

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { obtenerCatalogo, buscar, listar } = require('./catalogo');

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

// ---------- Logica del bot ----------
// Aqui defines que contesta. Recibe el texto del cliente y regresa la respuesta.

const MENU =
  'Hola, gracias por escribir a ToyLoco.\n\n' +
  'Este es un asistente automatico. Responde con un numero:\n' +
  '1. Buscar un producto (figuras, accesorios, TCG)\n' +
  '2. Horario y ubicacion\n' +
  '3. Hablar con una persona';

function normalizar(texto) {
  return (texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Estado de conversacion por cliente, en memoria (se pierde al reiniciar; expira solo).
const ESTADO_TTL = 30 * 60 * 1000;
const estados = new Map();   // numero -> { estado, hasta }

function estadoDe(numero) {
  const e = estados.get(numero);
  if (!e) return null;
  if (e.hasta < Date.now()) { estados.delete(numero); return null; }
  return e.estado;
}
function fijarEstado(numero, estado) {
  estados.set(numero, { estado, hasta: Date.now() + ESTADO_TTL });
  if (estados.size > 5000) estados.delete(estados.keys().next().value);
}

const AVISO_CONFIRMACION = 'Precio y disponibilidad sujetos a confirmacion: una persona del equipo de ToyLoco te respondera por este chat.';
const SEGUIR = 'Puedes buscar otro producto, escribir 3 para hablar con una persona, o "menu".';

async function responderBusqueda(texto, numero) {
  const consulta = (texto || '').trim().slice(0, 200);
  const productos = await obtenerCatalogo();
  if (!productos) {
    console.log(`[consulta] ${enmascarar(numero)} catalogo no disponible`);
    return 'Ahora no puedo consultar el inventario. Escribe 3 y una persona del equipo te ayuda por este chat.';
  }
  const { exactos, parecidos } = buscar(productos, consulta);
  console.log(`[consulta] ${enmascarar(numero)} resultados: ${exactos.length} exactos, ${parecidos.length} parecidos${LOG_CONTENIDO ? ' para: ' + consulta : ''}`);
  if (exactos.length) {
    return `Esto encontre:\n${listar(exactos)}\n\n${AVISO_CONFIRMACION}\n\n${SEGUIR}`;
  }
  if (parecidos.length) {
    return `No encontre exactamente eso, pero hay algo parecido:\n${listar(parecidos)}\n\n${AVISO_CONFIRMACION}\n\n${SEGUIR}`;
  }
  return `No encontre "${consulta}" en el inventario disponible. Prueba con otro nombre, o escribe 3 y una persona del equipo te ayuda.`;
}

async function responderA(texto, numero) {
  const t = normalizar(texto);

  if (/^(hola+|buenas|buenos dias|buenas tardes|buenas noches|info|informacion|menu)\b/.test(t)) {
    estados.delete(numero);
    return MENU;
  }
  if (t !== '1' && estadoDe(numero) === 'esperando_producto') {
    if (t === '2' || t === '3') {
      estados.delete(numero);
      return responderA(t, numero);
    }
    fijarEstado(numero, 'esperando_producto');   // sigue en modo busqueda hasta que escriba "menu", 2 o 3
    return responderBusqueda(texto, numero);
  }
  if (t === '1') {
    fijarEstado(numero, 'esperando_producto');
    return 'Escribe el nombre o tipo de producto que buscas (por ejemplo: Gogeta, figuras de Naruto, sobres de Pokemon TCG) y te muestro precio y disponibilidad.';
  }
  if (t === '2') {
    return 'Todavia no tengo el horario ni la ubicacion cargados en este asistente.\n\n' +
           'Escribe 3 y una persona del equipo te los confirma por este chat.';
  }
  if (t === '3') {
    return 'Recibido. Una persona del equipo de ToyLoco te respondera por este chat en cuanto pueda.';
  }
  return 'Este asistente automatico solo entiende las opciones del menu. Escribe "menu" para verlas, o "3" para hablar con una persona.';
}

// ---------- Envio a la API ----------

async function enviarTexto(para, texto) {
  if (DRY_RUN) {
    console.log(`[dry-run] no se envia a ${enmascarar(para)}${LOG_CONTENIDO ? ': ' + texto.replace(/\n/g, ' | ') : ''}`);
    return;
  }
  if (!TOKEN || !PHONE_ID) {
    console.log('[aviso] Falta WHATSAPP_TOKEN o PHONE_NUMBER_ID en .env, no se envia nada.');
    return;
  }
  const res = await fetch(`${API}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { body: texto }
    })
  });
  const cuerpo = await res.text();
  if (res.ok) {
    console.log(`[envio] ${res.status} a ${enmascarar(para)}`);
  } else {
    console.log(`[envio-error] ${res.status} ${cuerpo}`);   // el error de Meta no incluye datos del cliente
  }
}

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
                if (mensaje.type === 'text') {
                  await enviarTexto(de, await responderA(mensaje.text.body, de));
                } else {
                  await enviarTexto(de, 'Este asistente automatico solo entiende mensajes de texto. Escribe "menu" para ver las opciones.');
                }
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
