/* ============================================================
   RENEW SOLAR – screens/mapa.js
   ============================================================ */
import { getCurrentUser, navigate } from '../app.js';
import { getDB, getDeptArray, saveGranular } from '../api.js';

export async function renderMiMapa() {
  const user = getCurrentUser();
  const screen = document.getElementById('screen-mi-mapa');
  if (!screen) return;

  screen.innerHTML = `
    <div class="dash-header" style="padding-bottom: 0;">
      <div class="dash-header-top" style="display: flex; align-items: center; justify-content: center; position: relative; min-height: 60px;">
        <button id="btn-mapa-back" style="position: absolute; left: 0; background: none; border: none; color: var(--text); padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div class="dash-greeting" style="text-align: center;">
          <h1 style="margin: 0; font-size: 1.2rem;">Mi Mapa</h1>
          <p style="color:var(--text-muted); font-size:0.75rem; margin-top:2px;">Ubicación de tus clientes y leads asignados</p>
        </div>
      </div>
    </div>
    <div style="padding: 24px; padding-bottom: 100px; position:relative;">
      <div id="mi-mapa-container" style="background: var(--surface); border-radius: 24px; padding: 16px; box-shadow: var(--shadow-sm); min-height: 500px; width: 100%; position: relative;">
          <div class="flex items-center justify-center w-full h-full text-gray-500">
              <i class="fa-solid fa-spinner fa-spin text-2xl"></i> <span class="ml-3">Cargando mapa...</span>
          </div>
      </div>

      <!-- Note Panel -->
      <style>
        @keyframes npFadeIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
      </style>
      <div id="mapa-note-panel" style="
        display: none;
        position: fixed;
        bottom: 76px;
        left: 16px;
        right: 16px;
        max-width: 480px;
        margin: 0 auto;
        background: var(--surface);
        border-radius: 18px;
        padding: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.35);
        z-index: 9999;
        border: 1px solid var(--border);
        box-sizing: border-box;
        animation: npFadeIn 0.18s ease both;
      ">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div style="flex:1; min-width:0; margin-right:10px;">
            <div id="np-name" style="font-size:0.95rem; font-weight:800; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
            <div id="np-badges" style="display:flex; gap:5px; margin-top:4px; flex-wrap:wrap;"></div>
          </div>
          <button id="np-close" style="background:var(--surface-alt); border:none; border-radius:50%; width:28px; height:28px; min-width:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:1rem;">&times;</button>
        </div>
        <div id="np-details" style="font-size:0.78rem; color:var(--text-secondary); margin-bottom:12px; display:flex; flex-direction:column; gap:3px;"></div>
        <div style="margin-bottom:10px;">
          <label style="font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--text-muted); display:block; margin-bottom:5px;"><i class="fa-solid fa-file-pen"></i> Nota de campo</label>
          <textarea id="np-nota" rows="2" placeholder="Escribe una nota sobre esta visita o cliente..." style="
            width:100%; padding:9px 11px;
            border:1.5px solid var(--border); border-radius:10px;
            font-family:inherit; font-size:0.82rem;
            color:var(--text-primary); background:var(--surface-alt);
            resize:vertical; outline:none; transition:border-color 0.2s;
            box-sizing:border-box;
          "></textarea>
        </div>
        <button id="np-save" style="
          width:100%; padding:11px;
          background:linear-gradient(135deg,var(--primary),var(--accent));
          color:#000; font-weight:800; font-size:0.88rem;
          border:none; border-radius:11px; cursor:pointer;
          display:flex; align-items:center; justify-content:center; gap:8px;
          transition:all 0.2s; box-sizing:border-box;
        ">
          <i class="fas fa-save"></i> Guardar Nota
        </button>
        <div id="np-status" style="text-align:center; font-size:0.75rem; margin-top:7px; color:var(--text-muted); min-height:16px;"></div>
      </div>
    </div>
  `;


  setTimeout(() => {
    const btnBack = document.getElementById('btn-mapa-back');
    if (btnBack) btnBack.addEventListener('click', () => navigate('dashboard'));
  }, 100);

  setTimeout(() => {
    const mapEl = document.getElementById('mi-mapa-container');
    if (mapEl && window.google && window.google.maps) {
      mapEl.innerHTML = '';

      const map = new google.maps.Map(mapEl, {
        center: { lat: 39.8283, lng: -98.5795 },
        zoom: 4,
        mapTypeControl: false,
        streetViewControl: false,
        styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }]
      });

      const geocoder = new google.maps.Geocoder();
      const bounds = new google.maps.LatLngBounds();
      let validMarkers = 0;

      const db = getDB();
      const allClients = db.Clientes_Maestro || [];
      const allProys = db.Proyectos_Dinamicos || [];
      const userProjects = allProys.filter(p => p.responsable_id === user.id || p.vendedor_id === user.id);
      const userClientIds = new Set(userProjects.map(p => p.cliente_id));
      const allClientProjectIds = new Set(allProys.map(p => p.cliente_id));

      const userRole = (user.rol || '').toLowerCase();
      const isAdmin = ['admin', 'administrador', 'ceo', 'desenvolvedor', 'master'].includes(userRole);

      const myClients = isAdmin ? allClients : allClients.filter(c =>
        c.vendedor_asignado_id === user.id ||
        c.creador_id === user.id ||
        userClientIds.has(c.id)
      );

      if (myClients.length === 0) {
        mapEl.innerHTML = '<div class="flex flex-col items-center justify-center w-full h-full text-gray-400 text-center"><i class="fa-solid fa-map-location-dot text-4xl mb-3 opacity-50"></i><p>No tienes clientes con dirección registrada aún.</p></div>';
        return;
      }

      // ── Filter state ───────────────────────────────────────
      let activeDept   = 'todos';   // todos | solar | water | home | otro
      let activeStatus = 'todos';   // todos | prospecto | cliente

      // ── Dept config ────────────────────────────────────────
      const DEPTS = [
        { key: 'todos', label: 'Todos',  color: '#00dfbf', iconUrl: null },
        { key: 'solar', label: 'Solar',  color: '#f59e0b', iconUrl: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png' },
        { key: 'water', label: 'Water',  color: '#0ea5e9', iconUrl: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
        { key: 'home',  label: 'Home',   color: '#a855f7', iconUrl: 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png' },
        { key: 'otro',  label: 'Otro',   color: '#ef4444', iconUrl: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' },
      ];

      // ── Status config ──────────────────────────────────────
      const STATUSES = [
        { key: 'todos',      label: 'Todos',      color: '#64748b' },
        { key: 'prospecto',  label: 'Prospectos', color: '#f97316' },
        { key: 'cliente',    label: 'Clientes',   color: '#22c55e' },
      ];

      // Each marker entry: { marker, deptKey, statusKey }
      const allMarkerMeta = [];

      // ── Apply both filters ─────────────────────────────────
      function applyFilters() {
        allMarkerMeta.forEach(({ marker, deptKey, statusKey }) => {
          const deptOk   = activeDept   === 'todos' || activeDept   === deptKey;
          const statusOk = activeStatus === 'todos' || activeStatus === statusKey;
          marker.setVisible(deptOk && statusOk);
        });
      }

      // ── Build legend panel ─────────────────────────────────
      const legendEl = document.createElement('div');
      legendEl.style.cssText = `
        background: white;
        padding: 10px;
        border-radius: 14px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        font-family: 'Inter', sans-serif;
        margin: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 130px;
      `;

      // Section label helper
      function sectionLabel(text) {
        const el = document.createElement('div');
        el.textContent = text;
        el.style.cssText = 'font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; color:#94a3b8; padding: 4px 4px 2px;';
        return el;
      }

      // Pill builder
      function buildPill(cfg, isActive, onClick) {
        const pill = document.createElement('button');
        pill.dataset.key = cfg.key;
        const setBorder = (active) => {
          pill.style.border  = active ? `2px solid ${cfg.color}` : '2px solid transparent';
          pill.style.background = active ? `${cfg.color}22` : 'transparent';
          pill.style.color   = active ? cfg.color : '#374151';
        };
        pill.style.cssText = `
          display: flex; align-items: center; gap: 8px;
          padding: 5px 10px; border-radius: 20px;
          cursor: pointer; font-size: 11px; font-weight: 700;
          transition: all 0.18s; text-align: left; width: 100%;
        `;
        setBorder(isActive);

        if (cfg.iconUrl) {
          const img = document.createElement('img');
          img.src = cfg.iconUrl;
          img.style.cssText = 'width:13px; height:13px; flex-shrink:0;';
          pill.appendChild(img);
        } else {
          const dot = document.createElement('span');
          dot.style.cssText = `width:11px; height:11px; border-radius:50%; background:${cfg.color}; display:inline-block; flex-shrink:0;`;
          pill.appendChild(dot);
        }
        const lbl = document.createElement('span');
        lbl.textContent = cfg.label;
        pill.appendChild(lbl);

        pill.addEventListener('click', () => {
          onClick(cfg.key);
          // Re-style all sibling pills in same group
          pill.parentElement.querySelectorAll('button').forEach(btn => {
            const sib = [...DEPTS, ...STATUSES].find(x => x.key === btn.dataset.key);
            if (sib) {
              const active = btn.dataset.key === cfg.key && btn === pill ? true :
                             (btn.parentElement === pill.parentElement && btn.dataset.key !== cfg.key) ? false : null;
              if (active !== null) {
                btn.style.border = active ? `2px solid ${sib.color}` : '2px solid transparent';
                btn.style.background = active ? `${sib.color}22` : 'transparent';
                btn.style.color = active ? sib.color : '#374151';
              }
            }
          });
          applyFilters();
        });

        return pill;
      }

      // ── Department group ───────────────────────────────────
      const deptGroup = document.createElement('div');
      deptGroup.style.cssText = 'display:flex; flex-direction:column; gap:3px;';
      deptGroup.appendChild(sectionLabel('Departamento'));
      DEPTS.forEach(d => {
        const pill = buildPill(d, d.key === activeDept, (key) => { activeDept = key; });
        deptGroup.appendChild(pill);
      });

      // ── Divider ────────────────────────────────────────────
      const divider = document.createElement('div');
      divider.style.cssText = 'height:1px; background:#e2e8f0; margin: 6px 0;';

      // ── Status group ───────────────────────────────────────
      const statusGroup = document.createElement('div');
      statusGroup.style.cssText = 'display:flex; flex-direction:column; gap:3px;';
      statusGroup.appendChild(sectionLabel('Tipo'));
      STATUSES.forEach(s => {
        const pill = buildPill(s, s.key === activeStatus, (key) => { activeStatus = key; });
        statusGroup.appendChild(pill);
      });

      legendEl.appendChild(deptGroup);
      legendEl.appendChild(divider);
      legendEl.appendChild(statusGroup);
      map.controls[google.maps.ControlPosition.RIGHT_TOP].push(legendEl);

      // -- Geocode & place markers (one per client x dept combo) --
      const pipelines = db.Admin_Pipelines || [];

      // Helper: detect dept key from a project via pipeline lookup
      const getDeptFromProject = (p) => {
        const pip = pipelines.find(pl => pl.id === p.pipeline_id);
        const name = (pip ? pip.nombre : '').toLowerCase();
        if (name.includes('solar')) return 'solar';
        if (name.includes('water')) return 'water';
        if (name.includes('home'))  return 'home';
        return 'otro';
      };

      const clientDeptCombos = [];
      const seenCombo = new Set();

      // First pass: clients with projects -> one entry per unique (client, dept)
      allProys.forEach(p => {
        const c = myClients.find(cl => cl.id === p.cliente_id);
        if (!c || !c.direccion) return;
        const deptKey = getDeptFromProject(p);
        const combo = `${c.id}::${deptKey}`;
        if (!seenCombo.has(combo)) {
          seenCombo.add(combo);
          clientDeptCombos.push({ c, deptKey, statusKey: 'cliente' });
        }
      });

      // Second pass: prospectos (no projects at all)
      myClients.forEach(c => {
        if (!c.direccion || allClientProjectIds.has(c.id)) return;
        let deptKey = 'otro';
        let depts = [];
        try { depts = getDeptArray(c); } catch(e) {}
        const deptStr = (depts[0] || c.empresa || c.departamento || '').toLowerCase();
        if (deptStr.includes('solar')) deptKey = 'solar';
        else if (deptStr.includes('water')) deptKey = 'water';
        else if (deptStr.includes('home'))  deptKey = 'home';
        const combo = `${c.id}::${deptKey}`;
        if (!seenCombo.has(combo)) {
          seenCombo.add(combo);
          clientDeptCombos.push({ c, deptKey, statusKey: 'prospecto' });
        }
      });

      const deptIconMap = {
        solar: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
        water: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        home:  'http://maps.google.com/mapfiles/ms/icons/purple-dot.png',
        otro:  'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
      };

      // Pre-compute all depts per client (for showing all badges in panel)
      const allClientDeptsVendor = {};
      allProys.forEach(p => {
        const dk = getDeptFromProject(p);
        if (!allClientDeptsVendor[p.cliente_id]) allClientDeptsVendor[p.cliente_id] = new Set();
        allClientDeptsVendor[p.cliente_id].add(dk);
      });

      clientDeptCombos.forEach(({ c, deptKey, statusKey }) => {
        const iconUrl   = deptIconMap[deptKey] || deptIconMap.otro;
        const deptCfg   = DEPTS.find(d => d.key === deptKey);
        const statusCfg = STATUSES.find(s => s.key === statusKey);
        const accentColor = deptCfg ? deptCfg.color : '#ef4444';
        const clientAllDepts = [...(allClientDeptsVendor[c.id] || new Set([deptKey]))];

        geocoder.geocode({ address: c.direccion }, (results, status) => {
          if (status !== 'OK' || !results[0]) return;

          const marker = new google.maps.Marker({
            map,
            position: results[0].geometry.location,
            title: `${c.nombre || 'Cliente'} (${deptCfg ? deptCfg.label : 'Otro'})`,
            icon: iconUrl,
            visible: true
          });

          allMarkerMeta.push({ marker, deptKey, statusKey, client: c });

          marker.addListener('click', () => {
            openNotePanel(c, clientAllDepts, DEPTS, statusCfg, accentColor);
          });

          bounds.extend(results[0].geometry.location);
          validMarkers++;
          if (validMarkers > 0) {
            map.fitBounds(bounds);
            if (validMarkers === 1) map.setZoom(12);
          }
        });
      });

    } else {
      if (mapEl) mapEl.innerHTML = '<div class="p-6 text-center text-red-500">Error: Google Maps API no está cargada.</div>';
    }
  }, 400);

  // ── Note Panel Logic (outside map setTimeout) ─────────────
  function openNotePanel(c, clientAllDepts, DEPTS, statusCfg, accentColor) {
    const panel = document.getElementById('mapa-note-panel');
    if (!panel) return;

    document.getElementById('np-name').textContent = `${c.nombre} ${c.apellido || ''}`.trim();
    
    // Show ALL dept badges this client belongs to
    const deptBadges = clientAllDepts.map(dk => {
      const cfg = DEPTS.find(d => d.key === dk);
      const color = cfg ? cfg.color : accentColor;
      const label = cfg ? cfg.label : dk;
      return `<span style="font-size:10px; background:${color}20; color:${color}; padding:2px 8px; border-radius:10px; font-weight:700; text-transform:uppercase; border:1px solid ${color}40;">${label}</span>`;
    }).join('');

    document.getElementById('np-badges').innerHTML = `
      ${deptBadges}
      <span style="font-size:10px; background:${statusCfg.color}20; color:${statusCfg.color}; padding:2px 8px; border-radius:10px; font-weight:700; text-transform:uppercase; border:1px solid ${statusCfg.color}40;">${statusCfg.label}</span>
    `;
    document.getElementById('np-details').innerHTML = `
      <span><i class="fa-solid fa-phone"></i> ${c.telefono || 'Sin teléfono'}</span>
      <span><i class="fa-solid fa-location-dot"></i> ${c.direccion || 'Sin dirección'}</span>
    `;

    const textarea = document.getElementById('np-nota');
    textarea.value = c.nota_mapa || '';
    document.getElementById('np-status').textContent = '';

    // Force re-trigger fade animation
    panel.style.animation = 'none';
    panel.style.display = 'block';
    // eslint-disable-next-line no-unused-expressions
    panel.offsetHeight; // reflow
    panel.style.animation = 'npFadeIn 0.18s ease both';

    // Close button
    const closeBtn = document.getElementById('np-close');
    const freshClose = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(freshClose, closeBtn);
    freshClose.addEventListener('click', () => { panel.style.display = 'none'; });

    // Save button
    const saveBtn = document.getElementById('np-save');
    const freshSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(freshSave, saveBtn);
    freshSave.addEventListener('click', async () => {
      const nota = document.getElementById('np-nota').value.trim();
      const statusEl = document.getElementById('np-status');
      freshSave.disabled = true;
      freshSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
      try {
        // Update in-memory
        c.nota_mapa = nota;
        // Persist to DB
        await saveGranular('clientes_maestro', [{ ...c, nota_mapa: nota }]);
        statusEl.style.color = '#22c55e';
        statusEl.textContent = '<i class="fa-solid fa-check text-green-500"></i> Nota guardada correctamente';
        freshSave.innerHTML = '<i class="fas fa-save"></i> Guardar Nota';
        freshSave.disabled = false;
        setTimeout(() => { statusEl.textContent = ''; }, 3000);
      } catch(err) {
        statusEl.style.color = '#ef4444';
        statusEl.textContent = '<i class="fa-solid fa-xmark text-red-500"></i> Error al guardar. Intenta de nuevo.';
        freshSave.innerHTML = '<i class="fas fa-save"></i> Guardar Nota';
        freshSave.disabled = false;
      }
    });
  }
}

