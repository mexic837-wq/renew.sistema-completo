/* ============================================================
   RENEW SOLAR – screens/login.js
   ============================================================ */
import { loginUser } from '../api.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../app.js';
import { t } from '../i18n.js';


export function renderLogin() {
  const screen = document.getElementById('screen-login');
  screen.innerHTML = `
    <div class="login-logo-wrap">
      <img src="assets/images/renew copia logo.png" alt="Equipo Renew" class="login-logo" />
      <div class="login-brand">Equipo Renew</div>
      <div class="login-tagline">${t('login_tagline')}</div>
    </div>

    <div class="login-card">
      <h2>${t('login_welcome')}</h2>
      <p>${t('login_subtitle')}</p>

      <div class="field-group">
        <label for="login-email">${t('login_email')}</label>
        <div class="input-wrap">
          <input type="email" id="login-email" placeholder="tu@renewsolar.com" autocomplete="email" />
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
        </div>
      </div>
 
      <div class="field-group">
        <label for="login-password">${t('login_password')}</label>
        <div class="input-wrap">
          <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password" />
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <button class="toggle-pw" id="toggle-pw" type="button" aria-label="${t('login_password')}">
            <svg id="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>

      <button class="btn btn-primary" id="btn-login">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        ${t('login_btn')}
      </button>

      <div class="forgot-link">
        ${t('login_help')} <a href="mailto:admin@renewsolar.com">${t('login_contact')}</a>
      </div>
    </div>

  `;

  // ── Event Listeners ──────────────────────────────────────
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const loginBtn = document.getElementById('btn-login');
  const togglePw = document.getElementById('toggle-pw');
  const eyeIcon = document.getElementById('eye-icon');

  // Password toggle
  togglePw.addEventListener('click', () => {
    const isText = passwordInput.type === 'text';
    passwordInput.type = isText ? 'password' : 'text';
    eyeIcon.innerHTML = isText
      ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`
      : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  });

  // Submit on Enter
  [emailInput, passwordInput].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  });

  loginBtn.addEventListener('click', handleLogin);

  async function handleLogin() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showToast('Por favor completa todos los campos.', 'error');
      return;
    }

    loginBtn.classList.add('loading');
    loginBtn.innerHTML = '';

    try {
      const user = await loginUser(email, password);
      localStorage.setItem('rs_user', JSON.stringify(user));
      
      // Admin Redirection
      if (['Admin', 'Manager'].includes(user.rol)) {
        window.location.href = 'admin.html';
        return;
      }

      localStorage.setItem('active_unit', (user.unidades && user.unidades.length > 0) ? user.unidades[0] : 'Renew Solar');
      window.appNavigate('dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      loginBtn.classList.remove('loading');
      loginBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        ${t('login_btn')}`;

    }
  }
}
