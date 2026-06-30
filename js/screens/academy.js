/* ============================================================
   RENEW SOLAR – screens/academy.js
   ============================================================ */
import { getCurrentUser } from '../app.js';
import { getDB } from '../api.js';
import { t } from '../i18n.js';
let activeAcademyDeptFilter = 'Todos';

// Global helper to safely resolve the dynamic import from the correct module base URL
window.reloadAcademy = () => import('./academy.js').then(m => m.renderAcademy());

export function renderAcademy() {
  const user = getCurrentUser();
  const screen = document.getElementById('screen-academy');
  if (!screen) return;

  const dbLocal = getDB();
  const allContent = dbLocal.academiaContent || [];

  const isHighRole = ['admin', 'administrador', 'ceo'].includes((user.rol || '').toLowerCase());
  const units = isHighRole ? ['Renew Solar', 'Renew Water'] : (user.unidades || ['Renew Solar']).filter(u => u === 'Renew Solar' || u === 'Renew Water');
  let depts = units.map(u => u.replace('Renew ', ''));
  if (depts.length === 0) depts = ['Solar']; // Fallback
  
  if (!depts.includes(activeAcademyDeptFilter)) activeAcademyDeptFilter = depts[0];

  const userPipelines = user.unidades || [];
  const visibleContent = allContent.filter(item => {
    if (item.is_folder) return false;

    let hasAccess = false;
    if (isHighRole) hasAccess = true;
    else if (!item.permisos || item.permisos.length === 0) hasAccess = true;
    else hasAccess = item.permisos.some(p => userPipelines.includes(p));

    if (!hasAccess) return false;

    // Filter by selected tab
    if (activeAcademyDeptFilter !== 'Todos') {
      if (!item.permisos || item.permisos.length === 0) return true;
      const activePipName = 'Renew ' + activeAcademyDeptFilter.replace('Renew ', '');
      return item.permisos.includes(activePipName);
    }
    
    return true;
  });

  if (isHighRole) {
    window.mainAcademyFolder = window.mainAcademyFolder || null;
    let path = [];
    if (window.mainAcademyFolder) {
        let currentId = window.mainAcademyFolder;
        while (currentId) {
            if (currentId.startsWith('cat_')) {
                const cat = currentId.replace('cat_', '');
                const catNames = { video: 'Videos', pdf: 'Documentos', banco: 'Banco de Información', faq: 'Soporte y FAQ', equipo: 'Equipo' };
                path.unshift({ id: currentId, titulo: catNames[cat] || cat.toUpperCase() });
                currentId = null;
            } else {
                const f = allContent.find(x => x.id === currentId);
                if (f) {
                    path.unshift(f);
                    currentId = f.parent_id;
                } else {
                    currentId = null;
                }
            }
        }
    }

    let breadcrumbsHtml = `<span class="cursor-pointer hover:bg-surface-alt py-1 px-3 rounded-lg transition-colors font-bold text-text-muted hover:text-text-primary" onclick="window.mainAcademyFolder=null; window.reloadAcademy()">Inicio</span>`;
    path.forEach((f, idx) => {
        const isLast = idx === path.length - 1;
        breadcrumbsHtml += ` <i class="fa-solid fa-chevron-right text-[0.65rem] opacity-40 mx-1"></i> <span class="cursor-pointer hover:bg-surface-alt py-1 px-3 rounded-lg transition-colors font-bold ${isLast ? 'text-primary' : 'text-text-muted hover:text-text-primary'}" onclick="window.mainAcademyFolder='${f.id}'; window.reloadAcademy()">${f.titulo}</span>`;
    });

    const parentFolderId = path.length > 0 ? path[path.length - 1].parent_id || null : null;
    const upArrowHtml = window.mainAcademyFolder ? 
        `<button class="w-8 h-8 rounded hover:bg-surface-alt flex items-center justify-center text-text-muted transition-colors" onclick="window.mainAcademyFolder='${parentFolderId === null ? '' : parentFolderId}'; if(window.mainAcademyFolder==='') window.mainAcademyFolder=null; window.reloadAcademy()" title="Subir un nivel"><i class="fa-solid fa-arrow-up"></i></button>` 
        : `<button class="w-8 h-8 rounded flex items-center justify-center text-text-muted opacity-30 cursor-not-allowed"><i class="fa-solid fa-arrow-up"></i></button>`;

    const backArrowHtml = window.mainAcademyFolder ? 
        `<button class="w-8 h-8 rounded hover:bg-surface-alt flex items-center justify-center text-text-muted transition-colors" onclick="window.mainAcademyFolder='${parentFolderId === null ? '' : parentFolderId}'; if(window.mainAcademyFolder==='') window.mainAcademyFolder=null; window.reloadAcademy()" title="Atrás"><i class="fa-solid fa-arrow-left"></i></button>`
        : `<button class="w-8 h-8 rounded flex items-center justify-center text-text-muted opacity-30 cursor-not-allowed"><i class="fa-solid fa-arrow-left"></i></button>`;

    const currentItems = allContent.filter(i => {
        if (!window.mainAcademyFolder) {
            if (i.parent_id) return false;
            // Hide legacy files from root
            if (i.is_folder === undefined) return false;
        } else if (window.mainAcademyFolder.startsWith('cat_')) {
            const cat = window.mainAcademyFolder.replace('cat_', '');
            if (i.parent_id === window.mainAcademyFolder) return true;
            if (i.is_folder === undefined) {
                const t = (i.tipo || '').toLowerCase();
                if (cat === 'video' && t.includes('video')) return true;
                if (cat === 'pdf' && (t.includes('pdf') || t.includes('guía') || t.includes('documento'))) return true;
                if (cat === 'banco' && (t.includes('banca') || t.includes('banco'))) return true;
                if (cat === 'faq' && (t.includes('faq') || t.includes('ayuda'))) return true;
                if (cat === 'equipo' && t.includes('equipo')) return true;
            }
            return false;
        } else {
            if (i.parent_id !== window.mainAcademyFolder) return false;
        }

        if (activeAcademyDeptFilter !== 'Todos' && !i.is_folder) {
            if (i.permisos && i.permisos.length > 0) {
                const activePipName = 'Renew ' + activeAcademyDeptFilter.replace('Renew ', '');
                if (!i.permisos.includes(activePipName)) return false;
            }
        }
        return true;
    });

    const folders = currentItems.filter(i => i.is_folder).sort((a,b) => (a.titulo||'').localeCompare(b.titulo||''));
    const files = currentItems.filter(i => !i.is_folder).sort((a,b) => (a.titulo||'').localeCompare(b.titulo||''));

    const getViewerUrl = (url) => {
        if (!url) return '';
        const lowerUrl = url.toLowerCase();
        const officeExts = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
        const isOffice = officeExts.some(ext => lowerUrl.endsWith(ext));
        const isPdf = lowerUrl.endsWith('.pdf');

        if (isOffice) {
            return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
        }
        if (isPdf) {
            return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        }
        return url;
    };

    let itemsHtml = '';
    if (folders.length === 0 && files.length === 0) {
        itemsHtml = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-center bg-surface border border-border rounded-2xl mt-4">
                <i class="fa-solid fa-folder-open text-4xl text-text-muted opacity-30 mb-4"></i>
                <p class="text-text-muted font-bold">${t('academy_empty') || 'Carpeta vacía'}</p>
            </div>
        `;
    }

    folders.forEach(item => {
        let iconHtml = '<i class="fa-solid fa-folder text-xl"></i>';
        let iconBg = 'bg-primary/10';
        let iconColor = 'text-primary';

        itemsHtml += `
            <div class="bg-surface border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all flex flex-col" onclick="window.mainAcademyFolder='${item.id}'; window.reloadAcademy()">
                ${item.miniaturaUrl ? 
                    `<div class="h-32 w-full bg-black relative">
                        <img src="${item.miniaturaUrl}" class="w-full h-full object-cover opacity-80" />
                        <div class="absolute inset-0 flex items-center justify-center">
                            <div class="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center text-white"><i class="fa-solid fa-folder"></i></div>
                        </div>
                    </div>` 
                    : 
                    `<div class="h-32 w-full flex items-center justify-center ${iconBg} ${iconColor}">
                        ${iconHtml}
                    </div>`
                }
                <div class="p-4 flex-1 flex flex-col">
                    <h4 class="m-0 text-text-primary font-bold text-sm leading-tight mb-2 line-clamp-2">${item.titulo || 'Carpeta sin nombre'}</h4>
                    ${item.notas ? `<p class="m-0 text-xs text-text-muted italic line-clamp-2 mb-2">${item.notas}</p>` : ''}
                    <div class="mt-auto flex flex-wrap gap-1">
                        <span class="text-[0.55rem] px-2 py-1 bg-surface-alt border border-border rounded-md uppercase font-black text-text-muted">${allContent.filter(i => i.parent_id === item.id).length} elementos</span>
                    </div>
                </div>
            </div>
        `;
    });

    files.forEach(item => {
        const typeStr = (item.tipo || '').toLowerCase();
        let iconHtml = '<i class="fa-solid fa-file text-xl"></i>';
        let iconBg = 'bg-surface-alt';
        let iconColor = 'text-text-secondary';
        
        if (typeStr.includes('video')) { iconHtml = '<i class="fa-solid fa-play"></i>'; iconBg = 'bg-red-500/10'; iconColor = 'text-red-500'; }
        else if (typeStr.includes('pdf')) { iconHtml = '<i class="fa-solid fa-file-pdf"></i>'; iconBg = 'bg-blue-500/10'; iconColor = 'text-blue-500'; }
        
        itemsHtml += `
            <div class="bg-surface border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all flex flex-col" onclick="window.open('${getViewerUrl(item.enlace)}', '_blank')">
                ${item.miniaturaUrl ? 
                    `<div class="h-32 w-full bg-black relative">
                        <img src="${item.miniaturaUrl}" class="w-full h-full object-cover opacity-80" />
                        <div class="absolute inset-0 flex items-center justify-center">
                            <div class="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center text-white"><i class="fa-solid fa-play"></i></div>
                        </div>
                    </div>` 
                    : 
                    `<div class="h-32 w-full flex items-center justify-center ${iconBg} ${iconColor}">
                        ${iconHtml}
                    </div>`
                }
                <div class="p-4 flex-1 flex flex-col">
                    <h4 class="m-0 text-text-primary font-bold text-sm leading-tight mb-2 line-clamp-2">${item.titulo || 'Documento'}</h4>
                    ${item.notas ? `<p class="m-0 text-xs text-text-muted italic line-clamp-2 mb-2">${item.notas}</p>` : ''}
                    <div class="mt-auto flex flex-wrap gap-1">
                        ${(item.permisos || []).map(p => `<span class="text-[0.55rem] px-2 py-1 bg-surface-alt border border-border rounded-md uppercase font-black text-text-muted">${p}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    });

    const filterHtml = `
        <div class="flex items-center justify-center gap-3 mt-4 mb-8 relative z-10 w-full" id="academy-dept-filters">
          <button class="academy-dept-filter-pill ${activeAcademyDeptFilter === 'Todos' ? 'active' : ''}" data-dept="Todos" style="padding: 8px 24px; border-radius: 9999px; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: 0.3s; ${activeAcademyDeptFilter === 'Todos' ? 'background: var(--primary); color: #000; border: 1px solid var(--primary);' : 'background: transparent; color: var(--text-secondary); border: 1px solid var(--border);'}">TODOS</button>
          ${depts.map(d => `<button class="academy-dept-filter-pill ${activeAcademyDeptFilter === d ? 'active' : ''}" data-dept="${d}" style="padding: 8px 24px; border-radius: 9999px; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: 0.3s; ${activeAcademyDeptFilter === d ? 'background: var(--primary); color: #000; border: 1px solid var(--primary);' : 'background: transparent; color: var(--text-secondary); border: 1px solid var(--border);'}">${d.toUpperCase()}</button>`).join('')}
        </div>
    `;

    let heroCardsHtml = '';
    if (!window.mainAcademyFolder) {
        heroCardsHtml = `
          <!-- Contenedor con ancho limitado para "Respiro" -->
          <div id="academia-menu-principal" class="w-full flex flex-col items-center mb-8">
            <div class="academy-grid px-10">
              
              <!-- Card 1: Videos de Entrenamiento -->
              <div class="academy-hero-card" data-categoria="video" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop'); background-size: cover; background-position: center;">
                <div class="card-overlay" style="padding: 16px;">
                  <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">${t('academy_multimedia')}</span>
                  <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">${t('academy_videos')}</h3>
                </div>
              </div>
              
              <!-- Card 2: PDF -->
              <div class="academy-hero-card" data-categoria="pdf" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=600&auto=format&fit=crop'); background-size: cover; background-position: center;">
                <div class="card-overlay" style="padding: 16px;">
                  <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">${t('academy_recursos')}</span>
                  <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">${t('academy_docs')}</h3>
                </div>
              </div>
              
              <!-- Card 3: Banco -->
              <div class="academy-hero-card" data-categoria="banco" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1554224155-1696413565d3?q=80&w=600&auto=format&fit=crop'); background-size: cover; background-position: center;">
                <div class="card-overlay" style="padding: 16px;">
                  <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">${t('academy_banco')}</span>
                  <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">${t('academy_info')}</h3>
                </div>
              </div>
    
              <!-- Card 4: FAQ -->
              <div class="academy-hero-card" data-categoria="faq" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.85)), url('assets/images/support-bg.png'); background-size: cover; background-position: center;">
                <div class="card-overlay" style="padding: 16px;">
                  <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">${t('academy_soporte')}</span>
                  <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">${t('academy_faq')}</h3>
                </div>
              </div>
    
              <!-- Card 5: Detalles de equipo -->
              <div class="academy-hero-card" data-categoria="equipo" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=600&auto=format&fit=crop'); background-size: cover; background-position: center;">
                <div class="card-overlay" style="padding: 16px;">
                  <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">${t('academy_equipment_label')}</span>
                  <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">${t('academy_equipment')}</h3>
                </div>
              </div>
              
              ${activeAcademyDeptFilter === 'Water' ? `
              <!-- Card 6: Renew Water -->
              <div class="academy-hero-card" data-link="https://renewwaterus.com/" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=600&auto=format&fit=crop'); background-size: cover; background-position: center;">
                <div class="card-overlay" style="padding: 16px;">
                  <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">Página Oficial</span>
                  <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">Renew Water</h3>
                </div>
              </div>
              ` : ''}
              
              ${activeAcademyDeptFilter === 'Solar' ? `
              <!-- Card 7: Renew Solar -->
              <div class="academy-hero-card" data-link="https://www.renewsolarus.com/" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=600&auto=format&fit=crop'); background-size: cover; background-position: center;">
                <div class="card-overlay" style="padding: 16px;">
                  <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">Página Oficial</span>
                  <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">Renew Solar</h3>
                </div>
              </div>
              ` : ''}
            </div>
          </div>
        `;
    }

    screen.innerHTML = `
      <div id="vista-academia" class="w-full min-h-screen pb-32 animate-fadeIn" style="background: var(--bg);">
        <header class="flex flex-col md:flex-row items-center justify-between px-10 py-6 bg-surface border-b border-border shadow-sm gap-4">
            <div>
                <h1 style="color: var(--text-primary); font-size: 1.8rem; font-weight: 950; letter-spacing: -1px; line-height: 1; margin: 0; text-transform: uppercase;">${t('academy_title')}</h1>
                <p style="color: var(--primary); font-size: 0.85rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-top: 6px;">Gestor Avanzado</p>
            </div>
            
            <div class="relative group">
                <button class="px-6 py-2.5 rounded-full font-bold text-sm transition-colors flex items-center gap-2 shadow-lg hover:scale-105" style="background: var(--primary); color: #000;">
                    <i class="fa-solid fa-plus"></i> NUEVO
                </button>
                <div class="absolute right-0 top-full mt-3 w-56 bg-surface border border-border rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden" style="box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                    <button onclick="window.mainCreateFolder()" class="w-full text-left px-5 py-3.5 text-sm font-bold text-text-primary hover:bg-surface-alt transition-colors flex items-center gap-3">
                        <i class="fa-solid fa-folder-plus text-primary text-lg w-5"></i> Crear Carpeta
                    </button>
                    <div class="w-full h-px bg-border"></div>
                    <button onclick="window.mainUploadDoc()" class="w-full text-left px-5 py-3.5 text-sm font-bold text-text-primary hover:bg-surface-alt transition-colors flex items-center gap-3">
                        <i class="fa-solid fa-file-arrow-up text-primary text-lg w-5"></i> Subir Archivo
                    </button>
                </div>
            </div>
        </header>

        ${filterHtml}
        
        <!-- Explorer Nav Bar -->
        <div class="px-10 py-2 flex items-center gap-4 mb-6" id="academy-explorer-nav">
            <div class="flex items-center gap-2">
                ${backArrowHtml}
                ${upArrowHtml}
                <button class="w-9 h-9 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-muted transition-colors" onclick="window.reloadAcademy()" title="Actualizar"><i class="fa-solid fa-rotate-right"></i></button>
            </div>
            <div class="flex-1 flex items-center gap-2 text-sm text-text-primary font-bold">
                <i class="fa-solid fa-folder-open text-primary mr-2 text-lg"></i>
                ${breadcrumbsHtml}
            </div>
        </div>

        ${heroCardsHtml}

        <!-- Sub-Vista (Contenido del Módulo) -->
        <div id="academia-subvista" class="hidden w-full flex flex-col animate-fadeIn academy-main-container">
          <header class="flex items-center justify-between px-8 w-full" style="background: var(--surface); border-bottom: 1px solid var(--border); padding: 18px 20px; box-shadow: var(--shadow-sm); margin-bottom: 30px;">
            <button id="btn-regresar-academia" style="background: var(--surface-alt); border: 1px solid var(--border); color: var(--text-primary); width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; box-shadow: var(--shadow-sm);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h2 id="titulo-subvista" style="color: var(--text-primary); font-size: 1.05rem; font-weight: 950; text-transform: uppercase; letter-spacing: 2.2px; flex: 1; text-align: center; margin-right: 44px;">Categoría</h2>
          </header>
  
          <div id="contenedor-recursos-finales" class="academy-grid px-6">
            <!-- Injected Content -->
          </div>
        </div>

        <div id="academia-gestor-grid" class="px-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            ${itemsHtml}
        </div>
      </div>
      
      <!-- Modals (Injected below) -->
    `;
    
    // Inject Modals for Upload and Create Folder
    if (!document.getElementById('modal-main-academy')) {
        const modalHtml = `
            <div id="modal-main-academy" class="fixed inset-0 z-[999] hidden flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm modal-bg" onclick="document.getElementById('modal-main-academy').classList.add('hidden')"></div>
                <div class="relative bg-surface border border-border rounded-3xl shadow-2xl w-full max-w-md p-8 animate-slideUp">
                    <button class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-alt text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors" onclick="document.getElementById('modal-main-academy').classList.add('hidden')">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <h3 id="modal-main-academy-title" class="text-xl font-black text-text-primary mb-6 uppercase tracking-tight">Subir Documento</h3>
                    
                    <div id="form-main-upload">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-black text-text-muted uppercase tracking-wider mb-2">Título *</label>
                                <input type="text" id="main-aca-titulo" class="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text-primary focus:border-primary outline-none transition-colors" placeholder="Ej. Presentación Q3">
                            </div>
                            
                            <div id="main-aca-file-group">
                                <label class="block text-xs font-black text-text-muted uppercase tracking-wider mb-2">Archivo * (PDF, Video, PPT, DOC)</label>
                                <input type="file" id="main-aca-file" class="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-text-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-surface hover:file:bg-primary-hover transition-colors">
                            </div>
                            
                            <div>
                                <label class="block text-xs font-black text-text-muted uppercase tracking-wider mb-2">Tipo / Etiqueta</label>
                                <select id="main-aca-tipo" class="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text-primary focus:border-primary outline-none transition-colors">
                                    <option value="Video de Entrenamiento">Video</option>
                                    <option value="Documento PDF">Documento PDF</option>
                                    <option value="Información Bancaria">Info Bancaria</option>
                                    <option value="FAQ y Ayuda">FAQ y Ayuda</option>
                                    <option value="Presentación">Presentación</option>
                                </select>
                            </div>
                            
                            <div id="main-aca-thumb-wrap" style="display:none;">
                                <label class="block text-xs font-black text-text-muted uppercase tracking-wider mb-2">Miniatura (Opcional - Imagen)</label>
                                <input type="file" id="main-aca-miniatura" accept="image/*" class="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-text-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-surface hover:file:bg-primary-hover transition-colors">
                            </div>
                            
                            <div>
                                <label class="block text-xs font-black text-text-muted uppercase tracking-wider mb-2">Notas (Opcional)</label>
                                <textarea id="main-aca-notas" class="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text-primary focus:border-primary outline-none transition-colors h-20 resize-none" placeholder="Notas sobre este archivo..."></textarea>
                            </div>

                            <div id="main-aca-permisos-group">
                                <label class="block text-xs font-black text-text-muted uppercase tracking-wider mb-2">Permisos (Pipes) - Dejar vacío para Todos</label>
                                <div class="grid grid-cols-2 gap-2 bg-bg p-3 rounded-xl border border-border" id="main-aca-permisos-list">
                                    <!-- Injected later -->
                                </div>
                            </div>
                        </div>
                        
                        <div id="main-aca-progress" class="hidden mt-4">
                            <div class="flex justify-between text-xs font-bold text-text-muted mb-1">
                                <span>Subiendo...</span>
                                <span id="main-aca-progress-pct">0%</span>
                            </div>
                            <div class="w-full h-2 bg-bg rounded-full overflow-hidden border border-border">
                                <div id="main-aca-progress-fill" class="h-full bg-primary transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>

                        <button id="btn-main-save-academy" class="w-full bg-primary hover:bg-primary-hover text-surface font-black uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20 mt-6 flex items-center justify-center gap-2">
                            <i class="fa-solid fa-save"></i> Guardar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Populate permissions
        const pipes = getDB().Admin_Pipelines || [];
        const permList = document.getElementById('main-aca-permisos-list');
        if (permList) {
            permList.innerHTML = pipes.map(p => `
                <label class="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-surface rounded-lg transition-colors">
                    <input type="checkbox" value="${p.nombre}" class="main-aca-pip-chk rounded text-primary focus:ring-primary bg-surface border-border">
                    <span class="text-xs font-bold text-text-primary truncate">${p.nombre}</span>
                </label>
            `).join('');
        }
        
        document.getElementById('main-aca-tipo').addEventListener('change', (e) => {
            const v = e.target.value.toLowerCase();
            document.getElementById('main-aca-thumb-wrap').style.display = (v.includes('video')) ? 'block' : 'none';
        });

        // Save logic
        document.getElementById('btn-main-save-academy').addEventListener('click', async () => {
            const titulo = document.getElementById('main-aca-titulo').value.trim();
            if (!titulo) return alert('El título es requerido');
            
            const btn = document.getElementById('btn-main-save-academy');
            const isFolder = btn.dataset.isFolder === 'true';
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
            
            try {
                const db = getDB();
                const parentId = window.mainAcademyFolder || null;
                const notas = document.getElementById('main-aca-notas').value.trim() || null;
                
                if (isFolder) {
                    const minInput = document.getElementById('main-aca-miniatura');
                    const minFile = (minInput && minInput.files.length) ? minInput.files[0] : null;
                    let minUrl = null;
                    
                    if (minFile) {
                        const { uploadFile } = await import('../api.js');
                        minUrl = await uploadFile(minFile, 'academia_thumbs', () => {});
                    }

                    const newFolder = {
                        id: 'folder_' + Date.now(),
                        titulo: titulo,
                        tipo: 'Carpeta',
                        enlace: '',
                        miniaturaUrl: minUrl,
                        permisos: [],
                        is_folder: true,
                        parent_id: parentId,
                        notas: notas
                    };
                    db.academiaContent = db.academiaContent || [];
                    db.academiaContent.push(newFolder);
                    const { saveDB } = await import('../api.js');
                    await saveDB(db);
                    
                } else {
                    const fileInput = document.getElementById('main-aca-file');
                    if (!fileInput.files.length) throw new Error('Debes seleccionar un archivo');
                    const file = fileInput.files[0];
                    const minInput = document.getElementById('main-aca-miniatura');
                    const minFile = (minInput && minInput.files.length) ? minInput.files[0] : null;
                    const tipo = document.getElementById('main-aca-tipo').value;
                    const permisos = Array.from(document.querySelectorAll('.main-aca-pip-chk:checked')).map(c => c.value);
                    
                    const progressWrap = document.getElementById('main-aca-progress');
                    const progressFill = document.getElementById('main-aca-progress-fill');
                    const progressPct = document.getElementById('main-aca-progress-pct');
                    progressWrap.classList.remove('hidden');
                    
                    const { uploadFile, saveDB } = await import('../api.js');
                    
                    const fileUrl = await uploadFile(file, 'academia', (pct) => {
                        progressFill.style.width = pct + '%';
                        progressPct.textContent = pct + '%';
                    });
                    
                    let minUrl = null;
                    if (minFile) {
                        minUrl = await uploadFile(minFile, 'academia_thumbs', () => {});
                    }
                    
                    const newDoc = {
                        id: 'doc_' + Date.now(),
                        titulo,
                        tipo,
                        enlace: fileUrl,
                        miniaturaUrl: minUrl,
                        permisos,
                        is_folder: false,
                        parent_id: parentId,
                        notas
                    };
                    
                    db.academiaContent = db.academiaContent || [];
                    db.academiaContent.push(newDoc);
                    await saveDB(db);
                }
                
                document.getElementById('modal-main-academy').classList.add('hidden');
                // Refresh
                window.reloadAcademy();
                alert('Guardado exitosamente');
                
            } catch (err) {
                console.error(err);
                alert('Error: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar';
                document.getElementById('main-aca-progress').classList.add('hidden');
            }
        });
        
        // Expose modal triggers
        window.mainCreateFolder = () => {
            document.getElementById('modal-main-academy-title').innerText = 'NUEVA CARPETA';
            document.getElementById('main-aca-titulo').value = '';
            document.getElementById('main-aca-notas').value = '';
            document.getElementById('main-aca-file-group').style.display = 'none';
            document.getElementById('main-aca-tipo').parentElement.style.display = 'none';
            document.getElementById('main-aca-thumb-wrap').style.display = 'block'; // Allow image upload for folders
            document.getElementById('main-aca-permisos-group').style.display = 'none';
            
            const btn = document.getElementById('btn-main-save-academy');
            btn.dataset.isFolder = 'true';
            document.getElementById('modal-main-academy').classList.remove('hidden');
        };
        
        window.mainUploadDoc = () => {
            document.getElementById('modal-main-academy-title').innerText = 'SUBIR DOCUMENTO';
            document.getElementById('main-aca-titulo').value = '';
            document.getElementById('main-aca-notas').value = '';
            document.getElementById('main-aca-file').value = '';
            document.getElementById('main-aca-miniatura').value = '';
            document.querySelectorAll('.main-aca-pip-chk').forEach(c => c.checked = false);
            
            document.getElementById('main-aca-file-group').style.display = 'block';
            document.getElementById('main-aca-tipo').parentElement.style.display = 'block';
            document.getElementById('main-aca-permisos-group').style.display = 'block';
            document.getElementById('main-aca-tipo').dispatchEvent(new Event('change')); // Trigger thumbnail visibility
            
            const btn = document.getElementById('btn-main-save-academy');
            btn.dataset.isFolder = 'false';
            document.getElementById('modal-main-academy').classList.remove('hidden');
        };
    }
  } else {
    // Normal User View
    screen.innerHTML = `
      <!-- Estructura Base -->
      <div id="vista-academia" class="w-full min-h-screen pb-32" style="background: var(--bg); transition: background 0.3sease;">
        
        <!-- Menú Principal (Hub de Módulos) -->
        <div id="academia-menu-principal" class="w-full flex flex-col animate-fadeIn academy-main-container">
          
          <!-- Header Recto con Separación (Estilo Menú Principal) -->
          <header class="flex flex-col items-center text-center px-10 w-full" style="margin-bottom: 30px; background: var(--surface); padding: 32px 20px 24px; border-bottom: 1px solid var(--border); box-shadow: var(--shadow-sm);">
            <h1 style="color: var(--text-primary); font-size: 1.8rem; font-weight: 950; letter-spacing: -1px; line-height: 1; margin: 0; text-transform: uppercase;">${t('academy_title')}</h1>
            <p style="color: var(--primary); font-size: 0.85rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-top: 6px;">${t('academy_subtitle')}</p>
            <p style="color: var(--text-muted); font-size: 0.75rem; line-height: 1.4; max-width: 250px; margin-top: 12px; font-weight: 500;">
                ${t('academy_team')}
            </p>
  
          </header>
  
          <!-- Filtros de Departamento (Pipeline) -->
          <div id="academy-dept-filter" style="display:flex; justify-content:center; gap:10px; padding:0 30px 20px; overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none;">
            ${depts.map(dept => {
              const isActive = activeAcademyDeptFilter.toLowerCase().includes(dept.toLowerCase()) || (activeAcademyDeptFilter === 'Todos' && dept === 'Todos');
              let color = 'var(--text-secondary)';
              let bg = 'transparent';
              let border = 'var(--border)';
              if (isActive) {
                if (dept === 'Todos') { color = 'var(--primary)'; bg = 'rgba(0, 223, 191, 0.1)'; border = 'var(--primary)'; }
                else if (dept === 'Solar') { color = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.1)'; border = '#f59e0b'; }
                else if (dept === 'Water') { color = '#0ea5e9'; bg = 'rgba(14, 165, 233, 0.1)'; border = '#0ea5e9'; }
                else if (dept === 'Home') { color = '#a855f7'; bg = 'rgba(168, 85, 247, 0.1)'; border = '#a855f7'; }
              }
              return `<button class="academy-dept-filter-pill" data-dept="${dept}" style="padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s; color: ${color}; background: ${bg}; border: 1px solid ${border}; flex-shrink: 0;">${dept.toUpperCase()}</button>`;
            }).join('')}
          </div>
  
          <!-- Contenedor con ancho limitado para "Respiro" -->
          <div class="academy-grid px-10">
            
            <!-- Card 1: Videos de Entrenamiento -->
            <div class="academy-hero-card" data-categoria="video" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop');">
              <div class="card-overlay" style="padding: 16px;">
                <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">${t('academy_multimedia')}</span>
                <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">${t('academy_videos')}</h3>
              </div>
            </div>
  
  
            <!-- Card 2: PDF -->
            <div class="academy-hero-card" data-categoria="pdf" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=600&auto=format&fit=crop');">
              <div class="card-overlay" style="padding: 16px;">
                <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">${t('academy_recursos')}</span>
                <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">${t('academy_docs')}</h3>
              </div>
            </div>
  
  
            <!-- Card 3: Banco -->
            <div class="academy-hero-card" data-categoria="banco" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1554224155-1696413565d3?q=80&w=600&auto=format&fit=crop');">
              <div class="card-overlay" style="padding: 16px;">
                <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">${t('academy_banco')}</span>
                <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">${t('academy_info')}</h3>
              </div>
            </div>
  
  
            <!-- Card 4: FAQ -->
            <div class="academy-hero-card" data-categoria="faq" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.85)), url('assets/images/support-bg.png'); background-size: cover; background-position: center;">
              <div class="card-overlay" style="padding: 16px;">
                <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">${t('academy_soporte')}</span>
                <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">${t('academy_faq')}</h3>
              </div>
            </div>
  
            <!-- Card 5: Detalles de equipo -->
            <div class="academy-hero-card" data-categoria="equipo" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=600&auto=format&fit=crop'); background-size: cover; background-position: center;">
              <div class="card-overlay" style="padding: 16px;">
                <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">${t('academy_equipment_label')}</span>
                <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">${t('academy_equipment')}</h3>
              </div>
            </div>
  
            ${activeAcademyDeptFilter === 'Water' ? `
            <!-- Card 6: Renew Water -->
            <div class="academy-hero-card" data-link="https://renewwaterus.com/" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=600&auto=format&fit=crop'); background-size: cover; background-position: center;">
              <div class="card-overlay" style="padding: 16px;">
                <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">Página Oficial</span>
                <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">Renew Water</h3>
              </div>
            </div>
            ` : ''}
  
            ${activeAcademyDeptFilter === 'Solar' ? `
            <!-- Card 7: Renew Solar -->
            <div class="academy-hero-card" data-link="https://www.renewsolarus.com/" style="border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=600&auto=format&fit=crop'); background-size: cover; background-position: center;">
              <div class="card-overlay" style="padding: 16px;">
                <span class="eyebrow" style="color: var(--primary); font-size: 0.5rem; font-weight: 900; letter-spacing: 2.2px; text-transform: uppercase;">Página Oficial</span>
                <h3 style="color:#fff; font-size: 1.25rem; font-weight: 950; margin-top: 2px; text-transform: uppercase;">Renew Solar</h3>
              </div>
            </div>
            ` : ''}
  
          </div>
        </div>
  
        <!-- Sub-Vista (Contenido del Módulo) -->
        <div id="academia-subvista" class="hidden w-full flex flex-col animate-fadeIn academy-main-container">
          <header class="flex items-center justify-between px-8 w-full" style="background: var(--surface); border-bottom: 1px solid var(--border); padding: 18px 20px; box-shadow: var(--shadow-sm); margin-bottom: 30px;">
            <button id="btn-regresar-academia" style="background: var(--surface-alt); border: 1px solid var(--border); color: var(--text-primary); width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; box-shadow: var(--shadow-sm);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h2 id="titulo-subvista" style="color: var(--text-primary); font-size: 1.05rem; font-weight: 950; text-transform: uppercase; letter-spacing: 2.2px; flex: 1; text-align: center; margin-right: 44px;">Categoría</h2>
          </header>
  
          <div id="contenedor-recursos-finales" class="academy-grid px-6">
            <!-- Injected Content -->
          </div>
        </div>
  
      </div>
    `;
  }

  const menuPrincipal = document.getElementById('academia-menu-principal');
  const subVista = document.getElementById('academia-subvista');
  const btnRegresar = document.getElementById('btn-regresar-academia');
  const tituloSub = document.getElementById('titulo-subvista');
  const contenedorFinal = document.getElementById('contenedor-recursos-finales');
  const gestorGrid = document.getElementById('academia-gestor-grid');
  const explorerNav = document.getElementById('academy-explorer-nav');

  if (document.querySelector('.academy-dept-filter-pill')) {
      document.querySelectorAll('.academy-dept-filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          activeAcademyDeptFilter = pill.dataset.dept === 'Todos' ? 'Todos' : pill.dataset.dept;
          renderAcademy(); 
        });
      });
  }

  const cards = document.querySelectorAll('.academy-hero-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const directLink = card.getAttribute('data-link');
      if (directLink) {
        window.open(directLink, '_blank');
        return;
      }

      const catKey = card.getAttribute('data-categoria');
      const catTitle = card.querySelector('h3').innerText;

      if (isHighRole) {
          window.mainAcademyFolder = 'cat_' + catKey;
          window.reloadAcademy();
          return;
      }

      if (menuPrincipal) menuPrincipal.classList.add('hidden');
      if (gestorGrid) gestorGrid.classList.add('hidden');
      if (explorerNav) explorerNav.classList.add('hidden');
      
      if (subVista) subVista.classList.remove('hidden');

      if (tituloSub) tituloSub.innerText = catTitle;
      renderRecursosFinales(catKey);
    });
  });

  if (btnRegresar) {
      btnRegresar.addEventListener('click', () => {
        if (subVista) subVista.classList.add('hidden');
        if (menuPrincipal) menuPrincipal.classList.remove('hidden');
        if (gestorGrid) gestorGrid.classList.remove('hidden');
        if (explorerNav) explorerNav.classList.remove('hidden');
        if (contenedorFinal) contenedorFinal.innerHTML = '';
      });
  }
      
      function renderRecursosFinales(catKey) {
        const resources = visibleContent.filter(item => {
          const type = (item.tipo || '').toLowerCase();
          if (catKey === 'video') return type.includes('video');
          if (catKey === 'pdf') return type.includes('pdf') || type.includes('guía') || type.includes('documento');
          if (catKey === 'banco') return type.includes('banca') || type.includes('banco');
          if (catKey === 'faq') return type.includes('faq') || type.includes('ayuda');
          if (catKey === 'equipo') return type.includes('equipo');
          return false;
        });

        if (resources.length === 0) {
          contenedorFinal.innerHTML = `
            <div class="flex flex-col items-center justify-center py-28 text-center">
               <div style="width: 80px; height: 80px; border-radius: 24px; background: var(--surface-alt); display: flex; align-items: center; justify-content: center; margin-bottom: 24px; color: var(--text-muted);">
                  <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; opacity: 0.3;"></i>
               </div>
               <p style="color: var(--text-muted); font-weight: 700; font-size: 0.95rem; letter-spacing: -0.2px;">${t('academy_empty')}</p>
            </div>
          `;

          return;
        }

        const getViewerUrl = (url) => {
          if (!url) return '';
          const lowerUrl = url.toLowerCase();
          const officeExts = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
          const isOffice = officeExts.some(ext => lowerUrl.endsWith(ext));
          const isPdf = lowerUrl.endsWith('.pdf');

          if (isOffice) {
            return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
          }
          if (isPdf) {
            return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
          }
          return url;
        };

        contenedorFinal.innerHTML = resources.map(r => {
          if (catKey === 'video') {
            return `
              <div class="video-item" onclick="window.open('${getViewerUrl(r.enlace)}', '_blank')" style="background: var(--surface); border: 1px solid var(--border); border-radius: 24px; overflow: hidden; margin-bottom: 8px; box-shadow: var(--shadow-sm); width: 100%;">
                <div style="width: 100%; height: 160px; position:relative; background: #000;">
                  ${r.miniaturaUrl ? `<img src="${r.miniaturaUrl}" style="width:100%; height:100%; object-fit:cover; opacity:0.85;">` : ''}
                  <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
                    <div style="width:58px; height:58px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; box-shadow: 0 8px 25px rgba(0,223,191,0.4); border: 3px solid rgba(255,255,255,0.3);">
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                         <path d="M8 5v14l11-7z"/>
                       </svg>
                    </div>
                  </div>
                </div>
                <div style="padding: 20px;">
                  <h4 style="margin:0 0 8px; color:var(--text-primary); font-size: 0.95rem; font-weight: 950; line-height: 1.2;">${r.titulo}</h4>
                  ${r.notas ? `<p style="margin: 0 0 10px; font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-style: italic;">${r.notas}</p>` : ''}
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${(r.permisos || []).map(p => `<span style="font-size:0.55rem; padding:4px 10px; background:var(--surface-alt); border: 1px solid var(--border); color:var(--text-secondary); border-radius:8px; font-weight:900; text-transform: uppercase;">${p}</span>`).join('')}
                  </div>
                </div>
              </div>
             `;
          } else {
            // Icono y color predeterminado segun categoria
            let iconSvg = '';
            let iconBg = 'var(--surface-alt)';
            let iconColor = 'var(--primary)';

            if (catKey === 'pdf') {
              iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
              iconColor = '#3b82f6'; // Azul
            } else if (catKey === 'banco') {
              iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
              iconColor = '#8b5cf6'; // Morado
            } else if (catKey === 'equipo') {
              iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
              iconColor = '#ec4899'; // Pink
            } else {
              iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
              iconColor = '#f59e0b'; // Naranja
            }

            return `
              <div class="recurso-item" onclick="window.open('${getViewerUrl(r.enlace)}', '_blank')" style="background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 16px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: 0.2s; box-shadow: var(--shadow-sm); width: 100%; margin-bottom: 8px;">
                <div style="width: 52px; height: 52px; border-radius: 15px; background: ${iconBg}; color: ${iconColor}; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: inset 0 0 10px rgba(0,0,0,0.02);">
                  ${iconSvg}
                </div>
                <div style="flex: 1;">
                  <h4 style="margin:0 0 4px; color:var(--text-primary); font-size: 0.95rem; font-weight: 800; line-height: 1.2;">${r.titulo}</h4>
                  ${r.notas ? `<p style="margin: 0 0 6px; font-size: 0.75rem; color: var(--text-muted); line-height: 1.3; font-style: italic;">${r.notas}</p>` : ''}
                  <p style="margin:0; font-size:0.65rem; color:var(--text-muted); font-weight: 900; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 4px;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: ${iconColor};"></span>
                    ${(r.tipo || '').replace(/Informaci(?:\u00C3\u00B3|\u00f3)n/g, 'Información')}
                  </p>
                </div>
              </div>
            `;
          }
        }).join('');
      }
}
