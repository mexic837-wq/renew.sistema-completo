/* ============================================================
   RENEW WATER — js/app.js
   Responsabilidades:
     · Configuración global (Webhook URL)
     · Control de pestañas (tab switching)
     · Sistema de notificaciones toast
     · Formateo de campos & defaults de fecha
     · Orquestación: vincula creditForm.js y workOrderForm.js
   ============================================================ */

/* ════════════════════════════════════════════════════════════
   CONFIGURACIÓN — <i class="fa-solid fa-star"></i> Solo edita esta sección
════════════════════════════════════════════════════════════ */
const APP_CONFIG = {
  /**
   * URL del Webhook de n8n donde se envían los formularios.
   * Reemplaza este valor con tu URL real de n8n.
   *
   * Ejemplo:
   *   webhookUrl: 'https://n8n.tudominio.com/webhook/renew-water'
   */
  webhookUrl: 'https://n8n.renewgroup.site/webhook/formulario',

  /** Duración (ms) del toast antes de ocultarse */
  toastDuration: 4500,
};

/* ════════════════════════════════════════════════════════════
   TAB SWITCHING
════════════════════════════════════════════════════════════ */

/**
 * Cambia el panel activo y el botón de pestaña activo.
 * @param {string} id   - 'credit' | 'workorder'
 * @param {HTMLElement} btn - Botón que disparó el evento
 */
/**
 * Cambia el panel activo y el botón de pestaña activo.
 * @param {string} id   - 'credit' | 'workorder' | 'contract'
 * @param {HTMLElement} btn - Botón que disparó el evento
 */
function switchTab(id, btn) {
  console.log('Switching to tab:', id);
  const panel = document.getElementById('panel-' + id);
  if (!panel) {
    console.error('Panel not found:', 'panel-' + id);
    return;
  }

  document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });

  panel.classList.add('active');
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
  }

  document.querySelector('.main-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ════════════════════════════════════════════════════════════
   TOAST NOTIFICATION
════════════════════════════════════════════════════════════ */

/**
 * Muestra un toast de notificación.
 * @param {string} msg      - Mensaje a mostrar
 * @param {'success'|'error'} type - Tipo de notificación
 * @param {number} [duration]     - Duración en ms
 */
function showToast(msg, type = 'success', duration = APP_CONFIG.toastDuration) {
  const toast = document.getElementById('toast');
  const icon  = document.getElementById('toast-icon');
  const text  = document.getElementById('toast-message');

  toast.className = '';
  icon.textContent = type === 'success' ? '<i class="fa-solid fa-check text-green-500"></i>' : '<i class="fa-solid fa-xmark text-red-500"></i>';
  text.textContent = msg;
  toast.classList.add(type, 'show');

  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ════════════════════════════════════════════════════════════
   UI HELPERS — Campos condicionales
════════════════════════════════════════════════════════════ */

/** Muestra/oculta el input de texto "Otro equipo" */
function toggleOtherEquipment(checkbox) {
  const wrapper = document.getElementById('other_equipment_wrapper');
  wrapper.classList.toggle('visible', checkbox.checked);
  if (!checkbox.checked) document.getElementById('eq_other_text').value = '';
}

/** Muestra/oculta el input de texto "Otro horario" */
function toggleScheduleOther(radio) {
  const wrapper   = document.getElementById('schedule_other_wrapper');
  const textInput = document.getElementById('wo_schedule_other_text');
  const isOther   = radio.value === 'Otro' && radio.checked;

  wrapper.classList.toggle('visible', isOther);

  document.querySelectorAll('input[name="wo_schedule"]').forEach(r => {
    if (r !== radio) {
      r.addEventListener('change', () => {
        wrapper.classList.remove('visible');
        textInput.value = '';
      }, { once: true });
    }
  });
}

/** Muestra/oculta el input de texto "Otro piso" */
function toggleFloorOther(radio) {
  const wrapper   = document.getElementById('floor_other_wrapper');
  const textInput = document.getElementById('wo_floor_other_text');
  const isOther   = radio.value === 'Otro' && radio.checked;

  wrapper.classList.toggle('visible', isOther);

  document.querySelectorAll('input[name="wo_floor"]').forEach(r => {
    if (r !== radio) {
      r.addEventListener('change', () => {
        wrapper.classList.remove('visible');
        textInput.value = '';
      }, { once: true });
    }
  });
}

/* ════════════════════════════════════════════════════════════
   AUTO-FORMAT HELPERS
════════════════════════════════════════════════════════════ */

/** Formato MM/YY para la expiración de la tarjeta */
function initCreditCardExpFormat() {
  const expInput = document.getElementById('wo_cc_exp');
  if (!expInput) return;
  expInput.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').substring(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    this.value = v;
  });
}

/** Establece la fecha de hoy en el campo de fecha de la Orden de Trabajo */
function setTodayDefault() {
  const woDate = document.getElementById('wo_date');
  if (woDate && !woDate.value) {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yyyy = today.getFullYear();
    woDate.value = `${mm}/${dd}/${yyyy}`;
  }
}

/**
 * Comprime una imagen antes de enviarla para evitar errores de tamaño (HTTP 500).
 * @param {File} file 
 * @param {number} maxWidth 
 * @param {number} maxHeight 
 * @param {number} quality 
 * @returns {Promise<string>} Base64 de la imagen comprimida
 */
function compressImage(file, maxWidth = 1000, maxHeight = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Retornar como JPEG para mejor compresión
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/** 
 * Maneja la selección de archivo para mostrar preview y comprimir.
 */
async function handleFileSelect(input, previewId) {
  const preview = document.getElementById(previewId);
  const file = input.files[0];
  
  if (file) {
    try {
      // Mostrar estado de "procesando"
      preview.innerHTML = '<p style="font-size: 0.8rem; color: #666; margin-top: 5px;"><i class="fa-solid fa-fire text-orange-500"></i> Comprimiendo imagen...</p>';
      
      const compressedBase64 = await compressImage(file);
      
      preview.innerHTML = `<img src="${compressedBase64}" style="max-width: 100%; border-radius: 8px; margin-top: 10px; border: 1px solid #ddd;" />`;
      preview.dataset.base64 = compressedBase64;
    } catch (error) {
      console.error("Error al procesar imagen:", error);
      showToast("Error al procesar la imagen. Intenta con otra.", "error");
    }
  } else {
    preview.innerHTML = '';
    delete preview.dataset.base64;
  }
}

/**
 * Convierte un file input a Base64 de forma asíncrona (si es necesario).
 */
async function getFileBase64(inputId, previewId) {
  const preview = document.getElementById(previewId);
  if (preview && preview.dataset.base64) {
    return preview.dataset.base64;
  }
  return "";
}

/** Toggle visibilidad de contraseña */
function togglePassword(id) {
  const input = document.getElementById(id);
  const btn = input.nextElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '<i class="fa-solid fa-lock"></i>';
  } else {
    input.type = 'password';
    btn.textContent = '<i class="fa-solid fa-eye"></i>️';
  }
}

/** Formato MM/DD/YYYY para entradas de fecha */
function initDateMasks() {
  document.querySelectorAll('.date-mask').forEach(input => {
    input.addEventListener('input', function(e) {
      let v = this.value.replace(/\D/g, '').substring(0, 8);
      if (v.length > 4) {
        v = v.substring(0, 2) + '/' + v.substring(2, 4) + '/' + v.substring(4);
      } else if (v.length > 2) {
        v = v.substring(0, 2) + '/' + v.substring(2);
      }
      this.value = v;
    });
  });
}

/* ════════════════════════════════════════════════════════════
   INICIALIZACIÓN
════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initCreditCardExpFormat();
  initDateMasks();
  setTodayDefault();

  // Vincular formularios a sus handlers
  const creditForm    = document.getElementById('form-credit');
  const workOrderForm = document.getElementById('form-workorder');
  const contractForm  = document.getElementById('form-contract');

  if (creditForm)    creditForm.addEventListener('submit', handleCreditFormSubmit);
  if (workOrderForm) workOrderForm.addEventListener('submit', handleWorkOrderSubmit);
  if (contractForm)  contractForm.addEventListener('submit', handleContractSubmit);

  // ── Auto-switch de pestaña según parámetro URL ──────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  
  if (tabParam === 'workorder') {
    const woBtn = document.getElementById('tab-workorder');
    if (woBtn) switchTab('workorder', woBtn);
  } else if (tabParam === 'contract') {
    const ctBtn = document.getElementById('tab-contract');
    if (ctBtn) switchTab('contract', ctBtn);
  }
});
