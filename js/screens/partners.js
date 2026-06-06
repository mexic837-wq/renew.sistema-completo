/* ============================================================
   RENEW OS – screens/partners.js
   Directorio de Partners/Proveedores
   ============================================================ */
import { getAdminPartners } from '../api.js';
import { getCurrentUser, navigate } from '../app.js';
import { t } from '../i18n.js';

export async function renderPartners() {
  const screen = document.getElementById('screen-partners');
  if (!screen) return;

  const user = getCurrentUser();
  
  // UI Initial Skeleton
  screen.innerHTML = `
    <div class="dash-header" style="padding-bottom: 16px; position: sticky; top: 0; z-index: 50;">
      <div class="dash-header-top" style="display: flex; align-items: center; justify-content: center; position: relative; min-height: 40px; margin-bottom: 0;">
        <button id="btn-partners-back" style="position: absolute; left: 0; background: none; border: none; color: var(--text-primary); padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div class="dash-greeting" style="text-align: center;">
          <div class="greeting-time" style="margin-bottom: 2px;">Directorio de</div>
          <h1 style="margin: 0; font-size: 1.25rem;">Partners</h1>
        </div>
      </div>
    </div>

    <div class="partners-search-container" style="padding: 0 24px; margin-top: 16px;">
        <div class="relative group">
            <div class="absolute inset-0 bg-gradient-to-r from-tealAccent/20 to-blue-500/20 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div class="relative bg-white dark:bg-[#0B0F1A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm focus-within:border-tealAccent focus-within:ring-1 focus-within:ring-tealAccent transition-all overflow-hidden">
                <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm pointer-events-none"></i>
                <input type="text" id="partners-search-input" placeholder="Buscar empresa, contacto o servicio..." 
                    class="w-full bg-transparent border-none focus:ring-0 py-3 pl-11 pr-4 text-sm text-gray-900 dark:text-white outline-none placeholder-gray-400">
            </div>
        </div>
    </div>

    <div class="partners-container" style="padding: 24px; padding-bottom: 100px; width: 100%; max-width: 1600px; margin: 0 auto;">
      <div id="partners-grid" class="partners-grid-inner">
        <!-- Skeleton Loaders -->
        ${[1, 2, 3, 4, 5, 6].map(() => `
          <div class="partner-card skeleton" style="height: 220px; border-radius: 24px; background: var(--surface-alt); opacity: 0.5;"></div>
        `).join('')}
      </div>
    </div>

    <style>
      .partners-grid-inner {
        display: grid;
        grid-template-columns: repeat(1, 1fr);
        gap: 12px;
        width: 100%;
      }
      
      @media (min-width: 768px) {
        .partners-grid-inner {
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
          gap: 24px;
          padding: 10px 0;
        }
      }

      .partner-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 20px 16px;
        display: flex;
        flex-direction: column;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }
      .partner-card:active {
        transform: scale(0.98);
      }
      
      .partner-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .partner-photo-wrapper {
        width: 50px;
        height: 50px;
        border-radius: 14px;
        flex-shrink: 0;
        background: var(--surface-alt);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        color: var(--primary);
        border: 1px solid var(--border);
        overflow: hidden;
      }
      .partner-photo {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .partner-info {
        flex: 1;
        min-width: 0;
      }

      .partner-name {
        font-size: 1rem;
        font-weight: 850;
        color: var(--text-primary);
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .partner-contact-name {
        font-size: 0.75rem;
        color: var(--text-muted);
        font-weight: 600;
      }

      .partner-role-badge {
        font-size: 0.6rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 4px 10px;
        border-radius: 8px;
        background: rgba(0, 245, 212, 0.08);
        color: var(--primary);
        display: inline-block;
        margin-bottom: 12px;
      }
      
      .partner-details {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }
      
      .detail-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .detail-item i {
        width: 14px;
        color: var(--text-muted);
      }

      .partner-contact-row {
        display: flex;
        gap: 8px;
        margin-top: auto;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }
      .partner-icon-btn {
        flex: 1;
        height: 36px;
        border-radius: 12px;
        background: var(--surface-alt);
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        transition: all 0.2s;
        text-decoration: none;
        gap: 6px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        padding: 0 8px;
      }
      .partner-icon-btn:hover {
        background: var(--primary);
        color: white;
      }
      
      .doc-badges {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 4px;
      }
      .doc-badge {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
      }
      
    </style>
  `;

  // Add event listener for back button
  setTimeout(() => {
    const btnBack = document.getElementById('btn-partners-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => navigate('dashboard'));
    }
  }, 100);

  try {
    const allPartners = await getAdminPartners();
    const grid = document.getElementById('partners-grid');
    const searchInput = document.getElementById('partners-search-input');
    
    function renderList(filtered) {
        if (filtered.length === 0) {
          grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
              <i class="fas fa-handshake-slash" style="font-size: 3.5rem; opacity: 0.15; margin-bottom: 20px;"></i>
              <p style="font-weight: 700; font-size: 1.1rem;">No se encontraron partners</p>
              <p style="font-size: 0.85rem; opacity: 0.7;">Intenta con otros términos de búsqueda.</p>
            </div>
          `;
          return;
        }

        grid.innerHTML = filtered.map((p, idx) => {
          const initials = (p.empresa?.[0] || p.contacto?.[0] || 'P').toUpperCase();
          const photoUrl = p.foto || null;
          const service = p.servicio || 'Proveedor';
          
          return `
            <div class="partner-card animate-fade-in" style="animation-delay: ${idx * 0.05}s">
              <div class="doc-badges">
                ${p.w9Url ? `<div class="doc-badge" style="background:rgba(245,158,11,0.1); color:#f59e0b;" title="W-9 disponible"><i class="fas fa-file-contract"></i></div>` : ''}
                ${p.seguroUrl ? `<div class="doc-badge" style="background:rgba(59,130,246,0.1); color:#3b82f6;" title="Seguro disponible"><i class="fas fa-shield-alt"></i></div>` : ''}
              </div>

              <div class="partner-header">
                <div class="partner-photo-wrapper">
                    ${photoUrl 
                      ? `<img src="${photoUrl}" class="partner-photo" alt="${p.empresa}">`
                      : initials
                    }
                </div>
                <div class="partner-info">
                    <div class="partner-name">${p.empresa || 'Empresa Sin Nombre'}</div>
                    <div class="partner-contact-name">${p.contacto || 'Sin contacto asignado'}</div>
                </div>
              </div>

              <div style="margin-bottom: 12px;">
                <div class="partner-role-badge">${service}</div>
              </div>
              
              <div class="partner-details">
                <div class="detail-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${p.area || 'Área no especificada'}</span>
                </div>
                ${p.telefono ? `
                    <div class="detail-item">
                        <i class="fas fa-phone-alt"></i>
                        <span>${p.telefono}</span>
                    </div>
                ` : ''}
                ${p.email ? `
                    <div class="detail-item">
                        <i class="fas fa-envelope"></i>
                        <span style="font-size:0.78rem; word-break:break-all;">${p.email}</span>
                    </div>
                ` : ''}
              </div>
              
              <div class="partner-contact-row">
                ${p.telefono ? `
                  <a href="tel:${p.telefono}" class="partner-icon-btn">
                    <i class="fas fa-phone"></i>
                    <span style="overflow:hidden; text-overflow:ellipsis;">Llamar</span>
                  </a>
                ` : ''}
                ${p.email ? `
                  <a href="https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(p.email)}" target="_blank" rel="noopener" class="partner-icon-btn">
                    <i class="fas fa-envelope"></i>
                    <span style="overflow:hidden; text-overflow:ellipsis;">Email</span>
                  </a>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');
    }

    // Initial render
    renderList(allPartners);

    // Search logic
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderList(allPartners);
                return;
            }
            
            const filtered = allPartners.filter(p => {
                return (p.empresa || '').toLowerCase().includes(query) ||
                    (p.contacto || '').toLowerCase().includes(query) ||
                    (p.servicio || '').toLowerCase().includes(query) ||
                    (p.area || '').toLowerCase().includes(query) ||
                    (p.email || '').toLowerCase().includes(query);
            });
            renderList(filtered);
        });
    }

  } catch (err) {
    console.error('Error rendering partners:', err);
    const grid = document.getElementById('partners-grid');
    if (grid) grid.innerHTML = `<p style="color:red; text-align:center; padding: 40px;">Error al cargar los partners.</p>`;
  }
}
