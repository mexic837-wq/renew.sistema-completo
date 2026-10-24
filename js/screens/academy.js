/* ============================================================
   RENEW SOLAR – screens/academy.js
   ============================================================ */
import { getCurrentUser } from '../app.js';
import { getDB } from '../api.js';
import { t } from '../i18n.js';
let activeAcademyDeptFilter = '';

/* ============================================================
   Apertura de archivos de Academia
   - Excel / CSV: directo a Google Sheets (se copia al Drive de la persona)
   - Word: visor propio con su formato original
   - PDF, imágenes, videos: el navegador los muestra solo
   ============================================================ */
const _loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[data-lib="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.dataset.lib = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
});
const _escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const _googleOpenUrl = (absUrl, name) => `/abrir-google.html?src=${encodeURIComponent(absUrl)}&name=${encodeURIComponent(name)}`;

/* ============================================================
   Diseño de Sala Virtual (moderno y minimalista)
   ============================================================ */
const _AC_CSS = `
.ac-root{min-height:100vh;background:var(--bg);}
.ac-wrap{max-width:1180px;margin:0 auto;padding:36px 32px 120px;}
@media(max-width:640px){.ac-wrap{padding:20px 16px 120px;}}
.ac-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:28px;}
.ac-title{font-size:1.75rem;font-weight:800;letter-spacing:-.03em;color:var(--text-primary);margin:0;line-height:1.1;}
.ac-sub{color:var(--text-muted);font-size:.9rem;margin:6px 0 0;font-weight:500;}
.ac-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.ac-seg{display:inline-flex;padding:4px;background:var(--surface-alt);border:1px solid var(--border);border-radius:12px;gap:2px;}
.ac-seg button{border:0;background:transparent;color:var(--text-muted);font-weight:700;font-size:.8rem;padding:7px 16px;border-radius:9px;cursor:pointer;transition:.15s;}
.ac-seg button:hover{color:var(--text-primary);}
.ac-seg button.active{background:var(--surface);color:var(--text-primary);box-shadow:0 1px 3px rgba(0,0,0,.1);}
.ac-btn-primary{display:inline-flex;align-items:center;gap:8px;background:var(--primary);color:#04201b;border:0;border-radius:12px;padding:10px 16px;font-weight:700;font-size:.85rem;cursor:pointer;transition:.15s;}
.ac-btn-primary:hover{filter:brightness(.95);}
.ac-menu{position:relative;}
.ac-menu-list{position:absolute;right:0;top:calc(100% + 8px);min-width:210px;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.14);padding:6px;z-index:50;display:none;}
.ac-menu.open .ac-menu-list{display:block;}
.ac-menu-list button{width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:0;background:none;border-radius:10px;font-size:.85rem;font-weight:600;color:var(--text-primary);cursor:pointer;text-align:left;}
.ac-menu-list button:hover{background:var(--surface-alt);}
.ac-menu-list i{width:18px;color:var(--text-muted);}
.ac-bar{display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;}
.ac-nav{display:flex;gap:6px;}
.ac-icon-btn{width:34px;height:34px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.8rem;transition:.15s;flex-shrink:0;}
.ac-icon-btn:hover:not(:disabled){background:var(--surface-alt);color:var(--text-primary);}
.ac-icon-btn:disabled{opacity:.35;cursor:default;}
.ac-crumbs{display:flex;align-items:center;gap:2px;flex:1;min-width:0;font-size:.875rem;overflow-x:auto;white-space:nowrap;scrollbar-width:none;}
.ac-crumbs span{padding:6px 8px;border-radius:8px;color:var(--text-muted);font-weight:600;cursor:pointer;}
.ac-crumbs span:hover{background:var(--surface-alt);color:var(--text-primary);}
.ac-crumbs span.cur{color:var(--text-primary);cursor:default;background:none;}
.ac-crumbs i{font-size:.55rem;color:var(--text-muted);opacity:.6;}
.ac-search{position:relative;width:240px;max-width:100%;}
.ac-search input{width:100%;height:36px;border:1px solid var(--border);background:var(--surface);border-radius:10px;padding:0 12px 0 34px;font-size:.85rem;color:var(--text-primary);outline:none;transition:.15s;}
.ac-search input:focus{border-color:var(--primary);}
.ac-search i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:.8rem;pointer-events:none;}
@media(max-width:640px){.ac-search{width:100%;}}
.ac-subhead{margin:0;font-size:1.15rem;font-weight:750;color:var(--text-primary);letter-spacing:-.01em;}
.ac-label{font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);margin:4px 0 12px;}
.ac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-bottom:28px;}
.ac-ico{--c:#64748b;width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--c);background:color-mix(in srgb,var(--c) 13%,transparent);font-size:1rem;}
.ac-txt{min-width:0;flex:1;}
.ac-txt h3,.ac-txt h4{margin:0;font-size:.9rem;font-weight:650;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.01em;}
.ac-txt p{margin:2px 0 0;font-size:.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ac-cat,.ac-item{position:relative;display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);cursor:pointer;transition:.18s;min-width:0;}
.ac-cat{padding:16px;border-radius:16px;}
.ac-item{padding:12px 14px;border-radius:14px;}
.ac-cat:hover,.ac-item:hover,.ac-media:hover{border-color:color-mix(in srgb,var(--primary) 45%,var(--border));box-shadow:0 6px 20px rgba(0,0,0,.06);transform:translateY(-1px);}
.ac-cat .ac-ico{width:44px;height:44px;border-radius:12px;font-size:1.1rem;}
.ac-go{margin-left:auto;color:var(--text-muted);font-size:.7rem;opacity:.6;}
.ac-thumb{width:40px;height:40px;border-radius:11px;object-fit:cover;flex-shrink:0;background:var(--surface-alt);}
.ac-del{width:30px;height:30px;border-radius:8px;border:0;background:transparent;color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:.15s;flex-shrink:0;}
.ac-item:hover .ac-del,.ac-del:focus{opacity:1;}
.ac-del:hover{background:rgba(239,68,68,.1);color:#ef4444;}
@media(hover:none){.ac-del{opacity:1;}}
.ac-media{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:.18s;}
.ac-cover{aspect-ratio:16/9;background:#0b0b0b center/cover no-repeat;display:flex;align-items:center;justify-content:center;}
.ac-play{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.92);color:#111;display:flex;align-items:center;justify-content:center;font-size:.85rem;box-shadow:0 4px 14px rgba(0,0,0,.25);}
.ac-media .ac-txt{padding:12px 14px;}
.ac-empty{grid-column:1/-1;text-align:center;padding:56px 16px;border:1px dashed var(--border);border-radius:16px;color:var(--text-muted);font-size:.9rem;font-weight:500;}
.ac-empty i{font-size:1.6rem;opacity:.4;margin-bottom:10px;display:block;}
`;
const _acInjectCss = () => {
    if (document.getElementById('ac-css')) return;
    const s = document.createElement('style');
    s.id = 'ac-css'; s.textContent = _AC_CSS;
    document.head.appendChild(s);
    // Cierra el menú "Nuevo" al hacer clic fuera
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.ac-menu.open').forEach(m => { if (!m.contains(e.target)) m.classList.remove('open'); });
    });
};

const _acFileMeta = (item) => {
    const ext = (item.enlace || '').split('?')[0].split('.').pop().toLowerCase();
    const tipo = (item.tipo || '').toLowerCase();
    if (tipo === 'nota') return { isNote: true, icon: 'fa-note-sticky', c: '#0d9488', label: 'Nota' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { isImage: true, icon: 'fa-image', c: '#8b5cf6', label: 'Imagen' };
    if (['mp4', 'mov', 'avi', 'webm', 'm4v'].includes(ext) || tipo.includes('video')) return { isVideo: true, icon: 'fa-play', c: '#ef4444', label: 'Video' };
    const excel = ['fa-file-excel', '#16a34a', 'Excel · se abre en Google Sheets'];
    const word = ['fa-file-word', '#2563eb', 'Word'];
    const ppt = ['fa-file-powerpoint', '#ea580c', 'PowerPoint'];
    const map = { pdf: ['fa-file-pdf', '#dc2626', 'PDF'], xlsx: excel, xls: excel, xlsm: excel, csv: ['fa-file-csv', '#16a34a', 'CSV · se abre en Google Sheets'], docx: word, doc: word, pptx: ppt, ppt };
    const [icon, c, label] = map[ext] || ['fa-file-lines', '#64748b', ext && ext.length <= 5 ? ext.toUpperCase() : 'Archivo'];
    return { icon, c, label };
};
const _acTitle = (item, m) => {
    if (item.titulo && item.titulo !== 'null') return item.titulo;
    if (m.isNote) return 'Nota';
    const file = decodeURIComponent((item.enlace || '').split('?')[0].split('/').pop() || '').replace(/^\d{10,}_/, '');
    return file || (m.isImage ? 'Imagen' : 'Documento');
};
const _acItem = ({ onclick = '', cls = '', attrs = '', thumb, ico, c, title, meta, delId }) => `
    <div class="ac-item academy-card ${cls}" ${attrs} ${onclick ? `onclick="${onclick}"` : ''} data-search="${_escHtml(String(title || '').toLowerCase())}">
        ${thumb ? `<img class="ac-thumb" src="${_escHtml(thumb)}" alt="" loading="lazy">` : `<div class="ac-ico" style="--c:${c}"><i class="fa-solid ${ico}"></i></div>`}
        <div class="ac-txt"><h4>${_escHtml(title)}</h4>${meta ? `<p>${_escHtml(meta)}</p>` : ''}</div>
        ${delId ? `<button class="ac-del" title="Eliminar" onclick="event.stopPropagation(); if(confirm('¿Eliminar esto de forma permanente?')) window.deleteAcademyItem('${delId}', this);"><i class="fa-solid fa-trash-can text-xs"></i></button>` : ''}
    </div>`;
const _acEmpty = (text) => `<div class="ac-empty"><i class="fa-regular fa-folder-open"></i>${_escHtml(text)}</div>`;

const _acHeaderHtml = (depts, active, extra = '') => `
    <div class="ac-head">
        <div>
            <h1 class="ac-title">${t('academy_title')}</h1>
            <p class="ac-sub">${t('academy_team')}</p>
        </div>
        <div class="ac-actions">
            ${depts.length > 1 ? `<div class="ac-seg">${depts.map(d => `<button class="academy-dept-filter-pill ${d === active ? 'active' : ''}" data-dept="${d}">${d}</button>`).join('')}</div>` : ''}
            ${extra}
        </div>
    </div>`;

const _acCatsHtml = (dept) => {
    const cap = (s) => s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
    const cats = [
        { key: 'video', ico: 'fa-circle-play', c: '#ef4444', title: t('academy_videos'), sub: t('academy_multimedia') },
        { key: 'pdf', ico: 'fa-book-open', c: '#3b82f6', title: t('academy_docs'), sub: t('academy_recursos') },
        { key: 'banco', ico: 'fa-building-columns', c: '#8b5cf6', title: t('academy_info'), sub: t('academy_banco') },
        { key: 'faq', ico: 'fa-circle-question', c: '#f59e0b', title: t('academy_faq'), sub: t('academy_soporte') },
        { key: 'equipo', ico: 'fa-solar-panel', c: '#ec4899', title: t('academy_equipment'), sub: t('academy_equipment_label') },
    ];
    const site = dept === 'Water' ? { link: 'https://renewwaterus.com/', title: 'Renew Water' }
        : dept === 'Solar' ? { link: 'https://www.renewsolarus.com/', title: 'Renew Solar' } : null;
    return cats.map(k => `
        <div class="ac-cat" data-categoria="${k.key}" data-search="${_escHtml(k.title.toLowerCase())}">
            <div class="ac-ico" style="--c:${k.c}"><i class="fa-solid ${k.ico}"></i></div>
            <div class="ac-txt"><h3>${k.title}</h3><p>${cap(k.sub)}</p></div>
            <i class="fa-solid fa-chevron-right ac-go"></i>
        </div>`).join('')
        + (site ? `
        <div class="ac-cat" data-link="${site.link}" data-search="${site.title.toLowerCase()}">
            <div class="ac-ico" style="--c:#0d9488"><i class="fa-solid fa-globe"></i></div>
            <div class="ac-txt"><h3>${site.title}</h3><p>Página oficial</p></div>
            <i class="fa-solid fa-arrow-up-right-from-square ac-go"></i>
        </div>` : '');
};

window.filterAcademyItems = (q) => {
    q = q.trim().toLowerCase();
    document.querySelectorAll('#vista-academia [data-search]').forEach(el => {
        el.style.display = !q || el.dataset.search.includes(q) ? '' : 'none';
    });
};

window.openAcademyFile = async (url, title) => {
    if (!url) return;
    const clean = url.split('?')[0].split('#')[0].toLowerCase();
    const ext = clean.split('.').pop();
    const absUrl = new URL(url, location.href).href;
    const name = title || decodeURIComponent(clean.split('/').pop());

    if (['xlsx', 'xls', 'xlsm', 'csv'].includes(ext)) {
        return window.open(_googleOpenUrl(absUrl, name), '_blank');
    }
    if (ext !== 'docx') {
        if (['pptx', 'ppt', 'doc'].includes(ext)) {
            return window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`, '_blank');
        }
        return window.open(url, '_blank');
    }

    document.getElementById('academy-doc-viewer')?.remove();
    const modal = document.createElement('div');
    modal.id = 'academy-doc-viewer';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:12px;';
    modal.innerHTML = `
      <div style="background:var(--surface,#fff);color:var(--text-primary,#111);border-radius:16px;width:100%;max-width:1400px;height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);">
        <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border,#ddd);">
          <strong style="flex:1;font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_escHtml(name)}</strong>
          <a href="${_escHtml(`ms-word:ofe|u|${absUrl}`)}" style="padding:6px 12px;border-radius:8px;background:#2b579a;color:#fff;font-weight:800;font-size:.75rem;text-decoration:none;">Abrir en Word</a>
          <a href="${_escHtml(_googleOpenUrl(absUrl, name))}" target="_blank" rel="noopener" style="padding:6px 12px;border-radius:8px;background:#4285f4;color:#fff;font-weight:800;font-size:.75rem;text-decoration:none;">Abrir en Google Docs</a>
          <a href="${_escHtml(url)}" download target="_blank" rel="noopener" style="padding:6px 12px;border-radius:8px;background:var(--primary,#00dfbf);color:#fff;font-weight:800;font-size:.75rem;text-decoration:none;">Descargar</a>
          <button id="adv-close" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border,#ddd);background:transparent;color:inherit;font-weight:800;font-size:.75rem;cursor:pointer;">Cerrar ✕</button>
        </div>
        <div id="adv-body" style="flex:1;overflow:auto;background:#fff;color:#000;"><p style="opacity:.6;padding:12px 16px;">Cargando documento…</p></div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#adv-close').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    const body = modal.querySelector('#adv-body');

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const buf = await res.arrayBuffer();
        // Word con sus páginas, fuentes, tablas e imágenes originales
        try {
            await _loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
            await _loadScript('https://cdn.jsdelivr.net/npm/docx-preview@0.3.6/dist/docx-preview.min.js');
            body.innerHTML = '';
            await window.docx.renderAsync(buf, body, null, { inWrapper: true, ignoreLastRenderedPageBreak: true });
        } catch (e) {
            console.warn('docx-preview falló, usando mammoth:', e);
            await _loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
            const out = await window.mammoth.convertToHtml({ arrayBuffer: buf });
            body.innerHTML = `<div style="max-width:850px;margin:0 auto;padding:16px;line-height:1.6;font-size:.95rem;">${out.value}</div>`;
        }
    } catch (err) {
        console.warn('Visor propio falló, usando visor externo:', err);
        close();
        window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`, '_blank');
    }
};

// Global helper to safely resolve the dynamic import from the correct module base URL
window.reloadAcademy = () => import('./academy.js').then(m => m.renderAcademy());

window.viewAcademyNote = (id) => {
    const db = getDB();
    const note = (db.academiaContent || []).find(x => x.id === id);
    if (!note) return;
    
    document.getElementById('modal-note-title').innerText = note.titulo || 'Nota';
    
    // Format date if possible, else just hide it or show "Reciente"
    const dateStr = note.id.split('_')[1];
    let dateFormatted = 'Reciente';
    if (dateStr && !isNaN(dateStr)) {
        dateFormatted = new Date(parseInt(dateStr)).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' });
    }
    document.getElementById('modal-note-date').innerText = dateFormatted;
    
    document.getElementById('modal-note-content').textContent = note.notas || '';
    document.getElementById('modal-view-note').classList.remove('hidden');
};

export function renderAcademy() {
  const user = getCurrentUser();
  const screen = document.getElementById('screen-academy');
  if (!screen) return;
  _acInjectCss();

  const dbLocal = getDB();
  const allContent = dbLocal.academiaContent || [];

  const isHighRole = window.getUserRoles(user).some(r => ['admin', 'administrador', 'ceo'].includes(r));
  const units = isHighRole ? ['Renew Solar', 'Renew Water'] : (user.unidades || ['Renew Solar']).filter(u => u === 'Renew Solar' || u === 'Renew Water');
  let depts = units.map(u => u.replace('Renew ', ''));
  if (depts.length === 0) depts = ['Solar']; // Fallback
  
  if (!depts.includes(activeAcademyDeptFilter)) activeAcademyDeptFilter = depts[0];

  const userPipelines = user.unidades || [];
  const visibleContent = allContent.filter(item => {
    if (item.tipo === 'ELIMINADO') return false;

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
                const catNames = { video: 'Videos', pdf: 'Entrenamiento', banco: 'Banco de Información', faq: 'Soporte y FAQ', equipo: 'Equipo' };
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

    const crumbs = [{ id: null, titulo: 'Inicio' }, ...path];
    const breadcrumbsHtml = crumbs.map((f, idx) => {
        const isLast = idx === crumbs.length - 1;
        const go = f.id ? `window.mainAcademyFolder='${f.id}'` : 'window.mainAcademyFolder=null';
        return `${idx ? '<i class="fa-solid fa-chevron-right"></i>' : ''}<span class="${isLast ? 'cur' : ''}" ${isLast ? '' : `onclick="${go}; window.reloadAcademy()"`}>${_escHtml(f.titulo)}</span>`;
    }).join('');

    const parentFolderId = path.length > 0 ? path[path.length - 1].parent_id || null : null;
    const goParent = `window.mainAcademyFolder=${parentFolderId ? `'${parentFolderId}'` : 'null'}; window.reloadAcademy()`;
    const navHtml = `
        <button class="ac-icon-btn" title="Atrás" ${window.mainAcademyFolder ? `onclick="${goParent}"` : 'disabled'}><i class="fa-solid fa-arrow-left"></i></button>
        <button class="ac-icon-btn" title="Actualizar" onclick="window.reloadAcademy()"><i class="fa-solid fa-rotate-right"></i></button>`;

    const currentItems = allContent.filter(i => {
        if (i.tipo === 'ELIMINADO') return false;
        
        // Fix DB corruption for folders saved before the backend fix
        if (i.tipo === 'Carpeta') i.is_folder = true;

        let belongsToFolder = false;

        if (!window.mainAcademyFolder) {
            if (i.parent_id) return false;
            
            // Hide files that belong to virtual categories from the root
            if (!i.is_folder) {
                const t = (i.tipo || '').toLowerCase();
                const isCatVideo = t.includes('video');
                const isCatPdf = t.includes('pdf') || t.includes('guía') || t.includes('documento');
                const isCatBanco = t.includes('banca') || t.includes('banco');
                const isCatFaq = t.includes('faq') || t.includes('ayuda');
                const isCatEquipo = t.includes('equipo');
                if (isCatVideo || isCatPdf || isCatBanco || isCatFaq || isCatEquipo) {
                    return false;
                }
            }
            belongsToFolder = true;
        } else if (window.mainAcademyFolder.startsWith('cat_')) {
            const cat = window.mainAcademyFolder.replace('cat_', '');
            if (i.parent_id === window.mainAcademyFolder) {
                belongsToFolder = true;
            } else if (!i.is_folder && !i.parent_id) {
                const t = (i.tipo || '').toLowerCase();
                if (cat === 'video' && t.includes('video')) belongsToFolder = true;
                else if (cat === 'pdf' && (t.includes('pdf') || t.includes('guía') || t.includes('documento'))) belongsToFolder = true;
                else if (cat === 'banco' && (t.includes('banca') || t.includes('banco'))) belongsToFolder = true;
                else if (cat === 'faq' && (t.includes('faq') || t.includes('ayuda'))) belongsToFolder = true;
                else if (cat === 'equipo' && t.includes('equipo')) belongsToFolder = true;
            }
        } else {
            if (i.parent_id === window.mainAcademyFolder) belongsToFolder = true;
        }

        if (!belongsToFolder) return false;

        if (activeAcademyDeptFilter !== 'Todos') {
            if (i.permisos && i.permisos.length > 0) {
                const activePipName = 'Renew ' + activeAcademyDeptFilter.replace('Renew ', '');
                if (!i.permisos.includes(activePipName)) return false;
            }
        }
        return true;
    });

    const folders = currentItems.filter(i => i.is_folder).sort((a,b) => (a.titulo||'').localeCompare(b.titulo||''));
    const files = currentItems.filter(i => !i.is_folder).sort((a,b) => (a.titulo||'').localeCompare(b.titulo||''));

    let itemsHtml = '';
    if (folders.length) {
        itemsHtml += `<div class="ac-label">Carpetas</div><div class="ac-grid">` + folders.map(item => {
            const n = allContent.filter(i => i.parent_id === item.id && i.tipo !== 'ELIMINADO').length;
            return _acItem({
                onclick: `window.mainAcademyFolder='${item.id}'; window.reloadAcademy()`,
                attrs: 'data-is-folder="true"',
                thumb: item.miniaturaUrl, ico: 'fa-folder', c: '#eab308',
                title: item.titulo || 'Carpeta sin nombre',
                meta: item.notas || `${n} ${n === 1 ? 'elemento' : 'elementos'}`,
                delId: item.id,
            });
        }).join('') + '</div>';
    }
    if (files.length) {
        itemsHtml += `<div class="ac-label">Archivos</div><div class="ac-grid">` + files.map(item => {
            const m = _acFileMeta(item);
            return _acItem({
                onclick: m.isNote ? `window.viewAcademyNote('${item.id}')` : `window.openAcademyFile('${item.enlace}')`,
                attrs: 'data-is-folder="false"',
                thumb: item.miniaturaUrl || (m.isImage ? item.enlace : null), ico: m.icon, c: m.c,
                title: _acTitle(item, m),
                meta: item.notas && !m.isNote ? item.notas : m.label,
                delId: item.id,
            });
        }).join('') + '</div>';
    }
    if (!itemsHtml && window.mainAcademyFolder) itemsHtml = _acEmpty(t('academy_empty') || 'Carpeta vacía');

    const sectionsHtml = window.mainAcademyFolder ? '' : `
        <div id="academia-menu-principal">
            <div class="ac-label">Secciones</div>
            <div class="ac-grid">${_acCatsHtml(activeAcademyDeptFilter)}</div>
        </div>`;

    const closeMenu = `this.closest('.ac-menu').classList.remove('open');`;
    const newMenuHtml = `
        <div class="ac-menu">
            <button class="ac-btn-primary" onclick="this.parentElement.classList.toggle('open')"><i class="fa-solid fa-plus"></i> Nuevo</button>
            <div class="ac-menu-list">
                <button onclick="${closeMenu} window.mainCreateFolder()"><i class="fa-solid fa-folder-plus"></i> Crear carpeta</button>
                <button onclick="${closeMenu} window.mainUploadDoc()"><i class="fa-solid fa-arrow-up-from-bracket"></i> Subir archivo</button>
                <button onclick="${closeMenu} window.mainCreateNote()"><i class="fa-solid fa-pen-to-square"></i> Crear nota</button>
            </div>
        </div>`;

    screen.innerHTML = `
      <div id="vista-academia" class="ac-root animate-fadeIn"><div class="ac-wrap">
        ${_acHeaderHtml(depts, activeAcademyDeptFilter, newMenuHtml)}

        <div class="ac-bar" id="academy-explorer-nav">
            <div class="ac-nav">${navHtml}</div>
            <div class="ac-crumbs">${breadcrumbsHtml}</div>
            <label class="ac-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Buscar…" oninput="window.filterAcademyItems(this.value)"></label>
        </div>

        ${sectionsHtml}

        <div id="academia-gestor-grid">${itemsHtml}</div>
      </div></div>
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
                            <div id="main-aca-titulo-wrap">
                                <label class="block text-xs font-black text-text-muted uppercase tracking-wider mb-2" id="main-aca-titulo-label">Título (Opcional)</label>
                                <input type="text" id="main-aca-titulo" class="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text-primary focus:border-primary outline-none transition-colors" placeholder="Ej. Presentación Q3">
                            </div>
                            
                            <div id="main-aca-file-group">
                                <label class="block text-xs font-black text-text-muted uppercase tracking-wider mb-2">Archivo(s) * (PDF, Video, PPT, DOC)</label>
                                <input type="file" id="main-aca-file" multiple class="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-text-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-surface hover:file:bg-primary-hover transition-colors">
                            </div>
                            
                            <div id="main-aca-tipo-wrap">
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
                            
                            <div id="main-aca-notas-wrap">
                                <label class="block text-xs font-black text-text-muted uppercase tracking-wider mb-2">Notas (Opcional)</label>
                                <textarea id="main-aca-notas" class="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text-primary focus:border-primary outline-none transition-colors h-20 resize-none" placeholder="Notas sobre este archivo..."></textarea>
                            </div>

                            <div id="main-aca-permisos-group" style="display:none;">
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
            const rawTitulo = document.getElementById('main-aca-titulo').value.trim();
            const btn = document.getElementById('btn-main-save-academy');
            const isFolder = btn.dataset.isFolder === 'true';
            const isNote = btn.dataset.isFolder === 'note';
            
            const folderId = window.mainAcademyFolder || null;
            
            if (isFolder && !rawTitulo) return alert('El título es requerido para la carpeta');
            if (isNote && !document.getElementById('main-aca-notas').value.trim()) return alert('Debes escribir algo en la nota');
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
            
            try {
                const db = getDB();
                const parentId = window.mainAcademyFolder || null;
                const notas = document.getElementById('main-aca-notas').value.trim() || null;
                
                // Inherit permissions automatically based on current active tab
                const autoPermiso = activeAcademyDeptFilter ? 'Renew ' + activeAcademyDeptFilter : null;
                const permisos = autoPermiso ? [autoPermiso] : [];
                
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
                        titulo: rawTitulo,
                        tipo: 'Carpeta',
                        enlace: '',
                        miniaturaUrl: minUrl,
                        permisos: permisos,
                        is_folder: true,
                        parent_id: parentId,
                        notas: notas
                    };
                    db.academiaContent = db.academiaContent || [];
                    db.academiaContent.push(newFolder);
                    const { saveGranular } = await import('../api.js');
                    await saveGranular('academia_content', [newFolder]);
                    
                } else if (isNote) {
                    const newNote = {
                        id: 'note_' + Date.now(),
                        titulo: rawTitulo || 'Nota',
                        tipo: 'Nota',
                        enlace: '',
                        miniaturaUrl: null,
                        permisos: permisos,
                        is_folder: false,
                        parent_id: parentId,
                        notas: notas
                    };
                    db.academiaContent = db.academiaContent || [];
                    db.academiaContent.push(newNote);
                    const { saveGranular } = await import('../api.js');
                    await saveGranular('academia_content', [newNote]);
                } else {
                    const fileInput = document.getElementById('main-aca-file');
                    if (!fileInput.files.length) throw new Error('Debes seleccionar al menos un archivo');
                    
                    const minInput = document.getElementById('main-aca-miniatura');
                    const minFile = (minInput && minInput.files.length) ? minInput.files[0] : null;
                    
                    let baseTipo = document.getElementById('main-aca-tipo').value;
                    if (folderId && folderId.startsWith('cat_')) {
                        const catNames = { cat_video: 'Video de Entrenamiento', cat_pdf: 'Documento PDF', cat_banco: 'Información Bancaria', cat_faq: 'FAQ y Ayuda', cat_equipo: 'Presentación' };
                        baseTipo = catNames[folderId] || 'Documento PDF';
                    }
                    
                    const progressWrap = document.getElementById('main-aca-progress');
                    const progressFill = document.getElementById('main-aca-progress-fill');
                    const progressPct = document.getElementById('main-aca-progress-pct');
                    progressWrap.classList.remove('hidden');
                    
                    const { uploadFile, saveGranular } = await import('../api.js');
                    
                    let minUrl = null;
                    if (minFile) {
                        minUrl = await uploadFile(minFile, 'academia_thumbs', () => {});
                    }
                    
                    const newDocs = [];
                    const isMultiple = fileInput.files.length > 1;
                    
                    // Loop through each file sequentially
                    for (let i = 0; i < fileInput.files.length; i++) {
                        const file = fileInput.files[i];
                        let finalTitulo = rawTitulo;
                        // Si dejan el título vacío, simplemente se guarda vacío, tal cual como pidieron.
                        
                        // Inferir tipo si está en una carpeta (donde el tipo no importa, pero le ponemos algo basandonos en la extension)
                        let finalTipo = baseTipo;
                        if (folderId && !folderId.startsWith('cat_')) {
                            const ext = file.name.split('.').pop().toLowerCase();
                            if (['mp4','mov','avi'].includes(ext)) finalTipo = 'Video de Entrenamiento';
                            else if (['pdf','doc','docx'].includes(ext)) finalTipo = 'Documento PDF';
                            else if (['ppt','pptx'].includes(ext)) finalTipo = 'Presentación';
                            else finalTipo = 'Documento';
                        }
                        
                        progressPct.textContent = `Subiendo ${i + 1}/${fileInput.files.length} (0%)`;
                        progressFill.style.width = '0%';
                        
                        const fileUrl = await uploadFile(file, 'academia', (pct) => {
                            progressFill.style.width = pct + '%';
                            progressPct.textContent = `Subiendo ${i + 1}/${fileInput.files.length} (${pct}%)`;
                        });
                        
                        const newDoc = {
                            id: 'doc_' + Date.now() + '_' + i,
                            titulo: finalTitulo,
                            tipo: finalTipo,
                            enlace: fileUrl,
                            miniaturaUrl: minUrl,
                            permisos,
                            is_folder: false,
                            parent_id: parentId,
                            notas
                        };
                        newDocs.push(newDoc);
                    }
                    
                    db.academiaContent = db.academiaContent || [];
                    db.academiaContent.push(...newDocs);
                    await saveGranular('academia_content', newDocs);
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
        
        window.deleteAcademyItem = async (id, btn) => {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i>';
            btn.disabled = true;
            try {
                const db = getDB();
                const item = db.academiaContent.find(x => x.id === id);
                if (item) {
                    const { deleteRecord } = await import('../api.js');
                    await deleteRecord('academia_content', id);
                    db.academiaContent = db.academiaContent.filter(x => x.id !== id);
                    await saveDB(db);
                    const card = btn.closest('.academy-card');
                    if (card) {
                        card.remove();
                    } else {
                        window.reloadAcademy();
                    }
                }
            } catch(e) {
                console.error(e);
                alert('Error al borrar');
                btn.innerHTML = '<i class="fa-solid fa-trash text-xs"></i>';
                btn.disabled = false;
            }
        };

        // Expose modal triggers
        window.mainCreateNote = () => {
            document.getElementById('modal-main-academy-title').innerText = 'CREAR NOTA';
            document.getElementById('main-aca-titulo-label').innerText = 'Título (Opcional)';
            document.getElementById('main-aca-titulo').value = '';
            
            const notasInput = document.getElementById('main-aca-notas');
            notasInput.value = '';
            notasInput.placeholder = 'Escribe tu publicación aquí...';
            notasInput.classList.remove('h-20');
            notasInput.classList.add('h-40');
            
            document.getElementById('main-aca-titulo-wrap').style.display = 'block';
            document.getElementById('main-aca-file-group').style.display = 'none';
            document.getElementById('main-aca-tipo-wrap').style.display = 'none';
            document.getElementById('main-aca-thumb-wrap').style.display = 'none';
            document.getElementById('main-aca-permisos-group').style.display = 'none';
            
            const btn = document.getElementById('btn-main-save-academy');
            btn.dataset.isFolder = 'note';
            document.getElementById('modal-main-academy').classList.remove('hidden');
        };


        window.mainCreateFolder = () => {
            document.getElementById('modal-main-academy-title').innerText = 'NUEVA CARPETA';
            document.getElementById('main-aca-titulo-label').innerText = 'Título *';
            document.getElementById('main-aca-titulo').value = '';
            
            const notasInput = document.getElementById('main-aca-notas');
            notasInput.value = '';
            notasInput.placeholder = 'Notas sobre esta carpeta...';
            notasInput.classList.remove('h-40');
            notasInput.classList.add('h-20');
            
            document.getElementById('main-aca-titulo-wrap').style.display = 'block';
            document.getElementById('main-aca-file-group').style.display = 'none';
            document.getElementById('main-aca-tipo-wrap').style.display = 'none';
            document.getElementById('main-aca-thumb-wrap').style.display = 'block';
            document.getElementById('main-aca-permisos-group').style.display = 'none';
            
            const btn = document.getElementById('btn-main-save-academy');
            btn.dataset.isFolder = 'true';
            document.getElementById('modal-main-academy').classList.remove('hidden');
        };
        
        window.mainUploadDoc = () => {
            document.getElementById('modal-main-academy-title').innerText = 'SUBIR DOCUMENTO';
            document.getElementById('main-aca-titulo-label').innerText = 'Título (Opcional)';
            document.getElementById('main-aca-titulo').value = '';
            
            const notasInput = document.getElementById('main-aca-notas');
            notasInput.value = '';
            notasInput.placeholder = 'Notas sobre este archivo...';
            notasInput.classList.remove('h-40');
            notasInput.classList.add('h-20');
            
            document.getElementById('main-aca-file').value = '';
            document.getElementById('main-aca-miniatura').value = '';
            document.querySelectorAll('.main-aca-pip-chk').forEach(c => c.checked = false);
            
            const folderId = window.mainAcademyFolder || null;
            
            if (folderId && folderId.startsWith('cat_')) {
                // Dentro de una sección virtual (ej. cat_video)
                document.getElementById('main-aca-titulo-wrap').style.display = 'block';
                document.getElementById('main-aca-file-group').style.display = 'block';
                document.getElementById('main-aca-tipo-wrap').style.display = 'none'; // Se infiere
                document.getElementById('main-aca-thumb-wrap').style.display = folderId === 'cat_video' ? 'block' : 'none';
            } else if (folderId) {
                // Dentro de una carpeta real
                document.getElementById('main-aca-titulo-wrap').style.display = 'block'; // Show it, but it's optional! Wait, user said "que simpmeye se suba sin nombre, boviamnete sen al carpeta". We can hide it or show it. They said "ya por fuer ala logica es igual, es mas dejemos la opcion de titulo pero que sea opcional porfvaor y espifcalo en un aprentesis". So show it always but optional!
                document.getElementById('main-aca-file-group').style.display = 'block';
                document.getElementById('main-aca-tipo-wrap').style.display = 'none';
                document.getElementById('main-aca-thumb-wrap').style.display = 'none';
            } else {
                // En la raíz
                document.getElementById('main-aca-titulo-wrap').style.display = 'block';
                document.getElementById('main-aca-file-group').style.display = 'block';
                document.getElementById('main-aca-tipo-wrap').style.display = 'block';
                document.getElementById('main-aca-tipo').dispatchEvent(new Event('change')); // Trigger thumbnail visibility
            }
            
            document.getElementById('main-aca-permisos-group').style.display = 'none';
            
            const btn = document.getElementById('btn-main-save-academy');
            btn.dataset.isFolder = 'false';
            document.getElementById('modal-main-academy').classList.remove('hidden');
        };
    }
  } else {
    // Normal User View
    screen.innerHTML = `
      <div id="vista-academia" class="ac-root animate-fadeIn"><div class="ac-wrap">
        <div id="academia-menu-principal">
          ${_acHeaderHtml(depts, activeAcademyDeptFilter)}
          <div class="ac-label">Secciones</div>
          <div class="ac-grid">${_acCatsHtml(activeAcademyDeptFilter)}</div>
        </div>

        <div id="academia-subvista" class="hidden">
          <div class="ac-bar">
            <button id="btn-regresar-academia" class="ac-icon-btn" title="Atrás"><i class="fa-solid fa-arrow-left"></i></button>
            <h2 id="titulo-subvista" class="ac-subhead">Categoría</h2>
          </div>
          <div id="contenedor-recursos-finales" class="ac-grid"></div>
        </div>
      </div></div>
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

  const cards = document.querySelectorAll('.ac-cat');
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
      
      function renderRecursosFinales(catKey, parentFolderId = null) {
        const resources = visibleContent.filter(item => {
          if (item.is_folder) {
             if (parentFolderId) return item.parent_id === parentFolderId;
             return item.parent_id === 'cat_' + catKey;
          }
          
          // Files
          if (parentFolderId) {
             return item.parent_id === parentFolderId;
          } else {
             // In root of virtual category
             if (item.parent_id && !item.parent_id.startsWith('cat_')) return false; // hide files that are inside real folders
             
             if (item.parent_id === 'cat_' + catKey) return true;
             
             const type = (item.tipo || '').toLowerCase();
             if (catKey === 'video') return type.includes('video');
             if (catKey === 'pdf') return type.includes('pdf') || type.includes('guía') || type.includes('documento');
             if (catKey === 'banco') return type.includes('banca') || type.includes('banco');
             if (catKey === 'faq') return type.includes('faq') || type.includes('ayuda');
             if (catKey === 'equipo') return type.includes('equipo');
             return false;
          }
        });

        // Add back button functionality if we are inside a folder
        const oldBackBtn = document.getElementById('btn-regresar-academia');
        const newBackBtn = oldBackBtn.cloneNode(true);
        oldBackBtn.parentNode.replaceChild(newBackBtn, oldBackBtn);
        
        newBackBtn.addEventListener('click', () => {
          if (parentFolderId) {
             const currentFolder = visibleContent.find(x => x.id === parentFolderId);
             const upperId = currentFolder ? currentFolder.parent_id : null;
             
             if (upperId && upperId.startsWith('cat_')) {
                 const catNames = { video: 'Videos', pdf: 'Entrenamiento', banco: 'Banco de Información', faq: 'Soporte y FAQ', equipo: 'Equipo' };
                 const rawCat = upperId.replace('cat_', '');
                 if (tituloSub) tituloSub.innerText = catNames[rawCat] || rawCat.toUpperCase();
                 renderRecursosFinales(catKey, null);
             } else if (upperId) {
                 const upFolder = visibleContent.find(x => x.id === upperId);
                 if (tituloSub) tituloSub.innerText = upFolder ? upFolder.titulo : 'Carpeta';
                 renderRecursosFinales(catKey, upperId);
             } else {
                 renderRecursosFinales(catKey, null);
             }
          } else {
             if (subVista) subVista.classList.add('hidden');
             if (menuPrincipal) menuPrincipal.classList.remove('hidden');
             if (gestorGrid) gestorGrid.classList.remove('hidden');
             if (explorerNav) explorerNav.classList.remove('hidden');
             if (contenedorFinal) contenedorFinal.innerHTML = '';
          }
        });

        if (resources.length === 0) {
          contenedorFinal.innerHTML = _acEmpty(t('academy_empty'));
          return;
        }

        contenedorFinal.innerHTML = resources.map(r => {
          if (r.is_folder) {
            return _acItem({
              cls: 'recurso-carpeta-legacy',
              attrs: `data-cat="${catKey}" data-id="${r.id}" data-titulo="${_escHtml(r.titulo)}"`,
              thumb: r.miniaturaUrl, ico: 'fa-folder', c: '#eab308',
              title: r.titulo, meta: r.notas || 'Carpeta',
            });
          }
          const m = _acFileMeta(r);
          if (m.isNote) {
            return _acItem({ onclick: `window.viewAcademyNote('${r.id}')`, ico: m.icon, c: m.c, title: r.titulo || 'Nota', meta: 'Nota' });
          }
          const title = _acTitle(r, m);
          const cover = r.miniaturaUrl || (m.isImage ? r.enlace : null);
          if (cover || m.isVideo) {
            return `
              <div class="ac-media" onclick="window.openAcademyFile('${r.enlace}')" data-search="${_escHtml(title.toLowerCase())}">
                <div class="ac-cover" ${cover ? `style="background-image:url('${_escHtml(cover)}')"` : ''}>
                  ${m.isVideo ? '<span class="ac-play"><i class="fa-solid fa-play"></i></span>' : ''}
                </div>
                <div class="ac-txt"><h4>${_escHtml(title)}</h4><p>${_escHtml(r.notas || m.label)}</p></div>
              </div>`;
          }
          return _acItem({ onclick: `window.openAcademyFile('${r.enlace}')`, ico: m.icon, c: m.c, title, meta: r.notas || m.label });
        }).join('');

        // Attach click listeners for folders
        document.querySelectorAll('.recurso-carpeta-legacy').forEach(el => {
            el.addEventListener('click', () => {
                if (tituloSub) tituloSub.innerText = el.dataset.titulo;
                renderRecursosFinales(el.dataset.cat, el.dataset.id);
            });
        });
      }

      if (!document.getElementById('modal-view-note')) {
          const noteModalHtml = `
              <div id="modal-view-note" class="fixed inset-0 z-[999] hidden flex items-center justify-center p-4">
                  <div class="absolute inset-0 bg-black/60 backdrop-blur-sm modal-bg" onclick="document.getElementById('modal-view-note').classList.add('hidden')"></div>
                  <div class="relative bg-surface border border-border rounded-3xl shadow-2xl w-full max-w-2xl p-8 animate-slideUp">
                      <button class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-alt text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors" onclick="document.getElementById('modal-view-note').classList.add('hidden')">
                          <i class="fa-solid fa-xmark"></i>
                      </button>
                      
                      <div class="flex items-center gap-3 mb-6">
                          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <i class="fa-solid fa-quote-left text-lg"></i>
                          </div>
                          <div>
                              <h3 id="modal-note-title" class="text-xl font-black text-text-primary uppercase tracking-tight m-0">Nota</h3>
                              <p id="modal-note-date" class="text-xs text-text-muted font-bold m-0"></p>
                          </div>
                      </div>
                      
                      <div id="modal-note-content" class="text-text-secondary whitespace-pre-wrap leading-relaxed text-sm p-4 bg-bg rounded-2xl border border-border max-h-[60vh] overflow-y-auto">
                      </div>
                  </div>
              </div>
          `;
          document.body.insertAdjacentHTML('beforeend', noteModalHtml);
      }
}
