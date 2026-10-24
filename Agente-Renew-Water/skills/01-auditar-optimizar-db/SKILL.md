---
name: auditar-optimizar-db
description: Analiza las tablas de Supabase de Renew, detecta enredos, campos basura, duplicados e inconsistencias y los optimiza o genera el script SQL correctivo.
---
# Pasos de Ejecución
1. Conéctate a Supabase y consulta `admin_fases` y `admin_campos_formulario` para el pipeline `pip_water`.
2. Detecta campos duplicados en la Estación 1 (como los 3 "Comprobante de Pago", 2 "Aplicación de Crédito" y "Test Campo" `test_probe_field_1788488664246`) y documéntalos.
3. Revisa `proyectos_dinamicos` buscando proyectos de `pip_water` con `fase_id IS NULL` y `fecha_cierre IS NULL`, o registros virtuales basura en `respuestas_dinamicas` (ej. `VIRTUAL_cli_...`).
4. Normaliza en memoria (o propón migración SQL segura) los teléfonos en `usuarios.telefono` a formato E.164 sin símbolos para Evolution API y estandariza `usuarios.rol`.
5. Guarda un reporte detallado en `./proyectos/diagnostico_optimizacion_db.md` y ejecuta las limpiezas seguras no destructivas.
