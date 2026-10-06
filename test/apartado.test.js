// "Me interesa" no aparta nada: explica como apartar (el dueno cierra a mano) con el anticipo ya calculado.
const test = require('node:test');
const assert = require('node:assert');
const { validar } = require('../negocio');

delete process.env.CATALOGO_URL;
delete process.env.NODE_ENV;   // inventario-demo.json (datos ficticios)
delete process.env.ESTADO_DB;

const { responder } = require('../bot');
const { negocio } = require('../negocio');
const { payload, LIM } = require('../mensajes');

const sel = (id) => responder({ tipo: 'seleccion', id });

test('"Me interesa" explica el apartado con el anticipo del 50% calculado y no promete tiempos de respuesta', async () => {
  const m = await sel('interes:D02');   // $550
  assert.match(m.cuerpo, /Quedó registrado tu interés en \*Figura Heroe Azul\*/);
  assert.match(m.cuerpo, /anticipo del 50% \(\$275 MXN\)/);
  assert.match(m.cuerpo, /14 días/);
  assert.match(m.cuerpo, /transferencia, depósito o Mercado Pago/);
  assert.doesNotMatch(m.cuerpo, /minutos|en cuanto pueda|te responderá|\{|undefined/i);
  assert.deepStrictEqual(m.opciones.map((o) => o.id), ['menu']);
  assert.ok(payload('521', m).interactive.body.text.length <= LIM.cuerpo);
});

test('el anticipo con centavos se muestra con dos decimales', async () => {
  const m = await sel('interes:D03');   // $299 -> 149.50
  assert.match(m.cuerpo, /\(\$149\.50 MXN\)/);
});

test('categorias que no se apartan (cartas sueltas) se explican como pago completo', async () => {
  negocio.sin_apartado = ['tcg'];
  try {
    const m = await sel('interes:D04');   // $100
    assert.match(m.cuerpo, /no se apartan: se pagan completas \(\$100 MXN\)/);
    assert.doesNotMatch(m.cuerpo, /anticipo|14 días/);
    assert.match((await sel('interes:D01')).cuerpo, /anticipo del 50%/);   // otras categorias siguen igual
  } finally {
    negocio.sin_apartado = [];
  }
});

test('el texto del apartado coincide con los datos del negocio (50%, 14 dias) y los de las preguntas frecuentes', async () => {
  const m = await sel('interes:D01');
  const faq = await responder({ tipo: 'texto', texto: 'como se aparta' });
  for (const t of [m.cuerpo, faq.cuerpo]) {
    assert.match(t, /50%/);
    assert.match(t, /14 días/);
  }
});

test('la validacion exige porcentaje valido y lista de categorias', () => {
  const base = () => JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'negocio.json'), 'utf8'));
  assert.deepStrictEqual(validar(base()), []);
  for (const malo of [0, 150, 'mucho']) {
    const c = base();
    c.apartado_porcentaje = malo;
    assert.match(validar(c).join('\n'), /apartado_porcentaje/, String(malo));
  }
  const c = base();
  c.sin_apartado = 'carta';
  assert.match(validar(c).join('\n'), /sin_apartado/);
  const d = base();
  d.textos.interes_sin_apartado = 'Total {inventado}';
  assert.match(validar(d).join('\n'), /interes_sin_apartado.*\{inventado\}/);
});
