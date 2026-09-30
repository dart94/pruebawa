// Simula un mensaje entrante de Meta contra el webhook local.
// Uso: node prueba-local.js "hola"          (mensaje de texto)
//      node prueba-local.js --id buscar     (clic en un boton o fila de lista)
//      agregar --ig al final para simular Instagram en vez de WhatsApp:
//      node prueba-local.js "hola" --ig     |     node prueba-local.js --id buscar --ig

const args   = process.argv.slice(2);
const ig     = args.includes('--ig');
const resto  = args.filter((a) => a !== '--ig');
const porId  = resto[0] === '--id';
const texto  = porId ? resto[1] : (resto[0] || 'hola');
const puerto = process.env.PORT || 3000;

const cuerpoWhatsApp = {
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
          ...(porId
            ? { type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: texto, title: texto } } }
            : { type: 'text', text: { body: texto } })
        }]
      }
    }]
  }]
};

const cuerpoInstagram = {
  object: 'instagram',
  entry: [{
    id: '17841000000000000',
    time: Date.now(),
    messaging: [{
      sender: { id: '900000000000001' },
      recipient: { id: '17841000000000000' },
      timestamp: Date.now(),
      message: {
        mid: 'igmid.prueba.' + Date.now(),
        text: texto,
        ...(porId ? { quick_reply: { payload: texto } } : {})
      }
    }]
  }]
};

async function main() {
  try {
    const res = await fetch(`http://localhost:${puerto}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ig ? cuerpoInstagram : cuerpoWhatsApp)
    });
    console.log(`Enviado "${texto}"${ig ? ' (instagram)' : ''} -> respuesta ${res.status} ${await res.text()}`);
    console.log('Revisa la ventana del servidor para ver el log.');
  } catch (e) {
    console.log('Error: ' + e.message + '  (esta corriendo "node server.js"?)');
  }
}

main();
