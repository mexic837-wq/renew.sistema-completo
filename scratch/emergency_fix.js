const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'js', 'api.js');
let c = fs.readFileSync(filePath, 'utf8');

// Restaurar la función updateProyectoFase a un estado limpio y funcional
const correctFunction = `export async function updateProyectoFase(proyectoId, nuevaFaseId, extraContext = {}) {
  const db = getDB();
  const proyecto = (db.Proyectos_Dinamicos || []).find(p => p.id === proyectoId);
  const nuevaFase = (db.Admin_Fases || []).find(f => f.id === nuevaFaseId);

  if (!proyecto) throw new Error("Proyecto no encontrado");

  // Lógica de persistencia de tecnico_id
  if (nuevaFase && (nuevaFase.rol_encargado === 'Tecnico' || nuevaFase.rol_encargado === 'Técnico')) {
     if (proyecto.asignado_a) {
        proyecto.tecnico_id = proyecto.asignado_a;
        console.log('[API] Asociando técnico permanente:', proyecto.tecnico_id);
     }
  }

  const nombre_fase   = nuevaFase?.nombre        ?? 'Desconocida';
  const rol_encargado = nuevaFase?.rol_encargado ?? null;`;

// Buscamos el bloque dañado (que empieza por el export y llega hasta donde empieza el PASO 2)
const badBlockStart = c.indexOf('export async function updateProyectoFase');
const badBlockEnd = c.indexOf('const cliente_id');

if (badBlockStart !== -1 && badBlockEnd !== -1) {
    c = c.substring(0, badBlockStart) + correctFunction + '\n\n  ' + c.substring(badBlockEnd);
}

fs.writeFileSync(filePath, c, 'utf8');
console.log('api.js reparado y optimizado.');
