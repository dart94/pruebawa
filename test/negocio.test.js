const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { cargar, validar } = require('../negocio');

const RAIZ = path.join(__dirname, '..');
const base = () => JSON.parse(fs.readFileSync(path.join(RAIZ, 'negocio.json'), 'utf8'));

test('negocio.json de ToyLoco es valido', () => {
  assert.deepStrictEqual(validar(base()), []);
});

test('detecta textos faltantes o vacios', () => {
  const c = base();
  delete c.textos.saludo;
  c.textos.persona = '  ';
  const errores = validar(c);
  assert.ok(errores.some((e) => e.startsWith('textos.saludo')));
  assert.ok(errores.some((e) => e.startsWith('textos.persona')));
});

test('detecta variables no permitidas en un texto', () => {
  const c = base();
  c.textos.saludo = 'Hola {cliente}';
  assert.match(validar(c).join('\n'), /textos\.saludo.*\{cliente\}/);
});

test('detecta botones y filas que exceden el limite de WhatsApp', () => {
  const c = base();
  c.botones.buscar = 'Buscar un producto de la tienda';
  c.listas.escribir_titulo = 'Escribir el nombre completo del producto';
  const e = validar(c).join('\n');
  assert.match(e, /botones\.buscar.*maximo de WhatsApp es 20/);
  assert.match(e, /listas\.escribir_titulo.*24/);
});

test('cargar falla con mensaje claro si el archivo no existe o no es JSON', () => {
  assert.throws(() => cargar(path.join(RAIZ, 'no-existe.json')), /No se pudo leer/);
  const tmp = path.join(__dirname, 'fixtures', 'roto.json');
  fs.writeFileSync(tmp, '{ esto no es json');
  try { assert.throws(() => cargar(tmp), /No se pudo leer/); } finally { fs.unlinkSync(tmp); }
});

test('otro negocio funciona solo cambiando el archivo (sin tocar codigo)', () => {
  const script = `
    delete process.env.CATALOGO_URL;
    const { responder } = require('./bot');
    (async () => {
      const menu = await responder({ tipo: 'texto', texto: 'hola' });
      const ficha = await responder({ tipo: 'seleccion', id: 'prod:D04' });
      const persona = await responder({ tipo: 'seleccion', id: 'persona' });
      console.log(JSON.stringify({ menu, ficha, persona }));
    })();`;
  const salida = execFileSync(process.execPath, ['-e', script], {
    cwd: RAIZ,
    env: { ...process.env, NEGOCIO_ARCHIVO: path.join(__dirname, 'fixtures', 'negocio-demo.json'), NODE_ENV: '' }
  }).toString().trim().split('\n').pop();
  const r = JSON.parse(salida);
  assert.strictEqual(r.menu.cuerpo, 'Buenas, bienvenido a Negocio Demo. ¿Qué necesitas?');
  assert.strictEqual(r.menu.opciones[0].titulo, 'Ver catálogo');
  assert.match(r.ficha.cuerpo, /\$100 USD/);
  assert.match(r.ficha.cuerpo, /quedan 12/);
  assert.match(r.ficha.cuerpo, /\*Set Demo Uno \(sobre\)\*/);   // sin quitar_sufijos, el sufijo se conserva
  assert.match(r.persona.cuerpo, /Negocio Demo/);
  assert.doesNotMatch(JSON.stringify(r), /ToyLoco/);
});

test('un negocio con configuracion invalida no arranca', () => {
  const tmp = path.join(__dirname, 'fixtures', 'invalido.json');
  const c = base();
  delete c.textos.saludo;
  fs.writeFileSync(tmp, JSON.stringify(c));
  try {
    assert.throws(() => execFileSync(process.execPath, ['-e', "require('./negocio')"], {
      cwd: RAIZ, env: { ...process.env, NEGOCIO_ARCHIVO: tmp }, stdio: 'pipe'
    }), (e) => /Configuracion del negocio invalida/.test(String(e.stderr)));
  } finally { fs.unlinkSync(tmp); }
});
