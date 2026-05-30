/* ============================================================
   RENEW SOLAR – api.js (DYNAMIC DATA-DRIVEN ARCHITECTURE)
   ============================================================ */

const API_BASE = window.location.origin + '/api';
let cachedDB = null;

export const delay = ms => new Promise(r => setTimeout(r, ms));
export function getCurrentUser() {
  const raw = localStorage.getItem('rs_user');
  if (!raw) return null;
  const user = JSON.parse(raw);
  
  if (cachedDB && cachedDB.Admin_Roles) {
    const roleDef = cachedDB.Admin_Roles.find(r => (r.nombre || '').toLowerCase() === (user.rol || '').toLowerCase());
    if (roleDef && roleDef.permisos) {
      user.permisos = { ...(user.permisos || {}), ...roleDef.permisos };
    }
  }
  return user;
}
export function logout() {
  localStorage.removeItem('rs_user');
  if (window.appNavigate) window.appNavigate('login');
  else window.location.hash = '#login';
  import('./components/toast.js').then(m => m.showToast('Sesión cerrada correctamente.', 'info'));
}
// ─── POST-PROCESSING HELPER ─────────────────────────────────
function applyPostProcessing(freshDB) {
    if (freshDB.Clientes_Maestro && freshDB.Proyectos_Dinamicos) {
        freshDB.Clientes_Maestro.forEach(cli => {
            if (cli.macro_estado === 'Cliente') {
                const hasProy = freshDB.Proyectos_Dinamicos.some(p => String(p.cliente_id) === String(cli.id));
                if (!hasProy) {
                    const depts = Array.isArray(cli.departamentos_activos) && cli.departamentos_activos.length ? cli.departamentos_activos : (cli.departamento ? [cli.departamento] : []);
                    let pipId = null;
                    if (depts.length > 0) {
                        const deptStr = depts[0].toLowerCase();
                        const pip = (freshDB.Admin_Pipelines || []).find(p => p.nombre.toLowerCase().includes(deptStr.replace('renew ', '').trim()));
                        if (pip) pipId = pip.id;
                    }
                    if (!pipId) {
                        const pip = (freshDB.Admin_Pipelines || []).find(p => p.nombre.toLowerCase().includes('water'));
                        if (pip) pipId = pip.id;
                    }
                    freshDB.Proyectos_Dinamicos.push({
                        id: 'VIRTUAL_' + cli.id,
                        cliente_id: cli.id,
                        pipeline_id: pipId,
                        fase_id: 'Completado',
                        estado: 'Completado',
                        creador_id: cli.creador_id || cli.vendedor_asignado_id,
                        responsable_id: cli.vendedor_asignado_id || cli.creador_id,
                        created_at: cli.created_at || new Date().toISOString(),
                        fecha: cli.created_at || new Date().toISOString(),
                        fecha_cierre: cli.created_at || new Date().toISOString()
                    });
                }
            }
        });
    }

    if (freshDB.Respuestas_Dinamicas) {
        const rrResp = freshDB.Respuestas_Dinamicas.find(r => r.campo_id === '__round_robin_cc__');
        if (rrResp) {
            freshDB.Round_Robin = { 'Call Center': parseInt(rrResp.valor) || 0 };
        }
        if (freshDB.Proyectos_Dinamicos) {
            freshDB.Proyectos_Dinamicos.forEach(p => {
                const asigResp = freshDB.Respuestas_Dinamicas.find(r => r.proyecto_id === p.id && r.campo_id === '__asignado_a__');
                if (asigResp) p.asignado_a = asigResp.valor;
            });
        }
    }

    if (freshDB.Admin_Campos_Formulario) {
        freshDB.Admin_Campos_Formulario.forEach(c => {
            if (c.opciones && c.opciones.includes('|META|')) {
                const parts = c.opciones.split('|META|');
                c.opciones = parts[0];
                try {
                    const meta = JSON.parse(parts[1]);
                    c.es_opcional = meta.es_opcional || false;
                    if (meta.orden !== undefined) c.orden = meta.orden;
                } catch(e){}
            } else {
                if (c.es_opcional === undefined) c.es_opcional = false;
            }
        });
    }

    // ── DATA MIGRATION: Backfill dates and status for consistency ──
    const today = new Date().toISOString().split('T')[0];
    (freshDB.Proyectos_Dinamicos || []).forEach(p => {
        const isFinished = isProjectFinished(p, freshDB);

        if (isFinished) {
            if (p.estado !== 'Completado') {
                p.estado = 'Completado';
            }
            p.fecha_cierre = today;
        }

        if (p.cliente_id && p.fecha) {
            const cli = (freshDB.Clientes_Maestro || []).find(c => String(c.id) === String(p.cliente_id));
            if (cli && (!cli.fecha_inicio || cli.fecha_inicio === 'No establecida')) {
                cli.fecha_inicio = p.fecha;
            }
        }
    });
}

// ─── DB INITIALIZATION ──────────────────────────────────────
export async function initDB() {
  const syncTask = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for massive first fetch
    
    // Background sync loop
    if (!window._syncLoopStarted) {
        window._syncLoopStarted = true;
        setInterval(async () => {
            try {
                console.log('[DB] Periodic background sync...');
                const res = await fetch(`${API_BASE}/db`);
                if (res.ok) {
                    const freshDB = await res.json();
                    
                    // Map keys from snake_case (server) to CamelCase (client cachedDB)
                    const keyMap = {
                        admin_pipelines: 'Admin_Pipelines',
                        admin_fases: 'Admin_Fases',
                        admin_campos_formulario: 'Admin_Campos_Formulario',
                        clientes_maestro: 'Clientes_Maestro',
                        proyectos_dinamicos: 'Proyectos_Dinamicos',
                        respuestas_dinamicas: 'Respuestas_Dinamicas',
                        usuarios: 'Usuarios',
                        academia_content: 'academiaContent',
                        inventario_global: 'inventarioGlobal',
                        historial_inventario: 'historialInventario',
                        anuncios_corporativos: 'anuncios_corporativos',
                        admin_meetings: 'admin_meetings',
                        admin_meetings_reads: 'admin_meetings_reads',
                        calendario_eventos_reads: 'calendario_eventos_reads',
                        mensajes_internos: 'mensajes_internos',
                        calendario_eventos: 'calendario_eventos',
                        recibos_pagos: 'Recibos_Pagos',
                        admin_roles: 'Admin_Roles'
                    };

                    const mappedDB = {};
                    for (const k in freshDB) {
                        const targetKey = keyMap[k] || k;
                        mappedDB[targetKey] = freshDB[k];
                    }

                    // Apply URL fixes — ONLY convert internal Supabase IPs/subdomains to the storage proxy.
                    // Do NOT touch renewgroup.site/uploads/ — those are served directly by our Node server.
                    const dbStr = JSON.stringify(mappedDB);
                    let fixedDB = mappedDB;
                    if (dbStr.includes('31.97.') || dbStr.includes('easypanel.host') || dbStr.includes('gateway.renewgroup.site') || dbStr.includes('supabase.renewgroup.site') || dbStr.includes('localhost:3010')) {
                      const fixedStr = dbStr
                        .replace(/https?:\/\/31\.97\.\d+\.\d+:\d+\/storage\/v1\/object\/public\//g, '/api/storage-proxy/')
                        .replace(/https?:\/\/31\.97\.\d+\.\d+:\d+\//g, '/api/storage-proxy/')
                        .replace(/https?:\/\/(gateway|supabase)\.renewgroup\.site\/storage\/v1\/object\/public\//g, '/api/storage-proxy/')
                        .replace(/https?:\/\/(api-renew|files-renew)\.0f2zfh\.easypanel\.host(\/storage\/v1)?(\/object\/public)?\//g, '/api/storage-proxy/')
                        .replace(/https?:\/\/localhost:3010/g, 'https://renewgroup.site');
                      fixedDB = JSON.parse(fixedStr);
                    }
                    
                    applyPostProcessing(fixedDB);
                    
                    cachedDB = { ...cachedDB, ...fixedDB };
                    updateChatBadges();
                    window.dispatchEvent(new CustomEvent('db_synced'));
                }
            } catch (e) {
                console.warn('[DB] Periodic sync failed', e);
            }
        }, 30000); // Every 30 seconds
    }

    try {
      console.log('[DB] Synchronizing with Cloud Server...');
      const cacheBuster = `?t=${Date.now()}`;
      const res = await fetch(`${API_BASE}/db${cacheBuster}`, { 
          signal: controller.signal,
          cache: 'no-store'
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Servidor de nube no disponible.');
      
      let freshData = await res.json();
      
      // Map keys from snake_case to CamelCase
      const keyMap = {
          admin_pipelines: 'Admin_Pipelines',
          admin_fases: 'Admin_Fases',
          admin_campos_formulario: 'Admin_Campos_Formulario',
          clientes_maestro: 'Clientes_Maestro',
          proyectos_dinamicos: 'Proyectos_Dinamicos',
          respuestas_dinamicas: 'Respuestas_Dinamicas',
          usuarios: 'Usuarios',
          academia_content: 'academiaContent',
          inventario_global: 'inventarioGlobal',
          historial_inventario: 'historialInventario',
          anuncios_corporativos: 'anuncios_corporativos',
          admin_meetings: 'admin_meetings',
          admin_meetings_reads: 'admin_meetings_reads',
          calendario_eventos_reads: 'calendario_eventos_reads',
          mensajes_internos: 'mensajes_internos',
          calendario_eventos: 'calendario_eventos',
          recibos_pagos: 'Recibos_Pagos',
          admin_roles: 'Admin_Roles'
      };

      const mappedData = {};
      for (const k in freshData) {
          const targetKey = keyMap[k] || k;
          mappedData[targetKey] = freshData[k];
      }
      
      // ── CLIENT-SIDE URL FIX ──
      // Only convert internal Supabase IPs/subdomains. Do NOT touch renewgroup.site/uploads/
      // because those are local files served directly by our Node server.
      const dbStr = JSON.stringify(mappedData);
      let freshDB = mappedData;
      if (dbStr.includes('31.97.') || dbStr.includes('easypanel.host') || dbStr.includes('gateway.renewgroup.site') || dbStr.includes('supabase.renewgroup.site') || dbStr.includes('localhost:3010')) {
        const fixedStr = dbStr
          .replace(/https?:\/\/31\.97\.\d+\.\d+:\d+\/storage\/v1\/object\/public\//g, '/api/storage-proxy/')
          .replace(/https?:\/\/31\.97\.\d+\.\d+:\d+\//g, '/api/storage-proxy/')
          .replace(/https?:\/\/(gateway|supabase)\.renewgroup\.site\/storage\/v1\/object\/public\//g, '/api/storage-proxy/')
          .replace(/https?:\/\/(api-renew|files-renew)\.0f2zfh\.easypanel\.host(\/storage\/v1)?(\/object\/public)?\//g, '/api/storage-proxy/')
          .replace(/https?:\/\/localhost:3010/g, 'https://renewgroup.site');
        freshDB = JSON.parse(fixedStr);
      }
      
      // POST-PROCESSING
      applyPostProcessing(freshDB);

      cachedDB = freshDB;
      updateChatBadges();
      
      // Optional: Save a small copy for emergency offline access only
      try {
        const cacheData = { ...freshDB };
        // (Strip logic remains to keep it small)
        if (cacheData.Clientes_Maestro) {
          cacheData.Clientes_Maestro = cacheData.Clientes_Maestro.map(c => {
            const out = { ...c };
            if (out.foto && out.foto.length > 1000) out.foto = null;
            return out;
          });
        }
        localStorage.setItem('rs_admin_db', JSON.stringify(cacheData));
      } catch (e) {}
      
      // Removed needsSave block as migration mutations were moved to applyPostProcessing and shouldn't trigger massive saves on interval.

      console.log('[DB] Cloud Database synchronized successfully.');
      window.dispatchEvent(new CustomEvent('db_synced'));

    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('[DB] Cloud sync failed:', error.message);
      
      // Fallback only if we have NO data
      if (!cachedDB) {
        const rawCache = localStorage.getItem('rs_admin_db');
        if (rawCache) {
            cachedDB = JSON.parse(rawCache);
            console.log('[DB] Fallback to local cache due to cloud error.');
        } else {
            cachedDB = {
              Admin_Pipelines: [], Admin_Fases: [], Admin_Campos_Formulario: [],
              Clientes_Maestro: [], Proyectos_Dinamicos: [], Respuestas_Dinamicas: [],
              Usuarios: [], academiaContent: [], inventarioGlobal: [], historialInventario: [],
              anuncios_corporativos: [], admin_meetings: [], admin_meetings_reads: [], calendario_eventos_reads: [], Admin_Proveedores: [], 
              calendario_eventos: [], mensajes_internos: [], Admin_Roles: [],
              Counters: { cli: 0, proy: 0, resp: 0, pip: 0, fase: 0, campo: 0 }
            };
        }
        
        const banner = document.createElement('div');
        banner.style.cssText = `position:fixed; top:0; left:0; right:0; z-index:9999999; background: #f59e0b; color:#000; padding:10px; text-align:center;`;
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-orange-500"></i> Sin conexión a la nube. Los datos podrían estar desactualizados.`;
        document.body.appendChild(banner);
      }
    }
  };

  // Always wait for cloud on startup (100% Cloud focus)
  await syncTask();
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
  // ── STRIP VIRTUAL FIELDS (CLIENT-SIDE) ──
  // These fields only exist in memory and are NOT columns in Supabase.
  // Strip them at the source so they never reach the server regardless of code path.
  let sanitized = records;
  if (table === 'admin_campos_formulario') {
    sanitized = records.map(({ es_opcional, orden, opciones, ...rest }) => {
        let baseOpciones = (opciones || '').split('|META|')[0];
        const metaStr = JSON.stringify({ es_opcional: !!es_opcional, orden });
        return { ...rest, opciones: `${baseOpciones}|META|${metaStr}` };
    });
  } else if (table === 'proyectos_dinamicos') {
    sanitized = records.map(({ 
      asignado_a, estado, ultima_actividad,
      ultima_actividad_label, rol_fase, is_locked,
      direccion, nombre_cliente, telefono_cliente, email_cliente,
      email, telefono, etapa, fase_orden, total_fases,
      zip, licencia, id_photo, creador_id, created_at,
      contrato_url, contrato_solar_url, contrato_water_url, contrato_home_url,
      ...rest 
    }) => ({
      ...rest,
      fase_id: rest.fase_id === 'Completado' ? null : rest.fase_id
    }));
  } else if (table === 'clientes_maestro') {
    // Strip fields that don't exist in Supabase schema
    sanitized = records.map(({ 
      creador_id, responsable_id, id_photo, is_locked, 
      foto_id, lat, lng, ...rest 
    }) => rest);
  }

  try {
    // ── CRITICAL: Update local cachedDB immediately so subsequent calls to getDB() see the changes ──
    if (cachedDB) {
        const tableName = table.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('_');
        const dbKeyMap = {
            'Proyectos_Dinamicos': 'Proyectos_Dinamicos',
            'Respuestas_Dinamicas': 'Respuestas_Dinamicas',
            'Clientes_Maestro': 'Clientes_Maestro',
            'Admin_Fases': 'Admin_Fases',
            'Admin_Campos_Formulario': 'Admin_Campos_Formulario',
            'Usuarios': 'Usuarios',
            'Historial_Inventario': 'historialInventario',
            'Inventario_Global': 'inventarioGlobal',
            'Academia_Content': 'academiaContent',
            'Mensajes_Internos': 'mensajes_internos',
            'mensajes_internos': 'mensajes_internos',
            'Rrhh_Adelantos': 'rrhh_adelantos',
            'rrhh_adelantos': 'rrhh_adelantos',
            'Anuncios_Corporativos': 'anuncios_corporativos',
            'Admin_Meetings': 'admin_meetings',
            'Admin_Meetings_Reads': 'admin_meetings_reads',
            'Calendario_Eventos': 'calendario_eventos',
            'Calendario_Eventos_Reads': 'calendario_eventos_reads',
            'Observadores_Reads': 'observadores_reads',
            'Admin_Roles': 'Admin_Roles'
        };
        const dbKey = dbKeyMap[tableName] || tableName;
        
        if (cachedDB[dbKey]) {
            records.forEach(rec => {
                const idx = cachedDB[dbKey].findIndex(x => x.id === rec.id);
                if (idx !== -1) {
                    cachedDB[dbKey][idx] = { ...cachedDB[dbKey][idx], ...rec };
                } else {
                    cachedDB[dbKey].push(rec);
                }
            });
        }
    }

    const res = await fetch(`${API_BASE}/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, records: sanitized })
    });

    // ── SIDE EFFECT: Sync Receipt Uploads to Client Profile ──
    if (table === 'respuestas_dinamicas' && records.length > 0) {
      for (const r of records) {
        // FIX: Accept both absolute URLs (http/https) AND relative storage-proxy paths (/api/storage-proxy/...)
        const isFileValue = r.valor && (
          r.valor.startsWith('http') ||
          r.valor.startsWith('data:') ||
          r.valor.startsWith('/api/storage-proxy/') ||
          r.valor.startsWith('/uploads/')
        );
        if (isFileValue) {
           const db = getDB();
           const campo = (db.Admin_Campos_Formulario || []).find(c => String(c.id) === String(r.campo_id));
           if (campo) {
             const label = (campo.etiqueta || '').toLowerCase();
             const fase = (db.Admin_Fases || []).find(f => String(f.id) === String(campo.fase_id));
             const isComisionPhase = fase && fase.nombre && fase.nombre.toLowerCase().includes('comisi');
             
             const isReceiptLabel = label.includes('recibo') || label.includes('pago') || label.includes('comisi') || label.includes('comprobante');
             
             // Trigger sync if: it's in the Comision phase OR the label indicates a receipt
             if (isComisionPhase || isReceiptLabel) {
               let tipo = 'tecnico'; // default
               if (label.includes('vendedor') || label.includes('representante') || label.includes('comision vendedor') || label.includes('comisión vendedor')) {
                   tipo = 'vendedor';
               } else if (label.includes('tecnico') || label.includes('técnico') || label.includes('instalador')) {
                   tipo = 'tecnico';
               }

               console.log(`[API-SYNC] <i class="fa-solid fa-paperclip"></i> Recibo detectado en campo "${campo.etiqueta}" (fase: ${fase ? fase.nombre : 'N/A'}, tipo: ${tipo}). Sincronizando...`);
               _syncReceiptToClient(r.proyecto_id, r.valor, label, tipo).catch(e => console.error('[API-SYNC] <i class="fa-solid fa-xmark text-red-500"></i> Error sincronizando recibo:', e));
             }
           }
        }
      }
    }
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

/**
 * Syncs a receipt URL to the client's adjuntos_oficina metadata
 * @private
 */
async function _syncReceiptToClient(projectId, url, label, forceTipo = null) {
  try {
    const db = getDB();
    const proy = (db.Proyectos_Dinamicos || []).find(p => String(p.id) === String(projectId));
    if (!proy) { console.warn('[API-SYNC] <i class="fa-solid fa-triangle-exclamation text-orange-500"></i> Proyecto no encontrado:', projectId); return; }
    if (!proy.cliente_id) { console.warn('[API-SYNC] <i class="fa-solid fa-triangle-exclamation text-orange-500"></i> Proyecto sin cliente_id:', projectId); return; }
    
    const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(proy.cliente_id));
    if (!cli) { console.warn('[API-SYNC] <i class="fa-solid fa-triangle-exclamation text-orange-500"></i> Cliente no encontrado:', proy.cliente_id); return; }
    
    const isVendedor = forceTipo ? (forceTipo === 'vendedor') : label.includes('vendedor');

    // ── 1. Actualizar perfil del cliente (adjuntos_oficina) ──
    const updatedCli = { ...cli };
    let adjuntos = updatedCli.adjuntos_oficina;
    if (!adjuntos || typeof adjuntos !== 'object' || Array.isArray(adjuntos)) adjuntos = {};
    else adjuntos = { ...adjuntos };
    
    adjuntos.recibo_url = url;
    if (isVendedor) {
      adjuntos.recibo_vendedor_url = url;
      adjuntos.ultima_comision_fecha = new Date().toISOString();
    } else {
      adjuntos.recibo_tecnico_url = url;
      adjuntos.ultima_instalacion_fecha = new Date().toISOString();
    }
    updatedCli.adjuntos_oficina = adjuntos;
    await saveGranular('clientes_maestro', [updatedCli]);
    console.log('[API-SYNC] <i class="fa-solid fa-check text-green-500"></i> adjuntos_oficina actualizado en cliente', cli.id);

    // ── 2. Crear registro en Recibos_Pagos para "Mis Recibos" ──
    // El vendedor es el responsable_id (primero de la lista) del proyecto; el técnico es tecnico_id
    const trabajadorId = isVendedor ? (proy.responsable_id || '').split(',')[0].trim() : (proy.tecnico_id || (proy.responsable_id || '').split(',')[0].trim());
    const user = (db.Usuarios || []).find(u => String(u.id) === String(trabajadorId));
    const trabajadorNom = user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() : 'Staff';
    const clienteNom = cli.nombre || cli.nombre_completo || `Cliente ${cli.id}`;

    const reciboId = `rec_up_${projectId}_${isVendedor ? 'v' : 't'}`;
    const newRecibo = {
      id: reciboId,
      proyecto_id: projectId,
      tipo: isVendedor ? 'vendedor' : 'tecnico',
      trabajador_id: trabajadorId || null,
      trabajador_nombre: trabajadorNom,
      cliente_nombre: clienteNom,
      direccion: cli.direccion || null,
      fecha_recibo: new Date().toISOString().split('T')[0],
      pdf_url: url,
      datos_json: { source: 'upload', label: label }
    };

    // Optimistic local update
    if (db.Recibos_Pagos) {
      const idx = db.Recibos_Pagos.findIndex(r => r.id === reciboId);
      if (idx !== -1) db.Recibos_Pagos[idx] = { ...db.Recibos_Pagos[idx], ...newRecibo };
      else db.Recibos_Pagos.push(newRecibo);
    }

    await saveGranular('recibos_pagos', [newRecibo]);
    console.log(`[API-SYNC] <i class="fa-solid fa-check text-green-500"></i> Recibo guardado (ID: ${reciboId}) para proyecto ${projectId}, trabajador: ${trabajadorNom}`);
  } catch(syncErr) {
    console.error('[API-SYNC] <i class="fa-solid fa-xmark text-red-500"></i> Error en _syncReceiptToClient:', syncErr);
  }
}

export async function deleteRecord(table, id, column) {
  try {
    const res = await fetch(`${API_BASE}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, id, column })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        console.error(`Error al eliminar en servidor (Tabla: ${table}, ID: ${id})`, data);
        throw new Error(data.error || `Error al eliminar en servidor (Tabla: ${table}, ID: ${id})`);
    } else {
        console.log(`Eliminado exitosamente de ${table}: ${id} (Filas: ${data.count})`);
    }
  } catch (e) {
    console.error('Error de red al intentar eliminar', e);
    throw e;
  }
}

export async function deleteRecords(table, ids, column) {
  try {
    const res = await fetch(`${API_BASE}/delete-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, ids, column })
    });
    
    // If bulk delete is not found (404) or fails (500), fallback to individual
    if (!res.ok) {
        if (res.status === 404) {
            console.warn(`[API] Bulk delete not found on server, falling back to individual deletes...`);
            let count = 0;
            for (const id of ids) {
                await deleteRecord(table, id, column);
                count++;
            }
            return count;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error en borrado masivo (${res.status})`);
    }

    const data = await res.json();
    console.log(`Eliminados exitosamente de ${table}: ${data.count} registros.`);
    return data.count;
  } catch (e) {
    console.error('Error de red en borrado masivo', e);
    throw e;
  }
}

// ─── RECIBOS DE PAGO ─────────────────────────────────────────
export async function saveRecibo(recibo) {
  if (!recibo.id) recibo.id = crypto.randomUUID();
  recibo.created_at = recibo.created_at || new Date().toISOString();

  if (cachedDB) {
    if (!Array.isArray(cachedDB.Recibos_Pagos)) cachedDB.Recibos_Pagos = [];
    const idx = cachedDB.Recibos_Pagos.findIndex(r => r.id === recibo.id);
    if (idx !== -1) cachedDB.Recibos_Pagos[idx] = { ...cachedDB.Recibos_Pagos[idx], ...recibo };
    else cachedDB.Recibos_Pagos.push(recibo);
  }
  await saveGranular('recibos_pagos', [recibo]);

  // Disparar generación de PDF en el servidor
  fetch('/api/generate-receipt-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reciboId: recibo.id })
  })
  .then(r => r.json())
  .then(res => {
    console.log('[PDF] Generación iniciada:', res);
  })
  .catch(err => console.error('[PDF] Error al iniciar generación:', err));

  return recibo;
}

export function getRecibos(trabajadorId = null) {
  const db = getDB();
  const all = db.Recibos_Pagos || [];
  if (!trabajadorId) return all;
  
  // A worker sees receipts if:
  // 1. They are the 'trabajador_id' (the one the receipt is FOR)
  // 2. They are the 'responsable_id' of the project associated with the receipt
  return all.filter(r => {
    if (r.trabajador_id === trabajadorId) return true;
    
    if (r.proyecto_id) {
      const proy = (db.Proyectos_Dinamicos || []).find(p => p.id === r.proyecto_id);
      if (proy && (proy.responsable_id || '').split(',').map(id=>id.trim()).includes(String(trabajadorId))) return true;
    }
    
    return false;
  });
}

// ─── LISTA DE PRECIOS (Renew Water) ─────────────────────────
export async function getListaPrecios(sedeFilter = null) {
  const db = getDB();
  let items = db.Water_Productos || [];
  if (sedeFilter) {
    items = items.filter(p => p.sede === sedeFilter || p.sede === 'todas');
  }
  return items.sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

export async function saveListaPrecio(producto) {
  const db = getDB();
  if (!db.Water_Productos) db.Water_Productos = [];

  if (!producto.id) producto.id = `wp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

  const idx = db.Water_Productos.findIndex(p => p.id === producto.id);
  if (idx > -1) {
    db.Water_Productos[idx] = { ...db.Water_Productos[idx], ...producto };
  } else {
    db.Water_Productos.push(producto);
  }

  // Optimistic local update
  cachedDB = db;
  localStorage.setItem('rs_admin_db', JSON.stringify(db));

  // Persist to Supabase via upsert
  await saveGranular('water_productos', [producto]);
  return producto;
}

export async function deleteListaPrecio(id) {
  const db = getDB();
  try {
    await deleteRecord('water_productos', id);
    db.Water_Productos = (db.Water_Productos || []).filter(p => p.id !== id);
    cachedDB = db;
    localStorage.setItem('rs_admin_db', JSON.stringify(db));
    window.dispatchEvent(new CustomEvent('db_synced'));
  } catch(err) {
    console.error('[deleteListaPrecio]', err);
    throw err;
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
    
    const requiredTables = [
        'Admin_Pipelines', 'Admin_Fases', 'Admin_Campos_Formulario',
        'Clientes_Maestro', 'Proyectos_Dinamicos', 'Respuestas_Dinamicas',
        'Usuarios', 'academiaContent', 'inventarioGlobal', 'historialInventario',
        'anuncios_corporativos', 'admin_meetings', 'admin_meetings_reads', 'calendario_eventos_reads', 'Deleted_Workers', 'calendario_eventos',
        'Recibos_Pagos', 'Water_Productos', 'Admin_Catalogos', 'mensajes_internos', 'rrhh_adelantos', 'Admin_Roles'
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

// ─── CONFIGURACIÓN DE CATÁLOGOS (Cloud) ─────────────────────
export async function getCatalogos() {
  const db = getDB();
  return db.Admin_Catalogos || [];
}

export async function saveCatalogo(id, pdf_url) {
  const db = getDB();
  if (!db.Admin_Catalogos) db.Admin_Catalogos = [];
  
  const rec = { id, pdf_url, updated_at: new Date().toISOString() };
  const idx = db.Admin_Catalogos.findIndex(c => c.id === id);
  
  if (idx > -1) {
    db.Admin_Catalogos[idx] = rec;
  } else {
    db.Admin_Catalogos.push(rec);
  }

  cachedDB = db;
  localStorage.setItem('rs_admin_db', JSON.stringify(db));
  
  // Persist to Supabase
  await saveGranular('admin_catalogos', [rec]);
  return rec;
}

export function genId(type, db) { 
    if (!db.Counters) db.Counters = { cli: 0, proy: 0, resp: 0, pip: 0, fase: 0, campo: 0 };
    db.Counters[type] = (db.Counters[type] || 0) + 1; 
    const hash = Math.random().toString(36).substring(2, 6);
    return type + '_' + db.Counters[type] + '_' + hash; 
}


// Removed duplicate getCurrentUser declaration


// ─── FILE UPLOAD HELPER ─────────────────────────────────────
// Uploads file to the server, which stores it in Supabase Storage buckets
export async function uploadFile(file, type = 'others') {
    let finalFile = file;
    
    // Auto-compress images to avoid Supabase 413 Payload Too Large limits
    if (file && file.type && file.type.startsWith('image/')) {
        try {
            finalFile = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxDim = 1200;
                        
                        if (width > height && width > maxDim) {
                            height *= maxDim / width;
                            width = maxDim;
                        } else if (height > maxDim) {
                            width *= maxDim / height;
                            height = maxDim;
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                            } else {
                                resolve(file);
                            }
                        }, 'image/jpeg', 0.8);
                    };
                    img.onerror = () => resolve(file);
                };
                reader.onerror = () => resolve(file);
            });
        } catch (err) {
            console.warn('[COMPRESSION] Failed, falling back to original file', err);
        }
    }

    const formData = new FormData();
    formData.append('file', finalFile);
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

/**
 * Sube contenido de Academia (video + miniatura) a través del servidor proxy.
 * Usa un sistema de fragmentos (chunks) para evitar límites de tamaño y errores de CORS
 * que ocurrirían al intentar subir directamente al gateway de Supabase.
 *
 * @param {File|null} fileVideo  – Archivo de video
 * @param {File|null} fileMiniatura – Imagen miniatura opcional
 * @param {function} [onProgress] – Callback(pct, msg) para actualizar la UI
 */
export async function uploadAcademia(fileVideo, fileMiniatura, onProgress) {
    const report = (pct, msg) => {
        console.log(`[API-ACADEMIA] ${pct}% – ${msg}`);
        if (typeof onProgress === 'function') onProgress(pct, msg);
    };

    try {
        let videoUrl     = null;
        let miniaturaUrl = null;

        // ─── 1. VIDEO via fragmentos (chunked) ───────────────────────
        // NUNCA intentamos subir directamente al gateway de Supabase desde el browser
        // porque el CORS lo bloqueará. Todo pasa por /api/* de nuestro servidor Node.
        if (fileVideo) {
            report(0, `Preparando fragmentos de "${fileVideo.name}"…`);

            const uploadId   = 'aca_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB por fragmento
            const totalChunks = Math.ceil(fileVideo.size / CHUNK_SIZE);

            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end   = Math.min(start + CHUNK_SIZE, fileVideo.size);
                const chunk = fileVideo.slice(start, end);
                const pct   = Math.round(((i + 1) / totalChunks) * 80); // 0-80%

                report(pct, `Subiendo fragmento ${i + 1} de ${totalChunks}…`);

                // Reintentos ante fallos transitorios de red
                let attempt = 0;
                let chunkOk = false;
                while (attempt < 3 && !chunkOk) {
                    try {
                        const r = await fetch(`${API_BASE}/upload-chunk?uploadId=${uploadId}&chunkIndex=${i}`, {
                            method:  'POST',
                            headers: { 'Content-Type': 'application/octet-stream' },
                            body:    chunk
                        });
                        if (!r.ok) {
                            const err = await r.text().catch(() => r.status);
                            throw new Error(`Fragmento ${i} rechazado (HTTP ${r.status}): ${err}`);
                        }
                        chunkOk = true;
                    } catch (netErr) {
                        attempt++;
                        if (attempt >= 3) throw netErr;
                        console.warn(`[API-ACADEMIA] Reintentando fragmento ${i} (intento ${attempt})…`);
                        await new Promise(r => setTimeout(r, 1000 * attempt));
                    }
                }
            }

            report(85, 'Ensamblando video en el servidor…');

            // Detectar tipo de contenido según extensión
            const ext = fileVideo.name.split('.').pop().toLowerCase();
            const mimeMap = { mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm' };
            const contentType = mimeMap[ext] || 'video/mp4';

            const completeRes = await fetch(`${API_BASE}/complete-upload`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ uploadId, fileName: fileVideo.name, folder: 'academia', totalChunks, contentType })
            });

            if (!completeRes.ok) {
                const errData = await completeRes.json().catch(() => ({}));
                throw new Error(errData.error || `El servidor no pudo ensamblar el video (HTTP ${completeRes.status})`);
            }

            const completeData = await completeRes.json();
            if (!completeData.success) throw new Error(completeData.error || 'Fallo al completar el ensamblado');
            videoUrl = completeData.url;
            report(90, 'Video subido correctamente <i class="fa-solid fa-check text-green-500"></i>');
        }

        // ─── 2. MINIATURA via proxy estándar ─────────────────────────
        if (fileMiniatura) {
            report(92, 'Subiendo miniatura…');
            const formData = new FormData();
            formData.append('miniatura', fileMiniatura);

            const res  = await fetch(`${API_BASE}/upload-academia`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) miniaturaUrl = data.miniaturaUrl;
            report(97, 'Miniatura subida <i class="fa-solid fa-check text-green-500"></i>');
        }

        report(100, 'Subida completa <i class="fa-solid fa-check text-green-500"></i>');
        return { videoUrl, miniaturaUrl };

    } catch (e) {
        console.error('[API-ACADEMIA] Error de subida:', e);
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
  try {
    await deleteRecord('inventario_global', id);
    db.inventarioGlobal = (db.inventarioGlobal || []).filter(i => i.id !== id);
    
    cachedDB = db;
    localStorage.setItem('rs_admin_db', JSON.stringify(db));
    window.dispatchEvent(new CustomEvent('db_synced'));
  } catch (err) {
    console.error('Error deleting inventory item:', err);
    throw err;
  }
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
        
        // A project is considered completed if:
        // 1. Its status is explicitly 'Completado'
        // 2. Its fase_id is 'Completado' (terminal state set by advanceDealPhase)
        // 3. Its fase_id is null (alternative terminal state)
        // 4. Its fase_id matches the last phase of its pipeline
        const isProjectTerminal = 
          p.estado === 'Completado' || 
          p.fase_id === 'Completado' || 
          p.fase_id === null ||
          (phases.length > 0 && p.fase_id === phases[phases.length - 1].id);
        
        const pipNombre = pipeline.nombre.replace('Renew ', '');

        if (isProjectTerminal) {
          hasCompleted = true;
          // Don't force add to active departments if completed
        } else {
          hasActive = true;
          // ── Force add ONLY if active ──
          if (!cli.departamentos_activos.includes(pipNombre)) {
             cli.departamentos_activos.push(pipNombre);
          }
        }
      });

      // Update global status
      // Priority: Active > Completed > Prospect
      if (hasActive) {
        cli.estado = 'En Proceso';
        cli.macro_estado = 'En Proceso';
      } else if (hasCompleted) {
        cli.estado = 'Completado';
        cli.macro_estado = 'Cliente';
      } else {
        // This case might happen if all projects are weird/missing pipelines
        // Fallback to existing or Prospecto
        if (!cli.macro_estado) cli.macro_estado = 'Prospecto';
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
    : ['Admin', 'Procesador', 'Técnico', 'Vendedor'];
  const p = { id, nombre, icono: 'circle', color: color || '#8b5cf6', rolesConAcceso: roles };
  db.Admin_Pipelines.push(p);
  await saveGranular('admin_pipelines', [p]); 
  return p;
}

export async function deleteAdminPipeline(pipelineId) {
  const db = getDB();
  try {
    // 1. Identify all related phases and fields
    const phases = (db.Admin_Fases || []).filter(f => f.pipeline_id === pipelineId);
    const phaseIds = phases.map(f => f.id);
    
    // 2. Identify all related projects
    const projects = (db.Proyectos_Dinamicos || []).filter(p => p.pipeline_id === pipelineId);
    const projectIds = projects.map(p => p.id);

    // 3. Delete answers associated with these projects
    if (projectIds.length > 0) {
      console.log(`[CASCADE] Cleaning answers for ${projectIds.length} projects`);
      await deleteRecords('respuestas_dinamicas', projectIds, 'proyecto_id');
      console.log(`[CASCADE] Deleting projects`);
      await deleteRecords('proyectos_dinamicos', projectIds);
    }

    // 4. Delete fields and phases
    if (phaseIds.length > 0) {
      console.log(`[CASCADE] Cleaning fields and phases`);
      await deleteRecords('admin_campos_formulario', phaseIds, 'fase_id');
      await deleteRecords('admin_fases', phaseIds);
    }
    
    // 5. Delete pipeline
    await deleteRecord('admin_pipelines', pipelineId);

    // 6. Local cleanup
    db.Admin_Pipelines = (db.Admin_Pipelines || []).filter(p => p.id !== pipelineId);
    db.Admin_Fases = (db.Admin_Fases || []).filter(f => f.pipeline_id !== pipelineId);
    db.Admin_Campos_Formulario = (db.Admin_Campos_Formulario || []).filter(c => !phaseIds.includes(c.fase_id));
    db.Proyectos_Dinamicos = (db.Proyectos_Dinamicos || []).filter(p => p.pipeline_id !== pipelineId);
    if (projectIds.length > 0) {
      db.Respuestas_Dinamicas = (db.Respuestas_Dinamicas || []).filter(r => !projectIds.includes(r.proyecto_id));
    }

    cachedDB = db;
    localStorage.setItem('rs_admin_db', JSON.stringify(db));
    window.dispatchEvent(new CustomEvent('db_synced'));
  } catch (err) {
    console.error('Error deleting pipeline:', err);
    throw err;
  }
}

export async function getAdminFases() { return getDB().Admin_Fases; }
export async function createAdminFase(pipeline_id, nombre, orden, rol_encargado = 'Representante de Ventas') {
  const db = getDB();
  const id = genId('fase', db);
  const f = { id, pipeline_id, orden: Number(orden) || 1, nombre, rol_encargado };
  db.Admin_Fases.push(f);
  await saveGranular('admin_fases', [f]); 
  return f;
}

export async function updateAdminFaseRole(faseId, nuevoRol) {
  const db = getDB();
  const fase = db.Admin_Fases.find(f => f.id === faseId);
  if (fase) {
    fase.rol_encargado = nuevoRol;
    await saveGranular('admin_fases', [fase]);
  }
}

export async function updateAdminFaseUsers(faseId, userIds) {
  const db = getDB();
  const fase = db.Admin_Fases.find(f => f.id === faseId);
  if (fase) {
    fase.usuarios_especificos = userIds; // Array de IDs de usuarios
    await saveDB(db);
  }
}

export async function deleteAdminFase(faseId) {
  const db = getDB();
  try {
    // 1. Identify fields in this phase
    const fields = (db.Admin_Campos_Formulario || []).filter(c => c.fase_id === faseId);
    const fieldIds = fields.map(c => c.id);

    // 2. Delete answers associated with these fields
    if (fieldIds.length > 0) {
      console.log(`[CASCADE] Cleaning answers for ${fieldIds.length} fields in phase`);
      await deleteRecords('respuestas_dinamicas', fieldIds, 'campo_id');
    }

    // 3. Delete fields in this phase
    await deleteRecord('admin_campos_formulario', faseId, 'fase_id');
    
    // 4. Delete phase
    await deleteRecord('admin_fases', faseId);

    // 5. Local cleanup
    db.Admin_Fases = (db.Admin_Fases || []).filter(f => f.id !== faseId);
    db.Admin_Campos_Formulario = (db.Admin_Campos_Formulario || []).filter(c => c.fase_id !== faseId);
    if (fieldIds.length > 0) {
      db.Respuestas_Dinamicas = (db.Respuestas_Dinamicas || []).filter(r => !fieldIds.includes(r.campo_id));
    }

    cachedDB = db;
    localStorage.setItem('rs_admin_db', JSON.stringify(db));
    window.dispatchEvent(new CustomEvent('db_synced'));
  } catch (err) {
    console.error('Error deleting phase:', err);
    throw err;
  }
}

export async function getAdminCampos() { return getDB().Admin_Campos_Formulario; }
export async function createAdminCampo(fase_id, etiqueta, tipo, opciones, es_opcional = false) {
  const db = getDB();
  const id = genId('campo', db);
  const orden = (db.Admin_Campos_Formulario.filter(x => x.fase_id === fase_id).length || 0) + 1;
  const c = { id, fase_id, etiqueta, tipo, opciones, es_opcional, orden };
  db.Admin_Campos_Formulario.push(c);
  await saveGranular('admin_campos_formulario', [c]);
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

    // 3. Persistir localmente
    cachedDB = db;
    localStorage.setItem('rs_admin_db', JSON.stringify(db));
    window.dispatchEvent(new CustomEvent('db_synced'));
  } catch(e) { 
    console.error('Error borrando campo en remoto:', e); 
    throw e;
  }
}

export async function updateAdminCampo(campoId, etiqueta, tipo, opciones, es_opcional = false) {
  const db = getDB();
  const campo = db.Admin_Campos_Formulario.find(c => c.id === campoId);
  if (!campo) throw new Error('Campo no encontrado: ' + campoId);
  campo.etiqueta = etiqueta;
  campo.tipo = tipo;
  campo.opciones = opciones || '';
  campo.es_opcional = es_opcional;
  await saveGranular('admin_campos_formulario', [campo]);
  cachedDB = db;
  return campo;
}

export async function reorderAdminCampos(faseId, newOrderIds) {
  const db = getDB();
  const otherCampos = db.Admin_Campos_Formulario.filter(c => c.fase_id !== faseId);
  const phaseCampos = newOrderIds.map((id, index) => {
      const c = db.Admin_Campos_Formulario.find(c => c.id === id);
      if (c) c.orden = index + 1;
      return c;
  }).filter(Boolean);
  db.Admin_Campos_Formulario = [...otherCampos, ...phaseCampos];
  await saveGranular('admin_campos_formulario', phaseCampos);
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
  await saveGranular('admin_fases', phaseFases);
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

export async function getAdminPartners() {
  const db = getDB();
  return db.Admin_Proveedores || [];
}

export async function saveAdminWorker(worker) {
  const db = getDB();
  if (!db.Usuarios) db.Usuarios = [];

  const idx = db.Usuarios.findIndex(u => u.id === worker.id);
  if (idx > -1) {
    db.Usuarios[idx] = { ...db.Usuarios[idx], ...worker };
  } else {
    if (!worker.id) worker.id = 'u' + Date.now();
    if (!worker.rango) worker.rango = 'novato';
    db.Usuarios.push(worker);
  }

  // Update local cache immediately
  cachedDB = db;
  localStorage.setItem('rs_admin_db', JSON.stringify(db));

  // ── CLIENT-SIDE SANITIZATION ──
  // Strip virtual/computed fields that do NOT exist as columns in Supabase's
  // 'usuarios' table. Sending them causes "column does not exist" errors.
  const src = idx > -1 ? db.Usuarios[idx] : worker;
  const sanitized = {
    id:                         src.id                         || null,
    nombre:                     src.nombre                     || null,
    apellido:                   src.apellido                   || null,
    email:                      src.email                      || null,
    password:                   src.password                   || src.pass || null,
    rol:                        src.rol                        || null,
    rango:                      src.rango                      || null,
    department:                 src.department                 || null,
    dob:                        src.dob                        || null,
    foto:                       src.foto                       || null,
    telefono:                   src.telefono                   || null,
    w9_url:                     src.w9_url                     || src.w9Url     || null,
    carnet_url:                 src.carnet_url                 || src.carnetUrl || null,
    contrato_url:               src.contrato_url               || src.contratoUrl || null,
    estatus_rrhh:               src.estatus_rrhh               || null,
    is_suspended:               src.is_suspended               || false,
    sede:                       src.sede                       || null,
    unidades:                   Array.isArray(src.unidades) ? src.unidades : [],
    equipo_ids:                 Array.isArray(src.equipo_ids) ? src.equipo_ids : [],
    pipeline_ids:               Array.isArray(src.pipeline_ids) ? src.pipeline_ids : [],
    tel_emergencia:             src.tel_emergencia             || null,
    contacto_emergencia_nombre: src.contacto_emergencia_nombre || null,
    direccion:                  src.direccion                  || null,
    zelle_nombre:               src.zelle_nombre               || null,
    zelle_cuenta:               src.zelle_cuenta               || null,
    zelle_tel:                  src.zelle_tel                  || null,
    banco_nombre:               src.banco_nombre               || null,
    banco_cuenta:               src.banco_cuenta               || null,
    banco_ruta:                 src.banco_ruta                 || null,
    zadarma_sip_id:             src.zadarma_sip_id             || null,
  };

  await saveGranular('usuarios', [sanitized]);

  // ── SYNC SESSION: If the saved worker IS the current user, update localStorage ──
  // This ensures zadarma_sip_id and other fields are immediately available
  // without requiring the user to log out and log back in.
  try {
    const sessionStr = localStorage.getItem('rs_user');
    if (sessionStr) {
      const sessionUser = JSON.parse(sessionStr);
      if (sessionUser.id === src.id) {
        localStorage.setItem('rs_user', JSON.stringify({ ...sessionUser, ...src }));
      }
    }
  } catch(e) { /* ignore */ }

  return worker;
}

export async function deleteAdminWorker(ids) {
  const db = getDB();
  const idArray = Array.isArray(ids) ? ids : [ids];
  
  if (!db.Deleted_Workers) db.Deleted_Workers = [];
  if (!db.Usuarios) db.Usuarios = [];

  try {
    // 1. Borrar físicamente en Supabase
    await deleteRecords('usuarios', idArray);

    // 2. Limpiar localmente
    idArray.forEach(id => {
      if (!db.Deleted_Workers.includes(id)) {
        db.Deleted_Workers.push(id);
      }
    });
    db.Usuarios = db.Usuarios.filter(u => !idArray.includes(u.id));

    // 3. Persistir localmente
    cachedDB = db;
    localStorage.setItem('rs_admin_db', JSON.stringify(db));
    window.dispatchEvent(new CustomEvent('db_synced'));
    
    console.log(`[DELETE WORKER] Se eliminaron ${idArray.length} trabajadores.`);
  } catch (err) {
    console.error('Error al borrar trabajadores:', err);
    throw err;
  }
}

// ─── AUTHENTICATION ─────────────────────────────────────────
export const MOCK_USERS = [
  { id: 'u1', nombre: 'Carlos', apellido: 'Rodríguez', email: 'carlos@renewsolar.com', password: '1234', initials: 'CR', unidades: ['Renew Solar', 'Renew Water', 'Renew Home'], rol: 'Representante de Ventas', rango: 'vendedor', telefono: '+1 (305) 555-1234' },
  { id: 'u3', nombre: 'Demo',   apellido: 'Vendedor',  email: 'demo@renew.com',        password: 'demo', initials: 'DV', unidades: ['Renew Solar', 'Renew Water', 'Renew Home'], rol: 'Admin', rango: 'analista', telefono: '+1 (555) 123-4567' },
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
  if (u.is_suspended) throw new Error('Tu cuenta ha sido inhabilitada temporalmente. Por favor, contacta a administración.');
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
      
      const userRolNorm = (u && u.rol) ? u.rol.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim() : '';
      const isAdminUser = ['admin', 'administrador', 'ceo'].includes(userRolNorm);

      // Admin sees everything
      if (isAdminUser) return true; 
      
      // Creator ALWAYS sees their project
      if ((p.responsable_id || '').split(',').map(id=>id.trim()).includes(String(userId))) return true;

      // Workers assigned to the current phase see it
      const fase = (db.Admin_Fases || []).find(f => f.id === p.fase_id);
      if (fase) {
        // 1. Check if user is explicitly assigned to this phase
        const specificUsers = fase.usuarios_especificos || [];
        if (specificUsers.includes(userId)) return true;

        // 2. Check by role assignment
        if (fase.rol_encargado) {
          const faseRolNorm = fase.rol_encargado.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
          const isMyTurn = userRolNorm === faseRolNorm || (userRolNorm.includes('call') && faseRolNorm.includes('call'));
          
          if (isMyTurn) {
            if (p.asignado_a) {
              if (p.asignado_a === u.id) return true;
            } else {
              return true;
            }
          }
        }
      }
      return false;
    });

    return myProyectos.map(p => {
      const cli = (db.Clientes_Maestro || []).find(c => c.id === p.cliente_id) || {};
      const userRolNorm = (u && u.rol) ? u.rol.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim() : '';
      const isAdminUser = ['admin', 'administrador', 'ceo'].includes(userRolNorm);
      
      const fase = (db.Admin_Fases || []).find(f => f.id === p.fase_id) || {};
      const faseRolNorm = (fase.rol_encargado || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      const faseOrden = fase.orden || 0;
      
      const isMyTurn = userRolNorm === faseRolNorm || (userRolNorm.includes('call') && faseRolNorm.includes('call'));
      const isLocked = !isAdminUser && !isMyTurn;

      return {
        ...p,
        id: p.id,
        nombre_cliente: cli.nombre || 'Sin nombre',
        telefono: cli.telefono || '-',
        direccion: cli.direccion || '-',
        licencia: cli.licencia || '-',
        etapa: (p.fase_id === 'Completado' || p.estado === 'Completado') ? 'Completado' : (fase.nombre || 'Desconocida'),
        fase_id: p.fase_id,
        fase_orden: faseOrden,
        total_fases: totalFasesMap[p.pipeline_id] || 0,
        fecha: p.fecha,
        responsable_id: p.responsable_id,
        is_locked: isLocked,
        rol_fase: fase.rol_encargado || 'Representante de Ventas'
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
    console.log(`[CASCADE DELETE] Inciando borrado para ${idArray.length} clientes y ${projectIds.length} proyectos...`);

    // 2. Cascade delete in Supabase (Order matters!)
    if (projectIds.length > 0) {
      await deleteRecords('respuestas_dinamicas', projectIds, 'proyecto_id');
      await deleteRecords('proyectos_dinamicos', projectIds);
    }

    // 3. Delete clients in Supabase
    await deleteRecords('clientes_maestro', idArray);

    // 4. Update local DB with type-safe normalization
    const idsToDrop = idArray.map(String);
    db.Clientes_Maestro = (db.Clientes_Maestro || []).filter(c => !idsToDrop.includes(String(c.id)));
    db.Proyectos_Dinamicos = (db.Proyectos_Dinamicos || []).filter(p => !idsToDrop.includes(String(p.cliente_id)));
    
    const pIdsToDrop = projectIds.map(String);
    db.Respuestas_Dinamicas = (db.Respuestas_Dinamicas || []).filter(r => !pIdsToDrop.includes(String(r.proyecto_id)));

    // 5. Update local state and persistence
    cachedDB = db;
    localStorage.setItem('rs_admin_db', JSON.stringify(db));
    
    window.dispatchEvent(new CustomEvent('db_synced'));
    console.log('[CASCADE DELETE] Borrado masivo completado con éxito.');
  } catch (err) {
    console.error('Error during cascade delete:', err);
    throw err;
  }
}

export async function deleteAdminProject(id) {
    const db = getDB();
    
    try {
        console.log(`[DELETE PROJECT] Iniciando borrado para proyecto: ${id}`);
        // 1. Borrar respuestas en Supabase
        await deleteRecord('respuestas_dinamicas', id, 'proyecto_id');
        // 2. Borrar proyecto en Supabase
        await deleteRecord('proyectos_dinamicos', id);
        
        // 3. Limpiar local
        db.Proyectos_Dinamicos = db.Proyectos_Dinamicos.filter(p => p.id !== id);
        db.Respuestas_Dinamicas = db.Respuestas_Dinamicas.filter(r => r.proyecto_id !== id);
        
        // 4. Persistir localmente
        cachedDB = db;
        localStorage.setItem('rs_admin_db', JSON.stringify(db));
        window.dispatchEvent(new CustomEvent('db_synced'));
        
        console.log(`[DELETE PROJECT] Proyecto ${id} eliminado.`);
    } catch (err) {
        console.error('Error al borrar proyecto:', err);
        throw err;
    }
}

export async function createDynamicDeal({ cliente, cliente_id, respuestas, pipelineName, responsable_id }) {
  const db = getDB();
  
  // Fallback: if no responsable_id provided, try to get current user from localStorage
  if (!responsable_id) {
    const sessionUser = JSON.parse(localStorage.getItem('rs_user') || '{}');
    responsable_id = sessionUser.id || null;
  }

  const pipeline = pipelineName ? db.Admin_Pipelines.find(p => p.nombre.trim().toLowerCase() === pipelineName.trim().toLowerCase()) : null;
  const fases = pipeline ? db.Admin_Fases.filter(f => f.pipeline_id === pipeline.id).sort((a,b) => a.orden - b.orden) : [];
  const firstFaseId = fases[0] ? fases[0].id : null;

  let finalClienteId = cliente_id;
  if (!finalClienteId && cliente) {
    const sessionUser = JSON.parse(localStorage.getItem('rs_user') || '{}');
    const userName = `${sessionUser.nombre || ''} ${sessionUser.apellido || ''}`.trim();

    const newCliente = { 
      id: genId('cli', db), 
      ...cliente,
      dob: cliente.dob || '-',
      state_id: cliente.state_id || '-',
      vendedor_asignado_id: responsable_id,
      vendedor_asignado_nombre: userName || 'Representante',
      origen_tipo: 'representante',
      origen_id: responsable_id,
      origen_nombre: userName || 'Representante'
    };
    db.Clientes_Maestro.push(newCliente);
    finalClienteId = newCliente.id;
  }

  let newProyecto = null;
  let newProyId = null;

  // Si el cliente ya existe, vamos a actualizar su vendedor asignado al responsable actual
  // para que aparezca en "Mis Clientes" del usuario que está creando el proyecto.
  const existingCli = db.Clientes_Maestro.find(c => c.id === finalClienteId);
  if (existingCli) {
    const sessionUser = JSON.parse(localStorage.getItem('rs_user') || '{}');
    existingCli.vendedor_asignado_id = responsable_id || sessionUser.id;
    existingCli.vendedor_asignado_nombre = (sessionUser.nombre + ' ' + (sessionUser.apellido || '')).trim() || 'Representante';
    existingCli.estado = 'En Proceso';
  }

  if (pipeline) {
    newProyId = genId('proy', db);
    newProyecto = {
      id: newProyId,
      cliente_id: finalClienteId,
      pipeline_id: pipeline.id,
      fase_id: firstFaseId,
      responsable_id: responsable_id,
      fecha: new Date().toISOString().split('T')[0],
      colaboradores: [],
      discusion: []
    };
    db.Proyectos_Dinamicos.push(newProyecto);
  } else if (existingCli) {
    existingCli.estado = 'Lead';
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
  
  const specificUsers = fase.usuarios_especificos || [];
  const isMyTurn = (fase && fase.rol_encargado === user.rol) || specificUsers.includes(user.id);
  const isLocked = !isAdmin && !isMyTurn;

  return { 
    ...p,
    id: p.id, 
    nombre_cliente: cli.nombre, 
    telefono: cli.telefono, 
    direccion: cli.direccion, 
    email: cli.email, 
    zip: cli.zip, 
    licencia: cli.licencia || '-',
    id_photo: cli.id_photo || cli.foto || null,
    contrato_url: (cli.adjuntos_oficina && cli.adjuntos_oficina.contrato_url) || cli.contrato_url || null,
    contrato_solar_url: (cli.adjuntos_oficina && cli.adjuntos_oficina.contrato_solar_url) || cli.contrato_solar_url || null,
    contrato_water_url: (cli.adjuntos_oficina && cli.adjuntos_oficina.contrato_water_url) || cli.contrato_water_url || null,
    contrato_home_url: (cli.adjuntos_oficina && cli.adjuntos_oficina.contrato_home_url) || cli.contrato_home_url || null,
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

export async function advanceDealPhase(dealId, respuestas, options = {}) {
  const db = getDB();
  let p = db.Proyectos_Dinamicos.find(d => d.id === dealId);
  
  // Fallback: search for normalized ID if not found directly
  if (!p && dealId) {
    const normalized = String(dealId).toLowerCase().replace('renew-', '').replace(/-/g, '_');
    p = db.Proyectos_Dinamicos.find(d => d.id === normalized || d.id === `proy_${normalized}`);
    if (p) {
        console.log(`[API] Resolved project ${dealId} to ${p.id} via fallback`);
        dealId = p.id;
    }
  }

  if(!p) throw new Error("Proyecto no encontrado (ID: " + dealId + ")");

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
  
  // ── FILTER ORPHANED RESPONSES ──
  // Only save responses whose campo_id still exists in Admin_Campos_Formulario.
  // Orphaned records (from deleted fields) cause a FK constraint violation in Supabase.
  const validCampoIds = new Set((db.Admin_Campos_Formulario || []).map(c => c.id));
  const validRespuestas = misRespuestas.filter(r => validCampoIds.has(r.campo_id));
  const orphanedRespuestas = misRespuestas.filter(r => !validCampoIds.has(r.campo_id));
  
  if (orphanedRespuestas.length > 0) {
    console.warn(
      `[<i class="fa-solid fa-triangle-exclamation text-orange-500"></i> RESPUESTAS HUÉRFANAS] Estas respuestas tienen campo_id que NO existe en Admin_Campos_Formulario y serán ignoradas:`,
      orphanedRespuestas.map(r => ({
        id: r.id,
        campo_id: r.campo_id,
        valor: r.valor,
        proyecto_id: r.proyecto_id
      }))
    );
  }
  
  // ── CRITICAL FIX: Ensure project exists in Supabase BEFORE saving answers ──
  // This prevents the foreign key constraint violation (proyecto_id_fkey)
  await saveGranular('proyectos_dinamicos', [p]);

  if (validRespuestas.length > 0) {
    await saveGranular('respuestas_dinamicas', validRespuestas);
  }

  // Calculate destination phase
  const fases = db.Admin_Fases.filter(f => f.pipeline_id === p.pipeline_id).sort((a,b) => a.orden - b.orden);
  const curFidx = fases.findIndex(f => f.id === p.fase_id);
  
  if (curFidx === -1) return { nextFase: null, isCompletado: true };

  // ── AUTO-DETECTION LOGIC ──
  // Check if ALL fields for the current phase are filled
  const camposFase = (db.Admin_Campos_Formulario || []).filter(c => c.fase_id === p.fase_id);
  // misRespuestas ya fue declarado arriba y contiene los mismos datos
  
  const missingFields = [];
  const allFilled = (camposFase || []).every(c => {
    // Re-query from DB to ensure we have the latest values including what we just saved
    const r = (db.Respuestas_Dinamicas || []).find(resp => resp.proyecto_id === dealId && resp.campo_id === c.id);
    const hasValue = r && r.valor && r.valor !== "No subido" && r.valor !== "No provisto";
    if (!hasValue) missingFields.push(c.etiqueta || c.id);
    return hasValue;
  });

  if (!allFilled && (camposFase || []).length > 0) {
      console.log(`[API] Phase cannot advance. Missing fields:`, missingFields);
  }

  let isCompletado = false;
  let didAdvance = false;

  // ── PHASE ADVANCEMENT LOGIC ──
  const curFase = fases[curFidx];
  const isApprovalPhase = curFase && curFase.nombre.toLowerCase().includes('aprobación');
  
  // If it's an approval phase, we only advance if the specific "Aprobación" field is set to "Aprobado"
  // or if we are not preventing auto-advance.
  let canAdvance = allFilled && !options.preventAutoAdvance;
  
  if (isApprovalPhase && !options.forceAdvance) {
     // Check if there's an "Aprobación" field that is NOT "Aprobado"
     const approvalField = camposFase.find(c => c.etiqueta.toLowerCase().includes('aprobación'));
     if (approvalField) {
        const resp = db.Respuestas_Dinamicas.find(r => r.proyecto_id === dealId && r.campo_id === approvalField.id);
        if (!resp || resp.valor !== 'Aprobado') {
           canAdvance = false; // Stay in phase until approved
        }
     }
  }

  if (canAdvance) {
    if (curFidx < fases.length - 1) {
      const nextFaseId = fases[curFidx + 1].id;
      await updateProyectoFase(dealId, nextFaseId, respuestas);
      didAdvance = true;
    } else {
      isCompletado = true;
      const cliObj = db.Clientes_Maestro.find(c => c.id === p.cliente_id);
      if (cliObj) {
        cliObj.estado = 'Completado';
        cliObj.macro_estado = 'Cliente';
        await saveGranular('clientes_maestro', [cliObj]);
      }
      p.estado = 'Completado';
      p.fase_id = 'Completado';
      p.fecha_cierre = new Date().toISOString().split('T')[0];
      await saveGranular('proyectos_dinamicos', [p]);
      didAdvance = true;
    }
  } else if (options.forceNotify) {
    // Just trigger the webhook for the current phase (e.g., Credit App submitted but pending approval)
    await updateProyectoFase(dealId, p.fase_id, respuestas);
  }

  return { 
    nextFase: isCompletado ? null : p.fase_id, 
    isCompletado, 
    didAdvance, 
    missingCount: camposFase.length - db.Respuestas_Dinamicas.filter(r => String(r.proyecto_id) === String(dealId) && camposFase.some(c => String(c.id) === String(r.campo_id)) && r.valor && r.valor !== "No subido" && r.valor !== "No provisto").length
  };
}


export function syncKanbanActivity({ proyecto_id, evento, campo_etiqueta, archivo_nombre, responsable_id, fase_nombre, skipSave = false }) {
  const db = getDB();
  const p = db.Proyectos_Dinamicos.find(x => x.id === proyecto_id);
  if (!p) return;

  if (!p.actividad) p.actividad = [];
  
  // Custom label for inventory
  let displayLabel = `<i class="fa-solid fa-check text-green-500"></i> ${fase_nombre}`;
  if (evento === 'ARCHIVO_SUBIDO') displayLabel = `<i class="fa-solid fa-paperclip"></i> ${campo_etiqueta}`;
  if (evento === 'RETIRO_MATERIAL') displayLabel = `<i class="fa-solid fa-box"></i> Material: ${archivo_nombre}`;

  p.actividad.unshift({
    tipo: evento,
    campo: campo_etiqueta || fase_nombre || '',
    archivo: archivo_nombre || null,
    responsable_id: responsable_id || null,
    timestamp: new Date().toISOString(),
    label: displayLabel
  });

  if (p.actividad.length > 20) p.actividad = p.actividad.slice(0, 20);
  p.ultima_actividad = new Date().toISOString();
  p.ultima_actividad_label = displayLabel;

  if (!skipSave) saveDB(db); 
}

/**
 * Adds a user as observer to a project and logs a system message in the project's discussion.
 * Only the project's responsable or admin/CEO can call this.
 * @param {string} projectId
 * @param {object} observerUser - { id, nombre, apellido, foto }
 * @returns {Promise<object>} updated project
 */
export async function addObserver(projectId, observerUser) {
  const db = getDB();
  const p = (db.Proyectos_Dinamicos || []).find(x => x.id === projectId);
  if (!p) throw new Error('Proyecto no encontrado');

  const currentUser = getCurrentUser();
  const adminRoles = ['admin', 'administrador', 'ceo', 'desarrollador', 'supervisión'];
  const isAdmin = adminRoles.includes((currentUser?.rol || '').toLowerCase());
  const isResponsable = (p.responsable_id || '').split(',').map(id=>id.trim()).includes(String(currentUser?.id)) || (p.asignado_a === currentUser?.id) || (Array.isArray(p.colaboradores) && p.colaboradores.some(c => c.id === currentUser?.id));
  if (!isAdmin && !isResponsable) throw new Error('Sin permisos para agregar colaboradores');

  if (!p.colaboradores) p.colaboradores = [];
  if (p.colaboradores.some(o => o.id === observerUser.id)) return p; // already watching

  p.colaboradores.push({
    id: observerUser.id,
    nombre: `${observerUser.nombre || ''} ${observerUser.apellido || ''}`.trim(),
    foto: observerUser.foto || null,
    added_by: currentUser?.id,
    added_at: new Date().toISOString()
  });

  // Add system event message in project discussion
  if (!p.discusion) p.discusion = [];
  p.discusion.push({
    type: 'system',
    text: `${currentUser?.nombre || 'Alguien'} agregó a ${observerUser.nombre || ''} como colaborador.`,
    date: new Date().toISOString()
  });

  await saveGranular('proyectos_dinamicos', [p]);
  return p;
}

/**
 * Removes a user from the observers list of a project.
 */
export async function removeObserver(projectId, observerId) {
  const db = getDB();
  const p = (db.Proyectos_Dinamicos || []).find(x => x.id === projectId);
  if (!p) throw new Error('Proyecto no encontrado');

  const currentUser = getCurrentUser();
  const adminRoles = ['admin', 'administrador', 'ceo', 'desarrollador', 'supervisión'];
  const isAdmin = adminRoles.includes((currentUser?.rol || '').toLowerCase());
  const isResponsable = (p.responsable_id || '').split(',').map(id=>id.trim()).includes(String(currentUser?.id)) || (p.asignado_a === currentUser?.id) || (Array.isArray(p.colaboradores) && p.colaboradores.some(c => c.id === currentUser?.id));
  if (!isAdmin && !isResponsable) throw new Error('Sin permisos');

  p.colaboradores = (p.colaboradores || []).filter(o => o.id !== observerId);
  await saveGranular('proyectos_dinamicos', [p]);
  return p;
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
// Nuevo webhook para avisar específicamente al representante del proyecto
const N8N_REP_WEBHOOK_URL = 'https://n8n.renewgroup.site/webhook/aviso-representante';

/**
 * Dado un objeto fase y el vendedor original del proyecto,
 * devuelve la lista de destinatarios que n8n debe notificar.
 */
function _resolverDestinatarios(db, fase, vendedor_original_id, proyecto = null) {
  const rol_encargado = fase?.rol_encargado;
  const usuarios_especificos = fase?.usuarios_especificos || [];
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

  let destinatarios = [];

  // 1. Si es Asignación Específica, solo usamos los IDs listados
  if (rol_encargado === 'Asignación Específica') {
    if (usuarios_especificos.length > 0) {
      usuarios_especificos.forEach(uid => {
        const u = workers.find(w => w.id === uid);
        if (u) destinatarios.push(toContact(u));
      });
    }
    return destinatarios;
  }

  // 2. Si no es Asignación Específica, ignoramos la lista de usuarios específicos
  // (Siguiendo la solicitud del usuario de que no tiene sentido tener ambos activos)

  // 2. Agregar por rol si está definido
  if (rol_encargado) {
    if (rol_encargado === 'Vendedor' || rol_encargado === 'Representante de Ventas') {
      const creador = workers.find(u => u.id === vendedor_original_id);
      if (creador && !destinatarios.some(d => d.id === creador.id)) {
        destinatarios.push(toContact(creador));
      }
    } else if (rol_encargado === 'Técnico' || rol_encargado === 'Tecnico') {
      if (proyecto && proyecto.tecnico_id) {
        const tec = workers.find(u => u.id === proyecto.tecnico_id);
        if (tec && !destinatarios.some(d => d.id === tec.id)) {
          destinatarios.push(toContact(tec));
        }
      } else {
        const porRol = workers.filter(u => u.rol && u.rol.toLowerCase() === rol_encargado.toLowerCase());
        porRol.forEach(u => {
          if (!destinatarios.some(d => d.id === u.id)) {
            destinatarios.push(toContact(u));
          }
        });
      }
    } else {
      const porRol = workers.filter(u => u.rol && u.rol.toLowerCase() === rol_encargado.toLowerCase());
      porRol.forEach(u => {
        if (!destinatarios.some(d => d.id === u.id)) {
          destinatarios.push(toContact(u));
        }
      });
    }
  }

  return destinatarios;
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
export async function updateProyectoFase(proyectoId, nuevaFaseId, extraContext = {}) {
  const db = getDB();
  const proyecto = (db.Proyectos_Dinamicos || []).find(p => p.id === proyectoId);
  const nuevaFase = (db.Admin_Fases || []).find(f => f.id === nuevaFaseId);

  if (!proyecto) throw new Error("Proyecto no encontrado");

  // Lógica de persistencia de tecnico_id AL ASIGNARLO en fases previas
  const respuestasProy = db.Respuestas_Dinamicas?.filter(r => r.proyecto_id === proyectoId) || [];
  const camposTecnico = db.Admin_Campos_Formulario?.filter(c => c.tipo === 'Técnico') || [];
  for (const c of camposTecnico) {
    const r = respuestasProy.find(resp => resp.campo_id === c.id);
    if (r && r.valor && r.valor !== 'No subido' && r.valor !== 'No provisto') {
       proyecto.tecnico_id = r.valor;
       console.log('[API] Técnico asignado dinámicamente:', proyecto.tecnico_id);
    }
  }

  // Fallback a asignado_a si la fase actual es de Técnico y aún no hay tecnico_id
  if (nuevaFase && (nuevaFase.rol_encargado === 'Tecnico' || nuevaFase.rol_encargado === 'Técnico')) {
     if (proyecto.asignado_a && !proyecto.tecnico_id) {
        proyecto.tecnico_id = proyecto.asignado_a;
        console.log('[API] Asociando técnico permanente desde asignado_a:', proyecto.tecnico_id);
     }
  }

  const nombre_fase   = nuevaFase?.nombre        ?? 'Desconocida';
  const rol_encargado = nuevaFase?.rol_encargado ?? null;

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
  let destinatarios = nuevaFase
    ? _resolverDestinatarios(db, nuevaFase, vendedor_original_id, proyecto)
    : [];

  // Identificar usuarios independientes (los que están en usuarios_especificos)
  const usuarios_especificos_ids = nuevaFase?.usuarios_especificos || [];
  const usuarios_independientes = destinatarios.filter(d => usuarios_especificos_ids.includes(d.id));

  // Round Robin para "Call Center"
  if (rol_encargado === 'Call Center' && destinatarios.length > 0) {
    if (!db.Round_Robin) db.Round_Robin = {};
    let lastIndex = db.Round_Robin['Call Center'] || 0;
    
    if (lastIndex >= destinatarios.length) {
      lastIndex = 0;
    }
    
    const selectedOp = destinatarios[lastIndex];
    proyecto.asignado_a = selectedOp.id;
    destinatarios = [selectedOp]; 
    
    const nextIndex = (lastIndex + 1) % destinatarios.length;
    db.Round_Robin['Call Center'] = nextIndex;

    if (!db.Respuestas_Dinamicas) db.Respuestas_Dinamicas = [];
    
    let rrResp = db.Respuestas_Dinamicas.find(r => r.campo_id === '__round_robin_cc__');
    if (rrResp) rrResp.valor = String(nextIndex);
    else db.Respuestas_Dinamicas.push({ id: genId('resp', db), proyecto_id: 'GLOBAL', campo_id: '__round_robin_cc__', valor: String(nextIndex) });

    let asigResp = db.Respuestas_Dinamicas.find(r => r.proyecto_id === proyecto.id && r.campo_id === '__asignado_a__');
    if (asigResp) asigResp.valor = selectedOp.id;
    else db.Respuestas_Dinamicas.push({ id: genId('resp', db), proyecto_id: proyecto.id, campo_id: '__asignado_a__', valor: selectedOp.id });

  } else {
    proyecto.asignado_a = null;
    if (db.Respuestas_Dinamicas) {
      db.Respuestas_Dinamicas = db.Respuestas_Dinamicas.filter(r => !(r.proyecto_id === proyecto.id && r.campo_id === '__asignado_a__'));
    }
  }

  // ── PASO 4: Actualizar la base de datos ──────────────────────────────────
  proyecto.fase_id = nuevaFaseId;
  const recordsToUpdate = [proyecto];
  const rrResp = db.Respuestas_Dinamicas?.find(r => r.campo_id === '__round_robin_cc__');
  const asigResp = db.Respuestas_Dinamicas?.find(r => r.proyecto_id === proyecto.id && r.campo_id === '__asignado_a__');
  const dynamicRecords = [];
  if (rrResp) dynamicRecords.push(rrResp);
  if (asigResp) dynamicRecords.push(asigResp);
  
  await saveGranular('proyectos_dinamicos', recordsToUpdate);
  if (dynamicRecords.length > 0) {
      await saveGranular('respuestas_dinamicas', dynamicRecords);
  }

  // ── PASO 4.5: Verificación de Ascenso Automático (Renew Water) ───────────
  if (nuevaFaseId === 'Completado' || nuevaFase?.nombre === 'Completado') {
     console.log(`[PROMOTION] Project ${proyectoId} completed. Checking promotion for vendor ${vendedor_original_id}...`);
     _checkAndPromoteVendor(db, vendedor_original_id).catch(e => console.error("[PROMOTION] Error:", e));
  }

  // ── PASO 5: Disparar webhooks a n8n (fire & forget) ───────────────────────
  (async () => {
    try {
      // Resolve representative (original vendor) info so recipients (e.g. technicians) know who to contact
      const allWorkersForPayload = [...MOCK_USERS, ...(db.Usuarios || [])];
      const rep = allWorkersForPayload.find(u => u.id === vendedor_original_id);
      const representante_info = rep ? {
        id:       rep.id,
        nombre:   `${rep.nombre || ''} ${rep.apellido || ''}`.trim(),
        email:    rep.email    || null,
        telefono: rep.telefono || null,
      } : null;

      const payload = {
        proyecto_id:           proyectoId,
        pipeline_nombre,
        nueva_fase_id:         nuevaFaseId,
        nombre_fase,
        rol_encargado,
        vendedor_original_id,
        representante_info,    // ← nombre, email y teléfono del representante/vendedor
        destinatarios,
        usuarios_independientes, // ← Lista de usuarios específicos asignados
        cliente_id,
        cliente_info,
        ...extraContext,
        timestamp: new Date().toISOString(),
      };

      // 1. Webhook General de Flujo
      fetch(N8N_WEBHOOK_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }).catch(err => console.warn('[Webhook Flujo] Error:', err.message));

      // 2. Webhook de Aviso al Representante
      const allWorkers = [...MOCK_USERS, ...(db.Usuarios || [])];
      const representante = allWorkers.find(u => u.id === vendedor_original_id);
      
      if (representante) {
        const repPayload = {
          proyecto_id:     proyectoId,
          pipeline_nombre,
          nombre_fase,
          cliente_nombre:  cliente_info.nombre,
          rep_nombre:      representante.nombre,
          rep_email:       representante.email,
          rep_telefono:    representante.telefono,
          ...extraContext,
          timestamp:       new Date().toISOString(),
        };

        fetch(N8N_REP_WEBHOOK_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(repPayload),
        }).catch(err => console.warn('[Webhook Representante] Error:', err.message));
      }

    } catch (webhookErr) {
      console.warn('[Webhooks n8n] <i class="fa-solid fa-triangle-exclamation text-orange-500"></i> Error en proceso asíncrono:', webhookErr.message);
    }
  })();

  return { success: true, proyecto };
}

/**
 * Counts completed sales for a vendor and updates their role based on the Growth Staircase.
 * @private
 */
async function _checkAndPromoteVendor(db, userId) {
  if (!userId) return;

  const waterPipeline = (db.Admin_Pipelines || []).find(p => p.nombre === 'Renew Water');
  if (!waterPipeline) return;

  // 1. Count completed sales in Renew Water
  const salesCount = (db.Proyectos_Dinamicos || []).filter(p => 
    (p.responsable_id || '').split(',').map(id=>id.trim()).includes(String(userId)) && 
    p.pipeline_id === waterPipeline.id &&
    isProjectFinished(p, db)
  ).length;

  console.log(`[PROMOTION] Vendor ${userId} has ${salesCount} sales.`);

  // 2. Define thresholds (Matching the Escalera de Crecimiento image)
  // 0: Novato, 3: Subvendedor, 18: Iniciante, 33: Junior, 53: Vendedor, 73: Analista
  const thresholds = [
    { min: 73, role: 'analista' },
    { min: 53, role: 'vendedor' },
    { min: 33, role: 'junior' },
    { min: 25, role: 'iniciante' },
    { min: 3,  role: 'subvendedor' },
    { min: 0,  role: 'novato' }
  ];

  const targetRank = thresholds.find(t => salesCount >= t.min)?.role || 'novato';

  // 3. Update user rank if changed
  const user = (db.Usuarios || []).find(u => u.id === userId);
  if (user && user.rango !== targetRank) {
    // We only promote if the new rank is "higher" or if it matches our ladder
    console.log(`[PROMOTION] Promoting user ${userId} from rank ${user.rango || 'novato'} to ${targetRank}`);
    user.rango = targetRank;
    await saveGranular('usuarios', [user]);
    
    // Also update local storage if it's the current user
    const sessionUser = JSON.parse(localStorage.getItem('rs_user') || '{}');
    if (sessionUser.id === userId) {
      sessionUser.rango = targetRank;
      localStorage.setItem('rs_user', JSON.stringify(sessionUser));
      // Trigger a refresh of the price list if open
      window.dispatchEvent(new CustomEvent('user_promoted', { detail: { rank: targetRank } }));
    }
  }
}

export function isProjectFinished(p, db) {
  if (!p) return false;
  
  // STRICTER COMPLETION LOGIC:
  // Only count if state or phase explicitly says Completed/Finished
  const estado = String(p.estado || '').toLowerCase();
  const faseId = String(p.fase_id || '').toLowerCase();

  const finishedTerms = ['completado', 'finalizado', 'finished', 'cerrado', 'closed', 'venta', 'liquidado'];
  
  if (finishedTerms.some(term => estado === term || faseId === term)) return true;
  
  if (db && db.Admin_Fases) {
    const faseObj = db.Admin_Fases.find(f => String(f.id).toLowerCase() === faseId);
    if (faseObj) {
      const faseNom = String(faseObj.nombre || '').toLowerCase();
      if (finishedTerms.some(term => faseNom.includes(term)) || faseNom.includes('completado')) return true;
    }
  }
  return false;
}

export function getProjectDate(p, db) {
  if (!p) return null;
  // Use fecha_cierre if finished, fallback to creation fecha
  if (isProjectFinished(p, db)) {
    return p.fecha_cierre || p.fecha;
  }
  return p.fecha;
}

// ── INTERNAL MESSAGING (CHAT) ────────────────────────────────
// Tracks whether /api/messages exists on this server (null=unknown, true/false=confirmed)
let _apiMessagesAvailable = null;

export async function getInternalMessages() {
    // 1. Try the lightweight /api/messages endpoint ONLY if we haven't confirmed it's unavailable
    if (_apiMessagesAvailable !== false) {
        try {
            const res = await fetch(`${API_BASE}/messages`);
            if (res.ok) {
                _apiMessagesAvailable = true;
                const data = await res.json();
                const messages = data.messages || [];
                if (cachedDB) cachedDB.mensajes_internos = messages;
                return messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            } else if (res.status === 404) {
                // Endpoint doesn't exist on this server — never try again this session
                _apiMessagesAvailable = false;
                console.log('[CHAT] /api/messages not found on server, relying entirely on /api/db cache.');
            }
        } catch (e) {
            console.warn('[CHAT] /api/messages network error:', e.message);
        }
    }

    // 2. Fallback: Use the cache populated by initDB().
    // This works on ALL server versions. We don't trigger a fetch here because
    // initDB() already syncs the full DB periodically in the background.
    const db = getDB();
    const cached = db.mensajes_internos || [];
    return cached.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export async function sendInternalMessage({ content, mentions = [], image_url = null }) {
    const user = getCurrentUser();
    if (!user) throw new Error('No hay sesión activa');

    const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        sender_id: user.id,
        sender_name: user.nombre + ' ' + (user.apellido || ''),
        content,
        mentions, // Array of user IDs
        image_url,
        created_at: new Date().toISOString(),
        read_by: [user.id]
    };

    const db = getDB();
    if (!db.mensajes_internos) db.mensajes_internos = [];
    db.mensajes_internos.push(newMessage);
    
    // Maintain a reasonable limit for in-memory chat history if needed, 
    // but for now, let's just save.
    await saveGranular('mensajes_internos', [newMessage]);
    return newMessage;
}

export async function markMessageAsRead(messageId) {
    const user = getCurrentUser();
    if (!user) return;

    const db = getDB();
    const msg = (db.mensajes_internos || []).find(m => m.id === messageId);
    if (msg && !msg.read_by.includes(user.id)) {
        msg.read_by.push(user.id);
        await saveGranular('mensajes_internos', [msg]);
    }
}

export function updateChatBadges() {
    const user = getCurrentUser();
    if (!user) return;
    const db = getDB();
    const messages = db.mensajes_internos || [];
    const unreadCount = messages.filter(m => 
        m.mentions && m.mentions.includes(user.id) && (!m.read_by || !m.read_by.includes(user.id))
    ).length;

    window._unreadChatCount = unreadCount;

    // Update all badge elements in the DOM
    const badges = document.querySelectorAll('[id^="chat-badge-"], #chat-header-badge, #notifications-badge-chat');
    badges.forEach(b => {
        if (unreadCount > 0) {
            b.classList.remove('hidden');
            // Check if it's a "dot only" badge or a "number" badge
            if (b.id === 'chat-header-badge' || b.classList.contains('w-2.5')) {
                // Just keep it visible (the dot)
            } else {
                b.textContent = unreadCount;
            }
        } else {
            b.classList.add('hidden');
        }
    });
}
export async function updateInternalMessage(messageId, content) {
    const db = getDB();
    const msg = (db.mensajes_internos || []).find(m => m.id === messageId);
    if (msg) {
        msg.content = content;
        msg.updated_at = new Date().toISOString();
        await saveGranular('mensajes_internos', [msg]);
    }
}

export async function deleteInternalMessage(messageId) {
    const db = getDB();
    try {
        await deleteRecord('mensajes_internos', messageId);
        db.mensajes_internos = (db.mensajes_internos || []).filter(m => m.id !== messageId);
        cachedDB = db;
        window.dispatchEvent(new CustomEvent('db_synced'));
    } catch (err) {
        console.error('Error deleting message:', err);
        throw err;
    }
}
