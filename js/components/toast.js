/* ============================================================
   RENEW SOLAR – components/toast.js
   ============================================================ */

const container = document.createElement('div');
container.className = 'toast-container';
document.body.appendChild(container);

export function showToast(message, type = 'default', duration = 3500) {
  // Si estamos en el panel de admin y existe addNotification, delegamos
  if (window.addNotification) {
    const titles = {
      success: 'Éxito',
      error: 'Error',
      warning: 'Atención',
      info: 'Información',
      default: 'Notificación'
    };
    window.addNotification(titles[type] || 'Sistema', message, type);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type !== 'default' ? type : ''}`;

  const icon = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
    error:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
    info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
    default: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  }[type] || '';

  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

window.showToast = showToast;
