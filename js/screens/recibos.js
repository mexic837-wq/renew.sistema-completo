/* ============================================================
   RENEW OS – screens/recibos.js
   Pantalla "Mis Recibos de Pagos"
   ============================================================ */
import { getCurrentUser } from '../app.js';
import { getRecibos } from '../api.js';

export function renderMisRecibos() {
  const user    = getCurrentUser();
  const screen  = document.getElementById('screen-mis-recibos');
  if (!screen) return;

  const userRole  = (user?.rol || '').toLowerCase();
  const isAdmin   = ['admin', 'administrador', 'ceo', 'desenvolvedor'].includes(userRole);
  const isTecnico = /t[eé]cn[io]co/i.test(user?.rol || '');

  // Admins see ALL, others see only their own
  const allRecibos = isAdmin ? getRecibos() : getRecibos(user.id);

  screen.innerHTML = `
    <div class="screen-header slide-in-left" style="background:linear-gradient(135deg,#0f172a,#1e293b);border:none;">
      <button class="back-btn" id="recibos-back-btn" style="color:#fff;background:rgba(255,255,255,0.15);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h2 style="color:#fff;">Mis Recibos de Pago</h2>
      <span style="background:rgba(16,185,129,0.2);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:4px 10px;border-radius:10px;font-size:0.7rem;font-weight:800;">
        ${allRecibos.length} recibo${allRecibos.length !== 1 ? 's' : ''}
      </span>
    </div>

    <div style="padding:16px 16px 100px;">
      <!-- Filter tabs (Admins Only) -->
      ${isAdmin ? `
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        <button data-filter="all"
          style="flex:1;padding:10px;border-radius:12px;border:1.5px solid var(--primary);background:rgba(0,223,191,0.12);color:var(--primary);font-size:0.8rem;font-weight:800;cursor:pointer;"
          id="rfil-all">Todos</button>
        <button data-filter="vendedor"
          style="flex:1;padding:10px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-muted);font-size:0.8rem;font-weight:800;cursor:pointer;"
          id="rfil-vendedor">Representantes</button>
        <button data-filter="tecnico"
          style="flex:1;padding:10px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-muted);font-size:0.8rem;font-weight:800;cursor:pointer;"
          id="rfil-tecnico">Técnicos</button>
      </div>
      ` : ''}

      <!-- Receipts list -->
      <div id="recibos-list">
        ${_renderRecibosList(allRecibos, isAdmin)}
      </div>
    </div>

    <!-- Receipt detail modal -->
    <div id="modal-recibo-detalle" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);align-items:flex-end;justify-content:center;">
      <div style="background:var(--surface);border-radius:24px 24px 0 0;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;padding:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 id="modal-recibo-titulo" style="font-size:1.1rem;font-weight:900;color:var(--text-primary);"></h3>
          <button id="btn-cerrar-recibo-modal"
            style="background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div id="modal-recibo-content"></div>
      </div>
    </div>
  `;

  // Back button
  document.getElementById('recibos-back-btn')?.addEventListener('click', () => window.appNavigate('dashboard'));

  // Filter buttons
  let currentFilter = 'all';
  ['all','vendedor','tecnico'].forEach(f => {
    document.getElementById(`rfil-${f}`)?.addEventListener('click', () => {
      currentFilter = f;
      const filtered = f === 'all' ? allRecibos : allRecibos.filter(r => r.tipo === f);
      document.getElementById('recibos-list').innerHTML = _renderRecibosList(filtered, isAdmin);
      _attachReciboCardListeners();
      // Update button styles
      ['all','vendedor','tecnico'].forEach(btn => {
        const el = document.getElementById(`rfil-${btn}`);
        if (!el) return;
        const isActive = btn === f;
        el.style.borderColor    = isActive ? 'var(--primary)' : 'var(--border)';
        el.style.background     = isActive ? 'rgba(0,223,191,0.12)' : 'var(--surface)';
        el.style.color          = isActive ? 'var(--primary)' : 'var(--text-muted)';
      });
    });
  });

  // Close modal
  document.getElementById('btn-cerrar-recibo-modal')?.addEventListener('click', () => {
    document.getElementById('modal-recibo-detalle').style.display = 'none';
  });

  _attachReciboCardListeners();

  window.deleteReciboApp = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este recibo?')) return;
    try {
      const { deleteRecord } = await import('../api.js');
      await deleteRecord('recibos_pagos', id);
      
      const db = window.getDB ? window.getDB() : null;
      if (db && db.Recibos_Pagos) {
          db.Recibos_Pagos = db.Recibos_Pagos.filter(r => r.id !== id);
          localStorage.setItem('rs_app_db', JSON.stringify(db)); // O ajusta si la DB es distinta en la app
      }
      
      // Re-render
      renderMisRecibos();
      
    } catch (err) {
      console.error("Error deleting recibo:", err);
      alert('Error al eliminar recibo');
    }
  };
}

function _renderRecibosList(recibos, isAdmin) {
  if (!recibos.length) return `
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:16px;opacity:0.3;">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <p style="font-weight:700;font-size:0.95rem;">Sin recibos de pago</p>
      <p style="font-size:0.8rem;margin-top:4px;">Aquí aparecerán los recibos generados en el pipeline de Renew Water.</p>
    </div>
  `;

  return recibos.map(r => {
    const isVendedor = r.tipo === 'vendedor';
    const color  = isVendedor ? '#3b82f6' : '#10b981';
    const label  = isVendedor ? 'Recibo de Pago – Representante' : 'Recibo de Instalación – Técnico';
    const icon   = isVendedor
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    const datos  = r.datos_json || {};
    const monto  = isVendedor
      ? (datos.grand_total ? `$${Number(datos.grand_total).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—')
      : (datos.total_price  ? `$${Number(datos.total_price ).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—');
    const fecha  = r.fecha_recibo || (r.created_at ? r.created_at.split('T')[0] : '—');

    return `
      <div class="recibo-card" data-id="${r.id}"
        style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all 0.2s;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${color},${color}88);"></div>
        <div style="width:44px;height:44px;border-radius:12px;background:${color}15;border:1px solid ${color}30;display:flex;align-items:center;justify-content:center;color:${color};flex-shrink:0;">
          ${icon}
        </div>
        <div style="flex:1;min-width:0;">
          <p style="font-size:0.65rem;font-weight:900;color:${color};text-transform:uppercase;letter-spacing:1px;margin:0;">${label}</p>
          <p style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.cliente_nombre || '—'}</p>
          ${isAdmin && r.trabajador_nombre ? `<p style="font-size:0.7rem;color:var(--text-muted);margin:0;">👤 ${r.trabajador_nombre}</p>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <p style="font-size:1.05rem;font-weight:900;color:${color};margin:0;">${monto}</p>
          <p style="font-size:0.65rem;color:var(--text-muted);margin:2px 0;">${fecha}</p>
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:4px;">
            ${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" onclick="event.stopPropagation();" style="font-size:0.6rem;font-weight:800;color:${color};text-decoration:none;background:${color}12;padding:3px 8px;border-radius:6px;">Ver PDF</a>` : ''}
            ${isAdmin ? `<button onclick="event.stopPropagation(); window.deleteReciboApp('${r.id}')" style="font-size:0.6rem;font-weight:800;color:#ef4444;background:#ef444412;padding:3px 8px;border:none;border-radius:6px;cursor:pointer;"><i class="fa-solid fa-trash"></i></button>` : ''}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--border)" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    `;
  }).join('');
}

function _attachReciboCardListeners() {
  document.querySelectorAll('.recibo-card').forEach(card => {
    card.addEventListener('click', () => {
      const db = window.getDB ? window.getDB() : { Recibos_Pagos: [] };
      const recibos = db.Recibos_Pagos || [];
      const r = recibos.find(x => x.id === card.dataset.id);
      if (!r) return;
      _showReciboModal(r);
    });
  });
}

function _showReciboModal(r) {
  const modal  = document.getElementById('modal-recibo-detalle');
  const titulo = document.getElementById('modal-recibo-titulo');
  const cont   = document.getElementById('modal-recibo-content');
  if (!modal || !titulo || !cont) return;

  const isVendedor = r.tipo === 'vendedor';
  titulo.textContent = isVendedor ? 'Recibo de Pago – Representante' : 'Recibo de Instalación – Técnico';

  const d = r.datos_json || {};
  const color = isVendedor ? '#3b82f6' : '#10b981';

  const field = (label, value, highlight = false) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);">${label}</span>
      <span style="font-size:0.85rem;font-weight:${highlight ? '900' : '600'};color:${highlight ? color : 'var(--text-primary)'};">${value || '—'}</span>
    </div>
  `;

  let html = '';

  if (isVendedor) {
    html = `
      <div style="background:var(--surface-alt);border-radius:14px;padding:16px;margin-bottom:16px;">
        <p style="font-size:0.65rem;font-weight:900;color:${color};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;">Información Principal</p>
        ${field('Representante', d.sales_representative)}
        ${field('Cliente', r.cliente_nombre || d.customer_name)}
        ${field('Empresa Financiera', d.finance_company)}
        ${field('Check #', d.check_number)}
        ${field('Fecha Transferencia', d.transfer_date)}
        ${field('Monto de Venta', d.sales_amount ? `$${Number(d.sales_amount).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—')}
        ${field('Aprobación', d.aprobacion_pct ? `${d.aprobacion_pct}%` : '—')}
        ${field('Monto Aprobación', d.monto_aprobacion ? `$${Number(d.monto_aprobacion).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—')}
      </div>
      <div style="background:var(--surface-alt);border-radius:14px;padding:16px;margin-bottom:16px;">
        <p style="font-size:0.65rem;font-weight:900;color:${color};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;">Costos</p>
        ${field('Cost', d.cost ? `$${Number(d.cost).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—')}
        ${field('Costo Plan %', d.costo_plan_pct ? `${d.costo_plan_pct}%` : '—')}
        ${field('Total Costo', d.total_costo ? `$${Number(d.total_costo).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—')}
        ${field('Total Analista', d.total_analista ? `$${Number(d.total_analista).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—')}
      </div>
      ${(d.extra_charges || []).length ? `
      <div style="background:var(--surface-alt);border-radius:14px;padding:16px;margin-bottom:16px;">
        <p style="font-size:0.65rem;font-weight:900;color:${color};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;">Extra Charges</p>
        ${(d.extra_charges||[]).map(e => field(e.concepto, e.monto ? `$${Number(e.monto).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—')).join('')}
      </div>` : ''}
      <div style="background:linear-gradient(135deg,${color}15,${color}05);border:1.5px solid ${color}30;border-radius:14px;padding:16px;">
        ${field('Instalador', d.instalador)}
        ${field('GRAND TOTAL', d.grand_total ? `$${Number(d.grand_total).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—', true)}
      </div>
    `;
  } else {
    html = `
      <div style="background:var(--surface-alt);border-radius:14px;padding:16px;margin-bottom:16px;">
        <p style="font-size:0.65rem;font-weight:900;color:${color};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;">Información</p>
        ${field('Instalador', d.installer_name)}
        ${field('Cliente', r.cliente_nombre || d.customer_name)}
        ${field('Dirección', d.address || r.direccion)}
        ${field('Fecha', d.date)}
      </div>
    `;
  }

  if (r.pdf_url) {
    html += `
      <div style="margin-top:16px;">
        <a href="${r.pdf_url}" target="_blank"
          style="display:block;width:100%;text-align:center;background:${color};color:#fff;border:none;padding:14px;border-radius:14px;font-size:0.9rem;font-weight:800;text-decoration:none;box-shadow:0 4px 16px ${color}40;">
          📄 Ver PDF Original
        </a>
      </div>
    `;
  }

  cont.innerHTML = html;
  modal.style.display = 'flex';
}
