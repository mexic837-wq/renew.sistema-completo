/* ============================================================
   RENEW OS – screens/equipo.js
   Directorio "Mi Equipo" con filtrado por Ecosistema
   ============================================================ */
import { getAdminWorkers } from '../api.js';
import { getCurrentUser, navigate } from '../app.js';
import { t } from '../i18n.js';

let activeTeamDept = 'Todos';
let activeTeamRole = 'Todos';
let activeTeamSede = 'Todas';
let teamSearchQuery = '';
let allTeamWorkers = [];

export async function renderMiEquipo() {
  const screen = document.getElementById('screen-mi-equipo');
  if (!screen) return;

  const user = getCurrentUser();
  const activeUnit = localStorage.getItem('active_unit') || 'Renew Solar';
  if (activeTeamDept === 'Todos') {
     activeTeamDept = 'Todos'; // We start showing everyone
  }

  // UI Initial Skeleton
  screen.innerHTML = `
    <div class="dash-header" style="padding-bottom: 16px; position: sticky; top: 0; z-index: 50; background: var(--bg-main);">
      <div class="dash-header-top" style="display: flex; align-items: center; justify-content: center; position: relative; min-height: 40px; margin-bottom: 0;">
        <button id="btn-team-back" style="position: absolute; left: 0; background: none; border: none; color: var(--text-primary); padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div class="dash-greeting" style="text-align: center;">
          <h1 style="margin: 0; font-size: 1.25rem;">Mi Equipo</h1>
        </div>
      </div>
      
      <!-- Fila 1: Filtro de departamento -->
      <div id="team-dept-filter" style="display:flex; justify-content: center; overflow-x:auto; gap:8px; padding:16px 20px 8px; margin-top:4px; scrollbar-width:none;">
      </div>
      
      <!-- Fila 2: Buscador y Filtro de rol y Sede -->
      <div style="display:flex; flex-direction:column; gap:8px; padding:0 20px; margin-top:8px;">
          <div style="position:relative; width:100%;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.85rem;"></i>
            <input id="team-search" type="text" placeholder="Buscar compañero..." autocomplete="off" value="${teamSearchQuery}"
              style="width:100%;padding:11px 14px 11px 40px;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-primary);font-size:0.82rem;font-weight:600;box-sizing:border-box;outline:none;"
              onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
          </div>
          <div style="display:flex; gap:8px; width:100%;">
              <select id="team-role-filter" style="flex:1; border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-primary);font-size:0.82rem;font-weight:600;padding:10px 12px;outline:none; cursor:pointer;">
                 <option value="Todos" ${activeTeamRole === 'Todos' ? 'selected' : ''}>Todos los roles</option>
                 <option value="admin" ${activeTeamRole === 'admin' ? 'selected' : ''}>Administración</option>
                 <option value="manager" ${activeTeamRole === 'manager' ? 'selected' : ''}>Managers / Sup</option>
                 <option value="vendedor" ${activeTeamRole === 'vendedor' ? 'selected' : ''}>Representantes</option>
                 <option value="call" ${activeTeamRole === 'call' ? 'selected' : ''}>Call Center</option>
              </select>
              <select id="team-sede-filter" style="flex:1; border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-primary);font-size:0.82rem;font-weight:600;padding:10px 12px;outline:none; cursor:pointer;">
                 <option value="Todas" ${activeTeamSede === 'Todas' ? 'selected' : ''}>Todas las sedes</option>
                 <option value="Miami" ${activeTeamSede === 'Miami' ? 'selected' : ''}>Miami</option>
                 <option value="Orlando" ${activeTeamSede === 'Orlando' ? 'selected' : ''}>Orlando</option>
                 <option value="Venezuela" ${activeTeamSede === 'Venezuela' ? 'selected' : ''}>Venezuela</option>
              </select>
          </div>
      </div>
    </div>

    <div class="team-container" style="padding: 24px; padding-bottom: 100px; width: 100%; max-width: 1600px; margin: 0 auto;">
      <div id="team-grid" class="team-grid">
        <!-- Skeleton Loaders -->
        ${[1, 2, 3, 4, 5, 6, 7, 8].map(() => `
          <div class="team-card skeleton" style="height: 220px; border-radius: 24px; background: var(--surface-alt); opacity: 0.5;"></div>
        `).join('')}
      </div>
    </div>

    <style>
      .team-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr); /* Mobile: 2 columns */
        gap: 12px;
        width: 100%;
      }
      
      @media (min-width: 768px) {
        .team-grid {
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); /* Desktop: as many as fit */
          gap: 32px;
          padding: 20px 40px;
        }
      }

      .team-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 20px 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }
      .team-card:active {
        transform: scale(0.97);
      }
      .team-photo-wrapper {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        margin-bottom: 12px;
        padding: 3px;
        background: linear-gradient(135deg, var(--primary), #3b82f6);
        position: relative;
      }
      .team-photo {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        background: var(--surface-alt);
        border: 2px solid var(--surface);
      }
      .team-name {
        font-size: 0.9rem;
        font-weight: 800;
        color: var(--text-primary);
        margin-bottom: 4px;
        line-height: 1.2;
      }
      .team-role {
        font-size: 0.65rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 4px 10px;
        border-radius: 99px;
        background: rgba(0, 245, 212, 0.1);
        color: var(--primary);
        margin-bottom: 12px;
      }
      .team-contact {
        display: flex;
        gap: 8px;
        margin-top: auto;
      }
      .contact-icon {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        background: var(--surface-alt);
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        transition: all 0.2s;
        text-decoration: none;
      }
      .contact-icon:hover {
        background: var(--primary);
        color: white;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in {
        animation: fadeIn 0.4s ease forwards;
      }
    </style>
  `;

  // Render Department Pills
  const deptContainer = document.getElementById('team-dept-filter');
  if (deptContainer) {
    const depts = ['Todos', 'Solar', 'Water', 'Home'];
    deptContainer.innerHTML = depts.map(dept => {
      const isActive = activeTeamDept === dept;
      let color = 'var(--text-secondary)';
      let bg = 'transparent';
      let border = 'var(--border)';
      if (isActive) {
        if (dept === 'Todos') { color = 'var(--primary)'; bg = 'rgba(0, 223, 191, 0.1)'; border = 'var(--primary)'; }
        else if (dept === 'Solar') { color = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.1)'; border = '#f59e0b'; }
        else if (dept === 'Water') { color = '#0ea5e9'; bg = 'rgba(14, 165, 233, 0.1)'; border = '#0ea5e9'; }
        else if (dept === 'Home') { color = '#a855f7'; bg = 'rgba(168, 85, 247, 0.1)'; border = '#a855f7'; }
      }
      return `<button class="dept-filter-pill" data-dept="${dept}" style="padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s; color: ${color}; background: ${bg}; border: 1px solid ${border}; flex-shrink: 0;">${dept.toUpperCase()}</button>`;
    }).join('');

    deptContainer.querySelectorAll('.dept-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeTeamDept = pill.dataset.dept;
        renderMiEquipo(); 
      });
    });
  }

  // Add event listener for back button
  setTimeout(() => {
    const btnBack = document.getElementById('btn-team-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => navigate('dashboard'));
    }
    const searchInput = document.getElementById('team-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        teamSearchQuery = e.target.value;
        _renderTeamGrid();
      });
    }
    const roleSelect = document.getElementById('team-role-filter');
    if (roleSelect) {
      roleSelect.addEventListener('change', (e) => {
        activeTeamRole = e.target.value;
        _renderTeamGrid();
      });
    }
    const sedeSelect = document.getElementById('team-sede-filter');
    if (sedeSelect) {
      sedeSelect.addEventListener('change', (e) => {
        activeTeamSede = e.target.value;
        _renderTeamGrid();
      });
    }
  }, 100);

  try {
    if (allTeamWorkers.length === 0) {
        allTeamWorkers = await getAdminWorkers();
    }
    _renderTeamGrid();

  } catch (err) {
    console.error('Error rendering team:', err);
    const grid = document.getElementById('team-grid');
    if (grid) grid.innerHTML = `<p style="color:red; text-align:center;">Error al cargar el equipo.</p>`;
  }
}

function _renderTeamGrid() {
    const grid = document.getElementById('team-grid');
    if (!grid) return;

    let filtered = allTeamWorkers.filter(w => !w.is_suspended);

    // Filter by Dept
    if (activeTeamDept !== 'Todos') {
      filtered = filtered.filter(w => {
         const units = w.unidades || w.ecosistemas_autorizados || [];
         const unitsStr = units.join(' ').toLowerCase();
         return unitsStr.includes(activeTeamDept.toLowerCase());
      });
    }

    // Filter by Role
    if (activeTeamRole !== 'Todos') {
       filtered = filtered.filter(w => {
           const rol = (w.rol || '').toLowerCase();
           if (activeTeamRole === 'admin') return ['admin', 'administrador', 'ceo', 'desarrollador'].some(r => rol.includes(r));
           if (activeTeamRole === 'manager') return ['manager', 'supervisión', 'supervisor', 'account'].some(r => rol.includes(r));
           if (activeTeamRole === 'vendedor') return ['vendedor', 'representante', 'junior', 'iniciante', 'novato'].some(r => rol.includes(r));
           if (activeTeamRole === 'call') return rol.includes('call');
           return true;
       });
    }

    // Filter by Sede
    if (activeTeamSede !== 'Todas') {
       filtered = filtered.filter(w => {
           const sede = (w.sede || '').toLowerCase();
           return sede.includes(activeTeamSede.toLowerCase());
       });
    }

    // Filter by Search
    if (teamSearchQuery.trim() !== '') {
       const q = teamSearchQuery.toLowerCase().trim();
       filtered = filtered.filter(w => {
           const fullName = `${w.nombre || ''} ${w.apellido || ''}`.toLowerCase();
           return fullName.includes(q);
       });
    }
    
    // Sort Alphabetically A-Z
    filtered.sort((a, b) => {
       const nameA = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase();
       const nameB = `${b.nombre || ''} ${b.apellido || ''}`.trim().toLowerCase();
       return nameA.localeCompare(nameB);
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fas fa-users-slash" style="font-size: 3rem; opacity: 0.2; margin-bottom: 16px;"></i>
          <p style="font-weight: 600;">No se encontraron compañeros con estos filtros.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((w, idx) => {
      const initials = (w.nombre?.[0] || '') + (w.apellido?.[0] || '');
      const photoUrl = w.foto || w.photo || null;
      
      return `
        <div class="team-card animate-fade-in" style="animation-delay: ${Math.min(idx * 0.05, 0.5)}s">
          <div class="team-photo-wrapper">
            ${photoUrl 
              ? `<img src="${photoUrl}" class="team-photo" alt="${w.nombre}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <div class="team-photo" style="display:none; align-items:center; justify-content:center; font-weight:900; color:var(--text-muted); font-size:1.2rem; background:var(--bg-secondary);">${initials}</div>`
              : `<div class="team-photo" style="display:flex; align-items:center; justify-content:center; font-weight:900; color:var(--text-muted); font-size:1.2rem; background:var(--bg-secondary);">${initials}</div>`
            }
          </div>
          <div class="team-name">${w.nombre} ${w.apellido || ''}</div>
          <div class="team-role">${(w.rol || 'Colaborador').toLowerCase().includes('vendedor') ? 'Representante de Ventas' : (w.rol || 'Colaborador')}</div>
          <div class="team-sede" style="font-size: 0.6rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
             <i class="fa-solid fa-location-dot" style="margin-right: 4px;"></i> Sede ${w.sede || 'No asignada'}
          </div>
          
          <div class="team-units" style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:-8px; margin-bottom:15px; opacity: 0.8;">
            ${(() => {
              const units = w.unidades || w.ecosistemas_autorizados || [];
              return units.map(u => {
                const name = u.replace('Renew ', '').toLowerCase();
                let icon = 'fa-circle';
                let color = '#94a3b8';
                if (name.includes('solar')) { icon = 'fa-sun'; color = '#f59e0b'; }
                else if (name.includes('water')) { icon = 'fa-droplet'; color = '#0ea5e9'; }
                else if (name.includes('home')) { icon = 'fa-house'; color = '#84cc16'; }
                return `<i class="fa-solid ${icon}" style="font-size: 0.65rem; color: ${color};" title="${u}"></i>`;
              }).join('');
            })()}
          </div>
          
          <div class="team-contact">
            ${w.email ? `
              <a href="mailto:${w.email}" class="contact-icon" title="${w.email}">
                <i class="fas fa-envelope"></i>
              </a>
            ` : ''}
            ${w.telefono ? `
              <a href="tel:${w.telefono}" class="contact-icon" title="${w.telefono}">
                <i class="fas fa-phone"></i>
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
}
