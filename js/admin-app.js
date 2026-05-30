import {
  initDB, uploadFile, uploadAcademia, saveDB, getDB, saveGranular, genId,
  getAdminPipelines, getAdminFases, getAdminCampos,
  createAdminPipeline, createAdminFase, createAdminCampo, updateAdminCampo,
  nukeAndResetDB, updateAdminFaseRole, updateAdminFaseUsers,
  deleteAdminPipeline, deleteAdminFase, deleteAdminCampo, reorderAdminCampos, reorderAdminFases,
  getAdminWorkers, saveAdminWorker, deleteAdminWorker,
  getClientesMaestro, updateClientMaestro, deleteClientesMaestro,
  getInventario, saveInventario, deleteInventarioItem, getHistorialInventario, saveHistorialInventario, 
  syncClientStatuses, deleteAdminProject, advanceDealPhase, syncKanbanActivity, getCurrentUser,
  getCatalogos, saveCatalogo
} from './api.js';
window.getDB = getDB;
window.saveDB = saveDB;
import { showToast } from './components/toast.js';
import { t, getLang, setLang } from './i18n.js';
import { renderRendimientoGlobal } from './screens/rendimiento-global.js';
import { renderHRHub } from './screens/hrhub.js';
import { renderCallCenterAdmin } from './screens/callCenterAdmin.js';
import { openChat } from './components/internal-chat.js';
import { initAdminBell, updateAdminBellBadge } from './components/admin-notif-bell.js';

window.openInternalChat = openChat;

document.addEventListener('DOMContentLoaded', () => {
    const chatBtn = document.getElementById('btn-header-chat');
    if (chatBtn) chatBtn.addEventListener('click', openChat);

    // Initial check and periodic refresh
    updateAdminBadges();
    setInterval(updateAdminBadges, 30000); // Every 30s

    // Init admin notification bell
    initAdminBell();
    setInterval(updateAdminBellBadge, 60000); // Refresh badge every 60s
});

async function updateAdminBadges() {
    const user = getCurrentUser();
    if (!user) return;
    
    const db = getDB();
    const mensajes = db.mensajes_internos || [];
    let unreadCount = 0;
    
    for (let msg of mensajes) {
        if (msg.mentions && msg.mentions.includes(user.id)) {
            if (!msg.read_by || !msg.read_by.includes(user.id)) {
                unreadCount++;
            }
        }
    }
    
    const badge = document.getElementById('chat-header-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}


function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let state = {
  activeView: 'crm',
  activeClientId: null,
  activePipId: null,
  activeEcoFilter: null,
  activeInventorySede: 'orlando',
  activeInventoryLine: 'all',
  currentCliIdPhoto: null,
  currentUsrFoto: null,
  currentUsrW9Url: null,
  currentAnnFoto: null,
  currentMtFoto: null,
  activeAnnTab: 'comunicados',
  crmKanbanActive: false
};

// ââ‚¬ââ‚¬ GLOBAL INVENTORY FUNCTIONS (Top Level for maximum accessibility) ââ‚¬ââ‚¬
window.addStock = (id) => {
    console.log("Global addStock called for ID:", id);
    const invData = getInventario();
    const item = invData.find(i => i.id === id);
    if (!item) return showToast("Artículo no encontrado", "error");
    
    // Fix IDs to match admin.html
    const labelName = document.getElementById('lbl-add-stock-name');
    const inputQty = document.getElementById('inp-quick-stock-qty');
    const btnConfirm = document.getElementById('btn-confirm-quick-stock');
    
    if (labelName) labelName.textContent = item.nombreItem;
    if (inputQty) inputQty.value = 1;
    
    const modalTitle = document.querySelector('#modal-quick-stock h3');
    if (modalTitle) modalTitle.textContent = 'Añadir Stock Rápido';

    if (btnConfirm) {
        btnConfirm.innerHTML = '<i class="fa-solid fa-plus"></i> Confirmar Ingreso';
        btnConfirm.onclick = async () => {
            const val = parseInt(inputQty.value) || 0;
            if (val > 0) {
                item.stockActual = (parseInt(item.stockActual) || 0) + val;
                saveInventario(invData);

                // Record in history
                const historial = getHistorialInventario();
                const adminUser = JSON.parse(localStorage.getItem('currentUser')) || { nombre: 'Admin' };
                historial.unshift({
                    fecha: new Date().toISOString(),
                    tecnico_nombre: `(Admin) ${adminUser.nombre}`,
                    item_nombre: item.nombreItem,
                    item_id: item.id,
                    cantidad_retirada: -val, // Negative withdrawal = addition
                    sede: item.locacion || 'orlando',
                    ecosistema: state.activeEcoFilter || 'solar'
                });
                if (historial.length > 500) historial.length = 500;
                saveHistorialInventario(historial);

                window.closeModals();
                await renderView();
                window.addNotification('Inventario', `Se añadieron ${val} unidades a ${item.nombreItem}`, 'success');
            }
        };
    }
    
    window.showModal(document.getElementById('modal-quick-stock'));
};

window.subtractStock = (id) => {
    console.log("Global subtractStock called for ID:", id);
    const invData = getInventario();
    const item = invData.find(i => i.id === id);
    if (!item) return showToast("Artículo no encontrado", "error");
    
    const labelName = document.getElementById('lbl-add-stock-name');
    const inputQty = document.getElementById('inp-quick-stock-qty');
    const btnConfirm = document.getElementById('btn-confirm-quick-stock');
    const modalTitle = document.querySelector('#modal-quick-stock h3');
    
    if (modalTitle) modalTitle.textContent = 'Restar Stock (Ajuste)';
    if (labelName) labelName.textContent = item.nombreItem;
    if (inputQty) inputQty.value = 1;
    
    if (btnConfirm) {
        btnConfirm.innerHTML = '<i class="fa-solid fa-minus"></i> Confirmar Retiro';
        btnConfirm.onclick = async () => {
            const val = parseInt(inputQty.value) || 0;
            if (val > 0) {
                if (item.stockActual < val) {
                    if (!confirm('El stock actual es menor a la cantidad a retirar. ¿Continuar con stock negativo?')) return;
                }
                item.stockActual = (parseInt(item.stockActual) || 0) - val;
                saveInventario(invData);

                // Record in history
                const historial = getHistorialInventario();
                const adminUser = JSON.parse(localStorage.getItem('currentUser')) || { nombre: 'Admin' };
                historial.unshift({
                    fecha: new Date().toISOString(),
                    tecnico_nombre: `(Admin) ${adminUser.nombre}`,
                    item_nombre: item.nombreItem,
                    item_id: item.id,
                    cantidad_retirada: val, // Positive withdrawal
                    sede: item.locacion || 'orlando',
                    ecosistema: state.activeEcoFilter || 'solar'
                });
                if (historial.length > 500) historial.length = 500;
                saveHistorialInventario(historial);

                window.closeModals();
                await renderView();
                window.addNotification('Inventario', `Se retiraron ${val} unidades de ${item.nombreItem}`, 'warning');
            }
        };
    }
    
    window.showModal(document.getElementById('modal-quick-stock'));
};

window.editStock = (id) => {
    console.log("Global editStock called for ID:", id);
    const invData = getInventario();
    const item = invData.find(i => i.id === id);
    if (!item) return showToast("Artículo no encontrado", "error");

    const modInv = document.getElementById('modal-nuclear-inv');
    const btnSave = document.getElementById('btn-save-inv');
    
    if (modInv) {
        modInv.querySelector('h3').textContent = 'Editar Artículo';
        if (btnSave) {
            btnSave.innerHTML = '<i class="fa-solid fa-save"></i> Actualizar Artículo';
            btnSave.dataset.editId = id;
        }
        
        document.getElementById('inp-inv-codigo').value = item.id;
        document.getElementById('inp-inv-linea').value = item.ecosistema;
        document.getElementById('inp-inv-nombre').value = item.nombreItem;
        if(document.getElementById('inp-inv-medida')) document.getElementById('inp-inv-medida').value = item.medida || '-';
        if(document.getElementById('inp-inv-boton')) document.getElementById('inp-inv-boton').value = item.boton || '-';
        if(document.getElementById('inp-inv-color')) document.getElementById('inp-inv-color').value = item.color || '-';
        
        // As we merged locacion and storage, set the locacion to the select
        const sedeSelect = document.getElementById('inp-inv-sede-select');
        if (sedeSelect) sedeSelect.value = item.locacion || 'orlando';
        
        document.getElementById('inp-inv-stock').value = item.stockActual;
        window.showModal(modInv);
    }
};

window.deleteItem = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este artículo del inventario?')) return;
    await deleteInventarioItem(id);
    renderView();
    window.addNotification("Inventario", "Artículo eliminado", "warning");
};

window.clearInventarioHistorial = async () => {
    if (!confirm('¿Seguro que deseas borrar TODO el historial de inventario? Esta acción no se puede deshacer.')) return;
    const db = getDB();
    if (!db.historialInventario || db.historialInventario.length === 0) return;
    
    const fechas = db.historialInventario.map(h => h.fecha);
    
    // Clear locally
    db.historialInventario = [];
    
    try {
        // Clear on cloud
        await fetch('/api/delete-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'historial_inventario', ids: fechas, column: 'fecha' })
        });
    } catch(err) { console.error('Error on cloud bulk delete history', err); }
    
    await saveDB(db);
    renderView();
    if(window.showToast) window.showToast('Historial borrado', 'warning');
    else window.addNotification("Inventario", "Historial borrado", "warning");
};

window.deleteInventarioHistorialItem = async (fecha) => {
    if (!confirm('¿Seguro que deseas borrar este registro del historial?')) return;
    const db = getDB();
    if (!db.historialInventario) return;

    // Remove locally
    db.historialInventario = db.historialInventario.filter(h => h.fecha !== fecha);

    try {
        await fetch('/api/delete-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'historial_inventario', ids: [fecha], column: 'fecha' })
        });
    } catch(err) { console.error('Error deleting history item from cloud', err); }

    await saveDB(db);
    renderView();
    if(window.showToast) window.showToast('Registro eliminado', 'warning');
};

window.adminDeletePartner = async (id, e) => {
    e.stopPropagation();
    if (!confirm('¿Seguro que deseas eliminar este partner/proveedor?')) return;
    const db = getDB();
    if (!db.Admin_Proveedores) return;
    db.Admin_Proveedores = db.Admin_Proveedores.filter(p => String(p.id) !== String(id));
    try {
        await fetch('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'partners_directorio', id }) });
    } catch(err) { console.error('Error on cloud delete', err); }
    await saveDB(db);
    renderView();
    showToast('Partner eliminado', 'warning');
};

window.adminBulkDeletePartners = async () => {
    const checked = document.querySelectorAll('.partner-chk:checked');
    if (!checked.length) {
        showToast('Debes seleccionar al menos un partner', 'error');
        return;
    }
    if (!confirm(`¿Seguro que deseas eliminar ${checked.length} partners seleccionados?`)) return;
    
    const ids = Array.from(checked).map(c => c.dataset.id);
    const db = getDB();
    if (db.Admin_Proveedores) {
        db.Admin_Proveedores = db.Admin_Proveedores.filter(p => !ids.includes(String(p.id)));
        try {
            const headers = { 'Content-Type': 'application/json' };
            for (const id of ids) {
                await fetch('/api/delete', { method: 'POST', headers, body: JSON.stringify({ table: 'partners_directorio', id }) });
            }
        } catch(err) { console.error('Error on cloud bulk delete', err); }
        await saveDB(db);
        renderView();
        showToast(`${checked.length} partners eliminados`, 'warning');
    }
};


// ââ‚¬ââ‚¬ Global Header Action Wrapper ââ‚¬ââ‚¬
window.handleGlobalAdd = async () => {
    const curView = state.activeView;
    console.log("handleGlobalAdd for view:", curView);
    
    if (curView === 'inventario') {
        const modInv = document.getElementById('modal-nuclear-inv');
        const btnSave = document.getElementById('btn-save-inv');
        if(btnSave) delete btnSave.dataset.editId;
        
        if(modInv) {
            const h3 = modInv.querySelector('h3');
            if(h3) h3.textContent = 'Añadir Artículo al Inventario';
            if(btnSave) btnSave.innerHTML = 'Guardar Artículo';
            
            if(document.getElementById('inp-inv-codigo')) document.getElementById('inp-inv-codigo').value = '';
            if(document.getElementById('inp-inv-linea')) document.getElementById('inp-inv-linea').value = '';
            if(document.getElementById('inp-inv-nombre')) document.getElementById('inp-inv-nombre').value = '';
            if(document.getElementById('inp-inv-medida')) document.getElementById('inp-inv-medida').value = '';
            if(document.getElementById('inp-inv-boton')) document.getElementById('inp-inv-boton').value = '';
            if(document.getElementById('inp-inv-color')) document.getElementById('inp-inv-color').value = '';
            if(document.getElementById('inp-inv-stock')) document.getElementById('inp-inv-stock').value = '';
            
            window.showModal(modInv);
        }
    } 
    else if (curView === 'lista-precios') {
        const modPrec = document.getElementById('modal-nuclear-precios');
        const btnSave = document.getElementById('btn-save-precio');
        if(btnSave) delete btnSave.dataset.editId;

        if(modPrec) {
            // Reset fields
            document.getElementById('inp-prec-nombre').value = '';
            document.getElementById('inp-prec-codigo').value = '';
            document.getElementById('inp-prec-cat').value = '';
            document.getElementById('sel-prec-sede').value = 'todas';
            document.getElementById('inp-prec-junior').value = '';
            document.getElementById('inp-prec-subvende').value = '';
            document.getElementById('inp-prec-vendedor').value = '';
            document.getElementById('inp-prec-analista').value = '';
            document.getElementById('inp-prec-oficina').value = '';
            document.getElementById('inp-prec-full').value = '';
            document.getElementById('inp-prec-grande').value = '';
            document.getElementById('inp-prec-min').value = '';
            document.getElementById('inp-prec-max').value = '';
            document.getElementById('inp-prec-medida').value = '';
            document.getElementById('inp-prec-boton').value = '';
            document.getElementById('inp-prec-color').value = '';
            document.getElementById('inp-prec-unidad').value = '';
            document.getElementById('inp-prec-garantia').value = '';
            document.getElementById('inp-prec-foto').value = '';
            document.getElementById('inp-prec-pdf').value = '';
            document.getElementById('inp-prec-desc').value = '';

            window.showModal(modPrec);
        }
    }
    else if (curView === 'constructor') {
      UI.inpPipNom.value = '';
      if(document.getElementById('inp-pip-id')) document.getElementById('inp-pip-id').value = '';
      if(UI.inpPipCol) UI.inpPipCol.value = '#00f5d4';
      if(document.getElementById('inp-pip-roles')) document.getElementById('inp-pip-roles').value = '';
      
      const rolesBadge = document.getElementById('pip-roles-badge');
      if (rolesBadge) rolesBadge.textContent = 'Sin restricciones';

      window.showModal(UI.modPip);
    } 
    else if (curView === 'crm' || curView === 'crm_maestro') {
      UI.inpCliNom.value = '';
      if(UI.inpCliEmail) UI.inpCliEmail.value = '';
      if(UI.inpCliTel) UI.inpCliTel.value = '';
      if(document.getElementById('inp-cli-direccion')) document.getElementById('inp-cli-direccion').value = '';
      if(document.getElementById('inp-cli-estado')) document.getElementById('inp-cli-estado').value = 'Lead';
      if(document.getElementById('inp-cli-macro-estado')) document.getElementById('inp-cli-macro-estado').value = 'Prospecto';
      if(document.getElementById('inp-cli-fecha-inicio')) document.getElementById('inp-cli-fecha-inicio').value = '';
      if(document.getElementById('inp-cli-notes')) document.getElementById('inp-cli-notes').value = '';
      if(document.getElementById('inp-cli-empresa')) document.getElementById('inp-cli-empresa').value = '';
      
      // Reset multi-dept checkboxes
      document.querySelectorAll('input[name="chk-cli-dept"]').forEach(cb => cb.checked = false);

      // Reset photo
      state.currentCliFoto = null;
      if(UI.previewCliFoto) UI.previewCliFoto.classList.add('hidden');
      if(UI.placeholderCliFoto) UI.placeholderCliFoto.classList.remove('hidden');

      window.showModal(UI.modCli);
    } 
    else if (curView === 'calendario') {
      console.log("[RENEW-DEBUG] Opening Calendar Modal...");
      if (typeof window.mostrarDetalleEventoCalendario === 'function') {
        window.mostrarDetalleEventoCalendario(null);
      } else {
        console.warn("[RENEW-WARN] mostrarDetalleEventoCalendario is not defined. Falling back to Google Calendar.");
        window.open('https://calendar.google.com/', '_blank');
      }
    }
    else if (curView === 'usuarios' || curView === 'equipo' || curView === 'hrhub') {
      const title = document.getElementById('modal-usr-title');
      if(title) title.textContent = t('team_btn_add');
      UI.inpUsrId.value = '';
      UI.inpUsrNom.value = '';
      UI.inpUsrApe.value = '';
      UI.inpUsrEmail.value = '';
      UI.inpUsrTel.value = '';
      if(document.getElementById('sel-usr-cc')) document.getElementById('sel-usr-cc').value = '+1';
      UI.inpUsrDob.value = '';
      UI.inpUsrPass.value = 'renew123';
      UI.inpUsrRol.value = 'novato';
      
      state.currentUsrFoto = null;
      if(UI.previewUsrFoto) UI.previewUsrFoto.classList.add('hidden');
      if(UI.placeholderUsrFoto) UI.placeholderUsrFoto.classList.remove('hidden');

      // Re-init date pickers for the modal
      if(window.initDatePickers) window.initDatePickers();

      // Reset W-9 upload state
      state.currentUsrW9Url = null;
      const w9Placeholder = document.getElementById('w9-upload-placeholder');
      const w9Success = document.getElementById('w9-upload-success');
      const w9FileInp = document.getElementById('inp-usr-w9-file');
      if (w9Placeholder) w9Placeholder.classList.remove('hidden');
      if (w9Success) { w9Success.classList.add('hidden'); w9Success.classList.remove('flex'); }
      if (w9FileInp) w9FileInp.value = '';

      const usrPipBox = document.getElementById('usr-pipeline-perms');
      if (usrPipBox) {
        const dbLocal = getDB();
        const pipelines = dbLocal.Admin_Pipelines || [];
        if (pipelines.length === 0) {
          usrPipBox.innerHTML = '<p class="text-xs text-gray-400 italic">No hay pipelines creados aún.</p>';
        } else {
          const getPipIcon = (n) => {
            const nl = n.toLowerCase();
            if (nl.includes('solar')) return 'fa-sun';
            if (nl.includes('water') || nl.includes('agua')) return 'fa-droplet';
            if (nl.includes('home') || nl.includes('casa')) return 'fa-house';
            return 'fa-bolt';
          };
          usrPipBox.innerHTML = pipelines.map(pip => `
            <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/5 cursor-pointer hover:border-tealAccent/40 transition-all" style="background:${pip.color}08; border-color:${pip.color}20">
              <input type="checkbox" class="usr-pip-chk w-4 h-4 rounded accent-teal-500" data-pip="${pip.nombre}">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:${pip.color}15; color:${pip.color}">
                <i class="fa-solid ${getPipIcon(pip.nombre)} text-xs"></i>
              </div>
              <span class="text-sm font-bold text-gray-700 dark:text-gray-300 flex-1">${pip.nombre}</span>
            </label>
          `).join('');
        }
      }
      // Reset state for new worker
      state.currentUsrFoto = null;
      state.currentUsrW9Url = null;
      if (UI.previewUsrFoto) UI.previewUsrFoto.classList.add('hidden');
      if (UI.placeholderUsrFoto) UI.placeholderUsrFoto.classList.remove('hidden');
      if (UI.inpUsrFotoFile) UI.inpUsrFotoFile.value = '';
      if (document.getElementById('inp-usr-w9-file')) document.getElementById('inp-usr-w9-file').value = '';
      if (document.getElementById('w9-upload-success')) document.getElementById('w9-upload-success').classList.add('hidden');
      if (document.getElementById('w9-upload-placeholder')) document.getElementById('w9-upload-placeholder').classList.remove('hidden');

      window.showModal(UI.modUsr);
    }
    else if (curView === 'proveedores') {
      const title = document.getElementById('modal-partner-title');
      if(title) title.textContent = 'Añadir Partner / Proveedor';
      if(document.getElementById('inp-partner-id')) document.getElementById('inp-partner-id').value = '';
      if(document.getElementById('inp-partner-empresa')) document.getElementById('inp-partner-empresa').value = '';
      if(document.getElementById('inp-partner-contacto')) document.getElementById('inp-partner-contacto').value = '';
      if(document.getElementById('inp-partner-servicio')) document.getElementById('inp-partner-servicio').value = 'Solar';
      if(document.getElementById('inp-partner-tel')) document.getElementById('inp-partner-tel').value = '';
      if(document.getElementById('inp-partner-email')) document.getElementById('inp-partner-email').value = '';
      if(document.getElementById('inp-partner-area')) document.getElementById('inp-partner-area').value = '';
      
      state.currentPartnerW9Url = null;
      state.currentPartnerSeguroUrl = null;
      const w9Text = document.getElementById('partner-w9-text');
      if (w9Text) w9Text.textContent = 'Subir W-9';
        if(document.getElementById('inp-partner-w9-file')) document.getElementById('inp-partner-w9-file').value = '';
        if(document.getElementById('inp-partner-seguro-file')) document.getElementById('inp-partner-seguro-file').value = '';

        window.showModal(document.getElementById('modal-nuclear-partner'));
    }

};

async function init() {
  console.log('--- INITIALIZING RENEW OS ---');
  let initSuccess = false;
  let initError = null;

  const updateProgress = (pct, text) => {
    console.log(`[PROGRESS] ${pct}%: ${text}`);
    const bar = document.getElementById('preloader-progress');
    const txt = document.getElementById('preloader-text');
    if (bar) bar.style.width = `${pct}%`;
    if (txt && text) txt.textContent = text;
  };

  // ââ‚¬ââ‚¬ Safety net: force-remove preloader after 30s no matter what ââ‚¬ââ‚¬
  const safetyTimer = setTimeout(() => {
    const p = document.getElementById('admin-preloader');
    if (p) { p.classList.add('fade-out'); setTimeout(() => p.remove(), 800); }
    console.warn('[INIT] Safety timer removed preloader after 30s');
  }, 30000);

  try {
      updateProgress(10, 'Sincronizando Base de Datos...');
      await initDB(); 
      console.log('[INIT] initDB completed');
      
      updateProgress(30, 'Verificando Credenciales...');
      const user = JSON.parse(localStorage.getItem('rs_user'));
      const hash = window.location.hash;
      
      if (!user) {
          console.warn('[INIT] No user found, redirecting to login');
          clearTimeout(safetyTimer);
          window.location.href = 'index.html#login';
          return;
      }
      console.log('[INIT] User:', user.email);
      
      if (window.initZadarmaWebRTC) {
          setTimeout(() => window.initZadarmaWebRTC(), 1000);
      }

      // Deep Linking Logic
      if (hash && hash.startsWith('#crmDetail?id=')) {
          const allowedRoles = ['Admin', 'admin', 'CEO', 'CEO-RENEW', 'Supervisión'];
          if (allowedRoles.includes(user.rol)) {
              const qs = hash.split('?')[1];
              const params = new URLSearchParams(qs);
              const clientId = params.get('id');
              if (clientId) {
                  state.activeView = 'crm_maestro';
                  setTimeout(async () => {
                      if (typeof showClientDetail === 'function') {
                          console.log('[DeepLink] Opening client detail for:', clientId);
                          await showClientDetail(clientId);
                      }
                  }, 1500);
              }
              history.replaceState(null, '', window.location.pathname + '#crm_maestro');
          }
      }

      // ââ‚¬ââ‚¬ ?reasignar=PROJECT_ID deep link (from rejection email) ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
      // When admin clicks "Reasignar Técnico Ahora" in the email, this opens
      // the Kanban drawer directly on that project so they can assign a new tech.
      const urlSearchParams = new URLSearchParams(window.location.search);
      const reasignarId = urlSearchParams.get('reasignar');
      if (reasignarId) {
          console.log('[DeepLink] Reasignar link detected for project:', reasignarId);
          state.activeView = 'kanban';

          // Strip param from URL so refreshing doesn't re-trigger
          const cleanUrl = window.location.pathname;
          history.replaceState(null, '', cleanUrl);

          // Wait for the UI/DB to be fully ready before opening the drawer
          setTimeout(async () => {
              try {
                  const db2 = getDB();
                  const proyecto = (db2.Proyectos_Dinamicos || []).find(p =>
                      p.id === reasignarId ||
                      p.id === reasignarId.toLowerCase() ||
                      String(p.id) === String(reasignarId)
                  );

                  if (proyecto) {
                      // Show a visible banner so admin knows why this opened
                      const banner = document.createElement('div');
                      banner.id = 'reasignar-banner';
                      banner.style.cssText = `
                          position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
                          background: linear-gradient(90deg, #dc2626, #b91c1c);
                          color: white; padding: 14px 24px;
                          display: flex; align-items: center; justify-content: space-between;
                          font-family: inherit; font-size: 14px; font-weight: 700;
                          box-shadow: 0 4px 20px rgba(220,38,38,0.4);
                          animation: slideDown 0.4s ease;
                      `;
                      banner.innerHTML = `
                          <span>⚠ ️ El técnico rechazó esta cita. Asigna un nuevo técnico al proyecto <strong>RENEW-${reasignarId.toUpperCase()}</strong></span>
                          <button onclick="document.getElementById('reasignar-banner').remove()"
                              style="background:rgba(255,255,255,0.2); border:none; color:white; width:28px; height:28px;
                                     border-radius:50%; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center;">
                              Ñ”
                          </button>
                      `;
                      document.body.appendChild(banner);
                      setTimeout(() => { if (banner.parentNode) banner.remove(); }, 12000);

                      // Switch to Kanban view and open drawer
                      if (typeof switchView === 'function') {
                          const pipe = (db2.Admin_Pipelines || []).find(pip => pip.id === proyecto.pipeline_id);
                          if (pipe) {
                              state.activePipId = pipe.id;
                              await switchView('kanban');
                          }
                      }

                      setTimeout(() => {
                          if (typeof openKanbanDrawer === 'function') {
                              openKanbanDrawer(proyecto.id);
                          }
                      }, 800);
                  } else {
                      showToast(`⚠ ️ Proyecto RENEW-${reasignarId} no encontrado. Búscalo manualmente.`, 'warning');
                      console.warn('[DeepLink] Project not found for reasignar:', reasignarId);
                  }
              } catch (deepLinkErr) {
                  console.error('[DeepLink] Error opening reasignar project:', deepLinkErr);
              }
          }, 2000);
      }
      // ââ‚¬ââ‚¬ END ?reasignar deep link ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬

      updateProgress(50, 'Configurando Interfaz...');
      cacheElements();
      bindGlobalEvents();
      
      // Theme & Lang
      initAdminTheme();
      updateAdminLangUI();
      updateAdminNavLabels();

      updateProgress(70, 'Cargando Datos de Nube...');
      await loadData();
      
      updateProgress(90, 'Renderizando Sistema...');
      await renderView();
      updateSidebarUser();

      console.log('--- MOTOR LISTO ---');
      updateProgress(100, 'Motor Listo');
      initSuccess = true;
      window.addNotification('Sistema Iniciado', 'Conexión a la nube establecida.', 'success');

  } catch (err) {
      console.error('[INIT FATAL] Initialization failed:', err);
      initError = err;
      updateProgress(0, 'Error - revisa la consola');
  } finally {
      // ââ‚¬ââ‚¬ ALWAYS remove the preloader, success or failure ââ‚¬ââ‚¬
      clearTimeout(safetyTimer);
      setTimeout(() => {
        const preloader = document.getElementById('admin-preloader');
        if (preloader) {
          preloader.classList.add('fade-out');
          setTimeout(() => preloader.remove(), 800);
          console.log('[INIT] Preloader removed. Success:', initSuccess);
        }
        // If it failed, show a non-blocking toast with the error
        if (!initSuccess && initError) {
          const banner = document.getElementById('init-error-banner');
          if (banner) {
            banner.textContent = '⚠  Error al iniciar: ' + (initError.message || initError);
            banner.style.display = 'block';
          }
        }
      }, initSuccess ? 1000 : 300);
  }
}

// Global scope helpers that were inside init previously
function initAdminTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

const updateAdminLangUI = () => {
    const current = localStorage.getItem('app_lang') || 'es';
    const btnEs = document.getElementById('admin-lang-es');
    const btnEn = document.getElementById('admin-lang-en');
    if (btnEs && btnEn) {
        if (current === 'es') {
            btnEs.style.borderColor = 'rgba(0,245,212,0.5)';
            btnEs.style.background  = 'rgba(0,245,212,0.1)';
            btnEs.style.color       = '#00f5d4';
            btnEn.style.borderColor = 'rgba(100,116,139,0.3)';
            btnEn.style.background  = 'transparent';
            btnEn.style.color       = '#64748b';
        } else {
            btnEn.style.borderColor = 'rgba(59,130,246,0.5)';
            btnEn.style.background  = 'rgba(59,130,246,0.1)';
            btnEn.style.color       = '#60a5fa';
            btnEs.style.borderColor = 'rgba(100,116,139,0.3)';
            btnEs.style.background  = 'transparent';
            btnEs.style.color       = '#64748b';
        }
    }
};

window.setAdminLang = (lang) => {
    localStorage.setItem('app_lang', lang);
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
    updateAdminLangUI();
    showToast(lang === 'es' ? '<i class="fa-solid fa-language"></i> Idioma: Español' : '<i class="fa-solid fa-language"></i> Language: English', 'success');
};

window.addEventListener('db_synced', async () => {
    // Re-render the active admin view when background sync finishes
    // Disabled to prevent the page from fully reloading every 30 seconds.
    // if (typeof renderView === 'function') {
    //     await renderView();
    // }
});

window.addEventListener('langchange', async () => {
    if (typeof renderView === 'function') {
        await renderView();
    }
});

const updateAdminNavLabels = () => {
    document.querySelectorAll('#admin-nav a[data-view]').forEach(el => {
        const viewKey = el.dataset.view;
        const keyMap = {
            'constructor': 'dash',
            'calendario':  'calendar',
            'crm':         'crm',
            'usuarios':    'team',
            'equipo':      'team',
            'kanban':      'kanban',
            'academia':    'academy',
            'anuncios':    'announce',
            'inventario':  'inv',
            'automations': 'auto',
            'hrhub':       'hrhub'
        };
        const tKey = keyMap[viewKey] ? `admin_nav_${keyMap[viewKey]}` : null;
        if (tKey) {
            const span = el.querySelector('.nav-text');
            if (span) span.textContent = t(tKey);
        }
    });
    const themeToggle = document.getElementById('btn-theme-toggle');
    if (themeToggle) {
        const span = themeToggle.querySelector('.nav-text');
        if (span) span.textContent = t('admin_nav_theme');
    }
    const qs = document.getElementById('lbl-quick-settings');
    if (qs) qs.textContent = t('admin_quick');
    const ep = document.getElementById('lbl-edit-profile');
    if (ep) ep.textContent = t('admin_edit_profile');
    const mv = document.getElementById('lbl-mobile-version');
    if (mv) mv.textContent = t('admin_mobile');
    const lg = document.getElementById('lbl-lang-settings');
    if (lg) lg.textContent = t('admin_language');
    const lo = document.getElementById('lbl-logout-text');
    if (lo) lo.textContent = t('admin_logout');

    // Role-based visibility for HRHub and Call Center
    const usr = JSON.parse(localStorage.getItem('rs_user') || '{}');
    const rol = (usr.rol || '').toLowerCase();
    
    if (['project manager', 'manager de ventas', 'account manager'].includes(rol)) {
        document.querySelectorAll('#admin-nav a[data-view="hrhub"]').forEach(el => {
            el.style.display = 'none';
        });
    }

    if (!['admin', 'administrador', 'ceo'].includes(rol)) {
        document.querySelectorAll('#admin-nav a[data-view="callcenter"], #admin-nav a[data-view="call_center"], #admin-nav a[data-view="call-center"]').forEach(el => {
            el.style.display = 'none';
        });
    }
};

// Administrative Actions Attached to Window for Inline Buttons
window.adminDeletePipeline = async (id, e) => {
    e.stopPropagation(); e.preventDefault();
    if (confirm('¿ELIMINAR ESTE PIPELINE PERMANENTEMENTE?')) {
      const btn = e.target.closest ? e.target.closest('button') : null;
      if (btn) { btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>'; btn.style.pointerEvents = 'none'; }
      try {
        await deleteAdminPipeline(id);
        await loadData();
        renderView();
      } finally {
        if (btn) btn.style.pointerEvents = 'auto';
      }
    }
};

window.adminEditFaseName = async (id, e) => {
    if(e) { e.stopPropagation(); e.preventDefault(); }
    const db = getDB();
    const fase = db.Admin_Fases.find(f => f.id === id);
    if (!fase) return;
    if (UI.modEditFaseName) {
        UI.inpEditFaseNombre.value = fase.nombre;
        UI.btnSaveFaseName.onclick = async () => {
            const newName = UI.inpEditFaseNombre.value.trim();
            if (newName && newName !== fase.nombre) {
                fase.nombre = newName;
                await saveDB(db);
                window.closeModals();
                await loadData();
                renderView();
                showToast('Fase actualizada', 'success');
            } else if (newName === fase.nombre) {
                window.closeModals();
            }
        };
        window.showModal(UI.modEditFaseName);
    }
};

window.adminDeleteFase = async (id, e) => {
    e.stopPropagation(); e.preventDefault();
    if (confirm('¿BORRAR ESTA FASE Y TODAS SUS PREGUNTAS?')) {
      const btn = e.target.closest ? e.target.closest('button') : null;
      if (btn) { btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-red-500"></i>'; btn.style.pointerEvents = 'none'; }
      try {
        await deleteAdminFase(id);
        await loadData();
        renderView();
      } finally {
        if (btn) btn.style.pointerEvents = 'auto';
      }
    }
};

window.adminDeleteCampo = async (id, e) => {
    e.stopPropagation(); e.preventDefault();
    if (confirm('¿ELIMINAR ESTA PREGUNTA?')) {
      const btn = e.target.closest ? e.target.closest('button') : null;
      if (btn) { btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-red-500"></i>'; btn.style.pointerEvents = 'none'; }
      try {
        await deleteAdminCampo(id);
        await loadData();
        renderView();
      } finally {
        if (btn) btn.style.pointerEvents = 'auto';
      }
    }
};

window.adminEditCampo = (id, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const db = getDB();
    const campo = db.Admin_Campos_Formulario.find(c => c.id === id);
    if (!campo) return;
    // Open the same modal but in edit mode
    if (UI.modCam) {
        // Mark modal as editing this campo
        UI.modCam.dataset.editCampoId = id;
        UI.lblFaseDest.textContent = 'Editando: ' + campo.etiqueta;
        UI.inpCamFaseId.value = campo.fase_id;
        UI.inpCamEtq.value = campo.etiqueta;
        UI.inpCamTipo.value = campo.tipo;
        // Show/hide opciones
        if (campo.tipo === 'Desplegable') {
            UI.wrpCamOpc.classList.remove('hidden');
            UI.inpCamOpc.value = campo.opciones || '';
        } else {
            UI.wrpCamOpc.classList.add('hidden');
            UI.inpCamOpc.value = '';
        }
        
        const chkOpcional = document.getElementById('inp-cam-opcional');
        if (chkOpcional) chkOpcional.checked = !!campo.es_opcional;

        // Change button text
        if (UI.btnSaveCam) UI.btnSaveCam.textContent = 'Guardar Cambios';
        window.showModal(UI.modCam);
    }
};

window.adminDeleteAcademia = async (id) => {
    if (confirm('¿Eliminar este contenido?')) {
        try {
            const db = getDB();
            db.academiaContent = (db.academiaContent || []).filter(i => i.id !== id);
            const { deleteRecord } = await import('./api.js');
            await deleteRecord('academia_content', id);
            await saveDB(db);
            await renderView();
            window.addNotification('Gestor Academia', `Se eliminó el material`, 'warning');
        } catch (err) {
            console.error('Error al eliminar material:', err);
        }
    }
};

window.adminDeleteWorker = async (id, e) => {
    if(e) { e.stopPropagation(); e.preventDefault(); }
    if (confirm('¿ELIMINAR ESTE TRABAJADOR DEL SISTEMA?')) {
      await deleteAdminWorker(id);
      await renderView();
    }
};

window.adminToggleWorkerStatus = async (id, isEnabled, e) => {
    if(e) { e.stopPropagation(); }
    const workers = await getAdminWorkers();
    const worker = workers.find(w => w.id === id);
    if (worker) {
        worker.is_suspended = !isEnabled;
        await saveAdminWorker(worker);
        window.addNotification('Equipo', `Cuenta de ${worker.nombre} ha sido ${isEnabled ? 'habilitada' : 'deshabilitada'}.`, isEnabled ? 'success' : 'warning');
        // Do not re-render immediately to prevent switch jump, just save it.
    }
};

window.adminDeleteClient = async (id, e) => {
    if(e) { e.stopPropagation(); e.preventDefault(); }
    if (confirm('¿ELIMINAR ESTE CLIENTE Y SUS PROYECTOS?')) {
      const btn = e.target.closest('.btn-delete-client');
      const originalHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-red-500"></i>';
        btn.disabled = true;
      }

      try {
        // deleteClientesMaestro already updates local state atomically.
        // Do NOT call initDB() - it re-fetches from cloud and races the delete,
        // causing the deleted client to reappear before Supabase propagates.
        await deleteClientesMaestro(id);
        await renderView(); // Refresh UI immediately from updated local state
        showToast('Cliente eliminado exitosamente', 'warning');
      } catch (err) {
        console.error('Error al borrar cliente:', err);
        showToast('Error al eliminar cliente', 'error');
        if (btn) {
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      }
    }
};

window.adminBulkDeleteWorkers = async () => {
    const checked = Array.from(document.querySelectorAll('.worker-chk:checked')).map(chk => chk.dataset.id);
    if(checked.length === 0) return alert('Selecciona al menos un trabajador');
    if (confirm(`¿ELIMINAR ${checked.length} TRABAJADORES SELECCIONADOS?`)) {
      await deleteAdminWorker(checked);
      await renderView();
    }
};

window.adminBulkDeleteClients = async () => {
    const checked = Array.from(document.querySelectorAll('.cli-chk:checked')).map(chk => chk.dataset.id);
    console.log('[DEBUG] Selected for deletion:', checked);
    
    if(checked.length === 0) return alert('Selecciona al menos un cliente');
    
    if (confirm(`¿ELIMINAR ${checked.length} CLIENTES SELECCIONADOS?`)) {
      const btn = document.getElementById('btn-bulk-delete-cli');
      const originalHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Borrando...';
        btn.disabled = true;
      }

      try {
        await deleteClientesMaestro(checked);
        // deleteClientesMaestro already updates local state atomically.
        // Do NOT call initDB() - re-fetches from cloud, can race the delete.
        await renderView(); // Refresh UI immediately from updated local state
        showToast(`${checked.length} clientes eliminados`, 'warning');
      } catch (err) {
        console.error('Error al borrar clientes:', err);
        showToast('Error al eliminar clientes: ' + (err.message || 'Error desconocido'), 'error');
        if (btn) {
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      }
    }
};

window.adminDeleteProject = async (id, e) => {
    if(e) { e.stopPropagation(); e.preventDefault(); }
    if (confirm('¿ESTÑÂS SEGURO DE ELIMINAR ESTE PROYECTO?')) {
        await deleteAdminProject(id);
        const drawer = document.getElementById('kanban-drawer-overlay');
        if(drawer) drawer.remove();
        await loadData();
        renderView();
    }
};


const UI = {};
function cacheElements() {
  UI.canvas = document.getElementById('main-canvas') || document.getElementById('view-canvas') || document.getElementById('canvas');
  if (!UI.canvas) console.warn('[RENEW-WARN] No se encontró el contenedor principal (main-canvas/view-canvas)');

  UI.sidebar = document.getElementById('admin-sidebar');
  UI.hambBtn = document.getElementById('admin-hamburger-btn');
  UI.viewTitle = document.getElementById('view-title');
  UI.viewDesc = document.getElementById('view-desc');
  UI.btnReset = document.getElementById('btn-reset-db');
  UI.btnAddGlobal = document.getElementById('btn-global-action');
  
  // Modals & Inputs
  UI.modPip = document.getElementById('modal-nuclear-pip');
  UI.inpPipNom = document.getElementById('inp-pip-nombre');
  UI.inpPipCol = document.getElementById('inp-pip-color');
  UI.inpPipHex = document.getElementById('inp-pip-hex');
  UI.btnSavePip = document.getElementById('btn-save-pipeline');

  UI.modCam = document.getElementById('modal-nuclear-cam');
  UI.lblFaseDest = document.getElementById('lbl-fase-destino');
  UI.inpCamFaseId = document.getElementById('inp-cam-fase-id');
  UI.inpCamEtq = document.getElementById('inp-cam-etiqueta');
  UI.inpCamTipo = document.getElementById('inp-cam-tipo');
  UI.wrpCamOpc = document.getElementById('wrap-opciones');
  UI.inpCamOpc = document.getElementById('inp-cam-opciones');
  UI.btnSaveCam = document.getElementById('btn-save-campo');

  UI.modFas = document.getElementById('modal-nuclear-fas');
  UI.inpFasNom = document.getElementById('inp-fas-nombre');
  UI.btnSaveFas = document.getElementById('btn-save-fase');

  UI.modCli = document.getElementById('modal-nuclear-cli');
  UI.inpCliNom = document.getElementById('inp-cli-nombre');
  UI.inpCliEmail = document.getElementById('inp-cli-email');
  UI.inpCliTel = document.getElementById('inp-cli-tel');
  UI.btnSaveCli = document.getElementById('btn-save-cliente');
  UI.dropCliFoto = document.getElementById('drop-cli-foto');
  UI.inpCliFoto = document.getElementById('inp-cli-foto');
  UI.previewCliFoto = document.getElementById('cli-foto-preview');
  UI.placeholderCliFoto = document.getElementById('cli-foto-placeholder');

  UI.modInv = document.getElementById('modal-nuclear-inv');
  UI.btnSaveInv = document.getElementById('btn-save-inv');

  UI.modUsr = document.getElementById('modal-nuclear-usr');
  UI.inpUsrId = document.getElementById('inp-usr-id');
  UI.inpUsrNom = document.getElementById('inp-usr-nombre');
  UI.inpUsrApe = document.getElementById('inp-usr-apellido');
  UI.inpUsrEmail = document.getElementById('inp-usr-email');
  UI.dropUsrFoto = document.getElementById('drop-usr-foto');
  UI.inpUsrFotoFile = document.getElementById('inp-usr-foto-file');
  UI.previewUsrFoto = document.getElementById('preview-usr-foto');
  UI.placeholderUsrFoto = document.getElementById('usr-foto-placeholder');
  UI.inpUsrTel = document.getElementById('inp-usr-tel');
  UI.inpUsrDob = document.getElementById('inp-usr-dob');
  UI.inpUsrPass = document.getElementById('inp-usr-pass');
  UI.inpUsrRol = document.getElementById('inp-usr-rol');
  UI.inpUsrDept = document.getElementById('inp-usr-dept');
  UI.inpUsrSede = document.getElementById('inp-usr-sede');
  UI.btnSaveUsr = document.getElementById('btn-save-usuario');

  UI.modUsrDetail = document.getElementById('modal-worker-detail');
  UI.btnEditFromDetail = document.getElementById('btn-edit-worker-from-detail');

  UI.modCliDetail = document.getElementById('modal-client-detail');
  UI.btnEditCliFromDetail = document.getElementById('btn-edit-cli-from-detail');
  UI.btnSaveCliChanges = document.getElementById('btn-save-cli-changes');
  UI.btnCancelCliEdit = document.getElementById('btn-cancel-cli-edit');

  UI.modReset = document.getElementById('modal-reset');
  UI.modSuccess = document.getElementById('modal-success');
  UI.msgSuccess = document.getElementById('success-modal-msg');
  
  UI.modEditFaseName = document.getElementById('modal-edit-fase');
  UI.inpEditFaseNombre = document.getElementById('inp-edit-fase-nombre');
  UI.btnSaveFaseName = document.getElementById('btn-save-fase-name');

  UI.btnToggleAuto = document.getElementById('btn-toggle-auto');
  UI.subAuto = document.getElementById('sub-auto');
  UI.btnToggleInv = document.getElementById('btn-toggle-inv');
  UI.subInv = document.getElementById('sub-inv');

  // Header Buttons
  UI.btnNotifications = document.getElementById('btn-notifications');
  UI.btnChat = document.getElementById('btn-header-chat');
  UI.btnHeaderSettings = document.getElementById('btn-header-settings');
  UI.settingsDropdown = document.getElementById('settings-dropdown');
  UI.btnMenuEditProfile = document.getElementById('btn-menu-edit-profile');

  // Notifications Panel Elements
  UI.notPanel = document.getElementById('notifications-panel');
  UI.notOverlay = document.getElementById('notifications-overlay');
  UI.notList = document.getElementById('notifications-list');
  UI.notBadge = document.getElementById('notifications-badge');
  UI.btnCloseNot = document.getElementById('btn-close-notifications');
  
  // Footer User Elements
  UI.footerUserName = document.getElementById('footer-user-name');
  UI.footerUserRole = document.getElementById('footer-user-role');
  UI.footerUserAvatar = document.getElementById('footer-user-avatar');

  document.querySelectorAll('.btn-cancel').forEach(btn => 
    btn.addEventListener('click', closeModals)
  );
}

function bindGlobalEvents() {
  // Sidebar Navigation

  // Sidebar Navigation
  document.querySelectorAll('#admin-nav a').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      document.querySelectorAll('#admin-nav a').forEach(l => {
        l.classList.remove('bg-tealAccent/10', 'text-tealAccent', 'border-tealAccent/20', 'sidebar-item-active');
        l.classList.add('text-gray-500', 'dark:text-gray-400');
        l.classList.remove('hover:bg-tealAccent/10', 'hover:text-tealAccent', 'dark:hover:text-tealAccent');
      });
      const t = e.currentTarget;
      t.classList.remove('text-gray-500', 'dark:text-gray-400');
      t.classList.add('sidebar-item-active');
      
      state.activeView = t.dataset.view;
      state.activeEcoFilter = t.dataset.eco || null; // For inventory filtering
      
      // If switching views, ensure we scroll to top or reset necessary states
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await renderView();
    });
  });

  // Toggle Inventario Submenu
  if (UI.btnToggleInv && UI.subInv) {
    UI.btnToggleInv.addEventListener('click', (e) => {
      e.preventDefault();
      UI.subInv.classList.toggle('hidden');
      UI.btnToggleInv.classList.toggle('open');
      const icon = UI.btnToggleInv.querySelector('.fa-chevron-down');
      if (icon) icon.classList.toggle('rotate-180');
    });
  }

  // Toggle Automations Submenu
  if (UI.btnToggleAuto && UI.subAuto) {
    UI.btnToggleAuto.addEventListener('click', (e) => {
      e.preventDefault();
      UI.subAuto.classList.toggle('hidden');
      UI.btnToggleAuto.classList.toggle('open');
      const icon = UI.btnToggleAuto.querySelector('.fa-chevron-down');
      if (icon) icon.classList.toggle('rotate-180');
    });
  }

  // ââ‚¬ââ‚¬ Sidebar Toggle (Collapse) ââ‚¬ââ‚¬
  if (UI.hambBtn && UI.sidebar) {
    UI.hambBtn.addEventListener('click', (e) => {
      e.preventDefault();
      UI.sidebar.classList.toggle('collapsed');
      
      // Update kanban arrow positions if active
      if (state.activeView === 'kanban') {
          setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
      }
    });
  }

  // ââ‚¬ââ‚¬ Global Action Button (Ensure reliability) ââ‚¬ââ‚¬
  if (UI.btnAddGlobal) {
      UI.btnAddGlobal.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof window.handleGlobalAdd === 'function') {
              window.handleGlobalAdd();
          }
      });
  }

  // ââ‚¬ââ‚¬ Global Edit Delegate (Most Robust) ââ‚¬ââ‚¬
  document.addEventListener('click', async (e) => {
    // ââ‚¬ââ‚¬ Theme Toggle Handle ââ‚¬ââ‚¬
    const themeBtn = e.target.closest('#btn-theme-toggle');
    if (themeBtn) {
      const isCurrentlyDark = document.documentElement.classList.contains('dark');
      const newTheme = isCurrentlyDark ? 'light' : 'dark';
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', newTheme);
      showToast(newTheme === 'dark' ? '<i class="fa-solid fa-moon"></i> Modo Oscuro' : '☀️ Modo Claro', 'success');
      return;
    }

    try {
        // ââ‚¬ââ‚¬ Inventory & Global Actions (Prioritized) ââ‚¬ââ‚¬
        // (Global Action is handled via inline onclick in admin.html)

        // (Inventory button clicks are handled via inline onclick in renderView)

        const btnSedeTab = e.target.closest('.inv-sede-tab');
        if (btnSedeTab) {
            state.activeInventorySede = btnSedeTab.dataset.sede;
            state.activeInventoryLine = 'all'; // Reset line when changing sede
            await renderView();
            return;
        }

        const btnLineTab = e.target.closest('.inv-line-tab');
        if (btnLineTab) {
            state.activeInventoryLine = btnLineTab.dataset.line;
            await renderView();
            return;
        }

        const btnSaveInvMaster = e.target.closest('#btn-save-inv');
        if (btnSaveInvMaster) {
            e.preventDefault();
            // Re-implement or Call save handler
            // Note: Since we want to ensure it works, we ensure the handler is accessible
        }
    } catch (err) {
        console.error("Delegation Error (Inventory):", err);
        showToast("Error en acción de inventario: " + err.message, "error");
    }

    // 1. Edit User Button
    const btnEditUsr = e.target.closest('.btn-edit-usuario');
    if (btnEditUsr) {
      const id = btnEditUsr.dataset.id;
      triggerUserEdit(id);
      return;
    }

    // 2. Worker Name Link (Show Detail)
    const nameLink = e.target.closest('.worker-name-link');
    if (nameLink) {
      const id = nameLink.dataset.id;
      await showWorkerDetail(id);
      return;
    }

    // 2.5 Partner Name Link (Edit)
    const partnerLink = e.target.closest('.partner-name-link');
    if (partnerLink) {
      e.preventDefault();
      const id = partnerLink.dataset.id;
      triggerPartnerEdit(id);
      return;
    }

    // 3. Client Name Link (CRM Maestro)
    const cliLink = e.target.closest('.client-name-link');
    if (cliLink) {
      e.preventDefault();
      const id = cliLink.dataset.id;
      await showClientDetail(id);
      return;
    }

    // 4. Assign Users to Phase Button
    const btnAssignUsers = e.target.closest('.btn-assign-users');
    if (btnAssignUsers) {
      e.preventDefault();
      const faseId = btnAssignUsers.dataset.faseid;
      openFaseUserPicker(faseId);
      return;
    }

    // Handlers for individual and bulk deletes removed from here as they are now 
    // centralized in the main Unified Delegation listener at the bottom of this file.
    // This prevents multiple confirmation dialogs and race conditions.


    // Modal Actions (Inventory)
    const btnSaveInv = e.target.closest('#btn-save-inv');
    if (btnSaveInv) {
        const editId = btnSaveInv.dataset.editId;
        const codigo = document.getElementById('inp-inv-codigo').value.trim();
        const linea = document.getElementById('inp-inv-linea').value.trim();
        const nombre = document.getElementById('inp-inv-nombre').value.trim();
        const medida = document.getElementById('inp-inv-medida') ? document.getElementById('inp-inv-medida').value.trim() : '';
        const boton = document.getElementById('inp-inv-boton') ? document.getElementById('inp-inv-boton').value.trim() : '';
        const color = document.getElementById('inp-inv-color') ? document.getElementById('inp-inv-color').value.trim() : '';
        const locacion = document.getElementById('inp-inv-sede-select').value;
        const stock = parseInt(document.getElementById('inp-inv-stock').value) || 0;

        if (!nombre || !codigo) return alert('Código y Producto son obligatorios');

        const invData = getInventario();

        if (editId) {
            const idx = invData.findIndex(i => i.id === editId);
            if (idx > -1) {
                invData[idx] = { 
                    ...invData[idx], 
                    id: codigo, 
                    nombreItem: nombre, 
                    ecosistema: linea, 
                    medida,
                    boton,
                    color,
                    locacion, 
                    storage: locacion, 
                    stockActual: stock 
                };
            }
        } else {
            invData.push({
              id: codigo,
              nombreItem: nombre,
              ecosistema: linea,
              medida,
              boton,
              color,
              category: state.activeEcoFilter || 'solar',
              locacion: locacion,
              storage: locacion,
              stockActual: stock
            });
        }
        
        saveInventario(invData);
        delete btnSaveInv.dataset.editId; 
        
        window.closeModals();
        await renderView();
        window.addNotification('Inventario', editId ? 'Artículo actualizado' : 'Nuevo artículo registrado', 'success');
        return;
    }

    const btnConfirmStock = e.target.closest('#btn-confirm-quick-stock');
    if (btnConfirmStock) {
        // Accessing the temporary handler set in window.addStock if needed, 
        // or just re-implementing logic here for robustness.
        // For simplicity, we assume window.addStock sets the behavior.
        // But delegator is better.
    }
  });

  async function triggerUserEdit(id, fallbackData = null) {
      console.log("Triggering Edit for User ID:", id);
      let usr;
      
      if (fallbackData) {
          usr = fallbackData;
      } else {
          const workers = await getAdminWorkers();
          usr = workers.find(u => u.id === id);
      }
      
      if (usr) {
        document.getElementById('modal-usr-title').textContent = "Editar Trabajador";
        UI.inpUsrId.value = usr.id;
        UI.inpUsrNom.value = usr.nombre || '';
        UI.inpUsrApe.value = usr.apellido || '';
        UI.inpUsrEmail.value = usr.email || '';
        const phonePartsUsr = (usr.telefono || '').split(' ');
        UI.inpUsrRol.value = usr.rol || 'novato';
        if(UI.inpUsrDept) UI.inpUsrDept.value = usr.department || '';
        if(UI.inpUsrSede) {
            const savedSede = (usr.sede || '').toLowerCase();
            if (savedSede === 'orlando' || savedSede === 'miami' || savedSede === 'tampa' || savedSede === 'venezuela' || savedSede === 'brasil' || savedSede === 'colombia' || savedSede === 'remoto') {
                UI.inpUsrSede.value = savedSede;
            } else if (!savedSede || savedSede === '-') {
                UI.inpUsrSede.value = 'orlando'; // default
            } else {
                UI.inpUsrSede.value = savedSede;
            }
        }
        if (phonePartsUsr.length > 1 && phonePartsUsr[0].startsWith('+')) {
            if(document.getElementById('sel-usr-cc')) document.getElementById('sel-usr-cc').value = phonePartsUsr[0];
            UI.inpUsrTel.value = phonePartsUsr.slice(1).join(' ');
        } else {
            if(document.getElementById('sel-usr-cc')) document.getElementById('sel-usr-cc').value = '+1';
            UI.inpUsrTel.value = usr.telefono || '';
        }
        UI.inpUsrDob.value = usr.dob || '';
        UI.inpUsrPass.value = usr.password || usr.pass || 'renew123';
        
        // Re-init date pickers to apply flatpickr to modal fields
        if(window.initDatePickers) window.initDatePickers();
        
        state.currentUsrFoto = usr.foto;
        if (usr.foto) {
          UI.previewUsrFoto.style.backgroundImage = `url(${usr.foto})`;
          UI.previewUsrFoto.classList.remove('hidden');
          UI.placeholderUsrFoto.classList.add('hidden');
        } else {
          UI.previewUsrFoto.classList.add('hidden');
          UI.placeholderUsrFoto.classList.remove('hidden');
        }

        // Pre-fill W-9 state for edit mode
        state.currentUsrW9Url = usr.w9Url || null;
        const w9Placeholder = document.getElementById('w9-upload-placeholder');
        const w9Success = document.getElementById('w9-upload-success');
        const w9NameEl = document.getElementById('w9-file-name');
        const w9FileInp = document.getElementById('inp-usr-w9-file');
        if (usr.w9Url) {
          if (w9Placeholder) w9Placeholder.classList.add('hidden');
          if (w9Success) { w9Success.classList.remove('hidden'); w9Success.classList.add('flex'); }
          if (w9NameEl) w9NameEl.textContent = 'Archivo cargado âÅ“œ';
        } else {
          if (w9Placeholder) w9Placeholder.classList.remove('hidden');
          if (w9Success) { w9Success.classList.add('hidden'); w9Success.classList.remove('flex'); }
          if (w9FileInp) w9FileInp.value = '';
        }
        
        window.showModal(UI.modUsr);
      }
  }

  if (UI.btnEditFromDetail) {
    UI.btnEditFromDetail.addEventListener('click', () => {
        const id = UI.btnEditFromDetail.dataset.id;
        // Check if current logged-in user has permission (CEO or Admin)
        const currentUser = (() => {
            try { return JSON.parse(localStorage.getItem('rs_user') || '{}'); } catch(e) { return {}; }
        })();
        const currentRol = (currentUser.rol || '').toLowerCase();
        const canEdit = currentRol === 'ceo' || currentRol === 'admin' || currentRol === 'administrador';
        if (!canEdit) {
            window.addNotification('Seguridad', 'Solo el CEO o Administrador pueden editar perfiles.', 'error');
            return;
        }
        // Toggle inline edit mode in the detail modal
        toggleDetailEditMode(id);
    });
  }

  if (UI.btnEditCliFromDetail) {
    UI.btnEditCliFromDetail.addEventListener('click', () => {
        const id = UI.btnEditCliFromDetail.dataset.id;
        toggleClientEditMode(id);
    });
  }

  if (UI.btnCancelCliEdit) {
    UI.btnCancelCliEdit.addEventListener('click', () => {
        exitClientEditMode();
    });
  }

  if (UI.btnSaveCliChanges) {
    UI.btnSaveCliChanges.addEventListener('click', async () => {
        await saveClientChanges();
    });
  }

  // ID Photo Upload Logic
  const inpCliIdPhotoFile = document.getElementById('inp-cli-id-photo-file');
  if (inpCliIdPhotoFile) {
    inpCliIdPhotoFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        // Use server upload instead of base64
        state.currentCliIdPhoto = await uploadFile(file, 'profiles');
        const preview = document.getElementById('cli-id-photo-preview');
        if (preview) {
            preview.querySelector('img').src = state.currentCliIdPhoto;
            preview.classList.remove('hidden');
        }
      }
    });
  }

  const btnRemoveCliIdPhoto = document.getElementById('btn-remove-cli-id-photo');
  if (btnRemoveCliIdPhoto) {
    btnRemoveCliIdPhoto.addEventListener('click', () => {
        state.currentCliIdPhoto = null;
        const preview = document.getElementById('cli-id-photo-preview');
        if (preview) preview.classList.add('hidden');
        if (inpCliIdPhotoFile) inpCliIdPhotoFile.value = '';
    });
  }

  // Notification Listeners (Migrated to global window.showNotifications)

  // Global Function for adding notifications
  window.addNotification = (title, message, type = 'info') => {
    if (!UI.notList) return;

    const accentColor = {
      success: 'text-tealAccent',
      warning: 'text-orangeAccent',
      error: 'text-red-500',
      info: 'text-blue-400'
    }[type] || 'text-tealAccent';

    const bgOpacity = {
        success: 'bg-tealAccent/5',
        warning: 'bg-orangeAccent/5',
        error: 'bg-red-500/5',
        info: 'bg-blue-400/5'
    }[type] || 'bg-white/5';

    const icon = {
      success: 'fa-circle-check',
      warning: 'fa-triangle-exclamation',
      error: 'fa-circle-xmark',
      info: 'fa-circle-info'
    }[type] || 'fa-bell';

    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const html = `
      <div class="p-4 rounded-2xl ${bgOpacity} border border-white/5 group hover:border-tealAccent/20 transition-all animate-fadeIn relative overflow-hidden">
        <div class="absolute top-0 left-0 w-1 h-full ${type === 'success' ? 'bg-tealAccent' : type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-orangeAccent' : 'bg-blue-400'} opacity-50"></div>
        <div class="flex justify-between items-start mb-2">
          <div class="flex items-center gap-2">
            <i class="fa-solid ${icon} ${accentColor} text-[10px]"></i>
            <h4 class="${accentColor} font-black text-[10px] uppercase tracking-widest">${title}</h4>
          </div>
          <span class="text-[9px] text-gray-500 font-bold opacity-60">${time}</span>
        </div>
        <p class="text-xs text-gray-400 font-medium leading-relaxed pl-4">${message}</p>
      </div>
    `;

    UI.notList.insertAdjacentHTML('afterbegin', html);
    
    // Show badge if panel is closed
    if (UI.notPanel.classList.contains('translate-x-full')) {
      UI.notBadge.classList.remove('hidden');
    }
  };

  if (UI.btnChat) {
    UI.btnChat.addEventListener('click', () => {
      showToast("Iniciando cifrado de canal seguro...", "default");
      setTimeout(() => showToast("Conectando con el equipo de soporte RENEW...", "info"), 600);
    });
  }

  if (UI.btnHeaderSettings) {
    UI.btnHeaderSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.settingsDropdown.classList.toggle('hidden');
    });
  }

  if (UI.btnMenuEditProfile) {
    UI.btnMenuEditProfile.addEventListener('click', () => {
      UI.settingsDropdown.classList.add('hidden');
      triggerUserEdit('admin_julian', {
        id: 'admin_julian',
        nombre: 'Julian',
        apellido: 'Vercetti',
        email: 'julian@renewsolar.com',
        rol: 'Admin',
        department: 'Dirección General',
        telefono: '+1 (305) 555-9988'
      });
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
      if (UI.settingsDropdown && !UI.settingsDropdown.classList.contains('hidden')) {
          if (!UI.settingsDropdown.contains(e.target) && !UI.btnHeaderSettings.contains(e.target)) {
              UI.settingsDropdown.classList.add('hidden');
          }
      }
  });

  const btnLogout = document.getElementById('btn-quick-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('rs_user');
      localStorage.removeItem('active_unit');
      window.location.href = 'index.html';
    });
  }




  // ââ‚¬ââ‚¬ Save/Edit Usuario Event ââ‚¬ââ‚¬
  if (UI.btnSaveUsr) {
    UI.btnSaveUsr.addEventListener('click', async () => {
      const id = UI.inpUsrId.value;
      const initials = (UI.inpUsrNom.value[0] + (UI.inpUsrApe.value[0] || 'X')).toUpperCase();
      
      // Read pipeline permissions (from create modal checkboxes)
      const checkedPips = Array.from(
        document.querySelectorAll('.usr-pip-chk:checked')
      ).map(chk => chk.dataset.pip);

      const workers = await getAdminWorkers();
      const existing = id ? workers.find(w => w.id === id) : null;

      const newUsr = {
        id: id || crypto.randomUUID(),
        nombre: UI.inpUsrNom.value.trim(),
        apellido: UI.inpUsrApe.value.trim(),
        email: UI.inpUsrEmail.value.trim(),
        foto: state.currentUsrFoto,
        w9Url: state.currentUsrW9Url,
        telefono: (document.getElementById('sel-usr-cc') ? document.getElementById('sel-usr-cc').value + ' ' : '') + UI.inpUsrTel.value.trim(),
        dob: UI.inpUsrDob.value,
        initials: initials,
        rol: UI.inpUsrRol.value,
        rango: document.getElementById('inp-usr-rank').value,
        department: UI.inpUsrDept ? UI.inpUsrDept.value.trim() : '',
        sede: UI.inpUsrSede ? UI.inpUsrSede.value : 'orlando',
        password: UI.inpUsrPass.value.trim(),
        unidades: checkedPips,
        is_suspended: existing ? (existing.is_suspended || false) : false,
        banco_nombre: document.getElementById('inp-usr-banco-nombre')?.value.trim() || '',
        banco_cuenta: document.getElementById('inp-usr-banco-cuenta')?.value.trim() || '',
        banco_ruta:   document.getElementById('inp-usr-banco-ruta')?.value.trim()   || '',
        zadarma_sip_id: document.getElementById('inp-usr-sip-id')?.value.trim() || ''
      };

      if (!newUsr.nombre || !newUsr.apellido || !newUsr.email) return showToast('Datos obligatorios incompletos', 'error');

      // Bloquear botón y mostrar animación
      const originalText = UI.btnSaveUsr.innerHTML;
      UI.btnSaveUsr.disabled = true;
      UI.btnSaveUsr.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Creando...`;
      UI.btnSaveUsr.classList.add('opacity-70', 'cursor-not-allowed');

      try {
          await saveAdminWorker(newUsr);
          window.closeModals();
          window.addNotification('Usuarios', 'Perfil creado exitosamente', 'success');
          await renderView();
      } catch (error) {
          console.error('[ERROR] Guardando trabajador:', error);
          showToast('Hubo un problema al crear el perfil.', 'error');
      } finally {
          // Restaurar botón (por si el modal se vuelve a abrir luego)
          UI.btnSaveUsr.disabled = false;
          UI.btnSaveUsr.innerHTML = originalText;
          UI.btnSaveUsr.classList.remove('opacity-70', 'cursor-not-allowed');
      }
    });
  }

  // ââ‚¬ââ‚¬ User Photo Upload ââ‚¬ââ‚¬
  if (UI.dropUsrFoto) {
    UI.dropUsrFoto.addEventListener('click', () => UI.inpUsrFotoFile.click());
    UI.dropUsrFoto.addEventListener('dragover', (e) => {
        e.preventDefault();
        UI.dropUsrFoto.classList.add('border-tealAccent', 'bg-tealAccent/5');
    });
    UI.dropUsrFoto.addEventListener('dragleave', () => {
        UI.dropUsrFoto.classList.remove('border-tealAccent', 'bg-tealAccent/5');
    });
    UI.dropUsrFoto.addEventListener('drop', async (e) => {
        e.preventDefault();
        UI.dropUsrFoto.classList.remove('border-tealAccent', 'bg-tealAccent/5');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            try {
                showToast('Subiendo foto...', 'info');
                state.currentUsrFoto = await uploadFile(file, 'profiles');
                UI.previewUsrFoto.style.backgroundImage = `url(${state.currentUsrFoto})`;
                UI.previewUsrFoto.classList.remove('hidden');
                UI.placeholderUsrFoto.classList.add('hidden');
                showToast('Foto cargada correctamente', 'success');
            } catch (err) {
                console.error('Error subiendo foto:', err);
                showToast('Error al subir la foto', 'error');
            }
        }
    });
  }
  if (UI.inpUsrFotoFile) {
    UI.inpUsrFotoFile.addEventListener('change', async () => {
      if (UI.inpUsrFotoFile.files.length) {
        try {
            showToast('Subiendo foto...', 'info');
            state.currentUsrFoto = await uploadFile(UI.inpUsrFotoFile.files[0], 'profiles');
            UI.previewUsrFoto.style.backgroundImage = `url(${state.currentUsrFoto})`;
            UI.previewUsrFoto.classList.remove('hidden');
            UI.placeholderUsrFoto.classList.add('hidden');
            showToast('Foto cargada correctamente', 'success');
        } catch (err) {
            console.error('Error subiendo foto:', err);
            showToast('Error al subir la foto', 'error');
        }
      }
    });
  }

  // ââ‚¬ââ‚¬ W-9 File Upload ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
  state.currentUsrW9Url = null;

  window.clearW9Upload = function() {
    state.currentUsrW9Url = null;
    const placeholder = document.getElementById('w9-upload-placeholder');
    const success = document.getElementById('w9-upload-success');
    const inp = document.getElementById('inp-usr-w9-file');
    if (placeholder) placeholder.classList.remove('hidden');
    if (success) success.classList.add('hidden');
    if (inp) inp.value = '';
  };

  const inpW9File = document.getElementById('inp-usr-w9-file');
  if (inpW9File) {
    inpW9File.addEventListener('change', async () => {
      const file = inpW9File.files[0];
      if (!file) return;
      const placeholder = document.getElementById('w9-upload-placeholder');
      const success = document.getElementById('w9-upload-success');
      const nameEl = document.getElementById('w9-file-name');
      try {
        showToast('Subiendo documento W-9...', 'info');
        const fileUrl = await uploadFile(file, 'documents');
        state.currentUsrW9Url = fileUrl;
        
        if (nameEl) nameEl.textContent = file.name;
        if (placeholder) placeholder.classList.add('hidden');
        if (success) {
          success.classList.remove('hidden');
          success.classList.add('flex');
        }
        showToast('Documento subido con éxito', 'success');
      } catch(e) {
        console.error('Error subiendo W-9:', e);
        showToast('Error al subir el documento', 'error');
      }
    });
  }
  // ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬

  // ââ‚¬ââ‚¬ Upload Partners W9 ââ‚¬ââ‚¬
  const inpPartnerW9 = document.getElementById('inp-partner-w9-file');
  if (inpPartnerW9) {
      inpPartnerW9.addEventListener('change', async () => {
          const file = inpPartnerW9.files[0];
          if (!file) return;
          const nameEl = document.getElementById('partner-w9-text');
          try {
              state.currentPartnerW9Url = await uploadFile(file, 'documents');
              if (nameEl) nameEl.textContent = file.name;
          } catch(e) {
              console.error('Error uploading partner w9:', e);
          }
      });
  }

  // ââ‚¬ââ‚¬ Upload Partners Seguro ââ‚¬ââ‚¬
  const inpPartnerSeguro = document.getElementById('inp-partner-seguro-file');
  if (inpPartnerSeguro) {
      inpPartnerSeguro.addEventListener('change', async () => {
          const file = inpPartnerSeguro.files[0];
          if (!file) return;
          const nameEl = document.getElementById('partner-seguro-text');
          try {
              state.currentPartnerSeguroUrl = await uploadFile(file, 'documents');
              if (nameEl) nameEl.textContent = file.name;
          } catch(e) {
              console.error('Error uploading partner seguro:', e);
          }
      });
  }

  // ââ‚¬ââ‚¬ Save Partner / Proveedor ââ‚¬ââ‚¬
  const btnSavePartner = document.getElementById('btn-save-partner');
  if (btnSavePartner) {
      btnSavePartner.addEventListener('click', async () => {
          const btn = btnSavePartner;
          const originalText = btn.innerHTML;
          btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
          btn.disabled = true;

          const id = document.getElementById('inp-partner-id').value;
          const empresa = document.getElementById('inp-partner-empresa').value.trim();
          const contacto = document.getElementById('inp-partner-contacto').value.trim();
          const servicio = document.getElementById('inp-partner-servicio').value;
          const tel = document.getElementById('inp-partner-tel').value.trim();
          const email = document.getElementById('inp-partner-email').value.trim();
          const area = document.getElementById('inp-partner-area').value.trim();
          
          if (!empresa) { 
              showToast('La Empresa es obligatoria', 'error');
              btn.disabled=false; 
              btn.innerHTML=originalText; 
              return; 
          }

          const db = getDB();
          db.Admin_Proveedores = db.Admin_Proveedores || [];
          
          const newPartner = {
              id: id || crypto.randomUUID(),
              empresa,
              contacto,
              servicio,
              telefono: tel,
              email,
              area,
              w9Url: state.currentPartnerW9Url || null,
              seguroUrl: state.currentPartnerSeguroUrl || null,
              created_at: new Date().toISOString()
          };

          if (id) {
              const idx = db.Admin_Proveedores.findIndex(p => p.id === id);
              if (idx !== -1) {
                  // Preserve original created_at if editing
                  newPartner.created_at = db.Admin_Proveedores[idx].created_at || newPartner.created_at;
                  db.Admin_Proveedores[idx] = newPartner;
              }
          } else {
              db.Admin_Proveedores.push(newPartner);
          }

          await saveDB(db);
          window.closeModals();
          await loadData();
          await renderView();
          showToast('Partner guardado exitosamente', 'success');
          
          btn.innerHTML = originalText;
          btn.disabled = false;
      });
  }

  window.triggerPartnerEdit = (id) => {
      const db = getDB();
      const p = (db.Admin_Proveedores || []).find(x => x.id === id);
      if (!p) return;

      const title = document.getElementById('modal-partner-title');
      if(title) title.textContent = 'Editar Partner / Proveedor';
      
      document.getElementById('inp-partner-id').value = p.id;
      document.getElementById('inp-partner-empresa').value = p.empresa || '';
      document.getElementById('inp-partner-contacto').value = p.contacto || '';
      let servVal = p.servicio || 'General';
      if (servVal.toLowerCase() === 'egenral') servVal = 'General';
      document.getElementById('inp-partner-servicio').value = servVal;
      document.getElementById('inp-partner-tel').value = p.telefono || '';
      document.getElementById('inp-partner-email').value = p.email || '';
      document.getElementById('inp-partner-area').value = p.area || '';
      
      state.currentPartnerW9Url = p.w9Url || null;
      state.currentPartnerSeguroUrl = p.seguroUrl || null;
      
      const w9Text = document.getElementById('partner-w9-text');
      if (w9Text) w9Text.textContent = p.w9Url ? 'W-9 Cargado' : 'Subir W-9';
      
      const seguroText = document.getElementById('partner-seguro-text');
      if (seguroText) seguroText.textContent = p.seguroUrl ? 'Seguro Cargado' : 'Subir Seguro';

      window.showModal(document.getElementById('modal-nuclear-partner'));
  };
  // ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬

  // ââ‚¬ââ‚¬ Detail User Photo Upload ââ‚¬ââ‚¬
  const inpDetUsrFotoFile = document.getElementById('det-usr-foto-file');
  if (inpDetUsrFotoFile) {
      inpDetUsrFotoFile.addEventListener('change', async (e) => {
          if (inpDetUsrFotoFile.files.length) {
              const file = inpDetUsrFotoFile.files[0];
              try {
                  showToast('Actualizando foto de perfil...', 'info');
                  const fileUrl = await uploadFile(file, 'profiles');
                  state.currentUsrFoto = fileUrl; // Update central state
                  
                  const avatarBox = document.getElementById('det-usr-avatar');
                  if (avatarBox) {
                      avatarBox.style.backgroundImage = `url(${fileUrl})`;
                      avatarBox.innerHTML = ''; // clear initial letters
                  }
                  
                  // Save immediately to database
                  const editBtn = document.getElementById('btn-edit-worker-from-detail');
                  if (editBtn && editBtn.dataset.id) {
                      const editId = editBtn.dataset.id;
                      const workers = await getAdminWorkers();
                      const usr = workers.find(u => u.id === editId);
                      if (usr) {
                          usr.foto = fileUrl;
                          await saveAdminWorker(usr);
                          showToast('Foto de perfil actualizada', 'success');
                          await renderView(); // refresh table view
                      }
                  }
              } catch (err) {
                  console.error('Error actualizando foto:', err);
                  showToast('Error al actualizar la foto de perfil', 'error');
              }
          }
      });
  }

  if (UI.btnReset) {
    UI.btnReset.addEventListener('click', () => {
      UI.modReset.style.display = 'flex';
    });
  }

  if (UI.btnConfirmReset) {
    UI.btnConfirmReset.addEventListener('click', async () => {
      UI.btnConfirmReset.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Reiniciando...';
      await nukeAndResetDB();
      window.location.reload();
    });
  }

  // CRM Photo logic
  if (UI.dropCliFoto) {
    UI.dropCliFoto.addEventListener('click', () => UI.inpCliFoto.click());
    UI.dropCliFoto.addEventListener('dragover', (e) => {
        e.preventDefault();
        UI.dropCliFoto.classList.add('border-tealAccent', 'bg-tealAccent/5');
    });
    UI.dropCliFoto.addEventListener('dragleave', () => {
        UI.dropCliFoto.classList.remove('border-tealAccent', 'bg-tealAccent/5');
    });
    UI.dropCliFoto.addEventListener('drop', async (e) => {
        e.preventDefault();
        UI.dropCliFoto.classList.remove('border-tealAccent', 'bg-tealAccent/5');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            state.currentCliFoto = await uploadFile(file, 'profiles');
            UI.previewCliFoto.style.backgroundImage = `url(${state.currentCliFoto})`;
            UI.previewCliFoto.classList.remove('hidden');
            UI.placeholderCliFoto.classList.add('hidden');
        }
    });
  }
  if (UI.inpCliFoto) {
    UI.inpCliFoto.addEventListener('change', async () => {
      if (UI.inpCliFoto.files.length) {
        state.currentCliFoto = await uploadFile(UI.inpCliFoto.files[0], 'profiles');
        UI.previewCliFoto.style.backgroundImage = `url(${state.currentCliFoto})`;
        UI.previewCliFoto.classList.remove('hidden');
        UI.placeholderCliFoto.classList.add('hidden');
      }
    });
  }

  // Header "Global" Action Button moved to document body delegator for maximum reliability

  // (Global handler moved to window.handleGlobalAdd at top level)

  function autoFillPipelinePerms(selectedRol) {
    const dbLocal = getDB();
    const pipelines = dbLocal.Admin_Pipelines || [];
    document.querySelectorAll('.usr-pip-chk').forEach(chk => {
      const pipName = chk.dataset.pip;
      const pip = pipelines.find(p => p.nombre === pipName);
      // Check if the selected role has access to this pipeline
      const hasAccess = !pip || !pip.rolesConAcceso || pip.rolesConAcceso.length === 0
        ? true  // No restrictions means all have access
        : pip.rolesConAcceso.includes(selectedRol);
      chk.checked = hasAccess;
    });
  }

  // Kanban Drag & Drop Listeners
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.kanban-card');
    if (card) {
      e.dataTransfer.setData('text/plain', card.dataset.proyectoid);
      setTimeout(() => card.style.opacity = '0.4', 0);
    }
  });

  document.addEventListener('dragend', (e) => {
    const card = e.target.closest('.kanban-card');
    if (card) card.style.opacity = '1';
  });

  document.addEventListener('dragover', (e) => {
    if (e.target.closest('.kanban-drop-zone')) {
      e.preventDefault();
    }
  });

  document.addEventListener('drop', async (e) => {
    const zone = e.target.closest('.kanban-drop-zone');
    if (zone) {
      e.preventDefault();
      const projectId = e.dataTransfer.getData('text/plain');
      const newFaseId = zone.dataset.faseid;
      
      const { saveDB } = await import('./api.js');
      const db = getDB();
      const p = db.Proyectos_Dinamicos.find(x => x.id === projectId);
      if (p && p.fase_id !== newFaseId) {
        const oldFaseId = p.fase_id;
        p.fase_id = newFaseId;
        
        // AUTO-SET CLOSURE DATE IF FINISHED
        const { isProjectFinished } = await import('./api.js');
        const isNowFinished = isProjectFinished(p, db);
        if (isNowFinished) {
            p.fecha_cierre = new Date().toISOString().split('T')[0];
            p.estado = 'Completado';
            console.log(`[KANBAN] Project ${projectId} marked as closed today.`);
        } else if (p.estado === 'Completado' || oldFaseId === 'Completado' || oldFaseId === null) {
            // If moved BACK from finished to open
            p.estado = 'En Proceso';
            // p.fecha_cierre = null;
        }

        await saveDB(db);
        await renderView();
      }
    }
  });

  // Kanban Card Click - Open Project Detail Drawer
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.kanban-card');
    // Ignore if currently dragging
    if (card && !e.target.closest('[draggable]')?.style.opacity?.includes('0.4')) {
      const projectId = card.dataset.proyectoid;
      if (projectId) openKanbanDrawer(projectId);
    }
  });

  // ââ‚¬ââ‚¬ Global Modal Close Delegate ââ‚¬ââ‚¬
  document.addEventListener('click', (e) => {
    const btnCancel = e.target.closest('.btn-cancel');
    if (btnCancel) {
      if (typeof window.closeModals === 'function') {
        window.closeModals();
      }
    }
  });

  // Save Cliente (CRM) Event - with Document Upload (Phase 4)
  if (UI.btnSaveCli) {
    // ââ‚¬ââ‚¬ File Upload Visual Feedback Helper ââ‚¬ââ‚¬
    const setupDocUpload = (inputId, dropId, labelId, successColor) => {
      const inp = document.getElementById(inputId);
      const drop = document.getElementById(dropId);
      const lbl = document.getElementById(labelId);
      if (!inp) return;
      inp.addEventListener('change', () => {
        if (inp.files.length) {
          if (drop) { drop.style.borderColor = successColor; drop.style.background = successColor + '10'; }
          if (lbl) { lbl.textContent = 'âÅ“œ ' + inp.files[0].name.substring(0, 20); lbl.style.color = successColor; }
        }
      });
    };
    setupDocUpload('inp-cli-adjunto-id', 'drop-cli-adjunto-id', 'lbl-cli-adj-id', '#00f5d4');
    setupDocUpload('inp-cli-adjunto-bill', 'drop-cli-adjunto-bill', 'lbl-cli-adj-bill', '#f59e0b');
    setupDocUpload('inp-cli-adjunto-seguro', 'drop-cli-adjunto-seguro', 'lbl-cli-adj-seguro', '#a855f7');
    setupDocUpload('inp-cli-ofi-aplicacion', 'drop-cli-ofi-aplicacion', 'lbl-cli-ofi-app', '#f59e0b');
    setupDocUpload('inp-cli-ofi-recibo', 'drop-cli-ofi-recibo', 'lbl-cli-ofi-recibo', '#f59e0b');

    UI.btnSaveCli.addEventListener('click', async () => {
      const state_id = document.getElementById('inp-cli-state').value.trim();
      const firstNom = document.getElementById('inp-cli-nombre').value.trim();
      const apellido = document.getElementById('inp-cli-apellido').value.trim();
      const dob = document.getElementById('inp-cli-dob').value;
      const telVal = document.getElementById('inp-cli-tel').value.trim();
      const ccVal = document.getElementById('sel-cli-cc') ? document.getElementById('sel-cli-cc').value : '';
      const telefono = ccVal && telVal ? `${ccVal} ${telVal}` : telVal;
      const email = document.getElementById('inp-cli-email').value.trim();
      const direccion = document.getElementById('inp-cli-direccion').value.trim();
      const empresa = document.getElementById('inp-cli-empresa').value.trim();
      const estado = document.getElementById('inp-cli-estado').value;

      // New fields - multi-department checkboxes
      const deptChecks = document.querySelectorAll('input[name="chk-cli-dept"]:checked');
      const departamentos_activos = Array.from(deptChecks).map(cb => cb.value);
      const departamento = departamentos_activos[0] || '';
      const fecha_inicio = document.getElementById('inp-cli-fecha-inicio') ? document.getElementById('inp-cli-fecha-inicio').value : '';
      const notas = document.getElementById('inp-cli-notas') ? document.getElementById('inp-cli-notas').value.trim() : '';
      const macro_estado = document.getElementById('inp-cli-macro-estado') ? document.getElementById('inp-cli-macro-estado').value : 'Prospecto';

      // ââ‚¬ââ‚¬ VALIDATION ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
      if (!firstNom || !apellido) { alert('El Nombre y Apellido son obligatorios'); return; }
      if (!email) { alert('El Email es obligatorio'); return; }
      if (!direccion) { alert('La Dirección es obligatoria'); return; }
      if (!telVal) { alert('El Teléfono es obligatorio'); return; }
      // ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬

      // ââ‚¬ââ‚¬ DISABLE BUTTON WHILE SAVING ââ‚¬ââ‚¬
      const originalBtnHtml = UI.btnSaveCli.innerHTML;
      UI.btnSaveCli.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
      UI.btnSaveCli.disabled = true;
      UI.btnSaveCli.classList.add('opacity-50', 'cursor-not-allowed');

      try {
        const fullNombre = `${firstNom} ${apellido}`.trim();

        // ââ‚¬ââ‚¬ UPLOAD DOCUMENTS TO SUPABASE STORAGE ââ‚¬ââ‚¬
        const uploadIfPresent = async (inputId, folder) => {
          const inp = document.getElementById(inputId);
          if (inp && inp.files && inp.files.length > 0) {
            showToast(`Subiendo ${inp.files[0].name}...`, 'info');
            return await uploadFile(inp.files[0], folder);
          }
          return null;
        };

        const [adjIdUrl, adjBillUrl, adjSeguroUrl, ofiAppUrl, ofiReciboUrl] = await Promise.all([
          uploadIfPresent('inp-cli-adjunto-id', 'clientes-documentos'),
          uploadIfPresent('inp-cli-adjunto-bill', 'clientes-documentos'),
          uploadIfPresent('inp-cli-adjunto-seguro', 'clientes-documentos'),
          uploadIfPresent('inp-cli-ofi-aplicacion', 'clientes-documentos'),
          uploadIfPresent('inp-cli-ofi-recibo', 'clientes-documentos'),
        ]);

        // Build adjuntos_oficina JSONB
        const adjuntosOficina = [];
        if (ofiAppUrl) adjuntosOficina.push({ tipo: 'hoja_aplicacion', url: ofiAppUrl, fecha: new Date().toISOString() });
        if (ofiReciboUrl) adjuntosOficina.push({ tipo: 'recibo_pago', url: ofiReciboUrl, fecha: new Date().toISOString() });

        const db = getDB();
        const newId = genId('cli', db);
        db.Clientes_Maestro.push({
          id: newId, 
          nombre: fullNombre, 
          email: email, 
          telefono: telefono,
          direccion: direccion, 
          zip: "Pendiente",
          state_id, dob, empresa, 
          estado: estado === 'Not selected' ? 'Lead' : estado,
          foto: state.currentCliFoto,
          // ââ‚¬ââ‚¬ MULTI-DEPT & LIFECYCLE ââ‚¬ââ‚¬
          departamento: departamento || null,
          departamentos_activos: departamentos_activos.length > 0 ? departamentos_activos : [],
          macro_estado: macro_estado,
          fecha_inicio: fecha_inicio || null,
          fecha_creacion: new Date().toISOString(),
          notas: notas || null,
          adjunto_id_url: adjIdUrl || null,
          adjunto_bill_url: adjBillUrl || null,
          adjunto_seguro_url: adjSeguroUrl || null,
          adjuntos_oficina: adjuntosOficina.length > 0 ? adjuntosOficina : null,
        });
        await saveDB(db);
        
        window.closeModals();
        await renderView();
        showToast(`Cliente ${fullNombre} registrado exitosamente`, 'success');
      } catch (err) {
        console.error('Error saving client:', err);
        showToast('Error al guardar: ' + err.message, 'error');
      } finally {
        UI.btnSaveCli.innerHTML = originalBtnHtml;
        UI.btnSaveCli.disabled = false;
        UI.btnSaveCli.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
  }


  // Save Fase Event
  if (UI.btnSaveFas) {
    UI.btnSaveFas.addEventListener('click', async () => {
      const nom = UI.inpFasNom.value.trim();
      if (!nom) return alert('Define un nombre para la fase');
      
      const originalText = UI.btnSaveFas.innerHTML;
      UI.btnSaveFas.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
      UI.btnSaveFas.disabled = true;
      UI.btnSaveFas.classList.add('opacity-50', 'cursor-not-allowed');

      try {
        const pFasesCount = state.fases.filter(f => f.pipeline_id === state.activePipId).length;
        await createAdminFase(state.activePipId, nom, pFasesCount + 1);
        window.closeModals();
        await loadData();
        renderConstructor();
      } finally {
        UI.btnSaveFas.innerHTML = originalText;
        UI.btnSaveFas.disabled = false;
        UI.btnSaveFas.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
  }

  if (UI.inpPipCol) {
    UI.inpPipCol.addEventListener('input', e => UI.inpPipHex.value = e.target.value);
  }
  const editPipCol = document.getElementById('edit-pip-color');
  const editPipHex = document.getElementById('edit-pip-hex');
  if (editPipCol && editPipHex) {
    editPipCol.addEventListener('input', e => editPipHex.value = e.target.value);
  }

  if (UI.btnSavePip) {
    UI.btnSavePip.addEventListener('click', async () => {
      if(!UI.inpPipNom.value.trim() || UI.btnSavePip.disabled) return;
      
      const originalText = UI.btnSavePip.innerHTML;
      UI.btnSavePip.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creando...';
      UI.btnSavePip.disabled = true;
      UI.btnSavePip.classList.add('opacity-50', 'cursor-not-allowed');

      try {
          // Read selected roles
          const rolesConAcceso = Array.from(
            document.querySelectorAll('.pip-role-chk:checked')
          ).map(chk => chk.dataset.rol);

          const newPip = await createAdminPipeline(
            UI.inpPipNom.value.trim(),
            UI.inpPipCol.value,
            rolesConAcceso
          );
          await createAdminFase(newPip.id, 'Fase 1: Recolección', 1);
          window.closeModals();
          await loadData();
          state.activePipId = newPip.id;
          await renderView();
      } catch (err) {
          console.error("Error creating pipeline", err);
      } finally {
          UI.btnSavePip.innerHTML = originalText;
          UI.btnSavePip.disabled = false;
          UI.btnSavePip.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
  }

  // ââ‚¬ââ‚¬ Edit Pipeline Roles (pencil icon) ââ‚¬ââ‚¬
  const modEditPipRoles = document.getElementById('modal-edit-pip-roles');
  const ROLES_LIST = ['Administración', 'Oficina', 'Técnicos', 'Representante de Ventas', 'Project Manager'];
  const ROLE_ICONS_MAP = {
    'Procesador': 'fa-headset',
    'Vendedor': 'fa-handshake', 'Técnico': 'fa-screwdriver-wrench',
    'Admin': 'fa-shield-halved'
  };

  // Event delegation on canvas for pencil icon
  UI.canvas.addEventListener('click', (e) => {
    const pencil = e.target.closest('.btn-edit-pip-roles');
    if (!pencil) return;
    e.stopPropagation();

    const pipId = pencil.dataset.pipid;
    const pipNom = pencil.dataset.pipnom;
    const dbLocal = getDB();
    const pip = (dbLocal.Admin_Pipelines || []).find(p => p.id === pipId);
    const currentRoles = pip?.rolesConAcceso || ROLES_LIST;

    document.getElementById('edit-pip-roles-id').value = pipId;
    document.getElementById('edit-pip-roles-nombre').textContent = pipNom;
    
    // Set color values
    const colInput = document.getElementById('edit-pip-color');
    const hexInput = document.getElementById('edit-pip-hex');
    const currentPipColor = pip?.color || '-';
    if (colInput) colInput.value = currentPipColor;
    if (hexInput) hexInput.value = currentPipColor;

    const permsBox = document.getElementById('edit-pip-roles-perms');
    const ROLE_NAMES_MAP = { 'Admin': 'Administración', 'Procesador': 'Oficina', 'Técnico': 'Técnicos', 'Vendedor': 'Representante de Ventas' };
    permsBox.innerHTML = ROLES_LIST.map(rol => `
      <label class="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 dark:border-white/5 cursor-pointer hover:border-sky-400/40 transition-all" style="background:rgba(14,165,233,0.03)">
        <input type="checkbox" class="edit-pip-role-chk w-4 h-4 rounded accent-sky-500" data-rol="${rol}" ${currentRoles.includes(rol) ? 'checked' : ''}>
        <i class="fa-solid ${ROLE_ICONS_MAP[rol] || 'fa-user'} text-sky-400 text-[11px]"></i>
        <span class="text-xs font-bold text-gray-700 dark:text-gray-200">${ROLE_NAMES_MAP[rol] || rol}</span>
      </label>
    `).join('');

    window.showModal(modEditPipRoles);
  });

  // Save pipeline role permissions
  const btnSavePipRoles = document.getElementById('btn-save-pip-roles');
  if (btnSavePipRoles) {
    btnSavePipRoles.addEventListener('click', async () => {
      const pipId = document.getElementById('edit-pip-roles-id').value;
      const selectedRoles = Array.from(
        document.querySelectorAll('.edit-pip-role-chk:checked')
      ).map(chk => chk.dataset.rol);

      const dbLocal = getDB();
      const pip = (dbLocal.Admin_Pipelines || []).find(p => p.id === pipId);
      if (pip) {
        pip.rolesConAcceso = selectedRoles;
        
        // Save color
        const newCol = document.getElementById('edit-pip-color').value;
        pip.color = newCol;

        await saveDB(dbLocal);
        await loadData();
        showToast(`Pipeline "${pip.nombre}" actualizado correctamente.`, 'success');
        window.closeModals();
        await renderView();
      }
    });
  }

  // Register modal in closeModals
  if (modEditPipRoles) {
    modEditPipRoles.querySelectorAll('.btn-cancel').forEach(btn =>
      btn.addEventListener('click', closeModals)
    );
  }

  if (UI.inpCamTipo) {
    UI.inpCamTipo.addEventListener('change', e => {
      if(e.target.value === 'Desplegable') {
        UI.wrpCamOpc.classList.remove('hidden');
      } else {
        UI.wrpCamOpc.classList.add('hidden');
        UI.inpCamOpc.value = '';
      }
    });
  }

  if (UI.btnSaveCam) {
    UI.btnSaveCam.addEventListener('click', async () => {
      const fn = UI.inpCamFaseId.value;
      const etq = UI.inpCamEtq.value.trim();
      const tipo = UI.inpCamTipo.value;
      const opc = UI.inpCamOpc.value.trim();
      const chkOpcional = document.getElementById('inp-cam-opcional');
      const es_opcional = chkOpcional ? chkOpcional.checked : false;

      if(!etq) return alert("Define la etiqueta");
      if(tipo === 'Desplegable' && !opc) return alert("Define las opciones separadas por coma");
      
      const editId = UI.modCam?.dataset?.editCampoId;
      const originalText = UI.btnSaveCam.innerHTML;
      UI.btnSaveCam.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
      UI.btnSaveCam.disabled = true;
      UI.btnSaveCam.classList.add('opacity-50', 'cursor-not-allowed');

      try {
        if (editId) {
          // UPDATE existing campo
          await updateAdminCampo(editId, etq, tipo, opc, es_opcional);
          delete UI.modCam.dataset.editCampoId;
        } else {
          // CREATE new campo
          await createAdminCampo(fn, etq, tipo, opc, es_opcional);
        }
        window.closeModals();
        if (chkOpcional) chkOpcional.checked = false; // reset
        await loadData();
        await renderView();
      } finally {
        UI.btnSaveCam.innerHTML = originalText;
        UI.btnSaveCam.disabled = false;
        UI.btnSaveCam.classList.remove('opacity-50', 'cursor-not-allowed');
        // Reset button text when modal closes
        if (UI.btnSaveCam) UI.btnSaveCam.textContent = 'Agregar a la UI';
      }
    });
  }

  // ââ‚¬ââ‚¬ Unified Delegation for Generic View Actions ââ‚¬ââ‚¬
  document.body.addEventListener('click', async (e) => {
    // ââ‚¬ââ‚¬ GENERAL ACTIONS (Only if inside canvas and not a delete) ââ‚¬ââ‚¬
    const target = e.target;
    
    // 0. Global Modal Actions (Cancel / Success Close)
    if (target.closest('.btn-close-success') || target.closest('.btn-cancel')) {
      window.closeModals();
      return;
    }

    if (target.closest('.btn-delete-pipeline') || target.closest('.btn-delete-fase') || target.closest('.btn-delete-campo')) return;
    
    // Delegation for CRM / Team Links and Delete Buttons
    const cliLink = target.closest('.client-name-link');
    if (cliLink) {
        e.preventDefault();
        showClientDetail(cliLink.dataset.id);
        return;
    }

    const usrLink = target.closest('.worker-name-link');
    if (usrLink) {
        e.preventDefault();
        showWorkerDetail(usrLink.dataset.id);
        return;
    }

    const delCli = target.closest('.btn-delete-client');
    if (delCli) {
        window.adminDeleteClient(delCli.dataset.id, e);
        return;
    }

    const delUsr = target.closest('.btn-delete-worker');
    if (delUsr) {
        window.adminDeleteWorker(delUsr.dataset.id, e);
        return;
    }

    const toggleStatus = target.closest('.toggle-worker-status');
    if (toggleStatus) {
        window.adminToggleWorkerStatus(toggleStatus.dataset.id, toggleStatus.checked, e);
        return;
    }

    const bulkDelCli = target.closest('#btn-bulk-delete-cli');
    if (bulkDelCli) {
        window.adminBulkDeleteClients();
        return;
    }

    const bulkDelUsr = target.closest('#btn-bulk-delete-workers');
    if (bulkDelUsr) {
        window.adminBulkDeleteWorkers();
        return;
    }

    const delProy = target.closest('.btn-delete-kanban-project');
    if (delProy) {
        window.adminDeleteProject(delProy.dataset.id, e);
        return;
    }

    const delPartner = target.closest('.btn-delete-partner');
    if (delPartner) {
        window.adminDeletePartner(delPartner.dataset.id, e);
        return;
    }

    const bulkDelPartner = target.closest('#btn-bulk-delete-partners');
    if (bulkDelPartner) {
        window.adminBulkDeletePartners();
        return;
    }

    if (!UI.canvas.contains(target)) return;

    // 1. Pipeline Tab Switch
    const tab = e.target.closest('.pip-tab');
    if (tab) {
      state.activePipId = tab.dataset.id;
      await renderView();
      return;
    }

    // 2. Add Field
    const btnCampo = e.target.closest('.btn-add-campo');
    if (btnCampo) {
      const activePipDetails = state.pipelines.find(p => p.id === state.activePipId);
      UI.inpCamFaseId.value = btnCampo.dataset.faseid;
      UI.lblFaseDest.textContent = btnCampo.dataset.fasenom;
      UI.lblFaseDest.style.color = activePipDetails ? activePipDetails.color : '#fff';
      UI.inpCamEtq.value = ''; UI.inpCamOpc.value = '';
      UI.wrpCamOpc.classList.add('hidden');
      UI.inpCamTipo.value = 'Texto';
      window.showModal(UI.modCam);
      return;
    }

    // 3. Add Fase
    const btnFaseAction = e.target.closest('#btn-add-fase');
    if (btnFaseAction) {
      UI.inpFasNom.value = '';
      window.showModal(UI.modFas);
      return;
    }

    // ââ‚¬ââ‚¬ Marketing / WA ââ‚¬ââ‚¬
    const btnAddPaso = e.target.closest('#btn-add-paso');
    if (btnAddPaso) {
      const container = document.getElementById('mk-secuencia-container');
      if (container) {
        const nextIdx = container.querySelectorAll('.mk-card').length + 1;
        container.insertAdjacentHTML('beforeend', crearPasoMarketingHTML(nextIdx));
      }
      return;
    }

    const btnDelPaso = e.target.closest('.btn-eliminar-paso');
    if (btnDelPaso) {
      e.target.closest('.mk-card').remove();
      document.querySelectorAll('.mk-card').forEach((card, i) => {
         const idxBadge = card.querySelector('.mk-step-idx');
         if(idxBadge) idxBadge.textContent = i + 1;
      });
      return;
    }

    const btnSend = e.target.closest('#btn-enviar-campana');
    if (btnSend) {
      const cards = document.querySelectorAll('.mk-card');
      const secuencia = [];
      cards.forEach(card => {
        secuencia.push({
          asunto: card.querySelector('.mk-asunto').value,
          programacion: card.querySelector('.mk-fecha-envio').value,
          cuerpo: card.querySelector('.mk-cuerpo').value
        });
      });
      
      const audiencia = document.getElementById('mk-audiencia').value;
      let dests = [];
      const dbLocal = getDB();

      if (audiencia === 'clientes_especificos' || audiencia === 'trabajadores_especificos') {
        document.querySelectorAll('.chk-audiencia:checked').forEach(chk => {
          const nameSpan = chk.closest('label').querySelector('.text-xs');
          dests.push({
            email: chk.value,
            telefono: (chk.dataset.telefono || '').replace(/\D/g, ''),
            nombre: nameSpan ? nameSpan.textContent.trim() : 'Destinatario'
          });
        });
      } else if (audiencia === 'todos_trabajadores') {
        const workers = await getAdminWorkers();
        dests = workers.map(w => ({ email: w.email || '', telefono: (w.telefono || '').replace(/\D/g, ''), nombre: `${w.nombre} ${w.apellido || ''}`.trim() }));
      } else {
        let clientes = dbLocal.Clientes_Maestro || [];
        if (audiencia === 'Solar') {
           const solarPip = (dbLocal.Admin_Pipelines||[]).find(p => p.nombre.toLowerCase().includes('solar'));
           const solarProys = (dbLocal.Proyectos_Dinamicos||[]).filter(p => solarPip && p.pipeline_id === solarPip.id);
           const solarClientIds = new Set(solarProys.map(p => p.cliente_id));
           clientes = clientes.filter(c => solarClientIds.has(c.id));
        } else if (audiencia === 'Water') {
           const waterPip = (dbLocal.Admin_Pipelines||[]).find(p => p.nombre.toLowerCase().includes('water'));
           const waterProys = (dbLocal.Proyectos_Dinamicos||[]).filter(p => waterPip && p.pipeline_id === waterPip.id);
           const waterClientIds = new Set(waterProys.map(p => p.cliente_id));
           clientes = clientes.filter(c => waterClientIds.has(c.id));
        }
        dests = clientes.map(c => ({ email: c.email || '', telefono: (c.telefono || '').replace(/\D/g, ''), nombre: c.nombre || 'Destinatario' }));
      }

      const payload = {
        audiencia: audiencia,
        secuencia: secuencia,
        destinatarios: dests,
        timestamp: new Date().toISOString()
      };

      console.log('--- Email Engine Payload ---', payload);
      
      // Visual feedback
      const originalHtml = btnSend.innerHTML;
      btnSend.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Activating...';
      btnSend.disabled = true;

      fetch('https://n8n.renewgroup.site/webhook/email-renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        btnSend.innerHTML = '<i class="fa-solid fa-check"></i> Activated!';
        btnSend.classList.remove('bg-tealAccent');
        btnSend.classList.add('bg-green-500');
        showSuccessModal('¡Ya está activado! Los protocolos de Email Engine se han sincronizado con éxito.');
      })
      .catch(err => {
        console.error('Email Engine Error:', err);
        btnSend.innerHTML = originalHtml;
        btnSend.disabled = false;
        showToast('Error al conectar con el servidor de Email: ' + err.message, 'error');
      });
      return;
    }


    const btnAddWaPaso = e.target.closest('#btn-add-wa-paso');
    if (btnAddWaPaso) {
      const container = document.getElementById('wa-secuencia-container');
      if (container) {
        const nextIdx = container.querySelectorAll('.wa-card').length + 1;
        container.insertAdjacentHTML('beforeend', crearPasoWhatsAppHTML(nextIdx));
      }
      return;
    }

    const btnDelWaPaso = e.target.closest('.btn-eliminar-wa-paso');
    if (btnDelWaPaso) {
      e.target.closest('.wa-card').remove();
      document.querySelectorAll('.wa-card').forEach((card, i) => {
         const idxBadge = card.querySelector('.wa-step-idx');
         if(idxBadge) idxBadge.textContent = i + 1;
      });
      return;
    }

    const btnWaSend = e.target.closest('#btn-enviar-wa-campana');
    if (btnWaSend) {
      const audiencia = document.getElementById('wa-audiencia').value;
      let dests = [];
      const dbLocal = getDB();

      if (audiencia === 'clientes_especificos' || audiencia === 'trabajadores_especificos') {
        document.querySelectorAll('.wa-chk-audiencia:checked').forEach(chk => {
          const nameSpan = chk.closest('label').querySelector('.text-xs');
          dests.push({
            email: chk.value,
            telefono: (chk.dataset.telefono || '').replace(/\D/g, ''),
            nombre: nameSpan ? nameSpan.textContent.trim() : 'Destinatario'
          });
        });
      } else if (audiencia === 'todos_trabajadores') {
        const workers = await getAdminWorkers();
        dests = workers.map(w => ({ email: w.email || '', telefono: (w.telefono || '').replace(/\D/g, ''), nombre: `${w.nombre} ${w.apellido || ''}`.trim() }));
      } else {
        let clientes = dbLocal.Clientes_Maestro || [];
        if (audiencia === 'Solar') {
           const solarPip = (dbLocal.Admin_Pipelines||[]).find(p => p.nombre.toLowerCase().includes('solar'));
           const solarProys = (dbLocal.Proyectos_Dinamicos||[]).filter(p => solarPip && p.pipeline_id === solarPip.id);
           const solarClientIds = new Set(solarProys.map(p => p.cliente_id));
           clientes = clientes.filter(c => solarClientIds.has(c.id));
        } else if (audiencia === 'Water') {
           const waterPip = (dbLocal.Admin_Pipelines||[]).find(p => p.nombre.toLowerCase().includes('water'));
           const waterProys = (dbLocal.Proyectos_Dinamicos||[]).filter(p => waterPip && p.pipeline_id === waterPip.id);
           const waterClientIds = new Set(waterProys.map(p => p.cliente_id));
           clientes = clientes.filter(c => waterClientIds.has(c.id));
        }
        dests = clientes.map(c => ({ email: c.email || '', telefono: (c.telefono || '').replace(/\D/g, ''), nombre: c.nombre || 'Destinatario' }));
      }

      const cards = document.querySelectorAll('.wa-card');
      const secuencia = [];
      cards.forEach(card => {
        secuencia.push({
          programacion: card.querySelector('.wa-fecha-envio').value,
          cuerpo: card.querySelector('.wa-cuerpo').value
        });
      });

      const payload = {
        audiencia: audiencia,
        secuencia: secuencia,
        destinatarios: dests,
        timestamp: new Date().toISOString()
      };

      console.log('--- WhatsApp Engine Payload ---', payload);
      
      const originalHtml = btnWaSend.innerHTML;
      btnWaSend.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Transmitiendo...';
      btnWaSend.disabled = true;

      fetch('https://n8n.renewgroup.site/webhook/whatsapp-renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        btnWaSend.innerHTML = '<i class="fa-solid fa-check"></i> Activated!';
        btnWaSend.classList.remove('bg-tealAccent');
        btnWaSend.classList.add('bg-green-500');
        showSuccessModal('¡Protocolo WhatsApp Activado! Las señales se están transmitiendo a la red.');
      })
      .catch(err => {
        console.error('WhatsApp Engine Error:', err);
        btnWaSend.innerHTML = originalHtml;
        btnWaSend.disabled = false;
        showToast('Error al conectar con el servidor de WhatsApp: ' + err.message, 'error');
      });
      return;
    }

    const chkAll = e.target.closest('.chk-select-all');
    if (chkAll) {
      const isWA = chkAll.id === 'wa-all';
      const siblings = document.querySelectorAll(isWA ? '.wa-chk-audiencia' : '.chk-audiencia');
      siblings.forEach(s => s.checked = chkAll.checked);
      return;
    }
  });

  // ââ‚¬ââ‚¬ Audience Search Filtering ââ‚¬ââ‚¬
  UI.canvas.addEventListener('input', (e) => {
    if (e.target.classList.contains('chk-search-input')) {
      const q = e.target.value.toLowerCase();
      const parent = e.target.closest('#mk-seleccion-especifica') || e.target.closest('#wa-seleccion-especifica');
      if (!parent) return;
      
      const cards = parent.querySelectorAll('.recipient-grid label');
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (text.includes(q)) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    }
  });

  UI.canvas.addEventListener('change', async (e) => {
    if (e.target.id === 'mk-audiencia' || e.target.id === 'wa-audiencia') {
      const isWA = e.target.id === 'wa-audiencia';
      const val = e.target.value;
      const subContainer = document.getElementById(isWA ? 'wa-seleccion-especifica' : 'mk-seleccion-especifica');
      if (!subContainer) return;
      
      if (val === 'clientes_especificos' || val === 'trabajadores_especificos') {
        const db = getDB();
        let items = [];
        
        if (val === 'clientes_especificos') {
          items = db.Clientes_Maestro || [];
        } else {
          items = await getAdminWorkers();
        }

        const chkClass = isWA ? 'wa-chk-audiencia' : 'chk-audiencia';
        const accentColor = isWA ? 'text-green-500' : 'text-tealAccent';
        const ringColor = isWA ? 'focus:ring-green-500' : 'focus:ring-tealAccent';
        const toggleAllId = isWA ? 'wa-all' : 'mk-all';
        
        subContainer.innerHTML = `
          <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 border-b border-gray-100 dark:border-gray-700 pb-4">
            <div class="flex items-center gap-3 flex-1 w-full">
              <div class="relative flex-1">
                <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                <input type="text" placeholder="Buscar por nombre o email..." class="chk-search-input w-full bg-gray-100 dark:bg-gray-900/50 border border-transparent focus:border-tealAccent rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none transition-all">
              </div>
            </div>
            <div class="flex items-center gap-6">
               <label class="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
                 <span class="text-[10px] uppercase font-black text-gray-400 group-hover:text-tealAccent transition-colors">Seleccionar Todos</span>
                 <input type="checkbox" id="${toggleAllId}" class="chk-select-all w-4 h-4 rounded ${accentColor} ${ringColor}">
               </label>
            </div>
          </div>
          <div class="recipient-grid grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            ${items.map(item => `
              <label class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-tealAccent transition-all group">
                <input type="checkbox" value="${item.email}" data-telefono="${item.telefono || ''}" class="${chkClass} w-4 h-4 rounded ${accentColor} ${ringColor}">
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-gray-800 dark:text-white">${item.nombre} ${item.apellido || ''}</span>
                  <span class="text-[10px] text-gray-400 font-medium">${isWA ? (item.telefono || 'Sin teléfono') : (item.email || 'Sin email')}</span>
                </div>
              </label>
            `).join('')}
          </div>
        `;
        subContainer.classList.remove('hidden');
      } else {
        subContainer.classList.add('hidden');
        subContainer.innerHTML = '';
      }
      return;
    }

    if (e.target.classList.contains('sel-fase-rol')) {
      const faseId = e.target.dataset.faseid;
      const nuevoRol = e.target.value;
      await updateAdminFaseRole(faseId, nuevoRol);
      const stFaseObj = state.fases.find(f => f.id === faseId);
      if (stFaseObj) stFaseObj.rol_encargado = nuevoRol;
      renderConstructor(); // Sincronizar UI para mostrar/ocultar botón de asignación
    }
  });
}

window.showSuccessModal = (msg) => {
  if (UI.msgSuccess) UI.msgSuccess.textContent = msg;
  window.showModal(UI.modSuccess);
};

// ââ‚¬ââ‚¬ W-9 Viewer: opens base64 data URLs as Blob to avoid Chrome blank page ââ‚¬ââ‚¬
window.openW9File = function(dataUrl) {
  if (!dataUrl) return;
  try {
    // Split "data:<mime>;base64,<data>"
    const [header, b64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];  // e.g. "application/pdf" or "image/jpeg"
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    // Revoke after 60 s to free memory
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    if (!win) alert('Permite ventanas emergentes para ver el W-9.');
  } catch(e) {
    console.error('[W-9 Viewer] Error:', e);
    // Fallback: try opening directly
    window.open(dataUrl, '_blank');
  }
};

window.showInvHistoryDetails = (clientName) => {
    const modal = document.getElementById('modal-inv-history-details');
    const title = document.getElementById('inv-hist-modal-title');
    const content = document.getElementById('inv-hist-modal-content');
    if (!modal || !content) return;

    const items = (window._inv_grouped_data || {})[clientName] || [];
    title.textContent = clientName;

    if (items.length === 0) {
        content.innerHTML = '<p class="text-center text-gray-500 py-8 italic">No hay detalles disponibles.</p>';
    } else {
        // Sort by date descending
        const sorted = [...items].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
        
        // Sum quantities of same items if they appear multiple times for the same client (optional but good)
        const summary = {};
        sorted.forEach(it => {
            if (!summary[it.nombre]) summary[it.nombre] = { qty: 0, lastDate: it.fecha };
            summary[it.nombre].qty += (Number(it.cantidad) || 0);
        });

        content.innerHTML = `
            <div class="bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                <table class="w-full text-[11px]">
                    <thead class="bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                        <tr>
                            <th class="px-4 py-3 text-left font-black text-gray-400 uppercase tracking-widest">Artículo</th>
                            <th class="px-4 py-3 text-right font-black text-gray-400 uppercase tracking-widest">Cant. Total</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                        ${Object.entries(summary).map(([name, data]) => `
                            <tr>
                                <td class="px-4 py-3 text-gray-900 dark:text-white font-bold">${name}</td>
                                <td class="px-4 py-3 text-right">
                                    <span class="inline-flex items-center gap-1.5 bg-red-500/10 text-red-500 rounded-full px-3 py-1 font-black">
                                        -${data.qty}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="mt-6 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                <p class="text-[10px] text-blue-500 font-black uppercase tracking-widest flex items-center gap-2">
                    <i class="fa-solid fa-circle-info"></i> Información de Registro
                </p>
                <p class="text-[10px] text-gray-500 mt-2">Este reporte consolida todos los materiales retirados del inventario vinculados a este proyecto/cliente específico.</p>
            </div>
        `;
    }

    if (window.showModal) window.showModal(modal);
    else {
        modal.classList.remove('nuclear-hidden');
        modal.classList.add('flex');
    }
};

window.showModal = (m) => {
  if (!m) {
    console.error("[RENEW-ERROR] showModal received null element!");
    return;
  }
  
  console.log("[RENEW-DEBUG] Showing modal:", m.id);

  // Trigger rank visibility check if worker modal
  if (m.id === 'modal-nuclear-usr') {
      setTimeout(() => {
          if (typeof window.updateWorkerRankVisibility === 'function') {
              window.updateWorkerRankVisibility();
          }
      }, 100);
  }

  // 1. Reparent to body to ensure it's top-level and not clipped by siblings
  if (m.parentElement !== document.body) {
      console.log("[RENEW-DEBUG] Reparenting modal to body");
      document.body.appendChild(m);
  }

  // 2. Clear potentially stuck animations from internal content
  const content = m.querySelector('div');
  if (content) {
      content.classList.remove('animate-scaleIn', 'animate-fadeIn', 'animate-slideUp');
  }

  // 3. Forced reset of classes
  m.classList.remove('hidden', 'modal-hidden', 'nuclear-hidden');
  m.classList.add('nuclear-visible', 'flex');

  // RESTORED: Custom reset for Inventory Modal if opening for NEW item
  if (m.id === 'modal-nuclear-inv') {
      const btnSave = document.getElementById('btn-save-inv');
      if (btnSave && !btnSave.dataset.editId) {
          m.querySelector('h3').textContent = 'Añadir Artículo al Inventario';
          btnSave.innerHTML = 'Guardar Artículo';
          // Clear inputs
          if(document.getElementById('inp-inv-codigo')) document.getElementById('inp-inv-codigo').value = '';
          if(document.getElementById('inp-inv-linea')) document.getElementById('inp-inv-linea').value = '';
          if(document.getElementById('inp-inv-nombre')) document.getElementById('inp-inv-nombre').value = '';
          if(document.getElementById('inp-inv-stock')) document.getElementById('inp-inv-stock').value = '';
      }
  }

  // 4. Maximum priority styles
  m.style.setProperty('display', 'flex', 'important');
  m.style.setProperty('visibility', 'visible', 'important');
  m.style.setProperty('opacity', '1', 'important');
  m.style.setProperty('pointer-events', 'auto', 'important');
  m.style.setProperty('z-index', '2147483647', 'important'); // Max possible 32-bit int z-index
  
  // 5. Diagnostic check after 50ms to allow DOM reflow
  setTimeout(() => {
      const rect = m.getBoundingClientRect();
      console.log(`[RENEW-DIAGNOSTIC] Modal ${m.id} dimensions:`, rect.width, 'x', rect.height);
      console.log(`[RENEW-DIAGNOSTIC] Is visible in computed style?`, window.getComputedStyle(m).display);
      if (rect.width === 0 || rect.height === 0) {
          console.warn("[RENEW-WARNING] Modal has 0 dimensions! Forcing layout...");
          m.style.width = '100vw';
          m.style.height = '100vh';
          m.style.top = '0';
          m.style.left = '0';
          m.style.position = 'fixed';
      }
  }, 50);
}

window.closeModals = () => {
  // Reset detail modal to view mode before closing
  exitDetailEditMode();

  document.querySelectorAll('.fixed.inset-0:not(.hidden)').forEach(m => {
    m.classList.add('nuclear-hidden');
    m.classList.remove('flex', 'nuclear-visible');
    m.style.cssText = "display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;";
    
    // Reset Inventory Edit Data if present
    const btnSaveInv = document.getElementById('btn-save-inv');
    if(btnSaveInv) delete btnSaveInv.dataset.editId;
    const btnSavePre = document.getElementById('btn-save-precio');
    if(btnSavePre) delete btnSavePre.dataset.editId;
  });
  
  // Clean photo states
  state.currentCliFoto = null;
  state.currentUsrFoto = null;
  if(UI.previewCliFoto) UI.previewCliFoto.classList.add('hidden');
  if(UI.placeholderCliFoto) UI.placeholderCliFoto.classList.remove('hidden');
  if(UI.previewUsrFoto) UI.previewUsrFoto.classList.add('hidden');
  if(UI.placeholderUsrFoto) UI.placeholderUsrFoto.classList.remove('hidden');
}

window.showNotifications = () => {
  import('./components/admin-notif-bell.js').then(({ openAdminBellPanel }) => openAdminBellPanel());
};

window.closeNotifications = () => {
  const panel = document.getElementById('admin-bell-panel');
  if (panel) panel.innerHTML = '';
  const oldPanel = document.getElementById('notifications-panel');
  if (oldPanel) {
      oldPanel.classList.add('translate-x-full');
  }
};

async function loadData() {
  state.pipelines = await getAdminPipelines();
  state.fases = await getAdminFases();
  state.campos = await getAdminCampos();
  state.workers = await getAdminWorkers();
  if(!state.activePipId && state.pipelines.length > 0) {
    state.activePipId = state.pipelines[0].id;
  }
}
window.loadData = loadData;

function setGlobalButton(show, html, className = "btn-premium flex items-center gap-3 px-6 py-3 shadow-lg") {
  const btn = document.getElementById('btn-global-action');
  if (!btn) return;
  if (!show) {
    btn.classList.add('hidden');
    btn.style.setProperty('display', 'none', 'important');
  } else {
    btn.innerHTML = html;
    btn.className = className;
    btn.classList.remove('hidden');
    btn.style.setProperty('display', 'flex', 'important');
  }
}

window.showProblemModal = (proyId) => {
    const db = getDB();
    const proy = (db.Proyectos_Dinamicos || []).find(p => p.id === proyId);
    if (!proy) return;
    
    // Parse if it happens to be stringified
    let discusion = proy.discusion || [];
    if (typeof discusion === 'string') {
        try { discusion = JSON.parse(discusion); } catch(e) { discusion = []; }
    }
    
    const listHtml = discusion.length > 0 
        ? discusion.map(msg => `
            <div style="background:var(--surface-alt, #f9fafb); border:1px solid var(--border, #e5e7eb); padding:12px; border-radius:8px;">
                <div style="font-size:0.75rem; font-weight:bold; color:var(--text-muted, #6b7280); margin-bottom:4px;">${new Date(msg.date).toLocaleString()}</div>
                <div style="font-size:0.85rem; color:var(--text-primary, #111827);">${msg.text}</div>
            </div>
          `).join('')
        : `<div style="text-align:center; color:var(--text-muted, #6b7280); font-size:0.85rem; padding:20px;">No hay comentarios registrados.</div>`;
    
    const m = document.createElement('div');
    m.className = 'fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn';
    m.innerHTML = `
        <div class="bg-white dark:bg-[#1a1c23] w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-scaleIn">
            <div class="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-red-50 dark:bg-red-500/10">
                <h3 class="font-black text-red-600 dark:text-red-400 uppercase tracking-widest text-sm flex items-center gap-2">
                    <i class="fa-solid fa-triangle-exclamation"></i> Discusión Interna
                </h3>
                <button onclick="this.closest('.fixed').remove()" class="text-red-400 hover:text-red-600 transition-colors">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>
            <div class="p-6 max-h-[60vh] overflow-y-auto flex flex-col gap-3">
                ${listHtml}
            </div>
            <div class="px-6 py-4 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/10 flex justify-end">
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
};

window.renderView = async function renderView() {
  let db = getDB();
  if (!db) return; // Wait for initDB if called too early
  
  // Toggle Search Bar Visibility
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
      if (['crm', 'crm_maestro', 'usuarios', 'equipo', 'proveedores', 'hrhub', 'roles'].includes(state.activeView)) {
          searchInput.parentElement.style.display = 'block';
      } else {
          searchInput.parentElement.style.display = 'none';
          searchInput.value = ''; // clear when hidden
      }
  }

  // Sync statuses/departments before any render
  syncClientStatuses(db);
  // Re-read db after sync might have changed it
  db = getDB();

  // Hide arrows by default using opacity classes (avoids display + CSP conflicts)
  const sl = document.getElementById('ctrl-scroll-left');
  const sr = document.getElementById('ctrl-scroll-right');
  if(sl) { sl.classList.add('opacity-0', 'pointer-events-none'); sl.classList.remove('opacity-100', 'pointer-events-auto'); }
  if(sr) { sr.classList.add('opacity-0', 'pointer-events-none'); sr.classList.remove('opacity-100', 'pointer-events-auto'); }

  if (state.activeView === 'constructor') {
    if (UI.viewTitle) UI.viewTitle.textContent = "Workflow Constructor";
    if (UI.viewDesc) UI.viewDesc.textContent = "Engineer the phases and dynamic fields for the RENEW Ecosystem.";
    setGlobalButton(true, '<i class="fa-solid fa-plus"></i> New Pipeline');
    renderConstructor();
  } 
  else if (state.activeView === 'roles') {
    if (UI.viewTitle) UI.viewTitle.textContent = "Roles y Permisos";
    if (UI.viewDesc) UI.viewDesc.textContent = "Administra los roles personalizados y los accesos modulares al sistema.";
    setGlobalButton(true, '<i class="fa-solid fa-plus"></i> Crear Rol');
    if (typeof renderRolesBuilder === 'function') renderRolesBuilder();
  }
  else if (state.activeView === 'lista-precios') {
    UI.viewTitle.textContent = "Lista de Precios - Renew Water";
    UI.viewDesc.textContent = "Gestiona los productos, categorías y precios por rango para Renew Water.";
    setGlobalButton(true, `<i class="fa-solid fa-plus text-sm"></i> Nuevo Producto`);
    renderListaPreciosAdmin();
  }
  else if (state.activeView === 'crm' || state.activeView === 'crm_maestro') {
    if (UI.viewTitle) UI.viewTitle.textContent = t('crm_title');
    if (UI.viewDesc) UI.viewDesc.textContent = t('crm_desc');
    setGlobalButton(true, `<i class="fa-solid fa-user-plus"></i> ${t('crm_btn_add')}`);

    // ââ‚¬ââ‚¬ Build a responsable lookup: clienteId â ™ worker name ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
    const allWorkers = await getAdminWorkers(); // mock + dynamic merged
    const allProys = db.Proyectos_Dinamicos || [];

    // For each client, find their MOST RECENT project and get responsable_id
    const repByClientId = {};
    allProys.forEach(p => {
      if (!p.cliente_id || !p.responsable_id) return;
      const existing = repByClientId[p.cliente_id];
      // Keep the project with the latest fecha (string comparison works for ISO dates)
      if (!existing || (p.fecha || '') >= (existing.fecha || '')) {
        repByClientId[p.cliente_id] = { responsable_id: p.responsable_id, fecha: p.fecha };
      }
    });

    function getRepName(c) {
      if (c.vendedor_asignado_id) {
          const worker = allWorkers.find(w => w.id === c.vendedor_asignado_id);
          if (worker) return [worker.nombre, worker.apellido].filter(Boolean).join(' ');
      }
      const entry = repByClientId[c.id];
      if (!entry) return null;
      const worker = allWorkers.find(w => w.id === entry.responsable_id);
      if (!worker) return null;
      return [worker.nombre, worker.apellido].filter(Boolean).join(' ');
    }
    // ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
    
    let clientesFiltrados = db.Clientes_Maestro || [];
    
    // --- ROLE-BASED FILTERING ---
    const currentUser = JSON.parse(localStorage.getItem('rs_user') || '{}');
    const role = currentUser.rol || '';
    if (['Project Manager', 'Manager de Ventas', 'Account Manager', 'Supervisión'].includes(role)) {
        clientesFiltrados = clientesFiltrados.filter(c => {
            const hasAccessToUnit = currentUser.unidades && currentUser.unidades.length > 0
                ? currentUser.unidades.some(u => c.departamento && c.departamento.toLowerCase().includes(u.replace('Renew ', '').toLowerCase()))
                : true;

            if (role === 'Manager de Ventas') {
                return hasAccessToUnit;
            } else if (role === 'Account Manager') {
                const acctId = c.account_manager_id || '';
                return hasAccessToUnit && acctId === currentUser.id;
            } else if (role === 'Supervisión') {
                const vendorId = c.vendedor_asignado_id || c.creador_id || '';
                const vendorUser = allWorkers.find(w => w.id === vendorId);
                return vendorUser && vendorUser.supervisor_id === currentUser.id;
            } else if (role === 'Project Manager') {
                const subRol = currentUser.sub_rol || '';
                if (subRol === 'Manager de Ventas') return hasAccessToUnit;
                if (subRol === 'Account Manager') return hasAccessToUnit && c.account_manager_id === currentUser.id;
                if (subRol === 'Supervisor') {
                    const vendorId = c.vendedor_asignado_id || c.creador_id || '';
                    const vendorUser = allWorkers.find(w => w.id === vendorId);
                    return vendorUser && vendorUser.supervisor_id === currentUser.id;
                }
                return true; // Default PM fallback
            }
            return true;
        });
    }
    // ----------------------------
    if (window.globalSearchQuery) {
        clientesFiltrados = clientesFiltrados.filter(c => {
            const repData = repByClientId[c.id];
            const dateStr = repData ? (repData.fecha || '') : '';
            const repName = getRepName(c) || '';
            const deptsStr = Array.isArray(c.departamentos_activos) ? c.departamentos_activos.join(' ') : (c.departamento || '');
            const searchStr = window.normalizeSearchString(`${c.nombre || ''} ${c.telefono || ''} ${c.empresa || ''} ${deptsStr} ${c.estado || ''} ${c.state_id || ''} ${dateStr} ${repName}`);
            return searchStr.includes(window.globalSearchQuery);
        });
    }

    const rows = clientesFiltrados.map(c => {
      const repName = getRepName(c);
      const repHtml = repName
        ? `<div class="flex items-center gap-1.5">
             <div class="w-5 h-5 rounded-full bg-tealAccent/10 flex items-center justify-center shrink-0">
               <i class="fa-solid fa-user-tie text-tealAccent text-[7px]"></i>
             </div>
             <span class="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[100px]">${repName}</span>
           </div>`
        : `<span class="text-[9px] text-gray-300 dark:text-gray-700 italic">Sin asignar</span>`;

      // ORIGEN BADGE - 3 tipos: call_center | vendedor | referido
      let origenHtml = `<span class="text-[9px] text-gray-300 dark:text-gray-600 italic">-</span>`;
      if (c.origen_tipo === 'call_center') {
        origenHtml = `
          <div class="flex items-center gap-1.5">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <i class="fa-solid fa-headset text-[7px]"></i> CC
            </span>
            <span class="text-[9px] font-bold text-gray-600 dark:text-gray-400 truncate max-w-[80px]" title="${c.origen_nombre || ''}">${c.origen_nombre || ''}</span>
          </div>`;
      } else if (c.origen_tipo === 'vendedor') {
        origenHtml = `
          <div class="flex items-center gap-1.5">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <i class="fa-solid fa-handshake text-[7px]"></i> Vend.
            </span>
            <span class="text-[9px] font-bold text-gray-600 dark:text-gray-400 truncate max-w-[80px]" title="${c.origen_nombre || ''}">${c.origen_nombre || ''}</span>
          </div>`;
      } else if (c.origen_tipo === 'referido') {
        origenHtml = `
          <div class="flex items-center gap-1.5">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <i class="fa-solid fa-user-group text-[7px]"></i> Ref.
            </span>
            <span class="text-[9px] font-bold text-gray-600 dark:text-gray-400 truncate max-w-[80px]" title="${c.origen_nombre || ''}">${c.origen_nombre || ''}</span>
          </div>`;
      }

      return [
        `<input type="checkbox" class="cli-chk w-3.5 h-3.5 rounded border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-tealAccent focus:ring-tealAccent" data-id="${c.id}">`,
        c.foto ? `<img src="${c.foto}" class="w-7 h-7 rounded-lg object-cover border border-gray-200 dark:border-white/5" onerror="this.onerror=null; this.outerHTML='<div class=&quot;w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center&quot;><i class=&quot;fa-solid fa-user text-gray-400 dark:text-gray-700 text-[9px]&quot;></i></div>';">` : `<div class="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center"><i class="fa-solid fa-user text-gray-400 dark:text-gray-700 text-[9px]"></i></div>`,
        `<a href="#" class="client-name-link font-bold text-gray-900 dark:text-white hover:text-tealAccent transition-colors text-xs tracking-tight whitespace-nowrap min-w-[120px] inline-block" data-id="${c.id}">${c.nombre || 'Desconocido'}</a>`,
        `<span class="text-gray-500 dark:text-gray-400 font-medium tracking-tighter text-xs whitespace-nowrap">${c.telefono || '-'}</span>`,
        `<span class="text-gray-400 dark:text-gray-500 text-[10px] break-all min-w-[150px] inline-block">${c.email || 'Sin Email'}</span>`,
        `<span class="text-gray-400 dark:text-gray-500 text-[10px] min-w-[200px] break-words inline-block" title="${c.direccion || ''}">${c.direccion || 'Pendiente'}</span>`,
        (() => { const _da = Array.isArray(c.departamentos_activos) && c.departamentos_activos.length ? c.departamentos_activos : (c.empresa ? [c.empresa.replace('Renew ','')] : []); return _da.length ? _da.map(d => { const _c = d.toLowerCase().includes('water') ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : d.toLowerCase().includes('solar') ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-lime-500/10 text-lime-500 border-lime-500/20'; return `<span class="inline-flex px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider ${_c} border">${d}</span>`; }).join(' ') : `<span class="text-gray-400 text-[9px] italic">Prospecto</span>`; })(),
        origenHtml,
        repHtml,
        `<span class="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${c.estado === 'Completado' ? 'bg-tealAccent/10 text-tealAccent' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600'} border border-gray-200 dark:border-white/5">${c.estado || 'Prospecto'}</span>`,
        `<button class="btn-delete-client text-gray-300 hover:text-red-500 transition-colors" data-id="${c.id}"><i class="fa-solid fa-trash-can text-[10px]"></i></button>`
      ];
    });

    // ââ‚¬ââ‚¬ CRM Sub-View Tabs: Table | Kanban Lifecycle ââ‚¬ââ‚¬
    const crmTabsHtml = `
      <div class="flex items-center gap-2 mb-5 mt-2" id="crm-view-tabs">
        <button class="crm-sub-tab px-4 py-2 rounded-xl text-xs font-bold border transition-all ${!state.crmKanbanActive ? 'bg-tealAccent/10 text-tealAccent border-tealAccent/30' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10 hover:text-tealAccent'}" data-crm-tab="table">
          <i class="fa-solid fa-table-list mr-1"></i> Tabla CRM
        </button>
        <button class="crm-sub-tab px-4 py-2 rounded-xl text-xs font-bold border transition-all ${state.crmKanbanActive ? 'bg-tealAccent/10 text-tealAccent border-tealAccent/30' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10 hover:text-tealAccent'}" data-crm-tab="kanban">
          <i class="fa-solid fa-grip-vertical mr-1"></i> Kanban Ciclo de Vida
        </button>
      </div>
    `;

    if (state.crmKanbanActive) {
      // ââ‚¬ââ‚¬ KANBAN LIFECYCLE VIEW ââ‚¬ââ‚¬
      const MACRO_COLS = [
        { key: 'Prospecto',     emoji: '<i class="fa-solid fa-circle text-[10px]"></i>', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)' },
        { key: 'En Proceso',    emoji: '<i class="fa-solid fa-circle text-[10px]"></i>', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.2)' },
        { key: 'Cliente',        emoji: '<i class="fa-solid fa-circle text-[10px]"></i>', color: '#00f5d4', bg: 'rgba(0,245,212,0.06)',   border: 'rgba(0,245,212,0.2)' },
        { key: 'Cancelado',     emoji: '<i class="fa-solid fa-circle text-[10px]"></i>', color: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.2)' },
      ];

      const allClientes = clientesFiltrados;
      const columnsHtml = MACRO_COLS.map(col => {
        const cardsInCol = allClientes.filter(c => (c.macro_estado || 'Prospecto') === col.key);
        const cardsHtml = cardsInCol.map(c => {
          const depts = Array.isArray(c.departamentos_activos) && c.departamentos_activos.length ? c.departamentos_activos : (c.departamento ? [c.departamento] : []);
          const deptBadges = depts.map(d => {
            const _nm = d.replace('Renew ','');
            const dc = _nm.toLowerCase().includes('water') ? '#0ea5e9' : _nm.toLowerCase().includes('solar') ? '#f59e0b' : '#84cc16';
            return `<span style="display:inline-block;padding:1px 6px;border-radius:99px;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;background:${dc}15;color:${dc};border:1px solid ${dc}30;">${_nm}</span>`;
          }).join(' ');
          return `
            <div class="kanban-card" draggable="true" data-client-id="${c.id}" style="
              background:var(--kanban-card-bg, #fff);border:1px solid var(--kanban-card-border, rgba(0,0,0,0.06));
              border-radius:14px;padding:14px 16px;margin-bottom:10px;cursor:grab;
              transition:transform 0.15s ease, box-shadow 0.15s ease;
            ">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <span style="font-weight:800;font-size:0.85rem;color:var(--text-primary,#111);">${c.nombre || 'Sin nombre'}</span>
                <span style="font-size:9px;font-weight:700;color:var(--text-muted,#999);text-transform:uppercase;">${c.state_id || ''}</span>
              </div>
              <div style="font-size:11px;color:var(--text-secondary,#666);margin-bottom:8px;">${c.telefono || ''} ${c.email && c.email !== 'Sin Email' ? 'Â· ' + c.email : ''}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                <i class="fa-solid fa-user-tie text-[10px] text-tealAccent"></i>
                <span style="font-size:10px;font-weight:700;color:var(--text-muted,#888);">${getRepName(c) || 'Sin asignar'}</span>
              </div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;">${deptBadges || '<span style="font-size:9px;color:#aaa;font-style:italic;">Sin departamento</span>'}</div>
            </div>
          `;
        }).join('');

        return `
          <div class="kanban-column" data-macro="${col.key}" style="
            flex:1;min-width:260px;max-width:340px;
            background:${col.bg};border:1.5px solid ${col.border};border-radius:20px;
            padding:0;display:flex;flex-direction:column;max-height:78vh;
          ">
            <div style="padding:16px 18px 12px;border-bottom:1px solid ${col.border};flex-shrink:0;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:1.1rem;">${col.emoji}</span>
                  <span style="font-size:0.8rem;font-weight:900;color:${col.color};text-transform:uppercase;letter-spacing:1px;">${col.key}</span>
                </div>
                <span style="background:${col.color}18;color:${col.color};padding:2px 10px;border-radius:99px;font-size:11px;font-weight:900;">${cardsInCol.length}</span>
              </div>
            </div>
            <div class="kanban-drop-zone" data-macro="${col.key}" style="
              flex:1;overflow-y:auto;padding:20px 14px;min-height:400px;
              transition:all 0.3s;border-radius:0 0 20px 20px;
            ">
              ${cardsHtml || `<div style="text-align:center;padding:60px 10px;color:#aaa;font-size:12px;font-style:italic;opacity:0.5;border:2px dashed rgba(0,0,0,0.05);border-radius:15px;margin:10px;">Arrastra clientes aquí</div>`}
            </div>
          </div>
        `;
      }).join('');

      UI.canvas.innerHTML = `
        <style>
          .kanban-card { background: #ffffff; border: 1px solid rgba(0,0,0,0.08); }
          .dark .kanban-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); }
          .kanban-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,0.15); }
          .dark .kanban-card:hover { box-shadow: 0 12px 30px rgba(0,0,0,0.4); }
          .kanban-card.dragging { opacity: 0.5; transform: rotate(2deg); }
          .kanban-drop-zone.drag-over { background: rgba(0,245,212,0.08) !important; }
        </style>
        ${crmTabsHtml}
        <div style="display:flex;gap:16px;overflow-x:auto;padding-bottom:20px;align-items:flex-start;">
          ${columnsHtml}
        </div>
      `;

      // ââ‚¬ââ‚¬ Drag & Drop Logic ââ‚¬ââ‚¬
      const cards = UI.canvas.querySelectorAll('.kanban-card');
      const zones = UI.canvas.querySelectorAll('.kanban-drop-zone');

      cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
          const cliId = card.dataset.clientId;
          const _db = getDB();
          const cli = (_db.Clientes_Maestro || []).find(c => c.id === cliId);
          
          // RULE: Don't allow moving "Cliente"
          if (cli && cli.macro_estado === 'Cliente') {
            e.preventDefault();
            window.addNotification('CRM', 'Los clientes no se pueden mover manualmente.', 'info');
            return;
          }

          state.draggingClientId = cliId; // Global reliable tracking
          card.classList.add('dragging', 'opacity-50');
          e.dataTransfer.setData('text/plain', cliId);
          e.dataTransfer.dropEffect = 'move';
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging', 'opacity-50');
          state.draggingClientId = null;
        });

        card.addEventListener('click', async () => {
          const cliId = card.dataset.clientId;
          if (typeof window.showClientDetail === 'function') {
            await window.showClientDetail(cliId);
          }
        });
      });

      zones.forEach(zone => {
        zone.addEventListener('dragover', (e) => { 
          e.preventDefault(); 
          zone.classList.add('drag-over'); 
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', async (e) => {
          e.preventDefault();
          zone.classList.remove('drag-over');
          
          if (window.isKanbanMoving) return; // Prevent multiple simultaneous moves

          const clientId = state.draggingClientId || e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
          const newMacro = zone.dataset.macro;
          
          if (!clientId || !newMacro) return;

          const _db = getDB();
          const cli = (_db.Clientes_Maestro || []).find(c => c.id === clientId);
          if (!cli || cli.macro_estado === newMacro) return;

          const oldMacro = cli.macro_estado || 'Prospecto';
          const oldEstado = cli.estado || 'Lead';

          // Optimistic UI & Blocking
          window.isKanbanMoving = true;
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.1);z-index:9999;cursor:wait;display:flex;align-items:center;justify-content:center;';
          overlay.innerHTML = '<div class="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3"><i class="fa-solid fa-circle-notch fa-spin text-tealAccent"></i> <span class="text-xs font-bold uppercase">Actualizando...</span></div>';
          document.body.appendChild(overlay);

          // Update multiple fields for better persistence compatibility
          cli.macro_estado = newMacro;
          cli.estado = newMacro; // Sync standard field
          if (newMacro === 'Cancelado') {
            cli.departamento = 'CANCELADO'; // Force legacy field as backup
          }

          // ++ NEW LOGIC: AUTO-CREATE OR UPDATE PROJECT TO "Completado" IF DROPPED IN "Cliente"
          if (newMacro === 'Cliente') {
              let pipelineToUse = null;
              const depts = Array.isArray(cli.departamentos_activos) && cli.departamentos_activos.length ? cli.departamentos_activos : (cli.departamento ? [cli.departamento] : []);
              if (depts.length > 0) {
                  const deptStr = depts[0].toLowerCase();
                  pipelineToUse = (_db.Admin_Pipelines || []).find(pip => pip.nombre.toLowerCase().includes(deptStr.replace('renew ', '').trim()));
              }
              if (!pipelineToUse) {
                  pipelineToUse = (_db.Admin_Pipelines || []).find(pip => pip.nombre.toLowerCase().includes('water')); // fallback
              }

              if (pipelineToUse) {
                  const existingProy = (_db.Proyectos_Dinamicos || []).find(p => p.cliente_id === cli.id && p.pipeline_id === pipelineToUse.id);
                  if (existingProy) {
                      existingProy.fase_id = 'Completado';
                      existingProy.estado = 'Completado';
                      existingProy.fecha_cierre = new Date().toISOString();
                  } else {
                      const newProy = {
                          id: 'RENEW-PROY_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                          cliente_id: cli.id,
                          pipeline_id: pipelineToUse.id,
                          fase_id: 'Completado',
                          estado: 'Completado',
                          responsable_id: cli.vendedor_asignado_id || cli.creador_id || (window.user ? window.user.id : 'system'),
                          creador_id: (window.user ? window.user.id : 'system'),
                          created_at: new Date().toISOString(),
                          fecha: new Date().toISOString(),
                          fecha_cierre: new Date().toISOString()
                      };
                      _db.Proyectos_Dinamicos = _db.Proyectos_Dinamicos || [];
                      _db.Proyectos_Dinamicos.push(newProy);
                  }
              }
          }

          try {
            await saveDB(_db);
            window.addNotification('CRM', `${cli.nombre} movido a ${newMacro}`, 'success');
            await renderView();
          } catch (err) {
            console.error(err);
            cli.macro_estado = oldMacro; // Rollback
            cli.estado = oldEstado;
            window.addNotification('Error', 'No se pudo persistir el cambio', 'error');
            await renderView();
          } finally {
            overlay.remove();
            window.isKanbanMoving = false;
          }
        });
      });

      // Tab switcher
      UI.canvas.querySelectorAll('.crm-sub-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
          state.crmKanbanActive = btn.dataset.crmTab === 'kanban';
          await renderView();
        });
      });

    } else {
      // ââ‚¬ââ‚¬ TABLE VIEW (original) ââ‚¬ââ‚¬
      renderTable(
        [`<button id="btn-bulk-delete-cli" class="text-gray-400 hover:text-red-500 transition-all opacity-30 hover:opacity-100" title="${t('crm_bulk_delete')}"><i class="fa-solid fa-trash-can"></i></button>`, t('crm_col_id'), t('crm_col_name'), t('crm_col_contact'), t('crm_col_email'), t('crm_col_address'), t('crm_col_dept'), 'ORIGEN', t('crm_col_rep'), t('crm_col_status'), ""],
        rows
      );

      // Prepend the tabs before the table
      const tableWrap = UI.canvas.querySelector('.overflow-x-auto') || UI.canvas.firstElementChild;
      if (tableWrap) tableWrap.insertAdjacentHTML('beforebegin', crmTabsHtml);

      // Tab switcher
      UI.canvas.querySelectorAll('.crm-sub-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
          state.crmKanbanActive = btn.dataset.crmTab === 'kanban';
          await renderView();
        });
      });
    }
  } else if (state.activeView === 'hrhub') {
    if (UI.viewTitle) UI.viewTitle.textContent = "HR Hub";
    if (UI.viewDesc) UI.viewDesc.textContent = "Centro de RRHH - Gestión de Talento y Onboarding";
    setGlobalButton(true, '<i class="fa-solid fa-user-tie"></i> Add Collaborator'); 
    await renderHRHub();
  } else if (state.activeView === 'mapa-admin') {
    if (UI.viewTitle) UI.viewTitle.innerHTML = '<i class="fa-solid fa-map-location-dot text-tealAccent"></i> Mapa Clientes';
    if (UI.viewDesc) UI.viewDesc.textContent = 'Ubicaci\u00f3n global de todos los clientes en Renew OS.';
    setGlobalButton(false, '');
    
    UI.canvas.innerHTML = `
      <div class="mt-6 bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-premium transition-all animate-fadeIn">
        
        <!-- Vendor Search Bar -->
        <div id="rep-search-wrap" style="margin-bottom: 16px; position: relative;">
          <div style="display: flex; align-items: center; gap: 12px; background: var(--surface-alt, #f1f5f9); border-radius: 14px; padding: 10px 16px; border: 1.5px solid transparent; transition: border-color 0.2s;" id="rep-search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="flex-shrink:0;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input 
              id="rep-search-input" 
              type="text" 
              placeholder="Buscar representante de ventas..." 
              autocomplete="off"
              style="border:none; background:transparent; outline:none; font-size:14px; color: var(--text-primary, #1e293b); width:100%; font-family:'Inter',sans-serif;"
            />
            <button id="rep-search-clear" style="display:none; background:none; border:none; cursor:pointer; color:#94a3b8; padding:0; line-height:1;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div id="rep-search-dropdown" style="display:none; position:absolute; top:calc(100% + 6px); left:0; right:0; background:white; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,0.15); border:1px solid #e2e8f0; z-index:9999; max-height:220px; overflow-y:auto;"></div>
        </div>

        <div id="admin-map" style="width: 100%; height: 700px; border-radius: 12px;"></div>
      </div>
    `;

    setTimeout(async () => {
      const mapEl = document.getElementById('admin-map');
      if (mapEl && window.google && window.google.maps) {
        const map = new google.maps.Map(mapEl, {
          center: { lat: 39.8283, lng: -98.5795 }, // USA center
          zoom: 4,
          mapTypeControl: false,
          streetViewControl: false,
          styles: [
            { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "visibility": "off" }] },
            { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
            { "featureType": "road", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
            { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
          ]
        });

        const deptConfig = {
          'all':   { label: 'Todos', color: '#00f5d4' },
          'solar': { label: 'Solar', color: '#22c55e', icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' },
          'water': { label: 'Water', color: '#3b82f6', icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
          'home':  { label: 'Home',  color: '#eab308', icon: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png' }
        };

        const statusConfig = {
          'prospecto':{ label: 'Prospecto', color: '#f59e0b' },
          'cliente':  { label: 'Cliente',   color: '#10b981' }
        };

        let activeDept = 'all';
        let activeStatus = 'prospecto';
        let activeRepId = null;
        const allMarkerMeta = [];

        const applyFilters = () => {
          allMarkerMeta.forEach(({ marker, deptKey, statusKey, repId }) => {
            const matchDept = (activeDept === 'all' || activeDept === deptKey);
            const matchStatus = (activeStatus === 'all' || activeStatus === statusKey);
            const matchRep = (activeRepId === null || activeRepId === repId);
            marker.setVisible(matchDept && matchStatus && matchRep);
          });
        };

        const legend = document.createElement('div');
        legend.style.margin = '10px';
        legend.innerHTML = `
          <div style="background: white; padding: 15px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); width: 180px; font-family: 'Inter', sans-serif;">
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Departamento</div>
            <div id="admin-legend-depts" style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 15px;">
              ${Object.entries(deptConfig).map(([key, cfg]) => `
                <div class="leg-item dept-item ${key === 'all' ? 'active' : ''}" data-val="${key}" style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:12px; transition:all 0.2s; border: 1px solid transparent; user-select:none; -webkit-user-select:none; ${key === 'all' ? 'background:#00f5d415; border-color:#00f5d450; font-weight:bold;' : ''}">
                  ${key === 'all' 
                    ? `<div style="width:14px; height:14px; border-radius:50%; background:conic-gradient(#22c55e, #3b82f6, #eab308, #ef4444); border: 1px solid #fff; box-shadow:0 0 2px rgba(0,0,0,0.2);"></div>`
                    : `<img src="${cfg.icon}" style="width:16px; height:16px;">`
                  }
                  <span>${cfg.label}</span>
                </div>
              `).join('')}
            </div>
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Tipo de Registro</div>
            <div id="admin-legend-status" style="display: flex; flex-direction: column; gap: 4px;">
              ${Object.entries(statusConfig).map(([key, cfg]) => `
                <div class="leg-item status-item ${key === 'prospecto' ? 'active' : ''}" data-val="${key}" style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:12px; transition:all 0.2s; border: 1px solid transparent; user-select:none; -webkit-user-select:none; ${key === 'prospecto' ? 'background:#f1f5f9; border-color:#cbd5e1; font-weight:bold;' : ''}">
                  <div style="width:8px; height:8px; border-radius:50%; background:${cfg.color};"></div>
                  <span>${cfg.label}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <style>
            .leg-item:hover { background: #f8fafc; }
            .leg-item.active { font-weight: 800 !important; }
          </style>
        `;

        legend.querySelectorAll('.dept-item').forEach(el => {
          google.maps.event.addDomListener(el, 'click', () => {
            legend.querySelectorAll('.dept-item').forEach(x => {
              x.style.background = 'transparent';
              x.style.borderColor = 'transparent';
              x.style.fontWeight = 'normal';
              x.classList.remove('active');
            });
            activeDept = el.dataset.val;
            el.classList.add('active');
            el.style.background = deptConfig[activeDept].color + '15';
            el.style.borderColor = deptConfig[activeDept].color + '50';
            el.style.fontWeight = 'bold';
            applyFilters();
          });
        });

        legend.querySelectorAll('.status-item').forEach(el => {
          google.maps.event.addDomListener(el, 'click', () => {
            legend.querySelectorAll('.status-item').forEach(x => {
              x.style.background = 'transparent';
              x.style.borderColor = 'transparent';
              x.style.fontWeight = 'normal';
              x.classList.remove('active');
            });
            activeStatus = el.dataset.val;
            el.classList.add('active');
            el.style.background = '#f1f5f9';
            el.style.borderColor = '#cbd5e1';
            el.style.fontWeight = 'bold';
            applyFilters();
          });
        });

        map.controls[google.maps.ControlPosition.RIGHT_TOP].push(legend);

        const geocoder = new google.maps.Geocoder();
        const bounds = new google.maps.LatLngBounds();
        let validMarkers = 0;
        let workers = [];
        try { workers = await getAdminWorkers(); } catch(e){}

        const db = getDB();
        const clientes = db.Clientes_Maestro || [];
        const proyectos = db.Proyectos_Dinamicos || [];
        const pipelines = db.Admin_Pipelines || [];

        // Helper: get dept key from a project using pipeline lookup
        const getDeptFromProject = (p) => {
          const pip = pipelines.find(pl => pl.id === p.pipeline_id);
          const name = (pip ? pip.nombre : '').toLowerCase();
          if (name.includes('solar')) return 'solar';
          if (name.includes('water')) return 'water';
          if (name.includes('home'))  return 'home';
          return 'otro';
        };

        // Build repId lookup per (client, dept)
        const repByClientDept = {};
        proyectos.forEach(p => {
          const dk = getDeptFromProject(p);
          const key = `${p.cliente_id}::${dk}`;
          if (!repByClientDept[key]) repByClientDept[key] = p.responsable_id;
        });

        // Build unique (client, dept) combos
        const adminCombos = [];
        const seenAdminCombo = new Set();

        // Pass 1: clients with projects
        proyectos.forEach(p => {
          const c = clientes.find(cl => cl.id === p.cliente_id);
          if (!c || !c.direccion) return;
          const deptKey = getDeptFromProject(p);
          const combo = `${c.id}::${deptKey}`;
          if (!seenAdminCombo.has(combo)) {
            seenAdminCombo.add(combo);
            adminCombos.push({ c, deptKey, statusKey: 'cliente' });
          }
        });

        // Pass 2: prospectos (no projects at all)
        clientes.forEach(c => {
          if (!c.direccion || proyectos.some(p => p.cliente_id === c.id)) return;
          let deptKey = 'otro';
          let dptoStr = (c.departamento || c.empresa || '').toLowerCase();
          if (c.unidades && Array.isArray(c.unidades)) {
            dptoStr += ' ' + c.unidades.join(' ').toLowerCase();
          }
          if (dptoStr.includes('solar')) deptKey = 'solar';
          else if (dptoStr.includes('water')) deptKey = 'water';
          else if (dptoStr.includes('home')) deptKey = 'home';
          const combo = `${c.id}::${deptKey}`;
          if (!seenAdminCombo.has(combo)) {
            seenAdminCombo.add(combo);
            adminCombos.push({ c, deptKey, statusKey: 'prospecto' });
          }
        });

        // Pre-compute all depts per client (for showing all badges in InfoWindow)
        const allClientDepts = {};
        proyectos.forEach(p => {
          const dk = getDeptFromProject(p);
          if (!allClientDepts[p.cliente_id]) allClientDepts[p.cliente_id] = new Set();
          allClientDepts[p.cliente_id].add(dk);
        });

        adminCombos.forEach(({ c, deptKey, statusKey }) => {
          const statusCfg = statusConfig[statusKey];
          const repId = c.vendedor_asignado_id || repByClientDept[`${c.id}::${deptKey}`];
          let repName = 'Sin asignar';
          if (repId) {
            const worker = workers.find(w => w.id === repId);
            if (worker) repName = `${worker.nombre} ${worker.apellido || ''}`.trim();
          }

          // All depts this client has (for badges)
          const clientDepts = [...(allClientDepts[c.id] || new Set([deptKey]))];
          const deptBadgesHtml = clientDepts.map(dk => {
            const cfg = deptConfig[dk] || deptConfig['otro'];
            return `<span style="font-size: 10px; background:${cfg.color}20; color:${cfg.color}; padding:2px 8px; border-radius:10px; font-weight:700; text-transform:uppercase; border:1px solid ${cfg.color}40;">${cfg.label}</span>`;
          }).join('');

          geocoder.geocode({ address: c.direccion }, (results, status) => {
            if (status === 'OK' && results[0]) {
              const marker = new google.maps.Marker({
                map: map,
                position: results[0].geometry.location,
                title: `${c.nombre || 'Cliente'} (${deptConfig[deptKey].label})`,
                icon: deptConfig[deptKey].icon
              });
              const infoWindow = new google.maps.InfoWindow({
                content: `<div style="color:black; padding:6px; font-family: 'Inter', sans-serif; min-width:210px;">
                            <strong style="font-size: 14px; display:block; margin-bottom:6px;">${c.nombre} ${c.apellido || ''}</strong>
                            <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px;">
                              ${deptBadgesHtml}
                              <span style="font-size: 10px; background:${statusCfg.color}20; color:${statusCfg.color}; padding:2px 8px; border-radius:10px; font-weight:700; text-transform:uppercase; border:1px solid ${statusCfg.color}40;">${statusCfg.label}</span>
                            </div>
                            <div style="margin-top:8px; font-size:12px; color:#555; display:flex; flex-direction:column; gap:4px;">
                              <span style="color:#00dfbf; font-weight:700;"><i class="fa-solid fa-user-tie"></i> Rep: ${repName}</span>
                              <span><i class="fa-solid fa-phone"></i> ${c.telefono || 'Sin teléfono'}</span>
                              <span style="font-size:11px; color:#0f8b78; background:#00f5d420; border:1px solid #00f5d450; border-radius:4px; padding:3px 6px; display:inline-block;"><i class="fa-solid fa-location-dot"></i> ${c.direccion}</span>
                              ${c.nota_mapa ? `<div style="margin-top:6px; padding:8px 10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; border-left:3px solid #00dfbf;">
                                <div style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#94a3b8; margin-bottom:3px;"><i class="fa-solid fa-file-pen"></i> Nota del vendedor</div>
                                <div style="font-size:12px; color:#374151;">${c.nota_mapa}</div>
                              </div>` : ''}
                            </div>
                          </div>`
              });
              marker.addListener('click', () => { infoWindow.open(map, marker); });
              allMarkerMeta.push({ marker, deptKey, statusKey, repId });
              bounds.extend(results[0].geometry.location);
              validMarkers++;
              if (validMarkers > 0) map.fitBounds(bounds);
            }
          });
        });

        // ââ‚¬ââ‚¬ Vendor Search Bar Logic ââ‚¬ââ‚¬
        const searchInput = document.getElementById('rep-search-input');
        const searchDropdown = document.getElementById('rep-search-dropdown');
        const searchClear = document.getElementById('rep-search-clear');
        const searchBox = document.getElementById('rep-search-box');

        if (searchInput && workers.length > 0) {
          searchInput.addEventListener('focus', () => {
            searchBox.style.borderColor = '#00f5d4';
          });
          searchInput.addEventListener('blur', () => {
            searchBox.style.borderColor = 'transparent';
            setTimeout(() => { searchDropdown.style.display = 'none'; }, 200);
          });

          searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase().trim();
            searchClear.style.display = q ? 'block' : 'none';
            if (!q) {
              searchDropdown.style.display = 'none';
              return;
            }
            const matches = workers.filter(w => {
              const fullName = `${w.nombre || ''} ${w.apellido || ''}`.toLowerCase();
              return fullName.includes(q);
            }).slice(0, 8);

            if (matches.length === 0) {
              searchDropdown.innerHTML = `<div style="padding:14px 16px; color:#94a3b8; font-size:13px; font-family:'Inter',sans-serif;">Sin resultados</div>`;
            } else {
              searchDropdown.innerHTML = matches.map(w => {
                const fullName = `${w.nombre || ''} ${w.apellido || ''}`.trim();
                const initials = ((w.nombre || '?')[0] + (w.apellido || '?')[0]).toUpperCase();
                const dept = w.department || w.departamento || '';
                const clientCount = allMarkerMeta.filter(m => m.repId === w.id).length;
                return `<div class="rep-drop-item" data-id="${w.id}" data-name="${fullName}" style="display:flex; align-items:center; gap:12px; padding:10px 14px; cursor:pointer; transition:background 0.15s; border-bottom:1px solid #f1f5f9; font-family:'Inter',sans-serif;">
                  <div style="width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,#00dfbf,#0ea5e9); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:white; flex-shrink:0;">${initials}</div>
                  <div style="flex:1; min-width:0;">
                    <div style="font-size:13px; font-weight:700; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${fullName}</div>
                    <div style="font-size:11px; color:#94a3b8;">${dept} Â· ${clientCount} en mapa</div>
                  </div>
                </div>`;
              }).join('');
            }
            searchDropdown.style.display = 'block';
          });

          searchDropdown.addEventListener('mousedown', e => {
            const item = e.target.closest('.rep-drop-item');
            if (!item) return;
            const id = item.dataset.id;
            const name = item.dataset.name;
            activeRepId = id;
            searchInput.value = name;
            searchClear.style.display = 'block';
            searchDropdown.style.display = 'none';
            // Highlight search box in teal to indicate filter is active
            searchBox.style.borderColor = '#00f5d4';
            searchBox.style.background = '#00f5d408';
            applyFilters();
          });

          searchClear.addEventListener('click', () => {
            activeRepId = null;
            searchInput.value = '';
            searchClear.style.display = 'none';
            searchDropdown.style.display = 'none';
            searchBox.style.borderColor = 'transparent';
            searchBox.style.background = 'var(--surface-alt, #f1f5f9)';
            applyFilters();
          });
        }
      }
    }, 300);
  } else if (state.activeView === 'calendario') {
    UI.viewTitle.innerHTML = '<i class="fa-solid fa-calendar-days text-tealAccent"></i> Calendario Maestro';
    UI.viewDesc.textContent = 'Gestión y sincronización en tiempo real con Google Calendar.';
    setGlobalButton(true, '<i class="fa-solid fa-calendar-plus text-lg"></i> Añadir Evento');
    renderCalendario();
  } else if (state.activeView === 'usuarios' || state.activeView === 'equipo') {
    UI.viewTitle.textContent = "Equipo Renew";
    UI.viewDesc.textContent = "Compañeros de trabajo en Renew Group.";
    setGlobalButton(true, '<i class="fa-solid fa-user-tie"></i> Add Collaborator');
    
    let items = await getAdminWorkers();
    
    if (window.globalSearchQuery) {
        items = items.filter(u => {
            const searchStr = window.normalizeSearchString(`${u.nombre || ''} ${u.apellido || ''} ${u.department || ''} ${u.rol || ''} ${u.email || ''} ${u.telefono || ''}`);
            return searchStr.includes(window.globalSearchQuery);
        });
    }

    const cardsHtml = items.map(u => {
        const safeNombre = u.nombre || 'Worker';
        const safeApellido = u.apellido || '';
        const initial = u.initials || (safeNombre[0] || '?');
        const dept = u.department || 'Renew Group';
        const rol = (u.rol || 'Vendedor').toLowerCase().includes('vendedor') ? 'Representante de Ventas' : (u.rol || 'Colaborador');
        const fotoHtml = u.foto ? `<img src="${u.foto}" class="w-16 h-16 rounded-full object-cover border-2 border-tealAccent/20 shadow-lg group-hover:scale-105 transition-transform" onerror="this.onerror=null; this.outerHTML='<div class=&quot;w-16 h-16 rounded-full bg-tealAccent/10 flex items-center justify-center font-black text-tealAccent text-xl border-2 border-tealAccent/20&quot;>${initial}</div>';">` : `<div class="w-16 h-16 rounded-full bg-tealAccent/10 flex items-center justify-center font-black text-tealAccent text-xl border-2 border-tealAccent/20">${initial}</div>`;
        
        return `
            <div class="group relative bg-white dark:bg-[#0f172a] border border-gray-100 dark:border-white/5 rounded-[2rem] p-6 shadow-premium hover:shadow-teal-glow transition-all animate-fadeIn">
                <div class="flex flex-col items-center text-center">
                    <div class="relative mb-4">
                        ${fotoHtml}
                        <div class="absolute -bottom-1 -right-1 w-5 h-5 ${u.is_suspended ? 'bg-red-500' : 'bg-tealAccent'} rounded-full border-4 border-white dark:border-darkCard"></div>
                    </div>
                    
                    <h3 class="text-base font-black text-gray-900 dark:text-white tracking-tighter mb-1">${safeNombre} ${safeApellido}</h3>
                    <p class="text-[9px] font-black text-tealAccent uppercase tracking-widest mb-3 bg-tealAccent/5 px-3 py-1 rounded-full border border-tealAccent/10">${rol}</p>
                    
                    <div class="flex items-center gap-2 mb-4">
                         ${(u.unidades || []).map(pip => {
                             let icon = 'fa-gear';
                             let colorClass = 'text-gray-400';
                             if(pip.toLowerCase().includes('solar')) { icon = 'fa-sun'; colorClass = 'text-amber-500'; }
                             if(pip.toLowerCase().includes('water')) { icon = 'fa-droplet'; colorClass = 'text-blue-500'; }
                             if(pip.toLowerCase().includes('home'))  { icon = 'fa-house'; colorClass = 'text-purple-500'; }
                             return `<i class="fa-solid ${icon} text-[10px] ${colorClass}"></i>`;
                         }).join('')}
                    </div>

                    <div class="flex flex-col gap-1 w-full mb-4">
                        <div class="flex items-center justify-between text-[10px] px-2 py-1 bg-gray-50 dark:bg-white/5 rounded-lg">
                            <span class="text-gray-400 font-bold uppercase tracking-widest">Sede</span>
                            <span class="text-orange-500 font-black uppercase tracking-widest">${u.sede || '-'}</span>
                        </div>
                        <div class="flex items-center justify-between text-[10px] px-2 py-1 bg-gray-50 dark:bg-white/5 rounded-lg">
                            <span class="text-gray-400 font-bold uppercase tracking-widest">Dpto</span>
                            <span class="text-gray-600 dark:text-gray-300 font-black uppercase tracking-widest">${dept}</span>
                        </div>
                    </div>

                    <div class="flex gap-2 w-full mt-auto">
                        <button class="worker-name-link flex-1 bg-tealAccent/10 hover:bg-tealAccent/20 text-tealAccent py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-tealAccent/20" data-id="${u.id}">
                            Ver Perfil
                        </button>
                        <button onclick="window.open('tel:${u.telefono}', '_self')" class="w-10 h-10 bg-gray-50 dark:bg-white/5 flex items-center justify-center rounded-xl text-gray-400 hover:text-tealAccent transition-all border border-gray-100 dark:border-white/5">
                            <i class="fa-solid fa-phone text-xs"></i>
                        </button>
                    </div>
                </div>

                <!-- Admin Action Menu -->
                <div class="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 items-end">
                    <label class="relative inline-flex items-center cursor-pointer" title="${u.is_suspended ? 'Cuenta Inhabilitada' : 'Cuenta Activa'}">
                      <input type="checkbox" class="sr-only peer toggle-worker-status" data-id="${u.id}" ${u.is_suspended ? '' : 'checked'}>
                      <div class="w-7 h-3.5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all dark:border-gray-600 peer-checked:bg-tealAccent"></div>
                    </label>
                    <button class="btn-delete-worker flex items-center justify-center w-7 h-7 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors" data-id="${u.id}" title="Eliminar Trabajador">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    UI.canvas.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mt-6">
            ${cardsHtml}
        </div>
    `;
  }
  else if (state.activeView === 'proveedores') {
    UI.viewTitle.textContent = "Partners Hub";
    UI.viewDesc.textContent = "Directorio oficial de proveedores y subcontratistas.";
    setGlobalButton(true, '<i class="fa-solid fa-handshake"></i> Add Partner');
    
    let items = (db.Admin_Proveedores || []);
    
    if (window.globalSearchQuery) {
        items = items.filter(u => {
            const searchStr = window.normalizeSearchString(`${u.empresa || ''} ${u.contacto || ''} ${u.servicio || ''} ${u.telefono || ''} ${u.area || ''}`);
            return searchStr.includes(window.globalSearchQuery);
        });
    }

    const headers = [`<button id="btn-bulk-delete-partners" class="text-gray-400 hover:text-red-500 transition-all opacity-30 hover:opacity-100" title="Eliminar seleccionados"><i class="fa-solid fa-trash-can"></i></button>`, "Empresa / Contacto", "Servicio", "Teléfono", "Área de Cobertura", "Documentos", ""];
    const rowsHtml = items.map(u => {
        const safeEmpresa = u.empresa || 'Empresa Desconocida';
        const initial = safeEmpresa[0] ? safeEmpresa[0].toUpperCase() : '?';
        const fotoHtml = u.foto ? `<img src="${u.foto}" class="w-7 h-7 rounded-lg object-cover border border-white/5">` : `<div class="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center font-black text-gray-600 text-[9px]">${initial}</div>`;
        
        let rawServ = u.servicio || 'General';
        if (rawServ.toLowerCase() === 'egenral') rawServ = 'General';
        let servicioHtml = `<span class="px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-gray-200 dark:border-white/5">${rawServ}</span>`;
        const s = rawServ.toLowerCase();
        
        if (s === 'fence') {
            servicioHtml = `<span class="px-2 py-0.5 bg-green-500/10 text-green-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-green-500/20"><i class="fa-solid fa-trowel-bricks"></i> ${t('partner_cat_fence')}</span>`;
        } else if (s === 'roofing' || s === 'roof') {
            servicioHtml = `<span class="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-blue-500/20"><i class="fa-solid fa-house"></i> ${t('partner_cat_roofing')}</span>`;
        } else if (s === 'solar') {
            servicioHtml = `<span class="px-2 py-0.5 bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-orange-500/20"><i class="fa-solid fa-sun"></i> ${t('partner_cat_solar')}</span>`;
        } else if (s === 'hvac' || s === 'aire') {
            servicioHtml = `<span class="px-2 py-0.5 bg-cyan-500/10 text-cyan-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-cyan-500/20"><i class="fa-solid fa-snowflake"></i> ${t('partner_cat_hvac')}</span>`;
        } else if (s === 'painting' || s === 'pintura') {
            servicioHtml = `<span class="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-purple-500/20"><i class="fa-solid fa-paint-roller"></i> ${t('partner_cat_painting')}</span>`;
        } else if (s === 'remodelacion') {
            servicioHtml = `<span class="px-2 py-0.5 bg-gray-500/10 text-gray-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-gray-500/20"><i class="fa-solid fa-toolbox"></i> ${t('partner_cat_remodelacion')}</span>`;
        } else if (s === 'dumpsters') {
            servicioHtml = `<span class="px-2 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-red-500/20"><i class="fa-solid fa-trash"></i> ${t('partner_cat_dumpsters')}</span>`;
        } else if (s === 'gutters') {
            servicioHtml = `<span class="px-2 py-0.5 bg-sky-500/10 text-sky-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-sky-500/20"><i class="fa-solid fa-cloud-showers-water"></i> ${t('partner_cat_gutters')}</span>`;
        } else if (s === 'screens') {
            servicioHtml = `<span class="px-2 py-0.5 bg-teal-500/10 text-tealAccent text-[8px] font-black uppercase tracking-widest rounded-md border border-tealAccent/20"><i class="fa-solid fa-border-all"></i> ${t('partner_cat_screens')}</span>`;
        } else {
            servicioHtml = `<span class="px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-gray-200 dark:border-white/5"><i class="fa-solid fa-gear"></i> ${t('partner_cat_general')}</span>`;
        }

        return `
            <tr class="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                <td class="px-4 py-2.5 w-4 text-center">
                    <input type="checkbox" class="partner-chk w-3.5 h-3.5 rounded border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-tealAccent focus:ring-tealAccent" data-id="${u.id}">
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                        ${fotoHtml}
                        <div class="flex flex-col">
                            <a href="#" class="partner-name-link font-bold text-gray-900 dark:text-white hover:text-tealAccent transition-colors text-xs tracking-tight" data-id="${u.id}">${safeEmpresa}</a>
                            <span class="text-[8px] text-gray-400 dark:text-gray-600 font-black uppercase tracking-widest">${u.contacto || 'Sin contacto'}</span>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                    ${servicioHtml}
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap text-[10px] text-gray-500 dark:text-gray-400 font-medium">${u.telefono || '-'}</td>
                <td class="px-4 py-2.5 whitespace-nowrap text-[10px] text-gray-500 dark:text-gray-400 font-medium">${u.area || '-'}</td>
                <td class="px-4 py-2.5 whitespace-nowrap flex gap-1">
                    ${u.w9Url
                      ? `<a href="${u.w9Url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide">
                           <i class="fa-solid fa-file-invoice"></i> W-9 OK
                         </a>`
                      : `<span class="inline-flex items-center gap-1 bg-gray-100 dark:bg-white/5 text-gray-400 border border-gray-200 dark:border-white/5 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide">
                           <i class="fa-solid fa-file-excel"></i> Sin W-9
                         </span>`
                    }
                    ${u.seguroUrl
                      ? `<a href="${u.seguroUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide">
                           <i class="fa-solid fa-shield-halved"></i> Seguro OK
                         </a>`
                      : `<span class="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide">
                           <i class="fa-solid fa-triangle-exclamation"></i> Sin Seguro
                         </span>`
                    }
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap text-right">
                    <button class="btn-delete-partner text-gray-300 hover:text-red-500 transition-colors" data-id="${u.id}"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    UI.canvas.innerHTML = `
        <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-2xl shadow-premium overflow-hidden mt-4 overflow-x-auto hide-scrollbar">
            <table class="w-full text-xs">
                <thead class="bg-gray-50 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
                    <tr>
                        ${headers.map(h => `<th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em]">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
  }
  else if (state.activeView === 'call-center') {
      setGlobalButton(false);
      renderCallCenterAdmin();
  }
  else if (state.activeView === 'kanban') {
    UI.viewTitle.textContent = "Kanban Pulse";
    UI.viewDesc.textContent = "Real-time visualization of all deals across the RENEW spectrum.";
    setGlobalButton(false);
    
    const currentUser = JSON.parse(localStorage.getItem('rs_user') || '{}');
    const rol = (currentUser.rol || '').toLowerCase();
    let userPips = state.pipelines;
    if (rol === 'project manager') {
       const allowedIds = currentUser.pipeline_ids || [];
       userPips = state.pipelines.filter(p => allowedIds.includes(String(p.id)));
    }

    const activePip = userPips.find(p => p.id === state.activePipId) || userPips[0];
    if (!activePip) return UI.canvas.innerHTML = '<div class="py-20 text-center text-gray-600 font-black uppercase tracking-[0.3em]">System Offline: No Pipelines Installed or Assigned</div>';
    state.activePipId = activePip.id;

    const tabsHtml = userPips.map(p => `
      <button class="pip-tab px-10 py-5 rounded-t-3xl font-black text-[10px] uppercase tracking-[0.2em] border-t-2 transition-all ${p.id === state.activePipId ? 'bg-white dark:bg-darkCard border-tealAccent text-tealAccent' : 'bg-transparent border-transparent text-gray-400 dark:text-gray-700 hover:text-tealAccent'}" data-id="${p.id}">
        ${p.nombre}
      </button>
    `).join('');

    const pFases = state.fases.filter(f => f.pipeline_id === state.activePipId).sort((a,b) => a.orden - b.orden);
    const pDeals = (db.Proyectos_Dinamicos || []).filter(p => p.pipeline_id === state.activePipId);

    const columnsHtml = pFases.map(f => {
      const dealsInFase = pDeals.filter(d => d.fase_id === f.id);
      const cardsHtml = dealsInFase.map(d => {
        const cli = (db.Clientes_Maestro || []).find(c => c.id === d.cliente_id) || { nombre: 'Prospect Unknown' };
        const resp = (db.Usuarios || []).find(u => u.id === d.responsable_id) || { nombre: 'System Admin', initials: 'SA' };
        
        return `
          <div class="kanban-card bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-xl p-4 shadow-sm dark:shadow-premium hover:shadow-teal-glow hover:border-tealAccent/30 transition-all cursor-grab active:cursor-grabbing mb-3 group" draggable="true" data-proyectoid="${d.id}">
            <div class="flex justify-between items-start mb-3">
              <span class="text-[8px] font-black text-gray-400 dark:text-gray-700 uppercase tracking-widest">RENEW-${d.id.toUpperCase()}</span>
              <div class="flex gap-2 items-center">
                ${d.tiene_problema 
                  ? `<span class="cursor-pointer flex items-center gap-1 bg-red-50 dark:bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-red-200 dark:border-red-500/20" onclick="event.stopPropagation(); window.showProblemModal('${d.id}')">
                      <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block"></span>
                      PROBLEMA
                    </span>`
                  : ''}
                ${d.ultima_actividad && (Date.now() - new Date(d.ultima_actividad).getTime() < 7200000) 
                  ? `<span class="flex items-center gap-1 bg-tealAccent/10 text-tealAccent text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-tealAccent/20">
                      <span class="w-1.5 h-1.5 rounded-full bg-tealAccent animate-pulse inline-block"></span>
                      UPDATED
                    </span>` 
                  : `<div class="w-2 h-2 rounded-full bg-tealAccent animate-pulse"></div>`}
              </div>
            </div>
            
            <h4 class="text-gray-900 dark:text-white font-black text-sm mb-0.5 tracking-tighter limit-text-1 group-hover:text-tealAccent transition-colors">${cli.nombre}</h4>
            <div class="flex items-center gap-2 mb-3">
               <i class="fa-solid fa-clock text-[9px] text-gray-300 dark:text-gray-700"></i>
               <span class="text-[9px] text-gray-400 dark:text-gray-600 font-black uppercase tracking-tighter">${d.created_at || 'Recently synced'}</span>
            </div>

            ${d.ultima_actividad_label ? `
            <div class="bg-gray-50 dark:bg-white/[0.03] rounded-lg px-2.5 py-1.5 mb-3 border border-gray-100 dark:border-white/5">
              <p class="text-[8px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-0.5">ÑÅ¡ltima Actividad</p>
              <p class="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate">${d.ultima_actividad_label}</p>
              <p class="text-[8px] text-gray-400 dark:text-gray-600">${d.ultima_actividad ? new Date(d.ultima_actividad).toLocaleString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : ''}</p>
            </div>` : ''}

            <div class="flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-3">
              <div class="flex items-center gap-2.5">
                <div class="w-6 h-6 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-[9px] font-black text-tealAccent border border-gray-200 dark:border-white/10">
                  ${resp.initials || 'UA'}
                </div>
                <div class="flex flex-col">
                   <span class="text-[8px] text-gray-400 dark:text-gray-600 font-black uppercase tracking-tighter">Assigned Head</span>
                   <span class="text-[10px] text-gray-600 dark:text-gray-400 font-bold tracking-tight">${resp.nombre}</span>
                </div>
              </div>
              <div class="flex gap-3">
                <button class="btn-delete-kanban-project text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" data-id="${d.id}"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
                <i class="fas fa-ellipsis-v text-gray-300 dark:text-gray-700 group-hover:text-tealAccent transition-colors text-[10px]"></i>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="kanban-col flex flex-col min-w-[260px] max-w-[260px] h-full" data-faseid="${f.id}">
          <div class="px-4 py-3 mb-4 bg-white dark:bg-white/[0.01] rounded-xl border border-gray-100 dark:border-white/5 flex justify-between items-center shadow-sm dark:shadow-lg">
            <h3 class="text-[9px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] truncate mr-2 flex items-center gap-1">
              ${f.nombre}
              <button onclick="adminEditFaseName('${f.id}', event)" class="text-gray-300 hover:text-tealAccent transition-colors p-1 cursor-pointer" title="Editar nombre">
                <i class="fa-solid fa-pen text-[7px]" style="pointer-events: none;"></i>
              </button>
            </h3>
            <span class="bg-tealAccent/5 text-tealAccent text-[9px] px-2 py-0.5 rounded-full font-black border border-tealAccent/10 shrink-0">${dealsInFase.length}</span>
          </div>
          <div class="kanban-drop-zone flex-1 overflow-y-auto pb-12 hide-scrollbar min-h-[500px]" data-faseid="${f.id}">
            ${cardsHtml}
          </div>
        </div>
      `;
    }).join('');

    // --- Add a virtual "Finalizados" column at the end ---
    const completedDeals = pDeals.filter(d => d.estado === 'Completado' || d.fase_id === 'Completado' || d.fase_id === null);
    let completedColumnHtml = '';
    if (completedDeals.length > 0) {
      const cardsHtml = completedDeals.map(d => {
        const cli = (db.Clientes_Maestro || []).find(c => c.id === d.cliente_id) || { nombre: 'Prospect Unknown' };
        const resp = (db.Usuarios || []).find(u => u.id === d.responsable_id) || { nombre: 'System Admin', initials: 'SA' };
        
        return `
          <div class="kanban-card bg-teal-50/50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-500/20 rounded-xl p-4 shadow-sm dark:shadow-premium hover:shadow-teal-glow transition-all cursor-grab active:cursor-grabbing mb-3 group" draggable="true" data-proyectoid="${d.id}">
            <div class="flex justify-between items-start mb-3">
              <span class="text-[8px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest">RENEW-${d.id.toUpperCase()} (COMPLETADO)</span>
              <div class="flex gap-2 items-center">
                ${d.tiene_problema 
                  ? `<span class="cursor-pointer flex items-center gap-1 bg-red-50 dark:bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-red-200 dark:border-red-500/20" onclick="event.stopPropagation(); window.showProblemModal('${d.id}')">
                      <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block"></span>
                      PROBLEMA
                    </span>`
                  : ''}
                <div class="w-2 h-2 rounded-full bg-teal-500"></div>
              </div>
            </div>
            
            <h4 class="text-gray-900 dark:text-white font-black text-sm mb-0.5 tracking-tighter limit-text-1 group-hover:text-tealAccent transition-colors">${cli.nombre}</h4>
            <div class="flex items-center gap-2 mb-3">
               <i class="fa-solid fa-check-circle text-[9px] text-teal-500"></i>
               <span class="text-[9px] text-teal-600 dark:text-teal-400 font-black uppercase tracking-tighter">Proyecto Finalizado</span>
            </div>

            <div class="flex items-center justify-between border-t border-teal-100 dark:border-white/5 pt-3">
              <div class="flex items-center gap-2.5">
                <div class="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center text-[9px] font-black text-teal-600 border border-teal-200 dark:border-teal-500/30">
                  ${resp.initials || 'UA'}
                </div>
                <div class="flex flex-col">
                   <span class="text-[8px] text-teal-600 dark:text-teal-400 font-black uppercase tracking-tighter">Account Owner</span>
                   <span class="text-[10px] text-teal-700 dark:text-teal-300 font-bold tracking-tight">${resp.nombre}</span>
                </div>
              </div>
              <div class="flex gap-3">
                <button class="btn-delete-kanban-project text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" data-id="${d.id}"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      completedColumnHtml = `
        <div class="kanban-col flex flex-col min-w-[260px] max-w-[260px] h-full" data-faseid="Completado">
          <div class="px-4 py-3 mb-4 bg-teal-50 dark:bg-teal-500/5 rounded-xl border border-teal-100 dark:border-teal-500/10 flex justify-between items-center shadow-sm dark:shadow-lg">
            <h3 class="text-[9px] font-black text-teal-700 dark:text-teal-400 uppercase tracking-[0.2em] truncate mr-2 flex items-center gap-1">
              <i class="fa-solid fa-flag-checkered"></i> FINALIZADOS
            </h3>
            <span class="bg-teal-500/10 text-teal-600 text-[9px] px-2 py-0.5 rounded-full font-black border border-teal-500/20 shrink-0">${completedDeals.length}</span>
          </div>
          <div class="kanban-drop-zone flex-1 overflow-y-auto pb-12 custom-h-scrollbar min-h-[500px]" data-faseid="Completado">
            ${cardsHtml}
          </div>
        </div>
      `;
    }

    UI.canvas.innerHTML = `
      <div class="flex gap-4 border-b border-gray-100 dark:border-white/5 mb-10 overflow-x-auto custom-h-scrollbar">
        ${tabsHtml}
      </div>
      <div class="scroll-container-kanban flex flex-nowrap gap-4 overflow-x-auto h-[calc(100vh-280px)] items-start pb-12 custom-h-scrollbar scroll-smooth" id="kanban-wrapper" style="width: 100%; max-width: 100%;">
        ${columnsHtml}
        ${completedColumnHtml}
      </div>
    `;

    // Arrows Logic for Kanban
    setTimeout(() => {
      const wrap = document.getElementById('kanban-wrapper');
      const l = document.getElementById('ctrl-scroll-left');
      const r = document.getElementById('ctrl-scroll-right');
      if (!wrap || !l || !r) return;

      // Always make arrows visible initially by using Tailwind classes
      l.classList.remove('hidden');
      r.classList.remove('hidden');

      let move;
      l.onmouseenter = () => { move = setInterval(() => { wrap.scrollLeft -= 15; updateArrows(); }, 16); };
      r.onmouseenter = () => { move = setInterval(() => { wrap.scrollLeft += 15; updateArrows(); }, 16); };
      [l, r].forEach(btn => btn.onmouseleave = () => clearInterval(move));
      function updateArrows() {
        const wrapDyn = document.getElementById('kanban-wrapper');
        if (!wrapDyn || !l || !r) return;
        const maxScroll = wrapDyn.scrollWidth - wrapDyn.clientWidth;
        
        const atStart = wrapDyn.scrollLeft <= 10;
        const atEnd = wrapDyn.scrollLeft >= maxScroll - 10;

        if (atStart) {
            l.classList.add('opacity-0', 'pointer-events-none');
            l.classList.remove('opacity-100', 'pointer-events-auto');
        } else {
            l.classList.remove('opacity-0', 'pointer-events-none');
            l.classList.add('opacity-100', 'pointer-events-auto');
        }

        if (atEnd) {
            r.classList.add('opacity-0', 'pointer-events-none');
            r.classList.remove('opacity-100', 'pointer-events-auto');
        } else {
            r.classList.remove('opacity-0', 'pointer-events-none');
            r.classList.add('opacity-100', 'pointer-events-auto');
        }
      }
      wrap.addEventListener('scroll', updateArrows);
      window.addEventListener('resize', updateArrows);
      
      // Robust observation
      if (window._kanbanArrowInterval) clearInterval(window._kanbanArrowInterval);
      window._kanbanArrowInterval = setInterval(updateArrows, 500);
      updateArrows();
    }, 200);

    // ââ‚¬ââ‚¬ââ‚¬ Kanban Project Drawer ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
    renderView._openKanbanDrawer = openKanbanDrawer;
  }
  else if (state.activeView === 'rendimiento-global') {
    UI.viewTitle.textContent = "Rendimiento Global";
    UI.viewDesc.textContent = "Monitorea el progreso de todo el equipo de ventas en tiempo real.";
    setGlobalButton(false);
    renderRendimientoGlobal();
  }
  else if (state.activeView === 'marketing') {
    UI.viewTitle.textContent = "Intelligence: Email Engine";
    UI.viewDesc.textContent = "Deploy automated email sequences synchronized with CRM signals.";
    setGlobalButton(false);
    
    UI.canvas.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-6 animate-fadeIn">
        <div class="flex items-center justify-between bg-white dark:bg-darkCard p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
          <div class="flex items-center gap-5">
            <div class="w-12 h-12 rounded-2xl bg-tealAccent/5 flex items-center justify-center text-tealAccent border border-tealAccent/10">
              <i class="fa-solid fa-microchip text-2xl"></i>
            </div>
            <div>
              <p class="aqua-label mb-1 uppercase text-[9px]">Target Engine Segment</p>
              <select id="mk-audiencia" class="bg-transparent border-none text-xl font-black text-gray-900 dark:text-white p-0 focus:ring-0 cursor-pointer hover:text-tealAccent transition-colors">
                <option value="Todos" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Global Network</option>
                <option value="Solar" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Renew Solar Leads</option>
                <option value="Water" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Renew Water Leads</option>
                <option value="clientes_especificos" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Manual Selection</option>
                <option value="todos_trabajadores" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Internal Team</option>
                <option value="trabajadores_especificos" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Collaborator Selection</option>
              </select>
            </div>
          </div>
          <div class="text-right">
             <div class="px-4 py-2 bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-gray-500 text-[10px] font-black rounded-xl border border-gray-100 dark:border-white/10 uppercase tracking-[0.2em]">Engine Status: Standby</div>
          </div>
        </div>

        <div id="mk-seleccion-especifica" class="hidden mt-[-2.5rem] p-8 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-3xl shadow-inner max-h-80 overflow-y-auto animate-slideDown hide-scrollbar"></div>

        <div id="mk-secuencia-container" class="space-y-4">
          ${crearPasoMarketingHTML(1)}
        </div>

        <div class="flex gap-4 pt-6">
           <button id="btn-add-paso" class="flex-1 py-4 bg-gray-50 dark:bg-white/5 hover:bg-tealAccent/10 text-gray-400 dark:text-gray-600 hover:text-tealAccent rounded-2xl transition-all font-black uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-3 border border-gray-100 dark:border-white/5">
             <i class="fa-solid fa-plus-circle text-lg"></i> Add Sequence Step
           </button>
           <button id="btn-enviar-campana" class="px-10 py-4 bg-tealAccent text-black rounded-2xl transition-all font-black uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-3 shadow-sm hover:shadow-teal-glow hover:scale-[1.02] active:scale-95">
             <i class="fa-solid fa-bolt-lightning text-lg"></i> Ignite Engine
           </button>
        </div>
      </div>
    `;
  }
  else if (state.activeView === 'whatsapp') {
    UI.viewTitle.textContent = "Intelligence: WA Reactor";
    UI.viewDesc.textContent = "Autonomous WhatsApp automation protocols for direct device infiltration.";
    setGlobalButton(false);
    
    UI.canvas.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-6 animate-fadeIn">
        <div class="flex items-center justify-between bg-white dark:bg-darkCard p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
          <div class="flex items-center gap-5">
            <div class="w-12 h-12 rounded-2xl bg-green-500/5 flex items-center justify-center text-green-400 border border-green-500/10">
              <i class="fa-brands fa-whatsapp text-2xl"></i>
            </div>
            <div>
              <p class="aqua-label mb-1 uppercase text-[9px]">WA Protocol Segment</p>
              <select id="wa-audiencia" class="bg-transparent border-none text-xl font-black text-gray-900 dark:text-white p-0 focus:ring-0 cursor-pointer hover:text-green-400 transition-colors">
                <option value="Todos" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Global Network</option>
                <option value="Solar" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Renew Solar Leads</option>
                <option value="Water" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Renew Water Leads</option>
                <option value="clientes_especificos" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Manual Selection</option>
                <option value="todos_trabajadores" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Internal Team</option>
                <option value="trabajadores_especificos" class="bg-white dark:bg-darkCard text-gray-900 dark:text-white">Collaborator Selection</option>
              </select>
            </div>
          </div>
          <div class="text-right">
             <div class="px-4 py-2 bg-gray-50 dark:bg-white/5 text-green-500/60 text-[10px] font-black rounded-xl border border-gray-200 dark:border-white/10 uppercase tracking-[0.2em]">Reactor Active</div>
          </div>
        </div>

        <div id="wa-seleccion-especifica" class="hidden mt-[-2.5rem] p-8 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-3xl shadow-inner max-h-80 overflow-y-auto animate-slideDown hide-scrollbar"></div>

        <div id="wa-secuencia-container" class="space-y-4">
          ${crearPasoWhatsAppHTML(1)}
        </div>

        <div class="flex gap-4 pt-6">
           <button id="btn-add-wa-paso" class="flex-1 py-4 bg-gray-50 dark:bg-white/5 hover:bg-green-500/10 text-gray-400 dark:text-gray-600 hover:text-green-500 rounded-2xl transition-all font-black uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-3 border border-gray-100 dark:border-white/5">
             <i class="fa-solid fa-plus-circle text-lg"></i> Append Automation
           </button>
           <button id="btn-enviar-wa-campana" class="px-10 py-4 bg-green-500 text-black rounded-2xl transition-all font-black uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-3 shadow-sm hover:shadow-green-500/30 hover:scale-[1.02] active:scale-95">
             <i class="fa-solid fa-satellite-dish text-lg"></i> Broadcast Signal
           </button>
        </div>
      </div>
    `;
  }
  else if (state.activeView === 'academia') {
    UI.viewTitle.textContent = "Gestor Academia";
    UI.viewDesc.textContent = "Sube y administra el contenido de formación y biblioteca virtual.";
    setGlobalButton(false);
    
    const dbLocal = getDB();
    const academiaContent = dbLocal.academiaContent || [];
    
    let finalPips = (state.pipelines || []).map(p => p.nombre);

    const pipsOptionsHtml = finalPips.map(pipName => `
      <label class="flex items-center gap-2 p-3 rounded-xl border border-gray-100 dark:border-white/5 cursor-pointer hover:border-tealAccent/30 hover:bg-tealAccent/5 transition-all group">
        <input type="checkbox" class="aca-pip-chk w-4 h-4 rounded border-gray-300 dark:border-white/10 accent-tealAccent" value="${pipName}">
        <span class="text-[11px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-tighter group-hover:text-tealAccent transition-colors">${pipName}</span>
      </label>
    `).join('');

    const contentListHtml = academiaContent.map((item, idx) => `
       <div class="p-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl mb-3 flex justify-between items-center hover:border-tealAccent/40 transition-all">
         <div>
            <h4 class="font-bold text-gray-800 dark:text-white text-sm mb-1">${item.titulo}</h4>
            <div class="flex items-center gap-2 text-[10px] text-gray-500 mb-2 font-bold uppercase tracking-widest">
               <i class="fa-solid ${(item.tipo || '').includes('Video') ? 'fa-play' : 'fa-file'}"></i> ${(item.tipo || '').replace('Información', 'Información')}
            </div>
            <div class="flex flex-wrap gap-1">${item.permisos.map(p => `<span class="bg-tealAccent/10 text-tealAccent text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-tealAccent/20">${p}</span>`).join('')}</div>
         </div>
         <div class="flex items-center gap-2">
            <button class="text-tealAccent/50 hover:text-tealAccent hover:bg-tealAccent/10 p-2.5 rounded-lg transition-all" onclick="window.adminEditAcademia('${item.id}')" title="Editar"><i class="fa-solid fa-pencil"></i></button>
            <button class="text-red-500/50 hover:text-red-500 hover:bg-red-500/10 p-2.5 rounded-lg transition-all" onclick="window.adminDeleteAcademia('${item.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
         </div>
       </div>
    `).join('');

    UI.canvas.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto animate-fadeIn">
         <!-- FORM -->
         <div class="bg-white dark:bg-darkCard p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
            <div class="flex justify-between items-center mb-6">
               <h3 class="text-xl font-black text-gray-900 dark:text-white tracking-tighter">${t('aca_add_title')}</h3>
               <div class="w-10 h-10 rounded-2xl bg-tealAccent/10 flex items-center justify-center text-tealAccent">
                  <i class="fa-solid fa-cloud-arrow-up"></i>
               </div>
            </div>
            
            <label class="aqua-label">${t('aca_field_title')}</label>
            <input type="text" id="aca-titulo" class="w-full bg-bgLight dark:bg-bgDark transition-colors border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-gray-800 dark:text-white mb-4 focus:border-tealAccent focus:outline-none" placeholder="...">
            
            <label class="aqua-label">${t('aca_field_type')}</label>
            <select id="aca-tipo" class="w-full bg-bgLight dark:bg-bgDark transition-colors border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-gray-800 dark:text-white mb-4 focus:border-tealAccent focus:outline-none">
               <option value="Video de Entrenamiento">${t('aca_type_video')}</option>
               <option value="Documento/PDF">${t('aca_type_doc')}</option>
               <option value="Información Bancaria">${t('aca_type_bank')}</option>
               <option value="Detalles de equipo">${t('aca_type_equipment')}</option>
               <option value="FAQ">${t('aca_type_faq')}</option>
            </select>

            <label class="aqua-label">${t('aca_field_file')}</label>
            <input type="file" id="aca-file" class="w-full bg-bgLight dark:bg-bgDark transition-colors border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-gray-800 dark:text-white mb-4 focus:border-tealAccent focus:outline-none" accept=".mp4,.pdf,.doc,.docx">

            <div id="aca-thumb-wrap" class="mt-4 mb-4" style="display:none;">
              <label class="aqua-label">${t('aca_upload_label')}</label>
              <input type="file" id="archivoMiniatura" class="w-full bg-bgLight dark:bg-bgDark transition-colors border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-gray-800 dark:text-white mb-6 focus:border-tealAccent focus:outline-none" accept="image/jpeg, image/png, image/webp">
            </div>

            <label class="aqua-label">${t('aca_field_vis')}</label>
            <p class="text-[10px] text-gray-400 mb-3 ml-1">Selecciona qué unidades pueden ver este recurso en la app móvil.</p>
            <div class="grid grid-cols-2 gap-3 mb-8">
               ${pipsOptionsHtml}
            </div>

            <!-- Barra de progreso -->
            <div id="aca-upload-progress" class="hidden mb-4">
              <div class="flex items-center justify-between mb-1">
                <span id="aca-upload-progress-text" class="text-xs font-bold text-tealAccent">Iniciando...</span>
                <span class="text-xs text-gray-400">No cierres esta pagina</span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2.5">
                <div id="aca-upload-progress-fill" class="bg-tealAccent h-2.5 rounded-full transition-all" style="width:0%"></div>
              </div>
            </div>
            <div class="flex gap-3">
               <button id="btn-save-academia" class="flex-1 btn-premium py-4 rounded-xl text-xs tracking-widest font-black uppercase">
                  <i class="fa-solid fa-save"></i> ${t('aca_btn_save')}
               </button>
               <button id="aca-cancel-edit" class="hidden px-6 py-4 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 font-black text-xs uppercase tracking-widest rounded-xl transition-colors">
                  ${t('aca_btn_cancel')}
               </button>
            </div>
         </div>
         
         <!-- LIST -->
         <div class="bg-white dark:bg-darkCard p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
            <div class="flex justify-between items-center mb-6">
               <h3 class="text-xl font-black text-gray-900 dark:text-white tracking-tighter">Biblioteca Activa</h3>
               <span class="bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full text-xs font-bold text-gray-500">${academiaContent.length} items</span>
            </div>
            <div class="overflow-y-auto max-h-[600px] hide-scrollbar custom-scrollbar pr-2">
              ${contentListHtml.length ? contentListHtml : '<div class="text-center py-10 opacity-50"><i class="fa-solid fa-box-open text-4xl mb-3"></i><p class="text-xs font-bold uppercase tracking-widest">Base de datos vacía</p></div>'}
            </div>
         </div>
      </div>
    `;

    const saveAcademiaBtn = document.getElementById('btn-save-academia');
    if (saveAcademiaBtn) {
      saveAcademiaBtn.addEventListener('click', async () => {
       const btnSave = document.getElementById('btn-save-academia');
       const originalHtml = btnSave.innerHTML;
       const editId = btnSave.dataset.editId;
       
       const titulo = document.getElementById('aca-titulo').value.trim();
       const tipo = document.getElementById('aca-tipo').value;
       const fileInput = document.getElementById('aca-file');
       const miniaturaInput = document.getElementById('archivoMiniatura');
       const file = fileInput.files[0];
       const miniaturaFile = miniaturaInput ? miniaturaInput.files[0] : null;
       const permisos = Array.from(document.querySelectorAll('.aca-pip-chk:checked')).map(cb => cb.value);

       if(!titulo || (!file && !editId)) {
          window.addNotification('Gestor Academia', editId ? 'El título es obligatorio' : 'El título y el archivo adjunto son obligatorios', 'error');
          return;
       }
       if(permisos.length === 0) {
          window.addNotification('Gestor Academia', 'Selecciona al menos un ecosistema autorizado', 'error');
          return;
       }

       btnSave.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
       btnSave.disabled = true;

       // Barra de progreso en vivo para uploads de video
       let progressBar = document.getElementById('aca-upload-progress');
       let progressFill = document.getElementById('aca-upload-progress-fill');
       let progressText = document.getElementById('aca-upload-progress-text');
       if (progressBar) progressBar.classList.remove('hidden');

       const onProgress = (pct, msg) => {
           if (progressFill) progressFill.style.width = `${pct}%`;
           if (progressText) progressText.textContent = msg;
           btnSave.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${pct}% - ${msg}`;
       };

       try {
           let videoUrl = null;
           let miniaturaUrl = null;

           if(file || miniaturaFile) {
               try {
                   const data = await uploadAcademia(file, miniaturaFile, onProgress);
                   if(data.videoUrl) videoUrl = data.videoUrl;
                   if(data.miniaturaUrl) miniaturaUrl = data.miniaturaUrl;
               } catch (err) {
                   console.error('Upload Error:', err);
                   throw new Error('Error al subir el archivo: ' + (err.message || 'Verifica tu conexión y vuelve a intentarlo.'));

               }
           }

           const db = getDB();
           if(!db.academiaContent) db.academiaContent = [];
           
           if(editId) {
               const item = db.academiaContent.find(i => i.id === editId);
               if(item) {
                   item.titulo = titulo;
                   item.tipo = tipo;
                   item.permisos = permisos;
                   if(videoUrl) item.enlace = videoUrl;
                   if(miniaturaUrl) item.miniaturaUrl = miniaturaUrl;
               }
           } else {
               db.academiaContent.push({
                   id: 'req_' + Date.now().toString(36),
                   titulo, 
                   tipo, 
                   enlace: videoUrl, 
                   miniaturaUrl: miniaturaUrl,
                   permisos,
                   fecha_creacion: new Date().toISOString()
               });
           }
           
           await saveDB(db);

           document.getElementById('aca-titulo').value = '';
           fileInput.value = '';
           if(miniaturaInput) miniaturaInput.value = '';
           document.querySelectorAll('.aca-pip-chk').forEach(chk => chk.checked = false);
           delete btnSave.dataset.editId;
           document.getElementById('aca-cancel-edit').classList.add('hidden');
           btnSave.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Material';
           btnSave.disabled = false;
           if (progressBar) { progressBar.classList.add('hidden'); if(progressFill) progressFill.style.width = '0%'; }

           await renderView();
           window.addNotification('Gestor Academia', editId ? 'Material actualizado exitosamente' : 'Material publicado exitosamente', 'success');
       } catch (err) {
           console.error('Upload Error:', err);
           window.addNotification('Gestor Academia', 'Error en guardado: ' + err.message, 'error');
           btnSave.innerHTML = originalHtml;
           btnSave.disabled = false;
           if (progressBar) { progressBar.classList.add('hidden'); if(progressFill) progressFill.style.width = '0%'; }
       }
    });

    document.getElementById('aca-cancel-edit').addEventListener('click', () => {
       document.getElementById('aca-titulo').value = '';
       document.getElementById('aca-file').value = '';
       const minInput = document.getElementById('archivoMiniatura');
       if(minInput) minInput.value = '';
       document.querySelectorAll('.aca-pip-chk').forEach(c => c.checked = false);

       const btnSave = document.getElementById('btn-save-academia');
       btnSave.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Material';
       delete btnSave.dataset.editId;
       document.getElementById('aca-cancel-edit').classList.add('hidden');
       
       const thumbWrap = document.getElementById('aca-thumb-wrap');
       const acaTipoVal = document.getElementById('aca-tipo');
       if(thumbWrap) thumbWrap.style.display = (acaTipoVal && acaTipoVal.value === 'Video de Entrenamiento') ? 'block' : 'none';
    });

    // Al cambiar el tipo de contenido, ocultamos o mostramos el campo de miniatura
    const acaTipoSelect = document.getElementById('aca-tipo');
    const thumbWrapCont = document.getElementById('aca-thumb-wrap');
    if(acaTipoSelect && thumbWrapCont) {
       // Mostrar/ocultar al cargar según valor inicial
       thumbWrapCont.style.display = (acaTipoSelect.value === 'Video de Entrenamiento') ? 'block' : 'none';
        acaTipoSelect.addEventListener('change', () => {
          thumbWrapCont.style.display = (acaTipoSelect.value === 'Video de Entrenamiento') ? 'block' : 'none';
        });
     }
    } // Closing if (saveAcademiaBtn)

  }
  else if (state.activeView === 'inventario') {
    const ecoFilter = state.activeEcoFilter || 'solar';
    UI.viewTitle.textContent = `${t('inv_title').toUpperCase()} - RENEW ${ecoFilter.toUpperCase()}`;
    UI.viewDesc.textContent = t('inv_desc');
    setGlobalButton(true, `<i class="fa-solid fa-plus text-sm"></i> ${t('inv_btn_add')}`);
    
    const activeInventorySede = state.activeInventorySede;
    const activeInventoryLine = state.activeInventoryLine || 'all';
    const invData = getInventario();

    // 1. First filter by Warehouse (Sede) and Ecosystem (Solar/Water/Home)
    const baseItems = invData.filter(i => {
        const matchesSede = i.locacion === activeInventorySede;
        if (!state.activeEcoFilter) return matchesSede;
        
        const itemCat = i.category || '';
        const itemLine = i.ecosistema || '';
        const filter = state.activeEcoFilter.toLowerCase();
        
        return matchesSede && (itemCat.toLowerCase() === filter || itemLine.toLowerCase().includes(filter));
    });

    // 2. Extract unique lines available in this filtered set
    const uniqueLines = [...new Set(baseItems.map(i => i.ecosistema).filter(Boolean))].sort();

    // 3. Apply the specific Line filter
    const items = baseItems.filter(i => {
        if (activeInventoryLine === 'all') return true;
        return i.ecosistema === activeInventoryLine;
    });
    
    const rowsHtml = items.map(ite => {
        const lineBadge = ite.ecosistema === 'solar' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
                         ite.ecosistema === 'water' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                         'bg-purple-500/10 text-purple-500 border-purple-500/20';

        return `
            <tr class="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                <td class="px-6 py-4 whitespace-nowrap text-[10px] text-gray-500 font-bold uppercase tracking-tight">${ite.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-900 dark:text-white uppercase">${ite.nombreItem}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                   <span class="px-2 py-0.5 ${lineBadge} text-[8px] font-black uppercase tracking-widest rounded border">${ite.ecosistema}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex flex-col gap-0.5">
                        <span class="text-[9px] text-gray-400 font-bold">M: ${ite.medida || '-'}</span>
                        <span class="text-[9px] text-gray-400 font-bold">B: ${ite.boton || '-'}</span>
                        <span class="text-[9px] text-gray-400 font-bold">C: ${ite.color || '-'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-[10px] font-black text-gray-400 uppercase tracking-widest">${ite.storage || ite.locacion}</td>
                <td class="px-6 py-4 whitespace-nowrap text-xs font-black text-tealAccent">${ite.stockActual}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                   <div class="flex items-center gap-3">
                       <button onclick="window.addStock('${ite.id}')" class="w-8 h-8 rounded-lg bg-tealAccent/5 text-tealAccent hover:bg-tealAccent hover:text-black transition-all flex items-center justify-center" title="Suma Rápida de Stock">
                           <i class="fa-solid fa-plus text-[10px]" style="pointer-events: none;"></i>
                       </button>
                       <button onclick="window.subtractStock('${ite.id}')" class="w-8 h-8 rounded-lg bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center" title="Restar Stock">
                           <i class="fa-solid fa-minus text-[10px]" style="pointer-events: none;"></i>
                       </button>
                       <button onclick="window.editStock('${ite.id}')" class="w-8 h-8 rounded-lg bg-[#3b82f6]/5 text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white transition-all flex items-center justify-center" title="Editar Todo">
                           <i class="fa-solid fa-pen-to-square text-[10px]" style="pointer-events: none;"></i>
                       </button>
                       <button onclick="window.deleteItem('${ite.id}')" class="w-8 h-8 rounded-lg bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center" title="Eliminar">
                           <i class="fa-solid fa-trash text-[10px]" style="pointer-events: none;"></i>
                       </button>
                   </div>
                </td>
            </tr>
        `;
    }).join('');

    const historialData = getHistorialInventario();

    // Filter historial by the current sede and current ecosystem
    const ecoFilterLower = ecoFilter.toLowerCase();
    const historialFiltered = historialData.filter(h => 
      h.sede === activeInventorySede && 
      (h.ecosistema || '').toLowerCase() === ecoFilterLower
    );

    // Grouping logic: Group by client ONLY if a valid client name exists.
    // Otherwise, show as individual rows.
    const finalHistoryItems = [];
    const groupingTemp = {};

    historialFiltered.forEach(h => {
        const client = (h.cliente_nombre || '').trim().toUpperCase();
        const isUngroupable = !client || client === '-' || client === 'SIN PROYECTO';

        if (isUngroupable) {
            finalHistoryItems.push({
                isGroup: false,
                cliente: h.cliente_nombre || 'SIN PROYECTO',
                tecnico: h.tecnico_nombre,
                fecha: h.fecha,
                item_nombre: h.item_nombre,
                cantidad: h.cantidad_retirada,
                sede: h.sede
            });
        } else {
            if (!groupingTemp[client]) {
                groupingTemp[client] = {
                    isGroup: true,
                    cliente: h.cliente_nombre,
                    tecnico: h.tecnico_nombre,
                    ultima_fecha: h.fecha,
                    sede: h.sede,
                    items: []
                };
            }
            groupingTemp[client].items.push({
                nombre: h.item_nombre,
                cantidad: h.cantidad_retirada,
                fecha: h.fecha
            });
            if (new Date(h.fecha) > new Date(groupingTemp[client].ultima_fecha)) {
                groupingTemp[client].ultima_fecha = h.fecha;
                groupingTemp[client].tecnico = h.tecnico_nombre;
            }
        }
    });

    Object.values(groupingTemp).forEach(g => finalHistoryItems.push(g));

    // Sort all by date
    finalHistoryItems.sort((a,b) => {
        const dateA = a.isGroup ? a.ultima_fecha : a.fecha;
        const dateB = b.isGroup ? b.ultima_fecha : b.fecha;
        return new Date(dateB) - new Date(dateA);
    });

    const historialRowsHtml = finalHistoryItems.length
      ? finalHistoryItems.map(g => {
          const rawDate = g.isGroup ? g.ultima_fecha : g.fecha;
          const dateStr = rawDate ? new Date(rawDate).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          }) : '-';
          const sedeLabel = (g.sede || '').charAt(0).toUpperCase() + (g.sede || '').slice(1);
          
          if (g.isGroup) {
              if (!window._inv_grouped_data) window._inv_grouped_data = {};
              window._inv_grouped_data[g.cliente] = g.items;

              return `
                <tr class="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                  <td class="px-6 py-3 whitespace-nowrap text-[10px] text-gray-400 font-medium">${dateStr}</td>
                  <td class="px-6 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <div class="w-6 h-6 rounded-full bg-tealAccent/10 flex items-center justify-center">
                        <i class="fa-solid fa-screwdriver-wrench text-tealAccent text-[8px]"></i>
                      </div>
                      <span class="text-xs font-bold text-gray-800 dark:text-white">${g.tecnico || 'Desconocido'}</span>
                    </div>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap text-[10px] font-black text-[#3b82f6] uppercase tracking-wider">${g.cliente}</td>
                  <td class="px-6 py-3 whitespace-nowrap" colspan="2">
                    <button onclick="window.showInvHistoryDetails('${g.cliente.replace(/'/g, "\\'")}')" class="px-4 py-1.5 bg-tealAccent/10 text-tealAccent border border-tealAccent/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tealAccent hover:text-black transition-all">
                       <i class="fa-solid fa-list-ul mr-1"></i> Ver Detalles (${g.items.length})
                    </button>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap">
                    <span class="uppercase text-[8px] font-black tracking-widest text-gray-400 dark:text-gray-600">${sedeLabel}</span>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap text-right">
                    <button onclick="window.deleteInventarioHistorialItem('${g.ultima_fecha || g.fecha}')" class="w-7 h-7 rounded-lg bg-red-500/0 text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100" title="Borrar registro">
                      <i class="fa-solid fa-trash text-[10px]"></i>
                    </button>
                  </td>
                </tr>
              `;
          } else {
              // Ungrouped row (Individual)
              return `
                <tr class="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                  <td class="px-6 py-3 whitespace-nowrap text-[10px] text-gray-400 font-medium">${dateStr}</td>
                  <td class="px-6 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <div class="w-6 h-6 rounded-full bg-tealAccent/10 flex items-center justify-center">
                        <i class="fa-solid fa-screwdriver-wrench text-tealAccent text-[8px]"></i>
                      </div>
                      <span class="text-xs font-bold text-gray-800 dark:text-white">${g.tecnico || 'Desconocido'}</span>
                    </div>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap text-[10px] font-black text-gray-400 uppercase tracking-wider italic">${g.cliente}</td>
                  <td class="px-6 py-3 whitespace-nowrap text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">${g.item_nombre}</td>
                  <td class="px-6 py-3 whitespace-nowrap">
                    <span class="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5 text-[10px] font-black">
                      <i class="fa-solid fa-minus text-[8px]"></i> ${g.cantidad}
                    </span>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap">
                    <span class="uppercase text-[8px] font-black tracking-widest text-gray-400 dark:text-gray-600">${sedeLabel}</span>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap text-right">
                    <button onclick="window.deleteInventarioHistorialItem('${g.fecha}')" class="w-7 h-7 rounded-lg bg-red-500/0 text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100" title="Borrar registro">
                      <i class="fa-solid fa-trash text-[10px]"></i>
                    </button>
                  </td>
                </tr>
              `;
          }
        }).join('')
      : `<tr><td colspan="5" class="py-16 text-center">
           <i class="fa-solid fa-clock-rotate-left text-4xl text-gray-200 dark:text-white/5 mb-3 block"></i>
           <span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">${t('inv_no_history')}</span>
         </td></tr>`;

    UI.canvas.innerHTML = `
      <div class="max-w-6xl mx-auto animate-fadeIn">
        <div class="mb-4 flex flex-wrap gap-4">
           <button class="inv-sede-tab ${activeInventorySede === 'orlando' ? 'btn-premium' : 'btn-secondary-premium'} text-xs px-6 py-3 rounded-2xl shadow-sm" data-sede="orlando">Sede Orlando</button>
           <button class="inv-sede-tab ${activeInventorySede === 'miami' ? 'btn-premium' : 'btn-secondary-premium'} text-xs px-6 py-3 rounded-2xl shadow-sm" data-sede="miami">Sede Miami</button>
           <button class="inv-sede-tab ${activeInventorySede === 'dallas' ? 'btn-premium' : 'btn-secondary-premium'} text-xs px-6 py-3 rounded-2xl shadow-sm" data-sede="dallas">Sede Dallas</button>
           <button class="inv-sede-tab ${activeInventorySede === 'new_york' ? 'btn-premium' : 'btn-secondary-premium'} text-xs px-6 py-3 rounded-2xl shadow-sm" data-sede="new_york">Sede Nueva York</button>
        </div>

        <!-- NEW: Line Filters -->
        <div class="mb-8 flex flex-wrap gap-2 animate-fadeInSlow">
           <button class="inv-line-tab ${activeInventoryLine === 'all' ? 'bg-tealAccent text-black shadow-teal-glow' : 'bg-gray-100 dark:bg-white/5 text-gray-400'} text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all border border-transparent hover:border-tealAccent/30" data-line="all">Todos</button>
           ${uniqueLines.map(line => `
             <button class="inv-line-tab ${activeInventoryLine === line ? 'bg-tealAccent text-black shadow-teal-glow' : 'bg-gray-100 dark:bg-white/5 text-gray-400'} text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all border border-transparent hover:border-tealAccent/30" data-line="${line}">${line}</button>
           `).join('')}
        </div>

        <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden overflow-x-auto hide-scrollbar">
            <table class="w-full text-xs">
                <thead class="bg-gray-50/50 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
                    <tr>
                        <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_code')}</th>
                        <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_prod')}</th>
                        <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_line')}</th>
                        <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">ESPECIFICACIONES</th>
                        <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_storage')}</th>
                        <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_stock')}</th>
                        <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_actions')}</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                    ${rowsHtml.length ? rowsHtml : `<tr><td colspan="7" class="py-24 text-center"><i class="fa-solid fa-parachute-box text-5xl text-gray-200 dark:text-white/5 mb-4 block"></i><span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">${t('inv_empty')}</span></td></tr>`}
                </tbody>
            </table>
        </div>

        <!-- ââ‚¬ââ‚¬ Historial de Movimientos ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ -->
        <div class="mt-8">
          <div class="p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <i class="fa-solid fa-clock-rotate-left text-orange-400"></i>
                  ${t('inv_history_title')}
                </h2>
                <button id="btn-clear-historial" onclick="window.clearInventarioHistorial && window.clearInventarioHistorial()" class="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                  <i class="fa-solid fa-trash-can"></i> Borrar Historial
                </button>
              </div>
            </div>

          <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden overflow-x-auto hide-scrollbar">
            <table class="w-full text-xs">
              <thead class="bg-gray-50/50 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
                <tr>
                  <th class="px-6 py-4 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_date')}</th>
                  <th class="px-6 py-4 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_tech')}</th>
                  <th class="px-6 py-4 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">PROYECTO</th>
                  <th class="px-6 py-4 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_item')}</th>
                  <th class="px-6 py-4 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_qty')}</th>
                  <th class="px-6 py-4 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">${t('inv_col_sede')}</th>
                  <th class="px-6 py-4 text-right text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                ${historialRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
        <!-- ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ -->

      </div>
    `;

  }
  else if (state.activeView === 'anuncios') {
    UI.viewTitle.textContent = "GESTOR DE ANUNCIOS GLOBALES";
    UI.viewDesc.textContent = "Publica comunicados para la aplicación móvil y rastrea su lectura.";
    setGlobalButton(false);
    
    const annTabsHtml = `
      <div class="flex gap-4 mb-8">
        <button class="ann-sub-tab px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${state.activeAnnTab === 'comunicados' ? 'bg-tealAccent text-black shadow-teal-glow' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-tealAccent'}" data-tab="comunicados">
          <i class="fa-solid fa-bullhorn mr-2"></i> Comunicados
        </button>
        <button class="ann-sub-tab px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${state.activeAnnTab === 'llamadas' ? 'bg-blue-500 text-white shadow-blue-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-blue-400'}" data-tab="llamadas">
          <i class="fa-solid fa-video mr-2"></i> Coordinar Llamadas
        </button>
      </div>
    `;

    if (state.activeAnnTab === 'comunicados') {
        // --- COMUNICADOS LOGIC ---
        if (!db.anuncios_corporativos) db.anuncios_corporativos = [];
        window._cachedAnunciosWorkers = await getAdminWorkers();
        const dynPipelines = db.Admin_Pipelines || [];
        const sortedAnuncios = [...db.anuncios_corporativos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
        
        
        const anunciosHtml = sortedAnuncios.map(an => {
          const getTagBadge = (tag) => {
              if (tag === 'todos') return 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400';
              const roles = ['Vendedor', 'Técnico', 'Admin', 'Call Center', 'Project Manager', 'Supervisión', 'CEO'];
              if (roles.includes(tag)) return 'bg-sky-500/10 text-sky-500 border border-sky-500/20';
              return 'bg-tealAccent/10 text-tealAccent border border-tealAccent/20';
          };
          const totalLecturas = an.estado_lecturas ? an.estado_lecturas.filter(el => el.leido).length : 0;
          return `
            <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm hover:border-tealAccent/30 transition-all cursor-pointer mb-5 relative group min-h-[140px] flex flex-col justify-between" onclick="mostrarReporteAnuncio('${an.id}')">
               <button onclick="event.stopPropagation(); window.deleteAnuncio('${an.id}', this)" class="absolute top-4 right-4 w-9 h-9 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all hover:bg-red-500 hover:text-white z-20">
                  <i class="fa-solid fa-trash-can text-sm"></i>
               </button>
               <div class="flex-1">
                 <div class="flex justify-between items-start mb-3 pr-10">
                   <h4 class="text-sm font-black text-gray-900 dark:text-white line-clamp-1">${an.titulo}</h4>
                   <div class="flex flex-wrap gap-1 justify-end">
                     ${(an.audiencia_tags || [an.audiencia]).map(tag => {
                        const displayTag = tag === 'todos' ? 'Renew Group' : tag;
                        return `<span class="px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${getTagBadge(tag)} whitespace-nowrap">${displayTag}</span>`;
                     }).join('')}
                   </div>
                 </div>
                 ${an.foto_url ? `<img src="${an.foto_url}" class="w-full h-32 object-cover rounded-xl mb-3 border border-gray-100 dark:border-white/5">` : ''}
                 <p class="text-[12px] leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-3 mb-4">${an.mensaje}</p>
               </div>
               <div class="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 tracking-wider pt-4 border-t border-gray-50 dark:border-white/5 mt-auto">
                 <span><i class="fa-solid fa-calendar mr-1"></i> ${new Date(an.fecha).toLocaleDateString('en-US')}</span>
                 <span class="text-tealAccent bg-tealAccent/10 px-3 py-1.5 rounded-full"><i class="fa-solid fa-eye mr-1"></i> ${totalLecturas} Vistos</span>
               </div>
            </div>
          `;
        }).join('');

        UI.canvas.innerHTML = `
          ${annTabsHtml}
          <div class="flex gap-8 min-h-full pb-20 animate-fadeIn">
            <div class="w-1/3 bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col h-fit">
              <div class="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-white/5">
                <div class="w-10 h-10 rounded-full bg-tealAccent/10 flex items-center justify-center text-tealAccent"><i class="fa-solid fa-bullhorn text-lg"></i></div>
                <div>
                  <h3 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Nuevo Comunicado</h3>
                  <p class="text-[9px] text-gray-400 font-bold tracking-widest uppercase">Envío Inmediato</p>
                </div>
              </div>
              <div class="space-y-4 flex-1">
                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Título del Anuncio</label>
                    <input type="text" id="ann-input-title" placeholder="..." class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-tealAccent outline-none text-gray-900 dark:text-white">
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Audiencia (Selección Múltiple)</label>
                    <div class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 max-h-48 overflow-y-auto space-y-3 hide-scrollbar">
                        <label class="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" id="aud-all" class="aud-check w-4 h-4 rounded border-gray-300 text-tealAccent focus:ring-tealAccent" value="todos">
                            <span class="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest group-hover:text-tealAccent transition-colors">Renew Group</span>
                        </label>
                        <div class="pt-2 border-t border-gray-100 dark:border-white/5">
                            <p class="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Por Pipelines</p>
                            <div class="grid grid-cols-1 gap-2">
                                ${dynPipelines.map(p => `
                                    <label class="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" class="aud-check aud-pipe w-3.5 h-3.5 rounded border-gray-300 text-tealAccent focus:ring-tealAccent" value="${p.nombre}">
                                        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-tealAccent transition-colors">${p.nombre}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <div class="pt-2 border-t border-gray-100 dark:border-white/5">
                            <p class="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Por Roles / Cargos</p>
                            <div class="grid grid-cols-1 gap-2">
                                ${['Vendedor', 'Técnico', 'Admin', 'Call Center', 'Project Manager', 'Supervisión', 'CEO'].map(r => `
                                    <label class="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" class="aud-check aud-role w-3.5 h-3.5 rounded border-gray-300 text-sky-500 focus:ring-sky-500" value="${r}">
                                        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-sky-500 transition-colors">${r}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <div class="pt-2 border-t border-gray-100 dark:border-white/5">
                            <p class="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Por Trabajadores</p>
                            <div class="grid grid-cols-1 gap-2">
                                ${(window._cachedAnunciosWorkers || []).map(w => `
                                    <label class="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" class="aud-check aud-worker w-3.5 h-3.5 rounded border-gray-300 text-tealAccent focus:ring-tealAccent" value="user_${w.id}">
                                        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-tealAccent transition-colors">${w.nombre} ${w.apellido || ''}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mensaje del Anuncio</label>
                    <textarea id="ann-input-msg" rows="3" placeholder="..." class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-tealAccent outline-none resize-none text-gray-900 dark:text-white"></textarea>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Imagen Adjunta (Opcional)</label>
                    <div id="drop-ann-foto" class="w-full h-24 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-tealAccent transition-all bg-gray-50 dark:bg-black/20 group relative overflow-hidden">
                        <input type="file" id="inp-ann-foto-file" class="hidden" accept="image/*">
                        <div id="ann-foto-placeholder" class="text-center">
                            <i class="fa-solid fa-image text-gray-300 group-hover:text-tealAccent transition-colors text-xl"></i>
                            <p class="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Arrastra o haz clic</p>
                        </div>
                        <img id="preview-ann-foto" class="absolute inset-0 w-full h-full object-cover hidden">
                        <button id="btn-clear-ann-foto" class="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hidden hover:scale-110 transition-transform"><i class="fa-solid fa-xmark text-[10px]"></i></button>
                    </div>
                  </div>
              </div>
              <button id="btn-publish-ann" class="mt-4 w-full py-3.5 bg-tealAccent text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-tealAccent/90 transition-all shadow-md shadow-tealAccent/20 flex justify-center items-center gap-2">
                <i class="fa-solid fa-paper-plane text-[10px]"></i> Publicar Comunicado
              </button>
            </div>
            <div class="w-2/3 flex gap-6 h-fit">
              <div class="flex-1 flex flex-col">
                <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Historial de Anuncios</h3>
                ${anunciosHtml || '<div class="text-center p-8 border-2 border-dashed border-gray-200 dark:border-white/5 rounded-2xl text-gray-400 text-xs font-bold uppercase tracking-widest">No hay anuncios enviados</div>'}
              </div>
              <div class="flex-1 bg-gray-50 dark:bg-black/20 rounded-3xl border border-gray-100 dark:border-white/5 flex flex-col h-fit sticky top-0">
                <div id="anu-reporte-contenedor" class="w-full min-h-[400px] flex flex-col p-6 items-center justify-center text-center">
                  <div id="ann-report-placeholder" class="py-20 text-center">
                    <i class="fa-solid fa-chart-pie text-5xl text-gray-100 dark:text-white/5 mb-4 block"></i>
                    <h4 class="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Reporte de Lectura</h4>
                    <p class="text-[10px] text-gray-300 dark:text-gray-500 mt-2 font-medium">Selecciona un anuncio para ver quiénes lo han leído.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
    } else {
        // --- LLAMADAS LOGIC ---
        if (!db.admin_meetings) db.admin_meetings = [];
        const sortedMeetings = [...db.admin_meetings].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        const dynPipelines = db.Admin_Pipelines || [];
        
        const meetingsHtml = sortedMeetings.map(mt => {
          const totalLecturas = (db.admin_meetings_reads || []).filter(r => r.meeting_id === mt.id).length;
          return `
            <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm hover:border-blue-400/30 transition-all cursor-pointer mb-5 relative group flex flex-col justify-between" onclick="mostrarReporteMeeting('${mt.id}')">
               <button onclick="event.stopPropagation(); window.deleteMeeting('${mt.id}', this)" class="absolute top-4 right-4 w-9 h-9 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all hover:bg-red-500 hover:text-white z-20">
                  <i class="fa-solid fa-trash-can text-sm"></i>
               </button>
               <div class="flex-1">
                 <div class="flex justify-between items-start mb-3 pr-10">
                   <h4 class="text-sm font-black text-gray-900 dark:text-white line-clamp-1">${mt.titulo || 'Reunión'}</h4>
                   <div class="flex flex-wrap gap-1 justify-end">
                     ${(mt.audiencia_tags || [mt.audiencia || 'Todos']).map(tag => {
                        const displayTag = (tag === 'todos' || tag === 'Todos') ? 'Renew Group' : tag;
                        return `<span class="px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">${displayTag}</span>`;
                     }).join('')}
                   </div>
                 </div>
                 ${mt.imagen_url ? `<img src="${mt.imagen_url}" class="w-full h-32 object-cover rounded-xl mb-3 border border-gray-100 dark:border-white/5">` : ''}
                 <p class="text-[12px] leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-3 mb-4">${mt.texto}</p>
                 ${mt.enlace ? `<div class="text-[10px] text-blue-400 font-bold truncate mb-2"><i class="fa-solid fa-link mr-1"></i> ${mt.enlace}</div>` : ''}
               </div>
               <div class="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 tracking-wider pt-4 border-t border-gray-50 dark:border-white/5 mt-auto">
                 <span><i class="fa-solid fa-calendar mr-1"></i> ${new Date(mt.created_at).toLocaleDateString()}</span>
                 <span class="text-blue-400 bg-blue-400/10 px-3 py-1.5 rounded-full"><i class="fa-solid fa-check-double mr-1"></i> ${totalLecturas} Confirmados</span>
               </div>
            </div>
          `;
        }).join('');

        UI.canvas.innerHTML = `
          ${annTabsHtml}
          <div class="flex gap-8 min-h-full pb-20 animate-fadeIn">
            <div class="w-1/3 bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col h-fit">
              <div class="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-white/5">
                <div class="w-10 h-10 rounded-full bg-blue-400/10 flex items-center justify-center text-blue-400"><i class="fa-solid fa-video text-lg"></i></div>
                <div>
                  <h3 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Coordinar Llamada</h3>
                  <p class="text-[9px] text-gray-400 font-bold tracking-widest uppercase">Coordinar con equipo</p>
                </div>
              </div>
              <div class="space-y-4 flex-1">
                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Título de la Reunión</label>
                    <input type="text" id="mt-input-title" placeholder="Ej: Weekly Sync" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900 dark:text-white focus:border-blue-400">
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Audiencia (Selección Múltiple)</label>
                    <div class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 max-h-48 overflow-y-auto space-y-3 hide-scrollbar">
                        <label class="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" id="mt-aud-all" class="mt-aud-check w-4 h-4 rounded border-gray-300 text-blue-400 focus:ring-blue-400" value="todos">
                            <span class="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest group-hover:text-blue-400 transition-colors">Renew Group</span>
                        </label>
                        <div class="pt-2 border-t border-gray-100 dark:border-white/5">
                            <p class="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Por Pipelines</p>
                            <div class="grid grid-cols-1 gap-2">
                                ${dynPipelines.map(p => `
                                    <label class="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" class="mt-aud-check w-3.5 h-3.5 rounded border-gray-300 text-blue-400 focus:ring-blue-400" value="${p.nombre}">
                                        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-blue-400 transition-colors">${p.nombre}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <div class="pt-2 border-t border-gray-100 dark:border-white/5">
                            <p class="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Por Roles / Cargos</p>
                            <div class="grid grid-cols-1 gap-2">
                                ${['Vendedor', 'Técnico', 'Admin', 'Call Center', 'Project Manager', 'Supervisión', 'CEO'].map(r => `
                                    <label class="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" class="mt-aud-check w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500" value="${r}">
                                        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-blue-500 transition-colors">${r}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <div class="pt-2 border-t border-gray-100 dark:border-white/5">
                            <p class="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Por Trabajadores</p>
                            <div class="grid grid-cols-1 gap-2">
                                ${(window._cachedAnunciosWorkers || []).map(w => `
                                    <label class="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" class="mt-aud-check aud-worker w-3.5 h-3.5 rounded border-gray-300 text-blue-400 focus:ring-blue-400" value="user_${w.id}">
                                        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-blue-400 transition-colors">${w.nombre} ${w.apellido || ''}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Enlace (Zoom/Meet)</label>
                    <input type="text" id="mt-input-link" placeholder="https://zoom.us/j/..." class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900 dark:text-white focus:border-blue-400">
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Instrucciones / Texto</label>
                    <textarea id="mt-input-msg" rows="3" placeholder="..." class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none resize-none text-gray-900 dark:text-white focus:border-blue-400"></textarea>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Miniatura (Opcional)</label>
                    <div id="drop-mt-foto" class="w-full h-24 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-all bg-gray-50 dark:bg-black/20 group relative overflow-hidden">
                        <input type="file" id="inp-mt-foto-file" class="hidden" accept="image/*">
                        <div id="mt-foto-placeholder" class="text-center">
                            <i class="fa-solid fa-image text-gray-300 group-hover:text-blue-400 transition-colors text-xl"></i>
                            <p class="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Arrastra o haz clic</p>
                        </div>
                        <img id="preview-mt-foto" class="absolute inset-0 w-full h-full object-cover hidden">
                    </div>
                  </div>
              </div>
              <button id="btn-publish-mt" class="mt-4 w-full py-3.5 bg-blue-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 flex justify-center items-center gap-2">
                <i class="fa-solid fa-paper-plane text-[10px]"></i> Publicar Llamada
              </button>
            </div>
            <div class="w-2/3 flex gap-6 h-fit">
              <div class="flex-1 flex flex-col">
                <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Historial de Llamadas</h3>
                ${meetingsHtml || '<div class="text-center p-8 border-2 border-dashed border-gray-200 dark:border-white/5 rounded-2xl text-gray-400 text-xs font-bold uppercase tracking-widest">No hay reuniones programadas</div>'}
              </div>
              <div class="flex-1 bg-gray-50 dark:bg-black/20 rounded-3xl border border-gray-100 dark:border-white/5 flex flex-col h-fit sticky top-0">
                <div id="mt-reporte-contenedor" class="w-full min-h-[400px] flex flex-col p-6 items-center justify-center text-center">
                  <div id="mt-report-placeholder" class="py-20 text-center">
                    <i class="fa-solid fa-users-viewfinder text-5xl text-gray-100 dark:text-white/5 mb-4 block"></i>
                    <h4 class="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Reporte de Confirmación</h4>
                    <p class="text-[10px] text-gray-300 dark:text-gray-500 mt-2 font-medium">Selecciona una reunión para ver quiénes la han leído.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
    }

    // --- EVENT LISTENERS (Shared) ---
    setTimeout(() => {
        // Tab switching logic
        UI.canvas.querySelectorAll('.ann-sub-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                state.activeAnnTab = btn.dataset.tab;
                renderView();
            });
        });

        if (state.activeAnnTab === 'comunicados') {
            const btnPub = document.getElementById('btn-publish-ann');
            if (btnPub) {
                btnPub.onclick = async () => {
                  const tit = document.getElementById('ann-input-title').value.trim();
                  const msj = document.getElementById('ann-input-msg').value.trim();
                  const checked = Array.from(document.querySelectorAll('.aud-check:checked'));
                  const audTags = checked.map(c => c.value);
                  const isAll = audTags.includes('todos');
                  
                  if (!tit || !msj) return showToast('Título y mensaje obligatorios', 'error');
                  if (audTags.length === 0) return showToast('Selecciona al menos una audiencia', 'warning');
                  
                  btnPub.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';
                  btnPub.disabled = true;
                  
                  const nuevoAnuncio = {
                    id: 'ann_' + Date.now().toString(36),
                    titulo: tit,
                    mensaje: msj,
                    audiencia: isAll ? 'todos' : audTags.join(', '),
                    audiencia_tags: audTags,
                    foto_url: state.currentAnnFoto || null,
                    fecha: new Date().toISOString(),
                    estado_lecturas: [] 
                  };
                  
                  const todosTra = await getAdminWorkers();
                    nuevoAnuncio.estado_lecturas = todosTra.filter(w => {
                    if (isAll) return true;
                    const matchesPipe = audTags.some(tag => (w.unidades || []).includes(tag));
                    const matchesRole = audTags.some(tag => (w.rol || '').toLowerCase() === tag.toLowerCase());
                    const matchesUser = audTags.includes(`user_${w.id}`);
                    return matchesPipe || matchesRole || matchesUser;
                  }).map(w => ({
                    vendedor_id: w.id,
                    vendedor_nombre: `${w.nombre} ${w.apellido}`,
                    leido: false,
                    fecha_lectura: null
                  }));
                  
                  const dbLoc = getDB();
                  if(!dbLoc.anuncios_corporativos) dbLoc.anuncios_corporativos = [];
                  dbLoc.anuncios_corporativos.push(nuevoAnuncio);
                  await saveDB(dbLoc);
                  state.currentAnnFoto = null;
                  showToast('¡Anuncio publicado globalmente!', 'success');
                  renderView();
                };
            }
            const dropAnn = document.getElementById('drop-ann-foto');
            const inpAnn = document.getElementById('inp-ann-foto-file');
            const preAnn = document.getElementById('preview-ann-foto');
            const plaAnn = document.getElementById('ann-foto-placeholder');
            const clrAnn = document.getElementById('btn-clear-ann-foto');
            if (dropAnn && inpAnn) {
                dropAnn.onclick = () => inpAnn.click();
                inpAnn.onchange = async () => {
                  if (inpAnn.files.length) {
                    const file = inpAnn.files[0];
                    plaAnn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-tealAccent"></i>';
                    try {
                      const url = await uploadFile(file, 'announcements');
                      state.currentAnnFoto = url;
                      preAnn.src = url;
                      preAnn.classList.remove('hidden');
                      plaAnn.classList.add('hidden');
                      clrAnn.classList.remove('hidden');
                    } catch (err) {
                      showToast('Error al subir imagen', 'error');
                      plaAnn.innerHTML = '<i class="fa-solid fa-image text-gray-300 text-xl"></i>';
                    }
                  }
                };
                if (clrAnn) {
                  clrAnn.onclick = (e) => {
                    e.stopPropagation();
                    state.currentAnnFoto = null;
                    inpAnn.value = '';
                    preAnn.classList.add('hidden');
                    plaAnn.classList.remove('hidden');
                    clrAnn.classList.add('hidden');
                    plaAnn.innerHTML = `<i class="fa-solid fa-image text-gray-300 text-xl"></i><p class="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Arrastra o haz clic</p>`;
                  };
                }
            }
        } else {
            const btnPub = document.getElementById('btn-publish-mt');
            if (btnPub) {
                btnPub.onclick = async () => {
                    const tit = document.getElementById('mt-input-title').value.trim();
                    const lnk = document.getElementById('mt-input-link').value.trim();
                    const msj = document.getElementById('mt-input-msg').value.trim();
                    const checked = Array.from(document.querySelectorAll('.mt-aud-check:checked'));
                    const audTags = checked.map(c => c.value);
                    const isAll = audTags.includes('todos');
                    
                    if (!msj) return showToast('El texto es obligatorio', 'error');
                    if (audTags.length === 0) return showToast('Selecciona al menos una audiencia', 'warning');
                    
                    btnPub.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';
                    btnPub.disabled = true;
                    
                    const newMt = {
                        titulo: tit,
                        texto: msj,
                        enlace: lnk,
                        audiencia: isAll ? 'todos' : audTags.join(', '),
                        audiencia_tags: audTags,
                        imagen_url: state.currentMtFoto || null,
                        active: true
                    };
                    
                    try {
                        await saveGranular('admin_meetings', [newMt]);
                        state.currentMtFoto = null;
                        showToast('Reunión publicada correctamente', 'success');
                        await initDB();
                        renderView();
                    } catch (err) {
                        showToast('Error al publicar reunión', 'error');
                        btnPub.innerHTML = '<i class="fa-solid fa-paper-plane text-[10px]"></i> Publicar Llamada';
                        btnPub.disabled = false;
                    }
                };
            }
            const dropMt = document.getElementById('drop-mt-foto');
            const inpMt = document.getElementById('inp-mt-foto-file');
            const preMt = document.getElementById('preview-mt-foto');
            const plaMt = document.getElementById('mt-foto-placeholder');
            if (dropMt && inpMt) {
                dropMt.onclick = () => inpMt.click();
                inpMt.onchange = async () => {
                    if (inpMt.files.length) {
                        const file = inpMt.files[0];
                        plaMt.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-blue-400"></i>';
                        try {
                            const url = await uploadFile(file, 'meetings');
                            state.currentMtFoto = url;
                            preMt.src = url;
                            preMt.classList.remove('hidden');
                            plaMt.classList.add('hidden');
                        } catch (err) {
                            showToast('Error al subir imagen', 'error');
                            plaMt.innerHTML = '<i class="fa-solid fa-image text-gray-300 text-xl"></i>';
                        }
                    }
                };
            }
        }
    }, 100);
  }
}

// Ventana global para visualizar reporte de lectura
window.deleteAnuncio = async (id, btn) => {
    if (!confirm('¿Seguro que deseas eliminar este anuncio? No podrá recuperarse.')) return;
    
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-[10px]"></i>';
        }
        
        const headers = { 'Content-Type': 'application/json' };
        await fetch('/api/delete', { 
            method: 'POST', 
            headers, 
            body: JSON.stringify({ table: 'anuncios_corporativos', id }) 
        });

        await initDB();
        showToast('Anuncio eliminado permanentemente', 'warning');
        renderView();
    } catch (err) {
        console.error(err);
        showToast('Error al eliminar anuncio', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-trash-can text-[10px]"></i>';
        }
    }
};

window.deleteMeeting = async (id, btn) => {
    if (!confirm('¿Seguro que deseas eliminar esta reunión?')) return;
    
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-[10px]"></i>';
        }
        
        await fetch('/api/delete', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'admin_meetings', id }) 
        });

        await initDB();
        showToast('Reunión eliminada', 'warning');
        renderView();
    } catch (err) {
        console.error(err);
        showToast('Error al eliminar reunión', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-trash-can text-[10px]"></i>';
        }
    }
};

window.mostrarReporteMeeting = async (id) => {
    const db = getDB();
    const mt = (db.admin_meetings || []).find(m => m.id === id);
    if (!mt) return;
    
    const container = document.getElementById('mt-reporte-contenedor');
    if (!container) return;
    
    const reads = (db.admin_meetings_reads || []).filter(r => r.meeting_id === id);
    const workers = await getAdminWorkers();
    
    const confirmedWorkers = workers.filter(w => reads.some(r => r.user_id === w.id));
    const pendingWorkers = workers.filter(w => !reads.some(r => r.user_id === w.id));
    
    container.innerHTML = `
        <div class="w-full h-full flex flex-col p-6 overflow-y-auto hide-scrollbar">
            <h4 class="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4 border-b border-gray-100 dark:border-white/5 pb-2 text-left">Confirmados (${confirmedWorkers.length})</h4>
            <div class="grid grid-cols-1 gap-2 mb-8">
                ${confirmedWorkers.map(w => `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <span class="text-[10px] font-bold text-gray-700 dark:text-gray-300">${w.nombre} ${w.apellido}</span>
                        <i class="fa-solid fa-check text-emerald-500 text-[8px]"></i>
                    </div>
                `).join('') || '<p class="text-[10px] text-gray-400 italic">Nadie ha confirmado aún</p>'}
            </div>

            <h4 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 dark:border-white/5 pb-2 text-left">Pendientes (${pendingWorkers.length})</h4>
            <div class="grid grid-cols-1 gap-2">
                ${pendingWorkers.map(w => `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-gray-500/5 border border-gray-500/10 opacity-60">
                        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400">${w.nombre} ${w.apellido}</span>
                        <i class="fa-solid fa-clock text-gray-400 text-[8px]"></i>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

window.mostrarReporteAnuncio = function(id) {
  const db = getDB();
  const ann = (db.anuncios_corporativos || []).find(a => a.id === id);
  if(!ann) return;
  
  const contenedor = document.getElementById('anu-reporte-contenedor');
  if(!contenedor) return;

  const leidos = ann.estado_lecturas.filter(e => e.leido).length;
  const total = ann.estado_lecturas.length;
  const pct = total === 0 ? 0 : Math.round((leidos/total)*100);

  const lsHtml = ann.estado_lecturas.map(est => {
     if(est.leido) {
        return `<div class="flex items-center justify-between p-2 border-b border-gray-100 dark:border-white/5">
            <span class="text-[10px] font-bold text-gray-700 dark:text-gray-300">${est.vendedor_nombre || 'Usuario'}</span>
            <span class="text-[9px] text-tealAccent font-black uppercase"><i class="fa-solid fa-check-circle"></i> ${t('ann_status_read')}</span>
        </div>`;
     } else {
        return `<div class="flex items-center justify-between p-2 border-b border-gray-100 dark:border-white/5">
            <span class="text-[10px] font-bold text-gray-700 dark:text-gray-300">${est.vendedor_nombre || 'Usuario'}</span>
            <span class="text-[9px] text-gray-400 font-black uppercase"><i class="fa-solid fa-clock"></i> ${t('ann_status_pend')}</span>
        </div>`;
     }
  }).join('');

  contenedor.innerHTML = `
     <div class="w-full flex-1 flex flex-col">
       <div class="border-b border-gray-100 dark:border-white/5 pb-4 mb-4">
         <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Reporte:</h3>
         <p class="text-lg font-black text-gray-900 dark:text-white leading-none">${ann.titulo}</p>
         <div class="mt-4 bg-white dark:bg-black/30 border border-gray-100 dark:border-white/5 p-3 rounded-xl flex items-center justify-between">
           <div>
             <p class="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Aceptación (Lectura)</p>
             <p class="text-2xl font-black text-tealAccent leading-none mt-1">${pct}%</p>
           </div>
           <div class="text-right">
             <p class="text-xs font-black text-gray-600 dark:text-gray-300">${leidos} / ${total}</p>
             <p class="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Usuarios</p>
           </div>
         </div>
       </div>
       
       <div class="flex-1 overflow-y-auto hide-scrollbar border border-gray-100 dark:border-white/5 rounded-xl bg-white dark:bg-black/10">
         ${total === 0 ? '<div class="p-6 text-center text-[10px] text-gray-400 font-bold">Nadie en esta audiencia</div>' : lsHtml}
       </div>
     </div>
  `;
};

function crearPasoWhatsAppHTML(index) {
  const isFirst = index === 1;
  return `
    <div class="wa-card bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 p-6 rounded-2xl shadow-sm relative overflow-hidden group mb-6">
      <div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-400 to-green-600 opacity-50"></div>
      
      <div class="flex justify-between items-start mb-6">
        <div class="flex items-center gap-4">
          <div class="wa-step-idx w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-green-400 font-black text-sm">
            ${index}
          </div>
          <h3 class="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">WhatsApp Automation</h3>
        </div>
        ${!isFirst ? `
        <button class="btn-eliminar-wa-paso text-red-500/50 hover:text-red-500 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100">
          <i class="fa-solid fa-trash-can"></i>
        </button>
        ` : ''}
      </div>

      <div class="mb-6">
        <p class="aqua-label text-green-400">Send Schedule</p>
        <input type="datetime-local" class="wa-fecha-envio w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:border-green-500 outline-none font-bold transition-all">
      </div>

      <div class="mt-6">
        <p class="aqua-label text-green-400">WhatsApp Message Content</p>
        <textarea class="wa-cuerpo w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:border-green-500 outline-none font-medium h-32 resize-none transition-all" placeholder="Hello {{name}}, your request has been..."></textarea>
      </div>
    </div>
  `;
}

function crearPasoMarketingHTML(index) {
  const isFirst = index === 1;
  return `
    <div class="mk-card bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 p-6 rounded-2xl shadow-sm relative overflow-hidden group mb-4">
      <div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-tealAccent to-blue-500 opacity-50"></div>
      
      <div class="flex justify-between items-start mb-4">
        <div class="flex items-center gap-3">
          <div class="mk-step-idx w-8 h-8 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-tealAccent font-black text-xs">
            ${index}
          </div>
          <h3 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">Email Sequence Step</h3>
        </div>
        ${!isFirst ? `
          <button class="btn-eliminar-paso text-red-500/50 hover:text-red-500 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        ` : ''}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="md:col-span-2">
        <p class="aqua-label text-[9px]">Subject Line</p>
          <input type="text" class="mk-asunto w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg px-3 py-2.5 text-[11px] text-gray-900 dark:text-white focus:border-tealAccent outline-none font-medium transition-all" placeholder="Enter high-impact subject...">
        </div>
        <div>
          <p class="aqua-label text-[9px]">Send Schedule</p>
          <input type="datetime-local" class="mk-fecha-envio w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg px-3 py-2.5 text-[11px] text-gray-900 dark:text-white focus:border-tealAccent outline-none font-bold transition-all">
        </div>
      </div>

      <div class="mt-4">
        <p class="aqua-label text-[9px]">Message Body</p>
        <textarea class="mk-cuerpo w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg px-3 py-2.5 text-[11px] text-gray-900 dark:text-white focus:border-tealAccent outline-none font-medium h-24 resize-none transition-all" placeholder="Hello {{name}}, we're thrilled to..."></textarea>
      </div>
    </div>
  `;
}

function renderCalendario() {
  UI.canvas.innerHTML = `
    <style>
        /* --- NUEVOS ESTILOS PARA PROPORCIONES DE TARJETAS --- */
        .fc-daygrid-event {
          border: none !important;
          border-radius: 8px !important;
          padding: 0 !important;
          margin: 2px auto !important;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1) !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          height: auto !important;
          min-height: 40px !important;
          display: flex !important;
          align-items: stretch !important;
          overflow: hidden !important;
          width: 95% !important;
          background-color: transparent !important;
          white-space: normal !important;
        }
        .fc-daygrid-event-harness {
          display: flex !important;
          justify-content: center !important;
        }
        .fc-daygrid-event:hover {
          transform: translateY(-1px) scale(1.02) !important;
          box-shadow: 0 8px 20px rgba(0,0,0,0.3) !important;
          filter: brightness(1.1);
        }
        .fc-daygrid-event .fc-event-main {
          color: inherit !important;
          font-weight: 800 !important;
          font-size: 0.68rem !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          width: 100%;
          overflow: hidden;
        }
        /* Ajustes para la vista de lista (semanal) */
        .fc-list-event { cursor: pointer !important; }
        .fc-list-event-title { font-weight: 800 !important; font-size: 0.85rem !important; }
        .fc-list-event-time { font-weight: 900 !important; color: var(--primary) !important; }
        .fc-list-day-cushion { background-color: var(--surface-alt) !important; color: var(--text-primary) !important; padding: 12px 16px !important; }
        .fc-list-day-text, .fc-list-day-side-text { font-weight: 800 !important; text-transform: uppercase !important; letter-spacing: 1px !important; font-size: 0.7rem !important; color: var(--text-primary) !important; }
        .fc-list-table { background-color: transparent !important; }
        .fc-list-empty { background-color: var(--surface) !important; color: var(--text-muted) !important; }
        .fc-event-time { background: rgba(0,0,0,0.1); padding: 1px 6px; border-radius: 8px; font-size: 0.6rem !important; font-weight: 900 !important; color: rgba(0,0,0,0.7) !important; flex-shrink: 0; }
        .fc-event-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    </style>
    <div class="mt-6 bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-premium transition-all animate-fadeIn">
      <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">
          <input type="checkbox" id="chk-admin-eventos" checked style="width: 16px; height: 16px; accent-color: var(--primary);">
          <span>Eventos</span>
        </label>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">
          <input type="checkbox" id="chk-admin-cumple" checked style="width: 16px; height: 16px; accent-color: #ec4899;">
          <span>Cumpleaños</span>
        </label>
      </div>
      <div id="calendar-master" class="min-h-[750px]"></div>
    </div>
  `;

  const calendarEl = document.getElementById('calendar-master');
  if (!calendarEl) return;

  const chkEventos = document.getElementById('chk-admin-eventos');
  const chkCumple = document.getElementById('chk-admin-cumple');
  if (chkEventos) chkEventos.addEventListener('change', () => { if (window.currentCalendar) window.currentCalendar.refetchEvents(); });
  if (chkCumple) chkCumple.addEventListener('change', () => { if (window.currentCalendar) window.currentCalendar.refetchEvents(); });

  const API_KEY = 'AIzaSyAmuV4zmbor3JagjOJn2WKUcRA0SUGsh3U';
  const CALENDAR_ID = 'c_0300a26935f9ffbe1772a440f9070fa95f02f551157e69bd0d71092777559943@group.calendar.google.com';

  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listDay'
    },
    eventDisplay: 'block',
    displayEventTime: false,
    eventSources: [
      // Single source of truth: Supabase (n8n also syncs to Google Calendar in background)
      function(fetchInfo, successCallback, failureCallback) {
        try {
            const db = getDB();
            const data = db.calendario_eventos || [];
            const filtered = data.filter(ev => ev.fecha_inicio >= fetchInfo.startStr && ev.fecha_inicio <= fetchInfo.endStr);
            
            const mapped = filtered.map(ev => {
                const normalizedColab = (ev.colaboradores || []).map(c => {
                    if (typeof c === 'string') {
                        try { return JSON.parse(c); } catch(e) { return {}; }
                    }
                    return c;
                });

                const colorMap = {
                    'Verde': '#00ff88',
                    'Amarillo': '#fce803',
                    'Rojo': '#ff3366',
                    'Azul': '#00d4ff',
                    'Naranja': '#ff8c00'
                };
                return {
                    id: ev.id,
                    title: ev.nombre,
                    start: ev.fecha_inicio,
                    backgroundColor: colorMap[ev.color] || '#00f5d4',
                    borderColor: 'transparent',
                    extendedProps: {
                        real_end: ev.fecha_fin,
                        isSupabase: true,
                        telefono: ev.telefono,
                        direccion: ev.direccion,
                        description: ev.descripcion,
                        adjunto_url: ev.adjunto_url,
                        color: ev.color,
                        colaboradores: normalizedColab,
                        departamentos: ev.departamentos || []
                    }
                };
             });

             // Add birthdays
             const mappedBirthdays = [];
             const workers = db.Usuarios || [];
             const yearStart = parseInt(fetchInfo.startStr.substring(0, 4)) || new Date().getFullYear();
             const yearEnd = parseInt(fetchInfo.endStr.substring(0, 4)) || new Date().getFullYear();

             workers.forEach(w => {
                 if (!w.dob) return;
                 let month, day;
                 if (w.dob.includes('/')) {
                     const p = w.dob.split('/');
                     month = p[0].padStart(2, '0');
                     day = p[1].padStart(2, '0');
                 } else if (w.dob.includes('-')) {
                     const p = w.dob.split('-');
                     if (p[0].length === 4) { month = p[1]; day = p[2]; } else { month = p[0]; day = p[1]; }
                 }
                 if (!month || !day) return;

                 for (let y = yearStart; y <= yearEnd; y++) {
                     mappedBirthdays.push({
                         id: 'bday_' + w.id + '_' + y,
                         title: '<i class="fa-solid fa-cake-candles"></i> Cumpleaños de ' + (w.nombre || '') + ' ' + (w.apellido || ''),
                         start: `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
                         allDay: true,
                         backgroundColor: '#ec4899',
                         borderColor: 'transparent',
                         extendedProps: { isBirthday: true, workerId: w.id }
                     });
                 }
             });

             // Filter based on checkboxes
             const showEventos = document.getElementById('chk-admin-eventos') ? document.getElementById('chk-admin-eventos').checked : true;
             const showCumple = document.getElementById('chk-admin-cumple') ? document.getElementById('chk-admin-cumple').checked : true;
             
             let finalEvents = [];
             if (showEventos) {
                 finalEvents = finalEvents.concat(mapped);
             }
             if (showCumple) {
                 finalEvents = finalEvents.concat(mappedBirthdays);
             }

             successCallback(finalEvents);
        } catch (error) {
             console.error("Error fetching events", error);
             failureCallback(error);
        }
      }
    ],
    
    
    eventContent: function(arg) {
       const baseColor = arg.event.backgroundColor || '#00f5d4';
       const colabs = arg.event.extendedProps?.colaboradores || [];
       const deptos = arg.event.extendedProps?.departamentos || [];
       
       let deptHtml = '';
       if (deptos.length > 0) {
           const colors = { 'Solar': '#84cc16', 'Home': '#fbbf24', 'Water': '#38bdf8' };
           const c = colors[deptos[0]];
           if (c) {
               deptHtml = `<span title="${deptos[0]}" style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${c}; margin-left:4px; vertical-align:middle; box-shadow:0 0 2px rgba(0,0,0,0.2);"></span>`;
           }
       }
       
       let avatarsHtml = '';
       if (colabs && colabs.length > 0) {
           const maxAvatares = 3;
           const showColabs = colabs.slice(0, maxAvatares);
           const extraCount = colabs.length - maxAvatares;
           
           avatarsHtml = '<div style="display: flex; align-items: center; justify-content: flex-end; margin-top: auto; padding-top: 4px;">';
           showColabs.forEach(c => {
               const nameStr = (c && c.nombre) ? c.nombre : (typeof c === 'string' ? c : 'U');
               const initial = nameStr.charAt(0).toUpperCase();
               // Se agrega title=nameStr para que al pasar el mouse se vea el nombre completo
               avatarsHtml += `<div title="${nameStr}" style="width: 22px; height: 22px; border-radius: 50%; background: #fff; color: #444; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; border: 1.5px solid #fff; margin-left: -6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 2; cursor: help;">${initial}</div>`;
           });
           if (extraCount > 0) {
               avatarsHtml += `<div title="+${extraCount} colaboradores más" style="width: 22px; height: 22px; border-radius: 50%; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; border: 1.5px solid #fff; margin-left: -6px; z-index: 1;">+${extraCount}</div>`;
           }
           avatarsHtml += '</div>';
       }

       const isLightMode = !document.documentElement.classList.contains('dark');
       const bgStyle = `background-color: ${baseColor}20;`;
       const titleColor = isLightMode ? '#1e293b' : '#f8fafc';
       const timeColor = isLightMode ? '#64748b' : '#94a3b8';

       const isMonth = arg.view.type === 'dayGridMonth' || arg.view.type === 'listWeek';
       const p = isMonth ? '2px 4px' : '6px 8px';
       const titleSize = isMonth ? '0.7rem' : '0.8rem';
       
       const timeText = arg.timeText ? `<div style="font-size: 0.7rem; color: ${timeColor}; font-weight: 600; margin-bottom: 2px;">${arg.timeText}</div>` : '';
       
       let html = `
         <div style="${bgStyle} border-left: 4px solid ${baseColor}; border-radius: 8px; padding: ${p}; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;">
            <div style="font-size: ${titleSize}; font-weight: 800; color: ${titleColor}; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; margin-bottom: 2px;">${arg.event.title} ${deptHtml}</div>
            ${timeText}
            ${avatarsHtml}
         </div>
       `;
       return { html: html };
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Agenda'
    },
    eventClick: function(info) {
      info.jsEvent.preventDefault();
      // Si el evento tiene URL (ej: Google Calendar), evitamos que navegue
      mostrarDetalleEventoCalendario(info.event);
    },
    dateClick: function(info) {
      // Al hacer click en un dia libre, abre modal en modo creación
      mostrarDetalleEventoCalendario({ date: info.date });
    },
    height: 'auto',
    themeSystem: 'standard',
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      meridiem: 'short'
    }
  });

  calendar.render();
  // Store instance for potential refreshes
  window.currentCalendar = calendar;
}

// ââ‚¬ââ‚¬ Auto-fill end date when start date changes ââ‚¬ââ‚¬
window.onStartDateChange = function(startInput) {
    const finInput = document.getElementById('ev-fecha-fin');
    if (!startInput.value) return;
    
    // Set minimum for end date = start date
    finInput.min = startInput.value;
    
    // Auto-fill end date only if it's empty OR earlier than the new start
    const startMs = new Date(startInput.value).getTime();
    const finMs = finInput.value ? new Date(finInput.value).getTime() : 0;
    
    if (!finInput.value || finMs <= startMs) {
        const autoEnd = new Date(startMs + 3600000); // +1 hour
        const pad = n => n < 10 ? '0'+n : n;
        const autoEndStr = autoEnd.getFullYear() + '-' + pad(autoEnd.getMonth()+1) + '-' + pad(autoEnd.getDate()) + 'T' + pad(autoEnd.getHours()) + ':' + pad(autoEnd.getMinutes());
        finInput.value = autoEndStr;
    }
};

window.mostrarDetalleEventoCalendario = async function(event) {
  const modal = document.getElementById('modal-calendar-event');
  if (!modal) return;

  const btnGuardar = document.getElementById('btn-guardar-evento');
  const titleEl = document.getElementById('modo-texto');
  const form = document.getElementById('form-calendario-evento');
  
  // Función para convertir fecha JS a YYYY-MM-DDThh:mm
  const toLocalISOString = (d) => {
      const pad = n => n < 10 ? '0'+n : n;
      return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };

  // Set in View Mode if event exists
  if (event && event.title) {
    const props = event.extendedProps || {};
    titleEl.innerHTML = props.isBirthday ? `<i class="fa-solid fa-cake-candles"></i> ${event.title}` : `<i class="fa-solid fa-calendar-check"></i> ${event.title || 'Cita de Instalación'}`;
    btnGuardar.classList.add('hidden');

    // Show delete button and store event ID
    const btnEliminar = document.getElementById('btn-eliminar-evento-admin');
    if (btnEliminar) {
      btnEliminar.classList.remove('hidden');
      btnEliminar.dataset.eventId = event.id || '';
    }

    const btnEditar = document.getElementById('btn-editar-evento-admin');
    if (btnEditar) {
      btnEditar.classList.remove('hidden');
    }

    

    document.getElementById('ev-nombre').value = event.title ? event.title.replace(/<[^>]*>?/gm, '').trim() : '';
    document.getElementById('ev-nombre').readOnly = true;

    if (event.start) {
        document.getElementById('ev-fecha-inicio').value = toLocalISOString(event.start);
    }
    if (props.real_end) {
        document.getElementById('ev-fecha-fin').value = toLocalISOString(new Date(props.real_end));
    } else if (event.end) {
        document.getElementById('ev-fecha-fin').value = toLocalISOString(event.end);
    } else if (event.start) {
        document.getElementById('ev-fecha-fin').value = toLocalISOString(event.start);
    }
    document.getElementById('ev-fecha-inicio').readOnly = true;
    document.getElementById('ev-fecha-fin').readOnly = true;



    if (props.direccion) {
      document.getElementById('ev-direccion').classList.add('hidden');
      const linkDir = document.getElementById('ev-direccion-link');
      linkDir.classList.remove('hidden');
      const addressUrl = encodeURIComponent(props.direccion);
      linkDir.href = `https://www.google.com/maps/search/?api=1&query=${addressUrl}`;
    } else {
      document.getElementById('ev-direccion').value = '';
      document.getElementById('ev-direccion').readOnly = true;
    }

    if (props.isBirthday) {
        document.getElementById('ev-descripcion').value = 'Cumpleaños generado desde el perfil del usuario.';
        document.getElementById('ev-descripcion').readOnly = true;
        
        document.getElementById('ev-adjunto').parentElement.classList.add('hidden');
        document.getElementById('ev-colaboradores').parentElement.classList.add('hidden');
        document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = true);
        const colorContainer = document.querySelector('input[name="ev-color"]')?.closest('.flex');
        if (colorContainer) colorContainer.parentElement.classList.add('hidden');
        const deptoContainer = document.querySelector('input[name="ev-depto"]')?.closest('.grid');
        if (deptoContainer) deptoContainer.parentElement.classList.add('hidden');
        
        const btnEliminar = document.getElementById('btn-eliminar-evento-admin');
        if (btnEliminar) {
            const u = getCurrentUser();
            if (u && ['Admin', 'Súper Admin', 'Gerente', 'Administrador'].includes(u.rango || u.rol)) {
                btnEliminar.classList.remove('hidden');
            } else {
                btnEliminar.classList.add('hidden');
            }
        }
        const btnEditar = document.getElementById('btn-editar-evento-admin');
        if (btnEditar) btnEditar.classList.add('hidden');
    } else {
        // Restore hidden containers
        const colorContainer = document.querySelector('input[name="ev-color"]')?.closest('.flex');
        if (colorContainer) colorContainer.parentElement.classList.remove('hidden');
        const deptoContainer = document.querySelector('input[name="ev-depto"]')?.closest('.grid');
        if (deptoContainer) deptoContainer.parentElement.classList.remove('hidden');

        document.getElementById('ev-descripcion').value = props.description || 'Sin detalles adicionales.';
        document.getElementById('ev-descripcion').readOnly = true;

        if (props.adjunto_url) {
          document.getElementById('ev-adjunto').classList.add('hidden');
          const linkAdj = document.getElementById('ev-adjunto-link');
          linkAdj.classList.remove('hidden');
          linkAdj.href = props.adjunto_url;
        } else {
          document.getElementById('ev-adjunto').parentElement.classList.add('hidden');
        }

        document.getElementById('ev-colaboradores').parentElement.classList.add('hidden');

        // Show participants read-only
        let participantsEl = document.getElementById('ev-participantes-readonly');
        if (!participantsEl) {
            participantsEl = document.createElement('div');
            participantsEl.id = 'ev-participantes-readonly';
            document.getElementById('ev-colaboradores').parentElement.insertAdjacentElement('afterend', participantsEl);
        }
        const colabsToShow = props.colaboradores || [];
        const attendeesToShow = props.attendees || [];
        const allParticipants = [...colabsToShow, ...attendeesToShow].reduce((acc, p) => {
            if (!acc.find(x => String(x.id) === String(p.id))) acc.push(p);
            return acc;
        }, []);
        
        if (allParticipants.length > 0) {
            participantsEl.innerHTML = `
                <div class="mb-4">
                    <label class="block text-[9px] font-black text-tealAccent uppercase tracking-[0.15em] mb-2"><i class="fa-solid fa-users mr-1"></i>Participantes</label>
                    <div class="flex flex-wrap gap-2">${allParticipants.map(p => {
                        const nm = p.nombre || p.name || p.email || '?';
                        const init = nm.charAt(0).toUpperCase();
                        return `<div class="flex items-center gap-2 bg-tealAccent/10 border border-tealAccent/20 rounded-xl px-3 py-1.5">
                            <div class="w-6 h-6 rounded-full bg-tealAccent/30 flex items-center justify-center flex-shrink-0"><span class="text-[9px] font-black text-tealAccent">${init}</span></div>
                            <span class="text-xs font-semibold text-gray-700 dark:text-gray-200">${nm}</span>
                        </div>`;
                    }).join('')}</div>
                </div>`;
        } else {
            participantsEl.innerHTML = '';
        }

        if (props.color) {
          const colorRadio = document.querySelector(`input[name="ev-color"][value="${props.color}"]`);
          if (colorRadio) colorRadio.checked = true;
        }

        document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = true);

        document.querySelectorAll('input[name="ev-depto"]').forEach(r => {
            r.checked = false;
            r.disabled = true;
        });
        if (props.departamentos && Array.isArray(props.departamentos)) {
            props.departamentos.forEach(d => {
                const dChk = document.querySelector(`input[name="ev-depto"][value="${d}"]`);
                if (dChk) dChk.checked = true;
            });
        }
    }

  } else {
    // ADD NEW EVENT MODE (Triggered genericlly)
    titleEl.innerHTML = `<i class="fa-solid fa-calendar-plus"></i> Añadir Evento`;
    btnGuardar.classList.remove('hidden');
    form.reset();
    // Clear read-only participants panel
    const oldParts = document.getElementById('ev-participantes-readonly');
    if (oldParts) oldParts.innerHTML = '';

    // Hide delete button in create mode
    const btnEliminar = document.getElementById('btn-eliminar-evento-admin');
    if (btnEliminar) {
      btnEliminar.classList.add('hidden');
      btnEliminar.dataset.eventId = '';
    }
    const btnEditar = document.getElementById('btn-editar-evento-admin');
    if (btnEditar) btnEditar.classList.add('hidden');

    // Reset ReadOnly and Hidden states
    document.getElementById('ev-nombre').readOnly = false;
    document.getElementById('ev-fecha-inicio').readOnly = false;
    document.getElementById('ev-fecha-fin').readOnly = false;
    document.getElementById('ev-fecha-fin').min = '';
    
    // Default dates if triggered by date click
    if (event && event.date) {
        const startInput = document.getElementById('ev-fecha-inicio');
        startInput.value = toLocalISOString(event.date);
        window.onStartDateChange(startInput); // auto-fill end date
    }



    document.getElementById('ev-direccion').readOnly = false;
    document.getElementById('ev-direccion').classList.remove('hidden');
    document.getElementById('ev-direccion-link').classList.add('hidden');

    document.getElementById('ev-descripcion').readOnly = false;
    
    document.getElementById('ev-adjunto').classList.remove('hidden');
    document.getElementById('ev-adjunto-link').classList.add('hidden');
    document.getElementById('ev-adjunto').parentElement.classList.remove('hidden');


    document.getElementById('ev-colaboradores').parentElement.classList.remove('hidden');

    document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = false);
    
    document.querySelectorAll('input[name="ev-depto"]').forEach(r => {
        r.disabled = false;
        r.checked = false;
    });

    // ââ‚¬ââ‚¬ Load collaborators as checkboxes with email for Google Calendar attendees ââ‚¬ââ‚¬
    const container = document.getElementById('ev-colaboradores-container');
    if (container) {
        container.innerHTML = '<p class="text-xs text-gray-400 italic">Cargando equipo...</p>';
        try {
            const workers = await getAdminWorkers();
            if (workers.length === 0) {
                container.innerHTML = '<p class="text-xs text-gray-400 italic">No hay colaboradores registrados.</p>';
            } else {
                container.innerHTML = workers.map(w => {
                    const fullName = `${w.nombre || ''} ${w.apellido || ''}`.trim();
                    const rol = w.rol || 'Sin rol';
                    const email = w.email || '';
                    const workerData = JSON.stringify({ id: w.id, nombre: fullName, email }).replace(/"/g, '&quot;');
                    return `
                    <label class="flex items-center gap-3 cursor-pointer group py-1.5 rounded-lg hover:bg-tealAccent/5 px-2 transition-all">
                        <input type="checkbox" 
                            class="ev-colab-chk w-4 h-4 rounded accent-teal-500 cursor-pointer flex-shrink-0" 
                            data-worker="${workerData}">
                        <div class="flex items-center gap-2 min-w-0">
                            <div class="w-6 h-6 rounded-full bg-tealAccent/20 border border-tealAccent/30 flex items-center justify-center flex-shrink-0">
                                <span class="text-[9px] font-black text-tealAccent">${fullName.charAt(0).toUpperCase()}</span>
                            </div>
                            <div class="min-w-0">
                                <p class="text-xs font-bold text-gray-800 dark:text-white truncate">${fullName} <span class="font-normal text-gray-400">(${rol})</span></p>
                                ${email ? `<p class="text-[9px] text-tealAccent/70 truncate">${email}</p>` : ''}
                            </div>
                        </div>
                    </label>`;
                }).join('');
            }
        } catch (err) {
            container.innerHTML = '<p class="text-xs text-red-400 italic">Error cargando colaboradores.</p>';
            console.error('[CALENDAR] Error loading workers:', err);
        }
    }
  }

  // ââ‚¬ââ‚¬ Google Places Autocomplete for address field (Exact match from mobile version) ââ‚¬ââ‚¬
  const evDirInput = document.getElementById('ev-direccion');
  const evMapPreview = document.getElementById('ev-map-preview');
  const evMapCanvas = document.getElementById('ev-map-canvas');

  if (evDirInput && window.google && window.google.maps) {
      const updateMiniMap = (lat, lng) => {
          if (evMapPreview) evMapPreview.classList.remove('hidden');
          if (!evDirInput._evMap) {
              evDirInput._evMap = new google.maps.Map(evMapCanvas, {
                  center: { lat, lng },
                  zoom: 15,
                  mapTypeId: 'roadmap',
                  disableDefaultUI: true,
                  gestureHandling: 'none',
                  styles: [
                      { elementType: 'geometry', stylers: [{ color: '#1a2035' }] },
                      { elementType: 'labels.text.fill', stylers: [{ color: '#00f5d4' }] },
                      { elementType: 'labels.text.stroke', stylers: [{ color: '#0a1628' }] },
                      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
                      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1f3c' }] },
                      { featureType: 'poi', stylers: [{ visibility: 'off' }] }
                  ]
              });
              evDirInput._evMarker = new google.maps.Marker({
                  position: { lat, lng },
                  map: evDirInput._evMap,
                  icon: {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 8,
                      fillColor: '#00f5d4',
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2
                  }
              });
          } else {
              evDirInput._evMap.setCenter({ lat, lng });
              evDirInput._evMarker.setPosition({ lat, lng });
              google.maps.event.trigger(evDirInput._evMap, 'resize');
          }
      };

      if (!evDirInput._placesInit && window.google.maps.places) {
          evDirInput._placesInit = true;
          const autocomplete = new google.maps.places.Autocomplete(evDirInput, {
              types: ['address'],
              fields: ['formatted_address', 'geometry', 'name']
          });

          autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace();
              if (place && place.geometry) {
                  const loc = place.geometry.location;
                  updateMiniMap(loc.lat(), loc.lng());
                  evDirInput.value = place.formatted_address || place.name || evDirInput.value;
              }
          });

          evDirInput.addEventListener('input', () => {
              if (!evDirInput.value.trim() && evMapPreview) {
                  evMapPreview.classList.add('hidden');
              }
          });
      }

      if (evDirInput.value.trim()) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ address: evDirInput.value }, (results, status) => {
              if (status === 'OK' && results[0].geometry) {
                  const loc = results[0].geometry.location;
                  updateMiniMap(loc.lat(), loc.lng());
              }
          });
      } else if (evMapPreview) {
          evMapPreview.classList.add('hidden');
      }
  }

  window.showModal(modal);
};

// ââ‚¬ââ‚¬ Eliminar Evento del Calendario (Admin) ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
window.eliminarEventoCalendarioAdmin = async function() {
  const btn = document.getElementById('btn-eliminar-evento-admin');
  const eventId = btn?.dataset?.eventId;

  if (!eventId) {
    showToast('No se pudo identificar el evento.', 'error');
    return;
  }

  if (!confirm('¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer.')) return;

  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    if (eventId.startsWith('bday_')) {
        const workerId = eventId.split('_')[1];
        const db = getDB();
        const worker = (db.Usuarios || []).find(w => String(w.id) === String(workerId));
        if (worker) {
            worker.dob = '';
            // Make sure saveGranular is available, or use saveDB
            const { saveGranular } = await import('./api.js');
            await saveGranular('Usuarios', [worker]);
        }
        showToast('Cumpleaños eliminado (fecha de nacimiento borrada)', 'success');
    } else {
        // Remove from local DB
        const db = getDB();
        if (db.calendario_eventos) {
          const idx = db.calendario_eventos.findIndex(e => String(e.id) === String(eventId));
          if (idx !== -1) db.calendario_eventos.splice(idx, 1);
        }

        // Sync deletion to Supabase
        try {
          const { deleteRecord } = await import('./api.js');
          await deleteRecord('calendario_eventos', eventId);
        } catch(syncErr) {
          console.warn('[CAL] Could not sync deletion to Supabase:', syncErr.message);
        }

        showToast('Evento eliminado correctamente.', 'success');
    }

    // Close modal and re-render calendar
    closeModals();
    if (typeof renderCalendario === 'function') renderCalendario();

  } catch(err) {
    console.error('[CAL] Error eliminando evento:', err);
    showToast('Error al eliminar el evento.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash-can"></i>'; }
  }
};
// ââ‚¬ââ‚¬ END Eliminar Evento ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬

window.switchEventToEditModeAdmin = function() {
    const btnGuardar = document.getElementById('btn-guardar-evento');
    const btnEditar = document.getElementById('btn-editar-evento-admin');
    const titleEl = document.getElementById('modo-texto');
    
    if(titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Evento`;
    if(btnGuardar) btnGuardar.classList.remove('hidden');
    if(btnEditar) btnEditar.classList.add('hidden');
    
    document.getElementById('ev-nombre').readOnly = false;
    document.getElementById('ev-fecha-inicio').readOnly = false;
    document.getElementById('ev-fecha-fin').readOnly = false;
    document.getElementById('ev-descripcion').readOnly = false;
    document.getElementById('ev-direccion').readOnly = false;
    document.getElementById('ev-direccion').classList.remove('hidden');
    const dirLink = document.getElementById('ev-direccion-link');
    if(dirLink) dirLink.classList.add('hidden');
    document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = false);
    document.querySelectorAll('input[name="ev-depto"]').forEach(r => r.disabled = false);
    
    const adjContainer = document.getElementById('ev-adjunto').parentElement;
    if(adjContainer) adjContainer.classList.remove('hidden');
    const colabContainer = document.getElementById('ev-colaboradores').parentElement;
    if(colabContainer) colabContainer.classList.remove('hidden');
    
    const oldParts = document.getElementById('ev-participantes-readonly');
    if (oldParts) oldParts.innerHTML = '';
};

window.guardarEventoCalendario = async function(e) {
  if (e) e.preventDefault();
  try {
    const btnGuardar = document.getElementById('btn-guardar-evento');
    btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    btnGuardar.disabled = true;

    const nombre = document.getElementById('ev-nombre').value;
    if (!nombre) { window.showToast('El nombre es obligatorio', 'error'); return; }

    const fechaInicioVal = document.getElementById('ev-fecha-inicio').value;
    if (!fechaInicioVal) { window.showToast('La fecha de inicio es obligatoria', 'error'); return; }

    const fecha_inicio = new Date(fechaInicioVal).toISOString();
    const fecha_fin_val = document.getElementById('ev-fecha-fin').value;
    const fecha_fin = fecha_fin_val ? new Date(fecha_fin_val).toISOString() : null;
    
    const telefono = null;
    const direccion = document.getElementById('ev-direccion').value;
    const descripcion = document.getElementById('ev-descripcion').value;
    const recordatorio = 'none';
    
    const colorNode = document.querySelector('input[name="ev-color"]:checked');
    let color = colorNode ? colorNode.value : 'Verde';
    const newToLegacy = { 'Cita': 'Verde', 'Hold': 'Amarillo', 'Reagendar': 'Azul', 'Cancelado': 'Rojo' };
    color = newToLegacy[color] || color;
    
    const departamentos = Array.from(document.querySelectorAll('input[name="ev-depto"]:checked')).map(el => el.value);
    
    // ââ‚¬ââ‚¬ Read collaborators from checkboxes (stores id + email for Google Calendar) ââ‚¬ââ‚¬
    const colaboradores = [];
    document.querySelectorAll('.ev-colab-chk:checked').forEach(chk => {
        try {
            const data = JSON.parse(chk.dataset.worker.replace(/&apos;/g, "'"));
            colaboradores.push(data); // { id, nombre, email }
        } catch(e) {
            colaboradores.push({ id: chk.dataset.worker, nombre: '', email: '' });
        }
    });

    // Derive attendees array ready for Google Calendar API
    const attendees = colaboradores
        .filter(c => c.email)
        .map(c => ({ email: c.email, displayName: c.nombre }));

    // Upload file through server endpoint (same pattern as other modules)
    let adjunto_url = null;
    const fileInput = document.getElementById('ev-adjunto');
    
    if (fileInput && fileInput.files.length > 0) {
      try {
        adjunto_url = await uploadFile(fileInput.files[0], 'calendario');
      } catch (uploadErr) {
        console.error('Error subiendo adjunto:', uploadErr);
        // Continue saving without the attachment
      }
    }

    const btnEliminar = document.getElementById('btn-eliminar-evento-admin');
    const existingId = btnEliminar ? btnEliminar.dataset.eventId : null;

    const nuevoEvento = {
      id: existingId || ('ev_' + Date.now()),
      created_at: new Date().toISOString(),
      nombre, fecha_inicio, fecha_fin, telefono, direccion, descripcion, color, adjunto_url,
      colaboradores,
      departamentos,
      attendees,
      notificacion_recordatorio: recordatorio !== 'none' ? recordatorio : null
    };

    // Save via getDB/saveDB (same cloud-sync pattern as every other module)
    const db = getDB();
    if (!db.calendario_eventos) db.calendario_eventos = [];
    
    const existingIdx = db.calendario_eventos.findIndex(ev => ev.id === nuevoEvento.id);
    if (existingIdx !== -1) {
        if (!adjunto_url && db.calendario_eventos[existingIdx].adjunto_url) {
            nuevoEvento.adjunto_url = db.calendario_eventos[existingIdx].adjunto_url;
        }
        db.calendario_eventos[existingIdx] = nuevoEvento;
    } else {
        db.calendario_eventos.push(nuevoEvento);
    }
    await saveDB(db);
    
    // ââ‚¬ââ‚¬ SYNC WITH GOOGLE CALENDAR VIA SERVER (SERVICE ACCOUNT) ââ‚¬ââ‚¬
    try {
        const CALENDAR_ID = 'c_0300a26935f9ffbe1772a440f9070fa95f02f551157e69bd0d71092777559943@group.calendar.google.com';
        
        const gEvent = {
            summary: nombre,
            location: direccion,
            description: descripcion,
            start: {
                dateTime: new Date(fecha_inicio).toISOString(),
                timeZone: 'America/New_York'
            },
            end: {
                dateTime: fecha_fin ? new Date(fecha_fin).toISOString() : new Date(new Date(fecha_inicio).getTime() + 3600000).toISOString(),
                timeZone: 'America/New_York'
            }
        };

        console.log('[RENEW-GCAL] Sending event to server for Google sync...', gEvent);
        
        const response = await fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                eventData: gEvent,
                calendarId: CALENDAR_ID
            })
        });

        const result = await response.json();
        if (response.ok) {
            console.log('[RENEW-GCAL] Server sync successful:', result);
        } else {
            console.warn('[RENEW-GCAL] Server sync failed:', result.error);
        }
    } catch (syncErr) {
        console.error('[RENEW-GCAL] Error communicating with sync server:', syncErr);
    }

    showToast('Evento guardado con éxito', 'success');
    window.closeModals();
    
    // Refresh calendar to show the new event
    if (window.currentCalendar) {
      window.currentCalendar.refetchEvents();
    }

  } catch (err) {
    console.error("Error guardando evento:", err);
    showToast('Ocurrió un error al guardar', 'error');
  } finally {
    const btnGuardar = document.getElementById('btn-guardar-evento');
    if (btnGuardar) {
      btnGuardar.innerHTML = 'Guardar Evento';
      btnGuardar.disabled = false;
    }
  }
};


function renderTable(headers, rows) {
  const headHtml = headers.map(h => `<th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] border-b border-gray-100 dark:border-white/5">${h}</th>`).join('');
  const bodyHtml = rows.map(r => `
    <tr class="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
      ${r.map((col, i) => `<td class="px-4 py-2.5 text-xs ${i===3?'text-gray-900 dark:text-white font-bold':'text-gray-500 dark:text-gray-400 font-medium'} max-w-[250px] overflow-hidden">${col}</td>`).join('')}
    </tr>
  `).join('');

  if (!UI.canvas) {
    console.error('[RENEW-ERROR] UI.canvas no está definido. Re-intentando cacheElements...');
    cacheElements();
  }

  if (UI.canvas) {
    UI.canvas.innerHTML = `
      <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-2xl shadow-premium overflow-hidden mt-4 overflow-x-auto custom-scrollbar">
        <table class="w-full text-xs">
          <thead class="bg-gray-50 dark:bg-white/[0.01]">${headHtml}</thead>
          <tbody class="divide-y divide-gray-100 dark:divide-white/5">${bodyHtml}</tbody>
        </table>
      </div>
    `;
  } else {
    console.error('[RENEW-CRITICAL] No se pudo renderizar la tabla: UI.canvas sigue siendo null.');
  }
}

function renderConstructor() {
  if (state.pipelines.length === 0) {
    UI.canvas.innerHTML = `<h2 class="text-gray-500 text-center py-20">No pipelines found. Create one above to start.</h2>`;
    return;
  }
  const tabsHtml = state.pipelines.map(p => {
    const rolesStr = (p.rolesConAcceso || []).join(', ') || 'Todos los rangos';
    return `
    <button class="pip-tab group relative px-8 py-5 rounded-t-2xl font-black text-xs uppercase tracking-widest border-t-2 transition-all ${p.id === state.activePipId ? 'bg-white dark:bg-darkCard border-tealAccent text-tealAccent' : 'bg-transparent border-transparent text-gray-400 dark:text-gray-600 hover:text-tealAccent'}" data-id="${p.id}">
      ${p.nombre}
      <span class="inline-flex items-center gap-1 ml-2">
        <i class="fa-solid fa-pen text-[9px] opacity-0 group-hover:opacity-100 hover:text-sky-400 transition-all cursor-pointer btn-edit-pip-roles" 
           data-pipid="${p.id}" data-pipnom="${p.nombre}"
           title="Editar permisos por rango: ${rolesStr}"
           style="pointer-events: auto !important;"></i>
        <i class="fa-solid fa-trash-can text-[10px] opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all cursor-pointer btn-delete-pipeline" 
           onclick="adminDeletePipeline('${p.id}', event)" 
           title="Delete Pipeline" style="pointer-events: auto !important;"></i>
      </span>
    </button>
  `;
  }).join('');


  const pFases = state.fases.filter(f => f.pipeline_id === state.activePipId).sort((a,b) => a.orden - b.orden);
  const activePipDetails = state.pipelines.find(p => p.id === state.activePipId);

  const fasesHtml = pFases.map(f => {
    const cCampos = state.campos.filter(c => c.fase_id === f.id);
    const camposHtml = cCampos.map(c => `
      <div class="campo-card flex items-center justify-between bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-3 rounded-lg mb-2 hover:border-tealAccent/40 transition-all group shadow-sm" 
           draggable="true" data-id="${c.id}" data-faseid="${f.id}">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <i class="fa-solid fa-grip-vertical text-gray-400 dark:text-gray-700 group-hover:text-tealAccent transition-colors cursor-move text-xs"></i>
          <div class="min-w-0 flex-1">
            <p class="text-gray-900 dark:text-white text-xs font-bold tracking-tight truncate flex items-center gap-2">
                ${c.etiqueta}
                ${c.es_opcional ? '<span class="px-1.5 py-0.5 rounded text-[8px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Opcional</span>' : ''}
            </p>
            <p class="text-[8.5px] uppercase font-black text-gray-400 dark:text-gray-600 mt-0.5">Input: <span class="text-tealAccent/80">${c.tipo}</span></p>
          </div>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <button class="btn-edit-campo text-gray-400 dark:text-gray-600 hover:text-sky-400 p-1 cursor-pointer" 
                  onclick="adminEditCampo('${c.id}', event)" title="Editar tipo" style="pointer-events: auto !important;">
            <i class="fa-solid fa-pen text-[10px]" style="pointer-events: none;"></i>
          </button>
          <button class="btn-delete-campo text-gray-400 dark:text-gray-600 hover:text-red-500 p-1 cursor-pointer" 
                  onclick="adminDeleteCampo('${c.id}', event)" style="pointer-events: auto !important;">
            <i class="fa-solid fa-trash-can text-[10px]" style="pointer-events: none;"></i>
          </button>
        </div>
      </div>
    `).join('');

    return `
      <div class="fase-card bg-white dark:bg-darkCard rounded-[1.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden min-w-[280px] max-w-[280px] shrink-0 transform transition-all hover:shadow-teal-glow flex flex-col" draggable="true" data-id="${f.id}" data-pipid="${state.activePipId}">
        <!-- Phase Header -->
        <div class="p-6 pb-4 flex flex-col justify-center relative group fase-drag-handle cursor-move">
          <div class="flex justify-between items-start w-full pointer-events-none">
            <div class="flex flex-col gap-1 pointer-events-auto">
              <div class="flex items-center gap-2">
                  <i class="fa-solid fa-grip text-gray-300 dark:text-gray-700 group-hover:text-tealAccent transition-colors text-xs pointer-events-auto"></i>
                  <span class="bg-tealAccent/10 text-tealAccent px-2 py-0.5 rounded border border-tealAccent/20 font-black text-[8px] uppercase tracking-[0.2em] w-fit">STATION ${f.orden}</span>
              </div>
              <h3 class="font-black text-gray-900 dark:text-white text-[1.1rem] leading-none tracking-tighter mt-1 flex items-center gap-2">
                ${f.nombre}
                <button onclick="adminEditFaseName('${f.id}', event)" class="text-gray-300 hover:text-tealAccent transition-colors p-1 cursor-pointer pointer-events-auto" title="Editar nombre">
                  <i class="fa-solid fa-pen text-[10px]" style="pointer-events: none;"></i>
                </button>
              </h3>
            </div>
            <div class="flex gap-2 relative z-20">
              <button class="btn-delete-fase text-gray-300 dark:text-gray-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2 cursor-pointer" 
                      onclick="adminDeleteFase('${f.id}', event)" 
                      title="Delete Station" style="pointer-events: auto !important;">
                <i class="fa-solid fa-trash-can text-sm" style="pointer-events: none;"></i>
              </button>
            </div>
          </div>
          <div class="mt-4 flex flex-col gap-2 border-t border-gray-100 dark:border-white/5 pt-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                  <i class="fa-solid fa-user-astronaut text-[9px] text-tealAccent"></i>
                </div>
                <select class="sel-fase-rol bg-transparent border-none text-[9px] font-black text-gray-400 dark:text-gray-500 p-0 focus:ring-0 cursor-pointer hover:text-tealAccent transition-colors uppercase tracking-[0.05em]" data-faseid="${f.id}">
                  <option value="Procesador" ${f.rol_encargado === 'Procesador' ? 'selected' : ''}>Oficina</option>
                  <option value="Vendedor" ${f.rol_encargado === 'Vendedor' ? 'selected' : ''}>Representante de Ventas</option>
                  <option value="Técnico" ${f.rol_encargado === 'Técnico' ? 'selected' : ''}>Técnicos</option>
                  <option value="Admin" ${f.rol_encargado === 'Admin' ? 'selected' : ''}>Administración</option>
                  <option value="Asignación Específica" ${f.rol_encargado === 'Asignación Específica' ? 'selected' : ''}>Asignación Específica</option>
                </select>
              </div>
              <p class="bg-tealAccent/5 text-tealAccent px-2 py-0.5 rounded border border-tealAccent/10 font-bold text-[8px] uppercase mb-0">N: ${cCampos.length}</p>
            </div>
            
            <div class="flex items-center justify-between">
              <div class="flex -space-x-2 overflow-hidden">
                ${(f.usuarios_especificos || []).map(uid => {
                  const u = (state.workers || []).find(w => w.id === uid);
                  if(!u) return '';
                  return `<div class="inline-block h-5 w-5 rounded-full ring-2 ring-white dark:ring-[#1a1a1a] bg-tealAccent flex items-center justify-center text-[7px] font-black text-white uppercase" title="${u.nombre}">${u.initials || u.nombre.substring(0,2)}</div>`;
                }).join('')}
              </div>
              ${f.rol_encargado === 'Asignación Específica' ? `
              <button class="btn-assign-users text-[8px] font-black text-tealAccent hover:underline uppercase tracking-widest" data-faseid="${f.id}">
                ${(f.usuarios_especificos || []).length > 0 ? 'Editar Usuarios' : '+ Asignar Usuarios'}
              </button>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="px-6 py-2 flex-1">
          <div class="space-y-1 min-h-[80px]">
            ${camposHtml || '<div class="text-center py-6 text-gray-400 dark:text-gray-700 text-[9px] font-black uppercase tracking-widest border-2 border-dashed border-gray-100 dark:border-white/5 rounded-xl opacity-50">Empty</div>'}
          </div>
        </div>

        <div class="p-6 pt-2">
          <button class="btn-add-campo w-full py-3 bg-gray-50 dark:bg-white/5 hover:bg-tealAccent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-black rounded-xl flex justify-center items-center gap-2 transition-all font-black text-[9px] uppercase tracking-[0.2em] border border-gray-100 dark:border-white/5" data-faseid="${f.id}" data-fasenom="${f.nombre}">
            <i class="fa-solid fa-plus text-[10px]"></i> Connect Field
          </button>
        </div>
      </div>
    `;
  }).join('');

  UI.canvas.style.overflowX = 'hidden'; 

  UI.canvas.innerHTML = `
    <div class="flex gap-4 border-b border-gray-100 dark:border-white/5 mb-10 overflow-x-auto hide-scrollbar">
      ${tabsHtml}
    </div>
    
    <div class="scroll-container-fases flex flex-nowrap gap-6 pb-24 items-start scroll-smooth overflow-x-auto custom-h-scrollbar" id="phases-wrapper" style="width: 100%; max-width: 100%;">
      ${fasesHtml}
      <div class="shrink-0 pt-0 px-2 flex items-center justify-center">
        <button id="btn-add-fase" class="border flex-col border-dashed border-gray-200 dark:border-white/10 hover:border-tealAccent/40 text-gray-400 dark:text-gray-600 hover:text-tealAccent rounded-3xl min-w-[240px] h-[160px] flex items-center justify-center gap-3 transition-all shrink-0 font-black text-sm uppercase tracking-widest group bg-white dark:bg-white/[0.01]">
          <i class="fa-solid fa-plus group-hover:scale-125 transition-transform text-xl"></i> New Stage
        </button>
      </div>
    </div>
  `;

  // Control fixed root arrows
  setTimeout(() => {
    const wrap = document.getElementById('phases-wrapper');
    const l = document.getElementById('ctrl-scroll-left');
    const r = document.getElementById('ctrl-scroll-right');
    if (!wrap || !l || !r) return;

    // Always make arrows visible initially by using Tailwind classes
    l.classList.remove('hidden');
    r.classList.remove('hidden');

    let move;
    l.onmouseenter = () => { move = setInterval(() => { wrap.scrollLeft -= 15; updateArrows(); }, 16); };
    r.onmouseenter = () => { move = setInterval(() => { wrap.scrollLeft += 15; updateArrows(); }, 16); };
    [l, r].forEach(btn => btn.onmouseleave = () => clearInterval(move));

    function updateArrows() {
      const wrapDyn = document.getElementById('phases-wrapper');
      if (!wrapDyn || !l || !r) return;
      const maxScroll = wrapDyn.scrollWidth - wrapDyn.clientWidth;

      const atStart = wrapDyn.scrollLeft <= 10;
      const atEnd = wrapDyn.scrollLeft >= maxScroll - 10;

      if (atStart) {
          l.classList.add('opacity-0', 'pointer-events-none');
          l.classList.remove('opacity-100', 'pointer-events-auto');
      } else {
          l.classList.remove('opacity-0', 'pointer-events-none');
          l.classList.add('opacity-100', 'pointer-events-auto');
      }

      if (atEnd) {
          r.classList.add('opacity-0', 'pointer-events-none');
          r.classList.remove('opacity-100', 'pointer-events-auto');
      } else {
          r.classList.remove('opacity-0', 'pointer-events-none');
          r.classList.add('opacity-100', 'pointer-events-auto');
      }
    }
    wrap.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);

    // Robust observation
    if (window._pipelineArrowInterval) clearInterval(window._pipelineArrowInterval);
    window._pipelineArrowInterval = setInterval(updateArrows, 500);
    updateArrows();
  }, 400);

  initDragAndDrop();
}
async function openFaseUserPicker(faseId) {
  const fase = state.fases.find(f => f.id === faseId);
  if (!fase) return;
  
  const modal = document.getElementById('modal-fase-users-picker');
  const list = document.getElementById('fase-users-list');
  const btnConfirm = document.getElementById('btn-confirm-fase-users');
  
  if (!modal || !list || !btnConfirm) return;
  
  const assigned = fase.usuarios_especificos || [];
  const workers = state.workers || [];
  
  list.innerHTML = workers.map(u => `
    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-2xl hover:bg-tealAccent/5 transition-colors border border-transparent hover:border-tealAccent/20">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-tealAccent flex items-center justify-center text-[10px] font-black text-white uppercase">${u.initials || u.nombre.substring(0,2)}</div>
        <div>
          <p class="text-[11px] font-bold text-gray-800 dark:text-white leading-tight">${u.nombre} ${u.apellido || ''}</p>
          <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest">${u.rol || 'Sin Rol'}</p>
        </div>
      </div>
      <input type="checkbox" class="fase-user-check w-5 h-5 rounded border-gray-300 text-tealAccent focus:ring-tealAccent" value="${u.id}" ${assigned.includes(u.id) ? 'checked' : ''}>
    </div>
  `).join('');
  
  btnConfirm.onclick = async () => {
    const checks = list.querySelectorAll('.fase-user-check:checked');
    const selectedIds = Array.from(checks).map(c => c.value);
    
    console.log('[DEBUG] Saving phase users:', faseId, selectedIds);
    
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
    
    try {
      // 1. Guardar en DB
      await updateAdminFaseUsers(faseId, selectedIds);
      
      // 2. Cerrar Modal
      if (typeof window.closeModals === 'function') {
        window.closeModals();
      } else {
        modal.classList.add('nuclear-hidden');
      }
      
      showToast('Asignación de usuarios actualizada', 'success');
      
      // 3. Recargar datos y refrescar UI
      await loadData();
      renderConstructor();
      
    } catch (err) {
      console.error('[ERROR] Failed to save phase users:', err);
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = 'Confirmar Asignación';
    }
  };
  
  modal.classList.remove('nuclear-hidden');
}

window.openFaseUserPicker = openFaseUserPicker;

function initDragAndDrop() {
  let draggedId = null;
  let draggedFaseId = null;

  document.querySelectorAll('.campo-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedId = card.dataset.id;
      draggedFaseId = card.dataset.faseid;
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('opacity-50', 'scale-95');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('opacity-50', 'scale-95');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      const currentFaseId = card.dataset.faseid;
      if (currentFaseId === draggedFaseId) {
        card.classList.add('border-tealAccent');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('border-tealAccent');
    });

    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      card.classList.remove('border-tealAccent');
      
      const targetId = card.dataset.id;
      const targetFaseId = card.dataset.faseid;

      if (draggedId && targetId !== draggedId && draggedFaseId === targetFaseId) {
        // Reorder in same fase
        const phaseCampos = state.campos.filter(c => c.fase_id === targetFaseId);
        const draggedIdx = phaseCampos.findIndex(c => c.id === draggedId);
        const targetIdx = phaseCampos.findIndex(c => c.id === targetId);
        
        const newOrder = [...phaseCampos];
        const [moved] = newOrder.splice(draggedIdx, 1);
        newOrder.splice(targetIdx, 0, moved);

        await reorderAdminCampos(targetFaseId, newOrder.map(c => c.id));
        await loadData();
        renderView();
      }
    });
  });

  // DRAG AND DROP FOR FASES (STATIONS)
  let draggedFaseContainerId = null;
  let draggedPipId = null;

  document.querySelectorAll('.fase-card').forEach(faseCard => {
    faseCard.addEventListener('dragstart', (e) => {
      // Only drag the phase if we click near the top header, avoid dragging when interacting with fields inside
      if (e.target.closest('.campo-card')) {
         e.preventDefault();
         return;
      }
      draggedFaseContainerId = faseCard.dataset.id;
      draggedPipId = faseCard.dataset.pipid;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => faseCard.classList.add('opacity-50', 'scale-95'), 0);
    });

    faseCard.addEventListener('dragend', () => {
      faseCard.classList.remove('opacity-50', 'scale-95');
      draggedFaseContainerId = null;
      draggedPipId = null;
    });

    faseCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      // Solo resaltar si estamos arrastrando una fase, no un campo
      if (draggedFaseContainerId && draggedPipId === faseCard.dataset.pipid && draggedFaseContainerId !== faseCard.dataset.id) {
        faseCard.classList.add('border-tealAccent', 'scale-[1.02]');
      }
    });

    faseCard.addEventListener('dragleave', () => {
      faseCard.classList.remove('border-tealAccent', 'scale-[1.02]');
    });

    faseCard.addEventListener('drop', async (e) => {
      e.preventDefault();
      faseCard.classList.remove('border-tealAccent', 'scale-[1.02]');
      
      const targetId = faseCard.dataset.id;
      const targetPipId = faseCard.dataset.pipid;

      if (draggedFaseContainerId && targetId !== draggedFaseContainerId && draggedPipId === targetPipId) {
        // Reorder phases
        const pipFases = state.fases.filter(f => f.pipeline_id === targetPipId).sort((a,b) => a.orden - b.orden);
        const draggedIdx = pipFases.findIndex(f => f.id === draggedFaseContainerId);
        const targetIdx = pipFases.findIndex(f => f.id === targetId);
        
        const newOrder = [...pipFases];
        const [moved] = newOrder.splice(draggedIdx, 1);
        newOrder.splice(targetIdx, 0, moved);

        await reorderAdminFases(targetPipId, newOrder.map(f => f.id));
        await loadData();
        renderView();
      }
    });
  });
}

window.showWorkerDetail = showWorkerDetail;
window.toggleDetailEditMode = toggleDetailEditMode;
async function showWorkerDetail(id) {
    const workers = await getAdminWorkers();
    const usr = workers.find(u => u.id === id);
    if (!usr) return;

    const initials = usr.initials || (usr.nombre ? usr.nombre[0] : '?');

    // Exit any existing edit mode
    exitDetailEditMode();

    // Fill Modal with VIEW mode content
    document.getElementById('det-usr-nombre').textContent = usr.nombre || '-';
    document.getElementById('det-usr-apellido').textContent = usr.apellido || '-';
    document.getElementById('det-usr-email').textContent = usr.email || '-';
    document.getElementById('det-usr-rol').textContent = usr.rol || '-';
    // Update Rank Display
    let usrRango = usr.rango || 'auto';
    if (usrRango === 'novato') usrRango = 'auto'; // Legacy migration
    let displayRank = usrRango;
    
    if (displayRank === 'auto') {
        try {
            const { computeUserRank } = await import('./screens/dashboard.js');
            const db = getDB();
            const rankInfo = computeUserRank(id, 'Renew Water', db);
            if (rankInfo && rankInfo.cur) {
                displayRank = rankInfo.cur.name + ' (Automático)';
            } else {
                displayRank = 'Nuevo (Automático)';
            }
        } catch(e) {
            displayRank = 'Automático';
        }
    } else {
        const rankMap = {
            'referidos': 'Nuevo',
            'subvendedor': 'Novato',
            'iniciante': 'Iniciante',
            'junior': 'Junior',
            'representante': 'Representante de Ventas',
            'analista': 'Distribuidor (Analista)'
        };
        displayRank = (rankMap[displayRank] || displayRank) + ' (Manual)';
    }
    document.getElementById('det-usr-rank').textContent = displayRank;
    // Hide rank if not (Vendedor/Representante de Ventas)
    const viewRankContainer = document.getElementById('det-view-rank-container');
    const editRankContainer = document.getElementById('det-edit-rank-container');
    const isVendedor = usr.rol === 'Vendedor' || usr.rol === 'Representante de Ventas';
    if (viewRankContainer) {
        viewRankContainer.style.display = isVendedor ? 'block' : 'none';
    }
    if (editRankContainer) {
        editRankContainer.style.display = isVendedor ? 'block' : 'none';
    }

    document.getElementById('det-usr-dept').textContent = usr.department || 'Grupo Renew';
    document.getElementById('det-usr-sede').textContent = usr.sede || '-';
    document.getElementById('det-usr-tel').textContent = usr.telefono || '-';
    if (document.getElementById('det-usr-sip-id')) document.getElementById('det-usr-sip-id').textContent = usr.zadarma_sip_id || '-';
    document.getElementById('det-usr-tel-emergencia').textContent = usr.tel_emergencia || '-';
    if (document.getElementById('det-usr-contacto-emergencia-nombre')) document.getElementById('det-usr-contacto-emergencia-nombre').textContent = usr.contacto_emergencia_nombre || '-';
    document.getElementById('det-usr-direccion').textContent = usr.direccion || '-';
    document.getElementById('det-usr-zelle-nombre').textContent = usr.zelle_nombre || '-';
    document.getElementById('det-usr-zelle-cuenta').textContent = usr.zelle_cuenta || '-';
    document.getElementById('det-usr-zelle-tel').textContent    = usr.zelle_tel    || '-';
    // Bank info
    if (document.getElementById('det-usr-banco-nombre')) document.getElementById('det-usr-banco-nombre').textContent = usr.banco_nombre || '-';
    if (document.getElementById('det-usr-banco-cuenta')) document.getElementById('det-usr-banco-cuenta').textContent = usr.banco_cuenta || '-';
    if (document.getElementById('det-usr-banco-ruta'))   document.getElementById('det-usr-banco-ruta').textContent   = usr.banco_ruta   || '-';

    // Format DOB for view mode (mes dia año)
    const dobViewEl = document.getElementById('det-usr-dob-view');
    if (dobViewEl) {
        if (usr.dob && usr.dob.includes('-')) {
            const parts = usr.dob.split('-');
            if (parts.length === 3) {
                const [y, m, d] = parts;
                dobViewEl.textContent = `${m}/${d}/${y}`;
            } else {
                dobViewEl.textContent = usr.dob;
            }
        } else {
            dobViewEl.textContent = usr.dob || '-';
        }
    }

    // ââ‚¬ââ‚¬ Interactive Documentation Zones ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
    const docsZone = document.getElementById('det-usr-docs-interactive');
    if (docsZone) {
        const renderDocBtn = (type, label, url, icon) => {
            const isLoaded = !!url;
            return `
                <div class="relative border-2 ${isLoaded ? 'border-tealAccent bg-tealAccent/5' : 'border-dashed border-gray-200'} rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-gray-50 group overflow-hidden" onclick="document.getElementById('view-upload-${type}').click()">
                    <input type="file" id="view-upload-${type}" class="hidden" accept=".pdf,image/*" onchange="window.handleInstantDocUpload(event, '${id}', '${type}')">
                    ${isLoaded ? `
                        <i class="fa-solid fa-circle-check text-xl text-tealAccent mb-2"></i>
                        <p class="text-[9px] font-black text-tealAccent uppercase tracking-widest mb-1">Cargado</p>
                        <div class="flex items-center gap-2 mt-1">
                            <button onclick="event.stopPropagation(); window.openW9File('${url}')" class="text-[8px] text-sky-500 hover:underline uppercase font-bold bg-transparent border-none cursor-pointer p-0"><i class="fa-solid fa-eye text-[7px]"></i> Ver</button>
                            <span class="text-[8px] text-gray-300">|</span>
                            <span class="text-[8px] text-gray-400 group-hover:text-tealAccent transition-colors">Reemplazar</span>
                        </div>
                    ` : `
                        <i class="fa-solid ${icon} text-xl text-gray-300 group-hover:text-tealAccent transition-colors mb-2"></i>
                        <p class="text-[9px] font-black text-gray-400 group-hover:text-tealAccent uppercase tracking-widest">Subir ${label}</p>
                    `}
                </div>
            `;
        };

        docsZone.innerHTML = `
            ${renderDocBtn('w9', 'W-9', (usr.w9Url || usr.w9_url), 'fa-file-invoice')}
            ${renderDocBtn('carnet', 'Carnet', (usr.carnet_url || usr.carnetUrl), 'fa-id-card')}
            ${renderDocBtn('contrato', 'Contrato', (usr.contrato_url || usr.contratoUrl), 'fa-file-signature')}
            ${state.activeView === 'hrhub' ? `
            <div class="doc-btn group relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-dashed border-purple-200 cursor-pointer transition-all hover:border-purple-400 hover:bg-purple-50/50 min-h-[90px]"
              onclick="window._verRecibosWorker('${id}','${(usr.nombre||'')} ${(usr.apellido||'')}','${(usr.rol||'')}')">
              <i class="fa-solid fa-receipt text-xl text-purple-400 group-hover:text-purple-600 transition-colors mb-2"></i>
              <p class="text-[9px] font-black text-purple-400 group-hover:text-purple-600 uppercase tracking-widest">Recibos</p>
            </div>
            <div class="doc-btn group relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-dashed border-teal-200 cursor-pointer transition-all hover:border-teal-400 hover:bg-teal-50/50 min-h-[90px]"
              onclick="window._verAdelantosWorker('${id}','${(usr.nombre||'')} ${(usr.apellido||'')}')">
              <i class="fa-solid fa-hand-holding-dollar text-xl text-teal-400 group-hover:text-teal-600 transition-colors mb-2"></i>
              <p class="text-[9px] font-black text-teal-400 group-hover:text-teal-600 uppercase tracking-widest">Adelantos</p>
            </div>
            ` : ''}
        `;
    }
    // ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬

    // Toggle RRHH-only sections based on current view
    const isRRHHView = window.location.hash.includes('rrhh') || window.location.hash.includes('hrhub');
    const rrhhOnlyContainer = document.getElementById('det-usr-rrhh-only');
    if (rrhhOnlyContainer) {
        rrhhOnlyContainer.style.display = isRRHHView ? 'block' : 'none';
    }

    const avatarBox = document.getElementById('det-usr-avatar');
    if (usr.foto) {
        avatarBox.style.backgroundImage = `url(${usr.foto})`;
        avatarBox.innerHTML = '';
    } else {
        avatarBox.style.backgroundImage = 'none';
        avatarBox.innerHTML = `<span class="text-6xl text-gray-200 font-black">${initials}</span>`;
    }

    if(UI.btnEditFromDetail) UI.btnEditFromDetail.dataset.id = id;

    // Show/hide gear based on current user role
    const currentUser = (() => {
        try { return JSON.parse(localStorage.getItem('rs_user') || '{}'); } catch(e) { return {}; }
    })();
    const currentRol = (currentUser.rol || '').toLowerCase();
    const canEdit = currentRol === 'ceo' || currentRol === 'admin' || currentRol === 'administrador';
    if (UI.btnEditFromDetail) {
        UI.btnEditFromDetail.style.display = canEdit ? 'flex' : 'none';
    }

    state.currentUsrFoto = usr.foto;
    state.currentUsrW9Url = usr.w9Url;

    // Action Buttons logic
    const btnUsrEmail = document.getElementById('btn-usr-email');
    if (btnUsrEmail && usr.email) {
        btnUsrEmail.onclick = () => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${usr.email}`, '_blank');
    }

    window.showModal(UI.modUsrDetail);
}

function exitDetailEditMode() {
    const editPanel = document.getElementById('det-edit-panel');
    const viewPanel = document.getElementById('det-view-panel');
    const saveBar = document.getElementById('det-save-bar');
    const gearBtn = document.getElementById('btn-edit-worker-from-detail');
    if (editPanel) editPanel.classList.add('hidden');
    if (viewPanel) viewPanel.classList.remove('hidden');
    if (saveBar) saveBar.classList.add('hidden');
    if (gearBtn) {
        gearBtn.classList.remove('text-tealAccent', 'bg-tealAccent/10', 'rotate-45');
        gearBtn.title = 'Editar información';
    }
}

async function toggleDetailEditMode(id) {
    const workers = await getAdminWorkers();
    const usr = workers.find(u => u.id === id);
    if (!usr) return;

    const editPanel = document.getElementById('det-edit-panel');
    const viewPanel = document.getElementById('det-view-panel');
    const saveBar = document.getElementById('det-save-bar');
    const gearBtn = document.getElementById('btn-edit-worker-from-detail');

    const isEditing = editPanel && !editPanel.classList.contains('hidden');

    if (isEditing) {
        // Cancel â ™ return to view mode
        exitDetailEditMode();
        // Restore view data
        document.getElementById('det-usr-nombre').textContent = usr.nombre || '-';
        document.getElementById('det-usr-apellido').textContent = usr.apellido || '-';
        document.getElementById('det-usr-email').textContent = usr.email || '-';
        // Restore rank display
        let usrRango = usr.rango || 'auto';
        if (usrRango === 'novato') usrRango = 'auto';
        let displayRank = usrRango;
        if (displayRank === 'auto') {
            try {
                const { computeUserRank } = await import('./screens/dashboard.js');
                const db = getDB();
                const rankInfo = computeUserRank(id, 'Renew Water', db);
                if (rankInfo && rankInfo.cur) {
                    displayRank = rankInfo.cur.name + ' (Automático)';
                } else {
                    displayRank = 'Nuevo (Automático)';
                }
            } catch(e) {
                displayRank = 'Automático';
            }
        } else {
            const rankMap = {
                'referidos': 'Nuevo',
                'subvendedor': 'Novato',
                'iniciante': 'Iniciante',
                'junior': 'Junior',
                'representante': 'Representante de Ventas',
                'analista': 'Distribuidor (Analista)'
            };
            displayRank = (rankMap[displayRank] || displayRank) + ' (Manual)';
        }
        document.getElementById('det-usr-rank').textContent = displayRank;
        document.getElementById('det-usr-tel').textContent = usr.telefono || '-';
        if (document.getElementById('det-usr-sip-id')) document.getElementById('det-usr-sip-id').textContent = usr.zadarma_sip_id || '-';
        return;
    }

    // Enter edit mode
    if (viewPanel) viewPanel.classList.add('hidden');
    if (editPanel) {
        editPanel.classList.remove('hidden');
        // Populate edit fields
        document.getElementById('det-edit-nombre').value = usr.nombre || '';
        document.getElementById('det-edit-apellido').value = usr.apellido || '';
        document.getElementById('det-edit-email').value = usr.email || '';
        
        const pParts = (usr.telefono || '').split(' ');
        const ccEl = document.getElementById('det-edit-cc');
        const telEl = document.getElementById('det-edit-tel');
        
        if (ccEl) {
            if (pParts.length > 1 && pParts[0].startsWith('+')) {
                ccEl.value = pParts[0];
            } else {
                ccEl.value = '+1';
            }
        }
        
        if (telEl) {
            if (pParts.length > 1 && pParts[0].startsWith('+')) {
                telEl.value = pParts.slice(1).join(' ');
            } else {
                telEl.value = usr.telefono || '';
            }
        }
        
        // Apply flatpickr first so we can use its API if needed
        if (window.initDatePickers) window.initDatePickers();

        if (document.getElementById('det-edit-id')) document.getElementById('det-edit-id').value = usr.id;
        if (document.getElementById('det-edit-sede')) document.getElementById('det-edit-sede').value = usr.sede || 'orlando';
        if (document.getElementById('det-edit-dob')) {
            const dobEl = document.getElementById('det-edit-dob');
            let dobVal = usr.dob || '';
            // Ensure format is YYYY-MM-DD for date input
            if (dobVal && dobVal.includes('/')) {
                const parts = dobVal.split('/');
                if (parts.length === 3) {
                    // Assume MM/DD/YYYY and convert to YYYY-MM-DD
                    dobVal = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                }
            }
            
            if (dobEl._flatpickr) {
                dobEl._flatpickr.setDate(dobVal, true); // true to trigger onChange
            } else {
                dobEl.value = dobVal;
            }
        }
        if (document.getElementById('det-edit-dept')) document.getElementById('det-edit-dept').value = usr.department || '';
        
        const sipIdEl = document.getElementById('det-edit-sip-id');
        if (sipIdEl) sipIdEl.value = usr.zadarma_sip_id || '';
        
        const rolEl = document.getElementById('det-edit-rol');
        if (rolEl) {
            let roleVal = usr.rol || 'Vendedor';
            if (roleVal === 'Supervisión') roleVal = 'Supervisor'; // Migration
            if (roleVal === 'Manager de Ventas' || roleVal === 'Account Manager') roleVal = 'Project Manager'; // Migration
            rolEl.value = roleVal;
            
            const equipoCont = document.getElementById('det-edit-equipo-container');
            const pipesCont = document.getElementById('det-edit-pipelines-container');
            
            if (equipoCont) {
                equipoCont.classList.toggle('hidden', roleVal !== 'Supervisor');
                // Renderizar checkboxes de vendedores
                const equipoChks = document.getElementById('equipo-checkboxes');
                if (equipoChks) {
                    equipoChks.innerHTML = '';
                    const vendedores = workers.filter(w => w.rol === 'Vendedor' || w.rol === 'Representante de Ventas');
                    const selectedIds = usr.equipo_ids || [];
                    vendedores.forEach(vend => {
                        const lbl = document.createElement('label');
                        lbl.className = 'flex items-center gap-2 cursor-pointer';
                        const chk = document.createElement('input');
                        chk.type = 'checkbox';
                        chk.className = 'w-4 h-4 text-blue-500 rounded focus:ring-blue-500 rep-equipo-chk';
                        chk.value = vend.id;
                        chk.checked = selectedIds.includes(vend.id);
                        
                        const span = document.createElement('span');
                        span.className = 'text-sm text-gray-700';
                        span.textContent = `${vend.nombre || ''} ${vend.apellido || ''}`.trim();
                        
                        lbl.appendChild(chk);
                        lbl.appendChild(span);
                        equipoChks.appendChild(lbl);
                    });
                }
            }
            
            if (pipesCont) {
                pipesCont.classList.toggle('hidden', roleVal !== 'Project Manager');
                const selectedPipes = usr.pipeline_ids || [];
                document.querySelectorAll('.pm-pipeline-chk').forEach(chk => {
                    chk.checked = selectedPipes.includes(chk.value);
                });
            }
        }
        
        if (document.getElementById('chk-unit-solar')) {
            document.getElementById('chk-unit-solar').checked = usr.unidades ? usr.unidades.includes('Renew Solar') : false;
        }
        if (document.getElementById('chk-unit-water')) {
            document.getElementById('chk-unit-water').checked = usr.unidades ? usr.unidades.includes('Renew Water') : false;
        }
        if (document.getElementById('det-edit-rank')) {
            let rv = usr.rango || 'auto';
            if (rv === 'novato') rv = 'auto'; // legacy migration
            document.getElementById('det-edit-rank').value = rv;
        }
        if (document.getElementById('det-edit-pass')) document.getElementById('det-edit-pass').value = usr.password || usr.pass || 'renew123';
        
        // Populate new fields
        if (document.getElementById('det-edit-direccion')) document.getElementById('det-edit-direccion').value = usr.direccion || '';
        if (document.getElementById('det-edit-tel-emergencia')) document.getElementById('det-edit-tel-emergencia').value = usr.tel_emergencia || '';
        if (document.getElementById('det-edit-contacto-emergencia-nombre')) document.getElementById('det-edit-contacto-emergencia-nombre').value = usr.contacto_emergencia_nombre || '';
        if (document.getElementById('det-edit-zelle-nombre')) document.getElementById('det-edit-zelle-nombre').value = usr.zelle_nombre || '';
        if (document.getElementById('det-edit-zelle-cuenta')) document.getElementById('det-edit-zelle-cuenta').value = usr.zelle_cuenta || '';
        if (document.getElementById('det-edit-zelle-tel')) document.getElementById('det-edit-zelle-tel').value = usr.zelle_tel || '';
        // Bank info pre-fill
        if (document.getElementById('det-edit-banco-nombre')) document.getElementById('det-edit-banco-nombre').value = usr.banco_nombre || '';
        if (document.getElementById('det-edit-banco-cuenta')) document.getElementById('det-edit-banco-cuenta').value = usr.banco_cuenta || '';
        if (document.getElementById('det-edit-banco-ruta'))   document.getElementById('det-edit-banco-ruta').value   = usr.banco_ruta   || '';

        // ââ‚¬ââ‚¬ Pre-fill W-9 state in edit panel ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
        state.detEditW9Url = usr.w9Url || usr.w9_url || null;
        const detW9Placeholder = document.getElementById('det-edit-w9-placeholder');
        const detW9Success = document.getElementById('det-edit-w9-success');
        const detW9FileName = document.getElementById('det-edit-w9-file-name');
        const detW9Inp = document.getElementById('det-edit-inp-w9-file');
        if (state.detEditW9Url) {
            if (detW9Placeholder) detW9Placeholder.classList.add('hidden');
            if (detW9Success) { detW9Success.classList.remove('hidden'); detW9Success.classList.add('flex'); }
            if (detW9FileName) detW9FileName.textContent = 'Archivo existente \u2713';
        } else {
            if (detW9Placeholder) detW9Placeholder.classList.remove('hidden');
            if (detW9Success) { detW9Success.classList.add('hidden'); detW9Success.classList.remove('flex'); }
            if (detW9Inp) detW9Inp.value = '';
        }
        window.clearDetEditW9 = function() {
            state.detEditW9Url = null;
            if (detW9Placeholder) detW9Placeholder.classList.remove('hidden');
            if (detW9Success) { detW9Success.classList.add('hidden'); detW9Success.classList.remove('flex'); }
            if (detW9Inp) detW9Inp.value = '';
        };
        if (detW9Inp) {
            const newInp = detW9Inp.cloneNode(true);
            detW9Inp.parentNode.replaceChild(newInp, detW9Inp);
            newInp.addEventListener('change', async () => {
                const file = newInp.files[0];
                if (!file) return;
                try {
                    showToast('Subiendo W-9...', 'info');
                    const fileUrl = await uploadFile(file, 'documents');
                    state.detEditW9Url = fileUrl;
                    if (detW9FileName) detW9FileName.textContent = file.name;
                    if (detW9Placeholder) detW9Placeholder.classList.add('hidden');
                    if (detW9Success) { detW9Success.classList.remove('hidden'); detW9Success.classList.add('flex'); }
                    showToast('W-9 subido', 'success');
                } catch(e) {
                    showToast('Error subiendo archivo', 'error');
                }
            });
        }

        // ââ‚¬ââ‚¬ Pre-fill Carnet state ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
        state.detEditCarnetUrl = usr.carnet_url || usr.carnetUrl || null;
        const detCarnetPlaceholder = document.getElementById('det-edit-carnet-placeholder');
        const detCarnetSuccess = document.getElementById('det-edit-carnet-success');
        const detCarnetFileName = document.getElementById('det-edit-carnet-file-name');
        const detCarnetInp = document.getElementById('det-edit-inp-carnet-file');
        if (state.detEditCarnetUrl) {
            if (detCarnetPlaceholder) detCarnetPlaceholder.classList.add('hidden');
            if (detCarnetSuccess) { detCarnetSuccess.classList.remove('hidden'); detCarnetSuccess.classList.add('flex'); }
            if (detCarnetFileName) detCarnetFileName.textContent = 'Archivo existente \u2713';
        } else {
            if (detCarnetPlaceholder) detCarnetPlaceholder.classList.remove('hidden');
            if (detCarnetSuccess) { detCarnetSuccess.classList.add('hidden'); detCarnetSuccess.classList.remove('flex'); }
            if (detCarnetInp) detCarnetInp.value = '';
        }
        window.clearDetEditCarnet = function() {
            state.detEditCarnetUrl = null;
            if (detCarnetPlaceholder) detCarnetPlaceholder.classList.remove('hidden');
            if (detCarnetSuccess) { detCarnetSuccess.classList.add('hidden'); detCarnetSuccess.classList.remove('flex'); }
            if (detCarnetInp) detCarnetInp.value = '';
        };
        if (detCarnetInp) {
            const newInp = detCarnetInp.cloneNode(true);
            detCarnetInp.parentNode.replaceChild(newInp, detCarnetInp);
            newInp.addEventListener('change', async () => {
                const file = newInp.files[0];
                if (!file) return;
                try {
                    showToast('Subiendo Carnet...', 'info');
                    const fileUrl = await uploadFile(file, 'documents');
                    state.detEditCarnetUrl = fileUrl;
                    if (detCarnetFileName) detCarnetFileName.textContent = file.name;
                    if (detCarnetPlaceholder) detCarnetPlaceholder.classList.add('hidden');
                    if (detCarnetSuccess) { detCarnetSuccess.classList.remove('hidden'); detCarnetSuccess.classList.add('flex'); }
                    showToast('Carnet subido', 'success');
                } catch(e) {
                    showToast('Error subiendo archivo', 'error');
                }
            });
        }

        // ââ‚¬ââ‚¬ Pre-fill Contrato state ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
        state.detEditContratoUrl = usr.contrato_url || usr.contratoUrl || null;
        const detContratoPlaceholder = document.getElementById('det-edit-contrato-placeholder');
        const detContratoSuccess = document.getElementById('det-edit-contrato-success');
        const detContratoFileName = document.getElementById('det-edit-contrato-file-name');
        const detContratoInp = document.getElementById('det-edit-inp-contrato-file');
        if (state.detEditContratoUrl) {
            if (detContratoPlaceholder) detContratoPlaceholder.classList.add('hidden');
            if (detContratoSuccess) { detContratoSuccess.classList.remove('hidden'); detContratoSuccess.classList.add('flex'); }
            if (detContratoFileName) detContratoFileName.textContent = 'Archivo existente \u2713';
        } else {
            if (detContratoPlaceholder) detContratoPlaceholder.classList.remove('hidden');
            if (detContratoSuccess) { detContratoSuccess.classList.add('hidden'); detContratoSuccess.classList.remove('flex'); }
            if (detContratoInp) detContratoInp.value = '';
        }
        window.clearDetEditContrato = function() {
            state.detEditContratoUrl = null;
            if (detContratoPlaceholder) detContratoPlaceholder.classList.remove('hidden');
            if (detContratoSuccess) { detContratoSuccess.classList.add('hidden'); detContratoSuccess.classList.remove('flex'); }
            if (detContratoInp) detContratoInp.value = '';
        };
        if (detContratoInp) {
            const newInp = detContratoInp.cloneNode(true);
            detContratoInp.parentNode.replaceChild(newInp, detContratoInp);
            newInp.addEventListener('change', async () => {
                const file = newInp.files[0];
                if (!file) return;
                try {
                    showToast('Subiendo Contrato...', 'info');
                    const fileUrl = await uploadFile(file, 'documents');
                    state.detEditContratoUrl = fileUrl;
                    if (detContratoFileName) detContratoFileName.textContent = file.name;
                    if (detContratoPlaceholder) detContratoPlaceholder.classList.add('hidden');
                    if (detContratoSuccess) { detContratoSuccess.classList.remove('hidden'); detContratoSuccess.classList.add('flex'); }
                    showToast('Contrato subido', 'success');
                } catch(e) {
                    showToast('Error subiendo archivo', 'error');
                }
            });
        }
        // ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬

        // ââ‚¬ââ‚¬ Pipeline Permissions ââ‚¬ââ‚¬
        const pipBox = document.getElementById('det-edit-pipeline-perms');
        if (pipBox) {
            const dbLocal = getDB();
            const pipelines = dbLocal.Admin_Pipelines || [];
            const userUnidades = usr.unidades || [];

            const getPipIcon = (nombre) => {
                const n = nombre.toLowerCase();
                if (n.includes('solar')) return 'fa-sun';
                if (n.includes('water') || n.includes('agua')) return 'fa-droplet';
                if (n.includes('home') || n.includes('casa') || n.includes('hogar')) return 'fa-house';
                if (n.includes('hvac') || n.includes('aire')) return 'fa-wind';
                return 'fa-bolt';
            };

            if (pipelines.length === 0) {
                pipBox.innerHTML = '<p class="text-xs text-gray-400 italic">No hay pipelines creados aún.</p>';
            } else {
                pipBox.innerHTML = pipelines.map(pip => {
                    const checked = userUnidades.includes(pip.nombre) ? 'checked' : '';
                    return `
                        <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:border-tealAccent/40 transition-all group" style="background: ${pip.color}08; border-color: ${pip.color}20">
                            <input type="checkbox" class="pip-perm-chk w-4 h-4 rounded accent-teal-500" data-pip="${pip.nombre}" ${checked}>
                            <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: ${pip.color}15; color: ${pip.color}">
                                <i class="fa-solid ${getPipIcon(pip.nombre)} text-xs"></i>
                            </div>
                            <span class="text-sm font-bold text-[#333] flex-1">${pip.nombre}</span>
                            <span class="text-[10px] font-black uppercase tracking-widest" style="color: ${pip.color}">${checked ? 'Autorizado' : 'Sin acceso'}</span>
                        </label>
                    `;
                }).join('');

                // Live update label on checkbox change
                pipBox.querySelectorAll('.pip-perm-chk').forEach(chk => {
                    chk.addEventListener('change', (e) => {
                        const lbl = e.target.closest('label').querySelector('span:last-child');
                        if (lbl) lbl.textContent = e.target.checked ? 'Autorizado' : 'Sin acceso';
                    });
                });
                
                // Update rank visibility initially when modal opens
                if (typeof window.updateEditWorkerRankVisibility === 'function') {
                    window.updateEditWorkerRankVisibility();
                }
            }
        }
    }
    if (saveBar) saveBar.classList.remove('hidden');
    if (gearBtn) {
        gearBtn.classList.add('text-tealAccent', 'bg-tealAccent/10');
        gearBtn.title = 'Cancelar edición';
    }

    // Back Arrow handler
    const backArrow = document.getElementById('btn-back-edit-worker');
    if (backArrow) {
        // Remove old listeners
        const newBack = backArrow.cloneNode(true);
        backArrow.parentNode.replaceChild(newBack, backArrow);
        newBack.addEventListener('click', () => {
            exitDetailEditMode();
            document.getElementById('det-usr-nombre').textContent = usr.nombre || '-';
            document.getElementById('det-usr-apellido').textContent = usr.apellido || '-';
            document.getElementById('det-usr-email').textContent = usr.email || '-';
            document.getElementById('det-usr-rol').textContent = usr.rol || '-';
            document.getElementById('det-usr-dept').textContent = usr.department || 'Grupo Renew';
            document.getElementById('det-usr-tel').textContent = usr.telefono || '-';
            if (document.getElementById('det-usr-sip-id')) document.getElementById('det-usr-sip-id').textContent = usr.zadarma_sip_id || '-';
        });
    }

    // Save button handler
    const saveBtn = document.getElementById('det-btn-save');
    if (saveBtn) {
        // Clone to remove old listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', async () => {
            const updatedId = document.getElementById('det-edit-id').value;
            const nombre = document.getElementById('det-edit-nombre').value.trim();
            const apellido = document.getElementById('det-edit-apellido').value.trim();
            const email = document.getElementById('det-edit-email').value.trim();
            const telEl = document.getElementById('det-edit-tel');
            const ccEl = document.getElementById('det-edit-cc');
            const telValDet = telEl ? telEl.value.trim() : '';
            const ccValDet = ccEl ? ccEl.value : '';
            const telefono = ccValDet && telValDet ? `${ccValDet} ${telValDet}` : telValDet;
            
            const rolEl = document.getElementById('det-edit-rol');
            const rankEl = document.getElementById('det-edit-rank');
            const deptEl = document.getElementById('det-edit-dept');
            const passEl = document.getElementById('det-edit-pass');
            const dobEl = document.getElementById('det-edit-dob');
            
            const rol = rolEl ? rolEl.value : (usr.rol || 'Vendedor');
            const rango = rankEl ? rankEl.value : (usr.rango || 'auto');
            const department = deptEl ? deptEl.value.trim() : (usr.department || '');
            const sede = document.getElementById('det-edit-sede')?.value || (usr.sede || 'orlando');
            const password = passEl ? passEl.value.trim() : (usr.password || usr.pass || 'renew123');
            const dob = dobEl ? dobEl.value : (usr.dob || '');

            const tel_emergencia = document.getElementById('det-edit-tel-emergencia')?.value.trim() || '';
            const contacto_emergencia_nombre = document.getElementById('det-edit-contacto-emergencia-nombre')?.value.trim() || '';
            const direccion = document.getElementById('det-edit-direccion')?.value.trim() || '';
            const zelle_nombre = document.getElementById('det-edit-zelle-nombre')?.value.trim() || '';
            const zelle_cuenta = document.getElementById('det-edit-zelle-cuenta')?.value.trim() || '';
            const zelle_tel = document.getElementById('det-edit-zelle-tel')?.value.trim() || '';
            const banco_nombre = document.getElementById('det-edit-banco-nombre')?.value.trim() || '';
            const banco_cuenta = document.getElementById('det-edit-banco-cuenta')?.value.trim() || '';
            const banco_ruta   = document.getElementById('det-edit-banco-ruta')?.value.trim()   || '';

            const equipo_ids = (rol === 'Supervisor') ? Array.from(document.querySelectorAll('.rep-equipo-chk:checked')).map(c => c.value) : [];
            const pipeline_ids = (rol === 'Project Manager') ? Array.from(document.querySelectorAll('.pm-pipeline-chk:checked')).map(c => c.value) : [];

            const unidades = [];
            if (document.getElementById('chk-unit-solar') && document.getElementById('chk-unit-solar').checked) unidades.push('Renew Solar');
            if (document.getElementById('chk-unit-water') && document.getElementById('chk-unit-water').checked) unidades.push('Renew Water');

            // Read pipeline permissions
            const checkedPips = Array.from(
                document.querySelectorAll('.pip-perm-chk:checked')
            ).map(chk => chk.dataset.pip);

            if (!nombre || !apellido || !email) {
                showToast('Nombre, apellido e email son obligatorios.', 'error');
                return;
            }

            const originalText = newSaveBtn.textContent || 'Guardar cambios';
            newSaveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Guardando...';
            newSaveBtn.disabled = true;

            try {
                const initials = ((nombre[0] || '') + (apellido[0] || '')).toUpperCase();
                
                // --- LOGICA AUTOMATICA DE ONBOARDING ---
                const hasAllDocs = state.detEditW9Url && state.detEditCarnetUrl && state.detEditContratoUrl;
                let current_estatus = usr.estatus_rrhh || 'Inscrito';
                
                if (hasAllDocs && (current_estatus === 'Inscrito' || current_estatus === 'Faltan Documentos')) {
                    current_estatus = 'Capacitacion';
                } else if (!hasAllDocs && (current_estatus === 'Inscrito' || current_estatus === 'Capacitacion')) {
                    current_estatus = 'Faltan Documentos';
                }
                
                const updatedUsr = {
                    ...usr,
                    nombre, apellido, email, telefono, rol, rango, department, password, initials, dob, sede,
                    unidades: unidades.length > 0 ? unidades : checkedPips,
                    equipo_ids, pipeline_ids,
                    foto: state.currentUsrFoto, 
                    w9Url: state.detEditW9Url !== undefined ? state.detEditW9Url : (usr.w9Url || null),
                    w9_url: state.detEditW9Url !== undefined ? state.detEditW9Url : (usr.w9_url || null),
                    carnet_url: state.detEditCarnetUrl !== undefined ? state.detEditCarnetUrl : (usr.carnet_url || null),
                    contrato_url: state.detEditContratoUrl !== undefined ? state.detEditContratoUrl : (usr.contrato_url || null),
                    estatus_rrhh: current_estatus,
                    tel_emergencia, contacto_emergencia_nombre, direccion, zelle_nombre, zelle_cuenta, zelle_tel,
                    banco_nombre, banco_cuenta, banco_ruta,
                    zadarma_sip_id: document.getElementById('det-edit-sip-id') ? document.getElementById('det-edit-sip-id').value.trim() : ''
                };

                await saveAdminWorker(updatedUsr);
                
                if (window.initHRModule) {
                    try { await window.initHRModule(); } catch(e) {}
                }

                // Update view fields
                document.getElementById('det-usr-nombre').textContent = nombre;
                document.getElementById('det-usr-apellido').textContent = apellido;
                document.getElementById('det-usr-email').textContent = email;
                document.getElementById('det-usr-rol').textContent = rol;
                document.getElementById('det-usr-dept').textContent = department || 'Grupo Renew';
                document.getElementById('det-usr-sede').textContent = sede;
                document.getElementById('det-usr-tel').textContent = telefono || '-';
                if (document.getElementById('det-usr-sip-id')) document.getElementById('det-usr-sip-id').textContent = document.getElementById('det-edit-sip-id') ? document.getElementById('det-edit-sip-id').value.trim() : '-';
                if (document.getElementById('det-usr-tel-emergencia')) document.getElementById('det-usr-tel-emergencia').textContent = tel_emergencia || '-';
                if (document.getElementById('det-usr-contacto-emergencia-nombre')) document.getElementById('det-usr-contacto-emergencia-nombre').textContent = contacto_emergencia_nombre || '-';
                if (document.getElementById('det-usr-direccion')) document.getElementById('det-usr-direccion').textContent = direccion || '-';
                
                const dobViewEl = document.getElementById('det-usr-dob-view');
                if (dobViewEl) {
                    if (dob) {
                        const [y, m, d] = dob.split('-');
                        dobViewEl.textContent = `${m}/${d}/${y}`;
                    } else {
                        dobViewEl.textContent = '-';
                    }
                }

                // ââ‚¬ââ‚¬ Update interactive docs in view panel ââ‚¬ââ‚¬
                showWorkerDetail(updatedUsr.id);

                exitDetailEditMode();
                showToast('Perfil y permisos actualizados correctamente.', 'success');
                await renderView();
            } catch (error) {
                console.error("Error updating worker:", error);
                showToast("Ocurrió un error al guardar: " + (error.message || "Revisa la consola"), "error");
            } finally {
                newSaveBtn.innerHTML = originalText;
                newSaveBtn.disabled = false;
            }
        });
    }
}

window.handleInstantDocUpload = async function(event, usrId, docType) {
    const file = event.target.files[0];
    if (!file) return;

    const zone = event.target.parentElement;
    const originalHTML = zone.innerHTML;
    
    // Bloquear UI y mostrar Spinner
    zone.innerHTML = `
        <div class="flex flex-col items-center justify-center py-2">
            <i class="fa-solid fa-circle-notch fa-spin text-tealAccent text-2xl mb-2"></i>
            <p class="text-[9px] font-black text-tealAccent uppercase tracking-widest animate-pulse">Subiendo...</p>
        </div>
    `;
    zone.classList.add('pointer-events-none', 'bg-tealAccent/5');

    try {
        // USAR UPLOAD REAL EN LUGAR DE BASE64 (Más estable para Supabase)
        const fileUrl = await uploadFile(file, 'rrhh_docs');
        
        const workers = await getAdminWorkers();
        const usr = workers.find(u => String(u.id) === String(usrId));
        if (!usr) {
            zone.innerHTML = originalHTML;
            zone.classList.remove('pointer-events-none', 'bg-tealAccent/5');
            return;
        }

        // Update field
        if (docType === 'w9') usr.w9_url = fileUrl;
        else if (docType === 'carnet') usr.carnet_url = fileUrl;
        else if (docType === 'contrato') usr.contrato_url = fileUrl;

        // Auto-status logic (Simplified & Robust)
        const hasW9 = !!(usr.w9_url || usr.w9Url) && String(usr.w9_url || usr.w9Url).length > 5;
        const hasCarnet = !!(usr.carnet_url || usr.carnetUrl) && String(usr.carnet_url || usr.carnetUrl).length > 5;
        const hasContrato = !!(usr.contrato_url || usr.contratoUrl) && String(usr.contrato_url || usr.contratoUrl).length > 5;
        const hasAllDocs = hasW9 && hasCarnet && hasContrato;

        if (hasAllDocs) {
            usr.estatus_rrhh = 'Capacitacion';
        } else {
            usr.estatus_rrhh = 'Faltan Documentos';
        }

        await saveAdminWorker(usr);
        
        if (window.initHRModule) {
            try { await window.initHRModule(); } catch(err) {}
        }
        
        showWorkerDetail(usrId);
        showToast('Documento subido a la nube correctamente', 'success');
        await renderView();
    } catch (err) {
        console.error('[Instant Upload] Error:', err);
        zone.innerHTML = originalHTML;
        zone.classList.remove('pointer-events-none', 'bg-tealAccent/5');
        showToast('Error al subir a la nube', 'error');
    }
};

init();

function updateSidebarUser() {
    const raw = localStorage.getItem('rs_user');
    if (!raw) return;
    try {
        const user = JSON.parse(raw);
        const nameEl = document.getElementById('footer-user-name');
        const roleEl = document.getElementById('footer-user-role');
        const avatarEl = document.getElementById('footer-user-avatar');

        if (nameEl) nameEl.textContent = `${user.nombre} ${user.apellido || ''}`.trim();
        if (roleEl) roleEl.textContent = user.rol || 'Staff';
        if (avatarEl) {
            if (user.foto) {
                avatarEl.style.backgroundImage = `url(${user.foto})`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.style.backgroundPosition = 'center';
                avatarEl.textContent = '';
                avatarEl.classList.remove('bg-gradient-to-tr');
                avatarEl.classList.add('border-2', 'border-white/20');
            } else {
                avatarEl.style.backgroundImage = 'none';
                avatarEl.classList.add('bg-gradient-to-tr');
                const initials = (user.nombre[0] || '?') + (user.apellido ? user.apellido[0] : '');
                avatarEl.textContent = initials.toUpperCase();
            }
        }
    } catch(e) {
        console.error("Error parsing rs_user for sidebar:", e);
    }
}

// â¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Â
//  KANBAN PROJECT DETAIL DRAWER
// â¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Ââ¢Â
function renderDiscussionHTML(discusion, pipelineColor) {
    if (!discusion) return '<div style="text-align:center;padding:20px;color:var(--text-muted);font-style:italic;font-size:0.85rem;">No hay mensajes aún.</div>';
    let arr = discusion;
    if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch(e) { return '<div style="text-align:center;padding:20px;color:var(--text-muted);font-style:italic;font-size:0.85rem;">No hay mensajes aún.</div>'; }
    }
    if (!Array.isArray(arr) || arr.length === 0) return '<div style="text-align:center;padding:20px;color:var(--text-muted);font-style:italic;font-size:0.85rem;">No hay mensajes aún.</div>';
    
    let lastDateLabel = '';
    return arr.map(c => {
        if (c.type === 'system') {
            return `<div style="text-align:center;margin:8px 0;"><span style="display:inline-block;background:var(--surface);color:var(--text-muted);font-size:0.65rem;font-weight:700;padding:4px 12px;border-radius:99px;">${c.text}</span></div>`;
        }
        
        const dateObj = new Date(c.date);
        const dateLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
        let dateSeparator = '';
        if (dateLabel !== lastDateLabel) {
            lastDateLabel = dateLabel;
            dateSeparator = `<div style="text-align:center;margin:12px 0 8px;"><span style="display:inline-block;background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.05);color:#64748b;font-size:0.65rem;font-weight:800;padding:3px 12px;border-radius:99px;text-transform:capitalize;">${dateLabel}</span></div>`;
        }
        
        const isMe = getCurrentUser()?.id === c.user_id;
        const initials = ((c.user || '?')[0]).toUpperCase();
        const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const avatar = `<div style="width:28px;height:28px;border-radius:50%;background:${pipelineColor}20;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:900;color:${pipelineColor};flex-shrink:0;overflow:hidden;">
            ${c.foto ? `<img src="${c.foto}" style="width:100%;height:100%;object-fit:cover;" />` : initials}
        </div>`;
        
        let attachmentHtml = '';
        if (c.fileUrl) {
            const isImage = c.fileUrl.startsWith('data:image') || c.fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
            if (isImage) {
                attachmentHtml = `<div style="margin-top:6px;border-radius:8px;overflow:hidden;border:1px solid rgba(0,0,0,0.1);max-width:200px;"><a href="${c.fileUrl}" target="_blank"><img src="${c.fileUrl}" style="width:100%;display:block;cursor:pointer;"></a></div>`;
            } else {
                attachmentHtml = `<div style="margin-top:6px;"><a href="${c.fileUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);padding:6px 10px;border-radius:6px;text-decoration:none;color:inherit;font-size:0.75rem;border:1px solid rgba(0,0,0,0.1);"><i class="fas fa-file-alt"></i> <span style="truncate">${c.fileName || 'Archivo adjunto'}</span></a></div>`;
            }
        }
        
        const msgBubble = `
        <div style="display:flex;align-items:flex-start;gap:8px;max-width:85%;${isMe ? 'flex-direction:row-reverse;margin-left:auto;' : ''}">
            ${avatar}
            <div style="display:flex;flex-direction:column;${isMe ? 'align-items:flex-end;' : 'align-items:flex-start;'}">
                <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;${isMe ? 'flex-direction:row-reverse;' : ''}">
                    <span style="font-size:0.7rem;font-weight:800;color:#0f172a;">${isMe ? 'Tú' : c.user}</span>
                    <span style="font-size:0.6rem;color:#64748b;">${time}</span>
                </div>
                <div style="background:${isMe ? pipelineColor : 'white'};color:${isMe ? 'white' : '#0f172a'};border-radius:${isMe ? '12px 0 12px 12px' : '0 12px 12px 12px'};padding:8px 12px;font-size:0.8rem;line-height:1.4;box-shadow:0 1px 3px rgba(0,0,0,0.1);${!isMe ? 'border:1px solid #e2e8f0;' : ''}">${c.text || ''}${attachmentHtml}</div>
            </div>
        </div>`;
        
        return dateSeparator + msgBubble;
    }).join('');
}

function openKanbanDrawer(projectId, targetPhaseId = null) {
    const db = getDB();
    const roles = db.Admin_Roles || [];
    if (!roles.length) return; // Wait for sync or defaults

    const optionsHtml = roles.map(r => `<option value="${r.nombre}">${r.nombre}</option>`).join('');
    
    const inpRol = document.getElementById('inp-usr-rol');
    if (inpRol) {
        const val = inpRol.value;
        inpRol.innerHTML = optionsHtml;
        if(val) inpRol.value = val;
    }
    
    const detRol = document.getElementById('det-edit-rol');
    if (detRol) {
        const val = detRol.value;
        detRol.innerHTML = optionsHtml;
        if(val) detRol.value = val;
    }
};

window.openKanbanDrawer = openKanbanDrawer;
  const db = getDB();
  const p = (db.Proyectos_Dinamicos || []).find(x => x.id === projectId);
  if (!p) return;

  const cli = (db.Clientes_Maestro || []).find(c => c.id === p.cliente_id) || { nombre: 'Cliente', telefono: '-' };
  const pipeline = (db.Admin_Pipelines || []).find(pip => pip.id === p.pipeline_id) || { nombre: 'N/A', color: '#0d9488' };
  const fases = (db.Admin_Fases || []).filter(f => f.pipeline_id === p.pipeline_id).sort((a, b) => a.orden - b.orden);
  const faseActual = fases.find(f => f.id === p.fase_id) || { nombre: 'Completado' };
  const isProjectCompleted = cli.estado === 'Completado' || p.fase_id === 'Completado' || p.fase_id === null;
  const displayPhaseId = targetPhaseId !== null ? targetPhaseId : (isProjectCompleted && fases.length > 0 ? fases[fases.length - 1].id : p.fase_id);
  const isCurrentPhase = !isProjectCompleted && displayPhaseId === p.fase_id;
  const displayPhase = fases.find(f => f.id === displayPhaseId) || faseActual;
  window._currentDrawerPhaseId = displayPhaseId;
  const campos = db.Admin_Campos_Formulario || [];
  const respuestas = (db.Respuestas_Dinamicas || []).filter(r => r.proyecto_id === p.id);

  const currentUser = getCurrentUser();
  const isAdmin = ['admin','administrador','ceo','desarrollador'].includes((currentUser?.rol || '').toLowerCase());
  const isResponsable = currentUser?.id === p.responsable_id || currentUser?.id === p.asignado_a || (Array.isArray(p.colaboradores) && p.colaboradores.some(c => c.id === currentUser?.id));
  const canManageObservers = isAdmin || isResponsable;
  
  const allWorkers = db.Usuarios || [];
  const colaboradores = Array.isArray(p.colaboradores) ? p.colaboradores : [];

  const obsHtml = colaboradores.map(o => {
      const oi = ((o.nombre || '?')[0]).toUpperCase();
      return `<div class="flex items-center gap-2 mb-2">
        <div title="${o.nombre}" style="width:24px;height:24px;border-radius:50%;background:${pipeline.color}20;display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:900;color:${pipeline.color};overflow:hidden;">
            ${o.foto ? `<img src="${o.foto}" style="width:100%;height:100%;object-fit:cover;" />` : oi}
        </div>
        <span class="text-[11px] text-gray-600 font-medium">${o.nombre}</span>
      </div>`;
  }).join('');

  // Combine dynamic file responses with fixed office attachments
  const fileRespuestas = respuestas.filter(r => {
    const campo = campos.find(c => String(c.id) === String(r.campo_id));
    return campo && campo.tipo === 'Archivo' && r.valor && (r.valor.startsWith('data:') || r.valor.startsWith('http') || r.valor.startsWith('/api/') || r.valor.startsWith('/uploads/') || r.valor.includes('/'));
  });
  const combinedFiles = [...fileRespuestas.map(r => {
      const campo = campos.find(c => String(c.id) === String(r.campo_id));
      return { url: r.valor, etiqueta: campo?.etiqueta || 'Archivo', id: r.campo_id };
  })];
  
  if (cli.adjuntos_oficina) {
      if (cli.adjuntos_oficina.orden_trabajo_url) combinedFiles.push({ url: cli.adjuntos_oficina.orden_trabajo_url, etiqueta: 'Orden de Trabajo', id: 'sys-orden' });
      if (cli.adjuntos_oficina.contrato_url) combinedFiles.push({ url: cli.adjuntos_oficina.contrato_url, etiqueta: 'Contrato Firmado', id: 'sys-contrato' });
      if (cli.adjuntos_oficina.app_url) combinedFiles.push({ url: cli.adjuntos_oficina.app_url, etiqueta: 'Hoja de Aplicación', id: 'sys-app' });
      const rUrl = cli.adjuntos_oficina.recibo_url || cli.adjuntos_oficina.recibo_vendedor_url || cli.adjuntos_oficina.recibo_tecnico_url;
      if (rUrl) combinedFiles.push({ url: rUrl, etiqueta: 'Recibo de Pago', id: 'sys-recibo' });
  }

  const filesHtml = combinedFiles.length > 0
    ? combinedFiles.map(f => {
        const isImage = f.url.startsWith('data:image') || f.url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
        const etiqueta = (f.etiqueta || 'Archivo').replace(/'/g, "\\'");
        const filename = etiqueta.replace(/\s+/g, '_');
        return `
          <div class="group relative bg-white p-2 rounded-lg border border-gray-200">
            ${isImage
              ? `<div class="w-full h-16 rounded overflow-hidden relative">
                  <img src="${f.url}" class="w-full h-full object-cover" />
                  <button onclick="window.openFilePreview('${f.id}', '${etiqueta}')" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-eye text-white"></i></button>
                </div>`
              : `<div class="w-full h-16 rounded border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 relative">
                  <i class="fas fa-file-pdf text-red-400 text-xl"></i>
                  <a href="${f.url}" target="_blank" download="${filename}" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-download text-white"></i></a>
                </div>`
            }
            <p class="text-[9px] font-bold text-gray-500 mt-1 truncate" title="${f.etiqueta}">${f.etiqueta}</p>
          </div>
        `;
      }).join('')
    : `<div class="col-span-3 py-4 text-center text-xs text-gray-400">Sin archivos</div>`;

  const worker = allWorkers.find(w => w.id === cli.vendedor_asignado_id);
  const assigneeName = worker ? `${worker.nombre} ${worker.apellido || ''}` : 'Sin asignar';

  // Build drawer
  const existing = document.getElementById('kanban-drawer-overlay');
  if (existing) existing.remove();

  // Forzar que otros modales se pongan detrás
  ['modal-client-detail', 'modal-project-detail'].forEach(id => {
      const m = document.getElementById(id);
      if (m) m.style.setProperty('z-index', '50', 'important');
  });

  const overlay = document.createElement('div');
  overlay.id = 'kanban-drawer-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;justify-content:center;align-items:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);';
  overlay.innerHTML = `
    <div id="kanban-split-modal" style="width:90vw;height:90vh;max-width:1400px;background:#f8fafc;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);display:flex;overflow:hidden;animation:zoomIn 0.2s ease-out;">
      
      <!-- LEFT PANEL: Info & Subtasks -->
      <div style="width:45%;min-width:400px;max-width:600px;background:white;display:flex;flex-direction:column;border-right:1px solid #e2e8f0;flex-shrink:0;">
        
        <!-- Header Left -->
        <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:12px;min-width:0;">
                <div style="width:32px;height:32px;border-radius:8px;background:${pipeline.color};display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:12px;flex-shrink:0;">
                    ${cli.nombre[0].toUpperCase()}
                </div>
                <div style="min-width:0;">
                    <h2 class="text-sm font-bold text-gray-800 truncate" title="${cli.nombre}">${cli.nombre}</h2>
                    <p class="text-[10px] text-gray-500">ID: ${p.id.substring(0,8).toUpperCase()}</p>
                </div>
            </div>
            <button id="kanban-drawer-close-btn" class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <div style="flex:1;overflow-y:auto;" class="hide-scrollbar">
            <!-- Properties -->
            <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
                <div class="grid grid-cols-[100px_1fr] gap-y-3 gap-x-2 text-xs items-center">
                    <div class="text-gray-400 font-medium">Descripción:</div>
                    <div class="text-gray-800 text-[11px]">${p.descripcion || 'Sin descripción'}</div>
                    
                    <div class="text-gray-400 font-medium">Asignado a:</div>
                    <div class="text-gray-800 font-medium flex items-center gap-2">
                        <i class="fas fa-user-circle text-gray-300"></i> ${assigneeName}
                    </div>

                    <div class="text-gray-400 font-medium">Creado el:</div>
                    <div class="text-gray-800">${new Date(p.fecha).toLocaleDateString()}</div>
                    
                    <div class="text-gray-400 font-medium">Fecha Límite:</div>
                    <div class="text-gray-800">
                        <input type="date" id="proj-deadline-input" value="${p.fecha_finalizacion ? p.fecha_finalizacion.substring(0,10) : ''}" class="text-[11px] bg-transparent border border-dashed border-gray-300 rounded px-2 py-1 outline-none hover:border-blue-400 cursor-pointer text-gray-700 w-full max-w-[130px] transition-colors" ${isAdmin ? '' : 'disabled title="Solo administradores pueden editar"'}>
                    </div>
                    
                    <div class="text-gray-400 font-medium mt-2">Proyecto:</div>
                    <div class="text-gray-800 mt-2 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full" style="background:${pipeline.color}"></span> ${pipeline.nombre}
                    </div>
                    
                    <div class="text-gray-400 font-medium">Etapa Actual:</div>
                    <div class="text-gray-800 font-medium">${faseActual.nombre}</div>
                    
                    <div class="text-gray-400 font-medium mt-2">colaboradores:</div>
                    <div class="mt-2">
                        ${obsHtml || '<span class="text-[10px] text-gray-400 italic">No hay colaboradores</span>'}
                        ${canManageObservers ? `
                        <button id="btn-manage-obs" class="text-[10px] text-blue-500 hover:underline mt-1"><i class="fas fa-plus"></i> Añadir colaborador</button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Accordion -->
            <div style="padding:16px 20px 0;">
                <h3 class="text-xs font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-tasks text-blue-500"></i> Subtasks (Fases): ${fases.length}</h3>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    ${fases.map((f, i) => {
                        const isDone = isProjectCompleted || i < fases.findIndex(fx => fx.id === p.fase_id);
                        const isCurrent = !isProjectCompleted && f.id === p.fase_id;
                        const isViewing = f.id === displayPhaseId;
                        return `
                        <div class="mb-1">
                            <div class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${isViewing ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:bg-gray-50'}"
                                 onclick="window.openKanbanDrawer('${p.id}', '${isViewing ? '' : f.id}')">
                                <div class="flex items-center gap-3">
                                    <i class="fas ${isDone ? 'fa-check-circle text-green-500' : (isCurrent ? 'fa-dot-circle text-blue-500' : 'fa-circle text-gray-200')}"></i>
                                    <span class="text-xs font-bold ${isViewing ? 'text-blue-700' : 'text-gray-700'}">${f.nombre}</span>
                                </div>
                                <i class="fas fa-chevron-${isViewing ? 'down' : 'right'} text-[10px] text-${isViewing ? 'blue-500' : 'gray-300'}"></i>
                            </div>
                            ${isViewing ? `
                            <div class="mt-2 ml-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm relative before:absolute before:-left-4 before:top-4 before:w-4 before:h-px before:bg-gray-200">
                                <div id="drawer-dynamic-fields">
                                    <p style="font-size:11px; color:#64748b; font-style:italic;">Cargando campos...</p>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div style="padding:20px 20px 20px;border-top:1px solid #f1f5f9;margin-top:16px;">
                <h3 class="text-xs font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-paperclip text-gray-400"></i> Archivos Globales</h3>
                <div class="grid grid-cols-3 gap-2">
                    ${filesHtml}
                </div>
            </div>

            <div style="padding:20px 20px 20px;border-top:1px solid #f1f5f9;">
                <h3 class="text-xs font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-microphone text-blue-400"></i> Llamadas Vinculadas</h3>
                <div class="flex flex-col gap-2">
                    ${(() => {
                        const projectCalls = (cli.historial_llamadas || []).filter(c => c.proyecto_id === p.id);
                        if (projectCalls.length === 0) return '<p class="text-[10px] text-gray-400 italic">No hay llamadas vinculadas a este proyecto</p>';
                        return projectCalls.reverse().map(call => {
                            const dateStr = new Date(call.fecha).toLocaleDateString('es-ES', { month:'short', day:'numeric' });
                            return `
                            <div class="bg-gray-50 border border-gray-100 p-2 rounded-lg flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 rounded-full flex items-center justify-center ${call.tipo === 'Entrante' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}">
                                        <i class="fa-solid ${call.tipo === 'Entrante' ? 'fa-arrow-down' : 'fa-arrow-up'} text-[8px]"></i>
                                    </div>
                                    <div>
                                        <p class="text-[10px] font-bold text-gray-700 leading-none">${call.tipo || 'Llamada'}</p>
                                        <p class="text-[8px] text-gray-400">${dateStr}</p>
                                    </div>
                                </div>
                                <div>
                                    ${call.grabacion_url ? `
                                    <audio id="drawer-audio-${call.call_id}" src="${call.grabacion_url}" preload="none"></audio>
                                    <button onclick="const a=document.getElementById('drawer-audio-${call.call_id}'); if(a.paused){a.play();this.innerHTML='<i class=\\'fa-solid fa-pause\\'></i>';}else{a.pause();this.innerHTML='<i class=\\'fa-solid fa-play\\'></i>';}" class="w-6 h-6 rounded bg-white border border-gray-200 text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-colors">
                                        <i class="fa-solid fa-play text-[8px]"></i>
                                    </button>
                                    ` : '<span class="text-[8px] font-bold text-gray-400 bg-white border border-gray-100 px-1 rounded">Procesando...</span>'}
                                </div>
                            </div>`;
                        }).join('');
                    })()}
                </div>
            </div>
        </div>
      </div>
      
      <!-- RIGHT PANEL: Task Chat -->
      <div style="flex:1;display:flex;flex-direction:column;background:#dce9f5;position:relative;">
        <!-- Chat Header -->
        <div style="height:60px;background:white;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;flex-shrink:0;">
            <div>
                <h2 class="text-[15px] font-bold text-gray-800 flex items-center gap-2"><i class="far fa-comments text-blue-500"></i> Chat del Proyecto</h2>
                <p class="text-[11px] text-gray-500">${colaboradores.length + 2} participantes</p>
            </div>
            <div class="flex items-center gap-3">
                <div class="relative bg-gray-50 rounded-full flex items-center px-3 h-8 shadow-inner transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:bg-white border border-transparent focus-within:border-blue-300">
                    <i class="fas fa-search text-gray-400 text-xs mr-2"></i>
                    <input type="text" id="chat-search-input" placeholder="Buscar mensaje..." class="bg-transparent outline-none text-xs text-gray-700 w-24 focus:w-40 transition-all duration-300" />
                </div>
            </div>
        </div>
        
        <!-- Chat Background Overlay -->
        <div style="position:absolute;inset:0;top:60px;bottom:70px;background-image:radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px);background-size:20px 20px;pointer-events:none;opacity:0.6;"></div>
        
        <!-- Messages Area -->
        <div id="discussion-list" style="flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:12px;position:relative;z-index:1;">
            ${renderDiscussionHTML(p.discusion, pipeline.color)}
        </div>
        
        <!-- Chat Input -->
        <div style="height:70px;background:white;border-top:1px solid #e2e8f0;padding:12px 24px;display:flex;align-items:center;gap:12px;flex-shrink:0;z-index:1;">
            <div class="flex-1 bg-white border border-gray-200 rounded-full flex items-center px-4 h-10 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <input type="file" id="chat-file-input" style="display:none" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                <label for="chat-file-input" style="margin:0;cursor:pointer;display:flex;align-items:center;">
                    <i class="fas fa-paperclip text-gray-400 mr-2 hover:text-gray-600"></i>
                </label>
                <div id="chat-file-preview" style="display:none; font-size:10px; background:#e2e8f0; padding:2px 6px; border-radius:4px; margin-right:4px; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;" onclick="document.getElementById('chat-file-input').value='';this.style.display='none';" title="Click para quitar"></div>
                <input type="text" id="discussion-input" placeholder="Escribe un mensaje o menciona a alguien..." class="flex-1 bg-transparent outline-none text-sm text-gray-700 h-full" />
                <div class="relative flex items-center">
                    <i id="btn-chat-emoji" class="far fa-smile text-gray-400 ml-2 cursor-pointer hover:text-gray-600 transition-colors"></i>
                    <!-- Emoji Picker Popup -->
                    <div id="chat-emoji-picker" class="hidden absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex gap-2 z-[60]">
                        <button type="button" class="chat-emoji-btn hover:bg-gray-100 rounded p-1 transition-colors text-lg"><i class="fa-solid fa-thumbs-up"></i></button>
                        <button type="button" class="chat-emoji-btn hover:bg-gray-100 rounded p-1 transition-colors text-lg"><i class="fa-solid fa-fire"></i></button>
                        <button type="button" class="chat-emoji-btn hover:bg-gray-100 rounded p-1 transition-colors text-lg"><i class="fa-solid fa-face-smile"></i></button>
                        <button type="button" class="chat-emoji-btn hover:bg-gray-100 rounded p-1 transition-colors text-lg">âœ…</button>
                        <button type="button" class="chat-emoji-btn hover:bg-gray-100 rounded p-1 transition-colors text-lg"><i class="fa-solid fa-eye"></i></button>
                        <button type="button" class="chat-emoji-btn hover:bg-gray-100 rounded p-1 transition-colors text-lg"><i class="fa-solid fa-rocket"></i></button>
                    </div>
                </div>
            </div>
            <button id="btn-send-discussion" class="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-md transition-colors">
                <i class="fas fa-paper-plane text-sm"></i>
            </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // --- Deadline Logic ---
  const dInput = document.getElementById('proj-deadline-input');
  if (dInput) {
      dInput.addEventListener('change', async (e) => {
          p.fecha_finalizacion = e.target.value;
          try {
              await saveGranular('proyectos_dinamicos', [p]);
              showToast('Fecha de finalización guardada', 'success');
          } catch(err) {
              console.error(err);
              showToast('Error al guardar fecha', 'error');
          }
      });
  }

  // --- Render Phase Fields in Drawer ---
  if (displayPhaseId !== '') {
      const fieldsContainer = document.getElementById('drawer-dynamic-fields');
      if (fieldsContainer) {
          const phaseCampos = campos.filter(c => c.fase_id === displayPhaseId);
          
          if (phaseCampos.length === 0) {
            fieldsContainer.innerHTML = `
              <div style="padding:16px; text-align:center;">
                <p style="font-size:11px; color:#94a3b8; font-weight:700;">ESTA FASE NO TIENE CAMPOS</p>
                ${isCurrentPhase ? `<button id="btn-advance-drawer-empty" style="margin-top:12px; width:100%; background:${pipeline.color}; color:white; border:none; padding:8px; border-radius:6px; font-weight:700; font-size:11px; cursor:pointer;">
                   AVANZAR FASE
                </button>` : ''}
              </div>
            `;
            const btnAdv = document.getElementById('btn-advance-drawer-empty');
            if (btnAdv) {
              btnAdv.onclick = async () => {
                 btnAdv.textContent = 'Espere...';
                 const res = await advanceDealPhase(p.id, {});
                 if (res.didAdvance) {
                    showToast('Fase completada', 'success');
                    closeDrawer();
                    renderView();
                 }
              };
            }
          } else {
            const requiredCampos = phaseCampos.filter(c => !c.es_opcional);
            const numRequiredFilled = respuestas.filter(r => requiredCampos.some(c => String(c.id) === String(r.campo_id)) && r.valor && r.valor !== "No subido" && r.valor !== "No provisto").length;
            const isComplete = numRequiredFilled >= requiredCampos.length;

            const inputsHtml = phaseCampos.map(c => {
              const saved = respuestas.find(r => String(r.campo_id) === String(c.id));
              const val = saved ? saved.valor : '';
              let fieldHtml = '';
              
              if (c.tipo === 'Archivo') {
                const files = val ? val.split(',').map(s=>s.trim()).filter(s=>s) : [];
                const hasFile = files.length > 0;
                const safeLabel = c.etiqueta.replace(/'/g, "\\'");
                
                const previewHtml = hasFile ? `
                  <div class="mt-2 grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-2">
                    ${files.map(fUrl => {
                       const isImg = fUrl.startsWith('data:image') || fUrl.match(/\\.(jpg|jpeg|png|gif|webp|svg)/i);
                       return `
                       <div class="group relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center" style="height: 60px;">
                         ${isImg
                           ? `<img src="${fUrl}" class="w-full h-full object-cover" />`
                           : `<i class="fas fa-file-pdf text-red-400 text-2xl"></i>`
                         }
                         <button onclick="window.openFilePreview('${c.id}', '${safeLabel}', '${fUrl}')" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                           <i class="fas ${isImg ? 'fa-eye' : 'fa-download'} text-white text-lg"></i>
                         </button>
                       </div>
                       `;
                    }).join('')}
                  </div>
                ` : '';

                fieldHtml = `
                  <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:9px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase;">
                      ${c.etiqueta} ${c.es_opcional ? '<span style="text-transform:none; font-weight:normal; font-style:italic;">(Opcional)</span>' : ''}
                    </label>
                    <div style="display:flex; align-items:center; gap:8px; padding:8px; background:#f8fafc; border:1px solid ${hasFile ? pipeline.color : '#e2e8f0'}; border-radius:8px;">
                       <i class="fas ${hasFile ? 'fa-check-circle' : 'fa-cloud-upload'}" style="color:${hasFile ? pipeline.color : '#94a3b8'};font-size:14px;"></i>
                       <span style="font-size:10px; font-weight:600; flex:1; color:${hasFile ? pipeline.color : '#94a3b8'}">${hasFile ? files.length + ' archivo(s)' : 'Pendiente'}</span>
                       <input type="file" id="dfd_${c.id}" style="display:none" accept="image/*,.pdf" multiple onchange="window.handleDrawerFileUpload('${p.id}', '${c.id}', this)">
                       <label for="dfd_${c.id}" style="background:${hasFile ? '#e2e8f0' : pipeline.color}; color:${hasFile ? '#475569' : 'white'}; padding:4px 8px; border-radius:4px; font-size:9px; font-weight:800; cursor:pointer; text-transform:uppercase;">
                         ${hasFile ? 'Añadir' : 'Subir'}
                       </label>
                    </div>
                    ${previewHtml}
                  </div>
                `;
              } else if (c.tipo === 'Desplegable') {
                const options = (c.opciones || "").split(',').map(o => o.trim());
                fieldHtml = `
                  <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:9px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase;">
                      ${c.etiqueta} ${c.es_opcional ? '<span style="text-transform:none; font-weight:normal; font-style:italic;">(Opcional)</span>' : ''}
                    </label>
                    <select id="dfd_${c.id}" style="width:100%; padding:6px 10px; border-radius:6px; font-size:11px; border:1px solid #e2e8f0; outline:none; background:#f8fafc;">
                      <option value="">Seleccionar...</option>
                      ${options.map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                  </div>
                `;
              } else if (c.tipo === 'Técnico') {
                const technicians = (window.state?.workers || allWorkers).filter(w => w.rol === 'Técnico' || w.rol === 'Tecnico');
                fieldHtml = `
                  <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:9px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase;">
                      ${c.etiqueta} ${c.es_opcional ? '<span style="text-transform:none; font-weight:normal; font-style:italic;">(Opcional)</span>' : ''}
                    </label>
                    <select id="dfd_${c.id}" style="width:100%; padding:6px 10px; border-radius:6px; font-size:11px; border:1px solid #e2e8f0; outline:none; background:#f8fafc;">
                      <option value="">Seleccionar Técnico...</option>
                      ${technicians.map(w => `<option value="${w.id}" ${val === w.id ? 'selected' : ''}>${w.nombre} ${w.apellido || ''}</option>`).join('')}
                    </select>
                  </div>
                `;
              } else {
                fieldHtml = `
                  <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:9px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase;">
                      ${c.etiqueta} ${c.es_opcional ? '<span style="text-transform:none; font-weight:normal; font-style:italic;">(Opcional)</span>' : ''}
                    </label>
                    <input type="${c.tipo === 'Número' ? 'number' : (c.tipo==='Fecha'?'date':'text')}" id="dfd_${c.id}" value="${val}" style="width:100%; padding:6px 10px; border-radius:6px; font-size:11px; border:1px solid #e2e8f0; outline:none; background:#f8fafc;">
                  </div>
                `;
              }
              return fieldHtml;
            }).join('');

            fieldsContainer.innerHTML = inputsHtml + `
               <div style="margin-top:16px; display:flex; gap:8px;">
                  <button id="btn-save-drawer-fields" style="flex:1; background:#e2e8f0; color:#475569; border:none; padding:8px; border-radius:6px; font-weight:700; font-size:10px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#cbd5e1'" onmouseout="this.style.background='#e2e8f0'">
                     Guardar Progreso
                  </button>
                  ${isCurrentPhase ? `
                  <button id="btn-advance-drawer-fields" ${!isComplete ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="flex:1; background:${pipeline.color}; color:white; border:none; padding:8px; border-radius:6px; font-weight:700; font-size:10px; cursor:pointer; transition:filter 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='brightness(1)'">
                     Avanzar Fase
                  </button>
                  ` : ''}
               </div>
            `;

            const btnSave = document.getElementById('btn-save-drawer-fields');
            if (btnSave) {
                btnSave.onclick = async () => {
                    btnSave.textContent = 'Guardando...';
                    const updates = {};
                    phaseCampos.forEach(c => {
                        if(c.tipo !== 'Archivo') {
                            const el = document.getElementById('dfd_'+c.id);
                            if(el) updates[c.id] = el.value;
                        }
                    });
                    await saveDynamicFields(p.id, updates);
                    showToast('Campos guardados', 'success');
                    openKanbanDrawer(p.id, displayPhaseId);
                };
            }

            const btnAdv = document.getElementById('btn-advance-drawer-fields');
            if (btnAdv && isComplete) {
                btnAdv.onclick = async () => {
                    btnAdv.textContent = 'Espere...';
                    const updates = {};
                    phaseCampos.forEach(c => {
                        if(c.tipo !== 'Archivo') {
                            const el = document.getElementById('dfd_'+c.id);
                            if(el) updates[c.id] = el.value;
                        }
                    });
                    const res = await advanceDealPhase(p.id, updates);
                    if(res.didAdvance) {
                        showToast('Fase completada', 'success');
                        closeDrawer();
                        renderView();
                    }
                };
            }
          }
      }
  }

  // File Upload Handler is already globally attached to window.handleDrawerFileUpload
  
  // Store file data for preview access
  window._kanbanFileCache = {};
  fileRespuestas.forEach(r => { window._kanbanFileCache[r.campo_id] = { valor: r.valor, campo: campos.find(c => String(c.id) === String(r.campo_id)) }; });

  // Close handlers
  const closeDrawer = () => {
    const panel = document.getElementById('kanban-split-modal');
    if (panel) panel.style.animation = 'zoomOut 0.2s ease-in both';
    setTimeout(() => {
        overlay.remove();
        // Restaurar z-index de modales previos
        ['modal-client-detail', 'modal-project-detail'].forEach(id => {
            const m = document.getElementById(id);
            if (m && m.style.display !== 'none') m.style.setProperty('z-index', '2147483647', 'important');
        });
    }, 200);
  };
  document.getElementById('kanban-drawer-close-btn').addEventListener('click', closeDrawer);
  document.getElementById('kanban-drawer-overlay').addEventListener('click', (e) => {
      if(e.target === overlay) closeDrawer();
  });
  
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { closeDrawer(); document.removeEventListener('keydown', esc); } });

  // Chat Observers Add logic
  const btnManageObs = document.getElementById('btn-manage-obs');
  if (btnManageObs) {
      btnManageObs.addEventListener('click', () => {
          const div = document.createElement('div');
          div.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
          
          const curIds = new Set(colaboradores.map(o=>o.id));
          const eligible = allWorkers.filter(w => w.id !== p.responsable_id && !curIds.has(w.id) && !w.is_suspended);
          
          div.innerHTML = `
          <div style="background:white;width:400px;border-radius:12px;padding:24px;max-height:80vh;display:flex;flex-direction:column;animation:zoomIn 0.2s ease-out;box-shadow:0 20px 40px rgba(0,0,0,0.2);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                  <h3 class="text-sm font-bold text-gray-800">Añadir colaborador</h3>
                  <button id="close-obs" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
              </div>
              <div style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;">
                  ${eligible.length === 0 ? '<p class="text-center text-xs text-gray-400 py-4">No hay más usuarios disponibles</p>' : ''}
                  ${eligible.map(w => `
                  <div class="obs-item flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors" data-id="${w.id}">
                      <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center font-bold text-xs">
                              ${w.foto ? `<img src="${w.foto}" class="w-full h-full rounded-full object-cover">` : (w.nombre[0].toUpperCase())}
                          </div>
                          <div>
                              <div class="text-xs font-bold text-gray-800">${w.nombre} ${w.apellido||''}</div>
                              <div class="text-[10px] text-gray-500">${w.rol}</div>
                          </div>
                      </div>
                      <button class="add-obs-btn text-[10px] font-bold text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors" data-id="${w.id}">Añadir</button>
                  </div>
                  `).join('')}
              </div>
          </div>`;
          document.body.appendChild(div);
          
          div.querySelector('#close-obs').onclick = () => div.remove();
          div.querySelectorAll('.add-obs-btn').forEach(btn => {
              btn.onclick = async () => {
                  const uid = btn.dataset.id;
                  const worker = allWorkers.find(x => x.id === uid);
                  if (worker) {
                      import('./api.js').then(async ({addObserver}) => {
                          try {
                              await addObserver(p.id, worker);
                              showToast('colaborador añadido', 'success');
                              div.remove();
                              openKanbanDrawer(p.id, displayPhaseId);
                          } catch(e) {
                              showToast('Error: ' + e.message, 'error');
                          }
                      }).catch(e => {
                         showToast('Error de red', 'error');
                      });
                  }
              };
          });
      });
  }

  // Chat Search Logic
  const chatSearchInput = document.getElementById('chat-search-input');
  if (chatSearchInput) {
      chatSearchInput.addEventListener('input', (e) => {
          const query = e.target.value.toLowerCase().trim();
          let filtered = p.discusion || [];
          if (typeof filtered === 'string') {
              try { filtered = JSON.parse(filtered); } catch(err) { filtered = []; }
          }
          if (query) {
              filtered = filtered.filter(c => 
                  (c.text && c.text.toLowerCase().includes(query)) || 
                  (c.user && c.user.toLowerCase().includes(query)) ||
                  (c.fileName && c.fileName.toLowerCase().includes(query))
              );
          }
          const list = document.getElementById('discussion-list');
          if (list) {
              list.innerHTML = renderDiscussionHTML(filtered, pipeline.color);
          }
      });
  }

  // Chat Send Logic
  const btnSend = document.getElementById('btn-send-discussion');
  const inputDisc = document.getElementById('discussion-input');

  if (btnSend && inputDisc) {
      const btnChatEmoji = document.getElementById('btn-chat-emoji');
      const emojiPicker = document.getElementById('chat-emoji-picker');
      if (btnChatEmoji && emojiPicker) {
          btnChatEmoji.addEventListener('click', (e) => {
              e.stopPropagation();
              emojiPicker.classList.toggle('hidden');
          });
          document.addEventListener('click', (e) => {
              if (!emojiPicker.contains(e.target) && e.target !== btnChatEmoji) {
                  emojiPicker.classList.add('hidden');
              }
          });
          document.querySelectorAll('.chat-emoji-btn').forEach(btn => {
              btn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  inputDisc.value += btn.textContent;
                  emojiPicker.classList.add('hidden');
                  inputDisc.focus();
              });
          });
      }

      // Chat input file listener
      const chatFileInput = document.getElementById('chat-file-input');
      const chatFilePreview = document.getElementById('chat-file-preview');
      if (chatFileInput && chatFilePreview) {
          chatFileInput.addEventListener('change', (e) => {
              if (e.target.files && e.target.files.length > 0) {
                  chatFilePreview.textContent = e.target.files[0].name;
                  chatFilePreview.style.display = 'block';
              } else {
                  chatFilePreview.style.display = 'none';
              }
          });
      }

      const sendComment = async () => {
          const text = inputDisc.value.trim();
          const hasFile = chatFileInput && chatFileInput.files && chatFileInput.files.length > 0;
          
          if (!text && !hasFile) return;
          const user = getCurrentUser();
          
          let fileUrl = null;
          let fileName = null;
          
          if (hasFile) {
              const file = chatFileInput.files[0];
              fileName = file.name;
              try {
                  btnSend.innerHTML = '...';
                  if (typeof uploadFile === 'function') {
                      fileUrl = await uploadFile(file, 'chat');
                  } else {
                      fileUrl = await new Promise((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result);
                          reader.onerror = reject;
                          reader.readAsDataURL(file);
                      });
                  }
              } catch(e) {
                  console.error("Chat file upload error", e);
                  showToast('Error subiendo archivo', 'error');
                  btnSend.innerHTML = `<i class="fas fa-paper-plane text-sm"></i>`;
                  return;
              }
          }
          
          const comment = {
              type: 'user',
              user_id: user?.id,
              foto: user?.foto,
              user: user?.nombre || 'Usuario',
              text: text,
              fileUrl: fileUrl,
              fileName: fileName,
              date: new Date().toISOString()
          };
          
          if (!p.discusion) p.discusion = [];
          if (typeof p.discusion === 'string') {
              try { p.discusion = JSON.parse(p.discusion); } catch(e) { p.discusion = []; }
          }
          
          p.discusion.push(comment);

          try {
              btnSend.innerHTML = '...';
              await saveGranular('proyectos_dinamicos', [p]);
              inputDisc.value = '';
              if (chatFileInput) chatFileInput.value = '';
              if (chatFilePreview) chatFilePreview.style.display = 'none';
              const list = document.getElementById('discussion-list');
              list.innerHTML = renderDiscussionHTML(p.discusion, pipeline.color);
              list.scrollTop = list.scrollHeight;
          } catch(e) {
              console.error("Save discussion error:", e);
              showToast('Error al guardar: ' + e.message, 'error');
              p.discusion.pop();
          } finally {
              btnSend.innerHTML = `<i class="fas fa-paper-plane text-sm"></i>`;
          }
      };

      btnSend.addEventListener('click', sendComment);
      inputDisc.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') sendComment();
      });
      // auto-scroll chat to bottom
      setTimeout(() => {
         const list = document.getElementById('discussion-list');
         if(list) list.scrollTop = list.scrollHeight;
      }, 50);
  }
}

function openFilePreview(campoId, label, directData) {
  const cached = directData || window._kanbanFileCache?.[campoId];
  if (!cached || !cached.valor) {
    console.warn('[openFilePreview] No data found for', campoId);
    showToast('No se encontró el archivo para previsualizar', 'error');
    return;
  }

  const existing = document.getElementById('file-preview-lightbox');
  if (existing) existing.remove();

  const lightbox = document.createElement('div');
  lightbox.id = 'file-preview-lightbox';
  lightbox.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;animation:overlayIn 0.2s ease both;backdrop-filter:blur(10px);';
  
  const isImage = cached.valor.startsWith('data:image') || cached.valor.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
  const filename = label.replace(/\s+/g, '_');
  
  lightbox.innerHTML = `
    <div style="position:absolute;top:0;left:0;right:0;height:80px;background:linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);display:flex;justify-content:space-between;align-items:center;padding:0 30px;z-index:10;">
      <div style="display:flex;align-items:center;gap:15px;">
        <div style="width:32px;height:32px;border-radius:8px;background:rgba(20,184,166,0.2);display:flex;align-items:center;justify-content:center;color:#14b8a6;border:1px solid rgba(20,184,166,0.3);">
            <i class="fas ${isImage ? 'fa-image' : 'fa-file-pdf'}"></i>
        </div>
        <div>
            <p style="color:white;font-weight:800;font-size:12px;margin:0;letter-spacing:1px;text-transform:uppercase;">${label}</p>
            <p style="color:rgba(255,255,255,0.5);font-size:10px;margin:0;">Previsualización de Documento</p>
        </div>
      </div>
      <div style="display:flex;gap:12px;">
        <a href="${cached.valor}" download="${filename}" style="background:#14b8a6;color:black;border:none;height:40px;padding:0 20px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:900;text-decoration:none;display:flex;align-items:center;gap:8px;text-transform:uppercase;letter-spacing:1px;transition:all 0.2s;">
          <i class="fas fa-download"></i> Descargar
        </a>
        <button onclick="document.getElementById('file-preview-lightbox').remove()" style="background:rgba(255,255,255,0.1);color:white;border:none;width:40px;height:40px;border-radius:10px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.1);transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)';this.style.borderColor='rgba(239,68,68,0.4)';this.style.color='#f87171';" onmouseout="this.style.background='rgba(255,255,255,0.1)';this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='white';">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
    
    <div id="lightbox-loader" style="position:absolute;display:flex;flex-direction:column;align-items:center;gap:15px;color:white;">
        <div style="width:40px;height:40px;border:3px solid rgba(20,184,166,0.1);border-top-color:#14b8a6;border-radius:50%;animation:spin 1s linear infinite;"></div>
        <p style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;opacity:0.6;">Cargando Archivo...</p>
    </div>

    <div id="lightbox-content-area" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
        ${isImage
          ? `<img id="preview-img" src="${cached.valor}" style="max-width:90vw;max-height:80vh;object-fit:contain;border-radius:12px;box-shadow:0 25px 80px rgba(0,0,0,0.5);opacity:0;transition:opacity 0.3s ease;z-index:5;" onload="this.style.opacity='1';document.getElementById('lightbox-loader').style.display='none';" onerror="window.handlePreviewError(this)">`
          : `<iframe id="preview-pdf" src="${cached.valor}" style="width:90vw;height:80vh;border:none;border-radius:12px;box-shadow:0 25px 80px rgba(0,0,0,0.5);z-index:5;" onload="document.getElementById('lightbox-loader').style.display='none';"></iframe>`
        }
    </div>
  `;

  window.handlePreviewError = (img) => {
    img.style.display = 'none';
    document.getElementById('lightbox-loader').style.display = 'none';
    const area = document.getElementById('lightbox-content-area');
    area.innerHTML = `
        <div style="color:white;text-align:center;">
            <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:#facc15;margin-bottom:20px;"></i>
            <p style="font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Error al cargar imagen</p>
            <p style="opacity:0.6;font-size:12px;">El archivo podría no existir o la URL es inválida</p>
        </div>
    `;
  };

  document.body.appendChild(lightbox);

  // Forzar que otros modales se pongan detrás (importante para evitar el conflicto con el z-index 2147483647 de showModal)
  ['modal-client-detail', 'modal-project-detail', 'kanban-drawer-overlay'].forEach(id => {
      const m = document.getElementById(id);
      if (m) m.style.setProperty('z-index', '50', 'important');
  });

  const closeLightbox = () => {
    lightbox.remove();
    if (mainModal) mainModal.style.setProperty('z-index', '100', 'important');
    document.removeEventListener('keydown', escLb);
  };

  lightbox.addEventListener('click', e => { if (e.target === lightbox || e.target.id === 'lightbox-content-area') closeLightbox(); });
  function escLb(e) { if (e.key === 'Escape') closeLightbox(); }
  document.addEventListener('keydown', escLb);
}

// Expose globally for onclick attributes in dynamic HTML
window.openFilePreview = openFilePreview;
window.showClientDetail = showClientDetail;

function _showContractSelectorModal(contracts) {
    const existing = document.getElementById('contract-selector-modal');
    if (existing) existing.remove();

    // Forzar que otros modales se pongan detrás
    ['modal-client-detail', 'modal-project-detail', 'kanban-drawer-overlay'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.setProperty('z-index', '50', 'important');
    });

    const modal = document.createElement('div');
    modal.id = 'contract-selector-modal';
    modal.style.cssText = 'position:fixed; inset:0; z-index:2147483647; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(0,0,0,0.8); backdrop-filter:blur(12px); animation:fadeIn 0.2s ease;';
    
    modal.innerHTML = `
        <div style="background:#0f172a; border:1px solid rgba(255,255,255,0.1); border-radius:32px; width:100%; max-width:400px; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7); animation:zoomIn 0.2s ease;">
            <div style="padding:28px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02);">
                <h3 style="color:white; font-weight:800; font-size:1.2rem; margin:0; letter-spacing:-0.5px;">Ver Contrato</h3>
                <button onclick="this.closest('#contract-selector-modal').remove()" style="background:rgba(255,255,255,0.05); border:none; color:#9ca3af; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)'; this.style.color='white'" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#9ca3af'">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <div style="padding:24px; display:flex; flex-direction:column; gap:12px;">
                <p style="color:#475569; font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:8px; margin-left:4px;">Selecciona la versión:</p>
                ${contracts.map(c => {
                    const isSolar = c.label.toLowerCase().includes('solar');
                    const isWater = c.label.toLowerCase().includes('water');
                    const color = isSolar ? '#f59e0b' : (isWater ? '#0ea5e9' : '#a855f7');
                    const bgColor = isSolar ? 'rgba(245,158,11,0.12)' : (isWater ? 'rgba(14,165,233,0.12)' : 'rgba(168,85,247,0.12)');
                    const icon = isSolar ? 'fa-sun' : (isWater ? 'fa-water' : 'fa-home');
                    
                    return `
                        <button onclick="window.openFilePreview('ofi-contrato', 'Contrato ${c.label}', { valor: '${c.url}' }); this.closest('#contract-selector-modal').remove()" 
                                style="display:flex; align-items:center; gap:18px; padding:20px; border-radius:20px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); cursor:pointer; text-align:left; transition:all 0.2s; width:100%; position:relative; overflow:hidden;"
                                onmouseover="this.style.background='rgba(255,255,255,0.06)'; this.style.transform='translateY(-2px)'; this.style.borderColor='rgba(255,255,255,0.1)';"
                                onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.transform='translateY(0)'; this.style.borderColor='rgba(255,255,255,0.05)';">
                            <div style="width:48px; height:48px; border-radius:16px; background:${bgColor}; display:flex; align-items:center; justify-content:center; color:${color}; font-size:1.3rem; flex-shrink:0; box-shadow:inset 0 0 10px ${color}20;">
                                <i class="fa-solid ${icon}"></i>
                            </div>
                            <div style="flex:1;">
                                <p style="color:white; font-weight:700; font-size:1rem; margin:0;">Renew ${c.label}</p>
                                <p style="color:#64748b; font-size:0.65rem; text-transform:uppercase; font-weight:900; letter-spacing:0.5px; margin:0; margin-top:2px;">Previsualizar Documento</p>
                            </div>
                            <div style="width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; color:#334155;">
                                <i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i>
                            </div>
                        </button>
                    `;
                }).join('')}
            </div>
            <div style="padding:16px 24px; background:rgba(0,0,0,0.2); text-align:center;">
                <p style="color:#334155; font-size:0.6rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin:0;">Sistema de Gestión de Contratos - Renew</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

window.handleContractView = (clientId) => {
    const db = getDB();
    const cli = db.Clientes_Maestro.find(c => c.id === clientId);
    if (!cli) return;

    const contracts = [];
    const adj = cli.adjuntos_oficina || {};

    if (cli.contrato_solar_url || adj.contrato_solar_url) 
        contracts.push({ label: 'Solar', url: cli.contrato_solar_url || adj.contrato_solar_url });
    if (cli.contrato_water_url || adj.contrato_water_url) 
        contracts.push({ label: 'Water', url: cli.contrato_water_url || adj.contrato_water_url });
    if (cli.contrato_home_url || adj.contrato_home_url) 
        contracts.push({ label: 'Home', url: cli.contrato_home_url || adj.contrato_home_url });

    // Fallback if none found with prefixes but generic exists
    if (contracts.length === 0 && (cli.contrato_url || adj.contrato_url)) {
        contracts.push({ label: 'General', url: cli.contrato_url || adj.contrato_url });
    }

    if (contracts.length === 0) {
        showToast('No se encontró ningún contrato para este cliente', 'info');
        return;
    }

    if (contracts.length === 1) {
        window.openFilePreview('ofi-contrato', 'Contrato ' + contracts[0].label, { valor: contracts[0].url });
    } else {
        _showContractSelectorModal(contracts);
    }
};

// ââ‚¬ââ‚¬ CLIENT PROFILE LOGIC ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬

async function showClientDetail(id) {
    const db = getDB();
    const cli = (db.Clientes_Maestro || []).find(c => c.id === id);
    if (!cli) return;
    state.activeClientId = id;

    exitClientEditMode();

    // Population
    if(document.getElementById('det-cli-nombre')) document.getElementById('det-cli-nombre').textContent = cli.nombre || '-';
    if(document.getElementById('det-cli-email')) document.getElementById('det-cli-email').textContent = cli.email || '-';
    if(document.getElementById('det-cli-tel')) document.getElementById('det-cli-tel').textContent = cli.telefono || '-';
    // ââ‚¬ââ‚¬ Multi-dept badges ââ‚¬ââ‚¬
    const detDeptEl = document.getElementById('det-cli-dept');
    if (detDeptEl) {
      const _depts = Array.isArray(cli.departamentos_activos) && cli.departamentos_activos.length ? cli.departamentos_activos : (cli.departamento || cli.empresa ? [cli.departamento || cli.empresa] : []);
      if (_depts.length) {
        detDeptEl.innerHTML = _depts.map(d => {
          const _nm = d.replace('Renew ','');
          const _cls = _nm.toLowerCase().includes('water') ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : _nm.toLowerCase().includes('solar') ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-lime-500/10 text-lime-500 border-lime-500/20';
          return `<span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${_cls} border">${_nm}</span>`;
        }).join('');
      } else {
        detDeptEl.innerHTML = '<span class="text-sm text-gray-300 italic">Sin departamento</span>';
      }
    }
    // ââ‚¬ââ‚¬ Macro estado ââ‚¬ââ‚¬
    const detMacroEl = document.getElementById('det-cli-macro-estado');
    if (detMacroEl) {
      let _me = cli.macro_estado || 'Prospecto';
      
      // Safety recovery for UI consistency
      if (cli.departamento === 'CANCELADO' || (cli.estado && cli.estado.toLowerCase() === 'cancelado')) {
        _me = 'Cancelado';
      }

      const _meColors = { 'Prospecto': 'text-sky-400', 'En Proceso': 'text-amber-400', 'Cliente': 'text-tealAccent', 'Cancelado': 'text-red-400' };
      detMacroEl.className = `text-sm font-black ${_meColors[_me] || 'text-gray-400'}`;
      detMacroEl.textContent = _me;
    }
    if(document.getElementById('det-cli-fecha-inicio')) document.getElementById('det-cli-fecha-inicio').textContent = cli.fecha_inicio || 'No establecida';
    if(document.getElementById('det-cli-direccion')) document.getElementById('det-cli-direccion').textContent = cli.direccion || '-';
    if(document.getElementById('det-cli-state-id')) document.getElementById('det-cli-state-id').textContent = cli.state_id || '-';
    if(document.getElementById('det-cli-dob')) document.getElementById('det-cli-dob').textContent = cli.dob || '-';
    if(document.getElementById('det-cli-notas')) document.getElementById('det-cli-notas').textContent = cli.notas || '-';

    // Reset Evidence State
    state.currentDetAdjID = cli.adjunto_id_url || null;
    state.currentDetAdjBill = cli.adjunto_bill_url || null;
    state.currentDetAdjSeguro = cli.adjunto_seguro_url || null;
    state.currentDetOfiApp = (cli.adjuntos_oficina && cli.adjuntos_oficina.app_url) || null;
    state.currentDetOfiRecibo = (cli.adjuntos_oficina && (cli.adjuntos_oficina.recibo_url || cli.adjuntos_oficina.recibo_vendedor_url || cli.adjuntos_oficina.recibo_tecnico_url)) || null;
    
    // Contracts are now pipeline-aware
    const adj = cli.adjuntos_oficina || {};
    state.currentDetOfiContratoWater = adj.contrato_water_url || cli.contrato_water_url || null;
    state.currentDetOfiContratoSolar = adj.contrato_solar_url || cli.contrato_solar_url || null;
    state.currentDetOfiContratoHome  = adj.contrato_home_url  || cli.contrato_home_url  || null;
    
    // Fallback for generic contract
    state.currentDetOfiContrato = adj.contrato_url || cli.contrato_url || null;

    state.currentDetOfiOrden = (cli.adjuntos_oficina && cli.adjuntos_oficina.orden_trabajo_url) || null;

    // Update Evidence Buttons Visuals
    const updateBtn = (id, url, label, customViewHandler = null) => {
        const btn = document.getElementById(`drop-det-${id}`);
        const lbl = document.getElementById(`lbl-det-${id}`);
        if (btn && lbl) {
            if (url) {
                btn.classList.add('border-tealAccent', 'bg-tealAccent/5');
                const viewAction = customViewHandler || `window.openFilePreview('${id}', '${label}', { valor: '${url}' })`;
                lbl.innerHTML = `
                    <div class="flex flex-col items-center gap-1">
                        <span class="text-tealAccent font-black">ACTUALIZAR ${label}</span>
                        <div class="flex gap-2 mt-2">
                            <button onclick="event.stopPropagation(); ${viewAction}" class="w-8 h-8 rounded-full bg-tealAccent/10 text-tealAccent border border-tealAccent/20 flex items-center justify-center hover:bg-tealAccent hover:text-white transition-all" title="Visualizar">
                                <i class="fa-solid fa-eye text-[10px]"></i>
                            </button>
                            <a href="${url}" download onclick="event.stopPropagation()" class="w-8 h-8 rounded-full bg-tealAccent/10 text-tealAccent border border-tealAccent/20 flex items-center justify-center hover:bg-tealAccent hover:text-white transition-all" title="Descargar">
                                <i class="fa-solid fa-download text-[10px]"></i>
                            </a>
                            <button onclick="event.stopPropagation(); document.getElementById('inp-det-${id}').click()" class="w-8 h-8 rounded-full bg-amber-400/10 text-amber-600 border border-amber-400/20 flex items-center justify-center hover:bg-amber-400 hover:text-white transition-all" title="Cambiar Archivo">
                                <i class="fa-solid fa-rotate text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                `;
                lbl.classList.replace('text-gray-400', 'text-tealAccent');
            } else {
                btn.classList.remove('border-tealAccent', 'bg-tealAccent/5');
                lbl.innerHTML = label;
                lbl.classList.replace('text-tealAccent', 'text-gray-400');
            }
        }
    };

    updateBtn('adj-id', state.currentDetAdjID, 'Foto ID');
    updateBtn('adj-bill', state.currentDetAdjBill, 'Bill Eléctrico');
    updateBtn('adj-seguro', state.currentDetAdjSeguro, 'Póliza de Seguro');
    updateBtn('ofi-app', state.currentDetOfiApp, 'Hoja Aplicación');
    updateBtn('ofi-recibo', state.currentDetOfiRecibo, 'Recibo de Pago');
    
    // Handle specific contracts
    const contractArea = document.getElementById('drop-det-ofi-contrato')?.parentElement;
    if (contractArea) {
        // Count total contracts
        const contractUrls = [state.currentDetOfiContratoSolar, state.currentDetOfiContratoWater, state.currentDetOfiContratoHome, state.currentDetOfiContrato].filter(u => !!u);
        
        if (contractUrls.length > 1) {
            // MULTIPLE: Show generic label and use the selector handler
            updateBtn('ofi-contrato', contractUrls[0], 'CONTRATOS MULTIPLES', `window.handleContractView('${cli.id}')`);
        } else if (contractUrls.length === 1) {
            // SINGLE: Label it specifically if we know which one it is
            let specificLabel = 'Contrato Firmado';
            if (state.currentDetOfiContratoSolar) specificLabel = 'Contrato SOLAR';
            else if (state.currentDetOfiContratoWater) specificLabel = 'Contrato WATER';
            else if (state.currentDetOfiContratoHome) specificLabel = 'Contrato HOME';
            
            updateBtn('ofi-contrato', contractUrls[0], specificLabel);
        } else {
            // NONE:
            updateBtn('ofi-contrato', null, 'Contrato Firmado');
        }
    }

    updateBtn('ofi-orden', state.currentDetOfiOrden, 'Orden de Trabajo');
    
    // ID Photo View Logic
    const btnViewId = document.getElementById('btn-view-cli-id-photo');
    const noIdMsg = document.getElementById('det-cli-id-no-photo');
    if (cli.id_photo) {
        if(btnViewId) {
            btnViewId.classList.remove('hidden');
            btnViewId.classList.add('flex');
            btnViewId.onclick = () => {
                window.openFilePreview('id_photo_temp', 'Documento de Identidad del Cliente', { valor: cli.id_photo });
            };
        }
        if(noIdMsg) noIdMsg.classList.add('hidden');
    } else {
        if(btnViewId) {
            btnViewId.classList.add('hidden');
            btnViewId.classList.remove('flex');
        }
        if(noIdMsg) noIdMsg.classList.remove('hidden');
    }

    // Co-Applicant ID Photo View Logic
    const btnViewCoId = document.getElementById('btn-view-cli-co-id-photo');
    const noCoIdMsg = document.getElementById('det-cli-co-id-no-photo');
    const coIdPhoto = cli.adjuntos_oficina?.co_applicant_id_url;
    if (coIdPhoto) {
        if(btnViewCoId) {
            btnViewCoId.classList.remove('hidden');
            btnViewCoId.classList.add('flex');
            btnViewCoId.onclick = () => {
                window.openFilePreview('co_id_photo_temp', 'Documento de Identidad del Co-Aplicante', { valor: coIdPhoto });
            };
        }
        if(noCoIdMsg) noCoIdMsg.classList.add('hidden');
    } else {
        if(btnViewCoId) {
            btnViewCoId.classList.add('hidden');
            btnViewCoId.classList.remove('flex');
        }
        if(noCoIdMsg) noCoIdMsg.classList.remove('hidden');
    }

    // Status label
    const statLbl = document.getElementById('det-cli-status-label');
    if (statLbl) {
        statLbl.innerHTML = `<span class="w-2 h-2 rounded-full ${cli.estado === 'Completado' ? 'bg-teal-400' : 'bg-tealAccent'}"></span> ${cli.estado || 'PROSPECTO'}`;
    }

    const avatarBox = document.getElementById('det-cli-avatar');
    if (avatarBox) {
        if (cli.foto) {
            avatarBox.style.backgroundImage = `url(${cli.foto})`;
            avatarBox.innerHTML = '';
        } else {
            avatarBox.style.backgroundImage = 'none';
            avatarBox.innerHTML = `<i class="fa-solid fa-user text-6xl text-gray-200"></i>`;
        }
    }

    // WA and Call Buttons
    const btnWA = document.getElementById('btn-cli-whatsapp');
    if (btnWA && cli.telefono) {
        btnWA.onclick = () => window.open(`https://wa.me/${cli.telefono.replace(/\D/g, '')}`, '_blank');
    }
    const btnCall = document.getElementById('btn-cli-call');
    if (btnCall && cli.telefono) {
        btnCall.onclick = () => window.open(`tel:${cli.telefono}`, '_blank');
    }
    const btnEmail = document.getElementById('btn-cli-email');
    if (btnEmail && cli.email) {
        btnEmail.onclick = () => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${cli.email}`, '_blank');
    }

    if (UI.btnEditCliFromDetail) UI.btnEditCliFromDetail.dataset.id = id;

    // --- ASSIGNMENT LOGIC ---
    const workers = db.Usuarios || [];
    const selAssigned = document.getElementById('sel-vendedor-asignar');
    const selEditAssigned = document.getElementById('det-cli-edit-vendedor');
    const assignedNameText = document.getElementById('det-cli-vendedor-nombre');
    const assignedAvatar = document.getElementById('det-cli-vendedor-avatar');
    const reassignBtn = document.getElementById('btn-reassign-vendedor');
    const selectorWrap = document.getElementById('vendedor-selector-wrap');

    if (selAssigned) {
        selAssigned.innerHTML = '<option value="">Sin Asignar</option>';
        if (selEditAssigned) selEditAssigned.innerHTML = '<option value="">Sin Asignar</option>';

        const vendedorRoles = ['vendedor', 'representante de ventas', 'técnico'];
        const clientePipeline = cli.pipeline;

        const filteredWorkers = workers.filter(w => {
            const isVendorRole = vendedorRoles.includes((w.rol || '').toLowerCase());
            if (!isVendorRole) return false;
            // Si hay un pipeline asignado al cliente, filtrar por acceso
            if (clientePipeline && clientePipeline !== '-' && clientePipeline !== 'Lead (Nuevo)') {
                const workerUnidades = w.unidades || [];
                return workerUnidades.some(u => u.toLowerCase() === clientePipeline.toLowerCase());
            }
            return true; // Sin pipeline asignado, mostrar todos los vendedores
        });

        filteredWorkers.forEach(w => {
            const name = `${w.nombre || ''} ${w.apellido || ''}`.trim();
            const opt = `<option value="${w.id}">${name} (${w.rol || 'Staff'})</option>`;
            selAssigned.innerHTML += opt;
            if (selEditAssigned) selEditAssigned.innerHTML += opt;
        });

        // Si no hay vendedores disponibles para este pipeline, mostrar mensaje
        if (filteredWorkers.length === 0) {
            const msg = clientePipeline && clientePipeline !== '-'
                ? `<option value="" disabled>No hay vendedores con acceso a ${clientePipeline}</option>`
                : '<option value="" disabled>No hay vendedores disponibles</option>';
            selAssigned.innerHTML += msg;
        }

        // Set current values
        selAssigned.value = cli.vendedor_asignado_id || '';
        if (selEditAssigned) selEditAssigned.value = cli.vendedor_asignado_id || '';

        const currentWorker = workers.find(w => w.id === cli.vendedor_asignado_id);
        if (currentWorker) {
            assignedNameText.textContent = `${currentWorker.nombre} ${currentWorker.apellido || ''}`;
            assignedNameText.classList.add('text-tealAccent');
            assignedAvatar.textContent = (currentWorker.nombre[0] || '?').toUpperCase();
            assignedAvatar.classList.replace('bg-tealAccent/20', 'bg-tealAccent');
            assignedAvatar.classList.replace('text-tealAccent', 'text-white');
        } else {
            assignedNameText.textContent = 'Sin asignar';
            assignedNameText.classList.remove('text-tealAccent');
            assignedAvatar.textContent = '?';
            assignedAvatar.classList.replace('bg-tealAccent', 'bg-tealAccent/20');
            assignedAvatar.classList.replace('text-white', 'text-tealAccent');
        }
    }

    // --- ACCOUNT MANAGER ASSIGNMENT LOGIC ---
    const selAmAssigned = document.getElementById('sel-am-asignar');
    const amNameText = document.getElementById('det-cli-am-nombre');
    const amAvatar = document.getElementById('det-cli-am-avatar');
    const reassignAmBtn = document.getElementById('btn-reassign-am');
    const amSelectorWrap = document.getElementById('am-selector-wrap');

    if (selAmAssigned) {
        selAmAssigned.innerHTML = '<option value="">Sin Asignar</option>';
        
        const amWorkers = workers.filter(w => {
            const r = (w.rol || '').toLowerCase();
            const sub = (w.sub_rol || '').toLowerCase();
            return r === 'account manager' || sub === 'account manager';
        });

        amWorkers.forEach(w => {
            const name = `${w.nombre || ''} ${w.apellido || ''}`.trim();
            const opt = `<option value="${w.id}">${name} (Account Manager)</option>`;
            selAmAssigned.innerHTML += opt;
        });

        if (amWorkers.length === 0) {
            selAmAssigned.innerHTML += '<option value="" disabled>No hay Account Managers disponibles</option>';
        }

        selAmAssigned.value = cli.account_manager_id || '';

        const currentAm = workers.find(w => w.id === cli.account_manager_id);
        if (currentAm) {
            amNameText.textContent = `${currentAm.nombre} ${currentAm.apellido || ''}`;
            amNameText.classList.add('text-tealAccent');
            amAvatar.textContent = (currentAm.nombre[0] || '?').toUpperCase();
            amAvatar.classList.replace('bg-tealAccent/20', 'bg-tealAccent');
            amAvatar.classList.replace('text-tealAccent', 'text-white');
        } else {
            amNameText.textContent = 'Sin asignar';
            amNameText.classList.remove('text-tealAccent');
            amAvatar.textContent = '?';
            amAvatar.classList.replace('bg-tealAccent', 'bg-tealAccent/20');
            amAvatar.classList.replace('text-white', 'text-tealAccent');
        }
    }

    if (reassignAmBtn && amSelectorWrap) {
        reassignAmBtn.onclick = () => {
            amSelectorWrap.classList.toggle('hidden');
            reassignAmBtn.textContent = amSelectorWrap.classList.contains('hidden') ? 'Cambiar' : 'Cancelar';
        };
    }

    if (selAmAssigned) {
        selAmAssigned.onchange = async () => {
            const newId = selAmAssigned.value;
            cli.account_manager_id = newId || null;
            await saveDB(db);
            showToast('Account Manager asignado', 'success');
            
            const worker = workers.find(w => w.id === newId);
            if (worker) {
                amNameText.textContent = `${worker.nombre} ${worker.apellido || ''}`;
                amNameText.classList.add('text-tealAccent');
                amAvatar.textContent = worker.nombre[0].toUpperCase();
                amAvatar.classList.replace('bg-tealAccent/20', 'bg-tealAccent');
                amAvatar.classList.replace('text-tealAccent', 'text-white');
            } else {
                amNameText.textContent = 'Sin asignar';
                amNameText.classList.remove('text-tealAccent');
                amAvatar.textContent = '?';
                amAvatar.classList.replace('bg-tealAccent', 'bg-tealAccent/20');
                amAvatar.classList.replace('text-white', 'text-tealAccent');
            }
            setTimeout(() => amSelectorWrap.classList.add('hidden'), 500);
            reassignAmBtn.textContent = 'Cambiar';
        };
    }

    if (reassignBtn && selectorWrap) {
        reassignBtn.onclick = () => {
            selectorWrap.classList.toggle('hidden');
            reassignBtn.textContent = selectorWrap.classList.contains('hidden') ? 'Cambiar Asignación' : 'Cancelar';
        };
    }

    if (selAssigned) {
        selAssigned.onchange = async () => {
            const newId = selAssigned.value;
            cli.vendedor_asignado_id = newId || null;
            await saveDB(db);
            showToast('Asignación actualizada', 'success');
            
            // Refresh mini-view
            const worker = workers.find(w => w.id === newId);
            if (worker) {
                assignedNameText.textContent = `${worker.nombre} ${worker.apellido || ''}`;
                assignedNameText.classList.add('text-tealAccent');
                assignedAvatar.textContent = worker.nombre[0].toUpperCase();
                assignedAvatar.classList.replace('bg-tealAccent/20', 'bg-tealAccent');
                assignedAvatar.classList.replace('text-tealAccent', 'text-white');
                
                // NOTIFICAR VIA WEBHOOK (n8n)
                try {
                    const payload = {
                        cliente_id: cli.id,
                        cliente_nombre: cli.nombre,
                        cliente_telefono: cli.telefono || 'No registrado',
                        cliente_email: cli.email || 'No registrado',
                        cliente_direccion: cli.direccion || 'No registrada',
                        pipeline: cli.empresa || cli.departamento || 'No asignado',
                        vendedor_nombre: `${worker.nombre} ${worker.apellido || ''}`.trim(),
                        vendedor_email: worker.email || ''
                    };
                    console.log('Enviando webhook a n8n (on change)...', payload);
                    const params = new URLSearchParams();
                    for(const key in payload) params.append(key, payload[key]);
                    
                    fetch('https://n8n.renewgroup.site/webhook/avisar-vendedor-cliente-asignado', {
                        method: 'POST',
                        mode: 'no-cors', // Evita el error de CORS al enviar desde localhost
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params.toString()
                    }).then(() => {
                        console.log('Webhook n8n enviado exitosamente (modo no-cors)');
                    }).catch(e => console.error('Error al enviar webhook n8n:', e));
                } catch(e) {
                    console.error(e);
                }
            } else {
                assignedNameText.textContent = 'Sin asignar';
                assignedNameText.classList.remove('text-tealAccent');
                assignedAvatar.textContent = '?';
                assignedAvatar.classList.replace('bg-tealAccent', 'bg-tealAccent/20');
                assignedAvatar.classList.replace('text-white', 'text-tealAccent');
            }
            selectorWrap.classList.add('hidden');
            reassignBtn.textContent = 'Cambiar Asignación';
            await renderView(); // Refresh table background
        };
    }

    // --- GALLERY & TABS ---
    const badge = document.getElementById('evidence-count-badge');
    const galleryCont = document.getElementById('cli-evidence-gallery');

    if (galleryCont) {
        // Build Projects view (replaces legacy gallery)
        const db2 = getDB();
        const pipelines = db2.Admin_Pipelines || [];
        const fasesAll = db2.Admin_Fases || [];
        const proyectos = (db2.Proyectos_Dinamicos || []).filter(p => p.cliente_id === cli.id);

        if (proyectos.length > 0) {
            badge.textContent = `${proyectos.length} PROYECTOS`;
            
            // Build general client documents panel
            let generalDocsHtml = '';
            const generalDocs = [];
            if (cli.id_photo) generalDocs.push({ src: cli.id_photo, label: 'Foto ID' });
            if (cli.adjunto_bill_url) generalDocs.push({ src: cli.adjunto_bill_url, label: 'Bill Eléctrico' });
            if (cli.adjunto_seguro_url) generalDocs.push({ src: cli.adjunto_seguro_url, label: 'Póliza Seguro' });
            (cli.archivos_adjuntos || []).forEach((src, i) => generalDocs.push({ src, label: `Evidencia #${i+1}` }));

            if (generalDocs.length > 0) {
                generalDocsHtml = `
                <div class="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <h4 class="text-[11px] font-black uppercase text-gray-500 mb-3 flex items-center gap-2"><i class="fa-solid fa-folder"></i> Documentos Generales</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        ${generalDocs.map((doc, idx) => {
                            const isImage = doc.src.startsWith('data:image') || doc.src.match(/\.(jpg|jpeg|png|gif|webp)/i);
                            return `
                            <div class="group relative bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                <div class="relative aspect-video">
                                    ${isImage 
                                      ? `<img src="${doc.src}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">`
                                      : `<div class="w-full h-full flex flex-col items-center justify-center bg-gray-50"><i class="fas fa-file-pdf text-2xl text-red-400"></i></div>`
                                    }
                                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button onclick="window.openFilePreview('gen_${idx}','${doc.label}',{valor:'${doc.src}'})" class="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center"><i class="fas fa-expand text-[10px]"></i></button>
                                        <a href="${doc.src}" download="${doc.label}" class="w-8 h-8 rounded-full bg-tealAccent/80 text-white flex items-center justify-center"><i class="fas fa-download text-[10px]"></i></a>
                                    </div>
                                </div>
                                <p class="text-[9px] font-bold text-center py-2 text-gray-600 truncate px-2">${doc.label}</p>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }

            const proyectosHtml = proyectos.map(p => {
                const pip = pipelines.find(pl => pl.id === p.pipeline_id) || { nombre: 'Pipeline', color: '#0d9488' };
                const isCompleted = p.estado === 'Completado' || p.fase_id === 'Completado';
                let faseNom = 'Completado';
                if (!isCompleted && p.fase_id) {
                    const f = fasesAll.find(x => x.id === p.fase_id);
                    if (f) faseNom = f.nombre;
                }

                // Gather files for this project
                const pFiles = [];
                const respuestas = (db2.Respuestas_Dinamicas || []).filter(r => r.proyecto_id === p.id);
                const campos = db2.Admin_Campos_Formulario || [];
                respuestas.forEach(r => {
                    const c = campos.find(x => x.id === r.campo_id);
                    if (c && c.tipo === 'Archivo' && r.valor && r.valor.startsWith('http')) {
                        pFiles.push({ src: r.valor, label: c.etiqueta, id: r.campo_id });
                    }
                });

                // Office attachments matching pipeline
                const adj = cli.adjuntos_oficina || {};
                const pNameLower = pip.nombre.toLowerCase();
                if (pNameLower.includes('solar') && adj.contrato_solar_url) pFiles.push({ src: adj.contrato_solar_url, label: 'Contrato Solar' });
                else if (pNameLower.includes('water') && adj.contrato_water_url) pFiles.push({ src: adj.contrato_water_url, label: 'Contrato Water' });
                else if (pNameLower.includes('home') && adj.contrato_home_url) pFiles.push({ src: adj.contrato_home_url, label: 'Contrato Home' });
                else if (adj.contrato_url) pFiles.push({ src: adj.contrato_url, label: 'Contrato (General)' });

                if (adj.app_url) pFiles.push({ src: adj.app_url, label: 'Hoja de Aplicación' });
                if (adj.orden_trabajo_url) pFiles.push({ src: adj.orden_trabajo_url, label: 'Orden de Trabajo' });
                const rUrl = adj.recibo_url || adj.recibo_vendedor_url || adj.recibo_tecnico_url;
                if (rUrl) pFiles.push({ src: rUrl, label: 'Recibo de Pago' });

                const filesGrid = pFiles.length > 0 ? pFiles.map((f, i) => {
                    const isImage = f.src.startsWith('data:image') || f.src.match(/\.(jpg|jpeg|png|gif|webp)/i);
                    return `
                    <div class="group relative bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all">
                        <div class="relative aspect-[4/3]">
                            ${isImage 
                              ? `<img src="${f.src}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">`
                              : `<div class="w-full h-full flex flex-col items-center justify-center bg-gray-50"><i class="fas fa-file-pdf text-3xl text-red-400"></i></div>`
                            }
                            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button onclick="window.openFilePreview('${p.id}_${i}','${f.label}',{valor:'${f.src}'})" class="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center"><i class="fas fa-expand text-[10px]"></i></button>
                                <a href="${f.src}" download="${f.label}" class="w-8 h-8 rounded-full bg-tealAccent/80 text-white flex items-center justify-center"><i class="fas fa-download text-[10px]"></i></a>
                            </div>
                        </div>
                        <div class="px-2 py-2 flex items-center justify-between border-t border-gray-100">
                            <p class="text-[9px] font-bold text-gray-700 truncate">${f.label}</p>
                        </div>
                    </div>`;
                }).join('') : `<p class="col-span-full text-[10px] text-gray-400 font-bold uppercase italic text-center py-4">Sin archivos en este proyecto</p>`;

                return `
                <div class="mb-4 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div class="flex items-center justify-between p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" style="border-left: 4px solid ${pip.color}" onclick="this.nextElementSibling.classList.toggle('hidden'); const i = this.querySelector('.fa-chevron-down'); if(i) { i.style.transform = this.nextElementSibling.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)'; i.style.transition = 'transform 0.2s'; }">
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-black uppercase text-gray-800 tracking-wider">${pip.nombre}</span>
                            <span class="px-2 py-0.5 rounded bg-gray-100 text-[9px] font-bold text-gray-500 uppercase">${p.id.substring(0,8)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] font-bold text-gray-400 uppercase">Fase:</span>
                            <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase" style="background:${isCompleted ? '#10b98115' : pip.color+'15'}; color:${isCompleted ? '#10b981' : pip.color};">${faseNom}</span>
                            <button onclick="event.stopPropagation(); window.openKanbanDrawer('${p.id}');" class="ml-2 px-3 py-1.5 bg-tealAccent text-black rounded-lg text-[9px] font-black uppercase shadow-sm hover:bg-tealAccent/80 transition-colors flex items-center gap-1">
                                <i class="fas fa-external-link-alt"></i> Ver Proyecto
                            </button>
                            <button class="ml-2 text-gray-400 hover:text-tealAccent transition-colors">
                                <i class="fa-solid fa-chevron-down" style="transform: rotate(180deg);"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-4 bg-gray-50/50">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            ${filesGrid}
                        </div>
                    </div>
                </div>`;
            }).join('');

            galleryCont.innerHTML = generalDocsHtml + proyectosHtml;

        } else {
            badge.textContent = `0 PROYECTOS`;
            galleryCont.innerHTML = `
                <div class="col-span-full py-20 text-center opacity-30">
                    <i class="fa-solid fa-folder-open text-4xl mb-3"></i>
                    <p class="text-[10px] font-black uppercase tracking-[0.2em]">El cliente no tiene proyectos</p>
                </div>
            `;
        }
    }

    // --- CALLS TAB ---
    const callsBadge = document.getElementById('cli-calls-count-badge');
    const callsCont = document.getElementById('cli-calls-container');
    if (callsCont && callsBadge) {
        const history = cli.historial_llamadas || [];
        callsBadge.textContent = `${history.length} LLAMADAS`;
        
        if (history.length > 0) {
            // Retrieve client projects to build dropdown
            const dbRef = getDB();
            const activeProjects = (dbRef.Proyectos_Dinamicos || []).filter(p => p.cliente_id === cli.id);
            const pipelines = dbRef.Admin_Pipelines || [];
            
            callsCont.innerHTML = history.slice().reverse().map((call, i) => {
                const callDate = new Date(call.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
                const durMin = Math.floor(call.duracion / 60);
                const durSec = call.duracion % 60;
                
                let playHTML = `<span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">Procesando...</span>`;
                if (call.grabacion_url && call.grabacion_url.startsWith('http')) {
                    playHTML = `
                    <audio id="audio-${call.call_id}" src="${call.grabacion_url}" preload="none"></audio>
                    <button onclick="const a=document.getElementById('audio-${call.call_id}'); if(a.paused){a.play();this.innerHTML='<i class=\\'fa-solid fa-pause\\'></i>';}else{a.pause();this.innerHTML='<i class=\\'fa-solid fa-play\\'></i>';}" class="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center hover:bg-sky-200 transition-colors">
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <a href="${call.grabacion_url}" download class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <i class="fa-solid fa-download"></i>
                    </a>`;
                }
                
                let projectSelectHTML = `<select disabled class="text-[10px] px-2 py-1 bg-gray-50 border border-gray-200 rounded outline-none w-32"><option>Sin proyectos</option></select>`;
                if (activeProjects.length > 0) {
                    projectSelectHTML = `<select class="text-[10px] px-2 py-1 bg-white border border-gray-200 rounded outline-none w-36 hover:border-tealAccent transition-colors" onchange="window.linkCallToProject('${cli.id}', '${call.call_id}', this.value)">
                        <option value="">Vincular a proyecto...</option>
                        ${activeProjects.map(p => {
                            const pip = pipelines.find(pl => pl.id === p.pipeline_id) || { nombre: 'Proyecto' };
                            const isLinked = call.proyecto_id === p.id;
                            return `<option value="${p.id}" ${isLinked ? 'selected' : ''}>${pip.nombre} (${p.id.substring(0,6)})</option>`;
                        }).join('')}
                    </select>`;
                }
                
                return `
                <div class="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-tealAccent hover:shadow-sm transition-all group">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center ${call.tipo === 'Entrante' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}">
                            <i class="fa-solid ${call.tipo === 'Entrante' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <p class="text-sm font-bold text-gray-800">${call.tipo || 'Llamada'}</p>
                                ${call.proyecto_id ? `<span class="text-[9px] font-black text-white bg-tealAccent px-1.5 py-0.5 rounded uppercase flex items-center gap-1"><i class="fa-solid fa-link"></i> Vinculada</span>` : ''}
                            </div>
                            <p class="text-[10px] text-gray-400 mt-0.5 font-medium"><i class="fa-regular fa-clock"></i> ${callDate} • <i class="fa-solid fa-stopwatch"></i> ${durMin}m ${durSec}s</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        ${projectSelectHTML}
                        ${playHTML}
                    </div>
                </div>`;
            }).join('');
        } else {
            callsCont.innerHTML = `
            <div class="col-span-full py-20 text-center opacity-30">
                <i class="fa-solid fa-microphone-slash text-4xl mb-3"></i>
                <p class="text-[10px] font-black uppercase tracking-[0.2em]">Sin historial de llamadas</p>
            </div>`;
        }
    }


    // Default to main tab on open
    document.querySelectorAll('.cli-tab-btn').forEach(b => {
        b.classList.remove('active', 'border-tealAccent', 'text-tealAccent');
        b.classList.add('border-transparent', 'text-gray-400');
        if(b.dataset.tab === 'info') {
            b.classList.add('active', 'border-tealAccent', 'text-tealAccent');
            b.classList.remove('border-transparent', 'text-gray-400');
        }
    });
    document.querySelectorAll('.cli-tab-content').forEach(c => c.classList.add('hidden'));
    if(document.getElementById('cli-tab-info')) document.getElementById('cli-tab-info').classList.remove('hidden');

    window.showModal(UI.modCliDetail);
}

// Lógica para vincular llamadas
window.linkCallToProject = async function(clientId, callId, projectId) {
    try {
        const dbRef = getDB();
        const cliIdx = dbRef.Clientes_Maestro.findIndex(c => c.id === clientId);
        if (cliIdx === -1) return;
        
        const history = dbRef.Clientes_Maestro[cliIdx].historial_llamadas || [];
        const callIdx = history.findIndex(h => h.call_id === callId);
        
        if (callIdx !== -1) {
            history[callIdx].proyecto_id = projectId || null;
            dbRef.Clientes_Maestro[cliIdx].historial_llamadas = history;
            await saveDB(dbRef);
            
            // Also notify the server to update the specific call
            fetch('/api/db', { // Usamos cualquier endpoint post que haga un guardado completo, o saveDB ya lo hace
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Clientes_Maestro: dbRef.Clientes_Maestro })
            });
            
            showToast(projectId ? 'Llamada vinculada exitosamente' : 'Vínculo removido', 'success');
            await showClientDetail(clientId); // Refresh view
        }
    } catch(err) {
        console.error(err);
        showToast('Error al vincular llamada', 'error');
    }
};

// Global Tab Handler
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('cli-tab-btn')) {
        const tab = e.target.dataset.tab;
        
        // Buttons UI
        document.querySelectorAll('.cli-tab-btn').forEach(b => {
            b.classList.remove('active', 'border-tealAccent', 'text-tealAccent');
            b.classList.add('border-transparent', 'text-gray-400');
        });
        e.target.classList.add('active', 'border-tealAccent', 'text-tealAccent');
        e.target.classList.remove('border-transparent', 'text-gray-400');

        // Content Visibility
        document.querySelectorAll('.cli-tab-content').forEach(c => c.classList.add('hidden'));
        const targetCont = document.getElementById(`cli-tab-${tab}`);
        if(targetCont) targetCont.classList.remove('hidden');
    }
});

function exitClientEditMode() {
    const editPanel = document.getElementById('det-cli-edit-panel');
    const viewPanel = document.getElementById('det-cli-view-panel');
    const saveBar = document.getElementById('det-cli-save-bar');
    const gearBtn = document.getElementById('btn-edit-cli-from-detail');
    if (editPanel) editPanel.classList.add('hidden');
    if (viewPanel) viewPanel.classList.remove('hidden');
    if (saveBar) saveBar.classList.add('hidden');
    if (gearBtn) {
        gearBtn.classList.remove('text-tealAccent', 'bg-tealAccent/10', 'rotate-45');
    }
}
window.exitClientEditMode = exitClientEditMode;

function toggleClientEditMode(id) {
    const db = getDB();
    const cli = (db.Clientes_Maestro || []).find(c => c.id === id);
    if (!cli) return;

    const editPanel = document.getElementById('det-cli-edit-panel');
    const viewPanel = document.getElementById('det-cli-view-panel');
    const saveBar = document.getElementById('det-cli-save-bar');
    const gearBtn = document.getElementById('btn-edit-cli-from-detail');

    if (editPanel && !editPanel.classList.contains('hidden')) {
        exitClientEditMode();
        return;
    }

    if (viewPanel) viewPanel.classList.add('hidden');
    if (editPanel) {
        editPanel.classList.remove('hidden');
        if(document.getElementById('det-cli-edit-id')) document.getElementById('det-cli-edit-id').value = cli.id;
        if(document.getElementById('det-cli-edit-nombre')) document.getElementById('det-cli-edit-nombre').value = cli.nombre || '';
        if(document.getElementById('det-cli-edit-email')) document.getElementById('det-cli-edit-email').value = cli.email || '';
        if(document.getElementById('det-cli-edit-tel')) document.getElementById('det-cli-edit-tel').value = cli.telefono || '';
        // ââ‚¬ââ‚¬ Populate multi-dept checkboxes ââ‚¬ââ‚¬
        const _deptArr = Array.isArray(cli.departamentos_activos) && cli.departamentos_activos.length ? cli.departamentos_activos : (cli.departamento || cli.empresa ? [(cli.departamento || cli.empresa).replace('Renew ','')] : []);
        document.querySelectorAll('input[name="det-chk-dept"]').forEach(cb => { cb.checked = _deptArr.some(d => d.replace('Renew ','').toLowerCase() === cb.value.toLowerCase()); });
        // ââ‚¬ââ‚¬ Populate macro_estado ââ‚¬ââ‚¬
        if(document.getElementById('det-cli-edit-macro-estado')) document.getElementById('det-cli-edit-macro-estado').value = cli.macro_estado || 'Prospecto';
        if(document.getElementById('det-cli-edit-fecha-inicio')) document.getElementById('det-cli-edit-fecha-inicio').value = cli.fecha_inicio || '';
        if(document.getElementById('det-cli-edit-direccion')) {
            const dirInput = document.getElementById('det-cli-edit-direccion');
            dirInput.value = cli.direccion || '';
            if (window.google && window.google.maps && window.google.maps.places && !dirInput._placesInit) {
                dirInput._placesInit = true;
                const autocomplete = new google.maps.places.Autocomplete(dirInput, {
                    types: ['address'],
                    fields: ['formatted_address', 'name']
                });
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place && (place.formatted_address || place.name)) {
                        dirInput.value = place.formatted_address || place.name;
                    }
                });
            }
        }
        if(document.getElementById('det-cli-edit-state-id')) document.getElementById('det-cli-edit-state-id').value = cli.state_id || '';
        if(document.getElementById('det-cli-edit-dob')) document.getElementById('det-cli-edit-dob').value = cli.dob || '';
        if(document.getElementById('det-cli-edit-notas')) document.getElementById('det-cli-edit-notas').value = cli.notas || '';
        
        // Populate edit photo preview
        state.currentCliIdPhoto = cli.id_photo || null;
        const editPrev = document.getElementById('cli-id-photo-preview');
        if (editPrev) {
            if (cli.id_photo) {
                editPrev.querySelector('img').src = cli.id_photo;
                editPrev.classList.remove('hidden');
            } else {
                editPrev.classList.add('hidden');
            }
        }
    }
    if (saveBar) saveBar.classList.remove('hidden');
    if (gearBtn) gearBtn.classList.add('text-tealAccent', 'bg-tealAccent/10', 'rotate-45');
}

async function saveClientChanges() {
    const id = document.getElementById('det-cli-edit-id').value;
    const db = getDB();
    const cliIdx = (db.Clientes_Maestro || []).findIndex(c => c.id === id);
    if (cliIdx === -1) return;

    const btn = document.getElementById('btn-save-cli-changes');
    const btnText = document.getElementById('save-btn-text');
    const btnSpinner = document.getElementById('save-btn-spinner');

    const nombre = document.getElementById('det-cli-edit-nombre').value.trim();
    if (!nombre) {
        showToast('El nombre es obligatorio.', 'error');
        return;
    }

    // Loading State
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Guardando...';
    if (btnSpinner) btnSpinner.classList.remove('hidden');

    try {

    const oldVendedorId = db.Clientes_Maestro[cliIdx].vendedor_asignado_id;
    const newVendedorId = document.getElementById('det-cli-edit-vendedor').value || null;

    const currentMacroEstado = db.Clientes_Maestro[cliIdx].macro_estado;
    const newMacroEstado = document.getElementById('det-cli-edit-macro-estado') ? document.getElementById('det-cli-edit-macro-estado').value : 'Prospecto';

    let newFechaConversion = db.Clientes_Maestro[cliIdx].fecha_conversion || db.Clientes_Maestro[cliIdx].fecha_cierre || null;
    if (newMacroEstado === 'Cliente' && currentMacroEstado !== 'Cliente' && !newFechaConversion) {
        newFechaConversion = new Date().toISOString();
    }

    let inputFechaInicio = document.getElementById('det-cli-edit-fecha-inicio').value;
    if (!inputFechaInicio) {
        inputFechaInicio = db.Clientes_Maestro[cliIdx].fecha_inicio || db.Clientes_Maestro[cliIdx].created_at || new Date().toISOString().split('T')[0];
    }

    const updated = {
        ...db.Clientes_Maestro[cliIdx],
        nombre,
        email: document.getElementById('det-cli-edit-email').value.trim(),
        telefono: document.getElementById('det-cli-edit-tel').value.trim(),
        // ââ‚¬ââ‚¬ Multi-dept from checkboxes ââ‚¬ââ‚¬
        departamentos_activos: Array.from(document.querySelectorAll('input[name="det-chk-dept"]:checked')).map(cb => cb.value),
        departamento: Array.from(document.querySelectorAll('input[name="det-chk-dept"]:checked')).map(cb => cb.value)[0] || null,
        empresa: Array.from(document.querySelectorAll('input[name="det-chk-dept"]:checked')).map(cb => cb.value).join(', ') || null,
        macro_estado: newMacroEstado,
        fecha_inicio: inputFechaInicio,
        fecha_conversion: newFechaConversion,
        direccion: document.getElementById('det-cli-edit-direccion').value.trim(),
        state_id: document.getElementById('det-cli-edit-state-id').value.trim(),
        dob: document.getElementById('det-cli-edit-dob').value,
        notas: document.getElementById('det-cli-edit-notas').value.trim(),
        vendedor_asignado_id: newVendedorId,
        id_photo: state.currentCliIdPhoto,
        adjunto_id_url: state.currentDetAdjID,
        adjunto_bill_url: state.currentDetAdjBill,
        adjunto_seguro_url: state.currentDetAdjSeguro,
        adjuntos_oficina: {
            app_url: state.currentDetOfiApp,
            recibo_url: state.currentDetOfiRecibo
        }
    };

    db.Clientes_Maestro[cliIdx] = updated;
    await saveDB(db);

                // If vendor changed, notify via webhook
    if (newVendedorId && newVendedorId !== oldVendedorId) {
        const workers = await getAdminWorkers();
        const worker = workers.find(w => w.id === newVendedorId);
        if (worker) {
            try {
                const payload = {
                    cliente_id: updated.id,
                    cliente_nombre: updated.nombre,
                    cliente_telefono: updated.telefono || 'No registrado',
                    cliente_email: updated.email || 'No registrado',
                    cliente_direccion: updated.direccion || 'No registrada',
                    pipeline: updated.empresa || updated.departamento || 'No asignado',
                    vendedor_nombre: `${worker.nombre} ${worker.apellido || ''}`.trim(),
                    vendedor_email: worker.email || ''
                };
                console.log('Enviando webhook a n8n (edit save)...', payload);
                const params = new URLSearchParams();
                for(const key in payload) params.append(key, payload[key]);

                fetch('https://n8n.renewgroup.site/webhook/avisar-vendedor-cliente-asignado', {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString()
                }).then(() => console.log('Webhook enviado exitosamente (modo no-cors)'))
                  .catch(e => console.error('Error al enviar webhook n8n:', e));
            } catch(e) {
                console.error(e);
            }
        }
    }

    exitClientEditMode();
    window.addNotification('CRM', 'Cliente actualizado correctamente.', 'success');
    await showClientDetail(id); // Re-populate view
    await renderView(); // Re-render table

    } catch (err) {
        console.error('Error saving client:', err);
        showToast('Error al guardar los cambios.', 'error');
    } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'Guardar Cambios';
        if (btnSpinner) btnSpinner.classList.add('hidden');
    }
}
window.saveClientChanges = saveClientChanges;
window.toggleClientEditMode = toggleClientEditMode;

// ââ‚¬ââ‚¬ NEW: EVENT LISTENERS FOR CLIENT PHOTO & EVIDENCE ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬

// 1. Photo Upload (ID Photo) in Edit Modal
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-trigger-cli-edit-photo');
    if (btn) {
        const input = document.getElementById('cli-edit-photo-input');
        if (input) input.click();
    }
});

document.addEventListener('change', async (e) => {
    // 1. Photo Upload (ID Photo) in Edit Modal
    if (e.target.id === 'cli-edit-photo-input' || e.target.id === 'inp-cli-id-photo-file') {
        const file = e.target.files[0];
        if (!file) return;

        const preview = document.getElementById('cli-id-photo-preview');
        const img = preview?.querySelector('img');
        
        try {
            showToast('Subiendo foto...', 'info');
            const url = await uploadFile(file, 'profiles');
            state.currentCliIdPhoto = url;
            
            if (img) img.src = url;
            if (preview) preview.classList.remove('hidden');
            showToast('Foto cargada.', 'success');
        } catch (err) {
            showToast('Error al subir foto', 'error');
        }
    }

    // 2. Profile Photo in Detail Modal
    if (e.target.id === 'det-cli-foto-file') {
        const file = e.target.files[0];
        if (!file) return;
        try {
            showToast('Actualizando perfil...', 'info');
            const url = await uploadFile(file, 'profiles');
            const avatar = document.getElementById('det-cli-avatar');
            if (avatar) {
                avatar.style.backgroundImage = `url(${url})`;
                avatar.innerHTML = '';
            }
            if (state.activeClientId) {
                const db = getDB();
                const cli = db.Clientes_Maestro.find(c => c.id === state.activeClientId);
                if (cli) {
                    cli.foto = url;
                    await saveDB(db);
                    showToast('Foto de perfil guardada', 'success');
                    renderView(); // Refresh table
                }
            }
        } catch(err) {
            console.error(err);
            showToast('Error al actualizar perfil', 'error');
        }
    }
});

// 2. Add Evidence in Detail View
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#btn-add-cli-evidence');
    if (btn) {
        const id = document.getElementById('det-cli-edit-id')?.value || UI.btnEditCliFromDetail?.dataset.id;
        if (!id) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;

            try {
                showToast('Subiendo archivo...', 'info');
                const url = await uploadFile(file, 'others');
                
                const db = getDB();
                const cli = db.Clientes_Maestro.find(c => c.id === id);
                if (cli) {
                    if (!cli.archivos_adjuntos) cli.archivos_adjuntos = [];
                    cli.archivos_adjuntos.push(url);
                    await saveDB(db);
                    showToast('Archivo guardado.', 'success');
                    await showClientDetail(id); // Refresh gallery
                }
            } catch (err) {
                showToast('Error al subir archivo', 'error');
            }
        };
        input.click();
    }
});

// 3. Detail Technical Documents & Office Uploads
document.addEventListener('change', async (e) => {
    const handlers = {
        'inp-det-adj-id': { stateKey: 'currentDetAdjID', label: 'Foto ID', dropId: 'drop-det-adj-id', lblId: 'lbl-det-adj-id' },
        'inp-det-adj-bill': { stateKey: 'currentDetAdjBill', label: 'Bill Eléctrico', dropId: 'drop-det-adj-bill', lblId: 'lbl-det-adj-bill' },
        'inp-det-adj-seguro': { stateKey: 'currentDetAdjSeguro', label: 'Póliza Seguro', dropId: 'drop-det-adj-seguro', lblId: 'lbl-det-adj-seguro' },
        'inp-det-ofi-app': { stateKey: 'currentDetOfiApp', label: 'Hoja Aplicación', dropId: 'drop-det-ofi-app', lblId: 'lbl-det-ofi-app' },
        'inp-det-ofi-recibo': { stateKey: 'currentDetOfiRecibo', label: 'Recibo de Pago', dropId: 'drop-det-ofi-recibo', lblId: 'lbl-det-ofi-recibo' },
        'inp-det-ofi-contrato': { stateKey: 'currentDetOfiContrato', label: 'Contrato Firmado', dropId: 'drop-det-ofi-contrato', lblId: 'lbl-det-ofi-contrato' }
    };

    const handler = handlers[e.target.id];
    if (handler) {
        const file = e.target.files[0];
        if (!file) return;

        const drop = document.getElementById(handler.dropId);
        const lbl = document.getElementById(handler.lblId);
        const originalContent = lbl ? lbl.textContent : handler.label;

        try {
            if (lbl) lbl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Subiendo...`;
            const url = await uploadFile(file, 'evidences');
            state[handler.stateKey] = url;
            
            if (drop) drop.classList.add('border-tealAccent', 'bg-tealAccent/5');
            if (lbl) {
                lbl.textContent = `ACTUALIZAR ${handler.label}`;
                lbl.classList.replace('text-gray-400', 'text-tealAccent');
            }
            showToast(`${handler.label} listo`, 'success');
            
            // --- AUTOSAVE LOGIC ---
            if (state.activeClientId) {
                const db = getDB();
                const cli = db.Clientes_Maestro.find(c => c.id === state.activeClientId);
                if (cli) {
                    if (handler.stateKey === 'currentDetAdjID') {
                        cli.adjunto_id_url = url;
                        cli.id_photo = url; // Sincronización crucial
                    }
                    else if (handler.stateKey === 'currentDetAdjBill') cli.adjunto_bill_url = url;
                    else if (handler.stateKey === 'currentDetAdjSeguro') cli.adjunto_seguro_url = url;
                    else if (handler.stateKey === 'currentDetOfiApp') {
                        if (!cli.adjuntos_oficina) cli.adjuntos_oficina = {};
                        cli.adjuntos_oficina.app_url = url;
                    }
                    else if (handler.stateKey === 'currentDetOfiRecibo') {
                        if (!cli.adjuntos_oficina) cli.adjuntos_oficina = {};
                        cli.adjuntos_oficina.recibo_url = url;
                    }
                    else if (handler.stateKey === 'currentDetOfiContrato') {
                        if (!cli.adjuntos_oficina) cli.adjuntos_oficina = {};
                        cli.adjuntos_oficina.contrato_url = url;
                    }
                    await saveDB(db);
                    console.log(`Autosaved ${handler.label} for client ${state.activeClientId}`);
                    
                    // Refrescar la vista para sincronizar tabs
                    await showClientDetail(state.activeClientId);
                }
            }
            
            // Mark save bar as visible if not already
            const saveBar = document.getElementById('det-cli-save-bar');
            if (saveBar) saveBar.classList.remove('hidden');
        } catch (err) {
            console.error('Upload error:', err);
            if (lbl) lbl.textContent = originalContent;
            showToast('Error al subir archivo', 'error');
        }
    }
});

// 4. Save Changes Button
document.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('#btn-save-cli-changes');
    if (saveBtn) {
        saveClientChanges();
    }
});

// ââ‚¬ââ‚¬ Global Search Listener ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
window.globalSearchQuery = '';

window.normalizeSearchString = (str) => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

function initGlobalSearch() {
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
        // Ensure we don't attach multiple listeners
        if (searchInput._hasListener) return;
        searchInput._hasListener = true;

        searchInput.addEventListener('input', (e) => {
            window.globalSearchQuery = window.normalizeSearchString(e.target.value);
            if (['crm', 'crm_maestro', 'usuarios', 'equipo', 'proveedores'].includes(state.activeView)) {
                 renderView();
            } else if (state.activeView === 'hrhub') {
                // Filter the HR Hub directorio table in-place without full re-render
                const q = window.globalSearchQuery;
                document.querySelectorAll('#hr-table-body tr').forEach(row => {
                    const text = window.normalizeSearchString(row.textContent);
                    row.style.display = (!q || text.includes(q)) ? '' : 'none';
                });
                document.querySelectorAll('#col-inscrito > *, #col-docs > *, #col-cap > *, #col-activo > *, #col-inactivo > *').forEach(card => {
                    const text = window.normalizeSearchString(card.textContent);
                    card.style.display = (!q || text.includes(q)) ? '' : 'none';
                });
            }
        });
        console.log('[SEARCH] Listener initialized');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalSearch);
} else {
    initGlobalSearch();
}

// ââ‚¬ââ‚¬ IFRAME FORM MESSAGE LISTENER ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
// Handles WORK_ORDER_SUBMITTED and CREDIT_APP_SUBMITTED messages
// from embedded iframes (credit app, work order forms).
// Updates the local cachedDB with the PDF URL and saves to Supabase.
window.addEventListener('message', async (e) => {
    const type = e.data?.type;
    if (type !== 'WORK_ORDER_SUBMITTED' && type !== 'CREDIT_APP_SUBMITTED') return;

    console.log(`[ADMIN] Received ${type} message. pdfUrl: ${e.data.pdfUrl}, proyectoId: ${e.data.proyectoId}`);
    
    const isWorkOrder = (type === 'WORK_ORDER_SUBMITTED');
    const { proyectoId, pdfUrl } = e.data;

    if (!pdfUrl) {
        console.warn('[ADMIN] No pdfUrl in message - skipping client profile update.');
        return;
    }

    try {
        const db = getDB();
        let proy = (db.Proyectos_Dinamicos || []).find(p => p.id === proyectoId);
        
        if (!proy && proyectoId) {
            const norm = String(proyectoId).toLowerCase().replace('renew-', '').replace(/-/g, '_');
            proy = (db.Proyectos_Dinamicos || []).find(p => p.id === norm || p.id === `proy_${norm}`);
        }

        if (!proy?.cliente_id) {
            console.warn(`[ADMIN] Could not resolve project "${proyectoId}" to a client - PDF URL not saved locally.`);
            return;
        }

        const clientId = proy.cliente_id;
        const cli = (db.Clientes_Maestro || []).find(c => c.id === clientId);
        if (!cli) {
            console.warn(`[ADMIN] Client "${clientId}" not found in local DB.`);
            return;
        }

        if (!cli.adjuntos_oficina || Array.isArray(cli.adjuntos_oficina)) {
            cli.adjuntos_oficina = {};
        }

        if (isWorkOrder) {
            cli.adjuntos_oficina.orden_trabajo_url = pdfUrl;
            cli.adjuntos_oficina.ultima_orden_fecha = new Date().toISOString();
        } else {
            cli.adjuntos_oficina.app_url = pdfUrl;
            cli.adjuntos_oficina.ultima_credit_fecha = new Date().toISOString();
        }

        await updateClientMaestro(clientId, { adjuntos_oficina: cli.adjuntos_oficina });
        console.log(`[ADMIN] Client "${clientId}" updated with ${isWorkOrder ? 'Work Order' : 'Credit App'} PDF URL.`);

        if (state.activeClientId === clientId) {
            await showClientDetail(clientId);
        }

        showToast(`Documento vinculado al perfil del cliente correctamente.`, 'success');
    } catch (err) {
        console.error('[ADMIN] Error saving PDF URL to client profile:', err);
    }
});

// -- RECIBOS DE PAGO: Popup en perfil del trabajador ----------
window._verRecibosWorker = async function(workerId, workerName, workerRol) {
    const existingModal = document.getElementById('modal-admin-recibos-worker');
    if (existingModal) existingModal.remove();

    const { getRecibos } = await import('./api.js');
    const recibos = getRecibos(workerId);

    // Determine which tabs to show based on the WORKER'S role
    const rol = (workerRol || '').toLowerCase();
    const isVendedorRol = rol.includes('vendedor') || rol.includes('sales') || rol.includes('representante');
    const isTecnicoRol  = rol.includes('tecnico') || rol.includes('técnico') || rol.includes('instalador') || rol.includes('installer');
    const isAdminRol    = ['admin', 'administrador', 'ceo', 'desarrollador'].includes(rol);

    // showBoth: admin roles or if worker has both types of receipts
    const hasBothReceipts = recibos.some(r => r.tipo === 'vendedor') && recibos.some(r => r.tipo === 'tecnico');
    const showBoth = isAdminRol || (!isVendedorRol && !isTecnicoRol) || hasBothReceipts;

    // Default filter: show based on role
    let defaultFilter = 'all';
    if (!showBoth) {
      defaultFilter = isTecnicoRol ? 'tecnico' : 'vendedor';
    }

    const renderList = (filter) => {
        const filtered = filter === 'all' ? recibos : recibos.filter(r => r.tipo === filter);
        if (!filtered.length) return '<p style="text-align:center;color:#94a3b8;padding:40px 20px;font-size:0.85rem;">Sin recibos de este tipo.</p>';
        return filtered.map(r => {
            const isVendedor = r.tipo === 'vendedor';
            const color = isVendedor ? '#3b82f6' : '#10b981';
            const label = isVendedor ? 'Recibo de Pago (Vendedor)' : 'Recibo de Instalacion (Tecnico)';
            const d = r.datos_json || {};
            const monto = isVendedor
                ? (d.grand_total ? '$' + Number(d.grand_total).toLocaleString('en-US',{minimumFractionDigits:2}) : '-')
                : (d.total_price  ? '$' + Number(d.total_price ).toLocaleString('en-US',{minimumFractionDigits:2}) : '-');
            return '<div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;">' +
                '<div style="width:40px;height:40px;background:' + color + '15;border:1px solid ' + color + '30;border-radius:10px;display:flex;align-items:center;justify-content:center;color:' + color + ';flex-shrink:0;">' +
                (isVendedor ? '<i class="fas fa-dollar-sign"></i>' : '<i class="fas fa-tools"></i>') + '</div>' +
                '<div style="flex:1;min-width:0;">' +
                '<p style="font-size:0.65rem;font-weight:900;color:' + color + ';text-transform:uppercase;letter-spacing:1px;margin:0;">' + label + '</p>' +
                '<p style="font-size:0.9rem;font-weight:700;color:#1e293b;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (r.cliente_nombre || '-') + '</p>' +
                '<p style="font-size:0.7rem;color:#94a3b8;margin:0;">' + (r.fecha_recibo || '-') + '</p>' +
                '</div>' +
                '<div style="text-align:right;flex-shrink:0;">' +
                '<p style="font-size:1rem;font-weight:900;color:' + color + ';margin:0;">' + monto + '</p>' +
                (r.pdf_url ? '<a href="' + r.pdf_url + '" target="_blank" style="font-size:0.65rem;font-weight:800;color:' + color + ';background:' + color + '15;padding:3px 8px;border-radius:6px;text-decoration:none;">Ver PDF</a>' : '') +
                '</div></div>';
        }).join('');
    };

    // Build tabs HTML based on role
    const tabsHtml = showBoth ? `
        <div style="padding:16px 24px 0;display:flex;gap:8px;">
            <button data-rf="all"      class="rw-filter-btn" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid #8b5cf6;background:#8b5cf615;color:#8b5cf6;font-size:0.75rem;font-weight:800;cursor:pointer;">Todos</button>
            <button data-rf="vendedor" class="rw-filter-btn" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid #e2e8f0;background:white;color:#94a3b8;font-size:0.75rem;font-weight:800;cursor:pointer;">Vendedor</button>
            <button data-rf="tecnico"  class="rw-filter-btn" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid #e2e8f0;background:white;color:#94a3b8;font-size:0.75rem;font-weight:800;cursor:pointer;">Técnico</button>
        </div>` : '';

    const modal = document.createElement('div');
    modal.id = 'modal-admin-recibos-worker';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
        <div style="background:white;border-radius:24px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 24px 48px rgba(0,0,0,0.25); border:1px solid #e2e8f0;">
            <div style="padding:24px 24px 0;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h3 style="font-size:1.1rem;font-weight:900;color:#0f172a;margin:0;">Recibos de Pago</h3>
                    <p style="font-size:0.8rem;color:#64748b;margin:2px 0 0;">${workerName} &bull; ${recibos.length} recibos</p>
                </div>
                <button id="btn-close-admin-recibos" style="background:#f1f5f9;border:none;border-radius:12px;width:36px;height:36px;cursor:pointer;font-size:1.2rem;color:#64748b;display:flex;align-items:center;justify-content:center;">&times;</button>
            </div>
            ${tabsHtml}
            <div id="rw-list-container" style="padding:16px 24px 32px;">
                ${renderList(defaultFilter)}
            </div>
        </div>
    `;

    // Append last to guarantee top DOM order above any existing modal
    document.body.appendChild(modal);
    // Re-move to end to beat any stacking contexts created by other modals
    document.body.removeChild(modal);
    document.body.appendChild(modal);
    modal.querySelector('#btn-close-admin-recibos').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('.rw-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const f = btn.dataset.rf;
            modal.querySelector('#rw-list-container').innerHTML = renderList(f);
            modal.querySelectorAll('.rw-filter-btn').forEach(b => {
                const active = b.dataset.rf === f;
                b.style.borderColor = active ? '#8b5cf6' : '#e2e8f0';
                b.style.background  = active ? '#8b5cf615' : 'white';
                b.style.color       = active ? '#8b5cf6' : '#94a3b8';
            });
        });
    });
};

// -- ADELANTOS: Popup en perfil del trabajador ----------
window._verAdelantosWorker = async function(workerId, workerName) {
    const existingModal = document.getElementById('modal-admin-adelantos-worker');
    if (existingModal) existingModal.remove();

    const db = window.getDB ? window.getDB() : (await import('./api.js')).getDB();
    const adelantos = (db.rrhh_adelantos || []).filter(a => String(a.trabajador_id) === String(workerId));

    const renderList = () => {
        if (!adelantos.length) return '<p style="text-align:center;color:#94a3b8;padding:40px 20px;font-size:0.85rem;">No se han registrado préstamos ni adelantos.</p>';
        return adelantos.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(r => {
            const color = '#14b8a6';
            const monto = '$' + Number(r.monto || 0).toLocaleString('en-US',{minimumFractionDigits:2});
            let estadoHtml = '';
            if(r.estado) {
                if(r.estado === 'Aprobado' || r.estado === 'aprobado') estadoHtml = `<span style="font-size:0.6rem;font-weight:900;color:#10b981;background:#10b98115;padding:2px 6px;border-radius:4px;margin-left:6px;text-transform:uppercase;">${r.estado}</span>`;
                else if(r.estado === 'Rechazado' || r.estado === 'rechazado') estadoHtml = `<span style="font-size:0.6rem;font-weight:900;color:#ef4444;background:#ef444415;padding:2px 6px;border-radius:4px;margin-left:6px;text-transform:uppercase;">${r.estado}</span>`;
                else estadoHtml = `<span style="font-size:0.6rem;font-weight:900;color:#f59e0b;background:#f59e0b15;padding:2px 6px;border-radius:4px;margin-left:6px;text-transform:uppercase;">${r.estado}</span>`;
            }

            return '<div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;">' +
                '<div style="width:40px;height:40px;background:' + color + '15;border:1px solid ' + color + '30;border-radius:10px;display:flex;align-items:center;justify-content:center;color:' + color + ';flex-shrink:0;">' +
                '<i class="fa-solid fa-hand-holding-dollar"></i></div>' +
                '<div style="flex:1;min-width:0;">' +
                '<p style="font-size:0.65rem;font-weight:900;color:' + color + ';text-transform:uppercase;letter-spacing:1px;margin:0;">Adelanto/Préstamo ' + estadoHtml + '</p>' +
                '<p style="font-size:0.9rem;font-weight:700;color:#1e293b;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (r.motivo || '-') + '</p>' +
                '<p style="font-size:0.7rem;color:#94a3b8;margin:0;">' + (r.fecha || (r.created_at ? r.created_at.split('T')[0] : '-')) + '</p>' +
                '</div>' +
                '<div style="text-align:right;flex-shrink:0;">' +
                '<p style="font-size:1rem;font-weight:900;color:' + color + ';margin:0;">' + monto + '</p>' +
                (r.doc_url ? '<a href="' + r.doc_url + '" target="_blank" style="font-size:0.65rem;font-weight:800;color:' + color + ';background:' + color + '15;padding:3px 8px;border-radius:6px;text-decoration:none;">Ver Doc</a>' : '') +
                '</div></div>';
        }).join('');
    };

    const modal = document.createElement('div');
    modal.id = 'modal-admin-adelantos-worker';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
        <div style="background:white;border-radius:24px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 24px 48px rgba(0,0,0,0.25); border:1px solid #e2e8f0;">
            <div style="padding:24px 24px 0;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h3 style="font-size:1.1rem;font-weight:900;color:#0f172a;margin:0;">Préstamos y Adelantos</h3>
                    <p style="font-size:0.8rem;color:#64748b;margin:2px 0 0;">${workerName} &bull; ${adelantos.length} registros</p>
                </div>
                <button id="btn-close-admin-adelantos" style="background:#f1f5f9;border:none;border-radius:12px;width:36px;height:36px;cursor:pointer;font-size:1.2rem;color:#64748b;display:flex;align-items:center;justify-content:center;">&times;</button>
            </div>
            <div id="aw-list-container" style="padding:16px 24px 32px;">
                ${renderList()}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.removeChild(modal);
    document.body.appendChild(modal);
    modal.querySelector('#btn-close-admin-adelantos').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

// ââ‚¬ââ‚¬ââ‚¬ LISTA DE PRECIOS RENEW WATER ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬ââ‚¬
async function renderListaPreciosAdmin() {
  const db = getDB();
  const allProducts = db.Water_Productos || [];
  
  const currentUsr = JSON.parse(localStorage.getItem('rs_user') || '{}');
  const rolName = (currentUsr.rol || '').toLowerCase();
  const isAdminPriceList = ['admin', 'administrador', 'ceo'].includes(rolName);

  
  // Rank Tab Logic (Instead of Sede)
  const activeRank = state.activePreciosRank || 'vendedor';
  const rankLabels = {
    'iniciante': 'Iniciante',
    'junior': 'Junior',
    'subvende': 'Novato',
    'vendedor': 'Vendedor',
    'analista': 'Analista',
    'oficina': 'Oficina/Admin'
  };

  const catalogos = await getCatalogos();
  const pdfMap = {};
  catalogos.forEach(c => { pdfMap[c.id] = c.pdf_url; });

  const activePdf = pdfMap[activeRank] || '#';

  const rowsHtml = allProducts.map(p => {
    const fotoHtml = p.foto_url
      ? `<img src="${p.foto_url}" class="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-white/5 group-hover/img:border-tealAccent transition-all">`
      : `<div class="w-10 h-10 rounded-lg bg-tealAccent/10 flex items-center justify-center border border-tealAccent/20"><i class="fa-solid fa-image text-tealAccent text-sm"></i></div>`;
    return `
    <tr class="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="relative w-10 h-10 group/img ${isAdminPriceList ? 'cursor-pointer' : ''}" ${isAdminPriceList ? `onclick="window.adminUploadPrecioFoto('${p.id}')"` : ''}>
            ${fotoHtml}
            ${isAdminPriceList ? `
            <div class="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-all">
                <i class="fas fa-camera text-white text-[10px]"></i>
            </div>` : ''}
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 rounded-lg bg-tealAccent/10 text-tealAccent text-[9px] font-black uppercase tracking-wider">
            ${p.categoria || 'GENERAL'}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-xs font-bold text-gray-900 dark:text-white uppercase">${p.nombre}</div>
        <div class="text-[9px] text-gray-400 font-bold tracking-widest">${p.codigo || 'S/C'}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-gray-400 font-bold">M: ${p.medida || '-'}</span>
            <span class="text-[9px] text-gray-400 font-bold">B: ${p.boton || '-'}</span>
            <span class="text-[9px] text-gray-400 font-bold">C: ${p.color || '-'}</span>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-[10px] font-bold text-tealAccent">
        $${(p['precio_' + activeRank] || 0).toLocaleString()}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-[10px] font-bold text-orange-500">
        $${(p.solo_equipo_grande || 0).toLocaleString()}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold text-gray-400">$${(p.precio_minimo || 0).toLocaleString()}</span>
            <div class="w-4 h-[1px] bg-gray-200 dark:bg-white/10"></div>
            <span class="text-[10px] font-bold text-gray-400">$${(p.precio_maximo || 0).toLocaleString()}</span>
        </div>
      </td>
      ${isAdminPriceList ? `
      <td class="px-6 py-4 whitespace-nowrap text-right">
        <div class="flex items-center justify-end gap-2">
          <button onclick="window.editListaPrecio('${p.id}')" class="w-8 h-8 rounded-lg bg-tealAccent/5 text-tealAccent hover:bg-tealAccent hover:text-black transition-all flex items-center justify-center">
            <i class="fa-solid fa-pen-to-square text-[10px]"></i>
          </button>
          <button onclick="window.deleteListaPrecioItem('${p.id}')" class="w-8 h-8 rounded-lg bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
            <i class="fa-solid fa-trash text-[10px]"></i>
          </button>
        </div>
      </td>` : ''}
    </tr>
  `;}).join('');

  UI.canvas.innerHTML = `
    <div class="max-w-7xl mx-auto animate-fadeIn">
      <div class="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
          <div class="flex flex-col gap-3">
              <h2 class="text-xl font-black text-white uppercase tracking-tighter">Gestión de Precios</h2>
              <div class="flex flex-wrap gap-2 bg-gray-100 dark:bg-white/5 p-1 rounded-2xl w-fit">
                 ${Object.entries(rankLabels).map(([key, label]) => `
                    <button class="precios-rank-tab px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeRank === key ? 'bg-white dark:bg-white/10 text-tealAccent shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-white'}" data-rank="${key}">
                        ${label}
                    </button>
                 `).join('')}
              </div>
          </div>
          
          <div class="flex items-center gap-3">
              <div class="flex items-center">
                  <button onclick="window.open('${activePdf}', '_blank')" class="flex items-center gap-2 px-6 py-3 bg-red-500/10 border border-red-500/20 rounded-l-xl text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                    <i class="fa-solid fa-file-pdf"></i> Lista ${rankLabels[activeRank].toUpperCase()} (PDF)
                  </button>
                  <button onclick="window.adminUploadCatalogo('${activeRank}')" class="flex items-center justify-center w-12 py-3 bg-red-600 text-white rounded-r-xl text-[10px] hover:bg-red-700 transition-all border border-red-600" title="Actualizar PDF">
                    <i class="fa-solid fa-upload"></i>
                  </button>
              </div>
              <button onclick="_showEditProducto({})" class="flex items-center gap-2 px-6 py-3 bg-tealAccent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                <i class="fa-solid fa-plus"></i> Nuevo Producto
              </button>
          </div>
      </div>
      <input type="file" id="inp-catalog-pdf" class="hidden" accept="application/pdf">

      <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden overflow-x-auto hide-scrollbar">
          <table class="w-full text-xs">
              <thead class="bg-gray-50/50 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
                  <tr>
                      <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">FOTO</th>
                      <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">CATEGORÍA</th>
                      <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">PRODUCTO</th>
                      <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">SPECS</th>
                      <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">PRECIO ${rankLabels[activeRank].toUpperCase()}</th>
                      <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">SOLO TANQUE</th>
                      <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">RANGO SUG.</th>
                      <th class="px-6 py-5 text-right text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">ACCIONES</th>
                  </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                  ${rowsHtml.length ? rowsHtml : `<tr><td colspan="10" class="py-24 text-center"><i class="fa-solid fa-tag text-5xl text-gray-200 dark:text-white/5 mb-4 block"></i><span class="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">No hay productos registrados</span></td></tr>`}
              </tbody>
          </table>
      </div>
    </div>
  `;

  // Attach listeners to rank tabs
  document.querySelectorAll('.precios-rank-tab').forEach(btn => {
    btn.onclick = () => window.setPreciosRank(btn.dataset.rank);
  });
}

window.setPreciosRank = function(rk) {
    state.activePreciosRank = rk;
    renderListaPreciosAdmin();
};

window.editListaPrecio = function(id) {
    console.log("[DEBUG] editListaPrecio called for ID:", id);
    const db = getDB();
    // Try both casing just in case
    const list = db.Water_Productos || db.water_productos || [];
    const p = list.find(item => item.id === id);
    
    if (!p) {
        console.warn("[DEBUG] Product not found for ID:", id);
        return;
    }

    console.log("[DEBUG] Found product:", p);

    const mod = document.getElementById('modal-nuclear-precios');
    const btnSave = document.getElementById('btn-save-precio');
    if (btnSave) btnSave.dataset.editId = id;

    // Helper to safely set value
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('inp-prec-id', id);
    setVal('inp-prec-nombre', p.nombre);
    setVal('inp-prec-codigo', p.codigo);
    setVal('inp-prec-cat', p.categoria);
    setVal('sel-prec-sede', p.sede || 'todas');
    setVal('inp-prec-iniciante', p.precio_iniciante);
    setVal('inp-prec-junior', p.precio_junior);
    setVal('inp-prec-subvende', p.precio_subvende);
    setVal('inp-prec-vendedor', p.precio_vendedor);
    setVal('inp-prec-analista', p.precio_analista);
    setVal('inp-prec-oficina', p.precio_oficina);
    setVal('inp-prec-full', p.precio_full);
    setVal('inp-prec-grande', p.solo_equipo_grande);
    setVal('inp-prec-min', p.precio_minimo);
    setVal('inp-prec-max', p.precio_maximo);
    setVal('inp-prec-medida', p.medida);
    setVal('inp-prec-boton', p.boton);
    setVal('inp-prec-color', p.color);
    setVal('inp-prec-unidad', p.unidad);
    setVal('inp-prec-garantia', p.garantia);
    setVal('inp-prec-foto', p.foto_url);
    setVal('inp-prec-pdf', p.pdf_url);
    setVal('inp-prec-desc', p.descripcion);
    
    if (mod) {
        window.showModal(mod);
    } else {
        console.error("[DEBUG] Modal 'modal-nuclear-precios' not found in DOM");
    }
};

window.adminUploadPrecioFoto = async function(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        let file = e.target.files[0];
        if (!file) return;

        showToast('Subiendo imagen...', 'info');
        try {
            // Compress image to avoid 413 Request Entity Too Large
            if (file.type.startsWith('image/')) {
                file = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = (event) => {
                        const img = new Image();
                        img.src = event.target.result;
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            const maxDim = 1000;
                            
                            if (width > height && width > maxDim) {
                                height *= maxDim / width;
                                width = maxDim;
                            } else if (height > maxDim) {
                                width *= maxDim / height;
                                height = maxDim;
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            canvas.toBlob((blob) => {
                                resolve(blob ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file);
                            }, 'image/jpeg', 0.8);
                        };
                        img.onerror = () => resolve(file);
                    };
                    reader.onerror = () => resolve(file);
                });
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'productos');
            formData.append('bucket', 'archivos_renew');
            formData.append('path', `productos/${id}_${Date.now()}.jpg`);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (!res.ok) {
                console.error("[UPLOAD-ERROR]", data);
                showToast(`Error: ${data.error || 'Fallo en servidor'}`, 'error');
                return;
            }

            if (data.url) {
                // Update product in DB
                const db = getDB();
                const p = (db.Water_Productos || []).find(item => item.id === id);
                if (p) {
                    p.foto_url = data.url;
                    const { saveListaPrecio } = await import('./api.js');
                    await saveListaPrecio(p);
                    showToast('Imagen actualizada', 'success');
                    renderListaPreciosAdmin();
                }
            }
        } catch (err) {
            console.error(err);
            showToast('Error al subir imagen', 'error');
        }
    };
    input.click();
};

window.adminUploadCatalogo = async function(rank) {
    const input = document.getElementById('inp-catalog-pdf');
    if (!input) return;
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showToast(`Subiendo Lista ${rank.toUpperCase()}...`, 'info');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'catalogos');
            formData.append('bucket', 'archivos_renew');

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Fallo en servidor');

            if (data.url) {
                await saveCatalogo(rank, data.url);
                showToast('Catálogo actualizado en la nube', 'success');
                renderListaPreciosAdmin();
            }
        } catch (err) {
            console.error(err);
            showToast('Error al subir catálogo: ' + err.message, 'error');
        }
    };
    input.click();
};
window.savePrecio = async function() {
    const id = document.getElementById('inp-prec-id').value;
    const producto = {
        id: id || null,
        nombre: document.getElementById('inp-prec-nombre').value,
        codigo: document.getElementById('inp-prec-codigo').value,
        categoria: document.getElementById('inp-prec-cat').value,
        sede: document.getElementById('sel-prec-sede').value,
        medida: document.getElementById('inp-prec-medida').value,
        boton: document.getElementById('inp-prec-boton').value,
        color: document.getElementById('inp-prec-color').value,
        precio_iniciante: parseFloat(document.getElementById('inp-prec-iniciante').value) || 0,
        precio_junior: parseFloat(document.getElementById('inp-prec-junior').value) || 0,
        precio_subvende: parseFloat(document.getElementById('inp-prec-subvende').value) || 0,
        precio_vendedor: parseFloat(document.getElementById('inp-prec-vendedor').value) || 0,
        precio_analista: parseFloat(document.getElementById('inp-prec-analista').value) || 0,
        precio_oficina: parseFloat(document.getElementById('inp-prec-oficina').value) || 0,
        precio_full: parseFloat(document.getElementById('inp-prec-full').value) || 0,
        solo_equipo_grande: parseFloat(document.getElementById('inp-prec-grande').value) || 0,
        precio_minimo: parseFloat(document.getElementById('inp-prec-min').value) || 0,
        precio_maximo: parseFloat(document.getElementById('inp-prec-max').value) || 0,
        unidad: document.getElementById('inp-prec-unidad').value,
        garantia: document.getElementById('inp-prec-garantia').value,
        foto_url: document.getElementById('inp-prec-foto').value,
        pdf_url: document.getElementById('inp-prec-pdf').value,
        descripcion: document.getElementById('inp-prec-desc').value,
        es_activo: true
    };

    if (!producto.nombre) {
        showToast('El nombre es obligatorio', 'error');
        return;
    }

    showToast('Guardando producto...', 'info');
    try {
        const { saveListaPrecio } = await import('./api.js');
        const success = await saveListaPrecio(producto);
        if (success) {
            showToast('Producto guardado correctamente', 'success');
            closeNuclearModal('modal-nuclear-precios');
            renderListaPreciosAdmin();
        } else {
            throw new Error('Save failed');
        }
    } catch (err) {
        console.error(err);
        showToast('Error al guardar el producto', 'error');
    }
};

window.deleteListaPrecioItem = async function(id) {
    if (!confirm('¿Seguro que deseas eliminar este producto de la lista de precios?')) return;
    try {
        const { deleteListaPrecio } = await import('./api.js');
        const success = await deleteListaPrecio(id);
        if (success) {
            showToast('Producto eliminado correctamente');
            renderListaPreciosAdmin();
        } else {
            throw new Error('Delete failed');
        }
    } catch(err) {
        console.error(err);
        showToast('Error al eliminar producto', 'error');
    }
};

// Event listener for Save Precio
document.addEventListener('click', async e => {
    if (e.target && (e.target.id === 'btn-save-precio' || e.target.closest('#btn-save-precio'))) {
        window.savePrecio();
    }
});


// -- Rango de Trabajadores (Visibilidad Dinámica) -------------------------
window.updateWorkerRankVisibility = function() {
    const rol = document.getElementById('inp-usr-rol');
    const rankContainer = document.getElementById('container-usr-rank');
    if (!rankContainer || !rol) return;
    
    const waterChecked = Array.from(document.querySelectorAll('.usr-pip-chk:checked')).some(chk => {
        const pipName = chk.dataset.pip || '';
        return pipName.toLowerCase().includes('water') || pipName.toLowerCase().includes('agua');
    });

    if (rol.value === 'Vendedor' && waterChecked) {
        rankContainer.classList.remove('hidden');
    } else {
        rankContainer.classList.add('hidden');
        const rankSelect = document.getElementById('inp-usr-rank');
        if (rankSelect) rankSelect.value = 'novato'; 
    }
};

document.addEventListener('change', (e) => {
    if (e.target.id === 'inp-usr-rol' || (e.target.classList && e.target.classList.contains('usr-pip-chk'))) {
        if (typeof window.updateWorkerRankVisibility === 'function') {
            window.updateWorkerRankVisibility();
        }
    }
});



window.updateEditWorkerRankVisibility = function() {
    const rol = document.getElementById('det-edit-rol');
    const rankContainer = document.getElementById('det-edit-rank-container');
    const equipoCont = document.getElementById('det-edit-equipo-container');
    const pipesCont = document.getElementById('det-edit-pipelines-container');
    
    if (rol && pipesCont) pipesCont.classList.toggle('hidden', rol.value !== 'Project Manager');
    if (rol && equipoCont) {
        equipoCont.classList.toggle('hidden', rol.value !== 'Supervisor');
        if (rol.value === 'Supervisor') {
            // Render equipo checkboxes if not rendered yet, but they are already rendered in showWorkerDetails.
            // If they change role to Supervisor from something else, we should ideally render them if empty.
            const equipoChks = document.getElementById('equipo-checkboxes');
            if (equipoChks && equipoChks.children.length === 0) {
                const vendedores = workers.filter(w => w.rol === 'Vendedor' || w.rol === 'Representante de Ventas');
                vendedores.forEach(vend => {
                    const lbl = document.createElement('label');
                    lbl.className = 'flex items-center gap-2 cursor-pointer';
                    const chk = document.createElement('input');
                    chk.type = 'checkbox';
                    chk.className = 'w-4 h-4 text-blue-500 rounded focus:ring-blue-500 rep-equipo-chk';
                    chk.value = vend.id;
                    const span = document.createElement('span');
                    span.className = 'text-sm text-gray-700';
                    span.textContent = `${vend.nombre || ''} ${vend.apellido || ''}`.trim();
                    lbl.appendChild(chk);
                    lbl.appendChild(span);
                    equipoChks.appendChild(lbl);
                });
            }
        }
    }

    if (!rankContainer || !rol) return;
    
    const waterChecked = Array.from(document.querySelectorAll('.pip-perm-chk:checked')).some(chk => {
        const pipName = chk.dataset.pip || chk.value || '';
        return pipName.toLowerCase().includes('water') || pipName.toLowerCase().includes('agua');
    });

    const isVendedor = rol.value === 'Vendedor' || rol.value === 'Representante de Ventas';
    if (isVendedor && waterChecked) {
        rankContainer.style.display = 'block';
    } else {
        rankContainer.style.display = 'none';
        const rankSelect = document.getElementById('det-edit-rank');
        if (rankSelect) rankSelect.value = 'novato'; 
    }
};

document.addEventListener('change', (e) => {
    if (e.target.id === 'det-edit-rol' || (e.target.classList && e.target.classList.contains('pip-perm-chk'))) {
        if (typeof window.updateEditWorkerRankVisibility === 'function') {
            window.updateEditWorkerRankVisibility();
        }
    }
});
// ==========================================
// LOGICA DE INVITACION DE TRABAJADORES
// ==========================================
window.openInviteModal = function() {
    const modal = document.getElementById('modal-nuclear-invite');
    if (!modal) return;
    
    const select = document.getElementById('inp-invite-worker');
    const previewBox = document.getElementById('invite-preview-box');
    const previewText = document.getElementById('invite-preview-text');
    const btnWa = document.getElementById('btn-send-invite-wa');
    const btnEmail = document.getElementById('btn-send-invite-email');
    
    select.innerHTML = '<option value="">Selecciona un trabajador...</option>';
    previewBox.classList.add('hidden');
    btnWa.classList.add('hidden');
    btnEmail.classList.add('hidden');
    
    // Poblar trabajadores
    const db = getDB();
    const users = db.Usuarios || [];
    users.sort((a,b) => (a.nombre || '').localeCompare(b.nombre || '')).forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.nombre} ${u.apellido || ''} - ${u.rol}`;
        select.appendChild(opt);
    });
    
    modal.classList.remove('nuclear-hidden');
    
    select.onchange = () => {
        const userId = select.value;
        const user = users.find(u => u.id === userId);
        if (!user) {
            previewBox.classList.add('hidden');
            btnWa.classList.add('hidden');
            btnEmail.classList.add('hidden');
            return;
        }
        
        const platformLinkApp = "https://renewgroup.site";
        const platformLinkAdmin = "https://renewgroup.site";
        const isWorkerApp = user.rol === 'Vendedor' || user.rol === 'Representante de Ventas' || user.rol === 'Técnico';
        const mainLink = isWorkerApp ? platformLinkApp : platformLinkAdmin;
        
        const msg = `¡Hola ${user.nombre}! 

Te damos la bienvenida al equipo Renew. A continuación, te compartimos tus credenciales de acceso a nuestra plataforma.

<i class="fa-solid fa-link"></i> Enlace de acceso: ${mainLink}
âœ‰ï¸ Usuario: ${user.email}
<i class="fa-solid fa-key"></i> Contraseña: ${user.password || user.pass || 'renew123'}

Si tienes alguna duda, no dudes en contactar al administrador.
¡Éxitos!`;
        
        previewText.textContent = msg;
        previewBox.classList.remove('hidden');
        
        if (user.tel) {
            btnWa.classList.remove('hidden');
            btnWa.onclick = () => {
                const phone = user.tel.replace(/\D/g, '');
                window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
            };
        } else {
            btnWa.classList.add('hidden');
        }
        
        if (user.email) {
            btnEmail.classList.remove('hidden');
            btnEmail.onclick = () => {
                window.open(`mailto:${user.email}?subject=${encodeURIComponent('Tus Credenciales de Renew')}&body=${encodeURIComponent(msg)}`, '_blank');
            };
        } else {
            btnEmail.classList.add('hidden');
        }
    };
};

document.addEventListener('DOMContentLoaded', () => {
    const cancelBtns = document.querySelectorAll('.btn-cancel-invite');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('modal-nuclear-invite');
            if (modal) modal.classList.add('nuclear-hidden');
        });
    });
});



window.handleDrawerFileUpload = async function(projectId, campoId, inputEl) {
    if (!inputEl.files || inputEl.files.length === 0) return;
    const label = inputEl.nextElementSibling;
    const originalText = label.innerText;
    
    try {
        label.innerText = 'Subiendo...';
        label.style.opacity = '0.7';
        
        let fileUrls = [];
        for (let i = 0; i < inputEl.files.length; i++) {
            const file = inputEl.files[i];
            let fileUrl = '';
            if (typeof uploadFile === 'function') {
                fileUrl = await uploadFile(file, 'documents');
            } else {
                fileUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }
            if (fileUrl) fileUrls.push(fileUrl);
        }
        
        if (fileUrls.length === 0) throw new Error("No URL generated");
        
        // Fetch existing val to append
        const db = typeof getDB === 'function' ? getDB() : window.state.db || {};
        const resp = (db.Respuestas_Dinamicas || []).find(r => r.proyecto_id === projectId && String(r.campo_id) === String(campoId));
        let existingVals = resp && resp.valor ? resp.valor.split(',').map(s=>s.trim()).filter(s=>s) : [];
        const finalUrlStr = [...existingVals, ...fileUrls].join(',');

        await window.saveDynamicFields(projectId, { [campoId]: finalUrlStr });
        showToast('Archivo(s) subido(s) con éxito', 'success');
        
        if (window.openKanbanDrawer && window._currentDrawerPhaseId !== undefined) {
             window.openKanbanDrawer(projectId, window._currentDrawerPhaseId);
        }
    } catch(e) {
        console.error("Upload error detallado:", e);
        alert('Error al subir: ' + e.message);
        showToast('Error al subir archivo', 'error');
        label.innerText = originalText;
        label.style.opacity = '1';
    }
};

window.saveDynamicFields = async function(dealId, respuestas) {
    const db = getDB();
    if (!db.Respuestas_Dinamicas) db.Respuestas_Dinamicas = [];
    
    const recordsToSave = [];
    const validCampoIds = new Set((db.Admin_Campos_Formulario || []).map(c => String(c.id)));
    
    Object.keys(respuestas).forEach(campoId => {
        const val = respuestas[campoId];
        if (val === undefined || val === null) return;
        
        if (!validCampoIds.has(String(campoId))) return; // Skip orphaned
        
        const exist = db.Respuestas_Dinamicas.find(r => r.proyecto_id === dealId && String(r.campo_id) === String(campoId));
        if (exist) {
            exist.valor = val;
            recordsToSave.push(exist);
        } else {
            const newRec = {
                id: genId('resp', db),
                proyecto_id: dealId,
                campo_id: campoId,
                valor: val
            };
            db.Respuestas_Dinamicas.push(newRec);
            recordsToSave.push(newRec);
        }
    });
    
    if (recordsToSave.length > 0) {
        await saveGranular('respuestas_dinamicas', recordsToSave);
    }
};

window.openKanbanDrawer = openKanbanDrawer;

window.populateRolesDropdowns = function() {
    const db = getDB();
    const roles = db.Admin_Roles || [];
    if (!roles.length) return;

    const optionsHtml = roles.map(r => `<option value="${r.nombre}">${r.nombre}</option>`).join('');
    
    const inpRol = document.getElementById('inp-usr-rol');
    if (inpRol) {
        const val = inpRol.value;
        inpRol.innerHTML = optionsHtml;
        if(val) inpRol.value = val;
    }
    
    const detRol = document.getElementById('det-edit-rol');
    if (detRol) {
        const val = detRol.value;
        detRol.innerHTML = optionsHtml;
        if(val) detRol.value = val;
    }
};

// ─── ROLES BUILDER (CONSTRUCTOR DE ROLES) ────────────────────────
window.renderRolesBuilder = function() {
    const db = getDB();
    const roles = db.Admin_Roles || [];

    const modules = [
        { id: 'dashboard', label: 'Dashboard / Rendimiento' },
        { id: 'mapa', label: 'Mapa de Clientes' },
        { id: 'crm', label: 'CRM (Clientes)' },
        { id: 'call_center', label: 'Call Center' },
        { id: 'hrhub', label: 'RRHH (Adelantos/Staff)' },
        { id: 'inventario', label: 'Inventario' },
        { id: 'lista_precios', label: 'Lista de Precios' },
        { id: 'kanban', label: 'Kanban Pulse' },
        { id: 'academia', label: 'Gestor Academia' },
        { id: 'anuncios', label: 'Anuncios Globales' },
        { id: 'admin_config', label: 'Constructor / Config. Admin' }
    ];

    const cardsHtml = roles.map(r => {
        const perms = r.permisos || {};
        const activeCount = Object.values(perms).filter(Boolean).length;
        
        return `
        <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative group">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="font-black text-lg text-gray-900 dark:text-white">${r.nombre}</h3>
                    <p class="text-xs text-gray-500 mt-1">${activeCount} módulos permitidos</p>
                </div>
                ${r.is_base ? '<span class="px-2 py-1 bg-tealAccent/10 text-tealAccent text-[9px] font-black uppercase rounded-lg">Base Role</span>' : ''}
            </div>
            
            <div class="flex flex-wrap gap-1 mb-6">
                ${Object.entries(perms).map(([key, val]) => val ? `<span class="px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded text-[9px]">${key}</span>` : '').join('')}
            </div>
            
            <div class="flex gap-2">
                <button onclick="window.editAdminRole('${r.id}')" class="flex-1 py-2 bg-tealAccent/10 text-tealAccent hover:bg-tealAccent hover:text-black rounded-xl text-xs font-bold transition-colors">
                    <i class="fa-solid fa-pen-to-square mr-1"></i> Editar Permisos
                </button>
                ${!r.is_base ? `
                <button onclick="window.deleteAdminRole('${r.id}')" class="w-10 flex-shrink-0 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs flex items-center justify-center transition-colors">
                    <i class="fa-solid fa-trash"></i>
                </button>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');

    UI.canvas.innerHTML = `
        <div class="max-w-6xl mx-auto animate-fadeIn">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${cardsHtml}
                
                <!-- Botón Nuevo -->
                <div onclick="window.editAdminRole(null)" class="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 hover:text-tealAccent hover:border-tealAccent cursor-pointer transition-all min-h-[200px] bg-gray-50/50 dark:bg-white/[0.01] hover:bg-tealAccent/5">
                    <i class="fa-solid fa-plus text-3xl mb-3"></i>
                    <p class="font-bold text-sm">Crear Nuevo Rol</p>
                </div>
            </div>
        </div>

        <!-- Modal de Edición de Rol -->
        <div id="modal-edit-role" class="fixed inset-0 bg-black/60 backdrop-blur-sm hidden z-[999] flex items-center justify-center opacity-0 transition-opacity">
            <div class="bg-white dark:bg-darkCard w-full max-w-2xl rounded-3xl p-8 shadow-2xl transform scale-95 transition-transform" id="modal-edit-role-box">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-2xl font-black text-gray-900 dark:text-white" id="modal-role-title">Crear Rol</h2>
                        <p class="text-xs text-gray-500 mt-1">Define el nombre y los permisos de acceso modulares.</p>
                    </div>
                    <button onclick="document.getElementById('modal-edit-role').classList.add('hidden')" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="space-y-6">
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nombre del Rol</label>
                        <input type="text" id="inp-role-name" class="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-tealAccent" placeholder="Ej. Supervisor Regional">
                        <input type="hidden" id="inp-role-id">
                        <input type="hidden" id="inp-role-isbase">
                    </div>

                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Permisos Modulares</label>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="role-perms-container">
                            ${modules.map(m => `
                                <label class="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl cursor-pointer hover:border-tealAccent/50 transition-colors">
                                    <span class="text-xs font-bold text-gray-700 dark:text-gray-300">${m.label}</span>
                                    <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                        <input type="checkbox" data-mod="${m.id}" class="role-perm-chk toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:border-tealAccent checked:translate-x-5 focus:outline-none"/>
                                        <div class="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer transition-colors duration-200 ease-in-out peer-checked:bg-tealAccent"></div>
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <button onclick="window.saveAdminRole()" class="w-full py-4 bg-tealAccent text-black rounded-xl font-black uppercase tracking-widest text-xs hover:bg-teal-400 transition-colors mt-4">
                        <i class="fa-solid fa-save mr-2"></i> Guardar Rol
                    </button>
                </div>
            </div>
        </div>
    `;

    // Fix button global if user clicks "+" icon in header
    setGlobalButton(true, '<i class="fa-solid fa-plus"></i> Crear Rol', () => window.editAdminRole(null));
};

window.editAdminRole = function(roleId) {
    const db = getDB();
    const modal = document.getElementById('modal-edit-role');
    const box = document.getElementById('modal-edit-role-box');
    
    let role = { nombre: '', permisos: {}, is_base: false };
    if (roleId) {
        role = (db.Admin_Roles || []).find(r => r.id === roleId) || role;
    }

    document.getElementById('modal-role-title').textContent = roleId ? 'Editar Rol' : 'Crear Rol';
    document.getElementById('inp-role-id').value = roleId || '';
    document.getElementById('inp-role-name').value = role.nombre;
    document.getElementById('inp-role-isbase').value = role.is_base ? 'true' : 'false';
    
    // Si es un rol base, proteger el nombre? Mejor no para flexibilidad, pero el check is_base se mantiene

    document.querySelectorAll('.role-perm-chk').forEach(chk => {
        const modId = chk.dataset.mod;
        chk.checked = !!(role.permisos && role.permisos[modId]);
    });

    modal.classList.remove('hidden');
    // slight delay for animation
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        box.classList.remove('scale-95');
    }, 10);
};

window.saveAdminRole = async function() {
    const db = getDB();
    const id = document.getElementById('inp-role-id').value;
    const isBase = document.getElementById('inp-role-isbase').value === 'true';
    const nombre = document.getElementById('inp-role-name').value.trim();

    if (!nombre) return showToast('El nombre del rol es obligatorio', 'error');

    const permisos = {};
    document.querySelectorAll('.role-perm-chk').forEach(chk => {
        permisos[chk.dataset.mod] = chk.checked;
    });

    const roleObj = {
        id: id || genId('rol', db),
        nombre,
        permisos,
        is_base: isBase
    };

    if (!db.Admin_Roles) db.Admin_Roles = [];
    const idx = db.Admin_Roles.findIndex(r => r.id === roleObj.id);
    if (idx > -1) {
        db.Admin_Roles[idx] = roleObj;
    } else {
        db.Admin_Roles.push(roleObj);
    }

    try {
        await saveGranular('admin_roles', [roleObj]);
        showToast('Rol guardado exitosamente', 'success');
        document.getElementById('modal-edit-role').classList.add('hidden');
        if (state.activeView === 'roles') renderRolesBuilder();
    } catch (e) {
        showToast('Error al guardar rol', 'error');
    }
};

window.deleteAdminRole = async function(roleId) {
    if (!confirm('¿Seguro que deseas eliminar este rol? Los usuarios asignados podrían perder su acceso.')) return;
    
    const db = getDB();
    const role = (db.Admin_Roles || []).find(r => r.id === roleId);
    if (role && role.is_base) return showToast('Los roles base no se pueden eliminar', 'error');

    try {
        if (typeof deleteRecord === 'function') await deleteRecord('admin_roles', roleId);
        db.Admin_Roles = (db.Admin_Roles || []).filter(r => r.id !== roleId);
        showToast('Rol eliminado', 'success');
        if (state.activeView === 'roles') renderRolesBuilder();
    } catch(e) {
        showToast('Error al eliminar rol', 'error');
    }
};
