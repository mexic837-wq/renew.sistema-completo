/* ============================================================
   RENEW SOLAR – screens/inventory.js
   Drill-down Inventory Form for Techs
   ============================================================ */
import { getInventario, saveInventario, getHistorialInventario, saveHistorialInventario } from '../api.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../app.js';

let selectedSede = null;
let selectedEcosistema = null;

export function renderInventoryTech() {
  const screen = document.getElementById('screen-inventory-tech');
  if (!screen) return;

  // Initial State: Paso 1
  screen.innerHTML = `
    <div class="dash-header" style="padding-bottom: 0;">
      <div class="dash-header-top" style="display: flex; align-items: center; justify-content: center; position: relative; min-height: 60px;">
        <button id="btn-inventory-back" style="position: absolute; left: 0; background: none; border: none; color: var(--text); padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div class="dash-greeting" style="text-align: center;">
          <h1 style="margin: 0; font-size: 1.2rem;">Inventario 📦</h1>
          <p style="color:var(--text-muted); font-size:0.75rem; margin-top:2px;">Registro de Uso Técnico</p>
        </div>
      </div>
    </div>
    
    <div id="inv-step-1" class="menu-body" style="padding: 24px;">
      <p class="menu-section-label">Paso 1: Seleccione su Sede</p>
      <div id="inv-step-1-grid" style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px;">
        <button class="btn-sede shadow-sm" data-sede="orlando" style="padding: 32px; background: var(--surface-alt); border: 2px solid var(--border); border-radius: 16px; font-size: 1.2rem; font-weight: bold; color: var(--text-primary); cursor: pointer; transition: 0.2s;">Sede Orlando</button>
        <button class="btn-sede shadow-sm" data-sede="miami" style="padding: 32px; background: var(--surface-alt); border: 2px solid var(--border); border-radius: 16px; font-size: 1.2rem; font-weight: bold; color: var(--text-primary); cursor: pointer; transition: 0.2s;">Sede Miami</button>
        <button class="btn-sede shadow-sm" data-sede="dallas" style="padding: 32px; background: var(--surface-alt); border: 2px solid var(--border); border-radius: 16px; font-size: 1.2rem; font-weight: bold; color: var(--text-primary); cursor: pointer; transition: 0.2s;">Sede Dallas</button>
        <button class="btn-sede shadow-sm" data-sede="new_york" style="padding: 32px; background: var(--surface-alt); border: 2px solid var(--border); border-radius: 16px; font-size: 1.2rem; font-weight: bold; color: var(--text-primary); cursor: pointer; transition: 0.2s;">Sede Nueva York</button>
      </div>
    </div>

    <div id="inv-step-2" class="menu-body" style="padding: 24px; display: none;">
      <button id="btn-back-1" class="btn btn-outline" style="margin-bottom: 24px;">← Volver a Sedes</button>
      <p class="menu-section-label">Paso 2: Seleccione el Ecosistema</p>
      <div id="inv-step-2-grid" style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px;">
        <button class="btn-eco" data-eco="solar" style="padding: 24px; background: #0d948820; border: 2px solid #0d9488; border-radius: 12px; font-size: 1.1rem; font-weight: bold; color: var(--text-primary); cursor: pointer; text-align: left;"><i class="fa-solid fa-sun mr-3"></i> Renew Solar</button>
        <button class="btn-eco" data-eco="water" style="padding: 24px; background: #0284c720; border: 2px solid #0284c7; border-radius: 12px; font-size: 1.1rem; font-weight: bold; color: var(--text-primary); cursor: pointer; text-align: left;"><i class="fa-solid fa-droplet mr-3"></i> Renew Water</button>
        <button class="btn-eco" data-eco="home" style="padding: 24px; background: #f59e0b20; border: 2px solid #f59e0b; border-radius: 12px; font-size: 1.1rem; font-weight: bold; color: var(--text-primary); cursor: pointer; text-align: left;"><i class="fa-solid fa-house mr-3"></i> Renew Home</button>
      </div>
    </div>

    <div id="inv-step-3" class="menu-body" style="padding: 24px; display: none;">
      <button id="btn-back-2" class="btn btn-outline" style="margin-bottom: 24px;">← Volver a Ecosistemas</button>
      <p class="menu-section-label" id="form-title">Formulario de Retiro</p>
      
      <div class="inventory-form-container" style="background: var(--surface-alt); padding: 32px; border-radius: 20px; border: 1px solid var(--border); margin-top: 16px; box-shadow: var(--shadow-sm);">
        <div class="field-group" style="margin-bottom:20px; position: relative;">
          <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; color: var(--text-muted); margin-bottom: 12px;">PRODUCTO</p>
          
          <!-- Trigger Dropdown UI -->
          <div id="inv-item-trigger" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: 0.2s; min-height: 70px;">
              <div id="inv-trigger-content">
                  <p id="inv-trigger-placeholder" style="color: var(--text-muted); font-size: 0.9rem; font-weight:700;">Seleccione un artículo...</p>
              </div>
              <i class="fa-solid fa-chevron-down" style="color: var(--text-muted); font-size: 0.8rem; transition: transform 0.3s;"></i>
          </div>

          <!-- Collapsible List Container -->
          <div id="inv-item-list-wrapper" style="display: none; position: relative; z-index: 10; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 16px; margin-top: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); overflow: hidden; animation: slideInUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);">
              <div id="inv-item-list-container" class="custom-item-selector" style="display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto; padding: 12px;">
                  <!-- Se poblará dinámicamente -->
              </div>
          </div>

          <input type="hidden" id="inv-item-select" value="">
        </div>
        
        <div>
            <div class="field-group">
              <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; color: var(--text-muted); margin-bottom: 8px;">CANTIDAD A UTILIZAR</p>
              <div class="input-wrap no-icon">
                <input type="number" id="inv-item-qty" min="1" placeholder="Ej. 1" style="width: 100%; padding: 12px; border-radius: 8px; background: var(--surface); color: var(--text-primary); border: 1px solid var(--border);" />
              </div>
            </div>
    
            <div class="mobile-submit-box">
                <button id="btn-submit-inv" class="btn btn-primary" style="width: 100%; margin-top: 16px; padding: 14px; font-size: 1.1rem; font-weight: 800; letter-spacing: 1px;">REGISTRAR USO</button>
            </div>
        </div>
      </div>
    </div>
  `;

  // Attach Event Listeners
  const step1 = document.getElementById('inv-step-1');
  const step2 = document.getElementById('inv-step-2');
  const step3 = document.getElementById('inv-step-3');

  document.querySelectorAll('.btn-sede').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedSede = e.target.dataset.sede;
      step1.style.display = 'none';
      step2.style.display = 'block';
    });
  });

  document.querySelectorAll('.btn-eco').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedEcosistema = e.target.dataset.eco;
      step2.style.display = 'none';
      step3.style.display = 'block';
      populateItems();
    });
  });

  document.getElementById('btn-back-1').addEventListener('click', () => {
    step2.style.display = 'none';
    step1.style.display = 'block';
  });

  document.getElementById('btn-back-2').addEventListener('click', () => {
    step3.style.display = 'none';
    step2.style.display = 'block';
  });

  document.getElementById('btn-submit-inv').addEventListener('click', handleWithdrawal);

  // Back Button to Dashboard
  const btnBackDash = document.getElementById('btn-inventory-back');
  if (btnBackDash) {
    btnBackDash.addEventListener('click', () => navigate('dashboard'));
  }

  function populateItems() {
    const trigger = document.getElementById('inv-item-trigger');
    const wrapper = document.getElementById('inv-item-list-wrapper');
    const listContainer = document.getElementById('inv-item-list-container');
    const triggerContent = document.getElementById('inv-trigger-content');
    const hiddenInput = document.getElementById('inv-item-select');
    const chevron = trigger.querySelector('.fa-chevron-down');
    
    listContainer.innerHTML = '';
    hiddenInput.value = '';
    
    // Toggle dropdown
    trigger.onclick = () => {
        const isHidden = wrapper.style.display === 'none';
        wrapper.style.display = isHidden ? 'block' : 'none';
        chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        trigger.style.borderColor = isHidden ? 'var(--tealAccent)' : 'var(--border)';
    };

    document.getElementById('form-title').innerText = `RETIRO DE MATERIAL - SEDE ${selectedSede.toUpperCase()} (${selectedEcosistema.toUpperCase()})`;

    const invData = getInventario();
    const filtered = invData.filter(item => {
        const matchesSede = item.locacion === selectedSede;
        const matchesEco = (item.category === selectedEcosistema) || (item.ecosistema && item.ecosistema.toLowerCase().includes(selectedEcosistema));
        return matchesSede && matchesEco;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `<p style="text-align:center; padding:12px; color:var(--text-muted); font-size:0.7rem;">Sin existencias en esta línea</p>`;
        return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'inv-item-card';
      card.style.cssText = `
        padding: 16px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        cursor: pointer;
        transition: 0.2s;
        display: flex;
        flex-direction: column;
        gap: 2px;
      `;
      
      card.innerHTML = `
        <span style="font-size: 7px; font-weight: 900; color: var(--tealAccent); opacity: 0.8;">${item.id}</span>
        <span style="font-size: 0.9rem; font-weight: 800; color: var(--text-primary); text-transform: uppercase;">${item.nombreItem}</span>
        <span style="font-size: 8px; color: var(--text-muted); font-weight: 600;">${item.ecosistema || ''}</span>
      `;

      card.addEventListener('click', () => {
          // Update hidden input
          hiddenInput.value = item.id;
          
          // Update Trigger Display
          triggerContent.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:2px;">
                <span style="font-size: 7px; font-weight: 900; color: var(--tealAccent); opacity: 0.8;">${item.id}</span>
                <span style="font-size: 0.9rem; font-weight: 800; color: var(--text-primary); text-transform: uppercase;">${item.nombreItem}</span>
            </div>
          `;
          
          // Close list
          wrapper.style.display = 'none';
          chevron.style.transform = 'rotate(0deg)';
          trigger.style.borderColor = 'var(--tealAccent)';
          trigger.style.background = 'rgba(0, 245, 212, 0.05)';
      });

      listContainer.appendChild(card);
    });
  }

  function handleWithdrawal() {
    const itemId = document.getElementById('inv-item-select').value;
    const qtyInput = document.getElementById('inv-item-qty').value;
    const qty = parseInt(qtyInput, 10);

    if (!itemId) {
      showToast('Error: Debe seleccionar un artículo', 'error');
      return;
    }
    if (!qty || qty <= 0) {
      showToast('Error: Ingrese una cantidad válida', 'error');
      return;
    }

    const invData = getInventario();
    const item = invData.find(i => i.id === itemId);
    if (!item) return;

    if (qty > item.stockActual) {
      // Alert with red notification without revealing true stock
      showToast('Error: No hay suficiente material en la sede para este retiro', 'error');
    } else {
      item.stockActual -= qty;
      saveInventario(invData);

      // ── Registro en historialInventario ──────────────────────────
      try {
        const loggedUser = JSON.parse(localStorage.getItem('rs_user') || '{}');
        const techName = [loggedUser.nombre, loggedUser.apellido].filter(Boolean).join(' ') || loggedUser.email || 'Técnico';

        const historial = getHistorialInventario();
        historial.unshift({
          fecha: new Date().toISOString(),
          tecnico_nombre: techName,
          item_nombre: item.nombreItem,
          item_id: item.id,
          cantidad_retirada: qty,
          sede: selectedSede,
          ecosistema: selectedEcosistema
        });
        // Keep only last 500 entries to avoid bloating the DB
        if (historial.length > 500) historial.length = 500;
        saveHistorialInventario(historial);
      } catch (histErr) {
        console.warn('No se pudo guardar el historial de inventario:', histErr);
      }
      // ─────────────────────────────────────────────────────────────

      showToast('Retiro registrado correctamente.', 'success');
      
      // Clear form
      document.getElementById('inv-item-select').value = '';
      document.getElementById('inv-item-qty').value = '';
      
      // Go back to Step 1 or stay? The prompt says: "limpia el formulario y muestra una notificación verde"
      // So staying in step 3 but clearing form is fine, or go to step 1.
      step3.style.display = 'none';
      step1.style.display = 'block';
    }
  }
}
