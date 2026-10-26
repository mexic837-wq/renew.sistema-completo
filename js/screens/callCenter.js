/* ============================================================
   RENEW – screens/callCenter.js
   Pantalla Call Center – Flujo 2 Fases
   Fase 1: Recolección → Aceptado / Rechazado (con tracking)
   Fase 2: Datos Extras → Ecosistema + Notas → Lead en CRM
   ============================================================ */
import { getDB, saveDB, getAdminWorkers, createDynamicDeal } from '../api.js';
import { showToast } from '../components/toast.js';
import { getCurrentUser } from '../app.js';

// ── STATE ────────────────────────────────────────────────────
let _ccState = {
  fase:        1,           // 1 = Recolección, 2 = Datos Extras
  prospectos:  [],
  activeId:    null,        // prospecto actual en Fase 2
};

// ── API HELPERS ──────────────────────────────────────────────

// Lista compartida: todos ven todos los leads del call center
const ESTADOS_ACTIVOS = ['pendiente', 'confirmacion_pendiente', 'en_espera'];
const esActivo = p => !p.estado || ESTADOS_ACTIVOS.includes(p.estado);

// Solo Admin / CEO pueden borrar leads de la lista
function puedeBorrarLeads(user) {
  const roles = (window.getUserRoles ? window.getUserRoles(user) : [user?.rol])
    .map(r => String(r || '').toLowerCase().trim());
  return roles.some(r => ['admin', 'administrador', 'ceo'].includes(r));
}

// De dónde vino el lead (página, scraping, redes sociales, etc.)
function origenDelLead(p) {
  const fuente = String(p.fuente || '').toLowerCase();
  const detalle = String(p.origen || '').trim();
  const texto = `${fuente} ${detalle.toLowerCase()}`;
  if (/face|fcebook|insta|tiktok|social|redes|meta|whatsapp|linkedin|youtube/.test(texto))
    return { label: 'Redes sociales', icon: 'fa-share-nodes', color: '#ec4899', detalle };
  if (/sitio|web|pagina|página|landing|google|formulario/.test(texto))
    return { label: 'Página web', icon: 'fa-globe', color: '#3b82f6', detalle };
  if (/scrap/.test(texto))
    return { label: 'Scraping', icon: 'fa-robot', color: '#8b5cf6', detalle };
  if (/csv|import/.test(texto))
    return { label: 'Importación CSV', icon: 'fa-file-csv', color: '#10b981', detalle };
  if (/refer/.test(texto))
    return { label: 'Referido', icon: 'fa-user-group', color: '#f59e0b', detalle };
  if (/manual/.test(texto))
    return { label: 'Carga manual', icon: 'fa-pen-to-square', color: '#64748b', detalle };
  return { label: fuente ? fuente.replace(/_/g, ' ') : 'Desconocido', icon: 'fa-circle-question', color: '#64748b', detalle };
}

async function getProspectos() {
  try {
    const res = await fetch('/api/cc-prospectos');
    if (!res.ok) throw new Error('Server error');
    return await res.json();
  } catch (e) {
    console.warn('[CallCenter] Prospectos no disponibles:', e.message);
    return [];
  }
}

async function patchProspecto(id, body) {
  try {
    await fetch(`/api/cc-prospectos/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
  } catch (e) { console.warn('[CallCenter] patchProspecto error', e); }
}

async function crearLeadEnCRM(prospecto, ecosistema, notas, operador, tipo = 'prospecto') {
  const db = getDB();

  const newCliente = {
    id:                       'cli_' + Date.now().toString(36),
    nombre:                   prospecto.nombre    || 'Prospecto CC',
    telefono:                 prospecto.telefono  || '',
    direccion:                prospecto.direccion || '',
    email:                    prospecto.email     || '',
    empresa:                  ecosistema,
    departamento:             ecosistema,   // alias for pipeline detection in vendor assignment
    notas:                    notas || null,
    estado:                   'Lead',
    macro_estado:             'Prospecto',
    fecha:                    new Date().toISOString(),
    origen_tipo:              'call_center',
    origen_nombre:            `${operador.nombre || ''} ${operador.apellido || ''}`.trim(),
    origen_id:                operador.id,
    vendedor_asignado_id:     null,
    vendedor_asignado_nombre: null,
    origen_lead_cc:           prospecto.origen || null,
    historial_llamadas:       prospecto.historial_llamadas || []
  };


  if (!db.Clientes_Maestro) db.Clientes_Maestro = [];
  db.Clientes_Maestro.push(newCliente);
  await saveDB(db);

  // Como cliente: se abre directamente un proyecto en el ecosistema elegido
  let proyecto = null;
  if (tipo === 'cliente') {
    const res = await createDynamicDeal({ cliente_id: newCliente.id, respuestas: {}, pipelineName: ecosistema, responsable_id: operador.id });
    proyecto = res && res.pipeline_id ? res : null;
  }

  // Send webhook
  try {
    const asignacionUrl = `${window.location.origin}/admin.html#crmDetail?id=${newCliente.id}`;
    await fetch('https://n8n.renewgroup.site/webhook/aviso-nuevo-lead-call-center', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: newCliente,
        tipo,
        link_asignacion: asignacionUrl
      })
    });
  } catch (error) {
    console.warn('[Webhook Error] Error notificando a admin:', error);
  }

  return { cliente: newCliente, vendedor: null, proyecto };
}

// ── MAIN RENDER ──────────────────────────────────────────────

export async function renderCallCenter() {
  const user   = getCurrentUser();
  const screen = document.getElementById('screen-call-center');
  if (!screen) return;

  // Reset state
  _ccState = { fase: 1, prospectos: [], activeId: null };

  // Loading skeleton
  screen.innerHTML = buildLoadingSkeleton();

  // Todos los usuarios con acceso ven la misma lista completa
  const todos = await getProspectos();
  _ccState.prospectos = todos.filter(esActivo);

  renderFase1(screen, user);
}

// ═══════════════════════════════════════════════════════════════
//  FASE 1: RECOLECCIÓN
// ═══════════════════════════════════════════════════════════════

function renderFase1(screen, user) {
  _ccState.fase    = 1;
  _ccState.activeId = null;
  ensureCardStyles();
  const pendientes = _ccState.prospectos;

  const fecha  = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const total  = pendientes.length;

  const cards = pendientes.length > 0
    ? pendientes.map((p, i) => buildFase1Card(p, i, puedeBorrarLeads(user))).join('')
    : `<div style="grid-column:1/-1;text-align:center;padding:60px 24px;opacity:0.5;">
        <div style="font-size:3rem;margin-bottom:12px;"><i class="fa-solid fa-envelope-open"></i></div>
        <p style="font-size:14px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.1em;">Sin prospectos pendientes</p>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:8px;">Los leads del scraper aparecerán aquí automáticamente</p>
      </div>`;

  screen.innerHTML = `
    <div style="background:var(--bg);min-height:100vh;padding-bottom:100px;">

      <!-- HEADER FASE 1 -->
      <div style="background:var(--surface);padding:20px 20px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:50%;background:rgba(0,245,212,0.12);display:flex;align-items:center;justify-content:center;font-size:18px;"><i class="fa-solid fa-headphones"></i></div>
            <div>
              <p style="font-size:9px;color:var(--primary);font-weight:800;text-transform:uppercase;letter-spacing:0.14em;margin:0;">FASE 1 · RECOLECCIÓN</p>
              <h1 style="font-size:17px;font-weight:900;color:var(--text);margin:0;line-height:1.2;">Prospectos del Día</h1>
            </div>
          </div>
          <!-- Counter badge -->
          <div style="background:rgba(0,245,212,0.08);border:1px solid rgba(0,245,212,0.2);border-radius:14px;padding:8px 14px;text-align:center;">
            <p style="font-size:20px;font-weight:900;color:var(--primary);margin:0;line-height:1;">${total}</p>
            <p style="font-size:7px;color:var(--text-secondary);font-weight:800;text-transform:uppercase;margin:0;">Pendientes</p>
          </div>
        </div>

        <p style="font-size:10px;color:var(--text-secondary);margin:8px 0 0;text-transform:capitalize;">${fecha} · Hola, ${user.nombre} <i class="fa-solid fa-handshake"></i></p>
      </div>

      <!-- CARDS -->
      <div id="cc-phase1-list" class="cc-grid">
        ${cards}
      </div>
    </div>
  `;

  // EVENTS
  screen.onclick = (e) => handleFase1Click(screen, user, e);
  if (screen._ccTickInterval) { clearInterval(screen._ccTickInterval); screen._ccTickInterval = null; }

  // ── AUTO-POLLING: Refresca prospectos cada 15s ──────────
  if (screen._ccPollInterval) clearInterval(screen._ccPollInterval);
  screen._ccPollInterval = setInterval(async () => {
    if (_ccState.fase !== 1) return;
    if (document.getElementById('modal-cc-pre-notas')) return; // no interrumpir notas abiertas
    const fresh = await getProspectos();
    const freshPending = fresh.filter(esActivo);
    
    const oldIds = new Set(_ccState.prospectos.map(p => p.id));
    const newLeads = freshPending.filter(p => !oldIds.has(p.id));
    const changed = freshPending.length !== _ccState.prospectos.length
      || freshPending.some(p => {
        const old = _ccState.prospectos.find(o => o.id === p.id);
        return !old || (old.notas_pre || '') !== (p.notas_pre || '');
      });
    
    if (changed) {
      _ccState.prospectos = freshPending;
      renderFase1(screen, user);
      
      if (newLeads.length > 0) {
        showToast(`\u00a1${newLeads.length} nuevo(s) prospecto(s)!`, 'success');
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }
  }, 15000);
}

const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Fecha y hora de entrada del lead + tiempo relativo
function fechaEntrada(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const fecha = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const hora  = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const min   = Math.floor((Date.now() - d.getTime()) / 60000);
  const rel   = min < 1 ? 'justo ahora'
    : min < 60   ? `hace ${min} min`
    : min < 1440 ? `hace ${Math.floor(min / 60)} h`
    : `hace ${Math.floor(min / 1440)} d`;
  return { texto: `${fecha} · ${hora}`, rel };
}

// Estilos de las tarjetas (una sola vez)
function ensureCardStyles() {
  if (document.getElementById('cc-card-styles')) return;
  const st = document.createElement('style');
  st.id = 'cc-card-styles';
  st.textContent = `
    .cc-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:14px; padding:16px; }
    .cc-p1-card { background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:18px; display:flex; flex-direction:column; gap:14px; transition:border-color .2s, box-shadow .2s, transform .2s; animation:fadeInUp .3s ease both; }
    .cc-p1-card:hover { border-color:rgba(0,245,212,0.45); box-shadow:0 8px 28px rgba(15,23,42,0.07); transform:translateY(-1px); }
    .cc-head { display:flex; align-items:flex-start; gap:12px; }
    .cc-avatar { width:42px; height:42px; flex-shrink:0; border-radius:12px; background:rgba(0,245,212,0.12); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:900; letter-spacing:.02em; }
    .cc-name { font-size:16px; font-weight:800; color:var(--text); margin:0; line-height:1.25; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cc-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
    .cc-chip { display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700; padding:3px 8px; border-radius:999px; background:var(--bg); color:var(--text-secondary); border:1px solid var(--border); }
    .cc-num { font-size:10px; font-weight:800; color:var(--text-secondary); opacity:.6; }
    .cc-trash { width:30px; height:30px; border-radius:9px; border:none; background:transparent; color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; transition:background .2s, color .2s; }
    .cc-trash:hover { background:rgba(239,68,68,0.1); color:#ef4444; }
    .cc-info { display:flex; flex-direction:column; gap:8px; }
    .cc-row { display:flex; align-items:center; gap:10px; font-size:13px; color:var(--text); min-width:0; }
    .cc-row i { width:14px; text-align:center; color:var(--text-secondary); font-size:12px; flex-shrink:0; }
    .cc-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cc-row.cc-tel { font-weight:800; font-size:15px; }
    .cc-row.cc-muted { color:var(--text-secondary); font-size:12px; }
    .cc-rel { margin-left:auto; flex-shrink:0; font-size:10px; font-weight:700; color:var(--primary); background:rgba(0,245,212,0.1); padding:2px 8px; border-radius:999px; }
    .cc-foot { display:flex; align-items:center; gap:6px; padding-top:12px; border-top:1px solid var(--border); }
    .cc-ghost { height:36px; padding:0 12px; border-radius:10px; border:1px solid var(--border); background:transparent; color:var(--text-secondary); font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all .2s; position:relative; }
    .cc-ghost:hover { border-color:var(--primary); color:var(--primary); }
    .cc-dot { width:6px; height:6px; border-radius:50%; background:#ef4444; position:absolute; top:6px; right:6px; }
    .cc-accept { margin-left:auto; height:36px; padding:0 18px; border-radius:10px; border:none; background:var(--primary); color:#000; font-size:13px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:transform .15s, box-shadow .2s; }
    .cc-accept:hover { transform:translateY(-1px); box-shadow:0 6px 18px rgba(0,245,212,0.35); }
    @media (max-width: 420px) { .cc-ghost .cc-lbl { display:none; } }
  `;
  document.head.appendChild(st);
}

function buildFase1Card(p, index, puedeBorrar) {
  const nombre   = p.nombre    || 'Nombre no disponible';
  const tel      = p.telefono  || 'Sin número';
  const dir      = p.direccion || 'Sin dirección';
  const pipeline = p.pipeline  || '';
  const entrada  = fechaEntrada(p.fecha_creacion);
  const org      = origenDelLead(p);
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const detalle  = org.detalle && org.detalle.toLowerCase() !== org.label.toLowerCase() ? org.detalle : '';

  return `
    <div class="cc-p1-card" data-id="${p.id}" data-nombre="${encodeURIComponent(nombre)}" data-tel="${encodeURIComponent(tel)}" data-dir="${encodeURIComponent(dir)}"
         style="animation-delay:${Math.min(index, 12) * 0.04}s;">

      <div class="cc-head">
        <div class="cc-avatar">${escHtml(iniciales)}</div>
        <div style="flex:1;min-width:0;">
          <h3 class="cc-name" title="${escHtml(nombre)}">${escHtml(nombre)}</h3>
          <div class="cc-chips">
            <span class="cc-chip" style="color:${org.color};border-color:${org.color}33;background:${org.color}0f;" title="${escHtml(org.detalle || org.label)}">
              <i class="fa-solid ${org.icon}"></i> ${escHtml(org.label)}${detalle ? ` · ${escHtml(detalle)}` : ''}
            </span>
            ${pipeline ? `<span class="cc-chip"><i class="fa-solid fa-layer-group"></i> ${escHtml(pipeline)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <span class="cc-num">#${String(index + 1).padStart(2, '0')}</span>
          ${puedeBorrar ? `<button class="btn-p1-borrar cc-trash" data-id="${p.id}" title="Borrar lead"><i class="fa-solid fa-trash-can"></i></button>` : ''}
        </div>
      </div>

      <div class="cc-info">
        <div class="cc-row cc-tel"><i class="fa-solid fa-phone"></i><span>${escHtml(tel)}</span></div>
        <div class="cc-row" title="${escHtml(dir)}"><i class="fa-solid fa-location-dot"></i><span>${escHtml(dir)}</span></div>
        <div class="cc-row cc-muted">
          <i class="fa-regular fa-clock"></i>
          <span>${entrada ? `Entró el ${entrada.texto}` : 'Fecha de entrada no registrada'}</span>
          ${entrada ? `<span class="cc-rel">${entrada.rel}</span>` : ''}
        </div>
      </div>

      <div class="cc-foot">
        <button class="btn-cc-call cc-ghost" data-tel="${escHtml(tel)}" title="Llamar"><i class="fa-solid fa-phone"></i><span class="cc-lbl">Llamar</span></button>
        <button class="btn-cc-historial cc-ghost" data-id="${p.id}" title="Historial de llamadas"><i class="fa-solid fa-clock-rotate-left"></i><span class="cc-lbl">Historial</span></button>
        <button class="btn-cc-notas cc-ghost" data-id="${p.id}" data-notas="${encodeURIComponent(p.notas_pre || '')}" title="Notas"><i class="fa-regular fa-note-sticky"></i><span class="cc-lbl">Notas</span>${p.notas_pre ? '<span class="cc-dot"></span>' : ''}</button>
        <button class="btn-p1-aceptar cc-accept" data-id="${p.id}"><i class="fa-solid fa-check"></i> Aceptar</button>
      </div>
    </div>
  `;
}

async function handleFase1Click(screen, user, e) {
  // ── BORRAR (solo Admin / CEO) ─────────────────────────────
  const btnDel = e.target.closest('.btn-p1-borrar');
  if (btnDel) {
    const id   = btnDel.dataset.id;
    const pros = _ccState.prospectos.find(p => p.id === id);
    if (!puedeBorrarLeads(user) || !confirm(`¿Borrar el lead "${pros?.nombre || id}"? Esta acción no se puede deshacer.`)) {
      screen.addEventListener('click', handleFase1Click.bind(null, screen, user), { once: true });
      return;
    }
    try {
      const res = await fetch(`/api/cc-prospectos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Server error');
      _ccState.prospectos = _ccState.prospectos.filter(p => p.id !== id);
      showToast('Lead borrado', 'success');
      renderFase1(screen, user);
    } catch (err) {
      showToast('No se pudo borrar el lead', 'error');
      screen.addEventListener('click', handleFase1Click.bind(null, screen, user), { once: true });
    }
    return;
  }

  // ── ACEPTAR → Confirmar y pasar a Fase 2 ─────────────────
  const btnAcc = e.target.closest('.btn-p1-aceptar');
  if (btnAcc) {
    const id  = btnAcc.dataset.id;
    const pros = _ccState.prospectos.find(p => p.id === id);
    if (!pros) { screen.addEventListener('click', handleFase1Click.bind(null, screen, user), { once: true }); return; }

    _ccState.activeId = id;
    // Confirma la aceptación: estado pasa a 'pendiente' (activo)
    await patchProspecto(id, { accion: 'aceptar' });
    renderFase2(screen, user, { ...pros, estado: 'pendiente' });
    return;
  }

  // ── ZADARMA CALL ─────────────────────────────────────────
  const btnCall = e.target.closest('.btn-cc-call');
  if (btnCall) {
    const tel = btnCall.dataset.tel;
    if (window.adminZadarmaCall) {
        window.adminZadarmaCall(tel);
    } else if (window.zadarmaCall) {
        window.zadarmaCall(tel);
    } else {
        showToast('Zadarma API no cargada', 'error');
    }
    screen.addEventListener('click', handleFase1Click.bind(null, screen, user), { once: true });
    return;
  }

  // ── HISTORIAL DE LLAMADAS ────────────────────────────────
  const btnHist = e.target.closest('.btn-cc-historial');
  if (btnHist) {
    const id = btnHist.dataset.id;
    const oldHtml = btnHist.innerHTML;
    btnHist.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnHist.disabled = true;
    
    try {
        const res = await fetch(`/api/cc-prospectos/${id}`);
        if (res.ok) {
            const data = await res.json();
            if (window.showZadarmaHistory) window.showZadarmaHistory(data.historial_llamadas || []);
            else alert('No hay historial disponible');
        } else {
            showToast('Error al cargar historial', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    } finally {
        btnHist.innerHTML = oldHtml;
        btnHist.disabled = false;
        screen.addEventListener('click', handleFase1Click.bind(null, screen, user), { once: true });
    }
    return;
  }

  // ── NOTAS PRE-ACEPTACIÓN ─────────────────────────────────
  const btnNotas = e.target.closest('.btn-cc-notas');
  if (btnNotas) {
      const id = btnNotas.dataset.id;
      const currentNotes = decodeURIComponent(btnNotas.dataset.notas || '');
      
      const noteHtml = `
          <div id="modal-cc-pre-notas" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center transition-opacity duration-300 opacity-0">
              <div class="bg-[var(--bg)] w-full max-w-sm rounded-[2rem] shadow-2xl p-6 border border-[var(--border)] transform scale-95 transition-all duration-300">
                  <div class="flex justify-between items-center mb-4">
                      <h3 class="text-lg font-black text-[var(--text)]">Anotaciones del Lead</h3>
                      <button id="btn-close-cc-notas" class="w-8 h-8 rounded-full bg-[var(--surface)] text-gray-500 hover:text-red-500 flex justify-center items-center"><i class="fa-solid fa-xmark"></i></button>
                  </div>
                  <textarea id="inp-cc-pre-notas" rows="4" class="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text)] mb-4 outline-none focus:border-[var(--primary)]" placeholder="Ej. No contestó, Llamar mañana...">${currentNotes}</textarea>
                  <button id="btn-save-cc-notas" class="w-full py-3 bg-[var(--primary)] text-black rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all">Guardar Notas</button>
              </div>
          </div>
      `;
      document.body.insertAdjacentHTML('beforeend', noteHtml);
      const modal = document.getElementById('modal-cc-pre-notas');
      setTimeout(() => {
          modal.classList.remove('opacity-0');
          modal.querySelector('div').classList.remove('scale-95');
          document.getElementById('inp-cc-pre-notas').focus();
      }, 10);

      const closeModal = () => {
          modal.classList.add('opacity-0');
          modal.querySelector('div').classList.add('scale-95');
          setTimeout(() => modal.remove(), 300);
          screen.addEventListener('click', handleFase1Click.bind(null, screen, user), { once: true });
      };

      document.getElementById('btn-close-cc-notas').onclick = closeModal;
      document.getElementById('btn-save-cc-notas').onclick = async () => {
          const newNotes = document.getElementById('inp-cc-pre-notas').value.trim();
          const btn = document.getElementById('btn-save-cc-notas');
          btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
          btn.disabled = true;

          try {
              await patchProspecto(id, { notas_pre: newNotes });
              const pros = _ccState.prospectos.find(p => p.id === id);
              if (pros) pros.notas_pre = newNotes;
              showToast('Notas guardadas', 'success');
              modal.remove();
              renderFase1(screen, user);
          } catch (e) {
              showToast('Error al guardar notas', 'error');
              btn.innerHTML = 'Guardar Notas';
              btn.disabled = false;
          }
      };
      
      return;
  }

  screen.addEventListener('click', handleFase1Click.bind(null, screen, user), { once: true });
}

// ═══════════════════════════════════════════════════════════════
//  FASE 2: DATOS EXTRAS
// ═══════════════════════════════════════════════════════════════

function renderFase2(screen, user, prospecto) {
  _ccState.fase = 2;

  const db    = getDB();
  const pipes = (db.Admin_Pipelines || [])
    .filter(p => p.nombre !== 'Call Center' && p.nombre !== 'RRHH')
    .map(p => p.nombre);
    
  if (pipes.length > 0 && !pipes.includes('Renew Home')) {
    pipes.push('Renew Home');
  }

  const ecoOptions = pipes.length > 0
    ? pipes
    : ['Renew Solar', 'Renew Water', 'Renew Home'];

  const nombre = prospecto.nombre    || 'Prospecto';
  const tel    = prospecto.telefono  || '–';
  const dir    = prospecto.direccion || '–';

  screen.innerHTML = `
    <div style="background:var(--bg);min-height:100vh;display:flex;flex-direction:column;">

      <!-- HEADER FASE 2 -->
      <div style="background:var(--surface);padding:20px;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10;">
        <div style="display:flex;align-items:center;gap:12px;">
          <button id="btn-cc-back" title="Volver a la lista de prospectos" style="width:38px;height:38px;border-radius:50%;background:rgba(0,245,212,0.12);border:1.5px solid rgba(0,245,212,0.35);color:var(--primary);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;flex-shrink:0;transition:all 0.2s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <p style="font-size:9px;color:var(--primary);font-weight:800;text-transform:uppercase;letter-spacing:0.14em;margin:0;">FASE 2 · DATOS EXTRAS</p>
            <h1 style="font-size:17px;font-weight:900;color:var(--text);margin:0;line-height:1.2;">Aceptado – Completar Info</h1>
          </div>
        </div>

        <!-- Progress indicator -->
        <div style="display:flex;gap:6px;margin-top:14px;">
          <div style="flex:1;height:3px;background:var(--primary);border-radius:2px;"></div>
          <div style="flex:1;height:3px;background:var(--primary);border-radius:2px;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;">
          <span style="font-size:8px;font-weight:800;color:var(--primary);">Paso 2 de 2</span>
        </div>
      </div>

      <!-- CONTENT -->
      <div style="flex:1;padding:16px;overflow-y:auto;padding-bottom:40px;">

        <!-- Resumen del prospecto con opciones de Llamada e Historial -->
        <div style="background:rgba(0,245,212,0.04);border:1px solid rgba(0,245,212,0.15);border-radius:16px;padding:16px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;flex-wrap:wrap;">
            <div>
              <p style="font-size:9px;color:var(--primary);font-weight:800;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 4px;">Prospecto seleccionado</p>
              <p style="font-size:18px;font-weight:900;color:var(--text);margin:0 0 2px;">${nombre}</p>
            </div>
            <!-- Acciones de llamada e historial -->
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="btn-cc-call" data-tel="${tel}" style="background:rgba(0,245,212,0.15);color:var(--primary);border:1px solid rgba(0,245,212,0.3);border-radius:10px;padding:8px 14px;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s;">
                <i class="fa-solid fa-mobile-screen"></i> Llamar
              </button>
              <button class="btn-cc-historial" data-id="${prospecto.id}" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:8px 14px;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s;">
                <i class="fa-solid fa-headphones"></i> Historial
              </button>
            </div>
          </div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(0,245,212,0.1);">
            <span style="font-size:12px;color:var(--text);font-weight:700;"><i class="fa-solid fa-phone" style="color:var(--primary);margin-right:4px;"></i> ${tel}</span>
            <span style="font-size:12px;color:var(--text-secondary);"><i class="fa-solid fa-location-dot" style="margin-right:4px;"></i> ${dir}</span>
          </div>
        </div>

        <!-- Ecosistema -->
        <div style="margin-bottom:20px;">
          <label style="font-size:10px;font-weight:800;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.12em;display:block;margin-bottom:10px;">
            <i class="fa-solid fa-leaf"></i> Ecosistema de interés *
          </label>
          <div id="cc-eco-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
            ${ecoOptions.map(eco => `
              <button class="cc-eco-btn" data-eco="${eco}"
                      style="padding:16px 10px;background:var(--surface);border:2px solid var(--border);border-radius:16px;font-size:13px;font-weight:800;color:var(--text-secondary);cursor:pointer;transition:all 0.2s;text-align:center;">
                ${eco}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Notas extra -->
        <div style="margin-bottom:20px;">
          <label style="font-size:10px;font-weight:800;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.12em;display:block;margin-bottom:8px;">
            <i class="fa-solid fa-file-pen"></i> Notas Extra <span style="opacity:0.5;font-weight:600;">(opcional)</span>
          </label>
          <textarea id="cc-notas-input" rows="4" placeholder="Ej: Tiene panel viejo, interesado en financiamiento, llamar tarde..."
                    style="width:100%;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:14px;font-size:13px;color:var(--text-primary);resize:none;font-family:inherit;box-sizing:border-box;outline:none;transition:border-color 0.2s;"
                    onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">${prospecto.notas_pre || ''}</textarea>
        </div>

        <!-- Guardar como -->
        <div style="margin-bottom:16px;">
          <label style="font-size:10px;font-weight:800;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.12em;display:block;margin-bottom:10px;">
            <i class="fa-solid fa-user-check"></i> Guardar como *
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button class="cc-tipo-btn" data-tipo="prospecto"
                    style="padding:14px 10px;background:rgba(0,245,212,0.12);border:2px solid var(--primary);border-radius:16px;font-size:13px;font-weight:800;color:var(--primary);cursor:pointer;transition:all 0.2s;text-align:center;">
              <i class="fa-solid fa-user-clock"></i> Prospecto
              <span style="display:block;font-size:10px;font-weight:600;opacity:0.7;margin-top:4px;">Queda en Prospectos para seguimiento</span>
            </button>
            <button class="cc-tipo-btn" data-tipo="cliente"
                    style="padding:14px 10px;background:var(--surface);border:2px solid var(--border);border-radius:16px;font-size:13px;font-weight:800;color:var(--text-secondary);cursor:pointer;transition:all 0.2s;text-align:center;">
              <i class="fa-solid fa-user-tie"></i> Cliente
              <span style="display:block;font-size:10px;font-weight:600;opacity:0.7;margin-top:4px;">Abre su proyecto en el ecosistema</span>
            </button>
          </div>
        </div>

        <button id="btn-cc-finalizar"
                style="width:100%;padding:17px;background:rgba(0,245,212,0.3);color:var(--text);border:none;border-radius:16px;font-size:15px;font-weight:900;cursor:pointer;opacity:0.45;pointer-events:none;transition:all 0.2s;" disabled>
          <i class="fa-solid fa-bolt"></i> Guardar como Prospecto
        </button>
        <p style="text-align:center;font-size:10px;color:var(--text-secondary);margin:8px 0 0;">Elige el ecosistema y si se guarda como prospecto o cliente</p>
      </div>

    </div>
  `;

  // Events for Fase 2
  let selectedEco = null;
  let selectedTipo = 'prospecto';
  const etiquetaGuardar = () => `<i class="fa-solid fa-bolt"></i> Guardar como ${selectedTipo === 'cliente' ? 'Cliente' : 'Prospecto'}`;

  if (screen._fase2Handler) {
    screen.removeEventListener('click', screen._fase2Handler);
  }

  screen._fase2Handler = async (e) => {
    // Back button — vuelve a pendiente sin reasignar
    if (e.target.closest('#btn-cc-back')) {
      const idx = _ccState.prospectos.findIndex(p => p.id === prospecto.id);
      if (idx === -1) _ccState.prospectos.unshift(prospecto);
      renderFase1(screen, user);
      return;
    }

    // Call via Zadarma
    const btnCall = e.target.closest('.btn-cc-call');
    if (btnCall) {
      const tel = btnCall.dataset.tel;
      if (window.adminZadarmaCall) {
        window.adminZadarmaCall(tel);
      } else if (window.zadarmaCall) {
        window.zadarmaCall(tel);
      } else {
        showToast('Zadarma API no cargada', 'error');
      }
      return;
    }

    // Call history
    const btnHist = e.target.closest('.btn-cc-historial');
    if (btnHist) {
      const id = btnHist.dataset.id;
      const oldHtml = btnHist.innerHTML;
      btnHist.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      btnHist.disabled = true;
      try {
        const res = await fetch(`/api/cc-prospectos/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (window.showZadarmaHistory) window.showZadarmaHistory(data.historial_llamadas || []);
          else alert('No hay historial disponible');
        } else {
          showToast('Error al cargar historial', 'error');
        }
      } catch (err) {
        showToast('Error de conexión', 'error');
      } finally {
        btnHist.innerHTML = oldHtml;
        btnHist.disabled = false;
      }
      return;
    }

    // Prospecto / Cliente
    const tipoBtn = e.target.closest('.cc-tipo-btn');
    if (tipoBtn) {
      selectedTipo = tipoBtn.dataset.tipo;
      screen.querySelectorAll('.cc-tipo-btn').forEach(b => {
        const on = b === tipoBtn;
        b.style.background  = on ? 'rgba(0,245,212,0.12)' : 'var(--surface)';
        b.style.borderColor = on ? 'var(--primary)' : 'var(--border)';
        b.style.color       = on ? 'var(--primary)' : 'var(--text-secondary)';
      });
      const btnF = document.getElementById('btn-cc-finalizar');
      if (btnF) btnF.innerHTML = etiquetaGuardar();
      return;
    }

    // Ecosystem selection
    const ecoBtn = e.target.closest('.cc-eco-btn');
    if (ecoBtn) {
      selectedEco = ecoBtn.dataset.eco;
      screen.querySelectorAll('.cc-eco-btn').forEach(b => {
        b.style.background   = 'var(--surface)';
        b.style.borderColor  = 'var(--border)';
        b.style.color        = 'var(--text-secondary)';
      });
      ecoBtn.style.background  = 'rgba(0,245,212,0.12)';
      ecoBtn.style.borderColor = 'var(--primary)';
      ecoBtn.style.color       = 'var(--primary)';

      const btnF = document.getElementById('btn-cc-finalizar');
      if (btnF) { btnF.disabled = false; btnF.style.opacity = '1'; btnF.style.pointerEvents = 'auto'; btnF.style.background = 'var(--primary)'; btnF.style.color = 'black'; }
      return;
    }

    // Finalizar
    if (e.target.closest('#btn-cc-finalizar')) {
      if (!selectedEco) return;
      const notas   = document.getElementById('cc-notas-input')?.value?.trim() || null;
      const btnF    = document.getElementById('btn-cc-finalizar');
      if (btnF) { btnF.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...'; btnF.disabled = true; }

      try {
        await patchProspecto(prospecto.id, {
          estado:    'aceptado',
          ecosistema: selectedEco,
          operador_id: user.id,
          operador_nombre: `${user.nombre || ''} ${user.apellido || ''}`.trim(),
          fecha_gestion: new Date().toISOString()
        });

        const { cliente, vendedor, proyecto } = await crearLeadEnCRM(prospecto, selectedEco, notas, user, selectedTipo);

        // Remove from prospectos list
        _ccState.prospectos = _ccState.prospectos.filter(p => p.id !== prospecto.id);

        if (selectedTipo === 'cliente' && !proyecto) {
          showToast(`Guardado como prospecto: no hay pipeline "${selectedEco}" para abrir el proyecto`, 'info');
        } else {
          showToast(`<i class="fa-solid fa-check text-green-500"></i> Guardado como ${proyecto ? 'cliente' : 'prospecto'}`, 'success');
        }

        // Show success screen then go back to Fase 1
        renderSuccessScreen(screen, user, cliente, vendedor, !!proyecto);
      } catch (err) {
        console.error('[CC Finalizar Error]', err);
        showToast('Error al guardar el lead', 'error');
        if (btnF) { btnF.innerHTML = etiquetaGuardar(); btnF.disabled = false; }
      }
    }
  };

  screen.addEventListener('click', screen._fase2Handler);
}

// ═══════════════════════════════════════════════════════════════
//  SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════

function renderSuccessScreen(screen, user, cliente, vendedor, comoCliente = false) {
  const remaining = _ccState.prospectos.length;

  screen.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:32px;text-align:center;background:var(--bg);">
      <div style="width:80px;height:80px;border-radius:50%;background:rgba(0,245,212,0.12);display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:20px;animation:bounceIn 0.5s ease;"><i class="fa-solid fa-check text-green-500"></i></div>
      <p style="font-size:10px;color:var(--primary);font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 6px;">${comoCliente ? 'Cliente creado' : 'Prospecto guardado'}</p>
      <h2 style="font-size:22px;font-weight:900;color:var(--text);margin:0 0 8px;">${cliente.nombre}</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin:0 0 24px;">Ecosistema: <strong style="color:var(--primary);">${cliente.empresa}</strong></p>

      <!-- Vendedor asignado -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px 24px;margin-bottom:24px;width:100%;max-width:300px;box-sizing:border-box;">
        <p style="font-size:9px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;margin:0 0 6px;">Asignación de Vendedor</p>
        <p style="font-size:13px;color:var(--primary);margin:0;font-weight:700;">${comoCliente ? 'Proyecto abierto a tu nombre. Administración fue notificada.' : 'Notificación enviada a Administración para su asignación manual.'}</p>
      </div>

      <!-- Siguiente -->
      ${remaining > 0
        ? `<button id="btn-cc-next" style="padding:16px 32px;background:var(--primary);border:none;border-radius:16px;font-size:14px;font-weight:900;color:black;cursor:pointer;margin-bottom:12px;">
             Siguiente prospecto (${remaining}) →
           </button>`
        : `<div style="background:rgba(0,245,212,0.06);border:1px solid rgba(0,245,212,0.15);border-radius:16px;padding:16px 24px;margin-bottom:12px;">
             <p style="font-size:13px;color:var(--text-secondary);margin:0;"><i class="fa-solid fa-champagne-glasses"></i> ¡Completaste todos los prospectos del día!</p>
           </div>`}
      <button id="btn-cc-golist" style="padding:14px 24px;background:transparent;border:1.5px solid var(--border);border-radius:14px;font-size:13px;font-weight:700;color:var(--text-secondary);cursor:pointer;">
        Ver lista
      </button>
    </div>
  `;

  screen.querySelector('#btn-cc-next')?.addEventListener('click', () => renderFase1(screen, user));
  screen.querySelector('#btn-cc-golist')?.addEventListener('click', () => renderFase1(screen, user));
}

// ── LOADING SKELETON ─────────────────────────────────────────

function buildLoadingSkeleton() {
  return `
    <div style="background:var(--bg);min-height:100vh;">
      <div style="background:var(--surface);padding:20px;border-bottom:1px solid var(--border);">
        <div class="skeleton" style="height:14px;width:120px;border-radius:6px;margin-bottom:8px;"></div>
        <div class="skeleton" style="height:22px;width:200px;border-radius:6px;margin-bottom:14px;"></div>
        <div class="skeleton" style="height:36px;border-radius:10px;"></div>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:14px;">
        ${[1,2,3].map(() => `
          <div class="skeleton" style="height:180px;border-radius:20px;"></div>
        `).join('')}
      </div>
    </div>
  `;
}
