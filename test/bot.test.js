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

test('preguntas frecuentes: horario, ubicacion, envios, pagos y apartado tienen respuesta fija', async () => {
  const casos = [
    [['a que hora abren', 'cual es su horario', 'hola, a que hora atienden?', 'abren los domingos?'], /8:00 a\. m\. a 8:00 p\. m\./],
    [['donde estan', 'tienen tienda fisica?', 'cual es su direccion'], /No tenemos local físico/],
    [['hacen envios?', 'me lo mandas a Guadalajara?', 'cuanto cuesta el envio', 'que paqueteria usan'], /a cargo del cliente/],
    [['formas de pago', 'aceptan mercado pago?', 'se puede pagar con tarjeta', 'cuenta para transferencia'], /transferencia, depósito y Mercado Pago/],
    [['como se aparta', 'se puede apartar?', 'cuanto es el anticipo', 'como apartan'], /50%.*14 días.*reembolsa/]
  ];
  for (const [mensajes, esperado] of casos) {
    for (const t of mensajes) {
      const m = await texto(t);
      assert.match(m.cuerpo, esperado, t);
      assert.deepStrictEqual(m.opciones.map((o) => o.id), ['persona', 'buscar']);
      validarLimites(m);
    }
  }
});

test('las respuestas fijas no inventan: sin direccion, sin tarifas ni tiempos de entrega', async () => {
  for (const t of ['a que hora abren', 'donde estan', 'hacen envios?', 'formas de pago', 'como se aparta']) {
    const m = await texto(t);
    assert.doesNotMatch(m.cuerpo, /\$\s?\d|\d+\s*(días hábiles|dias habiles|horas)/i, t);
  }
  assert.doesNotMatch((await texto('hacen envios?')).cuerpo, /gratis|llega en|días hábiles/i);
});

test('quiero apartar un producto sigue yendo al producto, no a la politica de apartado', async () => {
  assert.match((await texto('quiero apartar el pirata')).cuerpo, /Figura Pirata Sombrero/);
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

test('desde instagram el aviso al dueno lleva el canal', async () => {
  const { alAvisar } = require('../bot');
  const eventos = [];
  alAvisar(async (e) => { eventos.push(e); });
  await responder({ tipo: 'seleccion', id: 'interes:D02', de: '900000000000001', canal: 'instagram' });
  await new Promise((r) => setImmediate(r));
  assert.deepStrictEqual(eventos, [
    { tipo: 'interes', producto: 'Figura Heroe Azul', cliente: '900000000000001', canal: 'instagram' }
  ]);
  alAvisar(async () => {});
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

test('saludo con intencion: "hola, tienen el pirata?" atiende el producto, no solo el menu', async () => {
  for (const t of ['hola, tienen el pirata?', 'Buenas tardes, busco el pirata', 'info del pirata']) {
    const m = await texto(t);
    assert.strictEqual(m.tipo, 'botones');
    assert.match(m.cuerpo, /Figura Pirata Sombrero/, t);
  }
  assert.match((await texto('hola buenas tardes')).cuerpo, /Hola/);   // solo saludo: sigue el menu
  assert.match((await texto('hola, como estas?')).cuerpo, /Hola/);
});

test('cierre ("ok gracias") se agradece, no se busca', async () => {
  for (const t of ['ok gracias', 'Gracias!', 'muchas gracias', 'ok perfecto', 'de nada']) {
    const m = await texto(t);
    assert.strictEqual(m.tipo, 'texto', t);
    assert.match(m.cuerpo, /Con gusto/);
  }
});

test('"lo quiero" sin producto pregunta cual, en vez de decir que no encontro', async () => {
  for (const t of ['si lo quiero', 'lo quiero', 'apartar', 'me interesa', 'lo aparto']) {
    const m = await texto(t);
    assert.strictEqual(m.tipo, 'botones', t);
    assert.match(m.cuerpo, /Cuál pieza/);
    assert.doesNotMatch(m.cuerpo, /No encontré/);
    assert.deepStrictEqual(m.opciones.map((o) => o.id), ['buscar', 'persona']);
    validarLimites(m);
  }
});

test('"quiero apartar el pirata" va directo al producto', async () => {
  const m = await texto('quiero apartar el pirata');
  assert.match(m.cuerpo, /Figura Pirata Sombrero/);
});

test('mensaje sin nada que buscar invita a decir que busca, sin repetir la frase', async () => {
  const m = await texto('cuanto cuesta');
  assert.strictEqual(m.tipo, 'botones');
  assert.match(m.cuerpo, /Dime qué buscas/);
  assert.doesNotMatch(m.cuerpo, /No encontré/);
});

test('error de dedo en el nombre encuentra el producto', async () => {
  const m = await texto('pirrata');
  assert.match(m.cuerpo, /Figura Pirata Sombrero/);
});

test('"tarjetas" de coleccion no se confunden con pago con tarjeta', async () => {
  assert.doesNotMatch((await texto('tienen tarjetas de pokemon')).cuerpo, /Mercado Pago/);
  assert.match((await texto('puedo pagar con tarjeta?')).cuerpo, /Mercado Pago/);
  assert.match((await texto('aceptan tarjeta de credito')).cuerpo, /Mercado Pago/);
});
