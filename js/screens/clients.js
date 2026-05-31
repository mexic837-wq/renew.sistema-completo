import { getClientesMaestro, createDynamicDeal, updateClientMaestro, getDB, getDeptArray, uploadFile, getAdminWorkers, getCurrentUser } from '../api.js';
// Removed import from ../app.js to break circular dependency
import { showToast } from '../components/toast.js';
import { t } from '../i18n.js';


let editingClientId = null;
let currentClientsTab = 'prospectos'; // 'prospectos' | 'clientes'
let activeDeptFilter = null;

// ── Helpers ──────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días ☀️';
  if (h < 18) return 'Buenas tardes 🌤️';
  return 'Buenas noches <i class="fa-solid fa-moon"></i>';
}

// ── Main render ──────────────────────────────────────────────
export async function renderClients() {
  try {
    const container = document.getElementById('lista-clientes-movil');
    const user = getCurrentUser();
    const isTecnico = user && /t[eé]cn[io]co/i.test(user.rol || '');
    if (!container) return;

    // ── Populate header greeting & avatar ───────────────────
    const greetEl = document.getElementById('clients-greeting-time');
    const nameEl = document.getElementById('clients-greeting-name');
    const avatarEl = document.getElementById('clients-avatar-btn');
    const badgeEl = document.getElementById('clients-pipeline-badge');

    if (greetEl) greetEl.style.display = 'none';
    
    if (badgeEl) {
      const activeUnit = (localStorage.getItem('active_unit') || 'Solar').toLowerCase();
      badgeEl.style.display = 'flex';
      
      let bgColor = 'rgba(245, 158, 11, 0.1)';
      let borderColor = 'rgba(245, 158, 11, 0.2)';
      let textColor = '#f59e0b';
      let icon = '<i class="fas fa-sun"></i>';
      let text = 'Solar';
      
      if (activeUnit.includes('water')) {
        bgColor = 'rgba(14, 165, 233, 0.1)';
        borderColor = 'rgba(14, 165, 233, 0.2)';
        textColor = '#0ea5e9';
        icon = '<i class="fas fa-water"></i>';
        text = 'Water';
      } else if (activeUnit.includes('home')) {
        bgColor = 'rgba(168, 85, 247, 0.1)';
        borderColor = 'rgba(168, 85, 247, 0.2)';
        textColor = '#a855f7';
        icon = '<i class="fas fa-home"></i>';
        text = 'Home';
      }
      
      badgeEl.style.background = bgColor;
      badgeEl.style.borderColor = borderColor;
      badgeEl.style.color = textColor;
      badgeEl.innerHTML = `${icon} <span>${text}</span>`;
    }
    if (nameEl) {
      const fullUserName = user && user.nombre ? user.nombre : (user && user.email ? user.email.split('@')[0] : 'Usuario');
      const firstName = fullUserName.split(' ')[0];
      const titleBase = isTecnico ? (t('clients_title_tech') || 'Mis Citas') : 'Cartera de Clientes';
      nameEl.textContent = isTecnico ? `${titleBase} - ${firstName}` : titleBase;
      console.log('Title updated to:', nameEl.textContent);
    }
    if (avatarEl) {
      if (user.foto) {
        avatarEl.style.backgroundImage = `url(${user.foto})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        avatarEl.style.color = 'transparent';
        avatarEl.style.border = '2px solid rgba(255,255,255,0.2)';
      } else {
        avatarEl.textContent = ((user.nombre ? user.nombre[0] : '') + (user.apellido ? user.apellido[0] : '')).toUpperCase();
      }
    }

    // ── Skeleton ─────────────────────────────────────────────
    container.innerHTML = `
    <div class="skeleton" style="height:120px; border-radius:16px; margin-bottom:12px"></div>
    <div class="skeleton" style="height:120px; border-radius:16px; margin-bottom:12px"></div>
    <div class="skeleton" style="height:120px; border-radius:16px; margin-bottom:12px"></div>
  `;

    if (activeDeptFilter === null) activeDeptFilter = localStorage.getItem('active_unit') || 'Todos';

    // ── Render Department Pills ──────────────────────────────
    const deptContainer = document.getElementById('clients-dept-filter');
    if (deptContainer) {
      const userRolNorm = (user && user.rol || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      const isHighRole = ['admin', 'administrador', 'ceo'].includes(userRolNorm);
      const units = isHighRole ? ['Renew Solar', 'Renew Water', 'Renew Home'] : (user.unidades || ['Renew Solar']);
      
      const depts = ['Todos', ...units.map(u => u.replace('Renew ', ''))];
      
      deptContainer.innerHTML = depts.map(dept => {
        const isActive = activeDeptFilter.toLowerCase().includes(dept.toLowerCase()) || (activeDeptFilter === 'Todos' && dept === 'Todos');
        let color = 'var(--text-secondary)';
        let bg = 'transparent';
        let border = 'var(--border)';
        if (isActive) {
          if (dept === 'Todos') { color = 'var(--primary)'; bg = 'rgba(0, 223, 191, 0.1)'; border = 'var(--primary)'; }
          else if (dept === 'Solar') { color = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.1)'; border = '#f59e0b'; }
          else if (dept === 'Water') { color = '#0ea5e9'; bg = 'rgba(14, 165, 233, 0.1)'; border = '#0ea5e9'; }
          else if (dept === 'Home') { color = '#a855f7'; bg = 'rgba(168, 85, 247, 0.1)'; border = '#a855f7'; }
        }
        return `<button class="dept-filter-pill" data-dept="${dept}" style="padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s; color: ${color}; background: ${bg}; border: 1px solid ${border}; flex-shrink: 0;">${dept.toUpperCase()}</button>`;
      }).join('');

      deptContainer.querySelectorAll('.dept-filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          activeDeptFilter = pill.dataset.dept === 'Todos' ? 'Todos' : 'Renew ' + pill.dataset.dept;
          renderClients(); 
        });
      });
    }

    // ── Search Bar ───────────────────────────────────────────
    let searchHTML = '';
    searchHTML = `
      <div style="padding:0 16px; margin-bottom:12px;">
        <div style="position:relative;">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.85rem;"></i>
          <input id="clients-app-search" type="text" placeholder="Buscar por nombre de cliente..." autocomplete="off"
            style="width:100%;padding:11px 14px 11px 40px;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-primary);font-size:0.82rem;font-weight:600;box-sizing:border-box;outline:none;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
        </div>
      </div>
    `;

    // ── Wire up tab switching ─────────────────────────────────
    document.querySelectorAll('[data-clients-tab]').forEach(btn => {
      const userRolNorm = (user && user.rol || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      const isCallCenter = userRolNorm.includes('call');

      // Update tab labels
      if (isTecnico) {
        const tabKey = btn.dataset.clientsTab;
        btn.textContent = tabKey === 'prospectos' ? t('clients_tab_prospects_tech') : t('clients_tab_clients_tech');
      } else if (isCallCenter) {
        const tabKey = btn.dataset.clientsTab;
        btn.textContent = tabKey === 'prospectos' ? 'Leads Pendientes' : 'Mis Llamadas';
      } else {
        const tabKey = btn.dataset.clientsTab;
        btn.textContent = tabKey === 'prospectos' ? 'Mis Prospectos' : 'Mis Clientes';
      }

      // Remove old listeners by cloning
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', () => {
        document.querySelectorAll('[data-clients-tab]').forEach(b => b.classList.remove('active'));
        fresh.classList.add('active');
        currentClientsTab = fresh.dataset.clientsTab;
        _renderList(user, container);
      });
    });

    // Insert Search Bar after tabs (find parent of tabs)
    const tabsContainer = document.querySelector('.clients-tabs-container') || document.querySelector('[data-clients-tab]')?.parentElement;
    if (tabsContainer && !document.getElementById('clients-app-search-container')) {
      const searchDiv = document.createElement('div');
      searchDiv.id = 'clients-app-search-container';
      searchDiv.innerHTML = searchHTML;
      tabsContainer.parentNode.insertBefore(searchDiv, tabsContainer.nextSibling);

      document.getElementById('clients-app-search')?.addEventListener('input', () => {
        _renderList(user, container);
      });
    }

    // ── Wire "+" nav button → open new prospect modal ────────
    const navPlus = document.getElementById('nav-btn-nuevo-cliente');
    if (navPlus) {
      const freshPlus = navPlus.cloneNode(true);
      navPlus.parentNode.replaceChild(freshPlus, navPlus);
      freshPlus.addEventListener('click', (e) => {
        e.preventDefault();
        editingClientId = null;
        resetModal();
        const title = document.querySelector('#modal-nuevo-cliente h3');
        if (title) title.textContent = 'Nuevo Prospecto';
        const modal = document.getElementById('modal-nuevo-cliente');
        if (modal) modal.style.display = 'flex';

        // Ensure map container is visible and reset loading flag
        const mapCont = document.getElementById('quick-map-container');
        if (mapCont) mapCont.style.display = 'block';
        const dirInput = document.getElementById('quick-direccion');
        if (dirInput) dirInput.dataset.quickMapsLoaded = '';

        if (window.initQuickMaps) setTimeout(window.initQuickMaps, 400);
      });
    }

    // ── Wire modal controls ──────────────────────────────────
    _wireModalControls(user, container);

    // ── Initial list render ──────────────────────────────────
    await _renderList(user, container);
  } catch (err) {
    console.error('Error rendering clients:', err);
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-muted)">
        <i class="fas fa-calendar-check" style="font-size:3rem; margin-bottom:16px; opacity:0.3"></i>
        <h3>Sin citas pendientes</h3>
        <p style="font-size:0.85rem">No tienes visitas pendientes aún.</p>
      </div>
    `;
  }
}

// ── Render client/prospect list ──────────────────────────────
async function _renderList(user, container) {
  const todosClientes = await getClientesMaestro();
  const db = getDB();

  // Sync user profile from DB to get latest permissions/equipo_ids
  if (db && db.Usuarios) {
      const freshUser = db.Usuarios.find(u => u.id === user.id);
      if (freshUser) {
          user = { ...user, ...freshUser };
          try { localStorage.setItem('rs_user', JSON.stringify(user)); } catch(e) {}
      }
  }

  const pipelineToMatch = activeDeptFilter === 'Todos' ? null : activeDeptFilter;
  const activePipelineObj = pipelineToMatch ? (db.Admin_Pipelines || []).find(pip => pip.nombre.toLowerCase().trim() === pipelineToMatch.toLowerCase().trim()) : null;
  const allProys = [...(db.Proyectos_Dinamicos || [])].sort((a,b) => new Date(b.created_at || b.fecha || 0) - new Date(a.created_at || a.fecha || 0));

  const allFases = db.Admin_Fases || [];

  // RBAC filter
  const activeUnit = pipelineToMatch;

  const userRolNorm = (user.rol || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const isHighRole = ['admin', 'administrador', 'ceo'].includes(userRolNorm);
  const isCallCenterRole = userRolNorm.includes('call');

  const misClientes = (todosClientes || []).filter(c => {
    // ── CALL CENTER: only show clients whose active project phase belongs to CC ──
    if (isCallCenterRole) {
      // Find any project for this client that is currently in a CC-assigned phase
      const clientProjects = allProys.filter(p => p.cliente_id === c.id);
      return clientProjects.some(p => {
        const fase = allFases.find(f => f.id === p.fase_id);
        if (!fase) return false;
        const rolFase = (fase.rol_encargado || '').toLowerCase();
        // Check if the phase is assigned to call center
        return rolFase.includes('call');
      });
    }

    // Ownership check for non-CC, non-admin users
    if (!isHighRole) {
      // Find all projects for this client
      const clientProjects = allProys.filter(p => p.cliente_id === c.id);
      
      // For technicians, only show if they are assigned AND the phase corresponds to them
      const isTecnicoOfProject = clientProjects.some(p => {
        if (p.tecnico_id !== user.id) return false;
        const fase = allFases.find(f => f.id === p.fase_id);
        if (!fase) return false;
        const rolFase = (fase.rol_encargado || '').toLowerCase();
        return rolFase.includes('tecnico') || rolFase.includes('técnico');
      });

      // Check if user is responsable or creator of any project
      const isProjectOwner = clientProjects.some(p => 
        String(p.responsable_id) === String(user.id) || 
        String(p.creador_id) === String(user.id)
      );

      // Supervisor logic
      const isSupervisorOfRep = (userRolNorm === 'supervisor' || userRolNorm === 'supervisión') && 
        (user.equipo_ids || []).some(id => 
          String(c.creador_id) === String(id) || 
          (c.responsable_id || '').split(',').map(x=>x.trim()).includes(String(id)) || 
          (c.vendedor_asignado_id || '').split(',').map(x=>x.trim()).includes(String(id)) ||
          clientProjects.some(p => String(p.responsable_id) === String(id) || String(p.creador_id) === String(id))
        );

      if (String(c.creador_id) !== String(user.id) &&
        String(c.responsable_id) !== String(user.id) &&
        String(c.vendedor_asignado_id) !== String(user.id) &&
        String(c.origen_id) !== String(user.id) &&
        String(c.tecnico_id) !== String(user.id) &&
        !isTecnicoOfProject && 
        !isProjectOwner &&
        !isSupervisorOfRep) return false;
    }

    // Pipeline filter (applies to everyone including admins) — multi-dept aware
    if (activeUnit) {
      const activePipeline = activeUnit.toLowerCase().trim();
      const clientDepts = getDeptArray(c).map(d => d.toLowerCase().trim());
      // Legacy single-field fallback
      const legacyDept = (c.empresa || c.departamento || '').toLowerCase().trim();
      const hasNoPipeline = clientDepts.length === 0 && (!legacyDept || legacyDept === 'lead (nuevo)' || legacyDept === '-');
      if (hasNoPipeline) return true; // show unassigned clients everywhere
      // Check if any of the client's departments match the active unit
      const matchesActive = clientDepts.some(d => activePipeline.includes(d) || d.includes(activePipeline.replace('renew ', '')));
      const matchesLegacy = activePipeline.includes(legacyDept) || legacyDept.includes(activePipeline.replace('renew ', ''));
      if (!matchesActive && !matchesLegacy) return false;
    }
    return true;
  });


  // Filter by tab (or merge for technician/call center)
  const isTecnico = user && /t[eé]cn[io]co/i.test(user.rol || '');
  let filtered = [];

  if (isTecnico) {
    // Show everything assigned to them
    filtered = misClientes;
    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } else if (isCallCenterRole) {
    // CC sees only clients whose project is in their phase — already filtered above
    filtered = misClientes;
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } else {
    filtered = misClientes.filter(c => {
      const hasProject = allProys.some(p => p.cliente_id === c.id && (!activePipelineObj || String(p.pipeline_id) === String(activePipelineObj.id)));
      if (currentClientsTab === 'prospectos') return !hasProject;
      return hasProject;
    });
  }

  const searchInput = document.getElementById('clients-app-search');
  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (searchQuery) {
    filtered = filtered.filter(c => (c.nombre || '').toLowerCase().includes(searchQuery));
  }

  console.log('Rendering list for technician:', isTecnico, 'Found:', filtered.length, 'records');

  if (!filtered || filtered.length === 0) {
    const msg = isTecnico
      ? (t('clients_empty_prospects_tech') || 'No tienes visitas pendientes aún.')
      : (currentClientsTab === 'prospectos'
        ? 'No tienes prospectos aún. Presiona <strong>+</strong> para agregar uno.'
        : 'No tienes clientes con proyectos aún.');

    container.innerHTML = `
      <div class="empty-state" style="text-align:center; padding:60px 20px; color:#94a3b8">
        <i class="fas fa-calendar-check" style="font-size:4rem; margin-bottom:20px; opacity:0.4; color:#64748b"></i>
        <h3 style="color:#f1f5f9; margin-bottom:8px; font-size:1.2rem;">${isTecnico ? (t('clients_title_tech') || 'Mis Citas') : 'Sin resultados'}</h3>
        <p style="font-size:0.9rem; max-width:240px; margin:0 auto; opacity:0.8;">${msg}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.flatMap(c => {
    let proysToRender = allProys.filter(p => p.cliente_id === c.id && (!activePipelineObj || String(p.pipeline_id) === String(activePipelineObj.id)));
    if (proysToRender.length === 0 || (currentClientsTab === 'prospectos' && !isTecnico && !isCallCenterRole)) {
      proysToRender = [null];
    }
    return proysToRender.map(proy => {
    let etapaLabel = 'PROSPECTO';
    let progress = 5;
    let rolEncargado = null;
    let enManosDeHtml = '';

    if (proy) {
      const isTerminal = proy.estado === 'Completado' || proy.fase_id === 'Completado' || proy.fase_id === null;
      const fase = allFases.find(f => f.id === proy.fase_id);

      if (isTerminal) {
        etapaLabel = 'COMPLETADO';
        progress = 100;
        rolEncargado = null;
      } else if (fase) {
        etapaLabel = fase.nombre;
        rolEncargado = fase.rol_encargado || null;
        const pipFases = allFases.filter(f => f.pipeline_id === proy.pipeline_id).sort((a, b) => a.orden - b.orden);
        const totalPhases = pipFases.length;
        const currentOrder = fase.orden || 0;
        progress = totalPhases > 0 ? Math.round((currentOrder / totalPhases) * 100) : 50;
      }
    }

    // Determine department badge
    let mainDept = 'Desconocido';
    if (proy && proy.pipeline_id) {
      const pip = (db.Admin_Pipelines || []).find(p => String(p.id) === String(proy.pipeline_id));
      if (pip) mainDept = pip.nombre;
    } else {
      const clientDepts = getDeptArray(c);
      if (clientDepts.length > 0) mainDept = clientDepts[0];
      else mainDept = c.departamento || c.empresa || 'Solar';
    }
    mainDept = mainDept.replace('Renew ', '').trim();
    let deptColor = 'var(--text-muted)';
    let deptBg = 'rgba(0,0,0,0.05)';
    if (mainDept.toLowerCase().includes('solar')) { deptColor = '#f59e0b'; deptBg = 'rgba(245, 158, 11, 0.15)'; mainDept = 'Solar'; }
    else if (mainDept.toLowerCase().includes('water')) { deptColor = '#0ea5e9'; deptBg = 'rgba(14, 165, 233, 0.15)'; mainDept = 'Water'; }
    else if (mainDept.toLowerCase().includes('home')) { deptColor = '#a855f7'; deptBg = 'rgba(168, 85, 247, 0.15)'; mainDept = 'Home'; }
    const deptBadgeHtml = `<span style="font-size:0.55rem; font-weight:900; background:${deptBg}; color:${deptColor}; padding:2px 6px; border-radius:6px; text-transform:uppercase; margin-left:6px; letter-spacing:0.5px; align-self:center;">${mainDept}</span>`;

    const allWorkers = [...(db.Usuarios || [])];
    
    // --- "En manos de" chip ---
    // Show when the current phase's responsible is NOT the vendor (Vendedor)
    if (rolEncargado && !['vendedor', 'representante'].some(r => rolEncargado.toLowerCase().includes(r))) {

      // Helper: find the first worker matching a role (case-insensitive)
      const findByRol = (rolStr) => allWorkers.find(u => u.rol && u.rol.toLowerCase().includes(rolStr.toLowerCase()));
      const workerName = (u) => u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() : '';

      let nombre = '';
      let icon = 'fa-user-shield';
      let color = '#64748b';

      if (rolEncargado.toLowerCase().includes('tecnico') || rolEncargado.toLowerCase().includes('técnico')) {
        const tecnico = proy?.tecnico_id
          ? allWorkers.find(u => u.id === proy.tecnico_id)
          : findByRol('tecnico');
        nombre = workerName(tecnico) || 'Técnico';
        icon = 'fa-tools';
        color = '#0d9488';
      } else if (rolEncargado.toLowerCase().includes('call')) {
        // If there's a specific assigned call center agent, show their name
        const agente = proy?.asignado_a
          ? allWorkers.find(u => u.id === proy.asignado_a)
          : findByRol('call');
        const nombreAgente = workerName(agente);
        nombre = nombreAgente || 'Call Center';
        icon = 'fa-headset';
        color = '#7c3aed';
      } else if (rolEncargado.toLowerCase().includes('admin') || rolEncargado.toLowerCase().includes('oficina')) {
        const admin = findByRol('admin');
        nombre = workerName(admin) || 'Administración';
        icon = 'fa-building';
        color = '#f59e0b';
      } else if (rolEncargado.toLowerCase().includes('financ')) {
        const fin = findByRol('financ');
        nombre = workerName(fin) || 'Financiero';
        icon = 'fa-file-invoice-dollar';
        color = '#2563eb';
      } else if (rolEncargado.toLowerCase() === 'ceo') {
        const ceo = findByRol('ceo');
        nombre = workerName(ceo) || 'CEO';
        icon = 'fa-crown';
        color = '#dc2626';
      } else {
        // Generic: try to find anyone with that role
        const generic = findByRol(rolEncargado);
        nombre = workerName(generic) || rolEncargado;
        icon = 'fa-user';
        color = '#64748b';
      }

      enManosDeHtml = `
        <div style="display:flex; align-items:center; gap:6px; margin-top:8px; padding:6px 10px; background:${color}18; border:1px solid ${color}35; border-radius:8px;">
          <i class="fas ${icon}" style="font-size:10px; color:${color};"></i>
          <span style="font-size:11px; font-weight:700; color:${color};">En manos de: ${nombre}</span>
        </div>
      `;
    }

    const dateStr = c.fecha ? new Date(c.fecha).toLocaleDateString('en-US') : 'Reciente';
    const targetId = proy ? proy.id : null;

    let deleteBtnHtml = '';
      const isDeletableRole = ['admin', 'administrador', 'ceo', 'vendedor', 'representante'].some(r => userRolNorm.includes(r));
      if (isDeletableRole) {
        deleteBtnHtml = `<button class="btn-eliminar-cliente" data-client-id="${c.id}" data-project-id="${targetId}" style="background:rgba(239, 68, 68, 0.1); border:none; color:#ef4444; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:all 0.2s; margin-right:8px;" title="Eliminar Cliente"><i class="fas fa-trash-alt" style="font-size:0.85rem; pointer-events:none;"></i></button>`;
      }

      // Resolve Representative
      let repId = c.vendedor_asignado_id || c.responsable_id || c.creador_id;
      if (proy) repId = proy.responsable_id || proy.creador_id || repId;
      if (repId && String(repId).includes(',')) repId = String(repId).split(',')[0].trim();
      const repUser = allWorkers.find(u => String(u.id) === String(repId));
      const repName = repUser ? (repUser.nombre + ' ' + (repUser.apellido || '')).trim() : (c.vendedor_asignado_nombre || 'Desconocido');

      const repHtml = `
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-user-tie"></i> <span>Rep: <strong>${repName}</strong></span>
        </div>
      `;

      return `
        <div class="deal-card" style="--card-accent:var(--primary); background:var(--surface); border-radius:16px; padding:16px; border-left:4px solid var(--primary); margin-bottom:12px; cursor:pointer;" data-id="${targetId}" data-client-id="${c.id}">
          <div class="deal-card-top" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
               <div class="deal-client-name" style="color:var(--text-primary); font-weight:bold; font-size:1.1rem; display:flex; align-items:center; flex-wrap:wrap; line-height:1.2;">${c.nombre} ${deptBadgeHtml}</div>
               ${repHtml}
            </div>
          <div style="display:flex; align-items:center;">
             ${deleteBtnHtml}
             <span class="badge ${progress === 100 ? 'badge-green' : 'badge-gray'}" style="padding:4px 12px; border-radius:9999px; font-size:0.75rem; font-weight:bold; text-transform:uppercase;">${etapaLabel}</span>
          </div>
        </div>
        
        <div class="deal-progress-wrap" style="margin-bottom:12px;">
          <div class="deal-progress-info" style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-bottom:4px; font-weight:600; text-transform:uppercase;">
            <span>Avance de Proyecto</span>
            <span class="deal-progress-percentage">${progress}%</span>
          </div>
          <div class="deal-progress-bg" style="width:100%; background:var(--surface-alt); height:4px; border-radius:2px; overflow:hidden;">
            <div class="deal-progress-bar" style="width:${progress}%; background:var(--primary); height:100%;"></div>
          </div>
        </div>

        ${enManosDeHtml}

        <div class="deal-card-bottom" style="display:flex; justify-content:space-between; align-items:center; color:var(--text-muted); font-size:0.8rem; margin-top:8px;">
          <div class="deal-date">
            <i class="far fa-calendar-alt" style="margin-right:6px"></i>
            ${dateStr}
          </div>
          <i class="fas fa-chevron-right" style="color:var(--primary)"></i>
        </div>
      </div>
    `;
    });
  }).join('');


  // ── Card click logic ─────────────────────────────────────
  container.querySelectorAll('.deal-card').forEach(card => {
    card.addEventListener('click', () => {
      const clientId = card.dataset.clientId;
      const projectId = card.dataset.id;
      const client = misClientes.find(c => c.id === clientId);

      if (!client) return;

      // If has project → go to project detail
      if (projectId && projectId !== 'null') {
        if (window.appNavigate) window.appNavigate('detail', projectId);
        else window.location.hash = '#detail/' + projectId;
        return;
      }

      // ── CALL CENTER & SUPERVISOR: show read-only lead info (no vendor flow) ──
      const isSupervisor = (userRolNorm === 'supervisor' || userRolNorm === 'supervisión');
      const isOwner = String(client.creador_id) === String(user.id) || 
                      (client.responsable_id || '').split(',').map(x=>x.trim()).includes(String(user.id)) ||
                      (client.vendedor_asignado_id || '').split(',').map(x=>x.trim()).includes(String(user.id));
      
      if (isCallCenterRole || (isSupervisor && !isOwner)) {
        _showCallCenterLeadModal(client, allProys, db);
        return;
      }

      // ── VALIDAR DATOS ANTES DE MOSTRAR PIPELINE SELECTOR (Desactivado por petición: todos los campos opcionales) ──
      /*
      const missingFields = [];
      if (!client.email || client.email.trim() === '') missingFields.push('Email');
      if (!client.telefono || client.telefono.trim() === '') missingFields.push('Teléfono');
      if (!client.direccion || client.direccion.trim() === '') missingFields.push('Dirección');
      if (!client.dob || client.dob === '-' || client.dob.trim() === '') missingFields.push('Fecha de Nacimiento');
      if (!client.licencia || client.licencia === '-' || client.licencia.trim() === '') missingFields.push('Licencia / ID');

      const hasPhoto = (client.adjunto_id_url && client.adjunto_id_url !== 'null' && client.adjunto_id_url !== '-') ||
        (client.foto && client.foto !== 'null');
      if (!hasPhoto) missingFields.push('Foto del ID');

      if (missingFields.length > 0) {
        _showIncompleteDataModal(client, user, missingFields, container);
        return;
      }
      */

      // All data complete → show pipeline selector
      _showPipelineSelector(client, user);
    });
  });

  // ── Delete client logic ──────────────────────────────────
  container.querySelectorAll('.btn-eliminar-cliente').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const clientId = btn.dataset.clientId;
      const client = misClientes.find(c => c.id === clientId);
      if (!client) return;

      if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente al cliente/prospecto ${client.nombre}? Esta acción no se puede deshacer.`)) return;

      try {
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        btn.disabled = true;

        const db = getDB();
        if (db.Clientes_Maestro) {
          db.Clientes_Maestro = db.Clientes_Maestro.filter(c => c.id !== clientId);
        }
        if (db.Proyectos_Dinamicos) {
          db.Proyectos_Dinamicos = db.Proyectos_Dinamicos.filter(p => p.cliente_id !== clientId);
        }
        
        const { saveGranular, deleteRecord } = await import('../api.js');
        await deleteRecord('Clientes_Maestro', clientId);
        
        import('../components/toast.js').then(m => m.showToast('Cliente eliminado', 'success'));
        _renderList(user, container);
      } catch (err) {
        console.error(err);
        import('../components/toast.js').then(m => m.showToast('Error al eliminar cliente', 'error'));
        btn.innerHTML = `<i class="fas fa-trash-alt" style="font-size:0.85rem; pointer-events:none;"></i>`;
        btn.disabled = false;
      }
    });
  });
}

// ── Call Center: read-only lead info modal ───────────────────
function _showCallCenterLeadModal(client, allProys, db) {
  const existing = document.getElementById('modal-cc-lead');
  if (existing) existing.remove();

  // Find any project for this client
  const project = allProys.find(p => p.cliente_id === client.id);
  const allFases = db.Admin_Fases || [];
  const allPipelines = db.Admin_Pipelines || [];

  let pipelineLabel = '';
  let faseLabel = '';
  let faseColor = 'var(--primary)';

  if (project) {
    const pip = allPipelines.find(p => p.id === project.pipeline_id);
    const fase = allFases.find(f => f.id === project.fase_id);
    pipelineLabel = pip ? pip.nombre : '';
    faseLabel = fase ? fase.nombre : '';
  } else {
    // Infer from departamentos_activos or legacy field
    const depts = Array.isArray(client.departamentos_activos) && client.departamentos_activos.length > 0
      ? client.departamentos_activos
      : (client.departamento ? [client.departamento] : []);
    pipelineLabel = depts.length > 0 ? `Renew ${depts[0]}` : 'Sin Pipeline';
    faseLabel = 'Pendiente de asignación';
    faseColor = '#f59e0b';
  }

  // Photo
  const photoUrl = client.adjunto_id_url || client.foto_id || client.foto || '';
  const photoHTML = photoUrl && photoUrl !== 'null' && photoUrl !== '-'
    ? `<img src="${photoUrl}" style="width:100%;max-height:180px;object-fit:cover;border-radius:12px;border:1px solid var(--border);" alt="ID"/>`
    : `<div style="background:var(--surface-alt);border-radius:12px;padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem;">Sin foto de ID adjunta</div>`;

  const modal = document.createElement('div');
  modal.id = 'modal-cc-lead';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(8px);z-index:10000;display:flex;justify-content:center;align-items:flex-end;';
  modal.innerHTML = `
    <div style="background:var(--surface);width:100%;border-radius:32px 32px 0 0;padding:0;max-height:90vh;overflow-y:auto;animation:sheetUp .35s cubic-bezier(0.16,1,0.3,1) both;">
      <div style="width:44px;height:6px;background:rgba(255,255,255,0.12);border-radius:99px;margin:14px auto 0;"></div>

      <!-- Header -->
      <div style="padding:20px 24px 0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h2 style="font-size:1.2rem;font-weight:900;color:var(--text-primary);margin:0;">${client.nombre || 'Sin nombre'}</h2>
          <span style="display:inline-block;margin-top:6px;background:rgba(0,245,212,0.12);color:var(--primary);font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;padding:3px 10px;border-radius:99px;border:1px solid rgba(0,245,212,0.25);">${pipelineLabel}</span>
        </div>
        <button id="btn-cc-lead-close" style="background:var(--surface-alt);border:none;color:var(--text-muted);width:36px;height:36px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-xmark text-red-500"></i></button>
      </div>

      <!-- Phase stepper -->
      <div style="margin:16px 24px 0;background:var(--surface-alt);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:10px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${faseColor};flex-shrink:0;box-shadow:0 0 8px ${faseColor}80;"></div>
        <div>
          <p style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin:0;">Fase Actual</p>
          <p style="font-size:0.95rem;font-weight:800;color:var(--text-primary);margin:2px 0 0;">${faseLabel || 'Sin fase'}</p>
        </div>
      </div>

      <!-- Contact info -->
      <div style="margin:14px 24px 0;background:var(--surface-alt);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px;">
        <p style="font-size:0.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px;">Datos de Contacto</p>
        ${client.telefono ? `
          <div style="display:flex;align-items:center;gap:10px;">
            <a href="tel:${client.telefono}" style="display:flex;align-items:center;gap:10px;text-decoration:none;flex:1;">
              <div style="width:36px;height:36px;border-radius:10px;background:rgba(0,245,212,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div>
                <p style="font-size:0.7rem;color:var(--text-muted);margin:0;">Teléfono</p>
                <p style="font-size:0.95rem;font-weight:700;color:var(--primary);margin:0;">${client.telefono}</p>
              </div>
            </a>
            <a href="tel:${client.telefono}" style="background:var(--primary);color:#0f172a;border:none;border-radius:10px;padding:10px 16px;font-weight:800;font-size:0.82rem;text-decoration:none;flex-shrink:0;">Llamar</a>
          </div>` : ''}
        ${client.email ? `
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(99,102,241,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </div>
            <div>
              <p style="font-size:0.7rem;color:var(--text-muted);margin:0;">Email</p>
              <p style="font-size:0.9rem;font-weight:600;color:var(--text-primary);margin:0;">${client.email}</p>
            </div>
          </div>` : ''}
        ${client.direccion ? `
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(239,68,68,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div>
              <p style="font-size:0.7rem;color:var(--text-muted);margin:0;">Dirección</p>
              <p style="font-size:0.88rem;font-weight:600;color:var(--text-primary);margin:0;">${client.direccion}</p>
            </div>
          </div>` : ''}
        ${client.licencia && client.licencia !== '-' ? `
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(245,158,11,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <div>
              <p style="font-size:0.7rem;color:var(--text-muted);margin:0;">ID / Licencia</p>
              <p style="font-size:0.95rem;font-weight:700;color:var(--text-primary);margin:0;">${client.licencia}</p>
            </div>
          </div>` : ''}
      </div>

      <!-- ID Photo -->
      <div style="margin:14px 24px 24px;">
        <p style="font-size:0.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Foto del ID</p>
        ${photoHTML}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('btn-cc-lead-close').addEventListener('click', () => modal.remove());
}

// ── Incomplete data modal — breaks the loop ──────────────────
function _showIncompleteDataModal(client, user, missingFields, container) {
  const existing = document.getElementById('modal-incomplete-data');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-incomplete-data';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.7); backdrop-filter:blur(8px); z-index:10000; display:flex; justify-content:center; align-items:flex-end;';
  modal.innerHTML = `
    <div style="background:var(--surface); width:100%; border-radius:32px 32px 0 0; padding:0; max-height:80vh; overflow:hidden; display:flex; flex-direction:column; animation: sheetUp 0.35s cubic-bezier(0.16,1,0.3,1) both;">
      <div style="width:44px; height:6px; background:#cbd5e1; border-radius:99px; margin:14px auto; flex-shrink:0;"></div>
      <div style="padding:8px 24px 24px; display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; border-radius:50%; background:#fef3c7; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <span style="font-size:1.3rem;"><i class="fa-solid fa-clipboard"></i></span>
          </div>
          <div>
            <h3 style="font-size:1.1rem; font-weight:800; color:var(--text-primary); margin:0;">Datos Incompletos</h3>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Para crear un proyecto con <strong style="color:var(--primary);">${client.nombre}</strong></p>
          </div>
        </div>
        <div style="background:var(--surface-alt); border-radius:12px; padding:16px; border-left:3px solid #f59e0b;">
          <p style="font-size:0.8rem; font-weight:700; color:#f59e0b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Campos faltantes:</p>
          <ul style="margin:0; padding-left:16px; color:var(--text-secondary); font-size:0.85rem; line-height:1.8;">
            ${missingFields.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>
        <button id="btn-complete-client-data" style="width:100%; background:var(--primary); color:#0f172a; border:none; border-radius:14px; padding:16px; font-weight:800; font-size:1rem; cursor:pointer;"><i class="fa-solid fa-pencil"></i>️ Completar Datos del Cliente</button>
        <button id="btn-cancel-incomplete" style="width:100%; background:transparent; color:var(--text-muted); border:none; padding:8px; font-size:0.9rem; cursor:pointer;">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById('btn-cancel-incomplete').addEventListener('click', () => modal.remove());
  document.getElementById('btn-complete-client-data').addEventListener('click', () => {
    modal.remove();
    // Open edit modal pre-filled with client data
    editingClientId = client.id;
    resetModal();
    document.getElementById('quick-nombre').value = (client.nombre || '').split(' ')[0];
    document.getElementById('quick-apellido').value = (client.nombre || '').split(' ').slice(1).join(' ');
    document.getElementById('quick-tel').value = client.telefono || '';
    document.getElementById('quick-email').value = client.email || '';
    document.getElementById('quick-direccion').value = client.direccion || '';
    const dobEl = document.getElementById('quick-dob');
    if (dobEl) dobEl.value = (client.dob && client.dob !== '-') ? client.dob : '';
    const licEl = document.getElementById('quick-state-id');
    if (licEl) licEl.value = (client.licencia && client.licencia !== '-') ? client.licencia : '';

    // Pre-fill attachments
    quickAdjID = client.adjunto_id_url || null;
    quickAdjBill = client.adjunto_bill_url || null;
    quickAdjSeguro = client.adjunto_seguro_url || null;

    // Update attachment UI
    if (quickAdjID) {
      const btn = document.getElementById('btn-quick-adj-id');
      if (btn) {
        btn.style.background = 'rgba(0,245,212,0.1)';
        btn.style.borderColor = 'var(--primary)';
        const lbl = btn.querySelector('p');
        if (lbl) { lbl.textContent = 'ACTUALIZAR'; lbl.style.color = 'var(--primary)'; }
      }
    }
    if (quickAdjBill) {
      const btn = document.getElementById('btn-quick-adj-bill');
      if (btn) {
        btn.style.background = 'rgba(0,245,212,0.1)';
        btn.style.borderColor = 'var(--primary)';
        const lbl = btn.querySelector('p');
        if (lbl) { lbl.textContent = 'ACTUALIZAR'; lbl.style.color = 'var(--primary)'; }
      }
    }
    if (quickAdjSeguro) {
      const btn = document.getElementById('btn-quick-adj-seguro');
      if (btn) {
        btn.style.background = 'rgba(0,245,212,0.1)';
        btn.style.borderColor = 'var(--primary)';
        const lbl = btn.querySelector('p');
        if (lbl) { lbl.textContent = 'ACTUALIZAR'; lbl.style.color = 'var(--primary)'; }
      }
    }

    const title = document.querySelector('#modal-nuevo-cliente h3');
    if (title) title.textContent = '<i class="fa-solid fa-pencil"></i>️ Completar Datos del Cliente';
    const editModal = document.getElementById('modal-nuevo-cliente');
    if (editModal) editModal.style.display = 'flex';

    // Auto-expand details panel if it's hidden
    const panel = document.getElementById('quick-detalles-adicionales');
    if (panel && (panel.style.display === 'none' || !panel.style.display)) {
      if (window.toggleQuickDetalles) window.toggleQuickDetalles();
      else panel.style.display = 'flex';
    }

    // Reinicializar el mapa al abrir el modal de completar datos
    const dirEl = document.getElementById('quick-direccion');
    if (dirEl) dirEl.dataset.quickMapsLoaded = '';
    
    const geocodeAndCenter = () => {
      if (!window.quickMapInstance || !window.google) return;
      const addr = dirEl ? dirEl.value.trim() : '';
      if (addr && addr !== '') {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: addr }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const loc = results[0].geometry.location;
            window.quickMapInstance.setCenter(loc);
            window.quickMapInstance.setZoom(16);
            if (window.quickMapMarker) {
              window.quickMapMarker.setPosition(loc);
            }
            quickLat = loc.lat(); quickLng = loc.lng();
          }
        });
      }
      google.maps.event.trigger(window.quickMapInstance, 'resize');
    };

    if (window.quickMapInstance) {
      setTimeout(geocodeAndCenter, 500);
    } else if (window.initQuickMaps) {
      setTimeout(window.initQuickMaps, 400);
    }
  });
}

// ── Pipeline selector modal for creating a project ───────────
function _showPipelineSelector(client, user) {
  const db = getDB();
  const allPipelines = db.Admin_Pipelines || [];

  // Filter pipelines the user has access to via their authorized units (unidades)
  const userRole = (user.rol || '').toLowerCase();
  const isHighRole = ['admin', 'administrador', 'ceo'].includes(userRole);
  const userUnidades = user.unidades || [];
  const availablePipelines = allPipelines.filter(pip => {
    if (isHighRole) return true;
    if (userRole === 'project manager' || userRole === 'supervisor' || userRole === 'supervisión') {
        const allowedIds = user.pipeline_ids || [];
        return allowedIds.includes(String(pip.id));
    }
    // Match by pipeline name against user's authorized units
    return userUnidades.some(u => u.toLowerCase().trim() === pip.nombre.toLowerCase().trim());
  });

  // Remove existing modal if any
  const existing = document.getElementById('modal-pipeline-selector');
  if (existing) existing.remove();

  // Get workers for the dropdown
  // Use await? No, _showPipelineSelector is not async, but we can make it async or just use getDB().
  // Wait, getAdminWorkers is async. Let's just use getDB() synchronously to avoid refactoring the caller.
  const dynamicUsers = db.Usuarios || [];
  // MOCK_USERS equivalent since we can't await easily without making callers async
  const mockUsers = [
    { id: 'u1', nombre: 'Carlos', apellido: 'Rodríguez' },
    { id: 'u3', nombre: 'Demo', apellido: 'Vendedor' }
  ];
  const allWorkersMap = new Map();
  mockUsers.forEach(u => allWorkersMap.set(u.id, u));
  dynamicUsers.forEach(u => allWorkersMap.set(u.id, u));
  const deletedIds = db.Deleted_Workers || [];
  const activeWorkers = Array.from(allWorkersMap.values()).filter(u => !deletedIds.includes(u.id));

  const userRoleNorm = (user.rol || '').toLowerCase();
  const isActuallyAdmin = ['admin', 'administrador', 'ceo'].includes(userRoleNorm);

  const repsHTML = `
    <div style="margin-bottom: 20px;">
      <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Representante Asignado</label>
      <select id="pip-selector-rep" style="width:100%; padding:12px; border-radius:12px; background:var(--surface-alt); border:1px solid var(--border); color:var(--text-primary); font-size:0.95rem; outline:none;">
        ${activeWorkers.map(w => `<option value="${w.id}" ${w.id === user.id ? 'selected' : ''}>${w.nombre} ${w.apellido || ''}</option>`).join('')}
      </select>
    </div>
  `;

  const pipelinesHTML = availablePipelines.length > 0
    ? availablePipelines.map(pip => `
        <button class="pip-select-btn" data-pip-id="${pip.id}" data-pip-name="${pip.nombre}" style="
          width:100%; display:flex; align-items:center; gap:14px;
          background:var(--surface-alt); border:1.5px solid var(--border);
          border-radius:14px; padding:16px 18px; cursor:pointer;
          color:var(--text-primary); font-weight:700; font-size:0.95rem;
          transition: border-color 0.2s, background 0.2s; margin-bottom:10px;
        ">
          <span style="width:14px; height:14px; border-radius:50%; background:${pip.color || 'var(--primary)'}; flex-shrink:0; display:inline-block;"></span>
          ${pip.nombre}
          <svg style="margin-left:auto; color:var(--text-muted);" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      `).join('')
    : `<p style="color:var(--text-muted); text-align:center; padding:20px 0;">No tienes pipelines disponibles. Contacta al administrador.</p>`;

  const modal = document.createElement('div');
  modal.id = 'modal-pipeline-selector';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.65); backdrop-filter:blur(8px); z-index:10000; display:flex; justify-content:center; align-items:flex-end;';
  modal.innerHTML = `
    <div style="background:var(--surface); width:100%; border-radius:32px 32px 0 0; padding:0; max-height:90vh; overflow:hidden; display:flex; flex-direction:column; animation: sheetUp 0.35s cubic-bezier(0.16,1,0.3,1) both;">
      <div style="width:44px; height:6px; background:#cbd5e1; border-radius:99px; margin:14px auto; flex-shrink:0;"></div>
      <div style="padding:8px 24px 20px; border-bottom:1px solid var(--border); flex-shrink:0; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-primary); margin:0;">Crear Proyecto</h3>
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Para: <strong style="color:var(--primary);">${client.nombre}</strong></p>
        </div>
        <button id="btn-close-pip-selector" style="background:var(--surface-alt); border:none; color:var(--text-secondary); width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.2rem; cursor:pointer;">&times;</button>
      </div>
      <div style="flex:1; overflow-y:auto; padding:20px 20px 32px;">
        ${isActuallyAdmin ? repsHTML : `<input type="hidden" id="pip-selector-rep" value="${user.id}">`}
        <p style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:16px;">Selecciona el pipeline</p>
        ${pipelinesHTML}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close on backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  document.getElementById('btn-close-pip-selector').addEventListener('click', () => modal.remove());

  // Pipeline selection
  modal.querySelectorAll('.pip-select-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = 'var(--primary)';
      btn.style.background = 'rgba(0,245,212,0.05)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'var(--border)';
      btn.style.background = 'var(--surface-alt)';
    });
    btn.addEventListener('click', async () => {
      const pipName = btn.dataset.pipName;

      // ── VALIDACIÓN COMPLETA AL CONVERTIR PROSPECTO → CLIENTE (Desactivado por petición: todos los campos opcionales) ──
      /*
      const missingClientFields = [];
      if (!client.email || client.email.trim() === '') missingClientFields.push('Email');
      if (!client.telefono || client.telefono.trim() === '') missingClientFields.push('Teléfono');
      if (!client.direccion || client.direccion.trim() === '') missingClientFields.push('Dirección');
      if (!client.dob || client.dob === '-' || client.dob.trim() === '') missingClientFields.push('Fecha de Nacimiento');
      if (!client.licencia || client.licencia === '-' || client.licencia.trim() === '') missingClientFields.push('Licencia / ID');

      const hasPhotoFinal = (client.adjunto_id_url && client.adjunto_id_url !== 'null' && client.adjunto_id_url !== '-') ||
        (client.foto && client.foto !== 'null');

      if (!hasPhotoFinal) missingClientFields.push('Foto del ID');

      if (missingClientFields.length > 0) {
        showToast(
          `<i class="fa-solid fa-triangle-exclamation text-orange-500"></i> Para crear un proyecto, completa los datos del cliente: ${missingClientFields.join(', ')}.`,
          'error'
        );
        return;
      }
      */

      btn.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin:0 auto;"></i>`;
      btn.disabled = true;
      try {
        const repSelect = document.getElementById('pip-selector-rep');
        const selectedRepId = repSelect ? repSelect.value : user.id;

        const result = await createDynamicDeal({
          cliente_id: client.id,
          respuestas: {},
          pipelineName: pipName,
          responsable_id: selectedRepId
        });
        modal.remove();
        showToast(`Proyecto creado en ${pipName}`, 'success');
        if (result && result.id && window.appNavigate) {
          window.appNavigate('detail', result.id);
        } else {
          const container = document.getElementById('lista-clientes-movil');
          if (container && typeof _renderList === 'function') {
            _renderList(user, container);
          } else if (window.renderClientsList) {
            window.renderClientsList();
          } else {
            window.location.reload();
          }
        }
      } catch (err) {
        console.error(err);
        showToast('Error al crear proyecto: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = btn.dataset.pipName;
      }
    });
  });
}

// ── Modal controls wiring ─────────────────────────────────────
let quickLat = null;
let quickLng = null;
let quickAdjID = null;
let quickAdjBill = null;
let quickAdjSeguro = null;

function resetModal() {
  window.quickSelectedClientId = null;
  const btnGuardarQuick = document.getElementById('btn-guardar-quick');
  if (btnGuardarQuick) {
      btnGuardarQuick.innerHTML = 'Guardar';
      btnGuardarQuick.disabled = false;
  }
  const searchInp = document.getElementById('quick-search-existing');
  if(searchInp) { 
      searchInp.value = ''; 
      if (searchInp.parentElement) searchInp.parentElement.style.display = 'flex';
  }
  const searchRes = document.getElementById('quick-search-results');
  if(searchRes) searchRes.style.display = 'none';
  const selChip = document.getElementById('quick-selected-client-chip');
  if(selChip) selChip.style.display = 'none';
  
  ['quick-nombre', 'quick-apellido', 'quick-notas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.disabled = false; }
  });
  const tel = document.getElementById('quick-tel');
  if (tel) { tel.value = '+1 '; tel.disabled = false; }
  const email = document.getElementById('quick-email');
  if (email) { email.value = ''; email.disabled = false; }
  const dir = document.getElementById('quick-direccion');
  if (dir) { dir.value = ''; dir.disabled = false; }
  const dob = document.getElementById('quick-dob');
  if (dob) {
    dob.value = '';
    dob.disabled = false;
    if (dob._flatpickr) {
        dob._flatpickr.clear();
        if (dob._flatpickr.altInput) dob._flatpickr.altInput.disabled = false;
    }
  }
  const dept = document.getElementById('quick-dept');
  if (dept) {
    const activeUnit = (localStorage.getItem('active_unit') || 'Solar').toLowerCase();
    if (activeUnit.includes('water')) dept.value = 'Water';
    else if (activeUnit.includes('home')) dept.value = 'Home';
    else dept.value = 'Solar';
  }

  const lic = document.getElementById('quick-state-id');
  if (lic) lic.value = '';

  quickAdjID = null; quickAdjBill = null; quickAdjSeguro = null;

  document.querySelectorAll('.doc-btn').forEach(btn => {
    btn.style.background = 'var(--bg)';
    btn.style.borderColor = 'var(--border)';
    const label = btn.querySelector('p');
    if (label) {
      label.style.color = 'var(--text-muted)';
      // Restore original labels
      if (btn.id === 'btn-quick-adj-id') label.textContent = 'Foto ID';
      if (btn.id === 'btn-quick-adj-bill') label.textContent = 'Bill';
      if (btn.id === 'btn-quick-adj-seguro') label.textContent = 'Seguro';
    }
  });
  const panelDetalles = document.getElementById('quick-detalles-adicionales');
  const btnToggle = document.getElementById('btn-toggle-quick-detalles');
  if (panelDetalles) panelDetalles.style.display = 'none';
  if (btnToggle) btnToggle.innerHTML = '<i class="fas fa-plus-circle mr-2"></i> Ver más detalles';


  quickLat = null; quickLng = null;
}

function _wireModalControls(user, container) {
  const modalQuick = document.getElementById('modal-nuevo-cliente');
  const btnGuardarQuick = document.getElementById('btn-guardar-quick');
  const btnCancelarQuick = document.getElementById('btn-cancelar-quick');
  const btnCancelBottom = document.getElementById('btn-cancelar-quick-bottom');

  const closeModals = () => { if (modalQuick) modalQuick.style.display = 'none'; };

  if (btnCancelarQuick) {
    const fresh = btnCancelarQuick.cloneNode(true);
    btnCancelarQuick.parentNode.replaceChild(fresh, btnCancelarQuick);
    fresh.addEventListener('click', closeModals);
  }
  if (btnCancelBottom) {
    const fresh = btnCancelBottom.cloneNode(true);
    btnCancelBottom.parentNode.replaceChild(fresh, btnCancelBottom);
    fresh.addEventListener('click', closeModals);
  }

  // File uploads
  const setupUpload = (btnId, inputId, setter) => {
    let btn = document.getElementById(btnId);
    if (!btn) return;
    const freshBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(freshBtn, btn);
    btn = freshBtn;

    const inp = document.getElementById(inputId);
    if (!inp) return;

    btn.addEventListener('click', e => {
      if (e.target === inp) return;
      e.preventDefault();
      e.stopPropagation();
      inp.click();
    });
    inp.addEventListener('change', async (e) => {
      e.stopPropagation();
      const file = inp.files[0];
      if (!file) return;
      try {
        showToast('Subiendo archivo...', 'info');
        const fileUrl = await uploadFile(file, 'clients');
        setter(fileUrl);
        btn.style.background = 'rgba(0,245,212,0.1)';
        btn.style.borderColor = 'var(--primary)';
        const label = btn.querySelector('p');
        if (label) { label.textContent = 'ACTUALIZAR'; label.style.color = 'var(--primary)'; }
        showToast('Archivo subido', 'success');
      } catch (err) {
        showToast('Error al subir archivo', 'error');
      }
    });
  };
  setupUpload('btn-quick-adj-id', 'inp-quick-adj-id', v => { quickAdjID = v; });
  setupUpload('btn-quick-adj-bill', 'inp-quick-adj-bill', v => { quickAdjBill = v; });
  setupUpload('btn-quick-adj-seguro', 'inp-quick-adj-seguro', v => { quickAdjSeguro = v; });

  // ── Existing Client Search ──────────────────────────────────
  const searchInp = document.getElementById('quick-search-existing');
  const searchRes = document.getElementById('quick-search-results');
  const selChip = document.getElementById('quick-selected-client-chip');
  const selName = document.getElementById('quick-selected-client-name');
  const btnClearCli = document.getElementById('btn-quick-clear-client');

  if (searchInp && searchRes && selChip) {
      searchInp.addEventListener('input', (e) => {
          const q = e.target.value.toLowerCase().trim();
          if (q.length < 2) {
              searchRes.style.display = 'none';
              return;
          }
          const db = getDB();
          const matches = (db.Clientes_Maestro || []).filter(c => {
              const qMatch = (c.nombre || '').toLowerCase().includes(q) || (c.telefono || '').toLowerCase().includes(q);
              const est = (c.estado || '').toLowerCase();
              const isClient = est === 'cliente' || est === 'completado' || est === 'en proceso';
              return qMatch && isClient;
          }).slice(0, 5);

          if (matches.length > 0) {
              searchRes.innerHTML = matches.map(c => `
                  <div class="quick-client-suggestion" data-id="${c.id}" style="padding:10px 14px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; align-items:center; gap:10px;">
                      <div style="width:30px; height:30px; border-radius:8px; background:rgba(0,245,212,0.1); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:800;">
                          ${c.nombre ? c.nombre[0].toUpperCase() : '?'}
                      </div>
                      <div>
                          <div style="font-size:0.85rem; font-weight:bold; color:var(--text-primary);">${c.nombre || 'Desconocido'} ${c.apellido || ''}</div>
                          <div style="font-size:0.75rem; color:var(--text-muted);">${c.telefono || '-'}</div>
                      </div>
                  </div>
              `).join('');
              searchRes.style.display = 'block';
              
              searchRes.querySelectorAll('.quick-client-suggestion').forEach(el => {
                  el.addEventListener('click', () => {
                      const cid = el.dataset.id;
                      const cli = matches.find(m => m.id === cid);
                      if (cli) {
                          window.quickSelectedClientId = cid;
                          selName.textContent = `${cli.nombre} ${cli.apellido || ''}`.trim();
                          selChip.style.display = 'flex';
                          searchInp.parentElement.style.display = 'none';
                          searchRes.style.display = 'none';
                          
                          // Autofill and lock fields
                          const full = (cli.nombre || '').split(' ');
                          const fname = full[0] || '';
                          const lname = full.slice(1).join(' ') || (cli.apellido || '');

                          const nom = document.getElementById('quick-nombre'); if(nom) { nom.value = fname; nom.disabled = true; }
                          const ape = document.getElementById('quick-apellido'); if(ape) { ape.value = lname; ape.disabled = true; }
                          const tel = document.getElementById('quick-tel'); if(tel) { tel.value = cli.telefono || ''; tel.disabled = true; }
                          const eml = document.getElementById('quick-email'); if(eml) { eml.value = cli.email || ''; eml.disabled = true; }
                          const dir = document.getElementById('quick-direccion'); if(dir) { dir.value = cli.direccion || ''; dir.disabled = true; }
                          
                          // Formatear DOB a YYYY-MM-DD para <input type="date">
                          const dob = document.getElementById('quick-dob'); 
                          if(dob) { 
                              try {
                                  let dval = (cli.dob && cli.dob !== '-') ? String(cli.dob).trim() : '';
                                  if (dval && !/^\d{4}-\d{2}-\d{2}$/.test(dval)) {
                                      let sep = dval.includes('/') ? '/' : (dval.includes('-') ? '-' : null);
                                      if (sep) {
                                          let parts = dval.split(sep);
                                          if (parts.length === 3) {
                                              let p1 = parseInt(parts[0]), p2 = parseInt(parts[1]), p3 = parseInt(parts[2]);
                                              let y, m, d;
                                              if (p3 > 1000) { y = p3; if (p1 > 12) { d = p1; m = p2; } else { m = p1; d = p2; } } 
                                              else if (p1 > 1000) { y = p1; if (p2 > 12) { d = p2; m = p3; } else { m = p2; d = p3; } }
                                              if (y && m && d) dval = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                                          }
                                      }
                                      if (!/^\d{4}-\d{2}-\d{2}$/.test(dval)) {
                                          let dt = new Date(dval);
                                          if (!isNaN(dt.getTime())) dval = dt.toISOString().split('T')[0];
                                      }
                                  }
                                  if (dob._flatpickr) {
                                      dob._flatpickr.setDate(dval);
                                      if (dob._flatpickr.altInput) dob._flatpickr.altInput.disabled = true;
                                  } else {
                                      dob.value = dval;
                                  }
                                  dob.disabled = true; 
                                  console.log('[DEBUG DOB] Set dob value to', dval);
                              } catch(err) {
                                  console.error('[DEBUG DOB] ERROR:', err);
                                  showToast('DOB Error: ' + err.message, 'error');
                              }
                          }
                          const licInput = document.getElementById('quick-state-id');
                          if (licInput) licInput.value = (data['licenseNumber'] || '');
                          if (licInput) { licInput.value = cli.licencia || ''; licInput.disabled = true; }
                          const nts = document.getElementById('quick-notas'); if(nts) { nts.value = cli.notas || ''; }

                          // Preserve existing documents in global state
                          quickAdjID = cli.adjunto_id_url || null;
                          quickAdjBill = cli.adjunto_bill_url || null;
                          quickAdjSeguro = cli.adjunto_seguro_url || null;

                          // Update document labels visually
                          if (quickAdjID) {
                              const lbl = document.querySelector('#btn-quick-adj-id p');
                              if (lbl) { lbl.textContent = '<i class="fa-solid fa-check text-green-500"></i> CARGADO'; lbl.style.color = 'var(--primary)'; }
                          }
                          if (quickAdjBill) {
                              const lbl = document.querySelector('#btn-quick-adj-bill p');
                              if (lbl) { lbl.textContent = '<i class="fa-solid fa-check text-green-500"></i> CARGADO'; lbl.style.color = 'var(--primary)'; }
                          }
                          if (quickAdjSeguro) {
                              const lbl = document.querySelector('#btn-quick-adj-seguro p');
                              if (lbl) { lbl.textContent = '<i class="fa-solid fa-check text-green-500"></i> CARGADO'; lbl.style.color = 'var(--primary)'; }
                          }
                          

                      }
                  });
              });
          } else {
              searchRes.innerHTML = `<div style="padding:10px 14px; font-size:0.8rem; color:var(--text-muted); text-align:center;">No se encontraron clientes</div>`;
              searchRes.style.display = 'block';
          }
      });

      if (btnClearCli) {
          btnClearCli.addEventListener('click', () => {
              window.quickSelectedClientId = null;
              selChip.style.display = 'none';
              searchInp.parentElement.style.display = 'flex';
              searchInp.value = '';
              
              ['quick-nombre', 'quick-apellido', 'quick-tel', 'quick-email', 'quick-direccion', 'quick-dob', 'quick-notas'].forEach(id => {
                  const el = document.getElementById(id);
                  if (el) { 
                      el.value = id === 'quick-tel' ? '+1 ' : ''; 
                      el.disabled = false; 
                      if (el._flatpickr) {
                          el._flatpickr.clear();
                          if (el._flatpickr.altInput) el._flatpickr.altInput.disabled = false;
                      }
                  }
              });

              // Reset documents
              quickAdjID = null; quickAdjBill = null; quickAdjSeguro = null;
              document.querySelectorAll('.doc-btn p').forEach(p => {
                  if (p.closest('#btn-quick-adj-id')) p.textContent = 'Foto ID';
                  if (p.closest('#btn-quick-adj-bill')) p.textContent = 'Bill';
                  if (p.closest('#btn-quick-adj-seguro')) p.textContent = 'Seguro';
                  p.style.color = 'var(--text-muted)';
              });
          });
      }
  }

  // ── Smart ID Scanner Removed ──────────────────────────────────────

  // Toggle extra details
  window.toggleQuickDetalles = function () {
    const panel = document.getElementById('quick-detalles-adicionales');
    const btn = document.getElementById('btn-toggle-quick-detalles');
    if (!panel || !btn) return;
    if (panel.style.display === 'none' || !panel.style.display) {
      panel.style.display = 'flex';
      btn.innerHTML = '<i class="fas fa-minus-circle mr-2"></i> Ver menos detalles';
      if (window.quickMapInstance) {
        // El mapa ya existe → solo refrescar con un pequeño delay para que el DOM pinte
        setTimeout(() => {
          window.google && google.maps.event.trigger(window.quickMapInstance, 'resize');
          window.quickMapInstance.setCenter(window.quickMapInstance.getCenter());
        }, 150);
      } else if (window.initQuickMaps) {
        // El mapa aún no fue creado → inicializarlo ahora
        setTimeout(window.initQuickMaps, 200);
      }
    } else {
      panel.style.display = 'none';
      btn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i> Ver más detalles';
    }
  };

  // Google Maps
  window.initQuickMaps = () => {
    const dirInput = document.getElementById('quick-direccion');
    const mapContainer = document.getElementById('quick-map-container');
    const mapDiv = document.getElementById('quick-map');
    if (!dirInput || !mapDiv || !mapContainer) return;

    if (!window.google || !window.google.maps || !window.google.maps.places) {
      setTimeout(window.initQuickMaps, 500);
      return;
    }

    // If already initialized, just ensure it's visible and resized
    if (window.quickMapInstance) {
      mapContainer.style.display = 'block';
      setTimeout(() => {
        window.google.maps.event.trigger(window.quickMapInstance, 'resize');
        if (window.quickMapInstance.getCenter()) {
          window.quickMapInstance.setCenter(window.quickMapInstance.getCenter());
        }
      }, 200);
      return;
    }

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

    let map = null;
    let marker = null;
    const defaultCenter = { lat: 25.7617, lng: -80.1918 };

    const initAutocomplete = () => {
      if (dirInput.dataset.autocompleteLoaded === 'true') return;
      dirInput.dataset.autocompleteLoaded = 'true';
      const autocomplete = new window.google.maps.places.Autocomplete(dirInput, {
        types: ['address']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) return;

        if (place.formatted_address) {
          dirInput.value = place.formatted_address;
        } else if (place.name) {
          dirInput.value = place.name;
        }

        ensureMapCreated();
        setTimeout(() => {
          if (window.quickMapInstance) {
            window.google.maps.event.trigger(window.quickMapInstance, 'resize');
            window.quickMapInstance.setCenter(place.geometry.location);
            window.quickMapInstance.setZoom(17);
            if (window.quickMapMarker) window.quickMapMarker.setPosition(place.geometry.location);
            quickLat = place.geometry.location.lat();
            quickLng = place.geometry.location.lng();
          }
        }, 200);
      });
    };
    initAutocomplete();

    const ensureMapCreated = () => {
      if (map) return;
      mapContainer.style.display = 'block';
      map = new window.google.maps.Map(mapDiv, {
        center: defaultCenter,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
        styles: darkMapStyle
      });
      window.quickMapInstance = map;
      marker = new window.google.maps.Marker({
        map,
        position: defaultCenter,
        draggable: true,
        animation: window.google.maps.Animation.DROP
      });
      window.quickMapMarker = marker;

      const geocoder = new google.maps.Geocoder();
      const updateAddressFromLatLng = (latLng) => {
        geocoder.geocode({ location: latLng }, (results, status) => {
          if (status === 'OK' && results[0]) {
            dirInput.value = results[0].formatted_address;
          }
        });
      };

      // Geocodificar dirección existente si hay una
      if (dirInput.value && dirInput.value.trim() !== '') {
        geocoder.geocode({ address: dirInput.value }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const loc = results[0].geometry.location;
            map.setCenter(loc);
            marker.setPosition(loc);
            quickLat = loc.lat(); quickLng = loc.lng();
          }
        });
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          map.panTo(userLoc);
          marker.setPosition(userLoc);
          quickLat = userLoc.lat; quickLng = userLoc.lng;
        }, () => { }, { timeout: 3000 });
      }

      map.addListener('click', e => {
        marker.setPosition(e.latLng);
        map.panTo(e.latLng);
        quickLat = e.latLng.lat(); quickLng = e.latLng.lng();
        marker.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 300);
        updateAddressFromLatLng(e.latLng);
      });

      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        quickLat = pos.lat(); quickLng = pos.lng();
        updateAddressFromLatLng(pos);
      });

      setTimeout(() => {
        google.maps.event.trigger(map, 'resize');
        if (!dirInput.value || dirInput.value.trim() === '') {
          map.setCenter(defaultCenter);
        }
      }, 200);
    };

    // Inicializar el mapa inmediatamente al abrir el modal (no esperar al focus)
    ensureMapCreated();

    dirInput.addEventListener('focus', () => {
      ensureMapCreated(); // seguridad por si no se creó antes
      if (map) {
        setTimeout(() => {
          google.maps.event.trigger(map, 'resize');
          map.setCenter(map.getCenter());
        }, 150);
      }
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;

      // Update input text if place has formatted_address
      if (place.formatted_address) {
        dirInput.value = place.formatted_address;
      } else if (place.name) {
        dirInput.value = place.name;
      }

      ensureMapCreated();
      setTimeout(() => {
        google.maps.event.trigger(map, 'resize');
        map.setCenter(place.geometry.location);
        map.setZoom(17);
        marker.setPosition(place.geometry.location);
        quickLat = place.geometry.location.lat();
        quickLng = place.geometry.location.lng();
      }, 200);
    });

    // Fix for mobile: Google Places sometimes requires a double tap or fails on mobile touch
    setTimeout(() => {
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach(container => {
        container.addEventListener('touchstart', (e) => {
          e.stopImmediatePropagation();
        }, { passive: true });
      });
    }, 1000);
  };

  // Save button
  if (btnGuardarQuick) {
    const newBtnSave = btnGuardarQuick.cloneNode(true);
    btnGuardarQuick.parentNode.replaceChild(newBtnSave, btnGuardarQuick);
    newBtnSave.addEventListener('click', async () => {
      const nombre = document.getElementById('quick-nombre').value.trim();
      const apellido = document.getElementById('quick-apellido').value.trim();
      const tel = document.getElementById('quick-tel').value.trim();
      const email = document.getElementById('quick-email').value.trim();
      const dir = document.getElementById('quick-direccion').value.trim();
      const dob = document.getElementById('quick-dob')?.value || '';
      const licencia = document.getElementById('quick-state-id')?.value.trim() || '-';
      let dept = document.getElementById('quick-dept')?.value || 'Solar';

      // Auto-correct dept if it's default but we are in a specific unit
      const activeUnit = (localStorage.getItem('active_unit') || '').toLowerCase();
      if (dept === 'Solar' && activeUnit.includes('water')) dept = 'Water';
      if (dept === 'Solar' && activeUnit.includes('home')) dept = 'Home';

      const notas = document.getElementById('quick-notas')?.value.trim() || '';
      
      // Validation (Desactivado por petición: todos los campos opcionales)
      /*
      if (!nombre) { showToast('El Nombre es obligatorio', 'error'); return; }
      if (!apellido) { showToast('El Apellido es obligatorio', 'error'); return; }
      if (tel.length < 5) { showToast('El Teléfono es obligatorio', 'error'); return; }
      if (!dir) { showToast('La Dirección es obligatoria', 'error'); return; }
      */

      if (!nombre && !apellido && !tel) {
         showToast('Al menos pon un nombre o teléfono para identificarlo', 'warning');
      }

      try {
        newBtnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        newBtnSave.disabled = true;

        const fullNombre = apellido ? `${nombre} ${apellido}` : nombre;

        if (editingClientId) {
          await updateClientMaestro(editingClientId, {
            nombre: fullNombre, email, telefono: tel, direccion: dir,
            dob: dob || '-',
            licencia,
            notas,
            adjunto_id_url: quickAdjID,
            adjunto_bill_url: quickAdjBill,
            adjunto_seguro_url: quickAdjSeguro,
          });
          showToast('Datos del cliente actualizados', 'success');
        } else {
          // If we selected an existing client to create a new prospect
          if (window.quickSelectedClientId) {
             await updateClientMaestro(window.quickSelectedClientId, {
                nombre: fullNombre, email, telefono: tel, direccion: dir,
                dob: dob || '-',
                licencia,
                notas,
                departamento: dept,
                adjunto_id_url: quickAdjID,
                adjunto_bill_url: quickAdjBill,
                adjunto_seguro_url: quickAdjSeguro,

             });
             
             closeModals();
             
             const db = getDB();
             const updatedClient = db.Clientes_Maestro.find(c => c.id === window.quickSelectedClientId);
             if (updatedClient) {
                 _showPipelineSelector(updatedClient, user);
             }
             return; // Halt here so we don't clear the loading state prematurely
          }

          // If completely new client
          await createDynamicDeal({
            cliente_id: null,
            cliente: {
              nombre: fullNombre, email, telefono: tel,
              direccion: dir,
              zip: 'Pendiente', dob: dob || '-',
              licencia,
              departamento: dept, empresa: dept,
              estado: 'Lead',
              adjunto_id_url: quickAdjID, adjunto_bill_url: quickAdjBill,
              adjunto_seguro_url: quickAdjSeguro,
              notas, fecha: new Date().toISOString()
            },
            respuestas: {},
            pipelineName: null,
            responsable_id: user.id
          });
          showToast('Prospecto guardado con éxito <i class="fa-solid fa-check text-green-500"></i>', 'success');
        }

        closeModals();
        // Refresh list
        const container2 = document.getElementById('lista-clientes-movil');
        if (container2) await _renderList(user, container2);
        if (window.appNavigate) {
            window.appNavigate('clients');
            setTimeout(() => {
                const tabProsp = document.getElementById('clients-tab-prospectos');
                if (tabProsp) tabProsp.click();
            }, 100);
        }
      } catch (err) {
        console.error(err);
        showToast('Error al guardar: ' + err.message, 'error');
      } finally {
        newBtnSave.innerHTML = 'Guardar';
        newBtnSave.disabled = false;
      }
    });
  }
}

window.openNuevoProspectoGlobal = () => {
    editingClientId = null;
    resetModal();
    const title = document.querySelector('#modal-nuevo-cliente h3');
    if (title) title.textContent = 'Nuevo Prospecto';
    const modal = document.getElementById('modal-nuevo-cliente');
    if (modal) modal.style.display = 'flex';

    const mapCont = document.getElementById('quick-map-container');
    if (mapCont) mapCont.style.display = 'block';
    const dirInput = document.getElementById('quick-direccion');
    if (dirInput) dirInput.dataset.quickMapsLoaded = '';

    if (window.initQuickMaps) setTimeout(window.initQuickMaps, 400);

    const user = getCurrentUser();
    const container = document.getElementById('lista-clientes-movil');
    _wireModalControls(user, container);
};
