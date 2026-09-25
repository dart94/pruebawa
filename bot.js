// Logica de conversacion. Recibe lo que el cliente hizo y devuelve el mensaje a enviar.
//   entrada: { tipo: 'texto', texto } | { tipo: 'seleccion', id } | { tipo: 'otro' }
// Es asincrono porque consulta el catalogo. No envia nada: eso lo hace server.js.

const { obtenerCatalogo, buscar, normalizar } = require('./catalogo');
const { texto, botones, lista } = require('./mensajes');

const NEGOCIO = process.env.NEGOCIO_NOMBRE || 'ToyLoco';
const PIE_CONFIRMACION = 'Precio y stock sujetos a confirmación.';

// Etiquetas de categoria (clave = categoria del catalogo, sin acentos ni mayusculas)
const ETIQUETAS = { figura: 'Figuras', tcg: 'Sobres Pokémon TCG', accesorio: 'Accesorios' };

const BTN = {
  buscar: { id: 'buscar', titulo: 'Buscar producto' },
  buscarOtro: { id: 'buscar', titulo: 'Buscar otro' },
  persona: { id: 'persona', titulo: 'Hablar con alguien' },
  menu: { id: 'menu', titulo: 'Volver al menú' }
};

// ---------- utilidades de presentacion ----------

// Quita el nombre en japones entre parentesis y el sufijo "(sobre)"
function nombreLimpio(p) {
  return p.producto
    .replace(/\s*\([^)]*[　-鿿][^)]*\)/g, '')
    .replace(/\s*\(sobre\)\s*$/i, '')
    .trim();
}

function etiquetaCategoria(categoria) {
  return ETIQUETAS[normalizar(categoria)] || categoria;
}

function stockTexto(p) {
  if (p.categoria.toLowerCase() === 'tcg') return `${p.cantidad} disp.`;
  return p.cantidad === 1 ? 'pieza única' : `${p.cantidad} piezas`;
}

function filaProducto(p) {
  return {
    id: `prod:${p.id}`,
    titulo: nombreLimpio(p),
    descripcion: [p.tema, `$${p.precio} MXN`, stockTexto(p)].filter(Boolean).join(' · ')
  };
}

// Lista de productos tocable. Con mas de 10, la ultima fila invita a afinar la busqueda.
function listaProductos(cuerpo, productos) {
  let filas = productos.map(filaProducto);
  if (filas.length > 10) {
    filas = filas.slice(0, 9);
    filas.push({ id: 'escribir', titulo: 'Escribir un nombre', descripcion: 'Para acotar la búsqueda' });
  }
  return lista(cuerpo, 'Ver productos', filas, PIE_CONFIRMACION, 'Productos');
}

function detalle(p) {
  const marca = [p.tema, p.linea].filter(Boolean).join(' · ');
  return botones(
    `*${nombreLimpio(p)}*\n${marca ? marca + '\n' : ''}💰 $${p.precio} MXN · ${stockTexto(p)}\n\nSujeto a confirmación antes de apartarlo.`,
    [{ id: `interes:${p.id}`, titulo: 'Me interesa' }, BTN.buscarOtro]
  );
}

// ---------- mensajes fijos ----------

function menu() {
  return botones(
    `¡Hola! 👋 Soy el asistente de ${NEGOCIO}. ¿Qué andas buscando?`,
    [BTN.buscar, BTN.persona],
    'Asistente automático'
  );
}

function sinCatalogo() {
  return botones('Uy, ahorita no puedo consultar el inventario 😅 Puedes dejar tu solicitud al equipo.', [BTN.persona]);
}

async function categorias(productos) {
  const conteo = new Map();
  for (const p of productos) conteo.set(normalizar(p.categoria), (conteo.get(normalizar(p.categoria)) || 0) + 1);
  const filas = [...conteo.entries()].map(([cat, n]) => ({
    id: `cat:${cat}`,
    titulo: ETIQUETAS[cat] || cat,
    descripcion: `${n} disponible${n === 1 ? '' : 's'}`
  }));
  filas.push({ id: 'escribir', titulo: 'Escribir un nombre', descripcion: 'Ej. Gogeta o Naruto' });
  return lista('¡Va! ¿De qué categoría? 👇', 'Ver categorías', filas, undefined, 'Categorías');
}

// ---------- busqueda ----------

async function resultadosDeBusqueda(consulta, productos) {
  const limpia = String(consulta || '').trim().slice(0, 200);
  const { exactos, parecidos } = buscar(productos, limpia);
  console.log(`[consulta] resultados: ${exactos.length} exactos, ${parecidos.length} parecidos`);
  if (exactos.length === 1) return detalle(exactos[0]);
  if (exactos.length) return listaProductos(`Encontré ${exactos.length} 🙌 Toca «Ver productos» y elige uno.`, exactos);
  if (parecidos.length) return listaProductos('No encontré justo eso, pero mira lo más parecido 👀', parecidos);
  return botones(`No encontré "${limpia}" ahorita 😕 Prueba con otro nombre o pregunta directo al equipo.`, [BTN.buscarOtro, BTN.persona]);
}

// ---------- entrada principal ----------

const SALUDO = /^(hola+|holi+|buenas|buenos dias|buenas tardes|buenas noches|info|informacion|menu|inicio)\b/;
const DATOS_PENDIENTES = /\b(horario|horarios|hora|abren|cierran|ubicacion|direccion|donde estan|donde queda)\b/;

async function responder(entrada) {
  if (entrada.tipo === 'otro') {
    return botones('Recibí tu mensaje, pero no puedo ver imágenes ni audios 😅 Cuéntame en texto qué buscas o toca una opción.', [BTN.buscar, BTN.persona]);
  }

  // Clics de botones y listas: llegan con un id estable
  if (entrada.tipo === 'seleccion') {
    const id = entrada.id || '';
    if (id === 'menu') return menu();
    if (id === 'persona') {
      console.log('[persona] el cliente pidio hablar con alguien');
      return botones(`Listo, dejé tu solicitud para el equipo de ${NEGOCIO} 🙌`, [BTN.menu]);
    }
    if (id === 'escribir') return texto('Dime qué buscas ✍️ Por ejemplo: Gogeta, figuras de Naruto o sobres de Pokémon.');

    const productos = await obtenerCatalogo();
    if (!productos) return sinCatalogo();

    if (id === 'buscar') return categorias(productos);
    if (id.startsWith('cat:')) {
      const cat = id.slice(4);
      const delaCategoria = productos.filter((p) => normalizar(p.categoria) === cat);
      if (!delaCategoria.length) return botones('Esa categoría ya no tiene productos disponibles 😕 ¿Buscamos otra cosa?', [BTN.buscarOtro, BTN.persona]);
      return listaProductos(`Tengo ${delaCategoria.length} en ${etiquetaCategoria(delaCategoria[0].categoria)} 🙌 Toca «Ver productos» y elige uno.`, delaCategoria);
    }
    if (id.startsWith('prod:') || id.startsWith('interes:')) {
      const pid = id.slice(id.indexOf(':') + 1);
      const p = productos.find((x) => x.id === pid);
      if (!p) return botones('Ese ya no está disponible 😕 ¿Buscamos otro?', [BTN.buscarOtro, BTN.persona]);
      if (id.startsWith('interes:')) {
        console.log(`[interes] producto ${p.id}`);
        return botones(`¡Anotado! 🙌 Quedó registrado tu interés en *${nombreLimpio(p)}*.`, [BTN.menu]);
      }
      return detalle(p);
    }
    return menu();   // id desconocido (por ejemplo, un boton de un mensaje viejo)
  }

  // Texto libre
  const t = normalizar(entrada.texto);
  if (SALUDO.test(t)) return menu();
  if (t === '1') return responder({ tipo: 'seleccion', id: 'buscar' });
  if (t === '2') return responder({ tipo: 'seleccion', id: 'persona' });
  if (DATOS_PENDIENTES.test(t)) {
    return botones('Ese dato todavía no lo tengo a la mano 😅 Puedes dejar tu pregunta al equipo.', [BTN.persona, BTN.buscar]);
  }
  const productos = await obtenerCatalogo();
  if (!productos) return sinCatalogo();
  return resultadosDeBusqueda(entrada.texto, productos);   // cualquier otro texto se toma como busqueda
}

module.exports = { responder, nombreLimpio };
