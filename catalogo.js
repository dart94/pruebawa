// Catalogo publico del negocio: lee la pestana BOT publicada como CSV (CATALOGO_URL)
// o, solo en desarrollo, inventario-demo.json. Nunca contiene costos ni datos de clientes.
//
// Contrato de columnas (encabezados sin importar mayusculas/acentos):
//   id, categoria, producto, tema, linea, precio, cantidad, estado

const fs = require('fs');
const path = require('path');

function ttlMs() { return (Number(process.env.CATALOGO_TTL_SEG) || 300) * 1000; }
const MAX_RESULTADOS = 6;

function normalizar(texto) {
  return String(texto == null ? '' : texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// ---------- CSV ----------

function parsearCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  const s = texto.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (comillas) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') {
      comillas = true;
    } else if (c === ',') {
      fila.push(campo); campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      filas.push(fila); fila = [];
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

const COLUMNAS = ['id', 'categoria', 'producto', 'tema', 'linea', 'precio', 'cantidad', 'estado'];

function numero(valor) {
  const n = Number(String(valor == null ? '' : valor).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

// Convierte filas de CSV en productos. Lanza error si el formato no es el esperado
// (por ejemplo si Google devuelve una pagina HTML en lugar del CSV).
function filasAProductos(filas) {
  if (!filas.length) throw new Error('CSV vacio');
  const encabezado = filas[0].map(normalizar);
  const idx = {};
  for (const col of COLUMNAS) {
    idx[col] = encabezado.indexOf(col);
    if (idx[col] === -1) throw new Error(`Falta la columna "${col}" en el catalogo`);
  }
  const productos = [];
  for (const f of filas.slice(1)) {
    const id = (f[idx.id] || '').trim();
    const producto = (f[idx.producto] || '').trim();
    if (!id || !producto) continue;
    productos.push({
      id,
      categoria: (f[idx.categoria] || '').trim(),
      producto,
      tema: (f[idx.tema] || '').trim(),
      linea: (f[idx.linea] || '').trim(),
      precio: numero(f[idx.precio]),
      cantidad: numero(f[idx.cantidad]),
      estado: (f[idx.estado] || '').trim()
    });
  }
  return productos;
}

// Defensa en profundidad: aunque la hoja ya filtra, solo se ofrece lo disponible,
// con cantidad y precio validos.
function ofrecibles(productos) {
  return productos.filter((p) =>
    normalizar(p.estado) === 'disponible' && p.cantidad > 0 && p.precio > 0);
}

// ---------- Carga con cache ----------

const cache = { productos: null, cargadoEn: 0, fuente: null };
let enCurso = null;

async function descargar() {
  const url = process.env.CATALOGO_URL;
  if (url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Catalogo HTTP ${res.status}`);
    return { productos: filasAProductos(parsearCsv(await res.text())), fuente: 'hoja' };
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Falta CATALOGO_URL en produccion');   // nunca mostrar datos de demo a clientes reales
  }
  const ruta = path.join(__dirname, 'inventario-demo.json');
  return { productos: JSON.parse(fs.readFileSync(ruta, 'utf8')).productos, fuente: 'demo' };
}

// Devuelve la lista de productos ofrecibles, o null si no se pudo consultar y no hay copia previa.
async function obtenerCatalogo() {
  if (cache.productos && Date.now() - cache.cargadoEn < ttlMs()) return cache.productos;
  if (!enCurso) {
    enCurso = descargar()
      .then(({ productos, fuente }) => {
        cache.productos = ofrecibles(productos);
        cache.cargadoEn = Date.now();
        cache.fuente = fuente;
      })
      .catch((e) => {
        console.log(`[catalogo-error] ${e.message}${cache.productos ? ' (se usa la ultima copia)' : ''}`);
        if (cache.productos) cache.cargadoEn = Date.now() - ttlMs() + 30000;   // reintentar en ~30 s
      })
      .finally(() => { enCurso = null; });
  }
  await enCurso;
  return cache.productos;
}

// ---------- Busqueda ----------

const IGNORAR = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'en', 'con', 'para', 'por', 'que',
  'me', 'mi', 'tu', 'tienes', 'tiene', 'tienen', 'hay', 'quiero', 'quisiera', 'busco', 'buscas', 'buscando',
  'cuanto', 'cuesta', 'cuestan', 'precio', 'precios', 'favor', 'algun', 'alguna', 'algo', 'si', 'disponible',
  'disponibles', 'esta', 'estan', 'ver', 'saber', 'hola', 'buenas', 'buenos', 'dias', 'tardes', 'noches'
]);
const GENERICOS = new Set(['figura', 'sobre', 'tcg', 'accesorio', 'carta']);

function tokens(texto) {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !IGNORAR.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));   // plural simple
}

function buscar(productos, consulta) {
  const ts = tokens(consulta);
  if (!ts.length) return { exactos: [], parecidos: [] };
  const puntuados = productos.map((p) => {
    const heno = normalizar(`${p.categoria} ${p.producto} ${p.tema} ${p.linea}`);
    const aciertos = ts.filter((t) => heno.includes(t));
    return { p, aciertos };
  });
  const exactos = puntuados.filter((x) => x.aciertos.length === ts.length).map((x) => x.p);
  if (exactos.length) return { exactos, parecidos: [] };
  const especificos = ts.filter((t) => !GENERICOS.has(t));
  const parecidos = especificos.length
    ? puntuados
        .filter((x) => x.aciertos.some((t) => especificos.includes(t)))
        .sort((a, b) => b.aciertos.length - a.aciertos.length)
        .map((x) => x.p)
    : [];
  return { exactos: [], parecidos };
}

// ---------- Texto para el cliente ----------

function linea(p) {
  const detalle = [p.tema, p.linea].filter(Boolean).join(' · ');
  const stock = p.categoria.toLowerCase() === 'tcg'
    ? `${p.cantidad} disponibles`
    : (p.cantidad === 1 ? '1 pieza' : `${p.cantidad} piezas`);
  return `• ${p.producto}${detalle ? ' (' + detalle + ')' : ''} - $${p.precio} MXN - ${stock}`;
}

function listar(productos) {
  const visibles = productos.slice(0, MAX_RESULTADOS).map(linea);
  const extra = productos.length - visibles.length;
  if (extra > 0) visibles.push(`Y ${extra} mas. Escribe algo mas especifico (por ejemplo el nombre) para acotar.`);
  return visibles.join('\n');
}

module.exports = { obtenerCatalogo, buscar, listar, parsearCsv, filasAProductos, ofrecibles, tokens, normalizar };
