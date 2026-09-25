# Roadmap

## Hecho

- Diagnóstico y auditoría inicial.
- Endurecimiento de la base (firma, tokens, límites, deduplicación, logs).
- Migración a Railway y prueba real de extremo a extremo.
- Adaptación de textos y flujo a ToyLoco.
- Catálogo desde Google Sheets (pestaña `BOT`), con búsqueda y caché.
- Conversación con botones y listas, tono cercano, respaldo en texto plano.
- Aviso al dueño por plantilla de WhatsApp (código listo, plantilla pendiente de aprobación).
- Pruebas automáticas (`npm test`).
- Configuración por negocio en `negocio.json`, validada al arrancar.
- Documentación en `docs/`.

## En espera (depende de terceros)

| Tarea | Depende de |
|---|---|
| Activar avisos al dueño | Aprobación de la plantilla `aviso_cliente` en Meta y variable `DUENO_WHATSAPP` en Railway |
| Confirmar costo del aviso | Categoría final de la plantilla (hoy Marketing) y tarifas vigentes de Meta |

## Siguiente (sin bloqueos)

1. ~~Probar botones y listas en el WhatsApp real~~ (hecho el 25-sep-2026, se ven bien).
2. ~~Configuración por negocio (`negocio.json`)~~ (hecho: textos, etiquetas, moneda y nombre salen de un archivo validado).
3. Pruebas de robustez: catálogo caído a mitad de conversación, reinicios.
4. Monitoreo mínimo: alerta si el servicio cae o el token falla.
5. Completar información del catálogo: accesorios con cantidad, cartas sueltas de TCG.

## Decisiones de negocio pendientes

- Horario y ubicación (hoy oculto en el bot).
- Envíos y formas de pago.
- Alcance de "vender por el bot": mostrar, apartar o cobrar.
- Tiempo de respuesta que se puede prometer.

## Más adelante

- **Coexistencia** (dueño contestando desde la app de WhatsApp Business): requiere ser Tech Provider o usar un proveedor. Ver `decisions.md` D11.
- **Persistencia** (Postgres): solo si se decide guardar pedidos o historial.
- **Piloto con un segundo negocio** (por ejemplo una carnicería): validar la hipótesis del dueño atendiendo desde su celular. Se define su catálogo con el mismo formato de pestaña `BOT`.
- **Precio y modelo de servicio** para terceros: costos de Meta, de Railway y del número por cliente.

## Regla de avance

No pasar a una fase posterior si hay bloqueos importantes en la anterior. Las decisiones de negocio se toman con el dueño; no se inventan requisitos comerciales.
