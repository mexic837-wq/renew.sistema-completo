const fs = require('fs');
const path = require('path');

// --- 1. REPARAR FRONTEND (projectDetail.js) ---
const pPath = path.join(__dirname, '..', 'js', 'screens', 'projectDetail.js');
let pc = fs.readFileSync(pPath, 'utf8');

// Corregir ortografía e inyectar campo Customer Name
pc = pc.replace('INFORMACIÓN PRINCIPAL', 'INFORMACIÓN PRINCIPAL');
pc = pc.replace(
  '${field(\'Sales Representative\',\'rec-sales-rep\',\'text\',\'Nombre del vendedor\', vendedorNom)}',
  '${field(\'Customer Name\',\'rec-customer-name\',\'text\',\'Nombre del cliente\', clienteNom)}\n    ${field(\'Sales Representative\',\'rec-sales-rep\',\'text\',\'Nombre del vendedor\', vendedorNom)}'
);

// Asegurar que el guardado use el nuevo campo
pc = pc.replace(
  'customer_name: clienteNom,',
  'customer_name: g("customer-name") || clienteNom,'
);

// Mejorar lógica de técnico en el auto-relleno
pc = pc.replace(
  'const tecnicoAsignado = (db.Usuarios || []).find(u => u.id === deal.tecnico_id || (u.id === deal.asignado_a && (u.rol === "tecnico" || u.rol === "técnico")));',
  'const tecnicoAsignado = (db.Usuarios || []).find(u => (u.rol === "tecnico" || u.rol === "técnico") && (u.id === deal.tecnico_id || u.id === deal.asignado_a));'
);

fs.writeFileSync(pPath, pc, 'utf8');

// --- 2. REPARAR PERSISTENCIA (api.js) ---
const aPath = path.join(__dirname, '..', 'js', 'api.js');
let ac = fs.readFileSync(aPath, 'utf8');

// Modificar updateProyectoFase para guardar tecnico_id si el encargado es un técnico
const updateStart = 'export async function updateProyectoFase(proyectoId, nuevaFaseId, extraContext = {}) {';
const logicUpdate = `export async function updateProyectoFase(proyectoId, nuevaFaseId, extraContext = {}) {
  const db = getDB();
  const proyecto = (db.Proyectos_Dinamicos || []).find(p => p.id === proyectoId);
  const nuevaFase = (db.Admin_Fases || []).find(f => f.id === nuevaFaseId);
  
  // Si la fase nueva es de rol Técnico, guardamos el técnico permanentemente
  if (nuevaFase && (nuevaFase.rol_encargado === 'Tecnico' || nuevaFase.rol_encargado === 'Técnico')) {
     const tecnicoAsignadoId = proyecto.asignado_a; // Quien lo tiene ahora
     if (tecnicoAsignadoId) {
        proyecto.tecnico_id = tecnicoAsignadoId;
        console.log('[API] Asociando técnico permanente:', tecnicoAsignadoId);
     }
  }`;

ac = ac.replace(updateStart, logicUpdate);

fs.writeFileSync(aPath, ac, 'utf8');

console.log('Ficheros actualizados: projectDetail.js y api.js (Persistencia de tecnico_id añadida).');
