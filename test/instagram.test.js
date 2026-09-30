const test = require('node:test');
const assert = require('node:assert');
const { texto, botones, lista } = require('../mensajes');
const { mensajeIG, mensajeIGPlano, eventosDeWebhook } = require('../instagram');

const webhook = (messaging) => ({ object: 'instagram', entry: [{ id: '1784', time: 0, messaging }] });

test('texto se envia como texto', () => {
  assert.deepStrictEqual(mensajeIG(texto('Hola')), { text: 'Hola' });
});

test('botones salen como respuestas rapidas con su id como payload', () => {
  const m = mensajeIG(botones('Que hacemos?', [{ id: 'buscar', titulo: 'Ver productos' }, { id: 'persona', titulo: 'Hablar con alguien' }], 'Pie'));
  assert.strictEqual(m.text, 'Que hacemos?\n\nPie');
  assert.deepStrictEqual(m.quick_replies, [
    { content_type: 'text', title: 'Ver productos', payload: 'buscar' },
    { content_type: 'text', title: 'Hablar con alguien', payload: 'persona' }
  ]);
});

test('lista: el texto lleva titulo completo y descripcion; los botones, el titulo corto (20)', () => {
  const m = mensajeIG(lista('Encontre 2', 'Ver', [
    { id: 'prod:1', titulo: 'Figura muy larga de Goku Ultra Instinto', descripcion: '$500 MXN' },
    { id: 'prod:2', titulo: 'Gogeta', descripcion: '' }
  ]));
  assert.match(m.text, /1\. Figura muy larga de Goku Ultra Instinto - \$500 MXN/);
  assert.match(m.text, /2\. Gogeta$/);
  assert.strictEqual(m.quick_replies[0].title.length, 20);
  assert.strictEqual(m.quick_replies[0].payload, 'prod:1');
});

test('nunca pasa de 13 respuestas rapidas ni de 1000 caracteres', () => {
  const opciones = Array.from({ length: 20 }, (_, i) => ({ id: 'x' + i, titulo: 'T' + i }));
  const m = mensajeIG({ tipo: 'botones', cuerpo: 'a'.repeat(2000), opciones });
  assert.strictEqual(m.quick_replies.length, 13);
  assert.ok(m.text.length <= 1000);
});

test('version plana no lleva respuestas rapidas', () => {
  const m = mensajeIGPlano(botones('Hola', [{ id: 'a', titulo: 'Uno' }]));
  assert.strictEqual(m.quick_replies, undefined);
  assert.match(m.text, /1\. Uno/);
});

test('webhook: texto libre', () => {
  const ev = eventosDeWebhook(webhook([{ sender: { id: 'C1' }, recipient: { id: 'N1' }, message: { mid: 'm1', text: 'Hola' } }]));
  assert.deepStrictEqual(ev, [{ id: 'm1', de: 'C1', eco: false, entrada: { tipo: 'texto', texto: 'Hola', de: 'C1', canal: 'instagram' } }]);
});

test('webhook: toque en respuesta rapida y postback llegan como seleccion', () => {
  const ev = eventosDeWebhook(webhook([
    { sender: { id: 'C1' }, message: { mid: 'm2', text: 'Ver productos', quick_reply: { payload: 'buscar' } } },
    { sender: { id: 'C1' }, postback: { mid: 'm3', payload: 'interes:7', title: 'Me interesa' } }
  ]));
  assert.strictEqual(ev[0].entrada.tipo, 'seleccion');
  assert.strictEqual(ev[0].entrada.id, 'buscar');
  assert.strictEqual(ev[1].entrada.id, 'interes:7');
  assert.strictEqual(ev[1].id, 'm3');
});

test('webhook: fotos o reels sin texto son tipo otro', () => {
  const ev = eventosDeWebhook(webhook([{ sender: { id: 'C1' }, message: { mid: 'm4', attachments: [{ type: 'share' }] } }]));
  assert.strictEqual(ev[0].entrada.tipo, 'otro');
});

test('webhook: los ecos (enviados desde la cuenta) se marcan y no traen entrada', () => {
  const ev = eventosDeWebhook(webhook([{ sender: { id: 'N1' }, recipient: { id: 'C1' }, message: { mid: 'm5', text: 'Hola!', is_echo: true } }]));
  assert.strictEqual(ev[0].eco, true);
  assert.strictEqual(ev[0].entrada, null);
  assert.strictEqual(ev[0].de, 'C1');   // el cliente es el destinatario
});

test('webhook: objetos que no son de instagram o vacios no dan eventos ni lanzan error', () => {
  assert.deepStrictEqual(eventosDeWebhook({ object: 'whatsapp_business_account', entry: [] }), []);
  assert.deepStrictEqual(eventosDeWebhook(null), []);
  assert.deepStrictEqual(eventosDeWebhook({ object: 'instagram' }), []);
});
