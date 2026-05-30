/* ============================================================
   RENEW WATER — js/creditForm.js
   Responsabilidades EXCLUSIVAS de la Aplicación de Crédito:
     · Recolección de todos los campos del formulario de crédito
     · Validación básica (campos required)
     · Limpieza del formulario tras envío exitoso
     · handleCreditFormSubmit() — handler de submit
   ============================================================ */

/* ════════════════════════════════════════════════════════════
   RECOLECTAR DATOS — Credit Application
════════════════════════════════════════════════════════════ */

/**
 * Lee todos los campos del formulario de crédito y retorna un objeto JSON.
 * Incluye campos escalares, radios y checkboxes.
 * @param {HTMLFormElement} formEl
 * @returns {Object} payload listo para enviar al webhook
 */
function collectCreditFormData(formEl) {
  const data = {};

  // ── Sección A: Aplicante Principal ──
  data.aplicante = {
    monto:            _val('ca_amount'),
    nombreCompleto:   _val('ca_fullname'),
    fechaNacimiento:  _val('ca_dob'),
    seguroSocial:     _val('ca_ssn'),
    licencia:         _val('ca_dl'),
    licenciaEstado:   _val('ca_dl_state'),
    licenciaExpedicion: _val('ca_dl_issue'),
    licenciaExpiracion: _val('ca_dl_exp'),
    telefono:         _val('ca_phone'),
    email:            _val('ca_email'),
    direccion:        _val('ca_address'),
    tiempoViviendo:   _val('ca_time_living'),
    pagoMensual:      _val('ca_mortgage_payment'),
    tipoVivienda:     _radio(formEl, 'ca_housingType'),
    estatusVivienda:  _radio(formEl, 'ca_housingStatus'),
    fotoId:           document.getElementById('ca_id_photo_preview')?.dataset.base64 || "",
  };

  // ── Sección B: Co-Aplicante ──
  data.coAplicante = {
    monto:            _val('cb_amount'),
    nombreCompleto:   _val('cb_fullname'),
    fechaNacimiento:  _val('cb_dob'),
    seguroSocial:     _val('cb_ssn'),
    licencia:         _val('cb_dl'),
    licenciaEstado:   _val('cb_dl_state'),
    licenciaExpedicion: _val('cb_dl_issue'),
    licenciaExpiracion: _val('cb_dl_exp'),
    telefono:         _val('cb_phone'),
    email:            _val('cb_email'),
    direccion:        _val('cb_address'),
    tiempoViviendo:   _val('cb_time_living'),
    pagoMensual:      _val('cb_mortgage_payment'),
    tipoVivienda:     _radio(formEl, 'cb_housingType'),
    estatusVivienda:  _radio(formEl, 'cb_housingStatus'),
    fotoId:           document.getElementById('cb_id_photo_preview')?.dataset.base64 || "",
  };

  // ── Sección C: Empleo e Ingresos — Aplicante ──
  data.empleoAplicante = {
    tipoIngreso:      _radio(formEl, 'ca_incomeType'),
    nombreEmpleo:     _val('ca_employer'),
    telefonoTrabajo:  _val('ca_work_phone'),
    direccionTrabajo: _val('ca_work_address'),
    posicion:         _val('ca_position'),
    tiempoTrabajo:    _val('ca_time_job'),
    pagoMensual:      _val('ca_monthly_income'),
    frecuenciaPago:   _radio(formEl, 'ca_incomeFreq'),
  };

  // ── Sección C: Empleo e Ingresos — Co-Aplicante ──
  data.empleoCoAplicante = {
    tipoIngreso:      _radio(formEl, 'cb_incomeType'),
    nombreEmpleo:     _val('cb_employer'),
    telefonoTrabajo:  _val('cb_work_phone'),
    direccionTrabajo: _val('cb_work_address'),
    posicion:         _val('cb_position'),
    tiempoTrabajo:    _val('cb_time_job'),
    pagoMensual:      _val('cb_monthly_income'),
    frecuenciaPago:   _radio(formEl, 'cb_incomeFreq'),
  };

  // ── Firma Digital ──
  const canvasAplicante = document.getElementById('firma-aplicante');
  if (canvasAplicante && checkSignatureDrawn('firma-aplicante')) {
    data.firma_aplicante = canvasAplicante.toDataURL('image/png');
  } else {
    data.firma_aplicante = ""; 
  }

  const canvasCoAplicante = document.getElementById('firma-co-aplicante');
  if (canvasCoAplicante && checkSignatureDrawn('firma-co-aplicante')) {
    data.firma_co_aplicante = canvasCoAplicante.toDataURL('image/png');
  } else {
    data.firma_co_aplicante = ""; 
  }

  // ── Representante de Ventas ──
  data.nombre_dealer = _val('rep_name');
  data.negocio_procedencia = _radio(formEl, 'ca_business_section');

  // Metadatos
  data.tipo_formulario = 'aplicacion_credito';
  data._timestamp      = new Date().toISOString();

  // ── Vincular con Proyecto o Cliente ──
  const urlParams = new URLSearchParams(window.location.search);
  data.proyectoId = urlParams.get('proyectoId') || null;
  data.clienteId = document.getElementById('selected_client_id')?.value || null;

  return data;
}

/* ════════════════════════════════════════════════════════════
   VALIDACIÓN — Credit Application
════════════════════════════════════════════════════════════ */

/**
 * Valida los campos requeridos del formulario de crédito.
 * Marca visualmente los campos vacíos con clase .error.
 * @param {HTMLFormElement} formEl
 * @returns {boolean} true si el formulario es válido
 */
function validateCreditForm(formEl) {
  let valid = true;
  formEl.querySelectorAll('[required]').forEach(field => {
    field.classList.remove('error');
    // Si el padre es pill-group, quitar error del padre
    if (field.parentElement.classList.contains('pill-group')) {
      field.parentElement.classList.remove('error');
    }

    let isInvalid = false;
    if (field.type === 'radio' || field.type === 'checkbox') {
      const name = field.name;
      const checked = formEl.querySelector(`input[name="${name}"]:checked`);
      if (!checked) isInvalid = true;
    } else {
      if (!field.value.trim()) isInvalid = true;
    }

    if (isInvalid) {
      valid = false;
      if (field.type === 'radio' || field.type === 'checkbox') {
        field.parentElement.classList.add('error');
      } else {
        field.classList.add('error');
      }
    }
  });
  return valid;
}

/* ════════════════════════════════════════════════════════════
   RESET — Credit Application
════════════════════════════════════════════════════════════ */

/**
 * Limpia completamente el formulario de crédito y los canvas de firma.
 * @param {HTMLFormElement} formEl
 */
function resetCreditForm(formEl) {
  formEl.reset();
  formEl.querySelectorAll('input[type="radio"], input[type="checkbox"]')
        .forEach(el => { el.checked = false; });
  formEl.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  clearSignature('firma-aplicante');
  clearSignature('firma-co-aplicante');
  
  // Limpiar fotos
  const previewA = document.getElementById('ca_id_photo_preview');
  if (previewA) {
    previewA.innerHTML = '';
    delete previewA.dataset.base64;
  }
  const previewB = document.getElementById('cb_id_photo_preview');
  if (previewB) {
    previewB.innerHTML = '';
    delete previewB.dataset.base64;
  }
  
  resetCreditClientSelection();
}

/* ════════════════════════════════════════════════════════════
   SUBMIT HANDLER — Credit Application
════════════════════════════════════════════════════════════ */

/**
 * Maneja el evento submit del formulario de Aplicación de Crédito.
 * Valida, recolecta datos y los envía al webhook configurado en app.js.
 * @param {SubmitEvent} e
 */
async function handleCreditFormSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const btn  = form.querySelector('.btn-submit');
  const span = btn.querySelector('.btn-text') || btn.querySelector('span');
  const originalLabel = span.textContent;

  // Validación
  if (!validateCreditForm(form)) {
    showToast('Completa los campos obligatorios marcados en rojo.', 'error');
    form.querySelector('.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Validación de cliente seleccionado
  const urlParams = new URLSearchParams(window.location.search);
  const proyectoId = urlParams.get('proyectoId');
  const clienteId = document.getElementById('selected_client_id')?.value;
  if (!proyectoId && !clienteId) {
    showToast('Debe seleccionar un cliente antes de enviar la aplicación.', 'error');
    document.getElementById('credit-client-selector')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Estado de carga
  btn.classList.add('loading');
  btn.disabled = true;
  span.textContent = 'Procesando...';
  showToast('Procesando Aplicación de Crédito… ⏳', 'success', 10000);

  const payload = collectCreditFormData(form);

  try {
    console.log('Generando Aplicación de Crédito localmente...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

    const response = await fetch('/api/generar-pdf', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload),
      signal : controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      // ── Descargar el PDF ──
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aplicacion_credito_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      // Subir documentos (ID Aplicante, ID Co-Aplicante, y el PDF)
      const fotoIdAplicante = payload.aplicante.fotoId;
      const fotoIdCoAplicante = payload.coAplicante.fotoId;
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const pdfBase64 = reader.result;
        try {
          const docsResp = await fetch('/api/save-credit-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clienteId: payload.clienteId || clienteId || "", 
              fotoIdAplicante,
              fotoIdCoAplicante,
              pdfBase64
            })
          });
          if (!docsResp.ok) {
             console.error('Error guardando los documentos en el cliente');
          }
        } catch (e) {
          console.error(e);
        }
        
        showToast('¡Aplicación de Crédito enviada y generada exitosamente! ✅', 'success');
        resetCreditForm(form);
        
        const pdfUrl = response.headers.get('X-Document-Url');
        if (proyectoId) {
          window.parent.postMessage({ type: 'CREDIT_APP_SUBMITTED', proyectoId, formData: payload, pdfUrl: pdfUrl }, '*');
        }
      };
    } else {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message) errorMsg += `: ${errorData.message}`;
      } catch (e) {
        // No es JSON, usar statusText
        if (response.statusText) errorMsg += `: ${response.statusText}`;
      }
      throw new Error(errorMsg);
    }
  } catch (err) {
    console.error('[CreditForm] Error:', err);
    let msg = err.name === 'AbortError' 
      ? 'La conexión tardó demasiado. Revisa tu internet o intenta de nuevo.' 
      : `Error al enviar. (${err.message})`;
    showToast(msg, 'error', 8000);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    span.textContent = originalLabel;
  }
}

/* ════════════════════════════════════════════════════════════
   PRIVATE HELPERS
════════════════════════════════════════════════════════════ */

/** Obtiene el valor trimmed de un input por ID */
function _val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/** Obtiene el valor del radio button seleccionado en un grupo */
function _radio(formEl, name) {
  const checked = formEl.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : '';
}

/* ════════════════════════════════════════════════════════════
   CANVAS SIGNATURE LOGIC
════════════════════════════════════════════════════════════ */

// Estado global de los canvas
const signatureContexts = {};

function initSignatureCanvas(canvasId, clearBtnId) {
  const canvasEl = document.getElementById(canvasId);
  const clearBtn = document.getElementById(clearBtnId);
  if (!canvasEl) return;

  const ctx = canvasEl.getContext('2d');
  
  // Guardar estado
  signatureContexts[canvasId] = {
    canvas: canvasEl,
    ctx: ctx,
    isDrawing: false,
    hasDrawn: false
  };

  // Configuración de la línea
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000000';

  // Helper para obtener posición exacta considerando bordes y scroll
  const getPos = (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    
    // Calcular escala css vs tamaño interno del canvas
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startPosition = (e) => {
    e.preventDefault();
    signatureContexts[canvasId].isDrawing = true;
    signatureContexts[canvasId].hasDrawn = true;
    
    // Ocultar placeholder
    const placeholderId = 'placeholder-' + canvasId.replace('firma-', '');
    const placeholder = document.getElementById(placeholderId);
    if (placeholder) placeholder.style.opacity = '0';

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!signatureContexts[canvasId].isDrawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const finishedPosition = () => {
    signatureContexts[canvasId].isDrawing = false;
    ctx.closePath();
  };

  // Eventos Mouse
  canvasEl.addEventListener('mousedown', startPosition);
  canvasEl.addEventListener('mousemove', draw);
  canvasEl.addEventListener('mouseup', finishedPosition);
  canvasEl.addEventListener('mouseleave', finishedPosition);

  // Eventos Touch (Móvil)
  canvasEl.addEventListener('touchstart', startPosition, { passive: false });
  canvasEl.addEventListener('touchmove', draw, { passive: false });
  canvasEl.addEventListener('touchend', finishedPosition);

  // Botón limpiar
  if (clearBtn) {
    clearBtn.addEventListener('click', () => clearSignature(canvasId));
  }
}

function clearSignature(canvasId) {
  const state = signatureContexts[canvasId];
  if (state && state.ctx) {
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    state.hasDrawn = false;

    // Mostrar placeholder
    const placeholderId = 'placeholder-' + canvasId.replace('firma-', '');
    const placeholder = document.getElementById(placeholderId);
    if (placeholder) placeholder.style.opacity = '0.5';
  }
}

function checkSignatureDrawn(canvasId) {
  return signatureContexts[canvasId] ? signatureContexts[canvasId].hasDrawn : false;
}

// Inicializar ambos canvas cuando cargue el script
initSignatureCanvas('firma-aplicante', 'btn-limpiar-firma-aplicante');
initSignatureCanvas('firma-co-aplicante', 'btn-limpiar-firma-co-aplicante');

/* ════════════════════════════════════════════════════════════
   MASKS & UI ENHANCEMENTS
════════════════════════════════════════════════════════════ */

function initMasks() {
  const phoneInputs = ['ca_phone', 'cb_phone', 'ca_work_phone', 'cb_work_phone'];
  phoneInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', formatPhone);
  });

  const ssnInputs = ['ca_ssn', 'cb_ssn'];
  ssnInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', formatSSN);
  });

  document.querySelectorAll('.currency-mask').forEach(input => {
    input.addEventListener('input', formatCurrency);
    // Disparar evento para formato inicial si tienen valor
    if(input.value) input.dispatchEvent(new Event('input'));
  });
}

function formatCurrency(e) {
  let value = e.target.value.replace(/[^0-9]/g, '');
  if (value === '') {
    e.target.value = '';
    return;
  }
  let numberVal = parseInt(value, 10) / 100;
  e.target.value = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(numberVal);
  updateProgressBar();
}

function formatPhone(e) {
  let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/);
  e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
  updateProgressBar();
}

function formatSSN(e) {
  let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,2})(\d{0,4})/);
  e.target.value = !x[2] ? x[1] : x[1] + '-' + x[2] + (x[3] ? '-' + x[3] : '');
  updateProgressBar();
}

/* ════════════════════════════════════════════════════════════
   PROGRESS BAR LOGIC
════════════════════════════════════════════════════════════ */

function updateProgressBar() {
  const formEl = document.getElementById('form-credit');
  if (!formEl) return;
  const requiredFields = Array.from(formEl.querySelectorAll('[required]'));
  if (requiredFields.length === 0) return;
  
  const filledFields = requiredFields.filter(field => {
    // Si es radio o checkbox requerido (menos común, pero por precaución)
    if (field.type === 'radio' || field.type === 'checkbox') {
      const groupName = field.name;
      return formEl.querySelector(`input[name="${groupName}"]:checked`) !== null;
    }
    return field.value.trim() !== '';
  });

  const percentage = (filledFields.length / requiredFields.length) * 100;
  const bar = document.getElementById('credit-progress-bar');
  if (bar) bar.style.width = percentage + '%';
}

function initProgressBar() {
  const formEl = document.getElementById('form-credit');
  if (!formEl) return;
  formEl.addEventListener('input', updateProgressBar);
  formEl.addEventListener('change', updateProgressBar);
  updateProgressBar(); // Init on load
}

// Inicializar de inmediato (asumiendo defer, o documento cargado)
document.addEventListener('DOMContentLoaded', async () => {
  initMasks();
  initProgressBar();
  
  // Auto-llenado si hay proyectoId
  const urlParams = new URLSearchParams(window.location.search);
  const proyectoId = urlParams.get('proyectoId');
  const formEl = document.getElementById('form-credit');
  const selectorEl = document.getElementById('credit-client-selector');
  if (proyectoId) {
    if (selectorEl) selectorEl.style.display = 'none'; // Esconder el selector si ya venimos de un proyecto
    if (formEl) {
      formEl.style.opacity = '1';
      formEl.style.pointerEvents = 'auto';
    }
    await autoFillFromProject(proyectoId);
  } else {
    // Escuchar mensajes para el buscador
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'SEARCH_CLIENTS_RESULT') {
        renderCreditClientSearchResults(event.data.data);
      }
    });
  }
});

async function autoFillFromProject(id) {
  try {
    console.log(`[AUTOFILL] Solicitando datos para proyecto: ${id}`);
    const response = await fetch(`/api/project-info?id=${id}`);
    if (!response.ok) return;
    
    const { proyecto, cliente } = await response.json();
    if (!cliente) return;

    console.log(`[AUTOFILL] Rellenando datos del cliente: ${cliente.nombre}`);
    
    // Mapeo de campos
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) {
        el.value = val;
        // Disparar evento input para que las máscaras y barra de progreso se actualicen
        el.dispatchEvent(new Event('input'));
      }
    };

    setVal('ca_fullname', cliente.nombre);
    setVal('ca_email',    cliente.email);
    setVal('ca_phone',    cliente.telefono);
    setVal('ca_address',  cliente.direccion);
    if (cliente.state_id) setVal('ca_dl_state', cliente.state_id);
    
    // Si tenemos la fecha de nacimiento en el cliente (formato YYYY-MM-DD o MM/DD/YYYY)
    if (cliente.dob) {
        // La máscara espera MM/DD/YYYY
        let dob = cliente.dob;
        if (dob.includes('-')) {
            const [y, m, d] = dob.split('-');
            dob = `${m}/${d}/${y}`;
        }
        setVal('ca_dob', dob);
    }

    // Actualizar barra de progreso al final
    if (typeof updateProgressBar === 'function') updateProgressBar();

  } catch (err) {
    console.error('[AUTOFILL ERROR]', err);
  }
}

/* ════════════════════════════════════════════════════════════
   CLIENT SELECTOR LOGIC
════════════════════════════════════════════════════════════ */
function renderCreditClientSearchResults(results) {
  const container = document.getElementById('credit-client-search-results');
  if (!container) return;
  container.innerHTML = '';
  
  if (!results || results.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  results.forEach(client => {
    const div = document.createElement('div');
    div.className = 'client-search-item hover:bg-gray-50';
    div.style.cssText = 'padding: 10px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; flex-direction: column;';
    div.innerHTML = `
      <span style="font-size: 14px; font-weight: 600; color: #0f172a;">${client.nombre}</span>
      <span style="font-size: 11px; color: #64748b;">${client.telefono || 'Sin teléfono'} - ${client.email || 'Sin email'}</span>
    `;
    div.onclick = () => {
      setCreditClient(client.id, client.nombre);
      container.style.display = 'none';
      document.getElementById('credit-client-search-input').value = '';
    };
    container.appendChild(div);
  });
  
  container.style.display = 'block';
}

function setCreditClient(id, nombre) {
  document.getElementById('selected_client_id').value = id;
  document.getElementById('selected_client_nombre').value = nombre;
  document.getElementById('credit-client-selected-name').textContent = nombre;
  
  document.getElementById('credit-client-search-area').style.display = 'none';
  document.getElementById('credit-client-selected-area').style.display = 'flex';
  
  const formEl = document.getElementById('form-credit');
  if (formEl) {
    formEl.style.opacity = '1';
    formEl.style.pointerEvents = 'auto';
  }
}

function resetCreditClientSelection() {
  document.getElementById('selected_client_id').value = '';
  document.getElementById('selected_client_nombre').value = '';
  document.getElementById('credit-client-selected-name').textContent = '';
  
  document.getElementById('credit-client-search-area').style.display = 'block';
  document.getElementById('credit-client-selected-area').style.display = 'none';
  
  const formEl = document.getElementById('form-credit');
  if (formEl) {
    formEl.style.opacity = '0.5';
    formEl.style.pointerEvents = 'none';
  }
}
