const test = require('node:test');
const assert = require('node:assert');
const { crearPausa } = require('../pausa');

const reloj = (t = 1000000) => ({ ahora: () => t, avanzar: (ms) => { t += ms; } });

test('un eco con el mid de un envio del bot es del bot', () => {
  const r = reloj();
  const p = crearPausa({ duracionMs: 3600000, ahora: r.ahora });
  p.registrarEnvio('c1', 'mid-bot');
  r.avanzar(60000);   // fuera de la ventana: solo el mid lo identifica
  assert.strictEqual(p.esEcoDelBot('c1', 'mid-bot'), true);
});

test('un eco poco despues de un envio del bot es del bot aunque el mid no coincida', () => {
  const r = reloj();
  const p = crearPausa({ duracionMs: 3600000, ahora: r.ahora });
  p.registrarEnvio('c1');
  r.avanzar(2000);
  assert.strictEqual(p.esEcoDelBot('c1', 'otro-mid'), true);
});

test('un eco sin envio reciente del bot es del dueno', () => {
  const r = reloj();
  const p = crearPausa({ duracionMs: 3600000, ahora: r.ahora });
  p.registrarEnvio('c1', 'mid-bot');
  r.avanzar(60000);
  assert.strictEqual(p.esEcoDelBot('c1', 'mid-dueno'), false);
  assert.strictEqual(p.esEcoDelBot('c2', 'mid-dueno'), false);   // otro cliente: el envio a c1 no cuenta
});

test('pausar calla al cliente solo durante la duracion y no afecta a otros', () => {
  const r = reloj();
  const p = crearPausa({ duracionMs: 3600000, ahora: r.ahora });
  assert.strictEqual(p.estaPausado('c1'), false);
  p.pausar('c1');
  assert.strictEqual(p.estaPausado('c1'), true);
  assert.strictEqual(p.estaPausado('c2'), false);
  r.avanzar(3599000);
  assert.strictEqual(p.estaPausado('c1'), true);
  r.avanzar(2000);
  assert.strictEqual(p.estaPausado('c1'), false);
});

test('un nuevo mensaje del dueno extiende la pausa', () => {
  const r = reloj();
  const p = crearPausa({ duracionMs: 3600000, ahora: r.ahora });
  p.pausar('c1');
  r.avanzar(3000000);
  p.pausar('c1');
  r.avanzar(3000000);
  assert.strictEqual(p.estaPausado('c1'), true);
});

test('con duracion 0 la pausa esta desactivada', () => {
  const p = crearPausa({ duracionMs: 0 });
  assert.strictEqual(p.activa, false);
  p.pausar('c1');
  assert.strictEqual(p.estaPausado('c1'), false);
});

test('los ids se comparan como texto', () => {
  const p = crearPausa({ duracionMs: 3600000 });
  p.pausar(123);
  assert.strictEqual(p.estaPausado('123'), true);
});
