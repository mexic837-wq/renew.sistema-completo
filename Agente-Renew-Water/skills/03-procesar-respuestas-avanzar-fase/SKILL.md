---
name: procesar-respuestas-avanzar-fase
description: Interpreta el texto desordenado o imágenes que envía el encargado por WhatsApp, sube archivos a archivos_renew, actualiza respuestas_dinamicas y avanza el proyecto de fase.
---
# Pasos de Ejecución
0. **Si responde sobre un prospecto (aceptada/rechazada):** *Aceptada* → crea el proyecto en `pip_water` (si ya tiene Aplicación de Crédito en `adjuntos_oficina.app_url`, pasa directo a `fase_35_nol4` Orden de Trabajo y envía las preguntas detalladas de la OT) y pasa el cliente a `En Proceso`. *Rechazada* → pide el motivo y marca `macro_estado = 'Declinado'` + `motivo_declinado`.
1. Identifica qué usuario de la tabla `usuarios` está escribiendo por su número de teléfono de WhatsApp y qué proyectos tiene asignados como encargado en la estación actual (`encargadosDe`).
2. **Si el proyecto está en Estación 2 (Orden de Trabajo, `fase_35_nol4`):**
   - Pre-carga en el borrador los datos existentes del cliente en `clientes_maestro`.
   - Extrae con IA todos los campos del formulario de Orden de Trabajo (Comprador, Equipos, Instalación, Finanzas; soporta *"sin financiamiento"* para dejar montos en 0). Si envía foto del ID, guárdala en base64 en el borrador (`fotoId`).
   - Deja los datos de tarjeta en `"0"` y las firmas en `""`.
   - Pide únicamente los campos que falten. Cuando estén todos, envía un resumen al vendedor pidiendo confirmar con **SI**.
   - Al confirmar con **SI**, invoca `POST https://renewgroup.site/api/generar-orden`, que genera el PDF con `molde_orden_v3.pdf`, lo sube a `archivos_renew`, vincula `orden_trabajo_url` en cliente y proyecto, y dispara el webhook `https://n8n.renewgroup.site/webhook/aplicacion-credito-o-trabajo` hacia el grupo de WhatsApp. Marca `campo_19_0fpc = 'Completado en Formulario Externo'`.
3. **Si el proyecto está en Estaciones 3 a 9 (texto):** Extrae con IA los campos de la fase actual (`Técnico` actualizando también `proyectos_dinamicos.tecnico_id`, `Desplegable` validando contra opciones reales, `Fecha` en `YYYY-MM-DD`, `Texto`). Si falta algún dato obligatorio, pide solo lo que faltó.
4. **Si envía una imagen o documento (Estaciones 3 a 9):** Descarga el media desde Evolution API, súbelo al bucket `archivos_renew` en `project_files/{proyecto_id}/{timestamp}_{nombre_archivo}` y guarda `/api/storage-proxy/archivos_renew/...` en `respuestas_dinamicas.valor`.
5. **Avance de Fase y Notificación Encadenada:** Cuando todos los campos reales de la estación estén completos (y los desplegables de control como `¿Contestó?`, `¿Se firmó el Contrato?` o `Aprobado` sean `"Si"`):
   - Si `AUTO_ADVANCE=true`, actualiza `proyectos_dinamicos.fase_id` a la siguiente estación según `orden` y registra `CAMBIO_FASE` en `actividad`.
   - Confirma al encargado actual y **notifica inmediatamente por WhatsApp a los encargados de la nueva estación** con las preguntas específicas de esa fase (`notificarFase`).
