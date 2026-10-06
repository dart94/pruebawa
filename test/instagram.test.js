const test = require('node:test');
const assert = require('node:assert');
const { texto, botones, lista } = require('../mensajes');
const { mensajeIG, mensajeIGPlano, eventosDeWebhook, resumenWebhook } = require('../instagram');

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

test('webhook: tambien se leen mensajes que vienen en changes[] con field messages', () => {
  const datos = { object: 'instagram', entry: [{ id: '1784', time: 0, changes: [
    { field: 'messages', value: { sender: { id: 'C1' }, recipient: { id: 'N1' }, timestamp: 0, message: { mid: 'm9', text: 'Hola' } } },
    { field: 'comments', value: { id: 'x' } }
  ] }] };
  const ev = eventosDeWebhook(datos);
  assert.strictEqual(ev.length, 1);
  assert.strictEqual(ev[0].entrada.texto, 'Hola');
});

test('webhook: is_echo y quick_reply tambien se reconocen fuera de message', () => {
  const ev = eventosDeWebhook(webhook([
    { sender: { id: 'N1' }, recipient: { id: 'C1' }, message: { mid: 'e1', text: 'x' }, is_echo: true },
    { sender: { id: 'C1' }, message: { mid: 'q1', text: 'Ver' }, quick_reply: { payload: 'buscar' } }
  ]));
  assert.strictEqual(ev[0].eco, true);
  assert.strictEqual(ev[1].entrada.id, 'buscar');
});

test('resumen del webhook no incluye contenido ni ids de personas', () => {
  const r = resumenWebhook(webhook([{ sender: { id: 'C1' }, message: { mid: 'm1', text: 'secreto' } }]));
  assert.strictEqual(r, 'instagram messaging:1');
  assert.ok(!r.includes('secreto') && !r.includes('C1'));
  assert.strictEqual(resumenWebhook({ object: 'instagram', entry: [{ changes: [{ field: 'comments' }] }] }), 'instagram changes:comments');
  assert.strictEqual(resumenWebhook(null), 'cuerpo no valido');
});

test('webhook: objetos que no son de instagram o vacios no dan eventos ni lanzan error', () => {
  assert.deepStrictEqual(eventosDeWebhook({ object: 'whatsapp_business_account', entry: [] }), []);
  assert.deepStrictEqual(eventosDeWebhook(null), []);
  assert.deepStrictEqual(eventosDeWebhook({ object: 'instagram' }), []);
});

test('webhook: que mando el cliente cuando no es texto, y el registro solo lleva tipos y claves', () => {
  const caso = (message) => eventosDeWebhook(webhook([{ sender: { id: 'C1' }, message: { mid: 'x', ...message } }]))[0];
  assert.strictEqual(caso({ attachments: [{ type: 'image', payload: { url: 'https://secreto/foto' } }] }).entrada.adjunto, 'foto');
  assert.strictEqual(caso({ attachments: [{ type: 'audio' }] }).entrada.adjunto, 'audio');
  assert.strictEqual(caso({ attachments: [{ type: 'share' }] }).entrada.adjunto, 'publicación compartida');
  assert.strictEqual(caso({ attachments: [{ type: 'ig_reel' }] }).entrada.adjunto, 'reel');
  assert.strictEqual(caso({ attachments: [{ type: 'story_mention' }] }).entrada.adjunto, 'historia');
  const raro = caso({ attachments: [{ type: 'algo_nuevo' }] });
  assert.strictEqual(raro.entrada.adjunto, 'mensaje no compatible');
  assert.strictEqual(raro.detalle, 'adjuntos=algo_nuevo claves=mid,attachments');
  assert.doesNotMatch(caso({ attachments: [{ type: 'image', payload: { url: 'https://secreto/foto' } }] }).detalle, /secreto/);
  assert.match(caso({ is_unsupported: true }).detalle, /adjuntos=ninguno/);
});

test('lista en instagram: el texto no manda a tocar un boton de lista que alli no existe', () => {
  const m = mensajeIG(lista('Encontré 2 🙌 Toca «Ver productos» y elige uno.', 'Ver productos', [
    { id: 'prod:1', titulo: 'Gogeta', descripcion: '$550 MXN' },
    { id: 'prod:2', titulo: 'Goku', descripcion: '$450 MXN' }
  ]));
  assert.doesNotMatch(m.text, /Ver productos/);
  assert.match(m.text, /Toca un botón de abajo y elige uno\./);
  assert.match(m.text, /1\. Gogeta - \$550 MXN/);
  assert.deepStrictEqual(m.quick_replies.map((q) => q.title), ['Gogeta', 'Goku']);
});
