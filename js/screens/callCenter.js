/* ============================================================
   RENEW – screens/callCenter.js
   Pantalla Call Center – Flujo 2 Fases
   Fase 1: Recolección → Aceptado / Rechazado (con tracking)
   Fase 2: Datos Extras → Ecosistema + Notas → Lead en CRM
   ============================================================ */
import { getDB, saveDB, getAdminWorkers } from '../api.js';
import { showToast } from '../components/toast.js';
import { getCurrentUser } from '../app.js';

// ── STATE ────────────────────────────────────────────────────
let _ccState = {
  fase:        1,           // 1 = Recolección, 2 = Datos Extras
  prospectos:  [],
  rechazados:  [],
  activeId:    null,        // prospecto actual en Fase 2
};

// ── API HELPERS ──────────────────────────────────────────────

async function getProspectos(operadorId) {
  try {
    const url = operadorId
      ? `/api/cc-prospectos?operador_id=${encodeURIComponent(operadorId)}`
      : '/api/cc-prospectos';
    const res = await fetch(url);
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

async function crearLeadEnCRM(prospecto, ecosistema, notas, operador) {
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
    fecha:                    new Date().toISOString(),
    origen_tipo:              'call_center',
    origen_nombre:            `${operador.nombre || ''} ${operador.apellido || ''}`.trim(),
    origen_id:                operador.id,
    vendedor_asignado_id:     null,
    vendedor_asignado_nombre: null,
    origen_lead_cc:           prospecto.origen || null
  };


  if (!db.Clientes_Maestro) db.Clientes_Maestro = [];
  db.Clientes_Maestro.push(newCliente);
  await saveDB(db);

  // Send webhook
  try {
    const asignacionUrl = `${window.location.origin}/admin.html#crmDetail?id=${newCliente.id}`;
    await fetch('https://n8n.renewgroup.site/webhook/aviso-nuevo-lead-call-center', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: newCliente,
        link_asignacion: asignacionUrl
      })
    });
  } catch (error) {
    console.warn('[Webhook Error] Error notificando a admin:', error);
  }

  return { cliente: newCliente, vendedor: null };
}

// ── MAIN RENDER ──────────────────────────────────────────────

export async function renderCallCenter() {
  const user   = getCurrentUser();
  const screen = document.getElementById('screen-call-center');
  if (!screen) return;

  // Reset state
  _ccState = { fase: 1, prospectos: [], rechazados: [], activeId: null };

  // Loading skeleton
  screen.innerHTML = buildLoadingSkeleton();

  // Fetch leads assigned to this operator (Admins can see all)
  const isAdmin = user.rol === 'Admin' || user.rol === 'admin';
  const operador_query = isAdmin ? null : user.id;
  const todos      = await getProspectos(operador_query);
  
  // Nuevos estados del algoritmo
  _ccState.prospectos  = todos.filter(p => ['pendiente','confirmacion_pendiente'].includes(p.estado) || !p.estado);
  _ccState.rechazados  = todos.filter(p => p.estado === 'rechazado');
  _ccState.enEspera    = todos.filter(p => p.estado === 'en_espera');

  renderFase1(screen, user);
}

// ═══════════════════════════════════════════════════════════════
//  FASE 1: RECOLECCIÓN
// ═══════════════════════════════════════════════════════════════

function renderFase1(screen, user) {
  _ccState.fase    = 1;
  _ccState.activeId = null;
  const pendientes = _ccState.prospectos;
  const rechazados = _ccState.rechazados;

  const fecha  = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const total  = pendientes.length;
  const rej    = rechazados.length;
  const total2 = total + rej;
  const pct    = total2 > 0 ? Math.round(((total2 - rej) / total2) * 100) : 0;

  const cards = pendientes.length > 0
    ? pendientes.map((p, i) => buildFase1Card(p, i)).join('')
    : `<div style="text-align:center;padding:60px 24px;opacity:0.5;">
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

        <!-- Conversion rate bar -->
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border-radius:12px;border:1px solid var(--border);">
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:9px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;">Tasa de aceptación</span>
              <span style="font-size:9px;color:var(--primary);font-weight:900;">${pct}%</span>
            </div>
            <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:2px;transition:width 0.5s;"></div>
            </div>
          </div>
          <div style="text-align:right;">
            <p style="font-size:9px;font-weight:800;color:#ef4444;margin:0;">${rej} rechazados</p>
          </div>
        </div>
        <p style="font-size:10px;color:var(--text-secondary);margin:8px 0 0;text-transform:capitalize;">${fecha} · Hola, ${user.nombre} <i class="fa-solid fa-handshake"></i></p>
      </div>

      <!-- CARDS -->
      <div id="cc-phase1-list" style="padding:16px;display:flex;flex-direction:column;gap:14px;">
        ${cards}
      </div>
    </div>
  `;

  // EVENTS
  screen.onclick = (e) => handleFase1Click(screen, user, e);
  startCountdownTick(screen);
}

function buildFase1Card(p, index) {
  const nombre  = p.nombre    || 'Nombre no disponible';
  const tel     = p.telefono  || 'Sin número';
  const dir     = p.direccion || 'Sin dirección';
  const fuente  = p.fuente    || 'scraper';
  const pipeline = p.pipeline || '';
  const hora    = p.fecha_creacion
    ? new Date(p.fecha_creacion).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '';

  // Countdown para confirmacion_pendiente
  const isPending = p.estado === 'confirmacion_pendiente';
  const expiresAt = p.fecha_expiracion ? new Date(p.fecha_expiracion).getTime() : null;
  const secsLeft  = expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : null;
  const timerBadge = isPending && secsLeft !== null
    ? `<div class="cc-countdown" data-id="${p.id}" data-expires="${expiresAt}"
            style="display:inline-flex;align-items:center;gap:5px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:3px 10px;margin-bottom:8px;">
         <span style="font-size:10px;">⏱</span>
         <span class="cc-timer-val" style="font-size:10px;font-weight:900;color:#f59e0b;">Confirmar en <b>${secsLeft}s</b></span>
       </div>`
    : '';

  const fuenteBadge = `<span style="display:inline-block;background:rgba(0,245,212,0.08);color:var(--primary);border:1px solid rgba(0,245,212,0.2);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;padding:3px 8px;border-radius:6px;margin-bottom:6px;margin-right:6px;">${fuente.toUpperCase()}</span>`;
  const origenBadge = p.origen ? `<span style="display:inline-block;background:rgba(245,158,11,0.08);color:#f59e0b;border:1px solid rgba(245,158,11,0.2);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;padding:3px 8px;border-radius:6px;margin-bottom:6px;margin-right:6px;">${p.origen.toUpperCase()}</span>` : '';
  const pipBadge   = pipeline ? `<span style="display:inline-block;background:rgba(139,92,246,0.1);color:#8b5cf6;border:1px solid rgba(139,92,246,0.2);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;padding:3px 8px;border-radius:6px;margin-bottom:6px;">${pipeline}</span>` : '';

  return `
    <div class="cc-p1-card" data-id="${p.id}" data-nombre="${encodeURIComponent(nombre)}" data-tel="${encodeURIComponent(tel)}" data-dir="${encodeURIComponent(dir)}"
         style="background:var(--surface);border:1px solid ${isPending ? 'rgba(245,158,11,0.4)' : 'var(--border)'};border-radius:20px;padding:18px;position:relative;overflow:hidden;animation:fadeInUp 0.3s ease ${index * 0.06}s both;">

      <div style="position:absolute;top:14px;right:14px;background:rgba(0,245,212,0.08);border:1px solid rgba(0,245,212,0.18);border-radius:8px;padding:3px 10px;">
        <span style="font-size:9px;font-weight:900;color:var(--primary);">#${String(index+1).padStart(2,'0')}</span>
      </div>

      ${timerBadge}
      <div style="margin-bottom:6px;">${fuenteBadge}${origenBadge}${pipBadge}</div>
      <h3 style="font-size:19px;font-weight:900;color:var(--text);margin:0 0 14px;line-height:1.2;">${nombre}</h3>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg);border-radius:12px;border:1px solid var(--border);">
          <span style="font-size:15px;"><i class="fa-solid fa-phone"></i></span>
          <div style="flex:1;">
            <p style="font-size:9px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;margin:0;">Teléfono</p>
            <p style="font-size:14px;font-weight:800;color:var(--text);margin:0;">${tel}</p>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
              <button class="btn-cc-call" data-tel="${tel}" style="background:rgba(0,245,212,0.1);color:var(--primary);border:none;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:4px;"><i class="fa-solid fa-mobile-screen"></i> Llamar</button>
              <button class="btn-cc-historial" data-id="${p.id}" style="background:rgba(245,158,11,0.1);color:#f59e0b;border:none;border-radius:8px;padding:6px 10px;font-size:10px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:4px;"><i class="fa-solid fa-headphones"></i> Historial</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg);border-radius:12px;border:1px solid var(--border);">
          <span style="font-size:15px;"><i class="fa-solid fa-location-dot"></i></span>
          <div style="overflow:hidden;">
            <p style="font-size:9px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;margin:0;">Dirección</p>
            <p style="font-size:12px;font-weight:700;color:var(--text);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${dir}</p>
          </div>
        </div>
        ${hora ? `<p style="font-size:9px;color:var(--text-secondary);padding:0 2px;margin:0;">Recibido a las ${hora}</p>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button class="btn-p1-rechazar" data-id="${p.id}"
                style="padding:14px;background:rgba(239,68,68,0.07);border:1.5px solid rgba(239,68,68,0.25);border-radius:14px;color:#ef4444;font-size:13px;font-weight:800;cursor:pointer;">
          <i class="fa-solid fa-xmark text-red-500"></i> Rechazar
        </button>
        <button class="btn-p1-aceptar" data-id="${p.id}"
                style="padding:14px;background:var(--primary);border:none;border-radius:14px;color:black;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 16px rgba(0,245,212,0.3);">
          <i class="fa-solid fa-check text-green-500"></i> Aceptar
        </button>
      </div>
    </div>
  `;
}

// Tick global de contadores (actualiza cada segundo)
function startCountdownTick(screen) {
  if (screen._ccTickInterval) clearInterval(screen._ccTickInterval);
  screen._ccTickInterval = setInterval(() => {
    screen.querySelectorAll('.cc-countdown').forEach(el => {
      const exp     = parseInt(el.dataset.expires);
      const secsLeft = Math.max(0, Math.round((exp - Date.now()) / 1000));
      const valEl   = el.querySelector('.cc-timer-val');
      if (valEl) valEl.innerHTML = `Confirmar en <b>${secsLeft}s</b>`;
      if (secsLeft === 0) {
        // Timeout — rechazar automáticamente via el servidor
        const id = el.dataset.id;
        fetch(`/api/cc-prospectos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'timeout' })
        });
        const card = screen.querySelector(`.cc-p1-card[data-id="${id}"]`);
        if (card) { card.style.opacity = '0.3'; card.style.pointerEvents = 'none'; }
        el.innerHTML = '<span style="font-size:10px;color:#ef4444;">⏰ Tiempo agotado — reasignado</span>';
        setTimeout(() => card?.remove(), 2000);
      }
    });
  }, 1000);
}

async function handleFase1Click(screen, user, e) {
  // ── RECHAZAR ──────────────────────────────────────────────
  const btnRej = e.target.closest('.btn-p1-rechazar');
  if (btnRej) {
    const id   = btnRej.dataset.id;
    const card = screen.querySelector(`.cc-p1-card[data-id="${id}"]`);
    if (card) {
      card.style.transition = 'all 0.3s';
      card.style.opacity    = '0';
      card.style.transform  = 'translateX(-110px)';
      setTimeout(() => card.remove(), 310);
    }
    // Usa la nueva firma: accion:'rechazar' → el servidor busca siguiente agente
    await patchProspecto(id, { accion: 'rechazar' });
    const pros = _ccState.prospectos.find(p => p.id === id);
    if (pros) {
      _ccState.rechazados.push({ ...pros, estado: 'rechazado' });
      _ccState.prospectos = _ccState.prospectos.filter(p => p.id !== id);
    }
    updateConversionBar(screen, _ccState.prospectos.length, _ccState.rechazados.length);
    showToast('Lead rechazado — buscando siguiente agente...', 'info');
    screen.addEventListener('click', handleFase1Click.bind(null, screen, user), { once: true });
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

  screen.addEventListener('click', handleFase1Click.bind(null, screen, user), { once: true });
}

function updateConversionBar(screen, pendientes, rechazados) {
  const total = pendientes + rechazados;
  const pct   = total > 0 ? Math.round(((total - rechazados) / total) * 100) : 0;
  const barEl = screen.querySelector('[data-conv-bar]');
  const pctEl = screen.querySelector('[data-conv-pct]');
  const rejEl = screen.querySelector('[data-conv-rej]');
  const cntEl = screen.querySelector('[data-conv-cnt]');
  if (barEl) barEl.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (rejEl) rejEl.textContent = rechazados + ' rechazados';
  if (cntEl) cntEl.textContent = pendientes;
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
          <button id="btn-cc-back" style="width:36px;height:36px;border-radius:50%;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;flex-shrink:0;">←</button>
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
      <div style="flex:1;padding:16px;overflow-y:auto;padding-bottom:140px;">

        <!-- Resumen del prospecto -->
        <div style="background:rgba(0,245,212,0.04);border:1px solid rgba(0,245,212,0.15);border-radius:16px;padding:16px;margin-bottom:20px;">
          <p style="font-size:9px;color:var(--primary);font-weight:800;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 8px;">Prospecto seleccionado</p>
          <p style="font-size:17px;font-weight:900;color:var(--text);margin:0 0 6px;">${nombre}</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <span style="font-size:11px;color:var(--text-secondary);"><i class="fa-solid fa-phone"></i> ${tel}</span>
            <span style="font-size:11px;color:var(--text-secondary);"><i class="fa-solid fa-location-dot"></i> ${dir}</span>
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
                    onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'"></textarea>
        </div>
      </div>

      <!-- FIXED BOTTOM BUTTON -->
      <div style="position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);padding:16px 20px;z-index:20;">
        <button id="btn-cc-finalizar"
                style="width:100%;padding:17px;background:rgba(0,245,212,0.3);color:var(--text);border:none;border-radius:16px;font-size:15px;font-weight:900;cursor:pointer;opacity:0.45;pointer-events:none;transition:all 0.2s;" disabled>
          <i class="fa-solid fa-bolt"></i> Guardar Lead y Notificar Administración
        </button>
        <p style="text-align:center;font-size:10px;color:var(--text-secondary);margin:8px 0 0;">El lead se notificará a administración para asignación manual</p>
      </div>
    </div>
  `;

  // Events for Fase 2
  let selectedEco = null;

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
    if (e.target.id === 'btn-cc-finalizar') {
      if (!selectedEco) return;
      const notas   = document.getElementById('cc-notas-input')?.value?.trim() || null;
      const btnF    = document.getElementById('btn-cc-finalizar');
      if (btnF) { btnF.textContent = '⏳ Guardando...'; btnF.disabled = true; }

      try {
        await patchProspecto(prospecto.id, {
          estado:    'aceptado',
          ecosistema: selectedEco,
          fecha_gestion: new Date().toISOString()
        });

        const { cliente, vendedor } = await crearLeadEnCRM(prospecto, selectedEco, notas, user);

        // Remove from prospectos list
        _ccState.prospectos = _ccState.prospectos.filter(p => p.id !== prospecto.id);

        const vendMsg = 'Pendiente de asignación manual';

        showToast(`<i class="fa-solid fa-check text-green-500"></i> Lead guardado · ${vendMsg}`, 'success');

        // Show success screen then go back to Fase 1
        renderSuccessScreen(screen, user, cliente, vendedor);
      } catch (err) {
        console.error('[CC Finalizar Error]', err);
        showToast('Error al guardar el lead', 'error');
        if (btnF) { btnF.textContent = '<i class="fa-solid fa-bolt"></i> Guardar Lead y Notificar Administración'; btnF.disabled = false; }
      }
    }
  };

  screen.addEventListener('click', screen._fase2Handler);
}

// ═══════════════════════════════════════════════════════════════
//  SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════

function renderSuccessScreen(screen, user, cliente, vendedor) {
  const remaining = _ccState.prospectos.length;

  screen.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:32px;text-align:center;background:var(--bg);">
      <div style="width:80px;height:80px;border-radius:50%;background:rgba(0,245,212,0.12);display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:20px;animation:bounceIn 0.5s ease;"><i class="fa-solid fa-check text-green-500"></i></div>
      <p style="font-size:10px;color:var(--primary);font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 6px;">Lead Guardado</p>
      <h2 style="font-size:22px;font-weight:900;color:var(--text);margin:0 0 8px;">${cliente.nombre}</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin:0 0 24px;">Ecosistema: <strong style="color:var(--primary);">${cliente.empresa}</strong></p>

      <!-- Vendedor asignado -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px 24px;margin-bottom:24px;width:100%;max-width:300px;box-sizing:border-box;">
        <p style="font-size:9px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;margin:0 0 6px;">Asignación de Vendedor</p>
        <p style="font-size:13px;color:var(--primary);margin:0;font-weight:700;">Notificación enviada a Administración para su asignación manual.</p>
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
