/* ============================================================
   RENEW SOLAR – screens/inventory.js
   Drill-down Inventory Form for Techs
   ============================================================ */
import { getInventario, inventarioWaterDeSede, saveInventario, getHistorialInventario, saveHistorialInventario, getDB, saveDB, saveGranular, syncKanbanActivity } from '../api.js';
import { showToast } from '../components/toast.js';
import { navigate, getCurrentUser } from '../app.js';

let selectedSede = null;
let selectedEcosistema = null;
let currentDealId = null;

const SEDES = [
  { id: 'orlando',  nombre: 'Orlando',    estado: 'Florida' },
  { id: 'miami',    nombre: 'Miami',      estado: 'Florida' },
  { id: 'dallas',   nombre: 'Dallas',     estado: 'Texas' },
  { id: 'houston',  nombre: 'Houston',    estado: 'Texas' },
  { id: 'austin',   nombre: 'Austin',     estado: 'Texas' },
  { id: 'north_carolina', nombre: 'North Carolina', estado: 'North Carolina' },
  { id: 'new_york', nombre: 'Nueva York', estado: 'New York' }
];

const ECOSISTEMAS = [
  { id: 'solar', nombre: 'Renew Solar', icon: 'fa-sun',     desc: 'Paneles y energía solar' },
  { id: 'water', nombre: 'Renew Water', icon: 'fa-droplet', desc: 'Tratamiento y filtración de agua' },
  { id: 'home',  nombre: 'Renew Home',  icon: 'fa-house',   desc: 'Soluciones para el hogar' }
];

// Solo la sede de Orlando maneja los tres ecosistemas; el resto solo Renew Water
function ecosistemasDeSede(sede) {
  return sede === 'orlando' ? ECOSISTEMAS : ECOSISTEMAS.filter(e => e.id === 'water');
}

function escHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function itemsDe(sede, eco) {
  // Water: mismos productos que la lista de precios
  if (eco === 'water') {
    const vinculados = inventarioWaterDeSede(sede);
    if (vinculados) return vinculados;
  }
  return getInventario().filter(item => {
    const matchesSede = item.locacion === sede;
    const matchesEco = !eco || (item.category === eco) || (item.ecosistema && item.ecosistema.toLowerCase().includes(eco));
    return matchesSede && matchesEco;
  });
}

export function renderInventoryTech(dealId = null) {
  currentDealId = dealId;
  selectedSede = null;
  selectedEcosistema = null;
  const screen = document.getElementById('screen-inventory-tech');
  if (!screen) return;

  const user = getCurrentUser();
  const isAdmin = user && window.getUserRoles(user).some(r => ['admin', 'ceo', 'ceo-renew', 'supervisión'].includes(r));

  const sedeCards = SEDES.map(s => {
    const items = itemsDe(s.id);
    const unidades = items.reduce((a, i) => a + (Number(i.stockActual) || 0), 0);
    return `
      <button class="inv-card inv-sede" data-sede="${s.id}">
        <span class="inv-card-icon"><i class="fa-solid fa-location-dot"></i></span>
        <span class="inv-card-body">
          <span class="inv-card-title">Sede ${s.nombre}</span>
          <span class="inv-card-sub">${s.estado}${isAdmin ? ` · ${items.length} artículos · ${unidades} uds` : ''}</span>
        </span>
        <i class="fa-solid fa-chevron-right inv-card-arrow"></i>
      </button>`;
  }).join('');

  const ecoCards = ECOSISTEMAS.map(e => `
      <button class="inv-card inv-eco inv-eco-${e.id}" data-eco="${e.id}">
        <span class="inv-card-icon"><i class="fa-solid ${e.icon}"></i></span>
        <span class="inv-card-body">
          <span class="inv-card-title">${e.nombre}</span>
          <span class="inv-card-sub">${e.desc}</span>
          <span class="inv-card-count" data-eco-count="${e.id}"></span>
        </span>
        <i class="fa-solid fa-chevron-right inv-card-arrow"></i>
      </button>`).join('');

  screen.innerHTML = `
    <div class="inv-wrap">
      <div class="inv-header">
        <button id="btn-inventory-back" class="inv-back" aria-label="Volver"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="inv-header-text">
          <h1>Inventario <i class="fa-solid fa-box"></i></h1>
          <p>Registro de uso técnico</p>
        </div>
      </div>

      <div class="inv-crumbs" id="inv-crumbs">
        <span class="inv-crumb active" data-crumb="1"><b>1</b> Sede</span>
        <i class="fa-solid fa-chevron-right"></i>
        <span class="inv-crumb" data-crumb="2"><b>2</b> Ecosistema</span>
        <i class="fa-solid fa-chevron-right"></i>
        <span class="inv-crumb" data-crumb="3"><b>3</b> Material</span>
      </div>

      <div id="inv-step-1" class="inv-step">
        <p class="inv-label">Seleccione su sede</p>
        <div id="inv-step-1-grid" class="inv-grid inv-grid-2">${sedeCards}</div>
      </div>

      <div id="inv-step-2" class="inv-step" style="display:none;">
        <button id="btn-back-1" class="inv-link"><i class="fa-solid fa-arrow-left"></i> Volver a sedes</button>
        <p class="inv-label">Seleccione el ecosistema</p>
        <div id="inv-step-2-grid" class="inv-grid inv-grid-3">${ecoCards}</div>
      </div>

      <div id="inv-step-3" class="inv-step" style="display:none;">
        <button id="btn-back-2" class="inv-link"><i class="fa-solid fa-arrow-left"></i> Volver a ecosistemas</button>
        <p class="inv-label" id="form-title">Retiro de material</p>

        <div class="inv-work">
          <div class="inv-panel inv-list-panel">
            <div class="inv-search">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input id="inv-search-input" type="text" placeholder="Buscar artículo o código..." autocomplete="off">
            </div>
            <div id="inv-item-list-container" class="inv-items"></div>
          </div>

          <div class="inv-panel inv-action-panel">
            <p class="inv-mini-label">Artículo seleccionado</p>
            <div id="inv-trigger-content" class="inv-selected">
              <p id="inv-trigger-placeholder" class="inv-empty"><i class="fa-solid fa-hand-pointer"></i>Elija un artículo de la lista</p>
            </div>
            <input type="hidden" id="inv-item-select" value="">
            <div class="inv-actions">
              <button id="btn-sub-stock-inv" class="inv-round inv-minus" aria-label="Retirar 1 unidad"><i class="fa-solid fa-minus"></i></button>
              ${isAdmin ? `<button id="btn-add-stock-inv" class="inv-round inv-plus" aria-label="Agregar 1 unidad"><i class="fa-solid fa-plus"></i></button>` : ''}
            </div>
            <p class="inv-hint">Cada toque ${isAdmin ? 'retira o agrega' : 'retira'} 1 unidad.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach Event Listeners
  const step1 = document.getElementById('inv-step-1');
  const step2 = document.getElementById('inv-step-2');
  const step3 = document.getElementById('inv-step-3');

  function mostrarPaso(n) {
    step1.style.display = n === 1 ? 'block' : 'none';
    step2.style.display = n === 2 ? 'block' : 'none';
    step3.style.display = n === 3 ? 'block' : 'none';
    screen.querySelectorAll('.inv-crumb').forEach(c => {
      const k = Number(c.dataset.crumb);
      c.classList.toggle('active', k === n);
      c.classList.toggle('done', k < n);
    });
  }

  document.querySelectorAll('.inv-sede').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSede = btn.dataset.sede;
      const permitidos = ecosistemasDeSede(selectedSede).map(e => e.id);
      ECOSISTEMAS.forEach(e => {
        const card = screen.querySelector(`.inv-eco[data-eco="${e.id}"]`);
        if (card) card.style.display = permitidos.includes(e.id) ? '' : 'none';
        const el = screen.querySelector(`[data-eco-count="${e.id}"]`);
        if (el) el.textContent = `${itemsDe(selectedSede, e.id).length} artículos`;
      });
      document.getElementById('btn-back-2').innerHTML = `<i class="fa-solid fa-arrow-left"></i> ${permitidos.length === 1 ? 'Volver a sedes' : 'Volver a ecosistemas'}`;
      // Si la sede solo tiene un ecosistema (Water), saltar directo a los materiales
      if (permitidos.length === 1) {
        selectedEcosistema = permitidos[0];
        mostrarPaso(3);
        populateItems();
      } else {
        mostrarPaso(2);
      }
    });
  });

  document.querySelectorAll('.inv-eco').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedEcosistema = btn.dataset.eco;
      mostrarPaso(3);
      populateItems();
    });
  });

  document.getElementById('btn-back-1').addEventListener('click', () => mostrarPaso(1));
  document.getElementById('btn-back-2').addEventListener('click', () => {
    mostrarPaso(ecosistemasDeSede(selectedSede).length === 1 ? 1 : 2);
  });

  const btnSubStock = document.getElementById('btn-sub-stock-inv');
  if (btnSubStock) {
    btnSubStock.addEventListener('click', () => {
        btnSubStock.style.transform = 'scale(0.9)';
        setTimeout(() => btnSubStock.style.transform = 'scale(1)', 150);
        handleInventoryChange('withdrawal');
    });
  }

  const btnAddStock = document.getElementById('btn-add-stock-inv');
  if (btnAddStock) {
    btnAddStock.addEventListener('click', () => {
        btnAddStock.style.transform = 'scale(0.9)';
        setTimeout(() => btnAddStock.style.transform = 'scale(1)', 150);
        handleInventoryChange('addition');
    });
  }

  // Back Button to Dashboard or Project
  const btnBackDash = document.getElementById('btn-inventory-back');
  if (btnBackDash) {
    btnBackDash.addEventListener('click', () => {
        if (currentDealId) {
            navigate('detail', currentDealId);
        } else {
            navigate('dashboard');
        }
    });
  }

  function renderSelected(item) {
    const triggerContent = document.getElementById('inv-trigger-content');
    triggerContent.innerHTML = `
      <span class="inv-sel-id">${escHtml(item.codigoLista || item.id)}</span>
      <span class="inv-sel-name">${escHtml(item.nombreItem)}</span>
      <span class="inv-sel-eco">${escHtml(item.ecosistema || '')}</span>
      ${isAdmin ? `<span class="inv-sel-stock"><b>${item.stockActual}</b> unidades disponibles</span>` : ''}
    `;
  }

  function populateItems() {
    const listContainer = document.getElementById('inv-item-list-container');
    const triggerContent = document.getElementById('inv-trigger-content');
    const hiddenInput = document.getElementById('inv-item-select');
    const searchInput = document.getElementById('inv-search-input');

    listContainer.innerHTML = '';
    hiddenInput.value = '';
    searchInput.value = '';
    triggerContent.innerHTML = `<p id="inv-trigger-placeholder" class="inv-empty"><i class="fa-solid fa-hand-pointer"></i>Elija un artículo de la lista</p>`;

    let formTitle = `Retiro de material · Sede ${escHtml(selectedSede.replace('_', ' '))} · ${escHtml(selectedEcosistema)}`;

    if (currentDealId) {
        const db = getDB();
        const proj = (db.Proyectos_Dinamicos || []).find(p => p.id === currentDealId);
        if (proj) {
            formTitle = `Retiro de material · Proyecto: ${escHtml(proj.nombre_cliente)}`;
        }
    }

    document.getElementById('form-title').innerHTML = formTitle;

    const filtered = itemsDe(selectedSede, selectedEcosistema);

    if (filtered.length === 0) {
        listContainer.innerHTML = `<p class="inv-empty" style="grid-column:1/-1;"><i class="fa-solid fa-box-open"></i>Sin existencias en esta línea</p>`;
        return;
    }

    // Water ya viene en el orden de la lista de precios
    if (selectedEcosistema !== 'water' || !filtered.some(i => i.codigoLista)) filtered.sort((a, b) => {
        const getRank = (eco) => {
            if (!eco) return 99;
            const text = eco.toLowerCase();
            if (text.includes('economica') || text.includes('económica')) return 1;
            if (text.includes('clasica') || text.includes('clásica')) return 2;
            if (text.includes('pozo')) return 3;
            return 99;
        };
        const rankA = getRank(a.ecosistema);
        const rankB = getRank(b.ecosistema);
        if (rankA !== rankB) return rankA - rankB;
        return (a.nombreItem || '').localeCompare(b.nombreItem || '');
    });

    filtered.forEach(item => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'inv-item';
      card.dataset.search = `${item.codigoLista || item.id} ${item.nombreItem} ${item.ecosistema || ''}`.toLowerCase();
      card.innerHTML = `
        <span class="inv-item-id">${escHtml(item.codigoLista || item.id)}</span>
        <span class="inv-item-name">${escHtml(item.nombreItem)}</span>
        <span class="inv-item-foot">
          <span class="inv-item-eco">${escHtml(item.ecosistema || '')}</span>
          ${isAdmin ? `<span class="inv-item-stock">Stock: ${item.stockActual}</span>` : ''}
        </span>
      `;

      card.addEventListener('click', () => {
          hiddenInput.value = item.id;
          listContainer.querySelectorAll('.inv-item').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          renderSelected(item);
      });

      listContainer.appendChild(card);
    });

    searchInput.oninput = () => {
      const q = searchInput.value.trim().toLowerCase();
      listContainer.querySelectorAll('.inv-item').forEach(c => {
        c.style.display = !q || c.dataset.search.includes(q) ? '' : 'none';
      });
    };
  }

  async function handleInventoryChange(mode = 'withdrawal') {
    const itemId = document.getElementById('inv-item-select').value;
    const qty = 1; // 1 click = 1 unidad

    if (!itemId) {
      showToast('Error: Debe seleccionar un artículo primero', 'error');
      return;
    }

    const invData = getInventario();
    const item = invData.find(i => i.id === itemId);
    if (!item) return;

    if (mode === 'withdrawal') {
        if (qty > item.stockActual) {
          showToast('Error: No hay suficiente material en la sede para este retiro', 'error');
          return;
        }
        item.stockActual -= qty;
    } else {
        // Addition (Admin only)
        item.stockActual += qty;
    }

    // ── Registro en historialInventario ──────────────────────────
    try {
      const loggedUser = getCurrentUser() || {};
      const userName = [loggedUser.nombre, loggedUser.apellido].filter(Boolean).join(' ') || loggedUser.email || (mode === 'withdrawal' ? 'Técnico' : 'Admin');
      
      let clienteNombre = null;
      if (currentDealId) {
          const db = getDB();
          const proj = (db.Proyectos_Dinamicos || []).find(p => p.id === currentDealId);
          if (proj) {
              const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(proj.cliente_id));
              if (cli) clienteNombre = cli.nombre;
          }
      }

      const historial = getHistorialInventario();
      const newEntry = {
        fecha: new Date().toISOString(),
        tecnico_nombre: userName,
        tecnico_id: loggedUser.id || null,
        item_nombre: item.nombreItem,
        item_id: item.id,
        cantidad_retirada: mode === 'withdrawal' ? qty : -qty,
        sede: selectedSede,
        ecosistema: selectedEcosistema,
        proyecto_id: currentDealId || null,
        cliente_nombre: clienteNombre,
        tipo_movimiento: currentDealId && mode === 'withdrawal' ? 'Salida (Proyecto)' : (mode === 'withdrawal' ? 'RETIRO' : 'SURTIDO')
      };
      // Guardado granular: solo el artículo, el movimiento y (si aplica) el proyecto.
      // Antes se enviaba la BD completa a /api/db y el servidor la rechazaba (413).
      await saveGranular('inventario_global', [{
        id:           item.id,
        nombre_item:  item.nombreItem  || null,
        ecosistema:   item.ecosistema  || null,
        category:     item.category    || null,
        locacion:     item.locacion    || null,
        storage:      item.storage     || null,
        stock_actual: item.stockActual || 0,
        medida:       item.medida      || null,
        boton:        item.boton       || null,
        color:        item.color       || null
      }]);

      // Se agrega primero al historial local para que saveGranular lo fusione consigo mismo
      historial.unshift(newEntry);
      if (historial.length > 500) historial.length = 500;
      const { tecnico_id, ...histRecord } = newEntry;
      try {
        await saveGranular('historial_inventario', [histRecord]);
      } catch (e) {
        historial.shift();
        throw e;
      }

      if (currentDealId && mode === 'withdrawal') {
          syncKanbanActivity({
              proyecto_id: currentDealId,
              evento: 'RETIRO_MATERIAL',
              campo_etiqueta: 'Inventario',
              archivo_nombre: `${qty} x ${item.nombreItem}`,
              responsable_id: loggedUser.id,
              fase_nombre: 'Materiales',
              skipSave: true
          });
          const proj = (getDB().Proyectos_Dinamicos || []).find(p => p.id === currentDealId);
          if (proj) saveGranular('proyectos_dinamicos', [proj]).catch(e => console.warn('No se pudo guardar la actividad del proyecto:', e));
      }

    } catch (histErr) {
      console.warn('No se pudo guardar el historial de inventario:', histErr);
      // Revertir el stock en pantalla para no mostrar un cambio que no se guardó
      item.stockActual += mode === 'withdrawal' ? qty : -qty;
      showToast('Error al sincronizar historial con la nube', 'error');
      return; // Stop here if save fails
    }
    // ─────────────────────────────────────────────────────────────

    showToast(mode === 'withdrawal' ? '1 unidad retirada' : '1 unidad agregada', 'success');
    
    // Update displayed stock immediately without clearing selection
    renderSelected(item);
    const stockTag = document.querySelector('#inv-item-list-container .inv-item.selected .inv-item-stock');
    if (stockTag) stockTag.textContent = `Stock: ${item.stockActual}`;
  }
}
