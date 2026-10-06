// "Mi pedido" (= algo ya pagado): el bot no lo consulta; dice que alguien de ToyLoco se contactara, avisa al dueno
// (solo WhatsApp) y marca la respuesta para que el servidor lo calle con ese cliente mientras lo atiende.
const test = require('node:test');
const assert = require('node:assert');

delete process.env.CATALOGO_URL;
delete process.env.NODE_ENV;
delete process.env.ESTADO_DB;

const { responder, alAvisar } = require('../bot');
const { payload, LIM } = require('../mensajes');

const texto = (t, extra = {}) => responder({ tipo: 'texto', texto: t, ...extra });

test('preguntas por un pedido o avisos de pago: alguien se contactara y el bot se calla con ese cliente', async () => {
  for (const t of ['mi pedido', 'donde esta mi pedido', 'cuando llega mi pedido?', 'estatus de mi compra', 'ya pague',
    'ya hice la transferencia', 'ya deposite', 'hola, mi pedido', 'Hola buenas, ya pagué']) {
    const m = await texto(t);
    assert.match(m.cuerpo, /alguien de ToyLoco se contactará contigo en breve/, t);
    assert.strictEqual(m.pausar, true, t);
    assert.deepStrictEqual(m.opciones.map((o) => o.id), ['menu'], t);   // "Volver al menu" levanta la pausa
    assert.ok(payload('521', m).interactive.body.text.length <= LIM.cuerpo);
  }
});

test('no confunde preguntas de envio, pago o apartado con un pedido', async () => {
  for (const t of ['cuanto cuesta el envio', 'formas de pago', 'como se aparta', 'a que hora abren', 'cuanto cuesta']) {
    assert.notStrictEqual((await texto(t)).pausar, true, t);
  }
});

test('"Hablar con alguien" tambien marca la pausa', async () => {
  assert.strictEqual((await responder({ tipo: 'seleccion', id: 'persona' })).pausar, true);
});

test('el resto de respuestas no marcan pausa', async () => {
  for (const t of ['hola', 'sobres', 'ok gracias', 'lo quiero']) assert.notStrictEqual((await texto(t)).pausar, true, t);
});

test('en WhatsApp avisa al dueno; en Instagram no (el ve los DMs en la app)', async () => {
  const eventos = [];
  alAvisar(async (e) => { eventos.push(e); });
  await texto('mi pedido', { de: '5216620000042' });
  await texto('mi pedido', { de: '900000000000042', canal: 'instagram' });
  await new Promise((r) => setImmediate(r));
  assert.deepStrictEqual(eventos, [{ tipo: 'persona', producto: 'Consulta de pedido', cliente: '5216620000042' }]);
  alAvisar(async () => {});
});
