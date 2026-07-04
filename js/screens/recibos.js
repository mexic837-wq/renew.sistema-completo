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
  allRecibos.sort((a, b) => {
    const dateA = new Date(a.fecha_recibo || a.created_at || 0);
    const dateB = new Date(b.fecha_recibo || b.created_at || 0);
    return dateB - dateA;
  });

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
      <!-- Search bar (Admins Only) -->
      ${isAdmin ? `
      <div style="position:relative;margin-bottom:14px;">
        <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.85rem;"></i>
        <input id="recibos-search" type="text" placeholder="Buscar por nombre de cliente o trabajador..." autocomplete="off"
          style="width:100%;padding:11px 14px 11px 40px;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-primary);font-size:0.82rem;font-weight:600;box-sizing:border-box;outline:none;"
          onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
      </div>
      ` : ''}

      <!-- Filter tabs (Admins Only) -->
      ${isAdmin ? `
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
        <button data-filter="vendedor"
          style="flex:1;min-width:100px;padding:10px;border-radius:12px;border:1.5px solid var(--primary);background:rgba(0,223,191,0.12);color:var(--primary);font-size:0.8rem;font-weight:800;cursor:pointer;"
          id="rfil-vendedor">Representantes</button>
        <button data-filter="tecnico"
          style="flex:1;min-width:100px;padding:10px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-muted);font-size:0.8rem;font-weight:800;cursor:pointer;"
          id="rfil-tecnico">Técnicos</button>
        <button data-filter="oficina"
          style="flex:1;min-width:100px;padding:10px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-muted);font-size:0.8rem;font-weight:800;cursor:pointer;"
          id="rfil-oficina">Oficina</button>
        <button data-filter="mis_recibos"
          style="flex:1;min-width:100px;padding:10px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-muted);font-size:0.8rem;font-weight:800;cursor:pointer;"
          id="rfil-mis_recibos">Mis Recibos</button>
      </div>
      ` : ''}

      <!-- Dept filters -->
      <div id="recibos-dept-filter" style="display:flex; gap:8px; margin-bottom:16px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none;"></div>


      <!-- Receipts list -->
      <div id="recibos-list">
        ${_renderRecibosList(isAdmin ? allRecibos.filter(r => r.tipo === 'vendedor' && !(r.datos_json && r.datos_json.subtipo === 'oficina')) : allRecibos, isAdmin)}
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
  let currentFilter = 'vendedor'; // default to vendedor
  ['vendedor','tecnico','oficina','mis_recibos'].forEach(f => {
    document.getElementById(`rfil-${f}`)?.addEventListener('click', () => {
      currentFilter = f;
      applyReciboFilters();
      // Update button styles
      ['vendedor','tecnico','oficina','mis_recibos'].forEach(btn => {
        const el = document.getElementById(`rfil-${btn}`);
        if (!el) return;
        const isActive = btn === f;
        el.style.borderColor = isActive ? 'var(--primary)' : 'var(--border)';
        el.style.background  = isActive ? 'rgba(0,223,191,0.12)' : 'var(--surface)';
        el.style.color       = isActive ? 'var(--primary)' : 'var(--text-muted)';
      });
    });
  });

  // Search input
  const searchInput = document.getElementById('recibos-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => applyReciboFilters());
  }

  // Dept filter logic
  let activeDeptFilter = localStorage.getItem('recibos_dept_filter') || 'Todos';

  function renderDeptFilters() {
    const deptContainer = document.getElementById('recibos-dept-filter');
    if (!deptContainer) return;
    
    const userRolNorm = (user && user.rol || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const isHighRole = ['admin', 'administrador', 'ceo', 'desenvolvedor'].includes(userRolNorm);
    const units = isHighRole ? ['Renew Solar', 'Renew Water', 'Renew Home'] : (user.unidades || []);
    
    const depts = ['Todos', ...units.map(u => u.replace('Renew ', ''))];
    
    // Ensure active filter is valid
    if (!depts.map(d=>d.toLowerCase()).includes(activeDeptFilter.toLowerCase())) {
        activeDeptFilter = 'Todos';
    }

    deptContainer.innerHTML = depts.map(dept => {
      const isActive = activeDeptFilter.toLowerCase() === dept.toLowerCase();
      let color = 'var(--text-secondary)';
      let bg = 'transparent';
      let border = 'var(--border)';
      if (isActive) {
        if (dept === 'Todos') { color = 'var(--primary)'; bg = 'rgba(0, 223, 191, 0.1)'; border = 'var(--primary)'; }
        else if (dept === 'Solar') { color = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.1)'; border = '#f59e0b'; }
        else if (dept === 'Water') { color = '#0ea5e9'; bg = 'rgba(14, 165, 233, 0.1)'; border = '#0ea5e9'; }
        else if (dept === 'Home') { color = '#a855f7'; bg = 'rgba(168, 85, 247, 0.1)'; border = '#a855f7'; }
        else if (dept === 'Oficina') { color = '#ef4444'; bg = 'rgba(239, 68, 68, 0.1)'; border = '#ef4444'; }
      }
      return `<button class="rfil-dept-pill" data-dept="${dept}" style="padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s; color: ${color}; background: ${bg}; border: 1px solid ${border}; flex-shrink: 0;">${dept.toUpperCase()}</button>`;
    }).join('');

    deptContainer.querySelectorAll('.rfil-dept-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeDeptFilter = pill.dataset.dept;
        localStorage.setItem('recibos_dept_filter', activeDeptFilter);
        renderDeptFilters();
        applyReciboFilters(); 
      });
    });
  }

  renderDeptFilters();

  function getReciboDept(r, db) {
      if (r.departamento) return r.departamento.toLowerCase();
      if (r.datos_json) {
          if (r.datos_json.departamento) {
              let d = r.datos_json.departamento.toLowerCase();
              if (d === 'otro') return 'oficina';
              return d;
          }
          if (r.datos_json.dpto) {
              let d = r.datos_json.dpto.toLowerCase();
              if (d === 'otro') return 'oficina';
              return d;
          }
      }

      if (r.proyecto_id) {
          const proyectos = db.Proyectos_Dinamicos || [];
          const pipelines = db.Admin_Pipelines || [];
          const proy = proyectos.find(p => String(p.id) === String(r.proyecto_id));
          if (proy) {
              const pip = pipelines.find(p => String(p.id) === String(proy.pipeline_id));
              if (pip) {
                  const n = (pip.nombre || '').toLowerCase();
                  if (n.includes('water')) return 'water';
                  if (n.includes('solar')) return 'solar';
                  if (n.includes('home'))  return 'home';
              }
          }
          
          if (db.Clientes_Maestro) {
              const cli = db.Clientes_Maestro.find(c => String(c.id) === String(r.proyecto_id) || String(c.proyecto_id) === String(r.proyecto_id));
              if (cli) {
                  if (cli.departamentos_activos && cli.departamentos_activos.length) {
                      return cli.departamentos_activos[0].toLowerCase().replace('renew ', '');
                  }
                  if (cli.departamento) return cli.departamento.toLowerCase().replace('renew ', '');
                  if (cli.empresa) return cli.empresa.toLowerCase().replace('renew ', '');
              }
          }
      }
      return '';
  }

  function applyReciboFilters() {
    const query = (document.getElementById('recibos-search')?.value || '').toLowerCase().trim();
    const db = window.getDB ? window.getDB() : { Clientes_Maestro: [] };
    
    const userRolNorm = (user && user.rol || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const isHighRole = ['admin', 'administrador', 'ceo', 'desenvolvedor'].includes(userRolNorm);
    const units = isHighRole ? ['Renew Solar', 'Renew Water', 'Renew Home'] : (user.unidades || []);
    const allowedDepts = units.map(u => u.replace('Renew ', '').toLowerCase());
    
    let filtered = [];
    if (currentFilter === 'mis_recibos') {
      filtered = allRecibos.filter(r => r.trabajador_id === user.id);
    } else if (currentFilter === 'oficina') {
      const dbLocal = window.getDB ? window.getDB() : {};
      const workersLocal = dbLocal.Usuarios || [];
      const vendedorRolesLocal = ['supervisor', 'supervisión', 'manager', 'representante', 'account', 'asesor', 'ventas', 'vendedor'];
      filtered = allRecibos.filter(r => {
        const w = workersLocal.find(u => String(u.id) === String(r.trabajador_id));
        const wRol = (w?.rol || '').toLowerCase();
        const wIsVendedor = vendedorRolesLocal.some(vr => wRol.includes(vr));
        return !wIsVendedor && r.tipo === 'vendedor' && r.datos_json && r.datos_json.subtipo === 'oficina';
      });
    } else if (currentFilter === 'vendedor') {
      const dbLocal = window.getDB ? window.getDB() : {};
      const workersLocal = dbLocal.Usuarios || [];
      const vendedorRolesLocal = ['supervisor', 'supervisión', 'manager', 'representante', 'account', 'asesor', 'ventas', 'vendedor'];
      filtered = allRecibos.filter(r => {
        const w = workersLocal.find(u => String(u.id) === String(r.trabajador_id));
        const wRol = (w?.rol || '').toLowerCase();
        const wIsVendedor = vendedorRolesLocal.some(vr => wRol.includes(vr));
        return r.tipo === 'vendedor' && (wIsVendedor || !(r.datos_json && r.datos_json.subtipo === 'oficina'));
      });
    } else {
      filtered = allRecibos.filter(r => r.tipo === currentFilter);
    }

    filtered = filtered.filter(r => {
        let dept = getReciboDept(r, db);
        
        if (activeDeptFilter !== 'Todos') {
            return dept === activeDeptFilter.toLowerCase();
        } else {
            // Todos selected
            if (isHighRole) {
                return true; 
            } else {
                if (dept === '') return true; // Show unassigned
                return allowedDepts.includes(dept);
            }
        }
    });

    if (query) {
      filtered = filtered.filter(r =>
        (r.cliente_nombre || '').toLowerCase().includes(query) ||
        (r.trabajador_nombre || '').toLowerCase().includes(query)
      );
    }
    
    // Sort by date descending (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.fecha_recibo || a.created_at || 0);
      const dateB = new Date(b.fecha_recibo || b.created_at || 0);
      return dateB - dateA;
    });

    document.getElementById('recibos-list').innerHTML = _renderRecibosList(filtered, isAdmin);
    _attachReciboCardListeners();
  }

  // Initial call since we overwrote the behavior
  applyReciboFilters();

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

  const db = window.getDB ? window.getDB() : {};
  const allWorkers = db.Usuarios || [];
  // Roles that should be treated as vendedor/representante even if stored as oficina
  const vendedorRoles = ['supervisor', 'supervisión', 'manager', 'representante', 'account', 'asesor', 'ventas', 'vendedor'];

  return recibos.map(r => {
    const datos = r.datos_json || {};
    // Check if the worker's actual role overrides the stored subtipo
    const worker = allWorkers.find(w => String(w.id) === String(r.trabajador_id));
    const workerRolLow = (worker?.rol || '').toLowerCase();
    const workerIsVendedor = vendedorRoles.some(vr => workerRolLow.includes(vr));
    const isOficina = !workerIsVendedor && (datos.subtipo === 'oficina' || r.tipo === 'oficina');
    const isVendedor = (r.tipo === 'vendedor' && !isOficina) || workerIsVendedor;
    const isTecnico = r.tipo === 'tecnico' && !workerIsVendedor;
    
    let color = '#10b981'; // tecnico
    let label = 'Recibo de Instalación – Técnico';
    const montoRaw = r.monto || datos.grand_total || datos.total_price;
    let monto = montoRaw ? `$${Number(montoRaw).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—';

    if (isOficina) {
      color = '#8b5cf6';
      label = 'Recibo de Pago – Oficina';
    } else if (isVendedor) {
      color = '#3b82f6';
      label = 'Recibo de Pago – Representante';
    }

    const icon = isVendedor || isOficina
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    
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
          ${isAdmin && r.trabajador_nombre ? `<p style="font-size:0.7rem;color:var(--text-muted);margin:0;"><i class="fa-solid fa-user"></i> ${r.trabajador_nombre}</p>` : ''}
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

  const d = r.datos_json || {};
  const isOficina = d.subtipo === 'oficina' || r.tipo === 'oficina';
  const isVendedor = r.tipo === 'vendedor' && !isOficina;

  titulo.textContent = isOficina ? 'Recibo de Pago – Oficina' : (isVendedor ? 'Recibo de Pago – Representante' : 'Recibo de Instalación – Técnico');

  const color = isOficina ? '#8b5cf6' : (isVendedor ? '#3b82f6' : '#10b981');

  const field = (label, value, highlight = false) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);">${label}</span>
      <span style="font-size:0.85rem;font-weight:${highlight ? '900' : '600'};color:${highlight ? color : 'var(--text-primary)'};">${value || '—'}</span>
    </div>
  `;

  let html = '';

  if (isOficina) {
    html = `
      <div style="background:var(--surface-alt);border-radius:14px;padding:16px;margin-bottom:16px;">
        <p style="font-size:0.65rem;font-weight:900;color:${color};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;">Información Principal</p>
        ${field('Colaborador', r.trabajador_nombre)}
        ${field('Motivo / Cliente', r.cliente_nombre)}
        ${field('Departamento', d.dpto || d.departamento || r.departamento || 'Oficina')}
        ${field('Fecha', r.fecha_recibo || (r.created_at ? r.created_at.split('T')[0] : '—'))}
      </div>
      <div style="background:linear-gradient(135deg,${color}15,${color}05);border:1.5px solid ${color}30;border-radius:14px;padding:16px;">
        ${field('Monto Total', d.grand_total ? `$${Number(d.grand_total).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—', true)}
      </div>
    `;
  } else if (isVendedor) {
    html = `
      <div style="background:var(--surface-alt);border-radius:14px;padding:16px;margin-bottom:16px;">
        <p style="font-size:0.65rem;font-weight:900;color:${color};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;">Información Principal</p>
        ${field('Representante', d.sales_representative || r.trabajador_nombre)}
        ${field('Cliente', r.cliente_nombre || d.customer_name)}
        ${field('Departamento', d.dpto || d.departamento || r.departamento || 'Ventas')}
        ${field('Fecha', r.fecha_recibo || (r.created_at ? r.created_at.split('T')[0] : '—'))}
      </div>
      <div style="background:linear-gradient(135deg,${color}15,${color}05);border:1.5px solid ${color}30;border-radius:14px;padding:16px;">
        ${field('Monto Total', d.grand_total ? `$${Number(d.grand_total).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—', true)}
      </div>
    `;
  } else {
    html = `
      <div style="background:var(--surface-alt);border-radius:14px;padding:16px;margin-bottom:16px;">
        <p style="font-size:0.65rem;font-weight:900;color:${color};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;">Información Principal</p>
        ${field('Instalador', d.installer_name || r.trabajador_nombre)}
        ${field('Cliente', r.cliente_nombre || d.customer_name)}
        ${field('Departamento', d.dpto || d.departamento || r.departamento || 'Técnico')}
        ${field('Fecha', d.date || r.fecha_recibo || (r.created_at ? r.created_at.split('T')[0] : '—'))}
      </div>
      <div style="background:linear-gradient(135deg,${color}15,${color}05);border:1.5px solid ${color}30;border-radius:14px;padding:16px;">
        ${field('Monto Total', d.total_price || d.grand_total ? `$${Number(d.total_price || d.grand_total).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—', true)}
      </div>
    `;
  }

  if (r.pdf_url) {
    html += `
      <div style="margin-top:16px;">
        <a href="${r.pdf_url}" target="_blank"
          style="display:block;width:100%;text-align:center;background:${color};color:#fff;border:none;padding:14px;border-radius:14px;font-size:0.9rem;font-weight:800;text-decoration:none;box-shadow:0 4px 16px ${color}40;">
          <i class="fa-solid fa-file-lines"></i> Ver PDF Original
        </a>
      </div>
    `;
  }

  cont.innerHTML = html;
  modal.style.display = 'flex';
}
