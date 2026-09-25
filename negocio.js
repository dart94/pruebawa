// Configuracion por negocio: textos, etiquetas y nombre. Se lee de negocio.json
// (o del archivo indicado en NEGOCIO_ARCHIVO) y se valida al arrancar, para que un error
// de captura falle en el deploy y no frente a un cliente.

const fs = require('fs');
const path = require('path');

// Textos obligatorios y variables {x} que cada uno puede usar. {nombre} esta permitida en todos.
const TEXTOS = {
  saludo: [], pie_menu: [], pie_confirmacion: [], pregunta_categoria: [],
  categoria_encontrados: ['n', 'categoria'], busqueda_encontrados: ['n'], parecidos: [],
  sin_resultados: ['consulta'], ficha_pie: [], interes: ['producto'], persona: [], escribir: [],
  sin_catalogo: [], categoria_vacia: [], producto_no_disponible: [], no_es_texto: [], dato_pendiente: []
};
const BOTONES = { buscar: 20, buscar_otro: 20, persona: 20, menu: 20, me_interesa: 20 };   // maximo de caracteres (Meta)
const LISTAS = {
  boton_categorias: ['', 20], seccion_categorias: ['', 24], boton_productos: ['', 20], seccion_productos: ['', 24],
  disponible_uno: ['n', 72], disponible_varios: ['n', 72], escribir_titulo: ['', 24],
  escribir_descripcion: ['', 72], afinar_descripcion: ['', 72]
};

function variables(texto) {
  return [...String(texto).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

function validar(cfg) {
  const errores = [];
  const texto = (ruta, valor, permitidas, max) => {
    if (typeof valor !== 'string' || !valor.trim()) { errores.push(`${ruta}: falta o esta vacio`); return; }
    if (max && valor.length > max) errores.push(`${ruta}: mide ${valor.length} y el maximo de WhatsApp es ${max}`);
    for (const v of variables(valor)) {
      if (v !== 'nombre' && !permitidas.includes(v)) errores.push(`${ruta}: la variable {${v}} no se puede usar aqui`);
    }
  };

  texto('nombre', cfg.nombre, []);
  texto('moneda', cfg.moneda, []);
  if (!cfg.categorias || typeof cfg.categorias !== 'object') errores.push('categorias: falta');
  else for (const [k, v] of Object.entries(cfg.categorias)) texto(`categorias.${k}`, v, [], 24);
  if (cfg.quitar_sufijos !== undefined && !Array.isArray(cfg.quitar_sufijos)) errores.push('quitar_sufijos: debe ser una lista');

  const s = cfg.stock || {};
  texto('stock.uno', s.uno, []);
  texto('stock.varios', s.varios, ['n']);
  for (const [k, v] of Object.entries(s.por_categoria || {})) texto(`stock.por_categoria.${k}`, v, ['n']);

  for (const [k, max] of Object.entries(BOTONES)) texto(`botones.${k}`, (cfg.botones || {})[k], [], max);
  for (const [k, [vars, max]] of Object.entries(LISTAS)) texto(`listas.${k}`, (cfg.listas || {})[k], vars ? [vars] : [], max);
  for (const [k, vars] of Object.entries(TEXTOS)) {
    texto(`textos.${k}`, (cfg.textos || {})[k], vars, k.startsWith('pie_') ? 60 : 1024);
  }
  for (const k of ['persona', 'interes']) texto(`aviso_tipos.${k}`, (cfg.aviso_tipos || {})[k], [], 60);
  return errores;
}

function cargar(ruta) {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch (e) {
    throw new Error(`No se pudo leer la configuracion del negocio (${path.basename(ruta)}): ${e.message}`);
  }
  const errores = validar(cfg);
  if (errores.length) {
    throw new Error(`Configuracion del negocio invalida (${path.basename(ruta)}):\n - ${errores.join('\n - ')}`);
  }
  return cfg;
}

// Reemplaza {variable} en un texto de la configuracion; {nombre} siempre esta disponible.
function fmt(plantilla, vars = {}) {
  return String(plantilla).replace(/\{(\w+)\}/g, (m, k) => (k === 'nombre' ? negocio.nombre : (k in vars ? vars[k] : m)));
}

const negocio = cargar(process.env.NEGOCIO_ARCHIVO || path.join(__dirname, 'negocio.json'));

module.exports = { negocio, fmt, cargar, validar };
