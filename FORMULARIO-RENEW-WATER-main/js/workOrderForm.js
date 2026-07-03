/* ============================================================
   RENEW WATER — js/workOrderForm.js
   Responsabilidades EXCLUSIVAS de la Orden de Trabajo:
     · Recolección de todos los campos del Work Order
     · Validación básica (campos required)
     · Limpieza del formulario tras envío exitoso
     · handleWorkOrderSubmit() — handler de submit
   ============================================================ */

/* ════════════════════════════════════════════════════════════
   RECOLECTAR DATOS — Work Order
════════════════════════════════════════════════════════════ */

/**
 * Lee todos los campos del formulario de Orden de Trabajo y retorna un objeto JSON.
 * @param {HTMLFormElement} formEl
 * @returns {Object} payload listo para enviar al webhook
 */
function collectWorkOrderData(formEl) {
  const data = {};

  // ── Objeto comprador ──
  data.comprador = {
    nombre:    _woVal('wo_purchaser'),
    segundoNombre: _woVal('wo_second_purchaser'),
    telefono:  _woVal('wo_phone'),
    email:     _woVal('wo_email'),
    direccion: _woVal('wo_address'),
    ciudad:    _woVal('wo_city'),
    estado:    _woVal('wo_state'),
    zipCode:   _woVal('wo_zip'),
    fotoId:    document.getElementById('wo_id_photo_preview')?.dataset.base64 || "",
  };

  // ── Objeto equipos ──
  data.equipos = {
    suavizadorCasa:  _woChecked('eq_softener'),
    osmosisReversa:  _woChecked('eq_ro'),
    aguaAlcalina:    _woChecked('eq_alkaline'),
    aguaPozo:        _woChecked('eq_well'),
    otro_texto:      _woVal('eq_other_text'),
  };

  // ── Objeto instalacion ──
  data.instalacion = {
    fechaEstimada:        _woVal('wo_install_date'),
    personasEnCasa:       _woVal('wo_people'),
    tipoPiso:             _woRadio(formEl, 'wo_floor'),
    conexionRefrigerador: _woRadio(formEl, 'wo_icemaker'),
    horario:              _woRadio(formEl, 'wo_schedule'),
    granossDureza:        _woVal('wo_hardness'),
    instruccionesEspeciales: _woVal('wo_special_instructions'),
  };

  // ── Objeto finanzas ──
  data.finanzas = {
    precioContado:       _woVal('wo_cash_price'),
    instalacion:         _woVal('wo_installation'),
    cuotaInicial:        _woVal('wo_down_payment'),
    saldo_financiado:    _woVal('wo_balance_financed'),
    cantidad_financiar:  _woVal('wo_amount_financed'),
    terminos_pago:       _woVal('wo_terms'),
    apr:                 _woVal('wo_apr'),
    cargosFinancieros:   _woVal('wo_finance_charge'),
    totalPagos:          _woVal('wo_total_payments'),
    tarjetaMonto:        _woVal('wo_cc_amount'),
  };

  // ── Objeto tarjeta ──
  data.tarjeta = {
    numero:     _woVal('wo_cc_number'),
    expiracion: _woVal('wo_cc_exp'),
    cvv:        _woVal('wo_cc_cvv'),
  };

  // ── Campo raíz ──
  data.nombre_dealer = _woVal('wo_rep_name');
  data.negocio_procedencia = _woRadio(formEl, 'wo_business_section');

  // ── Objeto firmas ──
  data.firmas = {};
  
  const canvasComprador = document.getElementById('wo-firma-comprador');
  data.firmas.comprador_1 = (canvasComprador && checkSignatureDrawn('wo-firma-comprador')) 
    ? canvasComprador.toDataURL('image/png') : "";

  const canvasComprador2 = document.getElementById('wo-firma-comprador-2');
  data.firmas.comprador_2 = (canvasComprador2 && checkSignatureDrawn('wo-firma-comprador-2')) 
    ? canvasComprador2.toDataURL('image/png') : "";

  const canvasRep = document.getElementById('wo-firma-rep');
  data.firmas.representante = (canvasRep && checkSignatureDrawn('wo-firma-rep')) 
    ? canvasRep.toDataURL('image/png') : "";

  // Metadatos internos
  data._tipo      = 'orden_trabajo';
  data._timestamp = new Date().toISOString();

  // ── Vincular con Proyecto ──
  const urlParams = new URLSearchParams(window.location.search);
  data.proyectoId = urlParams.get('proyectoId') || null;

  return data;
}

/* ════════════════════════════════════════════════════════════
   VALIDACIÓN — Work Order
════════════════════════════════════════════════════════════ */

/**
 * Valida los campos requeridos del formulario de Orden de Trabajo.
 * @param {HTMLFormElement} formEl
 * @returns {boolean}
 */
function validateWorkOrderForm(formEl) {
  let valid = true;
  formEl.querySelectorAll('[required]').forEach(field => {
    field.classList.remove('error');
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
   RESET — Work Order
════════════════════════════════════════════════════════════ */

/**
 * Limpiar completamente el formulario de Orden de Trabajo.
 * @param {HTMLFormElement} formEl
 */
function resetWorkOrderForm(formEl) {
  formEl.reset();
  formEl.querySelectorAll('input[type="radio"], input[type="checkbox"]')
        .forEach(el => { el.checked = false; });
  formEl.querySelectorAll('.other-input-wrapper')
        .forEach(w => w.classList.remove('visible'));
  formEl.querySelectorAll('.error')
        .forEach(el => el.classList.remove('error'));

  // Limpiar firmas
  if (typeof clearSignature === 'function') {
    clearSignature('wo-firma-rep');
    clearSignature('wo-firma-comprador');
    clearSignature('wo-firma-comprador-2');
  }

  // Limpiar fotos
  const preview = document.getElementById('wo_id_photo_preview');
  if (preview) {
    preview.innerHTML = '';
    delete preview.dataset.base64;
  }

  // Re-establecer fecha de hoy
  const woDate = document.getElementById('wo_date');
  if (woDate) {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yyyy = today.getFullYear();
    woDate.value = `${mm}/${dd}/${yyyy}`;
  }
}

/* ════════════════════════════════════════════════════════════
   SUBMIT HANDLER — Work Order
════════════════════════════════════════════════════════════ */

/**
 * Maneja el evento submit del formulario de Orden de Trabajo.
 * Valida, recolecta y envía los datos al webhook configurado en app.js.
 * @param {SubmitEvent} e
 */
async function handleWorkOrderSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const btn  = form.querySelector('.btn-submit');
  const span = btn.querySelector('span');
  const originalLabel = span.textContent;

  // Validación
  if (!validateWorkOrderForm(form)) {
    showToast('Completa los campos obligatorios marcados en rojo.', 'error');
    form.querySelector('.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Estado de carga
  btn.classList.add('loading');
  span.textContent = 'Enviando…';
  showToast('Procesando Orden de Trabajo… <i class="fa-solid fa-satellite-dish"></i>', 'success', 10000);

  const payload = collectWorkOrderData(form);

  try {
    console.log('Generando Orden de Trabajo localmente...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

    const response = await fetch('/api/generar-orden', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload),
      signal : controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      // ── Download the PDF ──
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orden_trabajo_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      showToast('¡Orden de Trabajo enviada y generada exitosamente! <i class="fa-solid fa-check text-green-500"></i>', 'success');
      resetWorkOrderForm(form);
      
      const pdfUrl = response.headers.get('X-Document-Url');
      // Prefer the manually-selected project; fall back to URL param
      const urlParams = new URLSearchParams(window.location.search);
      const proyectoIdFromUrl = urlParams.get('proyectoId');
      const proyectoIdFromSelector = document.getElementById('wo_selected_project_id')?.value || null;
      const proyectoId = proyectoIdFromSelector || proyectoIdFromUrl;
      if (proyectoId) {
        window.parent.postMessage({ type: 'WORK_ORDER_SUBMITTED', proyectoId, formData: payload, pdfUrl: pdfUrl }, '*');
      }
    } else {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message) errorMsg += `: ${errorData.message}`;
      } catch (e) {
        if (response.statusText) errorMsg += `: ${response.statusText}`;
      }
      throw new Error(errorMsg);
    }
  } catch (err) {
    console.error('[WorkOrderForm] Error:', err);
    let msg = err.name === 'AbortError' 
      ? 'La conexión tardó demasiado. Revisa tu internet o intenta de nuevo.' 
      : `Error al enviar. (${err.message})`;
    showToast(msg, 'error', 8000);
  } finally {
    btn.classList.remove('loading');
    span.textContent = originalLabel;
  }
}

/* ════════════════════════════════════════════════════════════
   PRIVATE HELPERS (prefijo _wo para evitar colisiones)
════════════════════════════════════════════════════════════ */

/** Obtiene el valor trimmed de un input por ID */
function _woVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/** Retorna true si un checkbox está marcado */
function _woChecked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

/** Obtiene el valor del radio button seleccionado en un grupo */
function _woRadio(formEl, name) {
  const checked = formEl.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : '';
}

// Inicializar canvas de firma de Work Order si existe la función global
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof initSignatureCanvas === 'function') {
      initSignatureCanvas('wo-firma-rep', 'btn-limpiar-wo-firma-rep');
      initSignatureCanvas('wo-firma-comprador', 'btn-limpiar-wo-firma-comprador');
      initSignatureCanvas('wo-firma-comprador-2', 'btn-limpiar-wo-firma-comprador-2');
    }

    // Auto-llenado si hay proyectoId en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const proyectoId = urlParams.get('proyectoId');
    if (proyectoId) {
      // Came from a project link: hide the selector and unlock the form
      const selectorEl = document.getElementById('wo-client-selector');
      if (selectorEl) selectorEl.style.display = 'none';
      unlockWOForm();
      // Pre-fill hidden project id
      const hiddenProy = document.getElementById('wo_selected_project_id');
      if (hiddenProy) hiddenProy.value = proyectoId;
      await autoFillWorkOrderFromProject(proyectoId);
    }

    // Listen for search results from parent app
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'SEARCH_CLIENTS_RESULT') {
        renderWOClientSearchResults(event.data.data);
      }
    });
  });
}

/* ════════════════════════════════════════════════════════════
   WORK ORDER PROJECT SELECTOR LOGIC
════════════════════════════════════════════════════════════ */

function unlockWOForm() {
  const container = document.getElementById('wo-form-container');
  if (container) {
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
  }
}

function renderWOClientSearchResults(results) {
  const container = document.getElementById('wo-client-search-results');
  if (!container) return;
  container.innerHTML = '';

  if (!results || results.length === 0) {
    container.style.display = 'none';
    return;
  }

  results.forEach(client => {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 10px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; flex-direction: column;';
    div.innerHTML = `
      <span style="font-size: 14px; font-weight: 600; color: #0f172a;">${client.nombre}</span>
      <span style="font-size: 11px; color: #64748b;">${client.telefono || 'Sin teléfono'} - ${client.email || 'Sin email'}</span>
    `;
    div.onmouseenter = () => div.style.background = '#f8fafc';
    div.onmouseleave = () => div.style.background = 'transparent';
    div.onclick = () => {
      setWOClient(client);
      container.style.display = 'none';
      const inp = document.getElementById('wo-client-search-input');
      if (inp) inp.value = '';
    };
    container.appendChild(div);
  });

  container.style.display = 'block';
}

async function setWOClient(client) {
  // Save selected client/project info
  const hiddenProy = document.getElementById('wo_selected_project_id');
  if (hiddenProy) hiddenProy.value = client.proyectoId || client.id;

  // Update UI to show selected state
  const selectedName = document.getElementById('wo-client-selected-name');
  if (selectedName) selectedName.textContent = client.nombre;
  const searchArea = document.getElementById('wo-client-search-area');
  if (searchArea) searchArea.style.display = 'none';
  const selectedArea = document.getElementById('wo-client-selected-area');
  if (selectedArea) selectedArea.style.display = 'flex';

  // Unlock the form
  unlockWOForm();

  // Auto-fill from this client's project if we can
  if (client.proyectoId) {
    await autoFillWorkOrderFromProject(client.proyectoId);
  } else {
    // Fill what we know from search results
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) { el.value = val; el.dispatchEvent(new Event('input')); }
    };
    setVal('wo_purchaser', client.nombre);
    setVal('wo_phone', client.telefono);
    setVal('wo_email', client.email);
    setVal('wo_address', client.direccion);
  }
}

window.setNewWOClient = function() {
  // Continue without linking to a project
  const selectedName = document.getElementById('wo-client-selected-name');
  if (selectedName) selectedName.textContent = 'Sin proyecto vinculado';
  const searchArea = document.getElementById('wo-client-search-area');
  if (searchArea) searchArea.style.display = 'none';
  const selectedArea = document.getElementById('wo-client-selected-area');
  if (selectedArea) selectedArea.style.display = 'flex';
  unlockWOForm();
};

window.resetWOClientSelection = function() {
  const hiddenProy = document.getElementById('wo_selected_project_id');
  if (hiddenProy) hiddenProy.value = '';
  const selectedName = document.getElementById('wo-client-selected-name');
  if (selectedName) selectedName.textContent = '';
  const searchArea = document.getElementById('wo-client-search-area');
  if (searchArea) searchArea.style.display = 'block';
  const selectedArea = document.getElementById('wo-client-selected-area');
  if (selectedArea) selectedArea.style.display = 'none';
  const container = document.getElementById('wo-form-container');
  if (container) {
    container.style.opacity = '0.5';
    container.style.pointerEvents = 'none';
  }
};

async function autoFillWorkOrderFromProject(id) {
  try {
    console.log(`[AUTOFILL-WO] Solicitando datos para proyecto: ${id}`);
    const response = await fetch(`/api/project-info?id=${id}`);
    if (!response.ok) return;
    
    const { proyecto, cliente } = await response.json();
    if (!cliente) return;

    console.log(`[AUTOFILL-WO] Rellenando datos del cliente: ${cliente.nombre}`);
    
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) {
        el.value = val;
        el.dispatchEvent(new Event('input'));
      }
    };

    setVal('wo_purchaser', cliente.nombre);
    setVal('wo_phone',     cliente.telefono);
    setVal('wo_email',     cliente.email);
    setVal('wo_address',   cliente.direccion);
    setVal('wo_zip',       cliente.zip);
    
    // Si tenemos ciudad y estado en el cliente (preferimos state_id para la abreviación TX, CA, etc.)
    if (cliente.ciudad) setVal('wo_city', cliente.ciudad);
    if (cliente.state_id || cliente.estado) setVal('wo_state', cliente.state_id || cliente.estado);

  } catch (err) {
    console.error('[AUTOFILL-WO ERROR]', err);
  }
}
