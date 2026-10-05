const test = require('node:test');
const assert = require('node:assert');
const { parsearCsv, filasAProductos, ofrecibles, buscar, listar } = require('../catalogo');

const CSV = [
  'ID,CATEGORIA,PRODUCTO,TEMA,LINEA,PRECIO,CANTIDAD,ESTADO',
  'F01,Figura,"Gogeta, Super Saiyan 4",Dragon Ball GT,Solid Edge Works,550,1,Disponible',
  'F02,Figura,Todoroki Shoto,My Hero Academia,Q posket,450,1,Disponible',
  'F03,Figura,Netero,Hunter x Hunter,Vibration Stars,600,1,Vendida',
  'F04,Figura,Sin stock,Naruto Shippuden,Q posket,450,0,Disponible',
  'F05,Figura,Sin precio,Naruto Shippuden,Q posket,,1,Disponible',
  'P01,TCG,Pitch Black (sobre),Pokémon TCG,,"$1,120",6,Disponible',
  'P02,TCG,Storm Esmeralda (sobre),Pokémon TCG,,100,7,Disponible',
  ''
].join('\r\n');

const productos = ofrecibles(filasAProductos(parsearCsv(CSV)));

test('parsea comillas, comas internas y precios con $ y comas', () => {
  const g = productos.find((p) => p.id === 'F01');
  assert.strictEqual(g.producto, 'Gogeta, Super Saiyan 4');
  assert.strictEqual(productos.find((p) => p.id === 'P01').precio, 1120);
});

test('solo se ofrecen productos disponibles, con stock y precio', () => {
  assert.deepStrictEqual(productos.map((p) => p.id), ['F01', 'F02', 'P01', 'P02']);
});

test('formato invalido (HTML en lugar de CSV) lanza error', () => {
  assert.throws(() => filasAProductos(parsearCsv('<html><body>login</body></html>')));
});

test('busca por nombre, ignorando acentos y mayusculas', () => {
  assert.deepStrictEqual(buscar(productos, 'GOGETA').exactos.map((p) => p.id), ['F01']);
  assert.deepStrictEqual(buscar(productos, 'pokemon').exactos.map((p) => p.id), ['P01', 'P02']);
});

test('entiende plurales y frases naturales', () => {
  assert.deepStrictEqual(buscar(productos, 'tienes sobres de pokemon tcg?').exactos.map((p) => p.id), ['P01', 'P02']);
  assert.deepStrictEqual(buscar(productos, 'figuras de dragon ball').exactos.map((p) => p.id), ['F01']);
});

test('sin coincidencia exacta ofrece parecidos por termino especifico, no por genericos', () => {
  const r = buscar(productos, 'figura de goku dragon');
  assert.strictEqual(r.exactos.length, 0);
  assert.deepStrictEqual(r.parecidos.map((p) => p.id), ['F01']);
  assert.deepStrictEqual(buscar(productos, 'figura').parecidos, []);
  assert.strictEqual(buscar(productos, 'figura').exactos.length, 2);
});

test('no devuelve nada para consultas vacias o de puras palabras vacias', () => {
  assert.deepStrictEqual(buscar(productos, 'hola tienes'), { exactos: [], parecidos: [] });
});

test('no ofrece lo vendido ni lo sin stock', () => {
  assert.strictEqual(buscar(productos, 'netero').exactos.length, 0);
});

test('listar limita resultados y no expone campos internos', () => {
  const muchos = Array.from({ length: 9 }, (_, i) => ({ ...productos[0], id: 'X' + i }));
  const texto = listar(muchos);
  assert.match(texto, /Y 3 mas/);
  assert.doesNotMatch(texto, /costo|margen|proveedor/i);
});

test('busca por palabra completa: "ok" ya no coincide con la mitad de "Pokemon"', () => {
  assert.deepStrictEqual(buscar(productos, 'ok'), { exactos: [], parecidos: [] });
  assert.deepStrictEqual(buscar(productos, 'ok gracias'), { exactos: [], parecidos: [] });
  assert.strictEqual(buscar(productos, 'kemon').exactos.length, 0);   // mitad de palabra no cuenta
});

test('nombre incompleto (inicio de palabra, 4+ letras) y errores de dedo de una letra', () => {
  assert.deepStrictEqual(buscar(productos, 'gogeta').exactos.map((p) => p.id), ['F01']);
  assert.deepStrictEqual(buscar(productos, 'gogetta').exactos.map((p) => p.id), ['F01']);   // letra de mas
  assert.deepStrictEqual(buscar(productos, 'todorki').exactos.map((p) => p.id), ['F02']);   // letra de menos
  assert.deepStrictEqual(buscar(productos, 'todoroku').exactos.map((p) => p.id), ['F02']);  // letra cambiada
  assert.deepStrictEqual(buscar(productos, 'pokem').exactos.map((p) => p.id), ['P01', 'P02']);   // inicio de palabra
});

test('los errores de dedo no se aplican a palabras cortas ni a dos letras de diferencia', () => {
  assert.strictEqual(buscar(productos, 'goku').exactos.length, 0);
  assert.strictEqual(buscar(productos, 'todoroki shota rey').exactos.length, 0);
  assert.strictEqual(buscar(productos, 'gtgetta').exactos.length, 0);   // dos letras de diferencia
});

test('verbos de compra y relleno no cuentan como parte del nombre', () => {
  assert.deepStrictEqual(buscar(productos, 'quiero apartar el gogeta').exactos.map((p) => p.id), ['F01']);
  assert.deepStrictEqual(buscar(productos, 'me interesa el todoroki, lo llevo').exactos.map((p) => p.id), ['F02']);
  assert.deepStrictEqual(buscar(productos, 'si lo quiero'), { exactos: [], parecidos: [] });
});
