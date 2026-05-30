/* ============================================================
   RENEW SOLAR – screens/academy.js
   ============================================================ */
import { getCurrentUser } from '../app.js';
import { getDB } from '../api.js';
import { t } from '../i18n.js';
let activeAcademyDeptFilter = 'Todos';

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

  const menuPrincipal = document.getElementById('academia-menu-principal');
  const subVista = document.getElementById('academia-subvista');
  const btnRegresar = document.getElementById('btn-regresar-academia');
  const tituloSub = document.getElementById('titulo-subvista');
  const contenedorFinal = document.getElementById('contenedor-recursos-finales');

  document.querySelectorAll('.academy-dept-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      activeAcademyDeptFilter = pill.dataset.dept === 'Todos' ? 'Todos' : pill.dataset.dept;
      renderAcademy(); 
    });
  });

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

      menuPrincipal.classList.add('hidden');
      subVista.classList.remove('hidden');

      tituloSub.innerText = catTitle;
      renderRecursosFinales(catKey);
    });
  });

  btnRegresar.addEventListener('click', () => {
    subVista.classList.add('hidden');
    menuPrincipal.classList.remove('hidden');
    contenedorFinal.innerHTML = '';
  });

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
          iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`; // Generic equipment/tool or standard icon. Let's use a settings/gear-like or layout icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>` (layout icon) or a tool icon. Let's use a simple box/package icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
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
              <p style="margin:0; font-size:0.65rem; color:var(--text-muted); font-weight: 900; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 4px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${iconColor};"></span>
                ${(r.tipo || '').replace('Información', 'Información')}
              </p>
            </div>
            <div style="color: var(--border);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        `;
      }
    }).join('');
  }
}



