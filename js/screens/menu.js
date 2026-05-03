/* ============================================================
   RENEW SOLAR – screens/menu.js
   Full-screen Main Menu Section
   ============================================================ */
import { getCurrentUser, logout, navigate } from '../app.js';
import { t, getLang, setLang, langSwitcherHTML } from '../i18n.js';
import { getDB } from '../api.js';

export async function renderMenu() {
  const user = getCurrentUser();
  const screen = document.getElementById('screen-menu');
  if (!screen) return;


  const adminRoles = ['Admin', 'Administrador', 'Desarrollador', 'CEO'];
  const isAdmin = adminRoles.includes(user.rol);

  // Roles que pueden ver el Inventario Real (técnicos y superiores)
  const inventarioRoles = ['Técnico', 'Contabilidad', 'Finanzas', 'Supervisión', 'CEO', 'Admin', 'Administrador', 'Desarrollador'];
  const canSeeInventario = inventarioRoles.includes(user.rol);

  // ─ Acceso a formularios de Renew Water ─────────────────────────────
  // Admins/CEO y superiores siempre tienen acceso.
  // Vendedores: solo si tienen el pipeline Renew Water asignado en su perfil.
  const waterHighRoles = ['Admin', 'Administrador', 'Desarrollador', 'CEO', 'Supervisión', 'Finanzas', 'Contabilidad'];
  let canSeeWaterForms = waterHighRoles.includes(user.rol);

  if (!canSeeWaterForms && user.rol === 'Vendedor') {
    // Verificar si el vendedor tiene acceso al pipeline Renew Water
    try {
      const db = getDB();
      const waterPipeline = (db.Admin_Pipelines || []).find(p =>
        p.nombre && p.nombre.toLowerCase().includes('water')
      );
      if (waterPipeline) {
        // Buscar permisos del usuario en ese pipeline
        const userPerms = user.pipeline_perms || [];
        canSeeWaterForms = userPerms.includes(waterPipeline.id) ||
          // Verificar si tiene algún proyecto activo en Renew Water
          (db.Proyectos_Dinamicos || []).some(p =>
            p.pipeline_id === waterPipeline.id &&
            p.vendedor_id === user.id
          );
      }
    } catch(e) {
      console.warn('No se pudo verificar acceso a Renew Water:', e);
    }
  }

  const isDark = document.body.classList.contains('dark-theme');

  screen.innerHTML = `
    <div class="dash-header">
      <div class="dash-header-top">
        <div class="dash-greeting">
          <h1>${t('menu_title')} ⚙️</h1>
          <p style="color:var(--text-muted); font-size:0.8rem; margin-top:4px;">${t('menu_subtitle')}</p>
        </div>
      </div>
    </div>

    <div class="menu-body" style="padding: 0 24px 100px;">

      <!-- BLOQUE 2: CONFIGURACIÓN (List) -->
      <p class="menu-section-label" style="margin-top:32px;">${t('menu_settings')}</p>
      <div class="menu-list">
        <div class="menu-list-item">
          <div class="menu-item-left">
            <div class="menu-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
            <span>${t('menu_account')}</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron"><polyline points="9 18 15 12 9 6"/></svg>
        </div>

        <div class="menu-list-item" id="btn-menu-notifs" style="cursor: pointer;">
          <div class="menu-item-left">
            <div class="menu-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <span>${t('menu_notifs')}</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron"><polyline points="9 18 15 12 9 6"/></svg>
        </div>



        <div class="menu-list-item" id="btn-theme-toggle-mobile">
          <div class="menu-item-left">
            <div class="menu-item-icon" id="theme-mobile-icon">
              <svg class="sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <svg class="moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </div>
            <span>${t('menu_theme')}: <b id="theme-status-text">${isDark ? t('menu_theme_dark') : t('menu_theme_light')}</b></span>
          </div>
          <div class="theme-switch-indicator"></div>
        </div>

        <!-- LANGUAGE SWITCHER -->
        <div class="menu-list-item" style="flex-direction:column; align-items:flex-start; gap:12px; cursor:default;">
          <div class="menu-item-left">
            <div class="menu-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <span>${t('menu_language')}</span>
          </div>
          ${langSwitcherHTML()}
        </div>

        <div class="menu-list-item">
          <div class="menu-item-left">
            <div class="menu-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-7.6 8.38 8.38 0 0 1 3.8.9L21 3z"/></svg></div>
            <span>${t('menu_support')}</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

      <!-- BLOQUE 3: LOGOUT -->
      <button class="btn btn-logout-wide" id="btn-logout-main">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        ${t('menu_logout')}
      </button>

      <div style="text-align:center; margin-top:40px; opacity:0.3;">
        <img src="assets/images/renew copia logo.png" alt="Renew Solar" style="height:24px; filter:grayscale(1);">
        <p style="font-size:0.6rem; font-weight:800; margin-top:8px; letter-spacing:1px; color:var(--text-muted);">VERSION 2.4.0</p>
      </div>

    </div>
  `;

  const btnLogout = document.getElementById('btn-logout-main');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if(confirm(getLang() === 'es' ? '¿Seguro que deseas cerrar tu sesión?' : 'Are you sure you want to sign out?')) {
        logout();
      }
    });
  }

  // Notificaciones
  const btnNotifs = document.getElementById('btn-menu-notifs');
  if (btnNotifs) {
    btnNotifs.addEventListener('click', () => {
      mostrarModalNotificaciones(user);
    });
  }

  // Re-render on language change
  window.addEventListener('langchange', () => renderMenu(), { once: true });
}

function mostrarModalNotificaciones(user) {
  const db = getDB();
  const anuncios = db.anuncios_corporativos || [];
  
  // Filter announcements for this user
  const misAnuncios = anuncios.filter(an => {
    if (!an.estado_lecturas) return false;
    const miLectura = an.estado_lecturas.find(l => l.worker_id === user.id);
    return !!miLectura; // if it's in my reading list, it was sent to me
  }).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  let listHtml = misAnuncios.map(an => {
    const d = new Date(an.fecha);
    const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const miLectura = an.estado_lecturas.find(l => l.worker_id === user.id);
    const readHtml = (miLectura && miLectura.leido) 
      ? '<i class="fa-solid fa-check-double text-tealAccent text-xs"></i>' 
      : '<span style="font-size: 10px; padding: 2px 6px; background: #ff475720; color: #ff4757; border-radius: 4px; font-weight: bold;">NUEVO</span>';

    return `
      <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: var(--text);">${an.titulo}</h4>
          ${readHtml}
        </div>
        <p style="margin: 0 0 12px 0; font-size: 12px; color: var(--text-muted); line-height: 1.5; white-space: pre-wrap;">${an.mensaje}</p>
        <div style="font-size: 10px; color: var(--text-muted); text-align: right; font-weight: 600;">
          📅 ${dateStr}
        </div>
      </div>
    `;
  }).join('');

  if (misAnuncios.length === 0) {
    listHtml = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
        <i class="fa-solid fa-bell-slash" style="font-size: 32px; opacity: 0.3; margin-bottom: 12px;"></i>
        <p style="font-size: 12px; font-weight: 600;">No tienes notificaciones</p>
      </div>
    `;
  }

  const modalHtml = `
    <div id="modal-historial-notifs" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); opacity: 0; transition: opacity 0.3s ease; padding: 20px; box-sizing: border-box;">
      <div style="background: var(--surface); width: 100%; max-width: 480px; max-height: 85vh; border-radius: 24px; display: flex; flex-direction: column; transform: scale(0.95); opacity: 0; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; box-shadow: 0 20px 40px rgba(0,0,0,0.4); border: 1px solid var(--border);">
        
        <div style="padding: 24px 24px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(0, 245, 212, 0.1); display: flex; align-items: center; justify-content: center; color: #00f5d4;">
              <i class="fa-solid fa-bell"></i>
            </div>
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--text);">Centro de Notificaciones</h3>
              <p style="margin: 0; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Historial de Anuncios</p>
            </div>
          </div>
          <button id="btn-close-notifs" style="background: none; border: none; font-size: 20px; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 50%; width: 32px; height: 32px; transition: background 0.2s;" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='none'">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="padding: 20px; overflow-y: auto; flex: 1;">
          ${listHtml}
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('modal-historial-notifs');
  const innerCard = modal.querySelector('div>div');

  // Animate in
  setTimeout(() => {
    modal.style.opacity = '1';
    innerCard.style.transform = 'scale(1)';
    innerCard.style.opacity = '1';
  }, 10);

  const closeFn = () => {
    modal.style.opacity = '0';
    innerCard.style.transform = 'scale(0.95)';
    innerCard.style.opacity = '0';
    setTimeout(() => modal.remove(), 300);
  };

  document.getElementById('btn-close-notifs').addEventListener('click', closeFn);
}
