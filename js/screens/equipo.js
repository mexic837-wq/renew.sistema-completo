/* ============================================================
   RENEW OS – screens/equipo.js
   Directorio "Mi Equipo" con filtrado por Ecosistema
   ============================================================ */
import { getAdminWorkers } from '../api.js';
import { getCurrentUser, navigate } from '../app.js';
import { t } from '../i18n.js';

export async function renderMiEquipo() {
  const screen = document.getElementById('screen-mi-equipo');
  if (!screen) return;

  const user = getCurrentUser();
  const activeUnit = localStorage.getItem('active_unit') || 'Renew Solar';

  // UI Initial Skeleton
  screen.innerHTML = `
    <div class="dash-header" style="padding-bottom: 0;">
      <div class="dash-header-top" style="display: flex; align-items: center; justify-content: center; position: relative; min-height: 60px;">
        <button id="btn-team-back" style="position: absolute; left: 0; background: none; border: none; color: var(--text); padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div class="dash-greeting" style="text-align: center;">
          <div class="greeting-time" id="team-greeting-time">Compañeros de</div>
          <h1 style="margin: 0; font-size: 1.3rem;">${activeUnit}</h1>
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

  // Add event listener for back button
  setTimeout(() => {
    const btnBack = document.getElementById('btn-team-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => navigate('dashboard'));
    }
  }, 100);

  try {
    const workers = await getAdminWorkers();
    const grid = document.getElementById('team-grid');
    
    // Filtrar por ecosistema
    // Nota: El campo puede llamarse 'unidades' o 'ecosistemas_autorizados'
    const filtered = workers.filter(w => {
      const units = w.unidades || w.ecosistemas_autorizados || [];
      return units.includes(activeUnit);
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fas fa-users-slash" style="font-size: 3rem; opacity: 0.2; margin-bottom: 16px;"></i>
          <p style="font-weight: 600;">No hay compañeros asignados a ${activeUnit} aún.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((w, idx) => {
      const initials = (w.nombre?.[0] || '') + (w.apellido?.[0] || '');
      const photoUrl = w.foto || w.photo || null;
      
      return `
        <div class="team-card animate-fade-in" style="animation-delay: ${idx * 0.05}s">
          <div class="team-photo-wrapper">
            ${photoUrl 
              ? `<img src="${photoUrl}" class="team-photo" alt="${w.nombre}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <div class="team-photo" style="display:none; align-items:center; justify-content:center; font-weight:900; color:var(--text-muted); font-size:1.2rem; background:var(--bg-secondary);">${initials}</div>`
              : `<div class="team-photo" style="display:flex; align-items:center; justify-content:center; font-weight:900; color:var(--text-muted); font-size:1.2rem; background:var(--bg-secondary);">${initials}</div>`
            }
          </div>
          <div class="team-name">${w.nombre} ${w.apellido || ''}</div>
          <div class="team-role">${w.rol || 'Colaborador'}</div>
          
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

  } catch (err) {
    console.error('Error rendering team:', err);
    const grid = document.getElementById('team-grid');
    if (grid) grid.innerHTML = `<p style="color:red; text-align:center;">Error al cargar el equipo.</p>`;
  }
}
