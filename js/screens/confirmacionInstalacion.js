/* ============================================================
   RENEW OS – confirmacionInstalacion.js
   Formulario: Confirmación de Instalación (Renew Water)
   ============================================================ */
import { getCurrentUser } from '../api.js';
import { showToast } from '../components/toast.js';

let sigCanvas, sigCtx, sigDrawing = false;

export function renderConfirmacionInstalacion() {
  const screen = document.getElementById('screen-confirmacion-instalacion');
  if (!screen) return;

  screen.innerHTML = `
  <style>
    .ci-header { position:sticky;top:0;z-index:10;background:var(--surface);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;gap:12px; }
    .ci-back { width:38px;height:38px;border-radius:50%;border:none;background:var(--surface-alt);color:var(--text-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:.2s; }
    .ci-back:hover { background:rgba(14,165,233,.12);color:#0ea5e9; }
    .ci-body { padding:20px;display:flex;flex-direction:column;gap:20px;padding-bottom:160px; }
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
    .ci-serial { width:130px;flex-shrink:0; }
    .sig-wrapper { border:2px dashed var(--border);border-radius:16px;overflow:hidden;position:relative;background:#fff; }
    .sig-canvas { display:block;width:100%;height:140px;touch-action:none; }
    .sig-clear { position:absolute;top:8px;right:10px;background:rgba(239,68,68,.1);border:none;color:#ef4444;font-size:.7rem;font-weight:800;padding:4px 10px;border-radius:6px;cursor:pointer; }
    .ci-submit { position:fixed;bottom:70px;left:0;right:0;padding:16px;background:var(--surface);border-top:1px solid var(--border);z-index:99; }
    .ci-btn-submit { width:100%;padding:16px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;border:none;border-radius:16px;font-size:1rem;font-weight:800;cursor:pointer;transition:.2s;display:flex;align-items:center;justify-content:center;gap:8px; }
    .ci-btn-submit:active { transform:scale(.97); }
    .ci-btn-submit:disabled { opacity:.6;pointer-events:none; }
    @media (max-width:360px) { .ci-grid { grid-template-columns:1fr; } }
  </style>

  <!-- Header -->
  <div class="ci-header">
    <button class="ci-back" onclick="window.appNavigate('plantillas')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
    </button>
    <div>
      <h2 style="margin:0;font-size:1rem;font-weight:900;color:var(--text-primary);">Confirmación de Instalación</h2>
      <p style="margin:0;font-size:.65rem;color:#0ea5e9;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Renew Water</p>
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

        <!-- P1 -->
        <div class="ci-field">
          <label class="ci-label">¿Se enseñó cómo programar el LED del equipo?</label>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <div class="ci-radio-btn" data-group="enseno_programar" data-val="si" onclick="window.ciPickRadio(this)"><i class="fa-solid fa-check text-green-500"></i> Sí</div>
            <div class="ci-radio-btn" data-group="enseno_programar" data-val="no" onclick="window.ciPickRadio(this)"><i class="fa-solid fa-xmark text-red-500"></i> No</div>
            <input class="ci-input" type="text" id="ci-ini-1" placeholder="Iniciales" style="width:90px;flex-shrink:0">
          </div>
        </div>

        <!-- P2 -->
        <div class="ci-field">
          <label class="ci-label">¿El cliente está de acuerdo con el lugar de instalación?</label>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <div class="ci-radio-btn" data-group="acuerdo_ubicacion" data-val="si" onclick="window.ciPickRadio(this)"><i class="fa-solid fa-check text-green-500"></i> Sí</div>
            <div class="ci-radio-btn" data-group="acuerdo_ubicacion" data-val="no" onclick="window.ciPickRadio(this)"><i class="fa-solid fa-xmark text-red-500"></i> No</div>
            <input class="ci-input" type="text" id="ci-ini-2" placeholder="Iniciales" style="width:90px;flex-shrink:0">
          </div>
        </div>

        <!-- P3 -->
        <div class="ci-field">
          <label class="ci-label">¿Se informó al cliente sobre precauciones de congelamiento?</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <div class="ci-radio-btn" data-group="info_congelamiento" data-val="si" onclick="window.ciPickRadio(this)"><i class="fa-solid fa-check text-green-500"></i> Sí</div>
            <div class="ci-radio-btn" data-group="info_congelamiento" data-val="no" onclick="window.ciPickRadio(this)"><i class="fa-solid fa-xmark text-red-500"></i> No</div>
            <input class="ci-input" type="text" id="ci-ini-3" placeholder="Iniciales" style="width:90px;flex-shrink:0">
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
          <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;">Selecciona y agrega # de serie</div>
        </div>
      </div>
      <div class="ci-section-body" id="ci-equip-list">

        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="agua_municipal" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Agua Municipal (City Water)</span>
        </div>
        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="ice_maker" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Conexión Ice Maker / Refrigerador</span>
        </div>
        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="water_treatment" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Water Treatment / Whole House Softener</span>
          <input class="ci-input ci-serial" type="text" id="ci-serial-water" placeholder="# Serie">
        </div>
        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="reverse_osmosis" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Reverse Osmosis (RO)</span>
          <input class="ci-input ci-serial" type="text" id="ci-serial-ro" placeholder="# Serie">
        </div>
        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="well_water" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Well Water System</span>
          <input class="ci-input ci-serial" type="text" id="ci-serial-well" placeholder="# Serie">
        </div>
        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="ultraviolet" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Ultraviolet (UV) System</span>
        </div>
        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="big_blue" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Big Blue Filter</span>
        </div>
        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="spin_down" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Spin Down / Pre-Filter</span>
        </div>
        <div class="ci-check-row">
          <div class="ci-checkbox" data-key="other_equip" onclick="window.ciToggleChk(this)"></div>
          <span class="ci-check-label">Otro (Other)</span>
          <input class="ci-input ci-serial" type="text" id="ci-other-equip-text" placeholder="Especifique">
        </div>
      </div>
    </div>

    <!-- Costos -->
    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(245,158,11,.1);"><i class="fa-solid fa-sack-dollar"></i></div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Costos Adicionales</div>
          <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;">Si aplica</div>
        </div>
      </div>
      <div class="ci-section-body">
        <div class="ci-grid">
          <div class="ci-field">
            <label class="ci-label">Costo Instalación ($)</label>
            <input class="ci-input" type="text" id="ci-costo-instalacion" placeholder="0.00">
          </div>
          <div class="ci-field">
            <label class="ci-label">Costo Millas ($)</label>
            <input class="ci-input" type="text" id="ci-costo-millas" placeholder="0.00">
          </div>
          <div class="ci-field">
            <label class="ci-label">Costo Extra ($)</label>
            <input class="ci-input" type="text" id="ci-costo-extra" placeholder="0.00">
          </div>
          <div class="ci-field">
            <label class="ci-label">Otro ($)</label>
            <input class="ci-input" type="text" id="ci-costo-otro" placeholder="0.00">
          </div>
        </div>
        <div class="ci-field">
          <label class="ci-label">Total a Cobrar ($)</label>
          <input class="ci-input" type="text" id="ci-costo-total" placeholder="0.00" style="font-weight:800;font-size:1.05rem;">
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
  _autofillFromParams();
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

function _autofillFromParams() {
  // Try to prefill from URL params or saved project data
  const hash = window.location.hash || '';
  const match = hash.match(/proyectoId=([^&]+)/);
  if (!match) return;
  window._ci_proyectoId = match[1];
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

window.ciToggleChk = (el) => { el.classList.toggle('checked'); el.textContent = el.classList.contains('checked') ? '<i class="fa-solid fa-check text-green-500"></i>' : ''; };

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
    enseno_programar:   _getRadio('enseno_programar'),
    iniciales_1:        _val('ci-ini-1'),
    acuerdo_ubicacion:  _getRadio('acuerdo_ubicacion'),
    iniciales_2:        _val('ci-ini-2'),
    info_congelamiento: _getRadio('info_congelamiento'),
    iniciales_3:        _val('ci-ini-3'),
    agua_municipal:     _isChecked('agua_municipal'),
    ice_maker:          _isChecked('ice_maker'),
    water_treatment:    _isChecked('water_treatment'),
    serial_water:       _val('ci-serial-water'),
    reverse_osmosis:    _isChecked('reverse_osmosis'),
    serial_ro:          _val('ci-serial-ro'),
    well_water:         _isChecked('well_water'),
    serial_well:        _val('ci-serial-well'),
    ultraviolet:        _isChecked('ultraviolet'),
    big_blue:           _isChecked('big_blue'),
    spin_down:          _isChecked('spin_down'),
    other_equip:        _isChecked('other_equip'),
    other_equip_text:   _val('ci-other-equip-text'),
    costo_instalacion:  _val('ci-costo-instalacion'),
    costo_millas:       _val('ci-costo-millas'),
    costo_extra:        _val('ci-costo-extra'),
    costo_otro:         _val('ci-costo-otro'),
    costo_total:        _val('ci-costo-total'),
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
  } catch (err) {
    console.error('[CI Submit]', err);
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> Generar Confirmación PDF';
  }
};
