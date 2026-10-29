# ARQUITECTURA DE SUPABASE Y PIPELINE RENEW WATER

## 1. Tablas Principales
- **`proyectos_dinamicos`**:
  - `id` (text, ej: `proy_proy_11_roaw`)
  - `cliente_id` (text, FK a `clientes_maestro.id`, ej: `cli_cli_11_y4pk`)
  - `pipeline_id` (text -> Filtrar siempre por `'pip_water'`)
  - `fase_id` (text, FK a `admin_fases.id`, ej: `'fase_33_z8j9'`)
  - `responsable_id` (text, FK a `usuarios.id` -> Es el Vendedor / Encargado del Proyecto)
  - `tecnico_id` (text, FK a `usuarios.id` -> Técnico asignado)
  - `estado` (text), `ultima_actividad` (text), `fecha` (date), `fecha_cierre` (timestamptz)
  - `actividad` (jsonb -> Array de eventos ej: `[{"tipo":"FORMULARIO_COMPLETADO", ...}]`)
  - `discusion` (jsonb), `tiene_problema` (bool)

- **`respuestas_dinamicas`**:
  - `id` (text, ej: `resp_resp_1831_...`)
  - `proyecto_id` (text, FK a `proyectos_dinamicos.id`)
  - `campo_id` (text, FK a `admin_campos_formulario.id`)
  - `valor` (text -> NOTA: Cuando está vacío suele tener el texto `'EMPTY'` o `NULL`. Cuando es archivo tiene ruta `/api/storage-proxy/archivos_renew/...`)

- **`usuarios`**:
  - `id` (text), `nombre` (text), `apellido` (text), `email` (text)
  - `telefono` (text -> Limpiar paréntesis, espacios y guiones antes de enviar a Evolution API. Ej: convertir `+1 (954) 310-4521` a `19543104521`).
  - `rol` (text -> OJO: A veces viene como `'Vendedor'` y a veces como `'["Vendedor"]'`).
  - `unidades` (text[] -> Filtrar que incluya `"Renew Water"`).
  - `is_suspended` (bool -> Ignorar usuarios con `TRUE`).

- **`clientes_maestro`**: Contiene nombre, teléfono, dirección y correo del cliente final. **Ciclo de vida:** `macro_estado` = `'Prospecto'` (tras la Aplicación de Crédito, sin proyecto) → `'En Proceso'` (aceptado, "Crear Proyecto") o `'Declinado'` (con `motivo_declinado`). `vendedor_asignado_id` = vendedor dueño del prospecto. La Aplicación de Crédito queda en `adjuntos_oficina.app_url`.

- **`solicitudes_firma`**: enlaces de firma del cliente (`token`, `tipo` orden_trabajo|confirmacion_instalacion, `proyecto_id`, `datos` jsonb, `preview_url`, `estado` pendiente|procesando|firmado, `pdf_url`). La crea el servidor (`POST /api/firmas/solicitud`) y al firmar avisa al agente con el evento `firma.completada`.
- **`inventario_global`** (`id`, `nombre_item`, `ecosistema`, `category`, `locacion` = sede, `stock_actual`) y **`historial_inventario`** (`fecha` es la clave, `item_id`, `cantidad_retirada`, `sede`, `proyecto_id`, `tipo_movimiento` = 'Salida (Proyecto)').

- **Storage Bucket**: Todos los archivos e imágenes recibidos por WhatsApp se suben al bucket `archivos_renew` y se registran en `respuestas_dinamicas.valor` con el prefijo `/api/storage-proxy/archivos_renew/{ruta}`.

## 2. Las 9 Estaciones de `pip_water` y sus Encargados
1. **Estación 1: Aprobación (`fase_33_z8j9`)**
   - **Encargado:** Vendedor (`proyectos_dinamicos.responsable_id`).
   - **Criterio de Avance:** Solo verificar que la Aplicación de Crédito (`cf_appcred_1785343618103` o equivalente) esté en `'Completado en Formulario Externo'`. Ignorar `test_probe_field...` y campos duplicados. Si ya está completada, avanzar automáticamente a Estación 2 o pedir datos de Estación 2 al vendedor.
2. **Estación 2: Orden de Trabajo**
   - **Encargado:** Vendedor (`responsable_id`).
   - **Requisito:** Datos para completar la Orden de Trabajo (`workOrderForm.js` / `generar-orden.js`). Si está vacío (`EMPTY`), escribir al vendedor por WhatsApp pidiendo los detalles de instalación/equipos para generar la Orden de Trabajo.
3. **Estación 3: Asignación de Técnicos**
   - **Encargado:** Encargado del proyecto / Usuarios asignados a esta fase en `admin_fases`.
   - **Requisitos:** `Escoger Técnico` (actualizar `tecnico_id` y respuesta dinámica) y `Fecha de Instalación`.
4. **Estación 4: Certificado de Instalación**
   - **Encargado:** Asignación específica de la fase (`admin_fases`) o `tecnico_id`.
   - **Requisito:** `Foto de Certificado` (Archivo imagen/PDF -> subir a bucket `archivos_renew`).
5. **Estación 5: Llamada de Renew**
   - **Encargado:** Usuarios con rol/unidad `Call Center`.
   - **Requisitos:** `¿Contestó?` (Desplegable: Sí/No) y `Nota` (Texto).
6. **Estación 6: Firma de Contrato**
   - **Encargado:** Usuarios con rol `Administración` / `Admin`.
   - **Requisito:** `¿Se firmó el Contrato?` (Desplegable: Sí/No). Si requiere generar el PDF de contrato de agua, invocar `generar-pdf.js` con `molde_contrato.pdf`.
7. **Estación 7: Llamada de Financiera**
   - **Encargado:** Asignación específica de la fase.
   - **Requisito:** `Aprobado` (Desplegable).
8. **Estación 8: Fotos de Instalación**
   - **Encargado:** Vendedor (`responsable_id`) o Técnico.
   - **Requisito:** `Fotos de la Instalación` (Archivo -> subir a bucket `archivos_renew`).
9. **Estación 9: Comisión**
   - **Encargado:** Asignación específica (Administración/Finanzas).
   - **Requisitos:** `Recibo de Instalación Técnico` (Archivo) y `Recibo de Comisión Vendedor` (Archivo).
