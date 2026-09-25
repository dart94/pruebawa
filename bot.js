// Logica de conversacion. Recibe lo que el cliente hizo y devuelve el mensaje a enviar.
//   entrada: { tipo: 'texto', texto, de } | { tipo: 'seleccion', id, de } | { tipo: 'otro', de }
// Es asincrono porque consulta el catalogo. No envia nada: eso lo hace server.js.
// Los textos, etiquetas y el nombre del negocio vienen de negocio.json (ver negocio.js).

const { obtenerCatalogo, buscar, normalizar } = require('./catalogo');
const { texto, botones, lista } = require('./mensajes');
const { negocio, fmt } = require('./negocio');

const T = negocio.textos;

// server.js registra aqui como avisar al dueno; por defecto no hace nada.
let avisar = async () => {};
function alAvisar(fn) { avisar = fn; }
function aviso(evento) {   // sin await: el aviso no retrasa ni rompe la respuesta al cliente
  Promise.resolve().then(() => avisar(evento)).catch((e) => console.log(`[aviso-error] ${e.message}`));
}

const BTN = {
  buscar: { id: 'buscar', titulo: negocio.botones.buscar },
  buscarOtro: { id: 'buscar', titulo: negocio.botones.buscar_otro },
  persona: { id: 'persona', titulo: negocio.botones.persona },
  menu: { id: 'menu', titulo: negocio.botones.menu }
};

// ---------- utilidades de presentacion ----------

// Quita el nombre en japones entre parentesis y los sufijos configurados (por ejemplo "(sobre)")
function nombreLimpio(p) {
  let nombre = p.producto.replace(/\s*\([^)]*[　-鿿][^)]*\)/g, '').trim();
  for (const sufijo of negocio.quitar_sufijos || []) {
    if (nombre.toLowerCase().endsWith(sufijo.toLowerCase())) nombre = nombre.slice(0, -sufijo.length).trim();
  }
  return nombre;
}

function etiquetaCategoria(categoria) {
  return negocio.categorias[normalizar(categoria)] || categoria;
}

function stockTexto(p) {
  const propio = negocio.stock.por_categoria && negocio.stock.por_categoria[normalizar(p.categoria)];
  if (propio) return fmt(propio, { n: p.cantidad });
  return p.cantidad === 1 ? negocio.stock.uno : fmt(negocio.stock.varios, { n: p.cantidad });
}

function filaProducto(p) {
  return {
    id: `prod:${p.id}`,
    titulo: nombreLimpio(p),
    descripcion: [p.tema, `$${p.precio} ${negocio.moneda}`, stockTexto(p)].filter(Boolean).join(' · ')
  };
}

function filaEscribir(descripcion) {
  return { id: 'escribir', titulo: negocio.listas.escribir_titulo, descripcion };
}

// Lista de productos tocable. Con mas de 10, la ultima fila invita a afinar la busqueda.
function listaProductos(cuerpo, productos) {
  let filas = productos.map(filaProducto);
  if (filas.length > 10) {
    filas = filas.slice(0, 9);
    filas.push(filaEscribir(negocio.listas.afinar_descripcion));
  }
  return lista(cuerpo, negocio.listas.boton_productos, filas, T.pie_confirmacion, negocio.listas.seccion_productos);
}

function detalle(p) {
  const marca = [p.tema, p.linea].filter(Boolean).join(' · ');
  return botones(
    `*${nombreLimpio(p)}*\n${marca ? marca + '\n' : ''}💰 $${p.precio} ${negocio.moneda} · ${stockTexto(p)}\n\n${T.ficha_pie}`,
    [{ id: `interes:${p.id}`, titulo: negocio.botones.me_interesa }, BTN.buscarOtro]
  );
}

// ---------- mensajes fijos ----------

function menu() {
  return botones(fmt(T.saludo), [BTN.buscar, BTN.persona], T.pie_menu);
}

function sinCatalogo() {
  return botones(T.sin_catalogo, [BTN.persona]);
}

async function categorias(productos) {
  const conteo = new Map();
  for (const p of productos) conteo.set(normalizar(p.categoria), (conteo.get(normalizar(p.categoria)) || 0) + 1);
  const filas = [...conteo.entries()].map(([cat, n]) => ({
    id: `cat:${cat}`,
    titulo: negocio.categorias[cat] || cat,
    descripcion: fmt(n === 1 ? negocio.listas.disponible_uno : negocio.listas.disponible_varios, { n })
  }));
  filas.push(filaEscribir(negocio.listas.escribir_descripcion));
  return lista(T.pregunta_categoria, negocio.listas.boton_categorias, filas, undefined, negocio.listas.seccion_categorias);
}

// ---------- busqueda ----------

async function resultadosDeBusqueda(consulta, productos) {
  const limpia = String(consulta || '').trim().slice(0, 200);
  const { exactos, parecidos } = buscar(productos, limpia);
  console.log(`[consulta] resultados: ${exactos.length} exactos, ${parecidos.length} parecidos`);
  if (exactos.length === 1) return detalle(exactos[0]);
  if (exactos.length) return listaProductos(fmt(T.busqueda_encontrados, { n: exactos.length }), exactos);
  if (parecidos.length) return listaProductos(T.parecidos, parecidos);
  return botones(fmt(T.sin_resultados, { consulta: limpia }), [BTN.buscarOtro, BTN.persona]);
}

// ---------- entrada principal ----------

const SALUDO = /^(hola+|holi+|buenas|buenos dias|buenas tardes|buenas noches|info|informacion|menu|inicio)\b/;
const DATOS_PENDIENTES = /\b(horario|horarios|hora|abren|cierran|ubicacion|direccion|donde estan|donde queda)\b/;

async function responder(entrada) {
  if (entrada.tipo === 'otro') return botones(T.no_es_texto, [BTN.buscar, BTN.persona]);

  // Clics de botones y listas: llegan con un id estable
  if (entrada.tipo === 'seleccion') {
    const id = entrada.id || '';
    if (id === 'menu') return menu();
    if (id === 'persona') {
      console.log('[persona] el cliente pidio hablar con alguien');
      aviso({ tipo: 'persona', cliente: entrada.de });
      return botones(fmt(T.persona), [BTN.menu]);
    }
    if (id === 'escribir') return texto(T.escribir);

    const productos = await obtenerCatalogo();
    if (!productos) return sinCatalogo();

    if (id === 'buscar') return categorias(productos);
    if (id.startsWith('cat:')) {
      const cat = id.slice(4);
      const delaCategoria = productos.filter((p) => normalizar(p.categoria) === cat);
      if (!delaCategoria.length) return botones(T.categoria_vacia, [BTN.buscarOtro, BTN.persona]);
      return listaProductos(
        fmt(T.categoria_encontrados, { n: delaCategoria.length, categoria: etiquetaCategoria(delaCategoria[0].categoria) }),
        delaCategoria
      );
    }
    if (id.startsWith('prod:') || id.startsWith('interes:')) {
      const pid = id.slice(id.indexOf(':') + 1);
      const p = productos.find((x) => x.id === pid);
      if (!p) return botones(T.producto_no_disponible, [BTN.buscarOtro, BTN.persona]);
      if (id.startsWith('interes:')) {
        console.log(`[interes] producto ${p.id}`);
        aviso({ tipo: 'interes', producto: nombreLimpio(p), cliente: entrada.de });
        return botones(fmt(T.interes, { producto: nombreLimpio(p) }), [BTN.menu]);
      }
      return detalle(p);
    }
    return menu();   // id desconocido (por ejemplo, un boton de un mensaje viejo)
  }

  // Texto libre
  const t = normalizar(entrada.texto);
  if (SALUDO.test(t)) return menu();
  if (t === '1') return responder({ ...entrada, tipo: 'seleccion', id: 'buscar' });
  if (t === '2') return responder({ ...entrada, tipo: 'seleccion', id: 'persona' });
  if (DATOS_PENDIENTES.test(t)) return botones(T.dato_pendiente, [BTN.persona, BTN.buscar]);
  const productos = await obtenerCatalogo();
  if (!productos) return sinCatalogo();
  return resultadosDeBusqueda(entrada.texto, productos);   // cualquier otro texto se toma como busqueda
}

module.exports = { responder, nombreLimpio, alAvisar };
