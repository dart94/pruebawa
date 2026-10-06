// Pausa por cliente en Instagram: cuando el dueno contesta a mano desde la app, el bot se calla un rato con ese cliente.
// Cada mensaje del bot tambien genera un eco en el webhook, asi que hay que distinguir los ecos del bot de los del dueno:
//   - es del bot si su id (mid) coincide con uno que el bot envio, o
//   - si el bot le escribio a ese cliente hace menos de ventanaBotMs (cubre el eco que llega antes de registrar el envio
//     y el caso de que el mid del eco no coincida con el de la respuesta de envio).
// Todo vive en memoria: al reiniciar el servidor las pausas se pierden.

function crearPausa({ duracionMs, ventanaBotMs = 10000, ahora = Date.now, max = 5000 }) {
  const midsBot = new Set();
  const ultimoEnvio = new Map();   // cliente -> momento del ultimo envio del bot
  const pausadoHasta = new Map();  // cliente -> momento en que termina la pausa

  const recortar = (mapa) => { if (mapa.size > max) mapa.delete(mapa.keys().next().value); };

  return {
    activa: duracionMs > 0,

    // Llamar antes de enviar (para cubrir la carrera con el eco) y despues, con el mid de la respuesta si lo hay
    registrarEnvio(cliente, mid) {
      ultimoEnvio.set(String(cliente), ahora());
      recortar(ultimoEnvio);
      if (mid) {
        midsBot.add(mid);
        if (midsBot.size > max) midsBot.delete(midsBot.values().next().value);
      }
    },

    esEcoDelBot(cliente, mid) {
      if (mid && midsBot.has(mid)) return true;
      const t = ultimoEnvio.get(String(cliente));
      return t !== undefined && ahora() - t < ventanaBotMs;
    },

    // El dueno escribio: pausa (o extiende la pausa) con ese cliente
    pausar(cliente) {
      if (!(duracionMs > 0)) return;
      pausadoHasta.set(String(cliente), ahora() + duracionMs);
      recortar(pausadoHasta);
    },

    // El cliente volvio al bot a proposito (toco "Volver al menu"): se levanta la pausa
    reanudar(cliente) {
      pausadoHasta.delete(String(cliente));
    },

    estaPausado(cliente) {
      const hasta = pausadoHasta.get(String(cliente));
      if (hasta === undefined) return false;
      if (ahora() >= hasta) { pausadoHasta.delete(String(cliente)); return false; }
      return true;
    }
  };
}

module.exports = { crearPausa };
