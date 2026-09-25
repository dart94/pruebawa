const test = require('node:test');
const assert = require('node:assert');

delete process.env.CATALOGO_URL;
delete process.env.NODE_ENV;   // usa inventario-demo.json (datos ficticios)

const { responder, nombreLimpio } = require('../bot');
const { payload, truncar, textoPlano, LIM } = require('../mensajes');

const texto = (t) => responder({ tipo: 'texto', texto: t });
const sel = (id) => responder({ tipo: 'seleccion', id });

// Verifica que un mensaje respete los limites de la API de Meta
function validarLimites(msg) {
  const p = payload('521', msg);
  if (p.type === 'text') return;
  const i = p.interactive;
  assert.ok(i.body.text.length <= LIM.cuerpo);
  if (i.footer) assert.ok(i.footer.text.length <= LIM.pie);
  if (i.type === 'button') {
    assert.ok(i.action.buttons.length >= 1 && i.action.buttons.length <= 3);
    i.action.buttons.forEach((b) => assert.ok(b.reply.title.length <= LIM.boton && b.reply.id));
  } else {
    const filas = i.action.sections[0].rows;
    assert.ok(i.action.button.length <= LIM.botonLista);
    assert.ok(filas.length >= 1 && filas.length <= 10);
    filas.forEach((f) => {
      assert.ok(f.title.length <= LIM.fila && f.id);
      if (f.description) assert.ok(f.description.length <= LIM.descripcion);
    });
    assert.strictEqual(new Set(filas.map((f) => f.id)).size, filas.length, 'ids de fila repetidos');
  }
}

test('saludo: dos botones, amigable, sin horarios', async () => {
  for (const t of ['hola', 'Holaaa', 'Buenas tardes', 'menu', 'Menú']) {
    const m = await texto(t);
    assert.strictEqual(m.tipo, 'botones');
    assert.deepStrictEqual(m.opciones.map((o) => o.id), ['buscar', 'persona']);
    assert.match(m.cuerpo, /Hola/);
    validarLimites(m);
  }
});

test('buscar producto: lista de categorias derivada del catalogo + escribir nombre', async () => {
  const m = await sel('buscar');
  assert.strictEqual(m.tipo, 'lista');
  const ids = m.filas.map((f) => f.id);
  assert.ok(ids.includes('cat:figura') && ids.includes('cat:tcg') && ids.includes('escribir'));
  validarLimites(m);
});

test('elegir categoria muestra lista de productos con precio y pie de confirmacion', async () => {
  const m = await sel('cat:tcg');
  assert.strictEqual(m.tipo, 'lista');
  assert.match(m.filas[0].descripcion, /\$\d+ MXN/);
  assert.match(m.pie, /sujetos a confirmación/);
  validarLimites(m);
});

test('elegir producto muestra detalle con botones Me interesa / Buscar otro', async () => {
  const m = await sel('prod:D01');
  assert.strictEqual(m.tipo, 'botones');
  assert.match(m.cuerpo, /\*Figura Ninja Naranja\*/);
  assert.match(m.cuerpo, /pieza única/);
  assert.deepStrictEqual(m.opciones.map((o) => o.id), ['interes:D01', 'buscar']);
  validarLimites(m);
});

test('busqueda por texto con un solo resultado va directo al detalle', async () => {
  const m = await texto('pirata');
  assert.strictEqual(m.tipo, 'botones');
  assert.match(m.cuerpo, /Figura Pirata Sombrero/);
});

test('busqueda con varios resultados devuelve lista tocable', async () => {
  const m = await texto('sobres');
  assert.strictEqual(m.tipo, 'lista');
  assert.strictEqual(m.filas.length, 2);
  validarLimites(m);
});

test('cualquier texto fuera del menu se toma como busqueda, sin regañar', async () => {
  const m = await texto('cuanto cuesta un cuaderno');
  assert.strictEqual(m.tipo, 'botones');
  assert.match(m.cuerpo, /No encontré/);
  assert.doesNotMatch(m.cuerpo, /solo entiende/i);
  assert.deepStrictEqual(m.opciones.map((o) => o.id), ['buscar', 'persona']);
});

test('horario y ubicacion: no se inventan, se reconoce que falta el dato', async () => {
  for (const t of ['a que hora abren', 'cual es su horario', 'donde estan']) {
    const m = await texto(t);
    assert.match(m.cuerpo, /todavía no lo tengo/);
    assert.doesNotMatch(m.cuerpo, /\d{1,2}:\d{2}/);
  }
});

test('me interesa y hablar con alguien confirman sin prometer tiempos', async () => {
  const a = await sel('interes:D02');
  const b = await sel('persona');
  for (const m of [a, b]) {
    assert.doesNotMatch(m.cuerpo, /minutos|horas|en cuanto pueda|te responderá/i);
    assert.deepStrictEqual(m.opciones.map((o) => o.id), ['menu']);
  }
});

test('clic viejo: producto que ya no existe o id desconocido', async () => {
  assert.match((await sel('prod:NOEXISTE')).cuerpo, /ya no está disponible/);
  assert.strictEqual((await sel('algo-raro')).tipo, 'botones');
});

test('imagen o audio: respuesta amable con opciones', async () => {
  const m = await responder({ tipo: 'otro' });
  assert.strictEqual(m.tipo, 'botones');
  validarLimites(m);
});

test('atajos numericos 1 y 2 siguen funcionando como respaldo', async () => {
  assert.strictEqual((await texto('1')).tipo, 'lista');
  assert.match((await texto('2')).cuerpo, /solicitud/);
});

test('nombre limpio quita japones y sufijo (sobre)', () => {
  assert.strictEqual(nombreLimpio({ producto: 'Gaara (我愛羅)' }), 'Gaara');
  assert.strictEqual(nombreLimpio({ producto: 'Pitch Black (sobre)' }), 'Pitch Black');
  assert.strictEqual(nombreLimpio({ producto: 'Todoroki Shoto (pose de batalla)' }), 'Todoroki Shoto (pose de batalla)');
});

test('truncar y respaldo en texto plano', () => {
  assert.strictEqual(truncar('a'.repeat(30), 24).length, 24);
  assert.ok(truncar('a'.repeat(30), 24).endsWith('…'));
  const plano = textoPlano({ tipo: 'botones', cuerpo: 'Hola', opciones: [{ id: 'a', titulo: 'Uno' }, { id: 'b', titulo: 'Dos' }] });
  assert.match(plano, /1\. Uno\n2\. Dos/);
});

test('mas de 10 resultados: 9 productos + fila para afinar', async () => {
  const { obtenerCatalogo } = require('../catalogo');
  const productos = await obtenerCatalogo();
  const base = productos[0];
  productos.push(...Array.from({ length: 12 }, (_, i) => ({ ...base, id: 'X' + i, producto: 'Relleno ' + i })));
  const m = await texto('figura');
  assert.strictEqual(m.filas.length, 10);
  assert.strictEqual(m.filas[9].id, 'escribir');
  validarLimites(m);
});

test('me interesa y hablar con alguien avisan al dueno con cliente y producto', async () => {
  const { alAvisar } = require('../bot');
  const eventos = [];
  alAvisar(async (e) => { eventos.push(e); });
  await responder({ tipo: 'seleccion', id: 'interes:D02', de: '5216620000001' });
  await responder({ tipo: 'seleccion', id: 'persona', de: '5216620000002' });
  await responder({ tipo: 'texto', texto: '2', de: '5216620000003' });
  await new Promise((r) => setImmediate(r));
  assert.deepStrictEqual(eventos, [
    { tipo: 'interes', producto: 'Figura Heroe Azul', cliente: '5216620000001' },
    { tipo: 'persona', cliente: '5216620000002' },
    { tipo: 'persona', cliente: '5216620000003' }
  ]);
  alAvisar(async () => {});
});

test('si el aviso falla, el cliente igual recibe su respuesta', async () => {
  const { alAvisar } = require('../bot');
  alAvisar(async () => { throw new Error('boom'); });
  const m = await responder({ tipo: 'seleccion', id: 'persona', de: '1' });
  assert.match(m.cuerpo, /Listo/);
  await new Promise((r) => setImmediate(r));
  alAvisar(async () => {});
});
