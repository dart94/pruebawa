// Estado de salud del servicio para un monitor externo (GET /health).
// Devuelve solo si esta bien o que falla, sin detalles internos.

async function seguro(fn) {
  try { return !!(await fn()); } catch { return false; }
}

// comprobaciones: { catalogo: async () => bool, token: async () => bool }
async function estadoSalud(comprobaciones) {
  const nombres = Object.keys(comprobaciones);
  const resultados = await Promise.all(nombres.map((n) => seguro(comprobaciones[n])));
  const fallas = nombres.filter((_, i) => !resultados[i]);
  return { ok: fallas.length === 0, fallas };
}

module.exports = { estadoSalud };
