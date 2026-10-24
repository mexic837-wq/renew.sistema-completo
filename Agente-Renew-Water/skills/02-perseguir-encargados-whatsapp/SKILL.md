---
name: perseguir-encargados-whatsapp
description: Escanea cada 12 horas todos los proyectos activos de pip_water, identifica qué campo falta según la estación actual y envía un WhatsApp directo y amigable al encargado vía Evolution API.
---
# Pasos de Ejecución
0. **Paso 0 – Prospectos:** consulta `clientes_maestro` con `macro_estado = 'Prospecto'` y departamento Water. Por cada uno, pregunta a su `vendedor_asignado_id`: *"¿La Aplicación de Crédito fue aceptada o rechazada?"* (si rechazada, el motivo). Estos prospectos NO tienen proyecto todavía. Implementado en `n8n/codigo-barrido.js`.
1. Haz un JOIN entre `proyectos_dinamicos` (donde `pipeline_id = 'pip_water'` y `fecha_cierre IS NULL`), `clientes_maestro`, `admin_fases`, `respuestas_dinamicas` y `usuarios`.
2. **Estación 2 (Orden de Trabajo, `fase_35_nol4`):** Si `campo_19_0fpc` no está completado, pide al vendedor escribir *"orden [Cliente]"* para iniciar el cuestionario por bloques (Comprador, Equipos, Instalación, Finanzas, Foto ID).
3. **Estaciones 3 a 9:** Identifica los campos pendientes de la estación actual en `admin_campos_formulario` (ignorando campos especiales o de prueba) y construye preguntas específicas según el tipo de campo (`Técnico`, `Desplegable`, `Fecha`, `Archivo`, `Texto`) dirigidas a los encargados reales de la fase (`encargadosDe`).
4. Verifica en memoria estática de n8n (`sd.reg`) que no se haya notificado por ese proyecto/usuario en las últimas 12 horas y envía un mensaje agrupado por encargado vía Evolution API.
