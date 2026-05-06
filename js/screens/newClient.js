/* ============================================================
   RENEW SOLAR – screens/newClient.js 
   (DYNAMIC DATA-DRIVEN RENDERER)
   ============================================================ */
import { getCurrentUser } from '../api.js';
// Removed import from ../app.js to break circular dependency
import { showToast } from '../components/toast.js';
import { 
  getPipelineByName, 
  getFasesByPipeline, 
  getCamposByFase, 
  createDynamicDeal,
  getClientesMaestro,
  getDB,
  saveDB,
  uploadFile
} from '../api.js';
import { t } from '../i18n.js';

let selectedClientId = null;

export async function renderNewClient() {
  const screen = document.getElementById('screen-new-client');
  const activeUnit = localStorage.getItem('active_unit') || 'Renew Solar';

  // SKELETON LOADER
  screen.innerHTML = `
    <div class="screen-header slide-in-right">
      <button class="back-btn" id="nc-back-btn" aria-label="${t('nc_back_label')}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h2>${t('nc_loading')}</h2>
    </div>
    <div class="form-body padding-bottom">
      <div class="skeleton" style="height:200px;border-radius:16px;margin-bottom:24px"></div>
    </div>
  `;
  document.getElementById('nc-back-btn').addEventListener('click', () => window.appNavigate('dashboard'));

  try {
    // 1. Fetch Configuration for current Ecosystem
    const pipeline = await getPipelineByName(activeUnit);
    const fases = await getFasesByPipeline(pipeline.id);
    const faseActual = fases[0];
    
    if (!faseActual) throw new Error(t('nc_error_no_fase'));
    
    // 2. Fetch specific fields for this Fase
    const campos = await getCamposByFase(faseActual.id);

    // 3. Build UI
    buildDynamicForm(screen, pipeline, faseActual, campos);

  } catch (err) {
    showToast(err.message, 'error');
    screen.querySelector('h2').textContent = "Error";
  }
}

function buildDynamicForm(screen, pipeline, faseActual, campos) {
  // Generate Dynamic HTML Blocks based on config
  const camposHtml = campos.map((c, index) => {
    let inputHtml = "";
    const delay = 0.05 * index;
    
    if (c.tipo === 'Desplegable') {
      const opts = c.opciones.split(',').map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join('');
      inputHtml = `<select id="dyn_${c.id}"><option value="" disabled selected>${t('nc_select')}</option>${opts}</select>`;
    } else if (c.tipo === 'Archivo') {
      inputHtml = `<input type="file" id="dyn_${c.id}" />`;
    } else if (c.tipo === 'Número') {
      inputHtml = `<input type="number" id="dyn_${c.id}" placeholder="${t('nc_placeholder_num')}" />`;
    } else {
      inputHtml = `<input type="text" id="dyn_${c.id}" placeholder="${t('nc_text')}" />`;
    }

    // Wrap the dynamic input
    if (c.tipo === 'Archivo') {
      return `
        <div class="upload-area slide-in-bottom" id="upload-box-${c.id}" style="animation-delay:${delay}s; margin-bottom:16px;">
          ${inputHtml}
          <div class="upload-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg></div>
          <p id="label-${c.id}" style="font-size:0.75rem">${c.etiqueta} *</p>
        </div>
      `;
    }

    return `
      <div class="field-group slide-in-bottom" style="animation-delay:${delay}s">
        <label>${c.etiqueta} *</label>
        <div class="input-wrap ${c.tipo === 'Desplegable' ? 'select-wrap' : ''} no-icon">
          ${inputHtml}
        </div>
      </div>
    `;
  }).join('');

  screen.innerHTML = `
    <div class="screen-header slide-in-right">
      <button class="back-btn" id="nc-back-btn" aria-label="Volver">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h2 style="font-size:1.1rem">${pipeline.nombre}</h2>
    </div>

    <div class="form-body" style="padding-bottom:100px">
      
      <!-- FIXED CORE: CLIENTE MAESTRO (CON BUSCADOR RELACIONAL) -->
      <div class="form-card slide-in-right">
        <div class="form-card-header" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <svg width="22" height="22" ...>...</svg>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">${t('nc_client_data')}</h3>
        </div>

        <div id="mode-search" style="display:block">
          <div class="field-group">
            <div class="input-wrap no-icon">
              <input type="search" id="nc-search" placeholder="${t('nc_search_placeholder')}" autocomplete="off" />
            </div>
          </div>
          <div id="search-results" style="max-height:220px; overflow-y:auto; border-radius:8px; margin-bottom:16px; background:var(--surface);"></div>
          
          <div id="selected-client-preview" style="display:none; padding:16px; border:1px solid ${pipeline.color}; background:${pipeline.color}08; border-radius:12px; margin-bottom:16px;">
             <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px">
               <p style="font-size:0.7rem; color:${pipeline.color}; font-weight:800; text-transform:uppercase; letter-spacing:0.5px">${t('nc_client_selected')}</p>
               <button id="btn-clear-client" style="background:var(--surface-alt); border:none; color:var(--text-muted); width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1rem">&times;</button>
             </div>
             <div style="display:flex; gap:12px; align-items:center;">
               <div id="sc-foto-preview" style="width:50px; height:50px; border-radius:10px; background:var(--surface-alt); background-size:cover; background-position:center; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid var(--border)">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
               </div>
               <div style="flex:1">
                 <p id="sc-nombre" style="font-weight:700; color:var(--text-primary); margin:0; font-size:1rem"></p>
                 <p id="sc-tel" style="font-size:0.85rem; color:var(--text-secondary); margin:0"></p>
               </div>
             </div>
             <div id="sc-details-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:14px; padding-top:12px; border-top:1px dashed var(--border);">
               <div><p style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:2px">${t('nc_field_state_id')}</p><p id="sc-state" style="font-size:0.85rem; font-weight:600; color:var(--text-primary); margin:0">-</p></div>
               <div><p style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:2px">${t('nc_field_dob')}</p><p id="sc-dob" style="font-size:0.85rem; font-weight:600; color:var(--text-primary); margin:0">-</p></div>
               <div style="grid-column: span 2"><p style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:2px">${t('nc_field_address')}</p><p id="sc-dir" style="font-size:0.85rem; font-weight:600; color:var(--text-primary); margin:0">-</p></div>
             </div>
             <button id="btn-edit-selected-client" style="width:100%; margin-top:14px; padding:10px; border-radius:10px; border:1px solid ${pipeline.color}40; background:${pipeline.color}10; color:${pipeline.color}; font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; justify-content:center; gap:8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                ${t('nc_btn_edit_profile')}
              </button>
          </div>
        </div>
      </div>

      <!-- DYNAMIC CARD: GENERADA POR ADMIN -->
      <div class="form-card slide-in-right" style="animation-delay:0.1s; margin-bottom:16px">
        <div class="form-card-header" style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${pipeline.color}" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">${faseActual.nombre}</h3>
        </div>

        ${camposHtml || '<p style="color:var(--text-muted);font-size:0.8rem">No se configuraron campos para esta fase.</p>'}
      </div>

      <button class="btn btn-primary slide-in-right" id="btn-submit" style="width:100%; height:56px; font-size:1.05rem; box-shadow:0 8px 24px ${pipeline.color}40; background:${pipeline.color}; animation-delay:0.2s">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        ${t('nc_btn_save')}
      </button>

    </div>

    <!-- MODAL CUSTOM MOBILE: NUEVO CLIENTE (BITRIX) -->
    <div id="modal-add-client-mobile" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(8px); z-index:9999; justify-content:center; align-items:flex-end">
      <div class="modal-sheet-nc" style="background:var(--surface); width:100%; border-radius:32px 32px 0 0; padding:0; height:96vh; max-height:96vh; box-shadow:0 -15px 50px rgba(0,0,0,0.3); animation: sheetUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; position:relative; display:flex; flex-direction:column; overflow:hidden;">
        
        <!-- Drag Handle (Fixed) -->
        <div class="modal-handle-nc" style="width: 44px; height: 6px; background: #cbd5e1; border-radius: 99px; margin: 14px auto; cursor:grab; flex-shrink:0;"></div>

        <!-- Header (Fixed) -->
        <div style="background:var(--surface); padding:8px 24px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
          <div>
            <h3 style="font-size:1.3rem; font-weight:800; color:var(--text-primary); margin:0">${t('nc_modal_title')}</h3>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px">${t('nc_modal_subtitle')}</p>
          </div>
          <button id="btn-close-modal-nc" style="background:var(--surface-alt); border:none; color:var(--text-secondary); width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.2rem; cursor:pointer">&times;</button>
        </div>

        <!-- Scrollable Content -->
        <div class="modal-scroll-area" style="flex:1; overflow-y:auto; padding:24px 20px 160px 20px; -webkit-overflow-scrolling: touch;">
          <div class="field-group"><label style="color:var(--text-secondary)">${t('nc_field_state_id')}</label><div class="input-wrap no-icon"><input type="text" id="nc-state" placeholder="${t('nc_placeholder_id')}" style="background:var(--bg)" /></div></div>
          
          <div style="display:flex; gap:16px">
             <div class="field-group" style="flex:1"><label style="color:var(--text-secondary)">${t('nc_field_name')} *</label><div class="input-wrap no-icon"><input type="text" id="nc-nombre" placeholder="${t('nc_placeholder_name')}" style="background:var(--bg)" /></div></div>
             <div class="field-group" style="flex:1"><label style="color:var(--text-secondary)">${t('nc_field_last')} *</label><div class="input-wrap no-icon"><input type="text" id="nc-apellido" placeholder="${t('nc_placeholder_last')}" style="background:var(--bg)" /></div></div>
          </div>
          
          <div class="field-group">
            <label style="color:var(--text-secondary)">${t('nc_field_id_photo')}</label>
            <div class="upload-area" id="nc-foto-box" style="margin-top:8px; padding:20px; border:2px dashed var(--border); border-radius:12px; text-align:center; cursor:pointer;">
              <input type="file" id="nc-foto" accept="image/*" capture="environment" style="display:none" />
              <div id="nc-icon-foto"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
              <div id="nc-preview-foto" style="display:none; width:100%; height:120px; background-size:cover; background-position:center; border-radius:8px;"></div>
              <p id="label-foto-nc" style="font-size:0.85rem; font-weight:700; color:${pipeline.color}; margin-top:8px;">${t('nc_btn_upload_photo')}</p>
              <p style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">${t('nc_capture_id')}</p>
            </div>
          </div>
          
          <div class="field-group"><label style="color:var(--text-secondary)">${t('nc_field_dob')}</label><div class="input-wrap no-icon"><input type="date" id="nc-dob-input" style="background:var(--bg)" /></div></div>
          
          <div style="display:flex; gap:16px">
            <div class="field-group" style="flex:1"><label style="color:var(--text-secondary)">${t('nc_field_phone')} *</label><div class="input-wrap no-icon"><input type="tel" id="nc-telefono" placeholder="+1 555-5555" style="background:var(--bg)" /></div></div>
            <div class="field-group" style="flex:1"><label style="color:var(--text-secondary)">${t('nc_field_email')}</label><div class="input-wrap no-icon"><input type="email" id="nc-email" placeholder="correo@email.com" style="background:var(--bg)" /></div></div>
          </div>
          
          <div class="field-group"><label style="color:var(--text-secondary)">${t('nc_field_address')}</label><div class="input-wrap no-icon"><input type="text" id="nc-direccion" placeholder="${t('nc_placeholder_address')}" style="background:var(--bg)" /></div></div>
          
          <!-- Google Maps Widget Container (preserved) -->
          <div class="field-group" style="margin-top: 12px; display: none;" id="nc-map-container">
            <div id="nc-map" style="height: 250px; width: 100%; border-radius: 12px; border: 1.5px solid var(--border); overflow: hidden; background: var(--bg);"></div>
          </div>

          <!-- ═══ NUEVOS CAMPOS VENDEDOR ═══ -->
          <div style="margin-top:16px">
            <label style="color:var(--text-secondary); font-size:0.8rem; font-weight:700; text-transform:uppercase; margin-bottom:8px; display:block;">Departamentos Activos</label>
            <div style="display:flex; flex-wrap:wrap; gap:10px; background:var(--bg); padding:12px; border-radius:12px; border:1.5px solid var(--border);">
              <label style="display:flex; align-items:center; gap:8px; font-size:0.9rem; color:var(--text-primary); cursor:pointer;">
                <input type="checkbox" name="nc-dept-chk" value="Water" style="width:18px; height:18px; accent-color:var(--primary);"> 🌊 Water
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:0.9rem; color:var(--text-primary); cursor:pointer;">
                <input type="checkbox" name="nc-dept-chk" value="Solar" style="width:18px; height:18px; accent-color:var(--primary);"> ☀️ Solar
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:0.9rem; color:var(--text-primary); cursor:pointer;">
                <input type="checkbox" name="nc-dept-chk" value="Home" style="width:18px; height:18px; accent-color:var(--primary);"> 🏠 Home
              </label>
            </div>
          </div>

          <div class="field-group" style="margin-top:16px">
            <label style="color:var(--text-secondary)">Fecha de Inicio</label>
            <div class="input-wrap no-icon"><input type="date" id="nc-fecha-inicio" style="background:var(--bg)" /></div>
          </div>

          <div class="field-group" style="margin-top:12px">
            <label style="color:var(--text-secondary)">Notas</label>
            <div class="input-wrap no-icon">
              <textarea id="nc-notas" rows="3" placeholder="Observaciones, indicaciones especiales..." style="background:var(--bg); resize:none; width:100%; border:none; font-family:inherit; font-size:0.9rem; padding:12px; border-radius:10px; color:var(--text-primary);"></textarea>
            </div>
          </div>

          <!-- ═══ DOCUMENTOS DEL CLIENTE (Vendedor) ═══ -->
          <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${pipeline.color}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style="font-size:0.8rem; font-weight:800; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.5px;">Documentos del Cliente</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
              <!-- Adjunto ID -->
              <div id="nc-drop-adj-id" style="border:2px dashed var(--border); border-radius:12px; padding:14px 8px; text-align:center; cursor:pointer; transition:all 0.2s;">
                <input type="file" id="nc-inp-adj-id" accept="image/*,.pdf" capture="environment" style="display:none" />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${pipeline.color}" stroke-width="1.5" style="margin:0 auto 6px;"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M3 16l4-4 4 4"/></svg>
                <p id="nc-lbl-adj-id" style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Foto ID</p>
              </div>
              <!-- Adjunto Bill -->
              <div id="nc-drop-adj-bill" style="border:2px dashed var(--border); border-radius:12px; padding:14px 8px; text-align:center; cursor:pointer; transition:all 0.2s;">
                <input type="file" id="nc-inp-adj-bill" accept="image/*,.pdf" capture="environment" style="display:none" />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" style="margin:0 auto 6px;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                <p id="nc-lbl-adj-bill" style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Bill Eléctrico</p>
              </div>
              <!-- Adjunto Seguro -->
              <div id="nc-drop-adj-seguro" style="border:2px dashed var(--border); border-radius:12px; padding:14px 8px; text-align:center; cursor:pointer; transition:all 0.2s;">
                <input type="file" id="nc-inp-adj-seguro" accept="image/*,.pdf" capture="environment" style="display:none" />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="1.5" style="margin:0 auto 6px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <p id="nc-lbl-adj-seguro" style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Seguro</p>
              </div>
            </div>
          </div>

          <input type="hidden" id="nc-edit-id" value="" />
          <button class="btn btn-primary" id="btn-save-nc-modal" style="width:100%; margin-top:20px; height:50px; background:${pipeline.color}; color:white; border:none; border-radius:12px; font-weight:700;">${t('nc_btn_save_client')}</button>
          <button class="btn" id="btn-close-modal-nc-bottom" style="width:100%; margin-top:10px; background:var(--surface-alt); color:var(--text-muted); font-weight:700; border:none; padding:15px; border-radius:12px;">${t('nc_btn_cancel')}</button>
        </div>
      </div>
    </div>
  `;

  // Attach Listeners
  document.getElementById('nc-back-btn').addEventListener('click', () => window.appNavigate('dashboard'));
  document.getElementById('btn-submit').addEventListener('click', () => handleSubmit(pipeline.nombre, campos));

  // Buscador Relacional Logic
  const modeSearch = document.getElementById('mode-search');
  const searchInput = document.getElementById('nc-search');
  const searchResults = document.getElementById('search-results');
  const previewBox = document.getElementById('selected-client-preview');
  
  // Modal Variables
  const modalNC = document.getElementById('modal-add-client-mobile');
  const btnCloseModal = document.getElementById('btn-close-modal-nc');
  const btnSaveModal = document.getElementById('btn-save-nc-modal');

  selectedClientId = null; // Reset on load

  document.getElementById('btn-clear-client').addEventListener('click', () => {
    selectedClientId = null;
    previewBox.style.display = 'none';
    searchInput.value = '';
    searchResults.style.display = 'block';
  });

  searchInput.addEventListener('input', async (e) => {
    const term = e.target.value.toLowerCase().trim();
    // Always append the "add new" button logic at the end
    const addNewBtnHTML = `
      <div id="btn-open-modal-from-search" style="padding:14px; background:var(--surface-alt); cursor:pointer; color:${pipeline.color}; font-weight:700; text-align:center; transition:background 0.2s; display:flex; justify-content:center; align-items:center; gap:8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        ${t('nc_add_new')}
      </div>
    `;

    if(term.length < 2) { 
      searchResults.style.display = 'block';
      searchResults.innerHTML = addNewBtnHTML;
      attachAddNewListener();
      return; 
    }
    
    const dbClientes = await getClientesMaestro();
    const hits = dbClientes.filter(c => c.nombre.toLowerCase().includes(term) || c.telefono.includes(term));
    
    if(hits.length === 0) {
      searchResults.innerHTML = `
        <div style="padding:20px; text-align:center;">
          <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:12px">No se encontraron clientes para "${term}".</p>
          ${addNewBtnHTML}
        </div>
      `;
      attachAddNewListener();
      return;
    }

    searchResults.innerHTML = hits.map(h => `
      <div class="search-hit" data-id="${h.id}" style="padding:14px; border-bottom:1px solid var(--border); background:var(--surface); cursor:pointer">
        <div style="display:flex; gap:12px; align-items:center;">
          <div style="width:40px; height:40px; border-radius:8px; background:var(--surface-alt); background-size:cover; background-position:center; display:flex; align-items:center; justify-content:center; overflow:hidden">
            ${(h.id_photo || h.foto) ? `<img src="${h.id_photo || h.foto}" style="width:100%; height:100%; object-fit:cover;" />` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`}
          </div>
          <div>
            <p style="font-weight:700; color:var(--text-primary); font-size:0.95rem; margin:0">${h.nombre}</p>
            <p style="color:var(--text-secondary); font-size:0.8rem; margin:0">${h.telefono}</p>
          </div>
        </div>
      </div>
    `).join('') + addNewBtnHTML;
    
    attachAddNewListener();
  });

  function attachAddNewListener() {
    const btnNew = document.getElementById('btn-open-modal-from-search');
    if (btnNew) {
      btnNew.onclick = () => {
        // Reset modal fields for NEW client
        modalNC.querySelectorAll('input').forEach(i => i.value = '');
        document.getElementById('nc-edit-id').value = '';
        modalNC.querySelector('h3').textContent = 'Nuevo Cliente';
        btnSaveModal.textContent = "Guardar Cliente";
        
        // Safety checks for elements that might not be in the simple mobile view
        const statusSelect = modalNC.querySelector('select');
        if (statusSelect) statusSelect.value = 'En Proceso';

        modalNC.style.display = 'flex';
        
        // Reset photo state with safety
        currentPhotoUrl = null;
        if (previewModalFoto) previewModalFoto.style.display = 'none';
        if (iconModalFoto) iconModalFoto.style.display = 'block';
        if (labelModalFoto) labelModalFoto.textContent = "Subir Foto del Cliente";

        // ── Phone Input Masking ────────
        const phoneInput = document.getElementById('nc-telefono');
        if (phoneInput) {
            phoneInput.value = '+1 ';
            phoneInput.addEventListener('input', (e) => {
                let value = e.target.value;
                if (!value.startsWith('+1 ')) {
                    e.target.value = '+1 ' + value.replace(/^\+1\s?/, '').replace(/\D/g, '');
                } else {
                    e.target.value = '+1 ' + value.substring(3).replace(/\D/g, '');
                }
            });
        }
      };
    }
  }

  // --- EDIT SELECTED CLIENT LOGIC ---
  const btnEditSelected = document.getElementById('btn-edit-selected-client');
  if (btnEditSelected) {
    btnEditSelected.onclick = async () => {
        if (!selectedClientId) return;
        const currentDb = getDB();
        const cli = (currentDb.Clientes_Maestro || []).find(c => c.id === selectedClientId);
        if (!cli) return;

        // Populate modal with existing data
        document.getElementById('nc-edit-id').value = cli.id;
        modalNC.querySelector('h3').textContent = 'Actualizar Cliente';
        modalNC.querySelector('p').textContent = 'Edita o completa los datos obligatorios';
        btnSaveModal.textContent = "Actualizar Datos";

        // Extract Name components
        const nameParts = (cli.nombre || '').split(' ');
        document.getElementById('nc-nombre').value = nameParts[0] || '';
        document.getElementById('nc-apellido').value = nameParts.slice(1).join(' ') || '';
        
        document.getElementById('nc-state').value = cli.state_id || '';
        const dobEl = document.getElementById('nc-dob-input');
        if (dobEl) dobEl.value = cli.dob || '';
        document.getElementById('nc-telefono').value = cli.telefono || '+1 ';
        document.getElementById('nc-email').value = (cli.email === 'Sin Email' ? '' : cli.email) || '';
        document.getElementById('nc-direccion').value = (cli.direccion === 'Pendiente' ? '' : cli.direccion) || '';

        // ── Populate multi-dept checkboxes ──
        const _deptArr = Array.isArray(cli.departamentos_activos) && cli.departamentos_activos.length ? cli.departamentos_activos : (cli.departamento ? [cli.departamento] : []);
        document.querySelectorAll('input[name="nc-dept-chk"]').forEach(cb => {
            cb.checked = _deptArr.some(d => d.toLowerCase() === cb.value.toLowerCase());
        });


        // Photo handling — pre-fill if the client already has an ID photo
        currentPhotoUrl = cli.id_photo || cli.foto || null;
        const _prevFoto = document.getElementById('nc-preview-foto');
        const _iconFoto = document.getElementById('nc-icon-foto');
        const _lblFoto  = document.getElementById('label-foto-nc');
        if (currentPhotoUrl) {
            if (_prevFoto) {
                _prevFoto.style.backgroundImage = `url(${currentPhotoUrl})`;
                _prevFoto.style.backgroundSize = 'cover';
                _prevFoto.style.backgroundPosition = 'center';
                _prevFoto.style.display = 'block';
            }
            if (_iconFoto) _iconFoto.style.display = 'none';
            if (_lblFoto)  _lblFoto.textContent = '✓ Foto guardada — toca para cambiar';
        } else {
            if (_prevFoto) _prevFoto.style.display = 'none';
            if (_iconFoto) _iconFoto.style.display = 'block';
            if (_lblFoto)  _lblFoto.textContent = 'Subir Foto del Cliente';
        }


        modalNC.style.display = 'flex';
    };
  }

  // Ensure modal opens if they focus empty search bar naturally
  searchInput.addEventListener('focus', () => {
    if (!searchInput.value.trim() && searchResults.innerHTML === '') {
       searchInput.dispatchEvent(new Event('input'));
    }
  });

  searchResults.addEventListener('click', async (e) => {
    const hit = e.target.closest('.search-hit');
    if(hit) {
      const dbClientes = await getClientesMaestro();
      const client = dbClientes.find(c => c.id === hit.dataset.id);
      if (client) {
        selectedClientId = client.id;
        document.getElementById('sc-nombre').textContent = client.nombre;
        document.getElementById('sc-tel').textContent = client.telefono;
        document.getElementById('sc-state').textContent = client.state_id || '-';
        document.getElementById('sc-dob').textContent = client.dob || '-';
        document.getElementById('sc-dir').textContent = client.direccion || '-';
        
        const previewFoto = document.getElementById('sc-foto-preview');
        const photoSrc = client.id_photo || client.foto;
        if (photoSrc) {
          previewFoto.style.backgroundImage = `url(${photoSrc})`;
          previewFoto.innerHTML = '';
        } else {
          previewFoto.style.backgroundImage = 'none';
          previewFoto.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        }

        previewBox.style.display = 'block';
        searchResults.style.display = 'none';
        searchInput.value = '';
      }
    }
  });

  // ── GOOGLE PLACES AUTOCOMPLETE Y MAPA ────────
  const initPlaces = () => {
      const dirInput = document.getElementById('nc-direccion');
      const mapContainer = document.getElementById('nc-map-container');
      const mapDiv = document.getElementById('nc-map');
      
      if (!dirInput || !mapContainer || !mapDiv) return;
      if (window.google && window.google.maps && window.google.maps.places) {
          if(dirInput.dataset.placesLoaded) return;
          dirInput.dataset.placesLoaded = 'true';
          
          const autocomplete = new window.google.maps.places.Autocomplete(dirInput, {
              types: ['address']
          });
          
          // Estilo de Mapa Oscuro (UI consistency)
          const darkMapStyle = [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
            { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
            { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
            { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
            { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
            { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
            { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
            { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
          ];

          const sanCristobal = { lat: 7.7684, lng: -72.2241 };
          
          const map = new window.google.maps.Map(mapDiv, {
              center: sanCristobal,
              zoom: 14,
              styles: darkMapStyle,
              disableDefaultUI: true,
              zoomControl: true,
          });

          const marker = new window.google.maps.Marker({
              map: map,
              position: sanCristobal,
              draggable: true,
              animation: window.google.maps.Animation.DROP
          });

          const geocoder = new window.google.maps.Geocoder();

          // Helper to save coordinates in tracking inputs
          const updateHiddenCoords = (lat, lng) => {
              let latInput = document.getElementById('nc-lat');
              if (!latInput) {
                  latInput = document.createElement('input');
                  latInput.type = 'hidden';
                  latInput.id = 'nc-lat';
                  dirInput.parentNode.appendChild(latInput);
              }
              latInput.value = lat;
              
              let lngInput = document.getElementById('nc-lng');
              if (!lngInput) {
                  lngInput = document.createElement('input');
                  lngInput.type = 'hidden';
                  lngInput.id = 'nc-lng';
                  dirInput.parentNode.appendChild(lngInput);
              }
              lngInput.value = lng;
          };

          // On Input Select (from Autocomplete)
          autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace();
              if (place.geometry && place.geometry.location) {
                  mapContainer.style.display = 'block';
                  dirInput.value = place.formatted_address;
                  updateHiddenCoords(place.geometry.location.lat(), place.geometry.location.lng());
                  
                  map.panTo(place.geometry.location);
                  map.setZoom(17);
                  marker.setPosition(place.geometry.location);
              }
          });

          // Reverse Geocoding when tracking location changes manually
          function reverseGeocode(latLng) {
              updateHiddenCoords(latLng.lat(), latLng.lng());
              geocoder.geocode({ location: latLng }, (results, status) => {
                  if (status === 'OK' && results[0]) {
                      dirInput.value = results[0].formatted_address;
                  }
              });
          }

          // On Map Click (Move marker)
          map.addListener('click', (e) => {
              marker.setPosition(e.latLng);
              map.panTo(e.latLng);
              reverseGeocode(e.latLng);
          });

          // On Marker Drag End
          marker.addListener('dragend', () => {
              const pos = marker.getPosition();
              map.panTo(pos);
              reverseGeocode(pos);
          });

          dirInput.addEventListener('keydown', function(e) {
              if (e.key === 'Enter') e.preventDefault();
          });

          // Show Map & Center to user's GPS position on focus (if not set yet)
          dirInput.addEventListener('focus', () => {
              if(mapContainer.style.display === 'none') {
                  mapContainer.style.display = 'block';
                  
                  // Trigger map resize if display block
                  window.google.maps.event.trigger(map, 'resize');
                  map.setCenter(sanCristobal);
                  
                  if (!document.getElementById('nc-lat') && navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition((pos) => {
                          const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                          map.panTo(userLoc);
                          marker.setPosition(userLoc);
                      }, () => { /* fallback keeps San Cristobal */ }, { timeout: 3000 });
                  }
              }
          });

      } else {
          setTimeout(initPlaces, 500);
      }
  };
  initPlaces();

  // Photo Input UI Logic for the Modal
  const inputModalFoto = document.getElementById('nc-foto');
  const areaModalFoto = document.getElementById('nc-foto-box');
  const labelModalFoto = document.getElementById('label-foto-nc');
  const previewModalFoto = document.getElementById('nc-preview-foto');
  const iconModalFoto = document.getElementById('nc-icon-foto');

  let currentPhotoUrl = null;

  if (areaModalFoto) {
    areaModalFoto.addEventListener('click', (e) => {
      if (e.target === inputModalFoto) return;
      inputModalFoto.click();
    });
  }

  if (inputModalFoto) {
    inputModalFoto.addEventListener('change', async () => {
      if (inputModalFoto.files.length) {
        const file = inputModalFoto.files[0];
        try {
          showToast('Subiendo foto del ID...', 'info');
          currentPhotoUrl = await uploadFile(file, 'clients');
          
          areaModalFoto.style.borderColor = pipeline.color;
          areaModalFoto.style.background = pipeline.color + '05';
          
          previewModalFoto.style.backgroundImage = `url(${currentPhotoUrl})`;
          previewModalFoto.style.display = 'block';
          iconModalFoto.style.display = 'none';
          
          labelModalFoto.textContent = "ACTUALIZAR FOTO";
          labelModalFoto.style.color = pipeline.color;
          showToast('Foto cargada correctamente', 'success');
        } catch (err) {
          console.error('Error subiendo foto:', err);
          showToast('Error al subir la foto. Intenta de nuevo.', 'error');
        }
      }
    });
  }

  // Modal Save Logic
  const closeModalNC = () => {
    const sheet = modalNC.querySelector('.modal-sheet-nc');
    sheet.style.animation = 'sheetDown .3s cubic-bezier(.4,0,.2,1) both';
    modalNC.style.animation = 'overlayOut .3s ease both';
    setTimeout(() => {
        modalNC.style.display = 'none';
        modalNC.style.animation = ''; // Reset for next open
        sheet.style.animation = '';
    }, 300);
  };

  btnCloseModal.addEventListener('click', closeModalNC);
  modalNC.addEventListener('click', (e) => { if (e.target === modalNC) closeModalNC(); });

  // Removed evidence logic

  // Handle Drag/Click to close (Social Media style)
  const ncHandle = modalNC.querySelector('.modal-handle-nc');
  const ncSheet = modalNC.querySelector('.modal-sheet-nc');
  ncHandle.addEventListener('click', closeModalNC);

  let touchStartY = 0;
  ncHandle.addEventListener('touchstart', (e) => { 
    touchStartY = e.touches[0].clientY; 
    ncSheet.style.transition = 'none';
  }, {passive:true});

  ncHandle.addEventListener('touchmove', (e) => {
      const diff = e.touches[0].clientY - touchStartY;
      if (diff > -20) {
          ncSheet.style.transform = `translateY(${diff}px)`;
      }
  }, {passive:true});

  ncHandle.addEventListener('touchend', (e) => {
      const diff = e.changedTouches[0].clientY - touchStartY;
      ncSheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      if (diff > 100) {
          closeModalNC();
      } else {
          ncSheet.style.transform = 'translateY(0)';
      }
  }, {passive:true});

  // ── Document Upload Visual Feedback (Vendedor Modal) ──
  const setupMobileDocUpload = (inputId, dropId, labelId, color) => {
    const inp = document.getElementById(inputId);
    const drop = document.getElementById(dropId);
    const lbl = document.getElementById(labelId);
    if (!inp) return;
    inp.addEventListener('click', (e) => e.stopPropagation());
    if (drop) {
      drop.addEventListener('click', () => inp.click());
    }

    inp.addEventListener('change', () => {
      if (inp.files.length) {
        if (drop) { drop.style.borderColor = color; drop.style.background = color + '10'; }
        if (lbl) { lbl.textContent = 'ACTUALIZAR: ' + inp.files[0].name.substring(0, 12); lbl.style.color = color; }
      }
    });
  };
  setupMobileDocUpload('nc-inp-adj-id', 'nc-drop-adj-id', 'nc-lbl-adj-id', pipeline.color);
  setupMobileDocUpload('nc-inp-adj-bill', 'nc-drop-adj-bill', 'nc-lbl-adj-bill', '#f59e0b');
  setupMobileDocUpload('nc-inp-adj-seguro', 'nc-drop-adj-seguro', 'nc-lbl-adj-seguro', '#a855f7');

  btnSaveModal.addEventListener('click', async () => {
    try {
        const state_id = document.getElementById('nc-state').value.trim();
        const firstNom = document.getElementById('nc-nombre').value.trim();
        const apellido = document.getElementById('nc-apellido').value.trim();
        const dobInput = document.getElementById('nc-dob-input');
        const dob = dobInput ? dobInput.value : '';
        const tel = document.getElementById('nc-telefono').value.trim();
        const email = document.getElementById('nc-email').value.trim();
        const dir = document.getElementById('nc-direccion').value.trim();
        const latInput = document.getElementById('nc-lat');
        const lngInput = document.getElementById('nc-lng');
        const lat = latInput ? latInput.value : null;
        const lng = lngInput ? lngInput.value : null;

        // New fields — Multi-dept checkboxes
        const deptChecks = document.querySelectorAll('input[name="nc-dept-chk"]:checked');
        const departamentos_activos = Array.from(deptChecks).map(cb => cb.value);
        const departamento = departamentos_activos[0] || '';
        
        const fechaInicioEl = document.getElementById('nc-fecha-inicio');
        const fecha_inicio = fechaInicioEl ? fechaInicioEl.value : '';
        const notasEl = document.getElementById('nc-notas');
        const notas = notasEl ? notasEl.value.trim() : '';

        if (!firstNom || !apellido || tel.length < 5 || !email || !dir) {
          showToast("Nombre, Apellido, Teléfono, Email y Dirección son obligatorios.", "error"); return;
        }

        btnSaveModal.disabled = true;
        btnSaveModal.textContent = "Procesando...";

        // ── 1. UPLOAD MAIN PROFILE PHOTO ────────
        const finalPhotoUrl = currentPhotoUrl || null;

        // ── 2. UPLOAD DOCUMENTS (ID, Bill, Seguro) ────────
        const uploadIfFile = async (inputId, folder) => {
          const inp = document.getElementById(inputId);
          if (inp && inp.files && inp.files.length > 0) {
            showToast(`Subiendo ${inp.files[0].name}...`, 'info');
            return await uploadFile(inp.files[0], folder);
          }
          return null;
        };

        const [adjIdUrl, adjBillUrl, adjSeguroUrl] = await Promise.all([
          uploadIfFile('nc-inp-adj-id', 'clientes-documentos'),
          uploadIfFile('nc-inp-adj-bill', 'clientes-documentos'),
          uploadIfFile('nc-inp-adj-seguro', 'clientes-documentos'),
        ]);
        
        const fullNombre = `${firstNom} ${apellido}`.trim();
        const sysDb = getDB();
        const editId = document.getElementById('nc-edit-id').value;
    
        if (editId) {
            const cliIdx = (sysDb.Clientes_Maestro || []).findIndex(c => c.id === editId);
            if (cliIdx !== -1) {
                const existing = sysDb.Clientes_Maestro[cliIdx];
                sysDb.Clientes_Maestro[cliIdx] = {
                    ...existing,
                    nombre: fullNombre,
                    email: email || 'Sin Email',
                    telefono: tel,
                    direccion: dir || "Pendiente",
                    lat: lat || existing.lat || null,
                    lng: lng || existing.lng || null,
                    state_id, 
                    dob: dob || existing.dob || '', 
                    id_photo: finalPhotoUrl || existing.id_photo || existing.foto || null,
                    // ── MULTI-DEPT & LIFECYCLE ──
                    departamento: departamento || existing.departamento || null,
                    departamentos_activos: departamentos_activos.length > 0 ? departamentos_activos : (existing.departamentos_activos || []),
                    macro_estado: existing.macro_estado || 'Prospecto',
                    fecha_inicio: fecha_inicio || existing.fecha_inicio || null,
                    notas: notas || existing.notas || null,
                    adjunto_id_url: adjIdUrl || existing.adjunto_id_url || null,
                    adjunto_bill_url: adjBillUrl || existing.adjunto_bill_url || null,
                    adjunto_seguro_url: adjSeguroUrl || existing.adjunto_seguro_url || null,
                };
            }
        } else {
            sysDb.Counters.cli = (sysDb.Counters.cli || 0) + 1;
            const newId = 'cli_' + sysDb.Counters.cli;
            const currentUser = getCurrentUser();
            const newClient = {
              id: newId, 
              nombre: fullNombre, 
              email: email || 'Sin Email', 
              telefono: tel, 
              direccion: dir || "Pendiente", 
              lat: lat,
              lng: lng,
              zip: "Pendiente",
              state_id, 
              dob, 
              estado: 'Lead', 
              id_photo: finalPhotoUrl,
              // ── ORIGEN: Vendedor que lo creó ──
              origen_tipo:   currentUser ? 'vendedor' : null,
              origen_nombre: currentUser ? `${currentUser.nombre || ''} ${currentUser.apellido || ''}`.trim() : null,
              origen_id:     currentUser?.id || null,
              // ── MULTI-DEPT & LIFECYCLE ──
              departamento: departamento || null,
              departamentos_activos: departamentos_activos,
              macro_estado: 'Prospecto',
              fecha_inicio: fecha_inicio || null,
              fecha_creacion: new Date().toISOString(),
              notas: notas || null,
              adjunto_id_url: adjIdUrl || null,
              adjunto_bill_url: adjBillUrl || null,
              adjunto_seguro_url: adjSeguroUrl || null,
            };
            sysDb.Clientes_Maestro.push(newClient);

            document.getElementById('nc-edit-id').value = newId; 
        }
    
        await saveDB(sysDb);
        const finalId = document.getElementById('nc-edit-id').value || editId;
    
        // Update UI
        selectedClientId = finalId;
        if(document.getElementById('sc-nombre')) document.getElementById('sc-nombre').textContent = fullNombre;
        if(document.getElementById('sc-tel')) document.getElementById('sc-tel').textContent = tel;
        if(document.getElementById('sc-state')) document.getElementById('sc-state').textContent = state_id || '-';
        if(document.getElementById('sc-dob')) document.getElementById('sc-dob').textContent = dob || '-';
        if(document.getElementById('sc-dir')) document.getElementById('sc-dir').textContent = dir || '-';
        
        const previewFoto = document.getElementById('sc-foto-preview');
        if (previewFoto) {
            if (finalPhotoUrl) {
              previewFoto.style.backgroundImage = `url(${finalPhotoUrl})`;
              previewFoto.innerHTML = '';
            } else {
              previewFoto.style.backgroundImage = 'none';
              previewFoto.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
            }
        }
    
        closeModalNC();
        previewBox.style.display = 'block';
        searchResults.style.display = 'none';
        searchInput.value = '';
        
        showToast(`Cliente ${fullNombre} ${editId ? 'actualizado' : 'guardado'} correctamente`, 'success');
    } catch (err) {
        console.error("Error saving client:", err);
        showToast("Error al guardar: " + err.message, "error");
    } finally {
        btnSaveModal.disabled = false;
        btnSaveModal.textContent = t('nc_btn_save_client');
    }
  });

  // Dynamic file handling (read as base64)
  const fileAnswers = {};
  campos.filter(c => c.tipo === 'Archivo').forEach(c => {
    const input = document.getElementById(`dyn_${c.id}`);
    const area = document.getElementById(`upload-box-${c.id}`);
    const label = document.getElementById(`label-${c.id}`);
    
    if (area) {
      area.addEventListener('click', () => input.click());
    }

    if (input) {
      input.addEventListener('change', async () => {
        if (input.files.length) {
          const file = input.files[0];
          try {
            showToast('Subiendo archivo...', 'info');
            fileAnswers[c.id] = await uploadFile(file, 'others');
            
            area.classList.add('has-file');
            area.style.borderColor = pipeline.color;
            area.style.background = pipeline.color + '10';
            label.textContent = "Documento Listo ✓";
            label.style.color = pipeline.color;
            label.style.fontWeight = '700';
            showToast('Archivo subido', 'success');
          } catch (err) {
            console.error('Error subiendo archivo dinámico:', err);
            showToast('Error al subir el archivo', 'error');
          }
        }
      });
    }
  });

  window.handleSubmit = async (pipelineName, camposConfig) => {
    if (!selectedClientId) {
      showToast("Por favor, selecciona un cliente.", "error"); return;
    }

    // --- VALIDACIÓN Y AUTO-GUARDADO ---
    const currentDb = getDB();
    const cli = (currentDb.Clientes_Maestro || []).find(c => c.id === selectedClientId);

    if (cli) {
        // Auto-save: if user loaded a photo in this session but didn't click "Actualizar Datos"
        const photoInMemory = !!currentPhotoUrl;
        const photoInDB = !!(cli.id_photo || cli.foto || cli.foto_id || cli.adjunto_id_url);
        
        if (photoInMemory && !photoInDB) {
            const cliIdx = (currentDb.Clientes_Maestro || []).findIndex(c => c.id === selectedClientId);
            if (cliIdx !== -1) currentDb.Clientes_Maestro[cliIdx].id_photo = currentPhotoUrl;
            await saveDB(currentDb);
        }

        const missing = [];
        if (!cli.nombre || cli.nombre === 'Desconocido') missing.push('Nombre');
        if (!cli.telefono || cli.telefono.length < 5) missing.push('Teléfono');
        
        const hasIdPhoto = !!(cli.adjunto_id_url || cli.id_photo || currentPhotoUrl);
        if (!hasIdPhoto) missing.push('Foto del ID');

        if (missing.length > 0) {
            showToast(`Datos incompletos: ${missing.join(', ')}. Abre "Completar Perfil" para añadir la foto.`, 'error');
            return;
        }
    }
    
    const btn = document.getElementById('btn-submit');
    btn.classList.add('loading'); btn.innerHTML = '';

    const respuestas = {};
    for(const c of camposConfig) {
      const el = document.getElementById(`dyn_${c.id}`);
      let val = "";
      if(c.tipo === 'Archivo') {
         val = fileAnswers[c.id] || "";
      } else {
         val = el ? el.value.trim() : "";
      }
      
      if (!val || val === "-" || val === "No proporcionado") {
        showToast(`El campo "${c.etiqueta}" es obligatorio para iniciar el proceso.`, 'error');
        btn.classList.remove('loading');
        btn.innerHTML = `Guardar Pipeline y Enviar`;
        return;
      }
      respuestas[c.id] = val;
    }

    try {
      const user = getCurrentUser();
      await createDynamicDeal({
        cliente_id: selectedClientId,
        respuestas: respuestas,
        pipelineName: pipelineName,
        responsable_id: user.id
      });

      showToast(`Pipeline ${pipelineName} creado exitosamente`, 'success');
      setTimeout(() => window.appNavigate('dashboard'), 800);
    } catch(err) {
      showToast(err.message, 'error');
      btn.classList.remove('loading');
      btn.innerHTML = `Guardar Pipeline y Enviar`;
    }
  };
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
