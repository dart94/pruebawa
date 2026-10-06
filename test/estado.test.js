const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { crearAlmacen, claveCliente, recordarProducto, productoReciente } = require('../estado');
const { crearPausa } = require('../pausa');

let sqliteDisponible = true;
try { require('better-sqlite3'); } catch { sqliteDisponible = false; }
const conSqlite = { skip: sqliteDisponible ? false : 'better-sqlite3 no esta instalado' };

const reloj = (t = 1000000) => ({ ahora: () => t, avanzar: (ms) => { t += ms; } });
const carpetaTemporal = () => fs.mkdtempSync(path.join(os.tmpdir(), 'toyloco-estado-'));

for (const [nombre, abrir] of [
  ['memoria', (r) => crearAlmacen({ ahora: r.ahora })],
  ['sqlite', (r, dir) => crearAlmacen({ ruta: path.join(dir, 'e.db'), ahora: r.ahora })]
]) {
  test(`almacen ${nombre}: guarda, lee, borra y respeta el vencimiento`, nombre === 'sqlite' ? conSqlite : {}, () => {
    const r = reloj();
    const dir = carpetaTemporal();
    const a = abrir(r, dir);
    assert.strictEqual(a.tipo, nombre);
    assert.strictEqual(a.obtener('x'), undefined);
    a.guardar('x', { id: 'P1', n: [1, 2] }, 1000);
    assert.deepStrictEqual(a.obtener('x'), { id: 'P1', n: [1, 2] });
    r.avanzar(999);
    assert.deepStrictEqual(a.obtener('x'), { id: 'P1', n: [1, 2] });
    r.avanzar(2);
    assert.strictEqual(a.obtener('x'), undefined);
    a.guardar('y', true, 1000);
    a.borrar('y');
    assert.strictEqual(a.obtener('y'), undefined);
    a.guardar('z', 1, 1000);
    a.guardar('z', 2, 1000);   // reemplaza
    assert.strictEqual(a.obtener('z'), 2);
    a.cerrar();
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

test('sqlite: lo guardado sobrevive a un reinicio (se vuelve a abrir el archivo)', conSqlite, () => {
  const r = reloj();
  const dir = carpetaTemporal();
  const ruta = path.join(dir, 'datos', 'estado.db');   // la carpeta se crea sola
  const a = crearAlmacen({ ruta, ahora: r.ahora });
  a.guardar('prod:instagram:1', { id: 'F01' }, 60000);
  a.cerrar();
  const b = crearAlmacen({ ruta, ahora: r.ahora });
  assert.deepStrictEqual(b.obtener('prod:instagram:1'), { id: 'F01' });
  r.avanzar(61000);
  assert.strictEqual(b.obtener('prod:instagram:1'), undefined);
  b.cerrar();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('si el archivo SQLite no se puede abrir, sigue en memoria sin lanzar error', () => {
  const dir = carpetaTemporal();
  const archivoComoCarpeta = path.join(dir, 'bloqueo');
  fs.writeFileSync(archivoComoCarpeta, 'x');   // un archivo donde deberia haber carpeta: abrir falla
  const a = crearAlmacen({ ruta: path.join(archivoComoCarpeta, 'e.db') });
  assert.strictEqual(a.tipo, 'memoria');
  a.guardar('k', 1, 1000);
  assert.strictEqual(a.obtener('k'), 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('un fallo del disco en pleno uso no tumba al bot: se sigue sin recordar', conSqlite, () => {
  const dir = carpetaTemporal();
  const a = crearAlmacen({ ruta: path.join(dir, 'e.db') });
  a.cerrar();   // la base queda cerrada: cada operacion lanzaria error
  assert.doesNotThrow(() => a.guardar('k', 1, 1000));
  assert.strictEqual(a.obtener('k'), undefined);
  assert.doesNotThrow(() => a.borrar('k'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('pausas en SQLite sobreviven a un reinicio y se pueden levantar', conSqlite, () => {
  const r = reloj();
  const dir = carpetaTemporal();
  const ruta = path.join(dir, 'e.db');
  const almacen1 = crearAlmacen({ ruta, ahora: r.ahora });
  const pausa1 = crearPausa({ duracionMs: 3600000, ahora: r.ahora, almacen: almacen1 });
  pausa1.pausar('ig:111');
  pausa1.pausar('ig:222');
  almacen1.cerrar();
  const reinicio = crearPausa({ duracionMs: 3600000, ahora: r.ahora, almacen: crearAlmacen({ ruta, ahora: r.ahora }) });
  assert.strictEqual(reinicio.estaPausado('ig:111'), true);
  reinicio.reanudar('ig:111');
  assert.strictEqual(reinicio.estaPausado('ig:111'), false);
  assert.strictEqual(reinicio.estaPausado('ig:222'), true);
  r.avanzar(3601000);
  assert.strictEqual(reinicio.estaPausado('ig:222'), false);
});

test('el ultimo producto se recuerda por cliente y canal, y dura 24 horas', () => {
  const r = reloj();
  const a = crearAlmacen({ ahora: r.ahora });
  const ig = { de: '123', canal: 'instagram' };
  const wa = { de: '123' };   // mismo numero o id en otro canal: no se mezcla
  recordarProducto(ig, { id: 'F01' }, a);
  assert.deepStrictEqual(productoReciente(ig, a), { id: 'F01' });
  assert.strictEqual(productoReciente(wa, a), undefined);
  assert.notStrictEqual(claveCliente(ig), claveCliente(wa));
  r.avanzar(23 * 3600000);
  assert.deepStrictEqual(productoReciente(ig, a), { id: 'F01' });
  r.avanzar(2 * 3600000);
  assert.strictEqual(productoReciente(ig, a), undefined);
  recordarProducto({}, { id: 'X' }, a);   // sin id de cliente no se guarda nada
  assert.strictEqual(productoReciente({}, a), undefined);
});
