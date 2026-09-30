const test = require('node:test');
const assert = require('node:assert');
const { estadoSalud } = require('../salud');

test('todo bien: ok y sin fallas', async () => {
  assert.deepStrictEqual(await estadoSalud({ catalogo: async () => true, token: async () => true }), { ok: true, fallas: [] });
});

test('reporta que componente falla, sin detalles internos', async () => {
  const s = await estadoSalud({ catalogo: async () => false, token: async () => true });
  assert.deepStrictEqual(s, { ok: false, fallas: ['catalogo'] });
});

test('una comprobacion que lanza error cuenta como falla y no rompe', async () => {
  const s = await estadoSalud({ catalogo: async () => { throw new Error('red caida'); }, token: async () => false });
  assert.deepStrictEqual(s, { ok: false, fallas: ['catalogo', 'token'] });
});

test('catalogo demo: verificarCatalogo es true en desarrollo', async () => {
  delete process.env.CATALOGO_URL;
  delete process.env.NODE_ENV;
  const { verificarCatalogo } = require('../catalogo');
  assert.strictEqual(await verificarCatalogo(), true);
});

test('produccion sin CATALOGO_URL: verificarCatalogo es false (no cae a datos de demo)', () => {
  const { execFileSync } = require('node:child_process');
  const salida = execFileSync(process.execPath, ['-e',
    "require('./catalogo').verificarCatalogo().then((v) => console.log('R=' + v))"], {
    cwd: require('node:path').join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', CATALOGO_URL: '' }
  }).toString();
  assert.match(salida, /R=false/);
});
