/* ============================================================
   RENEW SOLAR – api.js (DYNAMIC DATA-DRIVEN ARCHITECTURE)
   ============================================================ */

const API_BASE = window.location.origin + '/api';
let cachedDB = null;

const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── DB INITIALIZATION ──────────────────────────────────────
export async function initDB() {
  const controller = new AbortController();
  // 45s total client timeout for large databases
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    console.log('[DB] Synchronizing with Cloud Server...');
    
    // Safety: Clear old local data to ensure we never use stale information
    localStorage.removeItem('rs_admin_db');

    const res = await fetch(`${API_BASE}/db`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Servidor de nube no disponible o error en respuesta.');
    
    cachedDB = await res.json();
    console.log('[DB] Cloud Database synchronized successfully.');

    // POST-PROCESSING: Restore 'asignado_a' and 'Round_Robin' from Respuestas_Dinamicas
    if (cachedDB.Respuestas_Dinamicas) {
      // Restore Round_Robin
      const rrResp = cachedDB.Respuestas_Dinamicas.find(r => r.campo_id === '__round_robin_cc__');
      if (rrResp) {
        cachedDB.Round_Robin = { 'Call Center': parseInt(rrResp.valor) || 0 };
      }
      
      // Restore asignado_a for projects
      if (cachedDB.Proyectos_Dinamicos) {
        cachedDB.Proyectos_Dinamicos.forEach(p => {
          const asigResp = cachedDB.Respuestas_Dinamicas.find(r => r.proyecto_id === p.id && r.campo_id === '__asignado_a__');
          if (asigResp) p.asignado_a = asigResp.valor;
        });
      }
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('[DB] Cloud sync failed, starting with empty DB:', error.message);

    // Non-blocking fallback: initialize with empty structure so the app can still open
    cachedDB = {
      Admin_Pipelines: [], Admin_Fases: [], Admin_Campos_Formulario: [],
      Clientes_Maestro: [], Proyectos_Dinamicos: [], Respuestas_Dinamicas: [],
      Usuarios: [], academiaContent: [], inventarioGlobal: [], historialInventario: [],
      anuncios_corporativos: [], Admin_Proveedores: [], calendario_eventos: [],
      Counters: { cli: 0, proy: 0, resp: 0, pip: 0, fase: 0, campo: 0 }
    };

    // Show a non-blocking banner warning instead of a blocking alert
    const banner = document.createElement('div');
    banner.style.cssText = `
      position:fixed; top:0; left:0; right:0; z-index:9999999;
      background: linear-gradient(90deg,#f59e0b,#d97706);
      color:#000; font-weight:700; font-size:12px;
      padding:10px 20px; text-align:center;
      display:flex; align-items:center; justify-content:center; gap:12px;
    `;
    const isTimeout = error.name === 'AbortError';
    banner.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>${isTimeout ? '⏱ Tiempo de espera agotado' : '⚠ Sin conexión a la nube'}: Los datos se cargarán vacíos. Verifica la conexión con Supabase.</span>
      <button onclick="this.parentElement.remove()" style="background:rgba(0,0,0,0.2);border:none;color:#000;padding:4px 10px;border-radius:6px;cursor:pointer;font-weight:800">✕</button>
    `;
    document.body.appendChild(banner);
    // Don't throw — let the app continue loading with empty data
  }
}

// Auto-init on load (but admin-app.js will also await it)
// initDB(); // Let's wait for the app to call it for better control

export async function saveDB(db) {
  // CRITICAL: Safety check. Never save if the database looks empty or failed to load.
  if (!db || (!db.Admin_Pipelines?.length && !db.Clientes_Maestro?.length && !db.Usuarios?.length)) {
    console.warn('[DB] Blocked saveDB: database looks empty or uninitialized. Preventing accidental overwrite.');
    return;
  }

  cachedDB = db;
  try {
    const res = await fetch(`${API_BASE}/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(db)
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Error al persistir en servidor:', errorData);
        throw new Error('Error BD: ' + JSON.stringify(errorData.details || errorData));
    }
  } catch (e) {
    console.error('Servidor offline o error al persistir', e);
    throw e;
  }
}

// ── FAST GRANULAR SAVE HELPER ──
export async function saveGranular(table, records) {
  try {
    const res = await fetch(`${API_BASE}/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, records })
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error(`[Granular Save Error] ${table}:`, errorData);
        throw new Error(errorData.error || `Error al guardar en ${table}`);
    }
  } catch (e) {
    console.error(`[Network Error] Granular save on ${table}:`, e);
    throw e;
  }
}

export async function deleteRecord(table, id, column) {
  try {
    const res = await fetch(`${API_BASE}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, id, column })
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error(`Error al eliminar en servidor (Tabla: ${table}, ID: ${id})`, errorData);
        throw new Error(errorData.error || `Error al eliminar en servidor (Tabla: ${table}, ID: ${id})`);
    } else {
        console.log(`Eliminado exitosamente de ${table}: ${id}`);
    }
  } catch (e) {
    console.error('Error de red al intentar eliminar', e);
    throw e;
  }
}

export function getDB() { 
    if (!cachedDB) {
        try {
            const raw = localStorage.getItem('rs_admin_db');
            cachedDB = raw ? JSON.parse(raw) : {};
        } catch(e) {
            console.error("Error parsing DB from localStorage:", e);
            cachedDB = {};
        }
    }
    
    // Safety: Ensure all required tables exist as arrays
    const requiredTables = [
        'Admin_Pipelines', 'Admin_Fases', 'Admin_Campos_Formulario',
        'Clientes_Maestro', 'Proyectos_Dinamicos', 'Respuestas_Dinamicas',
        'Usuarios', 'academiaContent', 'inventarioGlobal', 'historialInventario',
        'anuncios_corporativos', 'Deleted_Workers', 'calendario_eventos'
    ];
    
    requiredTables.forEach(table => {
        if (!cachedDB[table] || !Array.isArray(cachedDB[table])) {
            cachedDB[table] = [];
        }
    });

    if (!cachedDB.Counters) {
        cachedDB.Counters = { cli: 0, proy: 0, resp: 0, pip: 0, fase: 0, campo: 0 };
    }

    return cachedDB; 
}

function genId(type, db) { 
    if (!db.Counters) db.Counters = { cli: 0, proy: 0, resp: 0, pip: 0, fase: 0, campo: 0 };
    db.Counters[type] = (db.Counters[type] || 0) + 1; 
    const hash = Math.random().toString(36).substring(2, 6);
    return type + '_' + db.Counters[type] + '_' + hash; 
}

// ─── FILE UPLOAD HELPER ─────────────────────────────────────
// Uploads file to the server, which stores it in Supabase Storage buckets
export async function uploadFile(file, type = 'others') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
        const res = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) return data.url;
        throw new Error(data.error || 'Fallo al subir archivo');
    } catch (e) {
        console.error('Upload error:', e);
        throw e;
    }
}

// ─── API EXPORTS ────────────────────────────────────────────

export function getInventario() {
  const db = getDB();
  return db.inventarioGlobal || [];
}

export async function saveInventario(data) {
  const db = getDB();
  db.inventarioGlobal = data;
  await saveDB(db);
}

export async function deleteInventarioItem(id) {
  const db = getDB();
  db.inventarioGlobal = (db.inventarioGlobal || []).filter(i => i.id !== id);
  // Eliminación local + Eliminación en Supabase
  await deleteRecord('inventario_global', id);
  await saveDB(db); 
}

export function getHistorialInventario() {
  const db = getDB();
  return db.historialInventario || [];
}

export async function saveHistorialInventario(data) {
  const db = getDB();
  db.historialInventario = data;
  await saveDB(db);
}

// ── MULTI-DEPARTMENT HELPER ──────────────────────────────────
// Returns an array of department names regardless of old (string) or new (array) format
export function getDeptArray(cli) {
  if (Array.isArray(cli.departamentos_activos) && cli.departamentos_activos.length > 0) {
    return cli.departamentos_activos;
  }
  // Fallback to legacy single-value fields
  const single = cli.departamento || cli.empresa || '';
  return single ? [single] : [];
}

export function syncClientStatuses(db) {
  if (!db.Clientes_Maestro || !db.Proyectos_Dinamicos) return;

  db.Clientes_Maestro.forEach(cli => {
    const projects = db.Proyectos_Dinamicos.filter(p => p.cliente_id === cli.id);
    
    // ── TERMINAL STATE CHECK ──
    // If the client is manually set to "Cancelado", we respect it and don't auto-sync.
    // We check multiple fields to recover state if some fields weren't persisted in the DB.
    const isActuallyCancelled = 
      (cli.macro_estado && cli.macro_estado.toLowerCase() === 'cancelado') || 
      (cli.estado && cli.estado.toLowerCase() === 'cancelado') || 
      (cli.departamento && cli.departamento.toUpperCase() === 'CANCELADO');

    if (isActuallyCancelled) {
       cli.macro_estado = 'Cancelado';
       cli.estado = 'Cancelado';
       cli.departamento = 'CANCELADO';
       return;
    }

    if (projects.length > 0) {
      // Initialize array if missing
      if (!Array.isArray(cli.departamentos_activos)) cli.departamentos_activos = [];

      // Update state based on ALL projects
      let hasActive = false;
      let hasCompleted = false;

      projects.forEach(p => {
        const pipeline = (db.Admin_Pipelines || []).find(pip => pip.id === p.pipeline_id);
        if (!pipeline) return;

        const phases = (db.Admin_Fases || []).filter(f => f.pipeline_id === p.pipeline_id).sort((a,b) => a.orden - b.orden);
        const isLast = (phases.length > 0 && p.fase_id === phases[phases.length - 1].id);
        
        const pipNombre = pipeline.nombre.replace('Renew ', '');

        if (isLast) {
          hasCompleted = true;
          // Don't force add if completed, respect manual removal
        } else {
          hasActive = true;
          // ── Force add ONLY if active ──
          if (!cli.departamentos_activos.includes(pipNombre)) {
             cli.departamentos_activos.push(pipNombre);
          }
        }
      });

      // Update global status
      if (hasActive) {
        cli.estado = 'En Proceso';
        cli.macro_estado = 'En Proceso';
      } else if (hasCompleted) {
        cli.estado = 'Completado';
        cli.macro_estado = 'Cliente';
      }
    } else {
      // No projects -> keep existing macro_estado or set defaults
      if (!cli.macro_estado) {
        cli.macro_estado = (cli.estado === 'Completado') ? 'Cliente' : (cli.estado === 'En Proceso' ? 'En Proceso' : 'Prospecto');
      }
    }
  });
}

// ─── SUPER ADMIN API (SETTINGS) ─────────────────────────────
export async function getAdminPipelines() { return getDB().Admin_Pipelines; }
export async function createAdminPipeline(nombre, color, rolesConAcceso) {
  const db = getDB();
  const id = genId('pip', db);
  const roles = rolesConAcceso && rolesConAcceso.length > 0
    ? rolesConAcceso
    : ['Vendedor', 'Procesador', 'Técnico', 'Diseñador', 'Contabilidad', 'Finanzas', 'Supervisión', 'CEO', 'Admin'];
  const p = { id, nombre, icono: 'circle', color: color || '#8b5cf6', rolesConAcceso: roles };
  db.Admin_Pipelines.push(p);
  await saveDB(db); 
  return p;
}

export async function deleteAdminPipeline(pipelineId) {
  const db = getDB();
  
  const fasesToDelete = db.Admin_Fases.filter(f => f.pipeline_id === pipelineId).map(f => f.id);
  const camposToDelete = db.Admin_Campos_Formulario.filter(c => fasesToDelete.includes(c.fase_id)).map(c => c.id);

  try {
      // 0. Desvincular proyectos del pipeline antes de borrarlo
      const orphanProjects = db.Proyectos_Dinamicos.filter(p => p.pipeline_id === pipelineId);
      if (orphanProjects.length > 0) {
          console.log(`[CASCADE] Desvinculando ${orphanProjects.length} proyectos del pipeline...`);
          orphanProjects.forEach(p => { p.pipeline_id = null; p.fase_id = null; });
          await saveDB(db); // Sube los cambios a Supabase para liberar la restricción
      }

      // 1. Borrar respuestas de los campos que vamos a borrar
      for (const cid of camposToDelete) {
          await deleteRecord('respuestas_dinamicas', cid, 'campo_id');
      }
      // 2. Borrar campos
      for (const cid of camposToDelete) await deleteRecord('admin_campos_formulario', cid);
      // 3. Borrar fases
      for (const fid of fasesToDelete) await deleteRecord('admin_fases', fid);
      // 4. Borrar pipeline
      await deleteRecord('admin_pipelines', pipelineId);
      
      // Borrar local solo si fue un exito remote
      db.Admin_Pipelines = db.Admin_Pipelines.filter(p => p.id !== pipelineId);
      db.Admin_Fases = db.Admin_Fases.filter(f => f.pipeline_id !== pipelineId);
      db.Admin_Campos_Formulario = db.Admin_Campos_Formulario.filter(c => !fasesToDelete.includes(c.fase_id));
      db.Respuestas_Dinamicas = db.Respuestas_Dinamicas.filter(r => !camposToDelete.includes(r.campo_id));
      await saveDB(db);
  } catch(e) { 
      console.error('Error en cascada remota:', e); 
      alert('Error deleting pipeline: ' + e.message);
      throw e;
  }
}

export async function getAdminFases() { return getDB().Admin_Fases; }
export async function createAdminFase(pipeline_id, nombre, orden, rol_encargado = 'Vendedor') {
  const db = getDB();
  const id = genId('fase', db);
  const f = { id, pipeline_id, orden: Number(orden) || 1, nombre, rol_encargado };
  db.Admin_Fases.push(f);
  await saveDB(db); 
  return f;
}

export async function updateAdminFaseRole(faseId, nuevoRol) {
  const db = getDB();
  const fase = db.Admin_Fases.find(f => f.id === faseId);
  if (fase) {
    fase.rol_encargado = nuevoRol;
    await saveDB(db);
  }
}

export async function deleteAdminFase(faseId) {
  const db = getDB();
  
  const camposToDelete = db.Admin_Campos_Formulario.filter(c => c.fase_id === faseId).map(c => c.id);

  try {
      // 0. Desvincular proyectos de esta fase antes de borrarla
      const orphanProjects = db.Proyectos_Dinamicos.filter(p => p.fase_id === faseId);
      if (orphanProjects.length > 0) {
          console.log(`[CASCADE] Desvinculando ${orphanProjects.length} proyectos de la fase...`);
          orphanProjects.forEach(p => p.fase_id = null);
          await saveDB(db); // Sube los cambios a Supabase para liberar la restricción
      }

      // 1. Primero eliminamos todas las respuestas de todos los campos de esta fase
      console.log(`[CASCADE] Iniciando limpieza de respuestas para ${camposToDelete.length} campos...`);
      for (const cid of camposToDelete) {
          await deleteRecord('respuestas_dinamicas', cid, 'campo_id');
      }
      
      // Pequeña pausa de 300ms para asegurar que Supabase procese los borrados
      await new Promise(r => setTimeout(r, 300));
      
      // 2. Ahora eliminamos los campos
      console.log(`[CASCADE] Eliminando campos de la fase...`);
      for (const cid of camposToDelete) {
          await deleteRecord('admin_campos_formulario', cid);
      }
      // 3. Remove actual phase
      await deleteRecord('admin_fases', faseId);
      
      // 4. ONLY if successful we remove it locally
      db.Admin_Fases = db.Admin_Fases.filter(f => f.id !== faseId);
      db.Admin_Campos_Formulario = db.Admin_Campos_Formulario.filter(c => c.fase_id !== faseId);
      db.Respuestas_Dinamicas = db.Respuestas_Dinamicas.filter(r => !camposToDelete.includes(r.campo_id));
      await saveDB(db);
  } catch(e) { 
      console.error('Error borrando fase en remoto:', e); 
      alert('Error from Database: ' + e.message);
      throw e;
  }
}

export async function getAdminCampos() { return getDB().Admin_Campos_Formulario; }
export async function createAdminCampo(fase_id, etiqueta, tipo, opciones) {
  const db = getDB();
  const id = genId('campo', db);
  const c = { id, fase_id, etiqueta, tipo, opciones };
  db.Admin_Campos_Formulario.push(c);
  await saveDB(db); 
  return c;
}

export async function deleteAdminCampo(campoId) {
  const db = getDB();
  try {
      // 1. Borrar respuestas asociadas al campo
      console.log(`[CASCADE] Limpiando respuestas para campo individual: ${campoId}`);
      await deleteRecord('respuestas_dinamicas', campoId, 'campo_id');
      
      // Pausa técnica
      await new Promise(r => setTimeout(r, 200));

      // 2. Borrar el campo
      await deleteRecord('admin_campos_formulario', campoId);
      
      db.Admin_Campos_Formulario = db.Admin_Campos_Formulario.filter(c => c.id !== campoId);
      db.Respuestas_Dinamicas = db.Respuestas_Dinamicas.filter(r => r.campo_id !== campoId);
      await saveDB(db);
  } catch(e) { 
      console.error('Error borrando campo en remoto:', e); 
      alert('Error from Database: ' + e.message);
      throw e;
  }
}

export async function reorderAdminCampos(faseId, newOrderIds) {
  const db = getDB();
  const otherCampos = db.Admin_Campos_Formulario.filter(c => c.fase_id !== faseId);
  const phaseCampos = newOrderIds.map(id => db.Admin_Campos_Formulario.find(c => c.id === id)).filter(Boolean);
  db.Admin_Campos_Formulario = [...otherCampos, ...phaseCampos];
  await saveDB(db);
}

export async function reorderAdminFases(pipelineId, newOrderIds) {
  const db = getDB();
  const otherFases = db.Admin_Fases.filter(f => f.pipeline_id !== pipelineId);
  const phaseFases = newOrderIds.map((id, index) => {
      const f = db.Admin_Fases.find(f => f.id === id);
      if (f) f.orden = index + 1; // Update orden strictly based on array position
      return f;
  }).filter(Boolean);
  
  db.Admin_Fases = [...otherFases, ...phaseFases];
  await saveDB(db);
}

export async function nukeAndResetDB() {
  localStorage.removeItem('rs_admin_db');
  const empty = {
    Admin_Pipelines: [], Admin_Fases: [], Admin_Campos_Formulario: [],
    Clientes_Maestro: [], Proyectos_Dinamicos: [], Respuestas_Dinamicas: [],
    Counters: { cli: 0, proy: 0, resp: 0, pip: 0, fase: 0, campo: 0 },
    Usuarios: [], academiaContent: [], inventarioGlobal: [], historialInventario: []
  };
  await saveDB(empty);
  window.location.reload();
}

// ─── TEAM / WORKERS API ─────────────────────────────────────
export async function getAdminWorkers() {
  const db = getDB();
  const dynamicUsers = db.Usuarios || [];
  const deletedIds = db.Deleted_Workers || [];
  
  let items = [...MOCK_USERS];
  dynamicUsers.forEach(du => {
    const idx = items.findIndex(item => item.id === du.id);
    if (idx > -1) items[idx] = du;
    else items.push(du);
  });
  
  return items.filter(u => !deletedIds.includes(u.id));
}

export async function saveAdminWorker(worker) {
  const db = getDB();
  if (!db.Usuarios) db.Usuarios = [];
  
  const idx = db.Usuarios.findIndex(u => u.id === worker.id);
  if (idx > -1) {
    db.Usuarios[idx] = worker;
  } else {
    if (!worker.id) worker.id = 'u' + Date.now();
    db.Usuarios.push(worker);
  }
  
  await saveDB(db);
  return worker;
}

export async function deleteAdminWorker(ids) {
  const db = getDB();
  const idArray = Array.isArray(ids) ? ids : [ids];
  
  if (!db.Deleted_Workers) db.Deleted_Workers = [];
  if (!db.Usuarios) db.Usuarios = [];

  for (const id of idArray) {
    if (!db.Deleted_Workers.includes(id)) {
      db.Deleted_Workers.push(id);
    }
    db.Usuarios = db.Usuarios.filter(u => u.id !== id);
    // Borrar físicamente en Supabase
    await deleteRecord('usuarios', id);
  }

  await saveDB(db);
}

// ─── AUTHENTICATION ─────────────────────────────────────────
export const MOCK_USERS = [
  { id: 'u1', nombre: 'Carlos', apellido: 'Rodríguez', email: 'carlos@renewsolar.com', password: '1234', initials: 'CR', unidades: ['Renew Solar', 'Renew Water', 'Renew Home'], rol: 'Vendedor', telefono: '+1 (305) 555-1234' },
  { id: 'u3', nombre: 'Demo',   apellido: 'Vendedor',  email: 'demo@renew.com',        password: 'demo', initials: 'DV', unidades: ['Renew Solar', 'Renew Water', 'Renew Home'], rol: 'Admin', telefono: '+1 (555) 123-4567' },
];

export async function loginUser(email, password) {
  // Always fetch fresh data from server to pick up admin changes (e.g., updated 'unidades')
  try {
    const res = await fetch(`${API_BASE}/db`);
    if (res.ok) cachedDB = await res.json();
  } catch(e) { /* use cached if offline */ }
  
  const db = getDB();
  const dynamicUsers = db && db.Usuarios ? db.Usuarios : [];
  // dynamicUsers LAST so they override MOCK_USERS (ensures saved 'unidades' permissions take effect)
  const allUsers = [...MOCK_USERS, ...dynamicUsers];
  const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.email, u])).values());
  const u = uniqueUsers.find(user => user.email === email && (user.password === password || user.pass === password));
  if (!u) throw new Error('Credenciales inválidas');
  return u;
}

// ─── MOBILE SALES APP API ───────────────────────────────────
export async function getPipelineByName(name) {
  const pipes = await getAdminPipelines();
  return pipes.find(p => p.nombre === name) || pipes[0];
}

export async function getFasesByPipeline(pipelineId) {
  return (await getAdminFases()).filter(f => f.pipeline_id === pipelineId).sort((a,b) => a.orden - b.orden);
}

export async function getCamposByFase(faseId) {
  return (await getAdminCampos()).filter(c => c.fase_id === faseId);
}

export async function getDealsByUser(userId, pipelineName) {
  try {
    await delay(600);
    const db = getDB();
    
    let targetPipelineIds = [];
    if (pipelineName) {
      const pipeline = (db.Admin_Pipelines || []).find(p => p.nombre === pipelineName);
      if (!pipeline) {
        console.warn(`[getDealsByUser] Pipeline "${pipelineName}" not found. Returning empty.`);
        return [];
      }
      targetPipelineIds = [pipeline.id];
    } else {
      // All pipelines
      targetPipelineIds = (db.Admin_Pipelines || []).map(p => p.id);
    }
    
    // Build a map of total phases per pipeline for progress calculation
    const totalFasesMap = {};
    targetPipelineIds.forEach(pid => {
      totalFasesMap[pid] = (db.Admin_Fases || []).filter(f => f.pipeline_id === pid).length;
    });

    const dynamicUsers = db.Usuarios || [];
    const allUsers = [...MOCK_USERS, ...dynamicUsers];
    const u = allUsers.find(user => user.id === userId);
    
    const projects = db.Proyectos_Dinamicos || [];
    const myProyectos = projects.filter(p => {
      if (!targetPipelineIds.includes(p.pipeline_id)) return false;
      
      // Admin sees everything
      if (u && (u.rol === 'Admin' || u.rol === 'Administrador' || u.rol === 'CEO')) return true; 
      
      // Creator ALWAYS sees their project
      if (p.responsable_id === userId) return true;

      // Workers assigned to the current phase see it
      const fase = (db.Admin_Fases || []).find(f => f.id === p.fase_id);
      if (u && fase && fase.rol_encargado && u.rol && fase.rol_encargado.toLowerCase() === u.rol.toLowerCase()) {
        if (p.asignado_a) {
          if (p.asignado_a === u.id) return true;
        } else {
          return true;
        }
      }
      return false;
    });

    return myProyectos.map(p => {
      const cli = (db.Clientes_Maestro || []).find(c => c.id === p.cliente_id) || {};
      const fase = (db.Admin_Fases || []).find(f => f.id === p.fase_id) || {};
      const faseOrden = fase.orden || 0;
      
      // Logic for locking: Locked if it's not your turn AND you're not an Admin
      const isAdmin = u && (u.rol === 'Admin' || u.rol === 'Administrador' || u.rol === 'CEO');
      const isMyTurn = u && fase && fase.rol_encargado === u.rol;
      const isLocked = !isAdmin && !isMyTurn;

      return {
        id: p.id,
        nombre_cliente: cli.nombre || 'Sin nombre',
        telefono: cli.telefono || '-',
        direccion: cli.direccion || '-',
        licencia: cli.licencia || '-',
        etapa: (p.fase_id === 'Completado' || p.estado === 'Completado' || cli.estado === 'Completado') ? 'Completado' : (fase.nombre || 'Desconocida'),
        fase_id: p.fase_id,
        fase_orden: faseOrden,
        total_fases: totalFasesMap[p.pipeline_id] || 0,
        fecha: p.fecha,
        responsable_id: p.responsable_id,
        is_locked: isLocked,
        rol_fase: fase.rol_encargado || 'Vendedor'
      };
    }).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  } catch (err) {
    console.error("[getDealsByUser] Crash avoided:", err);
    return [];
  }
}

export async function getClientesMaestro() {
  const db = getDB();
  syncClientStatuses(db);
  return db.Clientes_Maestro;
}

export async function updateClientMaestro(id, data) {
  const db = getDB();
  const index = db.Clientes_Maestro.findIndex(c => c.id === id);
  if (index === -1) throw new Error("Cliente no encontrado en Maestro");
  
  db.Clientes_Maestro[index] = { ...db.Clientes_Maestro[index], ...data };
  await saveGranular('clientes_maestro', [db.Clientes_Maestro[index]]);
  return db.Clientes_Maestro[index];
}

export async function deleteClientesMaestro(ids) {
  const db = getDB();
  const idArray = Array.isArray(ids) ? ids : [ids];
  
  // 1. Identify all projects and their IDs for cascade delete
  const projectsToDelete = (db.Proyectos_Dinamicos || []).filter(p => idArray.includes(p.cliente_id));
  const projectIds = projectsToDelete.map(p => p.id);

  try {
    // 2. Cascade delete in Supabase (Order matters for FK constraints!)
    for (const pId of projectIds) {
      await deleteRecord('respuestas_dinamicas', pId, 'proyecto_id');
      await deleteRecord('proyectos_dinamicos', pId);
    }

    // 3. Delete clients in Supabase
    for (const id of idArray) {
      await deleteRecord('clientes_maestro', id);
    }

    // 4. Update local DB
    db.Clientes_Maestro = db.Clientes_Maestro.filter(c => !idArray.includes(c.id));
    db.Proyectos_Dinamicos = db.Proyectos_Dinamicos.filter(p => !idArray.includes(p.cliente_id));
    db.Respuestas_Dinamicas = db.Respuestas_Dinamicas.filter(r => !projectIds.includes(r.proyecto_id));

    // 5. Final sync
    await saveDB(db);
  } catch (err) {
    console.error('Error during cascade delete:', err);
    throw err;
  }
}

export async function deleteAdminProject(id) {
    const db = getDB();
    // 1. Borrar respuestas en Supabase
    await deleteRecord('respuestas_dinamicas', id, 'proyecto_id');
    // 2. Borrar proyecto en Supabase
    await deleteRecord('proyectos_dinamicos', id);
    
    // 3. Limpiar local
    db.Proyectos_Dinamicos = db.Proyectos_Dinamicos.filter(p => p.id !== id);
    db.Respuestas_Dinamicas = db.Respuestas_Dinamicas.filter(r => r.proyecto_id !== id);
    
    await saveDB(db);
}

export async function createDynamicDeal({ cliente, cliente_id, respuestas, pipelineName, responsable_id }) {
  const db = getDB();
  const pipeline = pipelineName ? db.Admin_Pipelines.find(p => p.nombre.trim().toLowerCase() === pipelineName.trim().toLowerCase()) : null;
  const fases = pipeline ? db.Admin_Fases.filter(f => f.pipeline_id === pipeline.id).sort((a,b) => a.orden - b.orden) : [];
  const firstFaseId = fases[0] ? fases[0].id : null;

  let finalClienteId = cliente_id;
  if (!finalClienteId && cliente) {
    const newCliente = { id: genId('cli', db), ...cliente };
    db.Clientes_Maestro.push(newCliente);
    finalClienteId = newCliente.id;
  }

  let newProyecto = null;
  let newProyId = null;

  if (pipeline) {
    newProyId = genId('proy', db);
    newProyecto = {
      id: newProyId,
      cliente_id: finalClienteId,
      pipeline_id: pipeline.id,
      fase_id: firstFaseId,
      responsable_id: responsable_id,
      fecha: new Date().toISOString().split('T')[0]
    };
    db.Proyectos_Dinamicos.push(newProyecto);
    const cliObj = db.Clientes_Maestro.find(c => c.id === finalClienteId);
    if (cliObj) cliObj.estado = 'En Proceso';
  } else {
    const cliObj = db.Clientes_Maestro.find(c => c.id === finalClienteId);
    if (cliObj) cliObj.estado = 'Lead';
  }

  if (newProyId) {
    Object.keys(respuestas).forEach(campoId => {
      db.Respuestas_Dinamicas.push({
        id: genId('resp', db),
        proyecto_id: newProyId,
        campo_id: campoId,
        valor: respuestas[campoId]
      });
    });
  }

  syncClientStatuses(db);

  // GRANULAR SAVE: Save only what changed to prevent 3-minute full DB sync
  const recordsToSave = [];
  
  // 1. Save Client
  const cliObj = db.Clientes_Maestro.find(c => c.id === finalClienteId);
  if (cliObj) {
    await saveGranular('clientes_maestro', [cliObj]);
  }
  
  // 2. Save Project
  if (newProyecto) {
    await saveGranular('proyectos_dinamicos', [newProyecto]);
  }
  
  // 3. Save Answers
  if (newProyId && Object.keys(respuestas).length > 0) {
    const newAnswers = db.Respuestas_Dinamicas.filter(r => r.proyecto_id === newProyId);
    if (newAnswers.length > 0) {
      await saveGranular('respuestas_dinamicas', newAnswers);
    }
  }

  return newProyecto || { cliente_id: finalClienteId };
}

export async function getDealById(dealId) {
  const db = getDB();
  const p = db.Proyectos_Dinamicos.find(d => d.id === dealId);
  if(!p) throw new Error("Not found");
  const cli = db.Clientes_Maestro.find(c => c.id === p.cliente_id) || {};
  const fase = db.Admin_Fases.find(f => f.id === p.fase_id) || {};
  const user = JSON.parse(localStorage.getItem('rs_user') || '{}');
  const isAdmin = ['admin', 'administrador', 'ceo'].includes((user.rol || '').toLowerCase());
  const isMyTurn = fase && fase.rol_encargado === user.rol;
  const isLocked = !isAdmin && !isMyTurn;

  return { 
    id: p.id, 
    nombre_cliente: cli.nombre, 
    telefono: cli.telefono, 
    direccion: cli.direccion, 
    email: cli.email, 
    zip: cli.zip, 
    licencia: cli.licencia || '-',
    id_photo: cli.id_photo || cli.foto_id || null,
    etapa: fase.nombre, 
    fase_id: p.fase_id, 
    pipeline_id: p.pipeline_id,
    fecha: p.fecha,
    responsable_id: p.responsable_id,
    is_locked: isLocked,
    rol_fase: fase.rol_encargado
  };
}

export async function getRespuestasByProyecto(proyectoId) {
  const db = getDB();
  return (db.Respuestas_Dinamicas || []).filter(r => r.proyecto_id === proyectoId);
}

export async function advanceDealPhase(dealId, respuestas) {
  const db = getDB();
  const p = db.Proyectos_Dinamicos.find(d => d.id === dealId);
  if(!p) throw new Error("Proyecto no encontrado");

  // First, save all dynamic field answers
  Object.keys(respuestas).forEach(campoId => {
    // Solo guardar si hay valor (no borrar previos si el input está vacío pero el usuario no lo tocó)
    const val = respuestas[campoId]; 
    if (val === undefined || val === null) return;

    const exist = db.Respuestas_Dinamicas.find(r => r.proyecto_id === dealId && r.campo_id === campoId);
    let updatedResp = null;
    if(exist) {
       exist.valor = val;
       updatedResp = exist;
    } else {
       updatedResp = {
         id: genId('resp', db),
         proyecto_id: dealId,
         campo_id: campoId,
         valor: val
       };
       db.Respuestas_Dinamicas.push(updatedResp);
    }
    // Save each dynamically immediately or collect them (we will collect below)
  });

  const misRespuestas = (db.Respuestas_Dinamicas || []).filter(r => r.proyecto_id === dealId);
  if (misRespuestas.length > 0) {
    await saveGranular('respuestas_dinamicas', misRespuestas);
  }

  // Calculate destination phase
  const fases = db.Admin_Fases.filter(f => f.pipeline_id === p.pipeline_id).sort((a,b) => a.orden - b.orden);
  const curFidx = fases.findIndex(f => f.id === p.fase_id);
  
  if (curFidx === -1) return { nextFase: null, isCompletado: true };

  // ── AUTO-DETECTION LOGIC ──
  // Check if ALL fields for the current phase are filled
  const camposFase = (db.Admin_Campos_Formulario || []).filter(c => c.fase_id === p.fase_id);
  const misRespuestas = (db.Respuestas_Dinamicas || []).filter(r => r.proyecto_id === dealId);
  
  const allFilled = camposFase.every(c => {
    const r = misRespuestas.find(resp => resp.campo_id === c.id);
    return r && r.valor && r.valor !== "No subido" && r.valor !== "No provisto";
  });

  let isCompletado = false;
  let didAdvance = false;

  if (allFilled) {
    if (curFidx < fases.length - 1) {
      const nextFaseId = fases[curFidx + 1].id;
      await updateProyectoFase(dealId, nextFaseId);
      didAdvance = true;
    } else {
      isCompletado = true;
      const cliObj = db.Clientes_Maestro.find(c => c.id === p.cliente_id);
      if (cliObj) {
        cliObj.estado = 'Completado';
        await saveGranular('clientes_maestro', [cliObj]);
      }
      p.estado = 'Completado';
      p.fase_id = 'Completado';
      await saveGranular('proyectos_dinamicos', [p]);
      didAdvance = true;
    }
  } else {
    // Already saved answers above using saveGranular
  }

  return { 
    nextFase: isCompletado ? null : p.fase_id, 
    isCompletado, 
    didAdvance, 
    missingCount: camposFase.length - misRespuestas.filter(r => camposFase.some(c => c.id === r.campo_id) && r.valor && r.valor !== "No subido").length
  };
}


export function syncKanbanActivity({ proyecto_id, evento, campo_etiqueta, archivo_nombre, responsable_id, fase_nombre }) {
  const db = getDB();
  const p = db.Proyectos_Dinamicos.find(x => x.id === proyecto_id);
  if (!p) return;

  if (!p.actividad) p.actividad = [];
  p.actividad.unshift({
    tipo: evento,
    campo: campo_etiqueta || fase_nombre || '',
    archivo: archivo_nombre || null,
    responsable_id: responsable_id || null,
    timestamp: new Date().toISOString(),
    label: evento === 'ARCHIVO_SUBIDO' ? `📎 ${campo_etiqueta}` : `✅ Fase: ${fase_nombre}`
  });

  if (p.actividad.length > 20) p.actividad = p.actividad.slice(0, 20);
  p.ultima_actividad = new Date().toISOString();
  p.ultima_actividad_label = evento === 'ARCHIVO_SUBIDO' ? `📎 ${campo_etiqueta}` : `✅ ${fase_nombre}`;

  saveDB(db); // Note: Fires async
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const STAGE_CONFIG = {};

// ─── WEBHOOK CONFIG ──────────────────────────────────────────────────────────
// URL del webhook de n8n que recibe todos los cambios de fase del Kanban
const N8N_WEBHOOK_URL = 'https://n8n.renewgroup.site/webhook/notificacion-flujo';

// ─── HELPER: Resolver destinatario(s) según el rol de la fase ────────────────
/**
 * Dado un rol_encargado y el vendedor original del proyecto,
 * devuelve la lista de destinatarios que n8n debe notificar.
 *
 * Regla de negocio:
 *  - rol === 'Vendedor'  → notificar SOLO al creador original del proyecto
 *  - cualquier otro rol  → notificar a TODOS los trabajadores activos con ese rol
 *
 * @returns {Array<{ id, nombre, email, telefono }>}
 */
function _resolverDestinatarios(db, rol_encargado, vendedor_original_id) {
  const deletedIds = db.Deleted_Workers || [];
  const allWorkers = [
    ...MOCK_USERS,
    ...(db.Usuarios || []),
  ].filter(u => !deletedIds.includes(u.id));

  // Deduplica por id (los dinámicos tienen prioridad sobre MOCK)
  const workerMap = new Map();
  allWorkers.forEach(u => workerMap.set(u.id, u));
  const workers = Array.from(workerMap.values());

  const toContact = u => ({
    id:       u.id,
    nombre:   `${u.nombre || ''} ${u.apellido || ''}`.trim(),
    email:    u.email    || null,
    telefono: u.telefono || null,
  });

  // Caso especial: rol Vendedor → SOLO el creador original del proyecto
  if (rol_encargado === 'Vendedor') {
    const creador = workers.find(u => u.id === vendedor_original_id);
    return creador ? [toContact(creador)] : [];
  }

  // Caso general: todos los trabajadores activos con ese rol (case-insensitive)
  return workers.filter(u => u.rol && u.rol.toLowerCase() === rol_encargado.toLowerCase()).map(toContact);
}

// ─── DISPARADOR UNIVERSAL DE NOTIFICACIONES ──────────────────────────────────
/**
 * Mueve un proyecto a una nueva fase en el Kanban Y dispara una notificación
 * automática a n8n con la radiografía completa del movimiento, incluyendo
 * el/los destinatario(s) exactos a quienes corresponde actuar en esa fase.
 *
 * El webhook se dispara de forma ASÍNCRONA (fire & forget): si n8n está
 * caído, el update de la base de datos NO se ve afectado.
 *
 * @param {string} proyectoId  - ID del proyecto que se mueve
 * @param {string} nuevaFaseId - ID de la fase destino
 * @returns {Promise<{ success: boolean, proyecto: object }>}
 */
export async function updateProyectoFase(proyectoId, nuevaFaseId) {
  const db = getDB();

  // ── PASO 1: Metadata de la nueva fase ────────────────────────────────────
  const nuevaFase     = (db.Admin_Fases || []).find(f => f.id === nuevaFaseId);
  const nombre_fase   = nuevaFase?.nombre        ?? 'Desconocida';
  const rol_encargado = nuevaFase?.rol_encargado ?? null;

  // ── PASO 2: Datos actuales del proyecto ──────────────────────────────────
  const proyecto = (db.Proyectos_Dinamicos || []).find(p => p.id === proyectoId);
  if (!proyecto) {
    throw new Error(`[updateProyectoFase] Proyecto "${proyectoId}" no encontrado.`);
  }

  const cliente_id           = proyecto.cliente_id    ?? null;
  const vendedor_original_id = proyecto.responsable_id ?? null;

  // Enriquecer con datos del cliente para contexto en n8n
  const cliente      = (db.Clientes_Maestro || []).find(c => c.id === cliente_id) ?? {};
  const cliente_info = {
    nombre:   cliente.nombre   || null,
    telefono: cliente.telefono || null,
    email:    cliente.email    || null,
    direccion: cliente.direccion || null,
    lat:      cliente.lat      || null,
    lng:      cliente.lng      || null,
  };

  // Enriquecer con nombre del pipeline para contexto en n8n
  const pipeline        = (db.Admin_Pipelines || []).find(p => p.id === proyecto.pipeline_id) ?? {};
  const pipeline_nombre = pipeline.nombre || null;

  // ── PASO 3: Resolver quién debe recibir la notificación ──────────────────
  //  · rol "Vendedor" → solo el creador original del proyecto
  //  · cualquier otro → todos los activos con ese rol
  let destinatarios = rol_encargado
    ? _resolverDestinatarios(db, rol_encargado, vendedor_original_id)
    : [];

  // Round Robin para "Call Center"
  if (rol_encargado === 'Call Center' && destinatarios.length > 0) {
    if (!db.Round_Robin) db.Round_Robin = {};
    let lastIndex = db.Round_Robin['Call Center'] || 0;
    
    if (lastIndex >= destinatarios.length) {
      lastIndex = 0;
    }
    
    const selectedOp = destinatarios[lastIndex];
    proyecto.asignado_a = selectedOp.id;
    destinatarios = [selectedOp]; // Notificar solo al asignado
    
    // Actualizar el índice para el próximo
    const nextIndex = (lastIndex + 1) % destinatarios.length;
    db.Round_Robin['Call Center'] = nextIndex;

    // Persist to Respuestas_Dinamicas
    if (!db.Respuestas_Dinamicas) db.Respuestas_Dinamicas = [];
    
    let rrResp = db.Respuestas_Dinamicas.find(r => r.campo_id === '__round_robin_cc__');
    if (rrResp) rrResp.valor = String(nextIndex);
    else db.Respuestas_Dinamicas.push({ id: genId('resp', db), proyecto_id: 'GLOBAL', campo_id: '__round_robin_cc__', valor: String(nextIndex) });

    let asigResp = db.Respuestas_Dinamicas.find(r => r.proyecto_id === proyecto.id && r.campo_id === '__asignado_a__');
    if (asigResp) asigResp.valor = selectedOp.id;
    else db.Respuestas_Dinamicas.push({ id: genId('resp', db), proyecto_id: proyecto.id, campo_id: '__asignado_a__', valor: selectedOp.id });

  } else {
    // Limpiar asignación específica para otros roles o si no hay round robin
    proyecto.asignado_a = null;
    if (db.Respuestas_Dinamicas) {
      db.Respuestas_Dinamicas = db.Respuestas_Dinamicas.filter(r => !(r.proyecto_id === proyecto.id && r.campo_id === '__asignado_a__'));
    }
  }

  // ── PASO 4: Actualizar la base de datos ──────────────────────────────────
  proyecto.fase_id = nuevaFaseId;
  const recordsToUpdate = [proyecto];
  // Si hubo actualización de Round Robin o Asignación, también guardamos las Respuestas_Dinamicas correspondientes
  const rrResp = db.Respuestas_Dinamicas?.find(r => r.campo_id === '__round_robin_cc__');
  const asigResp = db.Respuestas_Dinamicas?.find(r => r.proyecto_id === proyecto.id && r.campo_id === '__asignado_a__');
  const dynamicRecords = [];
  if (rrResp) dynamicRecords.push(rrResp);
  if (asigResp) dynamicRecords.push(asigResp);
  
  await saveGranular('proyectos_dinamicos', recordsToUpdate);
  if (dynamicRecords.length > 0) {
      await saveGranular('respuestas_dinamicas', dynamicRecords);
  }

  // ── PASO 5: Disparar webhook a n8n (fire & forget) ───────────────────────
  (async () => {
    try {
      const payload = {
        // Identificadores del movimiento
        proyecto_id:           proyectoId,
        pipeline_nombre,
        nueva_fase_id:         nuevaFaseId,
        nombre_fase,
        rol_encargado,

        // Creador del proyecto (siempre presente)
        vendedor_original_id,

        // Destinatarios ya resueltos — n8n solo itera y envía
        destinatarios,  // [{ id, nombre, email, telefono }]

        // Contexto del cliente
        cliente_id,
        cliente_info,

        // Auditoría
        timestamp: new Date().toISOString(),
      };

      const res = await fetch(N8N_WEBHOOK_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn(`[Webhook n8n] ⚠️ HTTP ${res.status} — proyecto "${proyectoId}"`);
      } else {
        console.log(`[Webhook n8n] ✅ Fase: "${nombre_fase}" | Rol: ${rol_encargado} | Destinatarios: ${destinatarios.length}`);
      }
    } catch (webhookErr) {
      // n8n caído o sin red → solo log, nunca bloquea el frontend
      console.warn('[Webhook n8n] ⚠️ offline o error de red:', webhookErr.message);
    }
  })();

  // El frontend recibe respuesta de inmediato, sin esperar el webhook
  return { success: true, proyecto };
}
