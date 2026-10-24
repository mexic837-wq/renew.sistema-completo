# Receptor de WhatsApp (skill 03)

## Qué hace
Recibe mensajes de texto de vendedores vía webhook de Evolution, extrae con Claude Haiku los datos de la Orden de Trabajo (Estación 2), pide lo que falte y, al completarse, lo registra en Supabase.

## Variables (.env)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`,
`ANTHROPIC_API_KEY`, `WEBHOOK_TOKEN` (secreto largo), `ANTHROPIC_MODEL` (opcional), `AUTO_ADVANCE=true|false` (default false).

## Despliegue en el VPS
```
npm install
node scripts/receptor.js        # o con pm2: pm2 start scripts/receptor.js --name agente-water
```
Pon un proxy (Caddy/Nginx) con HTTPS hacia el puerto 3100.

## Configurar Evolution
```
POST {EVOLUTION_API_URL}/webhook/set/RenewGroup   (header apikey)
{"webhook":{"enabled":true,"url":"https://TU_DOMINIO/webhook?token=WEBHOOK_TOKEN","events":["MESSAGES_UPSERT"]}}
```

## Limitaciones actuales
- Imágenes (JPG/PNG/WEBP) y PDF: se suben a `archivos_renew/project_files/{proyecto}/…` y se registran en `respuestas_dinamicas`. Claude elige el cliente y campo según el texto/nombre del archivo; si es ambiguo, pregunta. No analiza el contenido visual de la imagen.
- No genera el PDF de la Orden de Trabajo. Con `AUTO_ADVANCE=false` registra los datos y deja el proyecto en revisión.
- El nombre del campo del modelo (`anthropic/claude-haiku-5.5`) se puede cambiar con `ANTHROPIC_MODEL`.
