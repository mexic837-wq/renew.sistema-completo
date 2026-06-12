/* ============================================================
   RENEW SOLAR – screens/menu.js
   Full-screen Main Menu Section
   ============================================================ */
import { getCurrentUser, logout, uploadFile, saveGranular, getDB } from '../api.js';
// Removed import from ../app.js to break circular dependency
import { t, getLang, setLang, langSwitcherHTML } from '../i18n.js';
import { showToast } from '../components/toast.js';

export async function renderMenu() {
  const user = getCurrentUser();
  const screen = document.getElementById('screen-menu');
  if (!screen) return;


  const adminRoles = ['Admin', 'Administrador', 'Desarrollador', 'CEO'];
  const isAdmin = adminRoles.includes(user.rol);

  // Roles que pueden ver el Inventario Real (técnicos y superiores)
  const inventarioRoles = ['Técnico', 'Contabilidad', 'Procesador', 'CEO', 'Admin', 'Administrador', 'Desarrollador'];
  const canSeeInventario = inventarioRoles.includes(user.rol);

  // ─ Acceso a formularios de Renew Water ─────────────────────────────
  // Admins/CEO y superiores siempre tienen acceso.
  // Vendedores: solo si tienen el pipeline Renew Water asignado en su perfil.
  const waterHighRoles = ['Admin', 'Administrador', 'Desarrollador', 'CEO', 'Supervisión', 'Contabilidad', 'Procesador'];
  let canSeeWaterForms = waterHighRoles.includes(user.rol);

  const isVentasUser = ['Vendedor', 'Representante de Ventas', 'Supervisor', 'Supervisión'].includes(user.rol);
  if (!canSeeWaterForms && isVentasUser) {
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
        <div class="menu-list-item" id="btn-menu-account" style="cursor: pointer;">
          <div class="menu-item-left">
            <div class="menu-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
            <span>${t('menu_account')}</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron"><polyline points="9 18 15 12 9 6"/></svg>
        </div>

        <div class="menu-list-item" id="btn-menu-academy" style="cursor: pointer;">
          <div class="menu-item-left">
            <div class="menu-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg></div>
            <span>Academia</span>
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

        <div class="menu-list-item" id="btn-menu-support" style="cursor: pointer;">
          <div class="menu-item-left">
            <div class="menu-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
              </svg>
            </div>
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

  // Mi Cuenta
  const btnAccount = document.getElementById('btn-menu-account');
  if (btnAccount) {
    btnAccount.addEventListener('click', () => mostrarModalCuenta(user));
  }

  // Academia
  const btnAcademy = document.getElementById('btn-menu-academy');
  if (btnAcademy) {
    btnAcademy.addEventListener('click', () => {
      if (window.appNavigate) window.appNavigate('academy');
    });
  }

  // Soporte Técnico
  const btnSupport = document.getElementById('btn-menu-support');
  if (btnSupport) {
    btnSupport.addEventListener('click', () => {
      window.location.href = 'mailto:miguel@renewsolarus.com?subject=Soporte Técnico Renew OS';
    });
  }

  // Re-render on language change
  window.addEventListener('langchange', () => renderMenu(), { once: true });
}

function mostrarModalNotificaciones(user) {
  const db = getDB();
  const anuncios = db.anuncios_corporativos || [];
  
  const misAnuncios = anuncios.filter(an => {
    if (!an.estado_lecturas) return false;
    const miLectura = an.estado_lecturas.find(l => l.vendedor_id === user.id);
    return !!miLectura; 
  }).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  let listHtml = misAnuncios.map(an => {
    const d = new Date(an.fecha);
    const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const miLectura = an.estado_lecturas.find(l => l.vendedor_id === user.id);
    const readHtml = (miLectura && miLectura.leido) 
      ? '<i class="fa-solid fa-check-double text-tealAccent text-xs"></i>' 
      : '<span style="font-size: 10px; padding: 2px 6px; background: #ff475720; color: #ff4757; border-radius: 4px; font-weight: bold;">NUEVO</span>';

    return `
      <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: var(--text);">${an.titulo}</h4>
          ${readHtml}
        </div>
        ${an.foto_url ? `<img src="${an.foto_url}" style="width:100%; height:120px; object-fit:cover; border-radius:8px; margin-bottom:12px; border:1px solid var(--border);">` : ''}
        <p style="margin: 0 0 12px 0; font-size: 12px; color: var(--text-muted); line-height: 1.5; white-space: pre-wrap;">${an.mensaje}</p>
        <div style="font-size: 10px; color: var(--text-muted); text-align: right; font-weight: 600;">
          📅 ${dateStr}
        </div>
      </div>
    `;
  }).join('');

  if (misAnuncios.length === 0) {
    listHtml = `
      <div style="padding: 40px 20px; text-align: center; opacity: 0.5;">
        <i class="fa-solid fa-bell-slash" style="font-size: 3rem; margin-bottom: 16px; display: block;"></i>
        <p style="font-size: 14px; font-weight: 700;">No tienes notificaciones</p>
      </div>
    `;
  }

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center; padding:20px;';
  modal.innerHTML = `
    <div style="background:var(--surface); width:100%; max-width:450px; border-radius:24px; border:1px solid var(--border); overflow:hidden; display:flex; flex-direction:column; max-height:80vh;">
      <div style="padding:20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:36px; height:36px; border-radius:10px; background:rgba(0, 245, 212, 0.1); color:var(--primary); display:flex; align-items:center; justify-content:center;">
            <i class="fa-solid fa-bell"></i>
          </div>
          <h3 style="margin:0; font-size:16px; font-weight:900; color:var(--text); text-transform:uppercase; letter-spacing:0.5px;">Centro de Notificaciones</h3>
        </div>
        <button id="close-notifs" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.5rem;">&times;</button>
      </div>
      <div style="flex:1; overflow-y:auto; padding:20px;">
        ${listHtml}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#close-notifs').onclick = () => modal.remove();
}

function mostrarModalCuenta(user) {
  const avatar = user.foto || user.photo || user.avatar_url || 'assets/images/default-avatar.png';
  const rank = user.rango || 'Novato';
  
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center; padding:20px;';
  modal.innerHTML = `
    <div class="animate-bounce-in" style="background:var(--surface); width:100%; max-width:400px; border-radius:32px; border:1px solid var(--border); overflow:hidden; position:relative; box-shadow: 0 30px 60px rgba(0,0,0,0.5);">
      
      <div style="height:100px; background:linear-gradient(135deg, #00f5d4 0%, #00d2ff 100%); opacity:0.15;"></div>
      
      <div style="text-align:center; margin-top:-50px; position:relative; z-index:2;">
        <div style="position:relative; width:100px; height:100px; margin:0 auto;">
          <div style="width:100px; height:100px; border-radius:30px; background:var(--surface); border:4px solid var(--surface); overflow:hidden; box-shadow: 0 10px 20px rgba(0,0,0,0.2);">
            <img id="user-avatar-img" src="${avatar}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='assets/images/default-avatar.png'">
          </div>
          <label for="input-avatar" style="position:absolute; bottom:-5px; right:-5px; width:36px; height:36px; border-radius:12px; background:var(--primary); color:var(--bg); display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border:3px solid var(--surface);">
            <i class="fa-solid fa-camera" style="font-size:14px;"></i>
          </label>
          <input type="file" id="input-avatar" style="display:none;" accept="image/*">
        </div>
        <div style="margin-top:12px;">
           <h3 style="margin:0; font-size:1.4rem; font-weight:900; color:var(--text-primary);">${user.nombre} ${user.apellido}</h3>
           <span style="display:inline-block; margin-top:4px; padding:4px 12px; background:var(--primary); color:var(--bg); border-radius:100px; font-size:0.65rem; font-weight:950; text-transform:uppercase; letter-spacing:1px;">${rank}</span>
        </div>
      </div>

      <div style="padding:32px; display:flex; flex-direction:column; gap:20px;">
        
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="width:40px; height:40px; border-radius:12px; background:var(--bg); display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
            <i class="fa-solid fa-envelope"></i>
          </div>
          <div>
            <p style="margin:0; font-size:0.65rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Email Corporativo</p>
            <p style="margin:2px 0 0; font-size:0.9rem; font-weight:700; color:var(--text-primary);">${user.email}</p>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:16px;">
          <div style="width:40px; height:40px; border-radius:12px; background:var(--bg); display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
            <i class="fa-solid fa-phone"></i>
          </div>
          <div>
            <p style="margin:0; font-size:0.65rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Teléfono Móvil</p>
            <p style="margin:2px 0 0; font-size:0.9rem; font-weight:700; color:var(--text-primary);">${user.telefono || 'Sin registrar'}</p>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:16px;">
          <div style="width:40px; height:40px; border-radius:12px; background:var(--bg); display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
            <i class="fa-solid fa-id-card-clip"></i>
          </div>
          <div>
            <p style="margin:0; font-size:0.65rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Rol Organizacional</p>
            <p style="margin:2px 0 0; font-size:0.9rem; font-weight:700; color:var(--text-primary);">${(user.rol || '').toLowerCase().includes('vendedor') ? 'Representante de Ventas' : user.rol}</p>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:16px;">
          <div style="width:40px; height:40px; border-radius:12px; background:var(--bg); display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
            <i class="fa-solid fa-lock"></i>
          </div>
          <div style="flex:1;">
            <p style="margin:0; font-size:0.65rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Cambiar Contraseña</p>
            <div style="display:flex; gap:8px; margin-top:4px;">
              <div style="position:relative; flex:1;">
                <input type="password" id="input-account-password" value="${user.password || user.pass || ''}" placeholder="Nueva contraseña" style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px 40px 8px 12px; color:var(--text-primary); font-size:0.85rem; outline:none; box-sizing:border-box;">
                <button type="button" onclick="const input = document.getElementById('input-account-password'); const icon = this.querySelector('i'); if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); } else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; width:24px; height:24px; transition:0.2s hover:color:var(--text-primary);">
                    <i class="fa-solid fa-eye"></i>
                </button>
              </div>
              <button id="btn-save-password" style="background:rgba(0, 245, 212, 0.1); color:var(--tealAccent); border:1px solid var(--tealAccent); border-radius:8px; padding:0 16px; font-weight:800; cursor:pointer; transition:0.2s;"><i class="fa-solid fa-check"></i></button>
            </div>
          </div>
        </div>

      </div>

      <div style="padding:0 32px 32px;">
        <button id="close-account" style="width:100%; padding:16px; border-radius:16px; border:none; background:var(--bg); color:var(--text-primary); font-weight:800; font-size:0.9rem; cursor:pointer;">Cerrar Detalles</button>
      </div>

    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#close-account').onclick = () => modal.remove();

  // Handle Avatar Change
  const inputAvatar = modal.querySelector('#input-avatar');
  if (inputAvatar) {
    inputAvatar.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        showToast('Subiendo nueva foto...', 'info');
        
        // 1. Upload to Supabase
        const photoUrl = await uploadFile(file, 'usuarios_perfiles');
        
        // 2. Update current UI
        const img = modal.querySelector('#user-avatar-img');
        if (img) img.src = photoUrl;

        // 3. Update User in DB
        const updatedUser = { ...user, foto: photoUrl };
        await saveGranular('usuarios', [updatedUser]);

        // 4. Update Local Session
        localStorage.setItem('rs_user', JSON.stringify(updatedUser));
        
        // 5. Update global app context if needed (triggers header update)
        window.dispatchEvent(new CustomEvent('user_updated', { detail: updatedUser }));

        showToast('Foto de perfil actualizada correctamente', 'success');
      } catch (err) {
        console.error('Error actualizando foto de perfil:', err);
        showToast('Fallo al actualizar la foto', 'error');
      }
    });
  }

  // Handle Password Change
  const btnSavePassword = modal.querySelector('#btn-save-password');
  const inputPassword = modal.querySelector('#input-account-password');
  if (btnSavePassword && inputPassword) {
    btnSavePassword.addEventListener('click', async () => {
      const newPass = inputPassword.value.trim();
      if (!newPass) return showToast('La contraseña no puede estar vacía', 'warning');
      
      try {
        const updatedUser = { ...user, password: newPass, pass: newPass };
        await saveGranular('usuarios', [updatedUser]);
        localStorage.setItem('rs_user', JSON.stringify(updatedUser));
        window.dispatchEvent(new CustomEvent('user_updated', { detail: updatedUser }));
        
        // Efecto visual en el botón
        btnSavePassword.innerHTML = '<i class="fa-solid fa-check-double"></i>';
        setTimeout(() => btnSavePassword.innerHTML = '<i class="fa-solid fa-check"></i>', 2000);
        
        showToast('Contraseña actualizada con éxito', 'success');
      } catch (err) {
        console.error('Error actualizando contraseña:', err);
        showToast('Error al actualizar contraseña', 'error');
      }
    });
  }
}
