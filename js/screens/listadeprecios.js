/* ============================================================
   RENEW OS – screens/listadeprecios.js
   Pantalla "Mi Lista de Precios" (Mobile App View)
   ============================================================ */
import { getListaPrecios, getCatalogos } from '../api.js';
import { getCurrentUser, navigate } from '../app.js';

// Maps user rol → price column key
const RANK_PRICE_MAP = {
  'junior':       'precio_junior',
  'sub-vendedor': 'precio_subvende',
  'subvende':     'precio_subvende',
  'subvendedor':  'precio_subvende',
  'vendedor':     'precio_vendedor',
  'analista':     'precio_analista',
  'admin':        'precio_oficina',
  'administrador':'precio_oficina',
  'ceo':          'precio_oficina',
  'oficina':      'precio_oficina',
  'desarrollador':'precio_oficina',
};

function getPriceKey(rol) {
  const norm = (rol || '').toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-');
  return RANK_PRICE_MAP[norm] || null; // null = admin sees all columns
}

function formatPrice(val) {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function renderListaPrecios() {
  const screen = document.getElementById('screen-lista-precios');
  if (!screen) return;

  const user = getCurrentUser();
  const basePriceKey = getPriceKey(user?.rol);
  const isAdmin = !basePriceKey || ['admin','administrador','ceo','desarrollador'].includes((user?.rol||'').toLowerCase()); 
  
  let activePriceKey = basePriceKey || 'precio_vendedor';
  if (isAdmin && !basePriceKey) activePriceKey = 'precio_oficina';

  // Fetch cloud catalogs
  const catalogs = await getCatalogos();
  const catalogRec = catalogs.find(c => c.id === (basePriceKey ? basePriceKey.replace('precio_','') : 'vendedor'));
  const pdfUrl = catalogRec?.pdf_url;

  screen.innerHTML = `
    <div class="dash-header" style="padding-bottom:12px;">
      <div class="dash-header-top" style="display:flex; align-items:center; justify-content:center; position:relative; min-height:60px;">
        <button id="btn-precios-back" style="position:absolute; left:0; background:none; border:none; color:var(--text); padding:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
          <i class="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div class="dash-greeting" style="text-align:center;">
          <div class="greeting-time" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:1px; color:var(--primary); font-weight:800;">💧 Renew Water</div>
          <h1 style="margin:0; font-size:1.3rem;">Lista de Precios</h1>
        </div>
      </div>
      
      ${pdfUrl ? `
      <div style="padding:0 16px; margin-top:8px;">
        <a href="${pdfUrl}" target="_blank" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:10px; background:var(--primary); color:#000; border-radius:12px; text-decoration:none; font-size:0.75rem; font-weight:900; text-transform:uppercase; letter-spacing:1px; box-shadow:0 4px 15px var(--primary-glow);">
          <i class="fa-solid fa-file-pdf"></i> Ver Catálogo Completo (PDF)
        </a>
      </div>
      ` : ''}
    </div>

    <!-- Search + Filter -->
    <div style="padding:12px 16px 0;">
      <div style="position:relative; margin-bottom:12px;">
        <i class="fas fa-search" style="position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:0.9rem;"></i>
        <input type="text" id="precios-search" placeholder="Buscar producto o código..."
          style="width:100%; padding:13px 16px 13px 42px; border-radius:16px; border:1px solid var(--border); background:var(--surface-alt); color:var(--text-primary); font-size:0.9rem; outline:none; box-sizing:border-box;">
      </div>

      <!-- Category filter tabs (populated after load) -->
      <div id="precios-category-tabs" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none;"></div>
      
      <!-- Rank Switcher (Admin only) -->
      <div id="rank-switcher-container" style="display:none; gap:8px; overflow-x:auto; scrollbar-width:none; margin-top:12px; padding-bottom:4px;"></div>
    </div>

    <div id="precios-grid" style="padding:12px 16px 100px; display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px;">
      ${[1,2,3,4].map(() => `
        <div class="skeleton" style="height:180px; border-radius:20px;"></div>
      `).join('')}
    </div>

    <style>
      .precio-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 20px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.18s, box-shadow 0.18s;
        position: relative;
      }
      .precio-card:active { transform: scale(0.97); }
      .precio-card-img {
        width: 100%; height: 130px; object-fit: cover;
        background: var(--surface-alt);
        display: block;
      }
      .precio-card-img-placeholder {
        width: 100%; height: 130px;
        background: linear-gradient(135deg, #0ea5e920, #0284c720);
        display: flex; align-items: center; justify-content: center;
        font-size: 2.5rem;
      }
      .precio-card-body { padding: 14px; }
      .precio-cat-badge {
        font-size: 0.58rem; font-weight: 900; text-transform: uppercase;
        letter-spacing: 1px; padding: 3px 8px; border-radius: 6px;
        background: rgba(14,165,233,0.1); color: #0ea5e9;
        display: inline-block; margin-bottom: 6px;
      }
      .precio-name {
        font-size: 0.95rem; font-weight: 800; color: var(--text-primary);
        margin: 0 0 2px; line-height: 1.2;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .precio-code {
        font-size: 0.65rem; font-weight: 700; color: var(--text-muted);
        text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;
      }
      .precio-price-row {
        display: flex; align-items: center; justify-content: space-between;
        padding-top: 10px; border-top: 1px solid var(--border);
      }
      .precio-price-label { font-size: 0.62rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
      .precio-price-value { font-size: 1.15rem; font-weight: 900; color: #0ea5e9; }
      .cat-tab {
        flex-shrink: 0; padding: 7px 14px; border-radius: 12px; font-size: 0.72rem; font-weight: 800;
        border: 1.5px solid var(--border); background: var(--surface); color: var(--text-muted);
        cursor: pointer; transition: all 0.18s; white-space: nowrap;
      }
      .cat-tab.active { border-color: #0ea5e9; background: rgba(14,165,233,0.1); color: #0ea5e9; }
      
      .rank-tab {
        flex-shrink: 0; padding: 6px 12px; border-radius: 10px; font-size: 0.65rem; font-weight: 800;
        text-transform: uppercase; letter-spacing: 1px;
        border: 1px solid var(--border); background: var(--surface-alt); color: var(--text-muted);
        cursor: pointer; transition: all 0.18s; white-space: nowrap;
      }
      .rank-tab.active { background: #0ea5e9; color: white; border-color: #0ea5e9; box-shadow: 0 4px 12px rgba(14,165,233,0.3); }

      /* Responsive Modal Detailed View */
      .modal-overlay-custom {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(12px); z-index: 10000;
        display: flex; align-items: flex-end; justify-content: center;
        transition: all 0.3s ease;
      }
      .modal-sheet-custom {
        background: var(--surface); width: 100%; max-width: 600px;
        border-radius: 32px 32px 0 0; max-height: 92vh; overflow-y: auto;
        box-shadow: 0 -20px 50px rgba(0,0,0,0.2);
        animation: sheetUp .4s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .product-detail-container { padding: 24px 24px 48px; }
      .product-detail-grid { display: flex; flex-direction: column; gap: 20px; }
      .detail-image-wrapper { width: 100%; border-radius: 20px; overflow: hidden; background: var(--surface-alt); }
      .detail-image-wrapper img { width: 100%; height: 240px; object-fit: cover; display: block; }
      .detail-placeholder { width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; font-size: 4rem; background: linear-gradient(135deg, #0ea5e915, #0284c710); }

      @media (min-width: 800px) {
        .modal-overlay-custom { align-items: center; padding: 40px; }
        .modal-sheet-custom {
          max-width: 900px; border-radius: 32px; max-height: 85vh;
          animation: modalPop 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .product-detail-grid { flex-direction: row; gap: 40px; align-items: start; }
        .product-detail-left { flex: 1; position: sticky; top: 0; }
        .product-detail-right { flex: 1.3; }
        .detail-image-wrapper img { height: 400px; }
      }

      @keyframes modalPop {
        from { opacity: 0; transform: scale(0.92) translateY(20px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
    </style>
  `;

  document.getElementById('btn-precios-back')?.addEventListener('click', () => navigate('menu'));

  try {
    const allProducts = (await getListaPrecios()).filter(p => p.es_activo !== false);
    const grid = document.getElementById('precios-grid');
    const searchInput = document.getElementById('precios-search');
    const catTabsContainer = document.getElementById('precios-category-tabs');

    // Build category list
    const cats = ['Todos', ...new Set(allProducts.map(p => p.categoria).filter(Boolean))];
    let activeCategory = 'Todos';

    function renderCatTabs() {
      catTabsContainer.innerHTML = cats.map(c => `
        <button class="cat-tab ${c === activeCategory ? 'active' : ''}" data-cat="${c}">${c}</button>
      `).join('');
      catTabsContainer.querySelectorAll('.cat-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          activeCategory = btn.dataset.cat;
          renderCatTabs();
          renderCards(searchInput?.value?.trim() || '');
        });
      });
    }

    function renderCards(query = '') {
      let filtered = allProducts;
      if (activeCategory !== 'Todos') filtered = filtered.filter(p => p.categoria === activeCategory);
      if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter(p =>
          (p.nombre || '').toLowerCase().includes(q) ||
          (p.codigo || '').toLowerCase().includes(q) ||
          (p.descripcion || '').toLowerCase().includes(q)
        );
      }

      if (!filtered.length) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">
            <i class="fas fa-box-open" style="font-size:3.5rem; opacity:0.2; margin-bottom:16px;"></i>
            <p style="font-weight:700; font-size:1rem;">Sin productos</p>
            <p style="font-size:0.82rem; opacity:0.7;">Intenta con otros términos.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = filtered.map((p, i) => {
        const imgHTML = p.foto_url
          ? `<img src="${p.foto_url}" class="precio-card-img" alt="${p.nombre}" loading="lazy">`
          : `<div class="precio-card-img-placeholder">💧</div>`;

        return `
          <div class="precio-card animate-fade-in" data-id="${p.id}" style="animation-delay:${i * 0.04}s;">
            ${imgHTML}
            <div class="precio-card-body">
              ${p.categoria ? `<div class="precio-cat-badge">${p.categoria}</div>` : ''}
              <p class="precio-name">${p.nombre}</p>
              <p class="precio-code">COD: ${p.codigo || '—'}</p>
              <div class="precio-price-row">
                <div>
                  <div class="precio-price-label">${isAdmin ? `Precio ${activePriceKey.replace('precio_','').charAt(0).toUpperCase() + activePriceKey.replace('precio_','').slice(1)}` : 'Tu Precio'}</div>
                  <div class="precio-price-value">${formatPrice(p[activePriceKey])}</div>
                </div>
                <div style="width:32px; height:32px; border-radius:10px; background:rgba(14,165,233,0.1); display:flex; align-items:center; justify-content:center; color:#0ea5e9;">
                  <i class="fas fa-chevron-right" style="font-size:0.75rem;"></i>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      grid.querySelectorAll('.precio-card').forEach(card => {
        card.addEventListener('click', () => {
          const prod = allProducts.find(p => p.id === card.dataset.id);
          if (prod) _showProductDetail(prod, activePriceKey, isAdmin);
        });
      });
    }

    // Rank Switcher for Admins
    if (isAdmin) {
      const rankContainer = document.getElementById('rank-switcher-container');
      rankContainer.style.display = 'flex';
      const ranks = [
        { label: 'Oficina',   key: 'precio_oficina' },
        { label: 'Analista',  key: 'precio_analista' },
        { label: 'Representante',  key: 'precio_vendedor' },
        { label: 'Subvende',  key: 'precio_subvende' },
        { label: 'Junior',    key: 'precio_junior' }
      ];

      function renderRankTabs() {
        rankContainer.innerHTML = ranks.map(r => `
          <button class="rank-tab ${r.key === activePriceKey ? 'active' : ''}" data-rk="${r.key}">${r.label}</button>
        `).join('');
        
        rankContainer.querySelectorAll('.rank-tab').forEach(btn => {
          btn.onclick = () => {
            activePriceKey = btn.dataset.rk;
            renderRankTabs();
            renderCards(searchInput?.value?.trim() || '');
          };
        });
      }
      renderRankTabs();
    }

    renderCatTabs();
    renderCards();

    searchInput?.addEventListener('input', e => renderCards(e.target.value.trim()));

  } catch (err) {
    console.error('[ListaPrecios]', err);
    const grid = document.getElementById('precios-grid');
    if (grid) grid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:#ef4444;">
        <i class="fas fa-exclamation-triangle" style="font-size:3rem; margin-bottom:16px;"></i>
        <p>Error al cargar la lista de precios</p>
      </div>
    `;
  }
}

// ── Product Detail Responsive Modal ──────────────────────────
function _showProductDetail(prod, priceKey, isAdmin) {
  const existing = document.getElementById('modal-precio-detail');
  if (existing) existing.remove();

  const price = priceKey ? prod[priceKey] : null;

  // Build rank prices table if admin
  const allRanks = [
    { label: 'Junior',       key: 'precio_junior' },
    { label: 'Sub-Vendedor', key: 'precio_subvende' },
    { label: 'Representante',     key: 'precio_vendedor' },
    { label: 'Analista',     key: 'precio_analista' },
    { label: 'Oficina/Admin', key: 'precio_oficina' },
  ];

  const ranksHTML = isAdmin ? `
    <div style="margin-top:20px; background:var(--surface-alt); border-radius:18px; padding:20px; border:1px solid var(--border);">
      <p style="font-size:0.65rem; font-weight:900; color:#0ea5e9; text-transform:uppercase; letter-spacing:1.5px; margin:0 0 16px;">Precios por Rango</p>
      <div style="display:flex; flex-direction:column; gap:2px;">
        ${allRanks.map(r => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">${r.label}</span>
            <span style="font-size:0.95rem; font-weight:900; color:var(--text-primary);">${formatPrice(prod[r.key])}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : `
    <div style="margin-top:20px; background:linear-gradient(135deg,#0ea5e915,#0284c705); border:1.5px solid #0ea5e930; border-radius:18px; padding:24px; text-align:center;">
      <p style="font-size:0.65rem; font-weight:900; color:#0ea5e9; text-transform:uppercase; letter-spacing:1.5px; margin:0 0 4px;">Precio Full</p>
      <p style="font-size:2.2rem; font-weight:900; color:#0ea5e9; margin:0; letter-spacing:-1px;">${formatPrice(prod.precio_full)}</p>
      ${prod.unidad ? `<p style="font-size:0.75rem; color:var(--text-muted); margin:6px 0 0; font-weight:600;">precio por ${prod.unidad}</p>` : ''}
    </div>
  `;

  const imgContent = prod.foto_url
    ? `<img src="${prod.foto_url}" alt="${prod.nombre}">`
    : `<div class="detail-placeholder">💧</div>`;

  const modal = document.createElement('div');
  modal.id = 'modal-precio-detail';
  modal.className = 'modal-overlay-custom';
  modal.innerHTML = `
    <div class="modal-sheet-custom">
      <div style="width:40px; height:5px; background:rgba(255,255,255,0.1); border-radius:10px; margin:12px auto; display:block;" class="md:hidden"></div>
      
      <div class="product-detail-container">
        <div class="product-detail-grid">
          
          <!-- Columna Izquierda: Imagen -->
          <div class="product-detail-left">
            <div class="detail-image-wrapper">
              ${imgContent}
            </div>
            
            <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap;">
              ${prod.garantia ? `<div style="padding:10px 16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:14px;font-size:0.75rem;font-weight:700;color:#10b981;display:flex;align-items:center;gap:8px;"><i class="fas fa-shield-alt"></i>Garantía: ${prod.garantia}</div>` : ''}
              ${prod.unidad ? `<div style="padding:10px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:14px;font-size:0.75rem;font-weight:700;color:#f59e0b;display:flex;align-items:center;gap:8px;"><i class="fas fa-box"></i>Unidad: ${prod.unidad}</div>` : ''}
            </div>
          </div>

          <!-- Columna Derecha: Información -->
          <div class="product-detail-right">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
              <div style="flex:1; min-width:0;">
                ${prod.categoria ? `<div style="font-size:0.65rem;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#0ea5e9;margin-bottom:6px;">${prod.categoria}</div>` : ''}
                <h2 style="font-size:1.6rem;font-weight:900;color:var(--text-primary);margin:0;line-height:1.1;">${prod.nombre}</h2>
                <p style="font-size:0.8rem;color:var(--text-muted);margin:8px 0 0;font-weight:700;letter-spacing:1px;">COD: ${prod.codigo || '—'}</p>
              </div>
              <button id="btn-close-precio-modal" style="background:var(--surface-alt);border:none;border-radius:14px;width:40px;height:40px;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:16px;transition:0.2s;" onmouseover="this.style.color='#fff';this.style.background='#ef444450'" onmouseout="this.style.color='var(--text-muted)';this.style.background='var(--surface-alt)'">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Specs Badges -->
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin:20px 0;">
              ${prod.medida ? `
                <div style="background:var(--surface-alt); padding:8px 16px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column;">
                  <span style="font-size:0.55rem; color:var(--text-muted); font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Medida</span>
                  <span style="font-size:0.85rem; color:var(--text-primary); font-weight:800;">${prod.medida}</span>
                </div>
              ` : ''}
              ${prod.boton ? `
                <div style="background:var(--surface-alt); padding:8px 16px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column;">
                  <span style="font-size:0.55rem; color:var(--text-muted); font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Botón</span>
                  <span style="font-size:0.85rem; color:var(--text-primary); font-weight:800;">${prod.boton}</span>
                </div>
              ` : ''}
              ${prod.color ? `
                <div style="background:var(--surface-alt); padding:8px 16px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column;">
                  <span style="font-size:0.55rem; color:var(--text-muted); font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Color</span>
                  <span style="font-size:0.85rem; color:var(--text-primary); font-weight:800;">${prod.color}</span>
                </div>
              ` : ''}
            </div>

            ${prod.descripcion ? `
              <div style="border-top:1px solid var(--border); padding-top:16px; margin-bottom:20px;">
                <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6;margin:0;">${prod.descripcion}</p>
              </div>
            ` : ''}

            ${ranksHTML}

            <div style="margin-top:20px; display:flex; flex-direction:column; gap:12px;">
              ${(prod.precio_minimo || prod.precio_maximo) ? `
                <div style="background:rgba(14,165,233,0.05); border:1.5px solid rgba(14,165,233,0.1); border-radius:18px; padding:16px; text-align:center;">
                  <p style="font-size:0.65rem; font-weight:900; color:#0ea5e9; text-transform:uppercase; letter-spacing:1.5px; margin:0 0 6px;">Rango de Venta Sugerido</p>
                  <p style="font-size:1.3rem; font-weight:900; color:var(--text-primary); margin:0;">
                    ${formatPrice(prod.precio_minimo)} — ${formatPrice(prod.precio_maximo)}
                  </p>
                </div>
              ` : ''}

              ${(prod.solo_equipo_grande > 0) ? `
                <div style="background:rgba(245,158,11,0.08); border:1.5px dashed rgba(245,158,11,0.25); border-radius:18px; padding:16px; display:flex; justify-content:space-between; align-items:center;">
                   <span style="font-size:0.75rem; color:#f59e0b; font-weight:900; text-transform:uppercase; letter-spacing:1px;">Solo Tanque</span>
                   <span style="font-size:1.15rem; font-weight:900; color:#f59e0b;">${formatPrice(prod.solo_equipo_grande)}</span>
                </div>
              ` : ''}

              ${prod.pdf_url ? `
                <button onclick="window.open('${prod.pdf_url}', '_blank')" style="width:100%; padding:16px; background:#ef444410; border:2px solid #ef444430; border-radius:18px; color:#ef4444; font-size:0.9rem; font-weight:900; display:flex; align-items:center; justify-content:center; gap:10px; cursor:pointer; transition:0.2s; text-transform:uppercase; letter-spacing:1px;" onmouseover="this.style.background='#ef444420'" onmouseout="this.style.background='#ef444410'">
                  <i class="fa-solid fa-file-pdf"></i> Catálogo Técnico (PDF)
                </button>
              ` : ''}
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('btn-close-precio-modal').addEventListener('click', () => modal.remove());
}
