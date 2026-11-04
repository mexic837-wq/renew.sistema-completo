/* ============================================================
   RENEW OS - extrasInstalacion.js
   Formulario: Extras de Instalación (Renew Water)
   Millas, trabajo extra, días y monto, total
   ============================================================ */
import { getDB } from '../api.js';
import { showToast } from '../components/toast.js';

// Fase "Extras de Instalación" del pipeline Water y sus campos
const FASE_EXTRAS = 'fase_41_extr';
const CAMPO_EXTRAS_HUBO = 'campo_extras_hubo';
const CAMPO_EXTRAS_PDF = 'campo_extras_pdf';

const num = (v) => { const n = parseFloat(String(v || '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
const dinero = (n) => n ? n.toFixed(2) : '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderExtrasInstalacion(proyIdParam = null) {
  const screen = document.getElementById('screen-extras-instalacion');
  if (!screen) return;

  screen.innerHTML = `
  <style>
    .ci-body { padding:20px;display:flex;flex-direction:column;gap:20px;padding-bottom:20px; }
    .ci-section { background:var(--surface);border:1px solid var(--border);border-radius:20px;overflow:visible; }
    .ci-section-hdr { padding:16px 20px;display:flex;align-items:center;gap:12px; }
    .ci-section-icon { width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0; }
    .ci-section-body { padding:0 20px 20px; }
    .ci-field { margin-bottom:14px; }
    .ci-label { font-size:.7rem;font-weight:800;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;display:block; }
    .ci-input { width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:12px;background:var(--surface-alt);color:var(--text-primary);font-family:inherit;font-size:.9rem;outline:none;transition:.2s; }
    .ci-input:focus { border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.12); }
    .ci-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
    .ci-grid.thirds { grid-template-columns:1fr 1fr 1fr; }
    .ci-submit { position:fixed;bottom:70px;left:0;right:0;padding:16px;background:var(--surface);border-top:1px solid var(--border);z-index:99; }
    .ci-btn-submit { width:100%;padding:16px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;border:none;border-radius:16px;font-size:1rem;font-weight:800;cursor:pointer;transition:.2s;display:flex;align-items:center;justify-content:center;gap:8px; }
    .ci-btn-submit:disabled { opacity:.6;pointer-events:none; }
    @media (max-width:360px) { .ci-grid, .ci-grid.thirds { grid-template-columns:1fr; } }
  </style>

  <div class="tpl-header">
    <button class="tpl-back" onclick="window.appNavigate('plantillas')" title="Volver a Plantillas">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
    </button>
    <div>
      <h2 class="tpl-title">Extras de Instalación</h2>
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
            <input class="ci-input" type="text" id="ex-fecha" placeholder="MM/DD/YYYY">
          </div>
          <div class="ci-field">
            <label class="ci-label">Teléfono</label>
            <input class="ci-input" type="tel" id="ex-telefono" placeholder="(555) 000-0000">
          </div>
        </div>
        <div class="ci-field" style="position:relative;">
          <label class="ci-label">Nombre Completo (Purchaser) <span style="color:#ef4444">*</span></label>
          <input class="ci-input" type="text" id="ex-comprador" placeholder="Busca o escribe el nombre del cliente" autocomplete="off">
          <div id="ex-resultados" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-top:4px;max-height:200px;overflow-y:auto;z-index:50;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);"></div>
        </div>
        <div class="ci-field">
          <label class="ci-label">Email</label>
          <input class="ci-input" type="email" id="ex-email" placeholder="correo@ejemplo.com">
        </div>
        <div class="ci-field">
          <label class="ci-label">Dirección</label>
          <input class="ci-input" type="text" id="ex-direccion" placeholder="Calle y número">
        </div>
        <div class="ci-grid thirds">
          <div class="ci-field">
            <label class="ci-label">Ciudad</label>
            <input class="ci-input" type="text" id="ex-ciudad" placeholder="City">
          </div>
          <div class="ci-field">
            <label class="ci-label">Estado</label>
            <input class="ci-input" type="text" id="ex-estado" placeholder="FL" maxlength="2" style="text-transform:uppercase">
          </div>
          <div class="ci-field">
            <label class="ci-label">Zip</label>
            <input class="ci-input" type="text" id="ex-zip" placeholder="00000" maxlength="10">
          </div>
        </div>
      </div>
    </div>

    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(245,158,11,.1);"><i class="fa-solid fa-sack-dollar"></i></div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Extras</div>
          <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;">Millas, trabajo extra, días y monto</div>
        </div>
      </div>
      <div class="ci-section-body">
        <div class="ci-grid">
          <div class="ci-field">
            <label class="ci-label">Millas ($)</label>
            <input class="ci-input ex-monto" type="text" inputmode="decimal" id="ex-millas" placeholder="0.00">
          </div>
          <div class="ci-field">
            <label class="ci-label">Trabajo extra ($)</label>
            <input class="ci-input ex-monto" type="text" inputmode="decimal" id="ex-trabajo" placeholder="0.00">
          </div>
        </div>
        <div class="ci-field">
          <label class="ci-label">Días y monto</label>
          <textarea class="ci-input" id="ex-dias-monto" style="height:100px;resize:vertical;" placeholder="Ej. 2 días adicionales - $300.00"></textarea>
        </div>
        <div class="ci-field">
          <label class="ci-label">Total ($) <span style="color:#ef4444">*</span></label>
          <input class="ci-input" type="text" inputmode="decimal" id="ex-total" placeholder="0.00" style="font-weight:800;font-size:1.05rem;">
          <div style="font-size:.7rem;color:var(--text-muted);margin-top:4px;">Se suma solo con millas y trabajo extra; puedes ajustarlo si hay un monto por días.</div>
        </div>
      </div>
    </div>
  </div>

  <div class="ci-submit">
    <button class="ci-btn-submit" id="ex-btn-submit">
      <i class="fa-solid fa-file-pdf"></i> Generar PDF
    </button>
  </div>
  `;

  const $ = (id) => document.getElementById(id);
  let clienteId = null;
  let proyectoId = proyIdParam || null;
  let totalTocado = false;

  $('ex-fecha').value = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  const llenarCliente = (c) => {
    clienteId = c.id;
    $('ex-comprador').value = c.nombre || '';
    $('ex-telefono').value = c.telefono || '';
    $('ex-email').value = c.email || '';
    $('ex-direccion').value = c.direccion || '';
    $('ex-ciudad').value = c.ciudad || '';
    $('ex-estado').value = (c.state_id && c.state_id !== '-' ? c.state_id : '') || '';
    $('ex-zip').value = c.zip && c.zip !== 'Pendiente' ? c.zip : '';
  };

  // Desde el proyecto: se llena el cliente solo
  if (proyectoId) {
    const db = getDB();
    const proy = (db.Proyectos_Dinamicos || []).find((p) => String(p.id) === String(proyectoId));
    const cli = proy && (db.Clientes_Maestro || []).find((c) => String(c.id) === String(proy.cliente_id));
    if (cli) llenarCliente(cli);
  }

  // Buscador de cliente
  const input = $('ex-comprador'), res = $('ex-resultados');
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    clienteId = null;
    if (q.length < 2) { res.style.display = 'none'; return; }
    const db = getDB();
    const lista = (db.Clientes_Maestro || []).filter((c) => (c.nombre || '').toLowerCase().includes(q) || (c.telefono || '').includes(q)).slice(0, 6);
    if (!lista.length) { res.style.display = 'none'; return; }
    res.innerHTML = lista.map((c, i) => `<div data-i="${i}" style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;font-size:.85rem;">
      <div style="font-weight:700;color:var(--text-primary)">${esc(c.nombre)}</div>
      <div style="font-size:.75rem;color:var(--text-muted)">${esc(c.telefono || '')}</div></div>`).join('');
    res.querySelectorAll('[data-i]').forEach((el) => el.addEventListener('mousedown', () => {
      const c = lista[el.dataset.i];
      llenarCliente(c);
      const proy = (db.Proyectos_Dinamicos || []).find((p) => String(p.cliente_id) === String(c.id) && p.pipeline_id === 'pip_water')
        || (db.Proyectos_Dinamicos || []).find((p) => String(p.cliente_id) === String(c.id));
      proyectoId = proy ? proy.id : null;
      res.style.display = 'none';
    }));
    res.style.display = 'block';
  });
  input.addEventListener('blur', () => setTimeout(() => { res.style.display = 'none'; }, 200));

  // Total = millas + trabajo extra (hasta que lo editen a mano)
  const recalcular = () => { if (!totalTocado) $('ex-total').value = dinero(num($('ex-millas').value) + num($('ex-trabajo').value)); };
  document.querySelectorAll('.ex-monto').forEach((el) => el.addEventListener('input', recalcular));
  $('ex-total').addEventListener('input', () => { totalTocado = $('ex-total').value.trim() !== ''; });

  $('ex-btn-submit').addEventListener('click', async () => {
    const btn = $('ex-btn-submit');
    const datos = {
      clienteId, proyectoId,
      fecha: $('ex-fecha').value.trim(),
      comprador: $('ex-comprador').value.trim(),
      telefono: $('ex-telefono').value.trim(),
      email: $('ex-email').value.trim(),
      direccion: $('ex-direccion').value.trim(),
      ciudad: $('ex-ciudad').value.trim(),
      estado: $('ex-estado').value.trim().toUpperCase(),
      zip: $('ex-zip').value.trim(),
      extras_millas: dinero(num($('ex-millas').value)),
      extras_trabajo: dinero(num($('ex-trabajo').value)),
      extras_dias_monto: $('ex-dias-monto').value.trim(),
      extras_total: dinero(num($('ex-total').value)),
    };
    if (!datos.comprador || !datos.fecha) { showToast('La fecha y el nombre del cliente son obligatorios', 'error'); return; }
    if (!datos.extras_total) { showToast('Indica el total de los extras', 'error'); return; }

    const html0 = btn.innerHTML;
    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
      const r = await fetch('/api/generar-extras-instalacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datos }),
      });
      const result = await r.json();
      if (!r.ok || !result.success) throw new Error(result.error || 'Error al generar el PDF');

      // Descarga del PDF
      if (result.pdfBase64) {
        const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url; a.download = `Extras_Instalacion_${datos.comprador.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      }

      // Ligar el PDF a la fase "Extras de Instalación" del proyecto (y avanzar si está en esa fase)
      if (proyectoId && result.url) {
        const db = getDB();
        const proy = (db.Proyectos_Dinamicos || []).find((p) => String(p.id) === String(proyectoId));
        if (proy && (db.Admin_Campos_Formulario || []).some((c) => c.id === CAMPO_EXTRAS_PDF)) {
          const { advanceDealPhase } = await import('../api.js');
          await advanceDealPhase(proy.id, { [CAMPO_EXTRAS_HUBO]: 'Si', [CAMPO_EXTRAS_PDF]: result.url }, { preventAutoAdvance: proy.fase_id !== FASE_EXTRAS });
          showToast('Extras de Instalación guardados en el proyecto', 'success');
          setTimeout(() => window.appNavigate('detail', proy.id), 1200);
          return;
        }
      }
      showToast('Extras de Instalación generados', 'success');
      if (result.url) window.open(result.url, '_blank');
    } catch (err) {
      console.error('[Extras Instalación]', err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = html0;
    }
  });
}
