# CONFIGURACIÓN DE APIs (Evolution API, Supabase y PDFs)

> Los secretos NO se guardan aquí. Se leen de variables de entorno (`.env`).

## Evolution API (WhatsApp)
- Base URL: `${EVOLUTION_API_URL}` (PENDIENTE: completar)
- Instancia: `${EVOLUTION_INSTANCE}` (PENDIENTE: completar)
- Header de autenticación: `apikey: ${EVOLUTION_API_KEY}`
- Enviar texto: `POST /message/sendText/{instance}` con body `{"number": "19543104521", "text": "..."}`
- Descargar media recibido: `POST /chat/getBase64FromMediaMessage/{instance}`
- Número: solo dígitos con código de país (sin `+`, espacios, paréntesis ni guiones).

## Supabase
- URL: `${SUPABASE_URL}` — Key de servicio: `${SUPABASE_SERVICE_ROLE_KEY}` (PENDIENTE)
- Bucket: `archivos_renew`; ruta `project_files/{proyecto_id}/{timestamp}_{nombre_archivo}`
- Valor guardado: `/api/storage-proxy/archivos_renew/{ruta}`

## Generación de PDFs
- Orden de trabajo: `./CONTRATO-RENEW-WATER/api/generar-orden.js`
- Contrato: `./CONTRATO-RENEW-WATER/api/generar-pdf.js` con `molde_contrato.pdf`
