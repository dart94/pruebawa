// Memoria del bot: almacen clave-valor con vencimiento, para recordar cosas por cliente (ultimo producto visto,
// pausas) aunque Railway reinicie o redespliegue.
//
//   ESTADO_DB=/data/estado.db   archivo SQLite (en Railway, dentro de un volumen montado en /data)
//   sin ESTADO_DB               todo en memoria: funciona igual, pero se borra al reiniciar
//
// better-sqlite3 es dependencia OPCIONAL: si no se pudo instalar o abrir el archivo, el bot sigue en memoria y lo dice
// en el log. Un fallo del disco nunca debe tumbar la atencion al cliente, por eso cada operacion atrapa sus errores.

const fs = require('fs');
const path = require('path');

const MAX_MEMORIA = 20000;

function almacenMemoria(ahora) {
  const datos = new Map();
  return {
    tipo: 'memoria',
    obtener(clave) {
      const d = datos.get(clave);
      if (!d) return undefined;
      if (d.vence <= ahora()) { datos.delete(clave); return undefined; }
      return d.valor;
    },
    guardar(clave, valor, ttlMs) {
      datos.set(clave, { valor, vence: ahora() + ttlMs });
      if (datos.size > MAX_MEMORIA) datos.delete(datos.keys().next().value);
    },
    borrar(clave) { datos.delete(clave); },
    cerrar() {}
  };
}

function almacenSqlite(Database, ruta, ahora) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new Database(ruta);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec('CREATE TABLE IF NOT EXISTS estado (clave TEXT PRIMARY KEY, valor TEXT NOT NULL, vence INTEGER NOT NULL)');
  db.exec('CREATE INDEX IF NOT EXISTS estado_vence ON estado (vence)');
  const sel = db.prepare('SELECT valor, vence FROM estado WHERE clave = ?');
  const ins = db.prepare('INSERT OR REPLACE INTO estado (clave, valor, vence) VALUES (?, ?, ?)');
  const del = db.prepare('DELETE FROM estado WHERE clave = ?');
  const purga = db.prepare('DELETE FROM estado WHERE vence <= ?');
  let escrituras = 0;
  let avisoFallo = false;

  const seguro = (operacion, predeterminado) => {
    try { return operacion(); } catch (e) {
      if (!avisoFallo) { avisoFallo = true; console.log(`[estado-error] ${e.message} (se sigue atendiendo sin recordar)`); }
      return predeterminado;
    }
  };
  purga.run(ahora());   // al abrir se limpia lo vencido

  return {
    tipo: 'sqlite',
    obtener(clave) {
      return seguro(() => {
        const f = sel.get(clave);
        if (!f) return undefined;
        if (f.vence <= ahora()) { del.run(clave); return undefined; }
        return JSON.parse(f.valor);
      }, undefined);
    },
    guardar(clave, valor, ttlMs) {
      seguro(() => {
        ins.run(clave, JSON.stringify(valor), ahora() + ttlMs);
        if (++escrituras % 500 === 0) purga.run(ahora());   // limpieza periodica
      });
    },
    borrar(clave) { seguro(() => del.run(clave)); },
    cerrar() { seguro(() => db.close()); }
  };
}

// ruta: archivo SQLite o vacio para memoria. `ahora` es inyectable para las pruebas.
function crearAlmacen({ ruta = '', ahora = Date.now } = {}) {
  if (ruta) {
    try {
      const Database = require('better-sqlite3');
      return almacenSqlite(Database, ruta, ahora);
    } catch (e) {
      console.log(`[estado] No se pudo abrir SQLite (${e.message}): la memoria del bot queda en RAM y se borra al reiniciar`);
    }
  }
  return almacenMemoria(ahora);
}

// Almacen unico del proceso, creado la primera vez que se pide (asi las pruebas y los modulos que solo
// necesitan crearAlmacen no abren archivos ni escriben en el log al importarse).
let unico = null;
function almacen() {
  if (!unico) {
    unico = crearAlmacen({ ruta: process.env.ESTADO_DB || '' });
    console.log(`[estado] memoria del bot: ${unico.tipo}${unico.tipo === 'sqlite' ? ' (' + process.env.ESTADO_DB + ')' : ''}`);
  }
  return unico;
}

// ---------- Lo que recuerda el bot de cada cliente ----------

const VIGENCIA_PRODUCTO_MS = 24 * 60 * 60 * 1000;   // igual que la ventana de mensajeria de Instagram

// WhatsApp no lleva marca de canal; Instagram si. Asi un mismo numero/ID nunca se mezcla entre canales.
function claveCliente(entrada) {
  return `${entrada.canal || 'wa'}:${entrada.de}`;
}

function recordarProducto(entrada, producto, alm = almacen()) {
  if (!entrada || !entrada.de) return;
  alm.guardar(`prod:${claveCliente(entrada)}`, { id: producto.id }, VIGENCIA_PRODUCTO_MS);
}

// Lista de varios productos que acaba de ver (ids). Reemplaza al producto recordado: manda lo ultimo que vio.
function recordarLista(entrada, productos, alm = almacen()) {
  if (!entrada || !entrada.de || !productos.length) return;
  alm.guardar(`prod:${claveCliente(entrada)}`, { ids: productos.slice(0, 10).map((p) => p.id) }, VIGENCIA_PRODUCTO_MS);
}

// Devuelve { id } (un producto) o { ids } (una lista), o undefined si no hay nada reciente
function productoReciente(entrada, alm = almacen()) {
  if (!entrada || !entrada.de) return undefined;
  return alm.obtener(`prod:${claveCliente(entrada)}`);
}

module.exports = { crearAlmacen, almacen, claveCliente, recordarProducto, recordarLista, productoReciente };
