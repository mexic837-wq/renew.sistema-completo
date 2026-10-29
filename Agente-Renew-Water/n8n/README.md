# Agente Renew Water en n8n

Workflow: [workflow.json](workflow.json) (generado con `node n8n/build-workflow.js` desde `codigo-agente.js` y `codigo-barrido.js`).

## Arquitectura
```
WhatsApp ─► Evolution API ─(webhook MESSAGES_UPSERT)─► n8n: /webhook/agente-renew-sistema
                                                          └► Code "Agente": usuario → decisión crédito / Orden de Trabajo / archivos
                                                              ├► OpenRouter (extrae datos, clasifica)
                                                              ├► Supabase REST + Storage (archivos_renew)
                                                              └► Evolution sendText (respuesta)
Cada 12 h ─► n8n Schedule ─► Code "Barrido" ─► Evolution sendText (a cada encargado)
```
El estado (mensajes vistos, borradores, registro de 12 h) vive en `$getWorkflowStaticData` y solo persiste con el workflow **activo** (no en ejecuciones de prueba manuales).

## 1. Credenciales (dentro de n8n, sin tocar docker)
Abre el nodo **Config** (Set) del workflow y reemplaza cada `PEGA_AQUI`:
`SUPABASE_SERVICE_ROLE_KEY`, `EVOLUTION_API_KEY`, `OPENROUTER_API_KEY`, `WEBHOOK_TOKEN`.
Los demás (URLs, instancia, modelo, `AUTO_ADVANCE=false`, `BARRIDO_SEND=false`) ya vienen rellenos.
Los valores quedan guardados en el workflow: no exportes ni compartas el JSON después de pegar las claves.
Ya no hace falta `N8N_BLOCK_ENV_ACCESS_IN_NODE` ni variables en docker-compose.

## 2. Importar
n8n → Workflows → Import from file → `workflow.json` → **Activate**.
La URL de producción debe quedar `https://n8n.renewgroup.site/webhook/agente-renew-sistema`.

## 3. Registrar el webhook en Evolution
```
POST https://evolutionapi.renewgroup.site/webhook/set/RenewGroup
apikey: <EVOLUTION_API_KEY>
{"webhook":{"enabled":true,"url":"https://n8n.renewgroup.site/webhook/agente-renew-sistema",
 "headers":{"x-agente-token":"<WEBHOOK_TOKEN>"},"events":["MESSAGES_UPSERT"],"webhookBase64":true}}
```

## 4. Probar
1. Prospecto de prueba con Aplicación de Crédito → responde "aceptada" al WhatsApp del agente.
2. Verifica en Supabase: proyecto nuevo en `pip_water`, cliente `En Proceso`.
3. Barrido: déjalo con `BARRIDO_SEND=false` y ejecútalo manual (Execute node) para ver los mensajes simulados; cuando estén bien, pon `true`.

## 5. Firma virtual del cliente (una sola vez)
1. Ejecuta `supabase_solicitudes_firma.sql` (raíz del repo) en el SQL Editor de Supabase.
2. En el servidor de la app crea `/home/apps/renew-group-system/.env` con:
   ```
   AGENTE_TOKEN=<el mismo valor que WEBHOOK_TOKEN del nodo Config>
   ```
   (opcional `AGENTE_WEBHOOK_URL`, por defecto `https://n8n.renewgroup.site/webhook/agente-renew-sistema`). Luego `deploy.sh`.
3. Reimporta `workflow.json` en n8n y vuelve a pegar las claves del nodo **Config**.

## Flujo Renew Water (por WhatsApp)
1. **Crédito:** "¿fue aceptada?" → crea el proyecto (*En Proceso*) y lo pasa a Orden de Trabajo.
2. **Orden de Trabajo:** "¿la genero?" → toma del sistema nombre, teléfono, email, dirección, ciudad, estado, zip y foto del ID; **solo pide lo que falta**; resumen → *SI* → borrador + enlace de firma al **cliente y al vendedor** (`/firmar.html`).
3. **Cliente firma** → el sistema genera la orden oficial, la guarda y la manda al grupo de aplicaciones; el agente avanza a Asignación de Técnicos.
4. **Técnico:** lista numerada → número + fecha y hora → guarda técnico y fecha, le escribe al técnico con dirección, equipos y lo que debe reportar → avanza a Certificado de Instalación.
5. **Al terminar la instalación** (técnico o vendedor): equipos + serie, costos, **sede de donde retiró** y material usado → resumen → *SI* → **descuenta el inventario** de esa sede (historial ligado al proyecto), avisa a técnico y vendedor y manda la **Confirmación de Instalación** a firmar.
6. **Cliente firma** → el PDF queda como certificado, el cliente pasa a *Cliente*, **la venta cuenta** y el agente sigue con el resto del pipeline (Llamada, Contrato, Financiera, Fotos, Comisión).

Para reenviar un enlace: *reenviar enlace <cliente>*.

## Seguridad: quién puede ver qué
El agente **deniega por defecto**. La autorización la decide el código (`comun.js`, sección SEGURIDAD), nunca la IA: el modelo solo recibe datos ya filtrados.

| Quién escribe | Qué puede ver |
|---|---|
| **Representante** | Solo SUS clientes y proyectos. |
| **Manager de Venta** | Los suyos + los de los representantes a su cargo (`usuarios.equipo_ids`). |
| **Técnico** | Solo los proyectos donde es el técnico asignado. |
| **Admin / CEO** | Información general: cifras y estado de proyectos. **Nunca** teléfonos, direcciones, montos, crédito, ID ni comisiones (eso se ve en la app). |
| **Otros roles** (Call Center, Contabilidad…) | Solo lo que hoy está en la fase que les toca. |
| **Cliente** | Solo el estado de su propio proceso (fase, fecha de instalación, técnico, enlace de sus documentos). Sin precios, pagos ni datos de otros. |
| **Número desconocido** | No se le responde nada. |

Consultas por WhatsApp (solo lectura): *mis clientes*, *cómo va <cliente>*, *mi equipo*, *clientes de <representante>*, *resumen general* (solo Admin/CEO).
Si alguien pregunta por un cliente que no es suyo, la respuesta es idéntica a si no existiera ("No encontré…"): no se revela nada.

Además: avisos y recordatorios solo llegan a quien le corresponde el cliente; límite de 20 mensajes/hora para números externos; las órdenes escritas dentro de un mensaje no cambian las reglas.
Todo queda en la tabla `agente_auditoria` (ejecuta `supabase_agente_auditoria.sql`). Intentos negados de la última semana:
`select fecha, telefono, nivel, accion, detalle from agente_auditoria where permitido = false and fecha > now() - interval '7 days' order by fecha desc;`

## Notas
- **Orden de Trabajo completa (Estación 2):** pre-carga datos de `clientes_maestro`, pide los bloques faltantes (Comprador, Equipos, Instalación, Finanzas y foto de ID opcional), deja tarjeta en `"0"` y firmas en blanco, muestra resumen y al confirmar con **SI** llama a `POST https://renewgroup.site/api/generar-orden` (que sube el PDF a `archivos_renew`, actualiza el proyecto/cliente y dispara el webhook `aplicacion-credito-o-trabajo` al grupo de WhatsApp).
- **Avance fase por fase (Estaciones 3 a 9):** lee los campos reales de `admin_campos_formulario` y los encargados de `admin_fases`. Con `AUTO_ADVANCE=true`, al completarse una estación avanza a la siguiente y envía automáticamente las preguntas de la nueva estación a sus encargados.
- Los teléfonos `+58 0416…` se normalizan quitando el `0` troncal.
