const test = require('node:test');
const assert = require('node:assert');
const { paginaPrivacidad, esc } = require('../privacidad');

test('incluye el nombre del negocio, el contacto y la seccion para eliminar datos', () => {
  const html = paginaPrivacidad({ nombre: 'ToyLoco', contacto: 'mensaje directo a @toylocohmo en Instagram' });
  assert.match(html, /<title>Aviso de privacidad - ToyLoco<\/title>/);
  assert.match(html, /mensaje directo a @toylocohmo en Instagram/);
  assert.match(html, /id="eliminar"/);
  assert.match(html, /lang="es"/);
});

test('sin contacto configurado usa un texto generico', () => {
  const html = paginaPrivacidad({ nombre: 'ToyLoco' });
  assert.match(html, /mismo chat/);
});

test('escapa HTML del nombre y del contacto', () => {
  const html = paginaPrivacidad({ nombre: '<b>X</b>', contacto: '"><script>alert(1)</script>' });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<b>X</b>'));
  assert.strictEqual(esc('a&b'), 'a&amp;b');
});
