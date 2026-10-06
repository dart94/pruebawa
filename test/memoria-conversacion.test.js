// El bot recuerda el ultimo producto que vio cada cliente (hasta 24 h) para entender "lo quiero" o "cuanto cuesta".
const test = require('node:test');
const assert = require('node:assert');

delete process.env.CATALOGO_URL;
delete process.env.NODE_ENV;   // usa inventario-demo.json (datos ficticios)
delete process.env.ESTADO_DB;  // memoria, no un archivo

const { responder } = require('../bot');
const { payload, LIM } = require('../mensajes');

const como = (de, canal) => ({
  texto: (t) => responder({ tipo: 'texto', texto: t, de, ...(canal ? { canal } : {}) }),
  sel: (id) => responder({ tipo: 'seleccion', id, de, ...(canal ? { canal } : {}) })
});

function limitesOk(msg) {
  const i = payload('521', msg).interactive;
  assert.ok(i.body.text.length <= LIM.cuerpo);
  i.action.buttons.forEach((b) => assert.ok(b.reply.title.length <= LIM.boton && b.reply.id));
}

test('despues de ver un producto, "lo quiero" pregunta por ese producto con boton "Si, ese"', async () => {
  const c = como('mem-1');
  await c.texto('pirata');
  for (const t of ['lo quiero', 'si lo quiero', 'quiero apartarlo', 'si', 'ese']) {
    const m = await c.texto(t);
    assert.match(m.cuerpo, /Te refieres a \*Figura Pirata Sombrero\*/, t);
    assert.match(m.cuerpo, /\$\d+ MXN/);
    assert.deepStrictEqual(m.opciones.map((o) => o.id), ['interes:D03', 'buscar'], t);
    assert.strictEqual(m.opciones[0].titulo, 'Sí, ese');
    limitesOk(m);
  }
  assert.match((await c.sel('interes:D03')).cuerpo, /Quedó registrado/);   // el boton lleva al flujo de interes
});

test('despues de ver un producto, "cuanto cuesta" repite su ficha con el precio actual', async () => {
  const c = como('mem-2');
  await c.sel('prod:D02');
  for (const t of ['cuanto cuesta', 'y el precio?', 'cuanto sale']) {
    const m = await c.texto(t);
    assert.match(m.cuerpo, /\*Figura Heroe Azul\*/, t);
    assert.match(m.cuerpo, /\$\d+ MXN/);
  }
});

test('sin producto reciente, o con otro cliente, "lo quiero" sigue preguntando cual', async () => {
  await como('mem-3').texto('pirata');
  const otro = await como('mem-4').texto('lo quiero');   // otro cliente: no hereda el producto
  assert.match(otro.cuerpo, /Cuál pieza/);
  const otroCanal = await como('mem-3', 'instagram').texto('lo quiero');   // mismo id en otro canal tampoco
  assert.match(otroCanal.cuerpo, /Cuál pieza/);
});

test('un mensaje con producto o pregunta nueva manda sobre lo recordado', async () => {
  const c = como('mem-5');
  await c.texto('pirata');
  assert.match((await c.texto('quiero el heroe azul')).cuerpo, /Figura Heroe Azul/);   // producto nuevo
  assert.match((await c.texto('lo quiero')).cuerpo, /Te refieres a \*Figura Heroe Azul\*/);   // ahora recuerda el nuevo
  assert.match((await c.texto('a que hora abren')).cuerpo, /8:00 a\. m\./);   // las preguntas frecuentes siguen primero
});

test('si no habia un solo producto (lista o categoria), no se adivina cual', async () => {
  const c = como('mem-6');
  await c.sel('cat:tcg');   // lista de varios
  assert.match((await c.texto('lo quiero')).cuerpo, /Cuál pieza/);
});
