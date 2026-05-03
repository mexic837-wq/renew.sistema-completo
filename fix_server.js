const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// Fix 1: /api/db endpoint for proyectos_dinamicos
content = content.replace(
  'const proy = db.Proyectos_Dinamicos.map(({ estado, fase_id, asignado_a, ...rest }) => ({',
  'const proy = db.Proyectos_Dinamicos.map(({ estado, fase_id, asignado_a, direccion, nombre_cliente, telefono_cliente, email_cliente, email, telefono, etapa, fase_orden, total_fases, zip, licencia, id_photo, is_locked, rol_fase, ultima_actividad_label, ultima_actividad, actividad, ...rest }) => ({'
);

// Fix 2: /api/upsert endpoint for proyectos_dinamicos
content = content.replace(
  /ultima_actividad_label, rol_fase, is_locked,\\s*\\.\\.\\.rest/g,
  'ultima_actividad_label, rol_fase, is_locked,\\n                  direccion, nombre_cliente, telefono_cliente, email_cliente, email, telefono, etapa, fase_orden, total_fases, zip, licencia, id_photo,\\n                  ...rest'
);

fs.writeFileSync('server.js', content);

