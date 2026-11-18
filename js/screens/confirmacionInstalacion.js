/* ============================================================
   RENEW OS – confirmacionInstalacion.js
   Formulario: Confirmación de Instalación (Renew Water)
   ============================================================ */
import { getCurrentUser, getDB } from '../api.js';
import { showToast } from '../components/toast.js';

let sigCanvas, sigCtx, sigDrawing = false;

export function renderConfirmacionInstalacion(param = null) {
  const screen = document.getElementById('screen-confirmacion-instalacion');
  if (!screen) return;

  screen.innerHTML = `
  <style>
    .ci-body { padding:20px;display:flex;flex-direction:column;gap:20px;padding-bottom:20px; }
    .ci-section { background:var(--surface);border:1px solid var(--border);border-radius:20px;overflow:hidden; }
    .ci-section-hdr { padding:16px 20px;display:flex;align-items:center;gap:12px; }
    .ci-section-icon { width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0; }
    .ci-section-body { padding:0 20px 20px; }
    .ci-field { margin-bottom:14px; }
    .ci-label { font-size:.7rem;font-weight:800;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;display:block; }
    .ci-input { width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:12px;background:var(--surface-alt);color:var(--text-primary);font-family:inherit;font-size:.9rem;outline:none;transition:.2s; }
    .ci-input:focus { border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.12); }
    .ci-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
    .ci-grid.thirds { grid-template-columns:1fr 1fr 1fr; }
    .ci-radios { display:flex;gap:10px;flex-wrap:wrap; }
    .ci-radio-btn { flex:1;min-width:70px;padding:10px;border:1.5px solid var(--border);border-radius:10px;text-align:center;cursor:pointer;font-size:.75rem;font-weight:700;color:var(--text-secondary);transition:.2s;user-select:none; }
    .ci-radio-btn.active-yes { border-color:#22c55e;background:rgba(34,197,94,.08);color:#22c55e; }
    .ci-radio-btn.active-no  { border-color:#ef4444;background:rgba(239,68,68,.08);color:#ef4444; }
    .ci-check-row { display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border); }
    .ci-check-row:last-child { border-bottom:none; }
    .ci-checkbox { width:22px;height:22px;border:2px solid var(--border);border-radius:6px;background:var(--surface-alt);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:.2s;font-size:.85rem; }
    .ci-checkbox.checked { background:#0ea5e9;border-color:#0ea5e9;color:#fff; }
    .ci-check-label { flex:1;font-size:.85rem;font-weight:600;color:var(--text-primary); }
    .sig-wrapper { border:2px dashed var(--border);border-radius:16px;overflow:hidden;position:relative;background:#fff; }
    .sig-canvas { display:block;width:100%;height:140px;touch-action:none; }
    .sig-clear { position:absolute;top:8px;right:10px;background:rgba(239,68,68,.1);border:none;color:#ef4444;font-size:.7rem;font-weight:800;padding:4px 10px;border-radius:6px;cursor:pointer; }
    .ci-notice { display:flex;gap:12px;padding:14px 16px;border-radius:14px;border:1px solid rgba(14,165,233,.28);border-left:4px solid #0ea5e9;background:rgba(14,165,233,.07);margin-top:6px; }
    .ci-notice.important { border-color:rgba(245,158,11,.35);border-left-color:#f59e0b;background:rgba(245,158,11,.08); }
    .ci-notice-icon { width:32px;height:32px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(14,165,233,.15);color:#0ea5e9;font-size:.9rem; }
    .ci-notice.important .ci-notice-icon { background:rgba(245,158,11,.18);color:#d97706; }
    .ci-notice-title { font-size:.68rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--text-primary);margin-bottom:4px; }
    .ci-notice p { margin:0;font-size:.82rem;line-height:1.5;color:var(--text-primary);font-weight:600; }
    .ci-notice p.en { margin-top:6px;font-size:.74rem;font-weight:500;color:var(--text-secondary);font-style:italic; }
    .ci-submit { position:fixed;bottom:70px;left:0;right:0;padding:16px;background:var(--surface);border-top:1px solid var(--border);z-index:99; }
    .ci-btn-submit { width:100%;padding:16px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;border:none;border-radius:16px;font-size:1rem;font-weight:800;cursor:pointer;transition:.2s;display:flex;align-items:center;justify-content:center;gap:8px; }
    .ci-btn-submit:active { transform:scale(.97); }
    .ci-btn-submit:disabled { opacity:.6;pointer-events:none; }
    @media (max-width:360px) { .ci-grid { grid-template-columns:1fr; } }
  </style>

  <!-- Header -->
  <div class="tpl-header">
    <button class="tpl-back" onclick="window.appNavigate('plantillas')" title="Volver a Plantillas">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
    </button>
    <div>
      <h2 class="tpl-title">Confirmación de Instalación</h2>
      <p class="tpl-sub">Renew Water</p>
    </div>
  </div>

  <div class="tpl-banner">
    <div class="tpl-banner-inner">
      <img src="FORMULARIO-RENEW-WATER-main/assets/images/logo.png" alt="Renew Water">
      <div>
        <h1>RENEW WATER</h1>
        <p>Portal Comercial &amp; Contratos</p>
      </div>
    </div>
  </div>

  <div class="ci-body">

    <!-- Datos del Cliente -->
    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(14,165,233,.1);"><i class="fa-solid fa-receipt"></i></div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Datos del Cliente</div>
          <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;">Purchaser Information</div>
        </div>
      </div>
      <div class="ci-section-body">
        <div class="ci-grid">
          <div class="ci-field">
            <label class="ci-label">Fecha <span style="color:#ef4444">*</span></label>
            <input class="ci-input" type="text" id="ci-fecha" placeholder="MM/DD/YYYY">
          </div>
          <div class="ci-field">
            <label class="ci-label">Teléfono <span style="color:#ef4444">*</span></label>
            <input class="ci-input" type="tel" id="ci-telefono" placeholder="(555) 000-0000">
          </div>
        </div>
        <div class="ci-field">
          <label class="ci-label">Nombre Completo (Purchaser) <span style="color:#ef4444">*</span></label>
          <input class="ci-input" type="text" id="ci-comprador" placeholder="Nombre del comprador">
        </div>
        <div class="ci-field">
          <label class="ci-label">Email</label>
          <input class="ci-input" type="email" id="ci-email" placeholder="correo@ejemplo.com">
        </div>
        <div class="ci-field">
          <label class="ci-label">Dirección <span style="color:#ef4444">*</span></label>
          <input class="ci-input" type="text" id="ci-direccion" placeholder="Calle y número">
        </div>
        <div class="ci-grid thirds">
          <div class="ci-field">
            <label class="ci-label">Ciudad</label>
            <input class="ci-input" type="text" id="ci-ciudad" placeholder="City">
          </div>
          <div class="ci-field">
            <label class="ci-label">Estado</label>
            <input class="ci-input" type="text" id="ci-estado" placeholder="FL" maxlength="2" style="text-transform:uppercase">
          </div>
          <div class="ci-field">
            <label class="ci-label">Zip</label>
            <input class="ci-input" type="text" id="ci-zip" placeholder="00000" maxlength="10">
          </div>
        </div>
      </div>
    </div>

    <!-- Instalación -->
    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(20,184,166,.1);"><i class="fa-solid fa-wrench"></i></div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Detalles de Instalación</div>
        </div>
      </div>
      <div class="ci-section-body">
        <div class="ci-grid">
          <div class="ci-field">
            <label class="ci-label">Fecha de Instalación <span style="color:#ef4444">*</span></label>
            <input class="ci-input" type="text" id="ci-fecha-instalacion" placeholder="MM/DD/YYYY">
          </div>
          <div class="ci-field">
            <label class="ci-label">Instalador <span style="color:#ef4444">*</span></label>
            <input class="ci-input" type="text" id="ci-instalador" placeholder="Nombre del técnico">
          </div>
        </div>
        <div class="ci-field">
          <label class="ci-label">Representante de Ventas</label>
          <input class="ci-input" type="text" id="ci-rep-ventas" placeholder="Nombre del vendedor">
        </div>
        <div class="ci-notice">
          <div class="ci-notice-icon"><i class="fa-solid fa-location-dot"></i></div>
          <div>
            <div class="ci-notice-title">Ubicación del equipo</div>
            <p>El lugar de instalación del equipo de tratamiento de agua va a ser determinado por el personal de instalación de RENEW WATER y el comprador(es), en la mejor localización posible.</p>
            <p class="en">The placement of the water treatment equipment is to be determined by RENEW WATER installation personnel and purchaser(s), as to the best possible location.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmaciones (Sí/No) -->
    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(168,85,247,.1);"><i class="fa-solid fa-check text-green-500"></i></div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Confirmaciones</div>
          <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;">Responder Sí / No + Iniciales</div>
        </div>
      </div>
      <div class="ci-section-body">

        <div class="ci-field">
          <label class="ci-label">El cliente confirma que:</label>
          <ol style="margin:4px 0 10px 18px;padding:0;font-size:.8rem;color:var(--text-secondary);line-height:1.5;">
            <li>Se le enseñó a programar el cabezal (pantalla L.E.D.)</li>
            <li>Está de acuerdo con el lugar donde se instaló el sistema</li>
            <li>Se le informó cómo proteger el sistema en caso de congelamiento</li>
          </ol>
          <div style="display:flex;gap:8px;align-items:center;">
            <div class="ci-radio-btn" data-group="confirmacion_cliente" data-val="si" onclick="window.ciPickRadio(this)"><i class="fa-solid fa-check text-green-500"></i> Sí</div>
            <div class="ci-radio-btn" data-group="confirmacion_cliente" data-val="no" onclick="window.ciPickRadio(this)"><i class="fa-solid fa-xmark text-red-500"></i> No</div>
            <input class="ci-input" type="text" id="ci-iniciales" placeholder="Iniciales" style="width:90px;flex-shrink:0">
          </div>
        </div>
      </div>
    </div>

    <!-- Equipos Instalados -->
    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(14,165,233,.1);">💧</div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Equipos Instalados</div>
          <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;">Selecciona los equipos instalados</div>
        </div>
      </div>
      <div class="ci-section-body" id="ci-equip-list">

        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="water_treatment" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Sistema de tratamiento de agua para toda la casa</span>
        </div>
        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="reverse_osmosis" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Sistema de ósmosis inversa</span>
        </div>
        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="well_water" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Sistema de agua de pozo</span>
        </div>
      </div>
    </div>

    <!-- Firma -->
    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(239,68,68,.1);"><i class="fa-solid fa-pen-nib"></i>️</div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Firma del Cliente</div>
          <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;">Firme dentro del recuadro</div>
        </div>
      </div>
      <div class="ci-section-body">
        <div class="ci-notice important" style="margin:0 0 14px;">
          <div class="ci-notice-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div>
            <div class="ci-notice-title">Lea antes de firmar</div>
            <p>Con fecha de hoy certifico que han sido instalados y entregados satisfactoriamente en nuestra propiedad los artículos indicados.</p>
            <p class="en">I hereby certify that the items described above have been satisfactorily delivered and installed today in the above property address.</p>
          </div>
        </div>
        <div class="sig-wrapper">
          <canvas id="ci-sig-canvas" class="sig-canvas"></canvas>
          <button class="sig-clear" onclick="window.ciClearSig()">Limpiar</button>
        </div>
      </div>
    </div>

  </div><!-- /ci-body -->

  <!-- Botón Guardar -->
  <div class="ci-submit">
    <button class="ci-btn-submit" id="ci-btn-submit" onclick="window.ciSubmit()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
      Generar Confirmación PDF
    </button>
  </div>
  `;

  _initSig();
  _initDate();
  _initAutocomplete();
  _autofillFromParams(param);
}

function _initAutocomplete() {
  const inputComprador = document.getElementById('ci-comprador');
  if (!inputComprador) return;

  const db = getDB();
  const clientes = db.Clientes_Maestro || [];

  const dropdown = document.createElement('div');
  dropdown.className = 'ci-autocomplete-dropdown hidden';
  dropdown.style.cssText = 'position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100; margin-top: 4px;';
  
  inputComprador.parentElement.style.position = 'relative';
  inputComprador.parentElement.appendChild(dropdown);

  inputComprador.addEventListener('input', () => {
    const val = inputComprador.value.trim().toLowerCase();
    if (val.length < 2) {
      dropdown.classList.add('hidden');
      return;
    }

    const matches = clientes.filter(c => (c.nombre || '').toLowerCase().includes(val));
    if (matches.length > 0) {
      dropdown.innerHTML = matches.map((c, i) => `
        <div class="ci-autocomplete-item" data-idx="${i}" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 4px; transition: background 0.2s;" onmouseover="this.style.background='var(--surface-alt)'" onmouseout="this.style.background='transparent'">
            <span style="color: var(--text-primary); font-weight: 700; font-size: 0.9rem;">${c.nombre || ''}</span>
            <span style="color: var(--text-muted); font-size: 0.75rem;">${c.email || ''} - ${c.telefono || ''}</span>
        </div>
      `).join('');
      
      dropdown.querySelectorAll('.ci-autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          const c = matches[item.dataset.idx];
          inputComprador.value = c.nombre || '';
          
          const tel = document.getElementById('ci-telefono');
          if (tel) tel.value = c.telefono || '';
          
          const email = document.getElementById('ci-email');
          if (email) email.value = c.email || '';
          
          const dir = document.getElementById('ci-direccion');
          if (dir) dir.value = c.direccion || '';
          
          const city = document.getElementById('ci-ciudad');
          if (city) city.value = c.ciudad || '';
          
          const state = document.getElementById('ci-estado');
          if (state) state.value = c.estado || '';
          
          const zip = document.getElementById('ci-zip');
          if (zip) zip.value = c.zip || '';

          window._ci_clienteId = c.id;
          dropdown.classList.add('hidden');
        });
      });
      dropdown.classList.remove('hidden');
    } else {
      dropdown.classList.add('hidden');
    }
  });

  inputComprador.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.add('hidden'), 200);
  });
}

function _initDate() {
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const f = document.getElementById('ci-fecha');
  if (f) f.value = today;
  const fi = document.getElementById('ci-fecha-instalacion');
  if (fi) fi.value = today;

  // Autofill rep from current user
  const user = getCurrentUser();
  const repEl = document.getElementById('ci-rep-ventas');
  if (repEl && user) repEl.value = user.nombre || '';
}

// Abierta desde el proyecto (fase Certificado de Instalación): se llena sola con
// cliente, técnico, fecha de instalación, representante y equipos de la Orden de Trabajo.
function _autofillFromParams(param) {
  const hash = window.location.hash || '';
  const match = hash.match(/proyectoId=([^&]+)/);
  window._ci_proyectoId = param || (match ? match[1] : null);
  window._ci_clienteId = null;
  if (!window._ci_proyectoId) return;

  const db = getDB() || {};
  const proy = (db.Proyectos_Dinamicos || []).find(p => String(p.id) === String(window._ci_proyectoId));
  if (!proy) return;
  const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(proy.cliente_id)) || {};
  window._ci_clienteId = cli.id || null;
  const adj = (cli.adjuntos_oficina && !Array.isArray(cli.adjuntos_oficina)) ? cli.adjuntos_oficina : {};
  const ot = adj.orden_trabajo_datos || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };

  set('ci-comprador', cli.nombre);
  set('ci-telefono', cli.telefono);
  set('ci-email', cli.email);
  set('ci-direccion', cli.direccion);
  set('ci-ciudad', ot.comprador?.ciudad || cli.ciudad);
  set('ci-estado', ot.comprador?.estado || (cli.state_id && cli.state_id !== '-' ? cli.state_id : ''));
  set('ci-zip', ot.comprador?.zipCode || (cli.zip && cli.zip !== 'Pendiente' ? cli.zip : ''));

  // Técnico y fecha: lo elegido en "Asignación de Técnicos"
  const campos = db.Admin_Campos_Formulario || [];
  const resps = (db.Respuestas_Dinamicas || []).filter(r => String(r.proyecto_id) === String(proy.id));
  const valDe = (pred) => { const c = campos.find(pred); const r = c && resps.find(x => String(x.campo_id) === String(c.id)); return r?.valor || ''; };
  const tecId = valDe(c => c.tipo === 'Técnico') || proy.tecnico_id;
  const tec = (db.Usuarios || []).find(u => String(u.id) === String(tecId));
  if (tec) set('ci-instalador', `${tec.nombre || ''} ${tec.apellido || ''}`.trim());
  const fechaInst = valDe(c => ['Fecha', 'FechaHora', 'Fecha y Hora'].includes(c.tipo) && /instalaci/i.test(c.etiqueta || ''));
  const m = String(fechaInst).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) set('ci-fecha-instalacion', `${m[2]}/${m[3]}/${m[1]}`);

  // Representante de ventas
  const vendId = String(cli.vendedor_asignado_id || proy.responsable_id || '').split(',')[0].trim();
  const vend = (db.Usuarios || []).find(u => String(u.id) === vendId);
  set('ci-rep-ventas', vend ? `${vend.nombre || ''} ${vend.apellido || ''}`.trim() : cli.vendedor_asignado_nombre);

  // Equipos según la Orden de Trabajo (o pozo si tiene especificación de pozo)
  const e = ot.equipos || {};
  const marcar = (key, on) => {
    const el = document.querySelector(`#ci-equip-list [data-key="${key}"]`);
    if (el && on && !el.classList.contains('checked')) window.ciToggleChk(el);
  };
  marcar('water_treatment', e.suavizadorCasa || e.suavizadorCasa_entera);
  marcar('reverse_osmosis', e.osmosisReversa || e.osmosisReverso);
  marcar('well_water', e.aguaPozo || (!ot.equipos && (adj.plantilla_pozo_url || cli.plantilla_pozo_url)));
}

function _initSig() {
  sigCanvas = document.getElementById('ci-sig-canvas');
  if (!sigCanvas) return;
  sigCanvas.width  = sigCanvas.offsetWidth  || 340;
  sigCanvas.height = 140;
  sigCtx = sigCanvas.getContext('2d');
  sigCtx.strokeStyle = '#1e293b';
  sigCtx.lineWidth = 2.5;
  sigCtx.lineCap = 'round';
  sigCtx.lineJoin = 'round';

  const pos = (e) => {
    const r = sigCanvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };
  sigCanvas.addEventListener('mousedown', e => { sigDrawing = true; const p = pos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); });
  sigCanvas.addEventListener('mousemove', e => { if (!sigDrawing) return; const p = pos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); });
  sigCanvas.addEventListener('mouseup',   () => { sigDrawing = false; });
  sigCanvas.addEventListener('touchstart', e => { e.preventDefault(); sigDrawing = true; const p = pos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); }, { passive: false });
  sigCanvas.addEventListener('touchmove',  e => { e.preventDefault(); if (!sigDrawing) return; const p = pos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); }, { passive: false });
  sigCanvas.addEventListener('touchend',   () => { sigDrawing = false; });
}

// Globals
window.ciClearSig = () => { if (sigCtx && sigCanvas) sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); };

window.ciPickRadio = (el) => {
  const group = el.dataset.group;
  document.querySelectorAll(`[data-group="${group}"]`).forEach(b => { b.classList.remove('active-yes', 'active-no'); });
  el.classList.add(el.dataset.val === 'si' ? 'active-yes' : 'active-no');
};

window.ciToggleChk = (el) => { el.classList.toggle('checked'); el.innerHTML = el.classList.contains('checked') ? '<i class="fa-solid fa-check text-green-500"></i>' : ''; };

const _getRadio = (group) => { const el = document.querySelector(`[data-group="${group}"].active-yes, [data-group="${group}"].active-no`); return el ? el.dataset.val : ''; };
const _isChecked = (key) => document.querySelector(`[data-key="${key}"].checked`) !== null;
const _val = (id) => (document.getElementById(id) || {}).value?.trim() || '';

window.ciSubmit = async () => {
  const btn = document.getElementById('ci-btn-submit');
  const comprador = _val('ci-comprador');
  const fecha = _val('ci-fecha');
  const fechaInst = _val('ci-fecha-instalacion');
  const instalador = _val('ci-instalador');

  if (!comprador) { showToast('El nombre del comprador es obligatorio', 'error'); return; }
  if (!fecha)     { showToast('La fecha es obligatoria', 'error'); return; }
  if (!fechaInst) { showToast('La fecha de instalación es obligatoria', 'error'); return; }
  if (!instalador){ showToast('El nombre del instalador es obligatorio', 'error'); return; }

  const firmaData = sigCanvas ? sigCanvas.toDataURL('image/png') : null;

  const datos = {
    proyectoId: window._ci_proyectoId || null,
    clienteId: window._ci_clienteId || null,
    fecha,
    telefono:    _val('ci-telefono'),
    comprador,
    email:       _val('ci-email'),
    direccion:   _val('ci-direccion'),
    ciudad:      _val('ci-ciudad'),
    estado:      _val('ci-estado').toUpperCase(),
    zip:         _val('ci-zip'),
    fecha_instalacion: fechaInst,
    instalador,
    representante_ventas: _val('ci-rep-ventas'),
    confirmacion_cliente: _getRadio('confirmacion_cliente'),
    iniciales:          _val('ci-iniciales'),
    water_treatment:    _isChecked('water_treatment'),
    reverse_osmosis:    _isChecked('reverse_osmosis'),
    well_water:         _isChecked('well_water'),
    firma_comprador:    firmaData,
    fecha_firma:        fecha,
  };

  try {
    btn.disabled = true;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .7s linear infinite"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg> Generando PDF...';

    const resp = await fetch('/api/generar-confirmacion-instalacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datos })
    });
    const result = await resp.json();

    if (!resp.ok || !result.success) throw new Error(result.error || 'Error del servidor');

    showToast('¡Confirmación generada y guardada! <i class="fa-solid fa-check text-green-500"></i>', 'success');
    if (result.url) {
      setTimeout(() => { window.open(result.url, '_blank'); }, 500);
    }

    // Ligar el PDF a la fase "Certificado de Instalación" del proyecto y volver al proyecto
    const proyId = window._ci_proyectoId;
    if (proyId && result.url) {
      try {
        const db = getDB() || {};
        const proy = (db.Proyectos_Dinamicos || []).find(p => String(p.id) === String(proyId));
        if (proy) {
          const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(proy.cliente_id));
          if (cli) {
            if (!cli.adjuntos_oficina || Array.isArray(cli.adjuntos_oficina)) cli.adjuntos_oficina = {};
            cli.adjuntos_oficina.confirmacion_instalacion_url = result.url;
          }
          const faseCert = (db.Admin_Fases || []).find(f => f.pipeline_id === proy.pipeline_id && /certificado de instalaci/i.test(f.nombre || ''));
          const campoCert = faseCert && (db.Admin_Campos_Formulario || []).find(c => String(c.fase_id) === String(faseCert.id) && c.tipo === 'Archivo');
          if (campoCert) {
            const prev = (db.Respuestas_Dinamicas || []).find(r => String(r.proyecto_id) === String(proy.id) && String(r.campo_id) === String(campoCert.id));
            const lista = String(prev?.valor || '').split(',').map(x => x.trim()).filter(x => x && /^(https?:|\/api\/|\/uploads\/)/.test(x));
            if (!lista.includes(result.url)) lista.push(result.url);
            const { advanceDealPhase } = await import('../api.js');
            await advanceDealPhase(proy.id, { [campoCert.id]: lista.join(',') }, { preventAutoAdvance: true });
          }
          setTimeout(() => window.appNavigate && window.appNavigate('detail', proy.id), 1200);
        }
      } catch (linkErr) {
        console.error('[CI] No se pudo ligar a la fase:', linkErr);
        showToast('PDF generado, pero no se pudo poner en la fase del proyecto: ' + linkErr.message, 'warning');
      }
    }
  } catch (err) {
    console.error('[CI Submit]', err);
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> Generar Confirmación PDF';
  }
};
