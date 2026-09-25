# Reglas de negocio (ToyLoco)

Solo lo que está confirmado. Lo demás está en "Pendiente" y no debe inventarse en el bot.

## Catálogo

- **Fuente de verdad:** el libro de inventario de ToyLoco en Google Sheets (pestañas de catálogo, ventas y TCG). El dueño lo edita a mano.
- **Lo que ve el bot:** solo una pestaña `BOT`, publicada como CSV, con el formato fijo `id, categoria, producto, tema, linea, precio, cantidad, estado`. El bot nunca lee el libro completo.
- **Datos que NUNCA deben llegar al bot ni a los logs:** costos, márgenes, comisiones, proveedor, notas internas, ventas y nombres de clientes, inversión con socio.
- **Qué se ofrece:** solo productos con estado `Disponible`, cantidad mayor a 0 y precio válido. La hoja ya filtra y el código vuelve a filtrar.
- **Estados:** `Disponible`, `Apartada` (alguien la pidió pero aún no paga; no se ofrece) y `Vendida`.
- **Precios:** son fijos (decisión del dueño). El bot muestra el precio de lista.
- **Categorías actuales:** Figura, TCG (sobres Pokémon por set). Los accesorios tienen precio pero la cantidad está pendiente de contar, así que hoy no se ofrecen.
- **Cantidad:** se calcula como `Stock inicial − ventas registradas` (una fila de venta por pieza). El dueño la mantiene en la hoja.

## Disponibilidad

- Muchas figuras son piezas únicas y también se venden en MercadoLibre y en persona, así que "disponible" siempre es **sujeto a confirmación**. El bot lo dice en la ficha del producto y en el pie de la lista.
- Quien confirma y aparta la pieza es una persona, no el bot.

## Conversación

- El bot **no inventa** horario, dirección, envíos, formas de pago ni tiempos de respuesta. Si el cliente pregunta por horario o ubicación, el bot dice que ese dato todavía no lo tiene y ofrece dejar la pregunta al equipo.
- El bot **no promete que alguien contestará en cierto tiempo**.
- "Me interesa" y "Hablar con alguien" registran la solicitud y avisan al dueño por WhatsApp (plantilla). El dueño atiende escribiéndole al cliente desde su propio WhatsApp.
- Tono: cercano y amigable, máximo 1 o 2 emojis por mensaje.

## Privacidad

- Los logs enmascaran teléfonos (`***4234`) y no guardan el texto de los mensajes salvo `LOG_CONTENIDO=1`.
- El aviso al dueño incluye el número del cliente, porque lo necesita para atenderlo.

## Pendiente de definir (no implementar sin decisión del dueño)

- Horario y ubicación.
- Envíos: si hay entrega local o nacional y su costo (el libro usa un supuesto de envío sin confirmar para calcular costos; no es un dato para el cliente).
- Formas de pago y flujo de compra: hasta dónde llega "vender por el bot" (mostrar, apartar, cobrar).
- Accesorios: cantidad real en stock.
- Cartas sueltas de TCG: sin conteo ni precio.
- Promociones: qué se puede ofrecer y con qué margen mínimo.
- Tiempo real de respuesta de una persona.
