const test = require('node:test');
const assert = require('node:assert');
const { avisarDueno, payloadAviso, limpio, reiniciarParaPruebas } = require('../notificar');

const CFG = { dueno: '5216621234567', plantilla: 'aviso_cliente', idioma: 'es_MX' };

test('arma la plantilla con las 3 variables en orden', () => {
  const p = payloadAviso({ tipo: 'interes', producto: 'Storm Esmeralda', cliente: '5216629990000' }, CFG);
  assert.strictEqual(p.type, 'template');
  assert.strictEqual(p.to, CFG.dueno);
  assert.strictEqual(p.template.name, 'aviso_cliente');
  assert.strictEqual(p.template.language.code, 'es_MX');
  assert.deepStrictEqual(p.template.components[0].parameters.map((x) => x.text),
    ['Me interesa', 'Storm Esmeralda', '+5216629990000']);
});

test('sin producto usa guion; sin numero de cliente no revienta', () => {
  const p = payloadAviso({ tipo: 'persona', cliente: undefined }, CFG);
  assert.deepStrictEqual(p.template.components[0].parameters.map((x) => x.text), ['Hablar con alguien', '-', '-']);
});

test('limpia saltos de linea, espacios multiples y limita longitud', () => {
  assert.strictEqual(limpio('a\nb\t c    d', 50), 'a b c d');
  assert.strictEqual(limpio('x'.repeat(300), 100).length, 100);
});

test('sin DUENO_WHATSAPP no envia nada ni lanza error', async () => {
  reiniciarParaPruebas();
  delete process.env.DUENO_WHATSAPP;
  let llamadas = 0;
  const ok = await avisarDueno({ tipo: 'persona', cliente: '1' }, async () => { llamadas++; return true; });
  assert.strictEqual(ok, false);
  assert.strictEqual(llamadas, 0);
});

test('con configuracion envia una vez y no repite el mismo aviso en 10 minutos', async () => {
  reiniciarParaPruebas();
  process.env.DUENO_WHATSAPP = '+52 1 662 123 4567';
  const enviados = [];
  const enviar = async (p) => { enviados.push(p); return true; };
  await avisarDueno({ tipo: 'interes', producto: 'Gogeta', cliente: '521' }, enviar);
  await avisarDueno({ tipo: 'interes', producto: 'Gogeta', cliente: '521' }, enviar);
  await avisarDueno({ tipo: 'interes', producto: 'Hisoka', cliente: '521' }, enviar);
  assert.strictEqual(enviados.length, 2);
  assert.strictEqual(enviados[0].to, '5216621234567');
  delete process.env.DUENO_WHATSAPP;
});

test('un fallo del envio no lanza error', async () => {
  reiniciarParaPruebas();
  process.env.DUENO_WHATSAPP = '5216621234567';
  const ok = await avisarDueno({ tipo: 'persona', cliente: '9' }, async () => { throw new Error('red caida'); });
  assert.strictEqual(ok, false);
  delete process.env.DUENO_WHATSAPP;
});
