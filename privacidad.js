// Pagina publica de aviso de privacidad (la pide Meta para publicar la app). Se sirve en GET /privacidad.
// Describe lo que el bot hace realmente; si el bot cambia (por ejemplo, empieza a guardar datos), hay que actualizarla.
// El nombre sale de negocio.json y el contacto de PRIVACIDAD_CONTACTO (texto libre, por ejemplo "mensaje directo a @cuenta").

const ACTUALIZADO = '29 de septiembre de 2026';

function esc(valor) {
  return String(valor == null ? '' : valor).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function paginaPrivacidad({ nombre, contacto }) {
  const n = esc(nombre);
  const c = esc(contacto || 'un mensaje directo en el mismo chat (WhatsApp o Instagram) donde nos escribiste');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aviso de privacidad - ${n}</title>
<style>
  body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 42rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; color: #222; background: #fff; }
  h1 { font-size: 1.6rem; } h2 { font-size: 1.15rem; margin-top: 2rem; }
  @media (prefers-color-scheme: dark) { body { color: #ddd; background: #161616; } }
</style>
</head>
<body>
<h1>Aviso de privacidad de ${n}</h1>
<p>Última actualización: ${ACTUALIZADO}</p>

<p>${n} atiende consultas por WhatsApp e Instagram con un asistente automático que muestra el catálogo de productos y avisa al equipo cuando alguien quiere apartar algo. Este aviso explica qué datos usa ese asistente.</p>

<h2>Qué datos se reciben</h2>
<ul>
  <li>El mensaje que escribes o la opción que tocas en el chat.</li>
  <li>Tu identificador en la plataforma: tu número de teléfono en WhatsApp, o un identificador numérico de tu cuenta en Instagram.</li>
</ul>

<h2>Para qué se usan</h2>
<ul>
  <li>Responderte con información de productos, precios y disponibilidad.</li>
  <li>Avisar al equipo de ${n} cuando pides hablar con alguien o te interesa un producto, para que te atienda personalmente. En WhatsApp, el aviso incluye tu número de teléfono.</li>
</ul>
<p>No usamos tus datos para publicidad ni los vendemos.</p>

<h2>Qué se conserva</h2>
<p>El asistente no guarda un historial de tus conversaciones, no guarda el texto de tus mensajes ni crea un perfil tuyo. Para atenderte mejor recuerda únicamente tu identificador de usuario y el último producto que viste, hasta 24 horas, y durante unas horas si el equipo de ${n} te está atendiendo, para no interrumpirlo. Pasado ese tiempo se borra automáticamente. Los registros técnicos del servidor ocultan casi todo tu identificador y no incluyen el texto de tus mensajes.</p>
<p>Tu conversación sí queda en WhatsApp o Instagram, donde la conservan esas plataformas y el equipo de ${n} que la atiende, según sus propias políticas.</p>

<h2>Con quién se comparte</h2>
<ul>
  <li>Meta (WhatsApp e Instagram), que transporta los mensajes.</li>
  <li>El proveedor donde se aloja el asistente (Railway), que lo ejecuta.</li>
  <li>El equipo de ${n}, cuando pides atención personal.</li>
</ul>

<h2 id="eliminar">Tus derechos y cómo eliminar tus datos</h2>
<p>Puedes pedir acceso, corrección o eliminación de tus datos, u oponerte a su uso, enviando ${c}. Si quieres eliminar tu conversación, también puedes borrarla desde tu propia cuenta de WhatsApp o Instagram.</p>

<h2>Cambios a este aviso</h2>
<p>Si el asistente cambia la forma de tratar tus datos, actualizaremos esta página y la fecha de arriba.</p>
</body>
</html>
`;
}

module.exports = { paginaPrivacidad, esc };
