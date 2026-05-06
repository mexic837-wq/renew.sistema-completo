/* ============================================================
   RENEW SOLAR – screens/hub.js
   Screen: Selector de Ecosistema
   ============================================================ */
import { getCurrentUser, logout } from '../api.js';
// Removed import from ../app.js to break circular dependency

export function renderHub() {
  const screen = document.getElementById('screen-hub');
  const user = getCurrentUser();

  const units = user.unidades || ['Renew Solar'];

  const cardsHtml = units.map((unit, index) => {
    let icon, color, gradient;
    if (unit === 'Renew Solar') {
      icon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
      color = 'var(--primary)';
      gradient = 'linear-gradient(135deg, rgba(13,148,136,0.1) 0%, rgba(5,150,105,0.1) 100%)';
    } else if (unit === 'Renew Water') {
      icon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
      color = '#0284c7';
      gradient = 'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(2,132,199,0.1) 100%)';
    } else {
      icon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
      color = '#6366f1';
      gradient = 'linear-gradient(135deg, rgba(129,140,248,0.1) 0%, rgba(79,70,229,0.1) 100%)';
    }

    return `
      <div class="hub-card slide-in-bottom" data-unit="${unit}" style="background: ${gradient}; border-color: ${color}35; animation-delay: ${0.1 * index}s">
        <div class="hub-icon" style="color: ${color}">${icon}</div>
        <div class="hub-title" style="color: ${color}">${unit}</div>
      </div>
    `;
  }).join('');

  screen.innerHTML = `
    <div class="hub-header slide-in-bottom">
      <h2>Selector de Ecosistema</h2>
      <p>Selecciona tu unidad de negocio activa para continuar.</p>
    </div>
    
    <div class="hub-grid">
      ${cardsHtml}
    </div>
    
    <div style="margin-top: 40px; text-align: center; display:flex; flex-direction:column; gap:12px; align-items:center" class="slide-in-bottom" style="animation-delay: 0.4s">

      <button class="btn btn-ghost" id="hub-logout">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Cerrar Sesión
      </button>
    </div>
  `;

  // Auto-select first unit and skip directly to dashboard
  const firstUnit = units[0] || 'Renew Solar';
  if (!localStorage.getItem('active_unit')) {
    localStorage.setItem('active_unit', firstUnit);
  }
  
  // Use setTimeout to avoid synchronous recursion in navigate()
  setTimeout(() => {
    if (window.location.hash.includes('hub')) {
      window.appNavigate('dashboard');
    }
  }, 100);


  if (user.rol === 'Admin') {
    // Moved to mobile footer menu
  }

  document.getElementById('hub-logout').addEventListener('click', () => {
    localStorage.removeItem('active_unit');
    logout();
  });
}
