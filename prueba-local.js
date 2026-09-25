// Simula un mensaje entrante de Meta contra el webhook local.
// Uso: node prueba-local.js "hola"

const texto  = process.argv[2] || 'hola';
const puerto = process.env.PORT || 3000;

const cuerpo = {
  object: 'whatsapp_business_account',
  entry: [{
    id: '000',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '15550000000', phone_number_id: '000' },
        contacts: [{ profile: { name: 'Cliente de prueba' }, wa_id: '526623254234' }],
        messages: [{
          from: '526623254234',
          id: 'wamid.prueba.' + Date.now(),
          timestamp: '0',
          type: 'text',
          text: { body: texto }
        }]
      }
    }]
  }]
};

async function main() {
  try {
    const res = await fetch(`http://localhost:${puerto}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
    console.log(`Enviado "${texto}" -> respuesta ${res.status} ${await res.text()}`);
    console.log('Revisa la ventana del servidor para ver el log.');
  } catch (e) {
    console.log('Error: ' + e.message + '  (esta corriendo "node server.js"?)');
  }
}

main();
