/* ============================================================
   RENEW SOLAR – screens/projectDetail.js
   Screen 4: Vista Dinámica "Camaleón" del Proyecto
   ============================================================ */
import { 
  getDealById, advanceDealPhase, formatDate, syncKanbanActivity, 
  uploadFile, getAdminPipelines, getAdminFases, getRespuestasByProyecto,
  getAdminCampos, saveGranular, saveRecibo, getDB
} from '../api.js';
import { showToast } from '../components/toast.js';
import { navigate, getCurrentUser } from '../app.js';

// ─── WEBHOOK CONFIG ─────────────────────────────────────────
const WEBHOOK_URL = 'https://n8n.renewgroup.site/webhook/notificacion-flujo';

async function notifyWebhook(payload) {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error('[Webhook Error]', e);
  }
}

function renderDiscussion(discusion, pipelineColor) {
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
            dateSeparator = `<div style="text-align:center;margin:12px 0 8px;"><span style="display:inline-block;background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);font-size:0.65rem;font-weight:800;padding:3px 12px;border-radius:99px;text-transform:capitalize;">${dateLabel}</span></div>`;
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
                attachmentHtml = `<div style="margin-top:6px;"><a href="${c.fileUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,0.05);padding:6px 12px;border-radius:8px;font-size:0.7rem;color:var(--text-primary);text-decoration:none;font-weight:700;"><i class="fas fa-file-alt"></i> ${c.fileName || 'Archivo adjunto'}</a></div>`;
            }
        }

        const msgBubble = `
        <div style="display:flex;align-items:flex-start;gap:8px;max-width:85%;${isMe ? 'flex-direction:row-reverse;margin-left:auto;' : ''}">
            ${avatar}
            <div style="display:flex;flex-direction:column;${isMe ? 'align-items:flex-end;' : 'align-items:flex-start;'}">
                <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;${isMe ? 'flex-direction:row-reverse;' : ''}">
                    <span style="font-size:0.7rem;font-weight:800;color:var(--text-primary);">${isMe ? 'Tú' : c.user}</span>
                    <span style="font-size:0.6rem;color:var(--text-muted);">${time}</span>
                </div>
                <div style="background:${isMe ? pipelineColor : 'var(--surface)'};color:${isMe ? 'white' : 'var(--text-primary)'};border-radius:${isMe ? '12px 0 12px 12px' : '0 12px 12px 12px'};padding:8px 12px;font-size:0.8rem;line-height:1.4;box-shadow:0 1px 2px rgba(0,0,0,0.05);${!isMe ? 'border:1px solid var(--border);' : ''}">${c.text}${attachmentHtml}</div>
            </div>
        </div>`;
        
        return dateSeparator + msgBubble;
    }).join('');
}

function renderProjectInventory(dealId) {
    const db = getDB();
    const historial = db.historialInventario || [];
    const used = historial.filter(h => h.proyecto_id === dealId && h.tipo_movimiento === 'Salida (Proyecto)');
    
    if (!used.length) return '<div style="background:var(--surface-alt); border-radius:12px; padding:16px; font-size:0.85rem; color:var(--text-muted); border:1px solid var(--border); text-align:center; font-style:italic;">No se han retirado materiales.</div>';
    
    return used.map(h => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-alt); padding:12px; border-radius:12px; border:1px solid var(--border);">
           <div>
              <div style="font-weight:800; font-size:0.85rem; color:var(--text-primary); text-transform:uppercase;">${h.item_nombre}</div>
              <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;"><i class="fa-solid fa-user text-[8px] mr-1"></i> ${h.tecnico_nombre} &nbsp;&bull;&nbsp; ${new Date(h.fecha).toLocaleDateString()}</div>
           </div>
           <div style="display:flex; align-items:center; gap:8px;">
               <div style="background:#ef444415; color:#ef4444; font-weight:900; font-size:0.85rem; padding:6px 10px; border-radius:8px; border:1px solid #ef444430;">-${h.cantidad_retirada}</div>
               <button onclick="window.deleteProjectMaterial('${h.id}', '${dealId}')" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:6px;" title="Borrar material retirado y devolver stock">
                   <i class="fa-solid fa-trash-can hover:text-red-500 transition-colors"></i>
               </button>
           </div>
        </div>
    `).join('');
}

export async function renderDetail(dealId) {
  const screen = document.getElementById('screen-detail');
  if (!screen) return;

  screen.innerHTML = `
    <div class="screen-header slide-in-left">
      <button class="back-btn" id="pd-back-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
      <h2>Cargando...</h2>
    </div>
    <div style="padding:24px 16px">
      <div class="skeleton" style="height:100px;border-radius:16px;margin-bottom:16px"></div>
      <div class="skeleton" style="height:150px;border-radius:16px"></div>
    </div>
  `;

  const backBtn = document.getElementById('pd-back-btn');
  if (backBtn) backBtn.addEventListener('click', () => navigate('dashboard'));

  try {
    const deal = await getDealById(dealId);
    const pipelines = await getAdminPipelines();
    const fasesAll = await getAdminFases();
    const allCampos = await getAdminCampos();
    
    const pipeline = pipelines.find(p => p.id === deal.pipeline_id);
    const fases = fasesAll.filter(f => f.pipeline_id === pipeline.id).sort((a,b) => a.orden - b.orden);
    const curFidx = fases.findIndex(f => f.id === deal.fase_id);
    
    const dbMock = { Admin_Campos_Formulario: allCampos };

    await buildDetailView(screen, deal, pipeline, fases, curFidx, dbMock);
  } catch (err) {
    showToast(err.message, 'error');
    console.error(err);
    const headerTitle = screen.querySelector('h2');
    if(headerTitle) headerTitle.textContent = 'Error';
  }
}

async function buildDetailView(screen, deal, pipeline, fases, curFidx, db) {
  const isCompleted = curFidx === -1;
  const currentFaseObj = isCompleted ? fases[fases.length - 1] : fases[curFidx];
  const currentUser = getCurrentUser();
  const roleStr = (currentUser?.rol || '').toLowerCase();
  const isAdmin = ['admin','administrador','ceo','desarrollador'].includes(roleStr);
  const isResponsable = currentUser?.id === deal.responsable_id || currentUser?.id === deal.asignado_a || (Array.isArray(deal.colaboradores) && deal.colaboradores.some(c => c.id === currentUser?.id));
  const isAssigned = deal.asignado_a === currentUser?.id || deal.responsable_id === currentUser?.id || (Array.isArray(deal.tecnicos) && deal.tecnicos.some(t => t.id === currentUser?.id)) || (Array.isArray(deal.colaboradores) && deal.colaboradores.some(c => c.id === currentUser?.id));
  const isPM = ['project manager', 'manager de ventas', 'account manager', 'supervisión', 'supervisor', 'manager', 'oficina'].some(r => roleStr.includes(r));
  const isTecnico = roleStr.includes('técnico') || roleStr.includes('tecnico');
  const canSeeChat = isAdmin || (isPM && isAssigned) || (isTecnico && isAssigned) || (isPM);
  const canManageObservers = isAdmin || isResponsable;
  const dbFull = getDB();
  const allWorkers = dbFull.Usuarios || [];

  const assigneeId = deal.asignado_a || deal.responsable_id;
  const assigneeUser = allWorkers.find(w => w.id === assigneeId);
  const assigneeName = assigneeUser ? `${assigneeUser.nombre} ${assigneeUser.apellido || ''}`.trim() : 'Sin asignar';

  const colaboradores = Array.isArray(deal.colaboradores) ? deal.colaboradores : [];
  const obsHtml = colaboradores.map(o => {
      const oi = ((o.nombre || '?')[0]).toUpperCase();
      return `<div class="obs-avatar" title="${o.nombre}" style="width:28px;height:28px;border-radius:50%;background:${pipeline.color}20;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:900;color:${pipeline.color};border:2px solid var(--bg);margin-left:-8px;overflow:hidden;">
        ${o.foto ? `<img src="${o.foto}" style="width:100%;height:100%;object-fit:cover;" />` : oi}
      </div>`;
  }).join('');

  screen.innerHTML = `
    <div class="screen-header slide-in-left" style="background:${pipeline.color}; border:none">
      <button class="back-btn" id="pd-back-btn2" style="color:#fff; background:rgba(255,255,255,0.2)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h2 style="color:white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${deal.nombre_cliente}</h2>
      <span class="badge" style="margin-left:auto; background:white; color:${pipeline.color}; font-weight:800; box-shadow: 0 2px 8px rgba(0,0,0,0.1)">${isCompleted ? 'Completado' : currentFaseObj.nombre}</span>
    </div>

    <div class="progress-section" style="margin-top:0; border-radius:0 0 24px 24px; box-shadow:0 8px 16px rgba(0,0,0,0.1)">
      <div class="progress-steps" style="padding-top:16px; overflow-x:auto; display:flex; flex-wrap:nowrap; -webkit-overflow-scrolling:touch; padding-bottom:20px; gap:8px">
        ${fases.map((f, i) => {
          const isDone = isCompleted || i < curFidx;
          const isActive = !isCompleted && i === curFidx;
          const isClickable = isDone || isActive;
          return `
          <div class="progress-step ${isDone ? 'done' : isActive ? 'active' : ''}" 
               data-fase-id="${f.id}" data-fase-nombre="${f.nombre}" data-fase-idx="${i}"
               style="min-width: 90px; flex: 0 0 auto; ${isClickable ? 'cursor:pointer;' : ''}"
               ${isClickable ? `onclick="window._previewFase('${f.id}','${encodeURIComponent(f.nombre)}','${deal.id}')"` : ''}>
            <div class="step-circle" style="${isDone ? `background:${pipeline.color}; border-color:${pipeline.color}` : (isActive ? `border-color:${pipeline.color}; color:${pipeline.color}` : '')}"
                 title="${isClickable ? 'Ver detalles de esta fase' : ''}">
              ${isDone
                ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
                : (i + 1)}
            </div>
            <div class="step-label" style="white-space:normal; line-height:1.2">${f.nombre}</div>
            ${isClickable ? `<div style="font-size:0.5rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:${isDone ? pipeline.color : pipeline.color}; opacity:0.7; margin-top:2px;">Ver</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>

    <div style="padding: 16px; padding-bottom: 40px;">
      <!-- Left Column -->
      <div style="display:flex; flex-direction:column; gap:24px;">
        <div id="dynamic-action-section"></div>

        ${(pipeline.nombre || '').toLowerCase().includes('water') && currentFaseObj && currentFaseObj.nombre.toLowerCase().includes('instalaci') ? `
        <div class="info-card slide-in-bottom" style="padding:20px; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.05)">
        <h3 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:16px; font-weight:700; letter-spacing:0.5px; display:flex; justify-content:space-between; align-items:center;">
          Materiales del Proyecto
          <button onclick="window.openInventoryCart('${deal.id}')" style="background:${pipeline.color}15; color:${pipeline.color}; border:1px solid ${pipeline.color}30; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">
             <i class="fa-solid fa-cart-plus mr-1"></i> Retirar Material
          </button>
        </h3>
        <div id="project-inventory-list-${deal.id}" style="display:flex; flex-direction:column; gap:8px;">
          ${renderProjectInventory(deal.id)}
        </div>
        </div>
        ` : ''}
      </div>

      <!-- Right Column -->
      <div style="display:flex; flex-direction:column; gap:24px;">
        <div class="info-card slide-in-bottom" style="padding:20px; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.05)">
          <h3 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:16px; font-weight:700; letter-spacing:0.5px">Detalles del Proyecto</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" style="background:var(--surface-alt); padding:20px; border-radius:12px; border:1px solid var(--border)">
          <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Descripción</span>
            <span style="font-size:0.85rem; font-weight:500; color:var(--text-primary); line-height:1.4">${deal.descripcion || '<span class="italic text-gray-400">Sin descripción</span>'}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Asignado a</span>
            <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:6px"><i class="fa-solid fa-user-circle text-gray-300"></i> ${assigneeName}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Proyecto</span>
            <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:6px"><span class="w-2 h-2 rounded-full inline-block" style="background:${pipeline.color}"></span> ${pipeline.nombre}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Creado el</span>
            <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${new Date(deal.fecha || Date.now()).toLocaleDateString()}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Fecha Límite</span>
            ${isAdmin ? 
              `<input type="date" id="pd-deadline-input" value="${deal.fecha_finalizacion ? deal.fecha_finalizacion.substring(0,10) : ''}" class="bg-transparent border border-dashed border-gray-300 rounded px-2 py-1 outline-none hover:border-blue-400 cursor-pointer text-gray-700 transition-colors" style="font-size:0.85rem; max-width:140px;">` : 
              `<span style="font-size:0.85rem; font-weight:600; color:var(--text-primary); padding:4px 0;">${deal.fecha_finalizacion ? new Date(deal.fecha_finalizacion).toLocaleDateString() : 'Sin definir'}</span>`
            }
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; grid-column: 1 / -1; margin-top:8px; border-top:1px dashed var(--border); padding-top:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">colaboradores</span>
                ${canManageObservers ? `
                <button id="btn-manage-obs" style="background:transparent; border:none; color:${pipeline.color}; font-size:0.75rem; font-weight:700; cursor:pointer;">
                    <i class="fa-solid fa-plus mr-1"></i> Añadir
                </button>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:4px; padding-left:8px;">
                ${obsHtml || `<span style="font-size:0.75rem;color:var(--text-muted);font-style:italic;">No hay colaboradores</span>`}
            </div>
          </div>
        </div>
      </div>

      <div class="info-card slide-in-bottom" style="padding:20px; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.05)">
        <h3 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:16px; font-weight:700; letter-spacing:0.5px">Datos de Contacto Central</h3>
        <div style="display:flex; flex-direction:column; gap:16px; background:var(--surface-alt); padding:20px; border-radius:12px; border:1px solid var(--border)">
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Email</span>
            <span style="font-size:0.95rem; font-weight:600; color:var(--text-primary); word-break:break-all">${deal.email || 'N/A'}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Teléfono</span>
            <span style="font-size:0.95rem; font-weight:700; color:${pipeline.color}; word-break:break-all">${deal.telefono}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Dirección</span>
            <span style="font-size:0.95rem; font-weight:500; color:var(--text-primary); word-break:break-all; line-height:1.4">${deal.direccion}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">ID / Licencia de Conducir</span>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.95rem; font-weight:600; color:var(--text-primary); word-break:break-all">${deal.licencia || '-'}</span>
              ${deal.foto_id ? `<button onclick="window.open('${deal.foto_id}')" style="background:${pipeline.color}; color:white; border:none; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:bold; cursor:pointer">Ver Documento</button>` : `<span style="font-size:0.7rem; color:var(--text-muted); font-style:italic">Sin adjunto</span>`}
            </div>
          </div>
        </div>
      </div>

      ${canSeeChat ? `
      <div class="info-card slide-in-bottom" style="margin-bottom:120px; padding:0; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
        <!-- Header -->
        <div style="padding:16px 20px; border-bottom:1px solid var(--border); background:var(--surface-alt);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); margin:0; font-weight:700; letter-spacing:0.5px;">Chat del Proyecto</h3>
                <label style="font-size:0.7rem; font-weight:600; display:flex; align-items:center; gap:6px; cursor:pointer; color:var(--text-primary);">
                   <input type="checkbox" id="chk-has-issue" ${deal.tiene_problema ? 'checked' : ''} style="accent-color:#ef4444; width:14px; height:14px;">
                   Atención Req.
                </label>
            </div>
        </div>
        
        <!-- Messages -->
        <div id="discussion-list" style="padding:20px; font-size:0.85rem; height: 320px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; background:var(--bg);">
          ${renderDiscussion(deal.discusion, pipeline.color)}
        </div>
        
        <!-- Input -->
        <div style="display:flex; gap:8px; padding:12px; border-top:1px solid var(--border); background:var(--surface-alt); align-items:center;">
          <input type="text" id="discussion-input" placeholder="Escribe un mensaje..." style="flex:1; height:44px; min-width:0; border-radius:12px; background:var(--bg); border:1px solid var(--border); color:var(--text-primary); padding:0 14px; font-size:0.85rem; outline:none;" />
          <button id="btn-send-discussion" style="background:${pipeline.color}; color:#fff; border:none; width:44px; height:44px; border-radius:12px; flex-shrink:0; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px ${pipeline.color}40;">
            <i class="fa-solid fa-paper-plane text-sm"></i>
          </button>
        </div>
      </div>
      ` : ''}
      </div>
    </div>
  `;

  const backBtn2 = document.getElementById('pd-back-btn2');
  if (backBtn2) backBtn2.addEventListener('click', () => navigate('dashboard'));

  // Deadline logic
  const deadlineInput = document.getElementById('pd-deadline-input');
  if (deadlineInput && isAdmin) {
      deadlineInput.addEventListener('change', async (e) => {
          const newDate = e.target.value;
          try {
              const { saveGranular } = await import('../api.js');
              deal.fecha_finalizacion = newDate ? new Date(newDate + 'T12:00:00').toISOString() : null;
              await saveGranular('proyectos_dinamicos', [deal]);
              
              const { showToast } = await import('../components/toast.js');
              showToast('Fecha límite actualizada', 'success');
              
              // Also sync kanban activity
              const { syncKanbanActivity } = await import('../api.js');
              syncKanbanActivity({
                  proyecto_id: deal.id,
                  evento: 'FECHA_LIMITE_ACTUALIZADA',
                  responsable_id: currentUser?.id,
                  fase_nombre: deal.etapa
              });
          } catch(err) {
              console.error(err);
              e.target.value = deal.fecha_finalizacion ? deal.fecha_finalizacion.substring(0,10) : '';
              const { showToast } = await import('../components/toast.js');
              showToast('Error al actualizar: ' + err.message, 'error');
          }
      });
  }

  // Observers modal logic
  const btnManageObs = document.getElementById('btn-manage-obs');
  if (btnManageObs) {
      btnManageObs.addEventListener('click', () => {
          const div = document.createElement('div');
          div.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);';
          
          const curObs = Array.isArray(deal.colaboradores) ? deal.colaboradores : [];
          const curIds = new Set(curObs.map(o=>o.id));
          const eligible = allWorkers.filter(w => w.id !== deal.responsable_id && !curIds.has(w.id) && !w.is_suspended);
          
          div.innerHTML = `
          <div style="background:var(--bg);width:100%;border-radius:24px 24px 0 0;padding:20px;max-height:80vh;display:flex;flex-direction:column;animation:slideInBottom 0.3s ease-out;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                  <h3 style="margin:0;font-size:1rem;font-weight:800;color:var(--text-primary);">Añadir colaborador</h3>
                  <button id="close-obs" style="background:none;border:none;font-size:1.5rem;color:var(--text-muted);">&times;</button>
              </div>
              <div style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;padding-bottom:20px;">
                  ${eligible.length === 0 ? '<p style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:20px;">No hay más usuarios disponibles</p>' : ''}
                  ${eligible.map(w => `
                  <div class="obs-item" data-id="${w.id}" style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--surface-alt);border:1px solid var(--border);border-radius:12px;cursor:pointer;">
                      <div style="display:flex;align-items:center;gap:12px;">
                          <div style="width:36px;height:36px;border-radius:50%;background:${pipeline.color}15;color:${pipeline.color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem;">
                              ${w.foto ? `<img src="${w.foto}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : (w.nombre[0].toUpperCase())}
                          </div>
                          <div>
                              <div style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">${w.nombre}</div>
                              <div style="font-size:0.7rem;color:var(--text-muted);">${w.rol}</div>
                          </div>
                      </div>
                      <button class="add-obs-btn" data-id="${w.id}" style="background:${pipeline.color}15;color:${pipeline.color};border:none;padding:6px 12px;border-radius:8px;font-size:0.7rem;font-weight:800;">Añadir</button>
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
                      import('../api.js').then(async ({addObserver}) => {
                          try {
                              await addObserver(deal.id, worker);
                              showToast('colaborador añadido', 'success');
                              div.remove();
                              renderDetail(deal.id);
                          } catch(e) {
                              showToast('Error', 'error');
                          }
                      });
                  }
              };
          });
      });
  }

  // Discusión Interna Event Listeners
  const btnSend = document.getElementById('btn-send-discussion');
  const inputDisc = document.getElementById('discussion-input');
  const chkIssue = document.getElementById('chk-has-issue');

  if (btnSend && inputDisc) {
      const sendComment = async () => {
          const text = inputDisc.value.trim();
          if (!text) return;
          const user = getCurrentUser();
          const comment = {
              type: 'user',
              user_id: user?.id,
              foto: user?.foto,
              user: user?.nombre || 'Usuario',
              text: text,
              date: new Date().toISOString()
          };
          
          if (!deal.discusion) deal.discusion = [];
          if (typeof deal.discusion === 'string') {
              try { deal.discusion = JSON.parse(deal.discusion); } catch(e) { deal.discusion = []; }
          }
          
          deal.discusion.push(comment);
          deal.tiene_problema = chkIssue.checked;

          try {
              btnSend.innerHTML = '...';
              await saveGranular('proyectos_dinamicos', [deal]);
              inputDisc.value = '';
              const list = document.getElementById('discussion-list');
              list.innerHTML = renderDiscussion(deal.discusion, pipeline.color);
              list.scrollTop = list.scrollHeight;
          } catch(e) {
              console.error("Save discussion error:", e);
              showToast('Error al guardar comentario: ' + e.message, 'error');
              deal.discusion.pop();
          } finally {
              btnSend.innerHTML = `<i class="fa-solid fa-paper-plane text-sm"></i>`;
          }

      };

      btnSend.addEventListener('click', sendComment);
      inputDisc.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') sendComment();
      });
  }

  if (chkIssue) {
      chkIssue.addEventListener('change', async () => {
          deal.tiene_problema = chkIssue.checked;
          try {
              await saveGranular('proyectos_dinamicos', [deal]);
              showToast(chkIssue.checked ? 'Marcado como problema' : 'Problema resuelto', 'success');
          } catch(e) {
              console.error("Save issue state error:", e);
              chkIssue.checked = !chkIssue.checked;
              deal.tiene_problema = chkIssue.checked;
              showToast('Error al actualizar estado: ' + e.message, 'error');
          }
      });
  }

  await renderDynamicAction(deal, pipeline, fases, curFidx, db);
}

// ─── INVENTORY CART LOGIC ───────────────────────────────────
let cart = [];
let cartDealId = null;
let cartSelectedSede = 'orlando';

window.openInventoryCart = (dealId) => {
    cartDealId = dealId;
    cart = [];
    const modal = document.getElementById('modal-inventory-cart');
    if (!modal) return;
    modal.classList.remove('hidden');
    
    renderCartSedes();
    renderCartItems();
    updateCartUI();
    
    // Search listener
    const search = document.getElementById('cart-inv-search');
    search.value = '';
    search.oninput = () => renderCartItems(search.value.toLowerCase());
    
    // Confirm button
    const btnConfirm = document.getElementById('btn-confirm-cart');
    btnConfirm.onclick = async () => {
        if (cart.length === 0) return;
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
        
        try {
            await processCartWithdrawal();
            modal.classList.add('hidden');
            // Refresh project inventory list
            const list = document.getElementById(`project-inventory-list-${cartDealId}`);
            if (list) list.innerHTML = renderProjectInventory(cartDealId);
            showToast('Retiro completado con éxito', 'success');
        } catch (e) {
            console.error(e);
            showToast('Error: ' + e.message, 'error');
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = '<i class="fa-solid fa-truck-ramp-box"></i> Confirmar Retiro (<span id="cart-count">0</span>)';
        }
    };
};

function renderCartSedes() {
    const container = document.getElementById('cart-sede-filters');
    const sedes = ['orlando', 'miami', 'dallas', 'new_york'];
    container.innerHTML = sedes.map(s => `
        <button onclick="window.setCartSede('${s}')" class="sede-tab-btn px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${cartSelectedSede === s ? 'bg-tealAccent text-black' : 'bg-gray-100 dark:bg-white/5 text-gray-400'}" data-sede="${s}">
            ${s.replace('_', ' ')}
        </button>
    `).join('');
}

window.setCartSede = (sede) => {
    cartSelectedSede = sede;
    renderCartSedes();
    renderCartItems();
};

function renderCartItems(query = '') {
    const container = document.getElementById('cart-inv-items');
    const db = getDB();
    const inv = db.inventarioGlobal || [];
    
    const filtered = inv.filter(item => {
        const matchesSede = item.locacion === cartSelectedSede;
        const matchesSearch = !query || item.nombreItem.toLowerCase().includes(query) || item.id.toLowerCase().includes(query);
        return matchesSede && matchesSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-center py-10 text-gray-400 text-xs italic">No hay artículos que coincidan</p>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const inCart = cart.find(c => c.id === item.id);
        const qtyInCart = inCart ? inCart.qty : 0;
        
        return `
            <div class="bg-gray-50 dark:bg-white/[0.03] p-4 rounded-2xl border border-gray-100 dark:border-white/5 flex items-center justify-between group">
                <div class="flex-1 min-width-0">
                    <p class="text-[8px] font-black text-tealAccent uppercase opacity-60">${item.id}</p>
                    <p class="text-sm font-black text-gray-900 dark:text-white uppercase truncate">${item.nombreItem}</p>
                    <p class="text-[10px] text-gray-400 font-bold uppercase mt-1">Stock: ${item.stockActual} unidades</p>
                </div>
                <div class="flex items-center gap-3">
                    ${qtyInCart > 0 ? `
                        <button onclick="window.updateCartQty('${item.id}', -1)" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                            <i class="fa-solid fa-minus text-xs"></i>
                        </button>
                        <span class="text-sm font-black text-gray-900 dark:text-white w-4 text-center">${qtyInCart}</span>
                    ` : ''}
                    <button onclick="window.updateCartQty('${item.id}', 1)" class="w-8 h-8 rounded-lg bg-tealAccent/10 text-tealAccent flex items-center justify-center" ${item.stockActual <= qtyInCart ? 'disabled opacity-30' : ''}>
                        <i class="fa-solid fa-plus text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.updateCartQty = (itemId, delta) => {
    const db = getDB();
    const item = (db.inventarioGlobal || []).find(i => i.id === itemId);
    if (!item) return;

    const idx = cart.findIndex(c => c.id === itemId);
    if (idx === -1 && delta > 0) {
        cart.push({ id: item.id, nombre: item.nombreItem, qty: 1, stock: item.stockActual });
    } else if (idx !== -1) {
        cart[idx].qty += delta;
        if (cart[idx].qty <= 0) cart.splice(idx, 1);
        else if (cart[idx].qty > item.stockActual) cart[idx].qty = item.stockActual;
    }
    
    renderCartItems(document.getElementById('cart-inv-search').value.toLowerCase());
    updateCartUI();
};

function updateCartUI() {
    const summary = document.getElementById('cart-summary');
    const emptyMsg = document.getElementById('cart-empty-msg');
    const countEl = document.getElementById('cart-count');
    const btn = document.getElementById('btn-confirm-cart');
    
    if (!summary || !countEl || !btn) return;

    const totalItems = cart.reduce((acc, curr) => acc + curr.qty, 0);
    countEl.textContent = totalItems;
    btn.disabled = cart.length === 0;

    if (cart.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        summary.querySelectorAll('.cart-item-row').forEach(r => r.remove());
    } else {
        if (emptyMsg) emptyMsg.style.display = 'none';
        summary.innerHTML = cart.map(c => `
            <div class="cart-item-row flex items-center justify-between bg-tealAccent/5 px-4 py-2 rounded-xl border border-tealAccent/10">
                <span class="text-[10px] font-black text-gray-900 dark:text-white uppercase truncate flex-1 mr-4">${c.nombre}</span>
                <span class="text-[11px] font-black text-tealAccent">x${c.qty}</span>
            </div>
        `).join('');
    }
}

async function processCartWithdrawal() {
    const db = getDB();
    const user = getCurrentUser();
    const proj = (db.Proyectos_Dinamicos || []).find(p => String(p.id) === String(cartDealId));
    if (!proj) throw new Error('Proyecto no encontrado');

    const client = (db.Clientes_Maestro || []).find(c => String(c.id) === String(proj.cliente_id));
    const clientName = client ? client.nombre : 'SIN CLIENTE';

    const userName = [user?.nombre, user?.apellido].filter(Boolean).join(' ') || user?.email || 'Técnico';
    const timestamp = new Date();
    
    // Determine project ecosystem from pipeline
    const pipelines = await getAdminPipelines();
    const pip = pipelines.find(p => String(p.id) === String(proj.pipeline_id));
    let projectEco = 'water';
    if (pip) {
        const name = (pip.nombre || '').toLowerCase();
        if (name.includes('solar')) projectEco = 'solar';
        else if (name.includes('home')) projectEco = 'home';
        else projectEco = 'water';
    }

    console.log(`[CART] Processing: Client=${clientName}, Eco=${projectEco}, Sede=${cartSelectedSede}`);
    
    const historyRecords = [];
    const stockUpdates = [];

    for (let i = 0; i < cart.length; i++) {
        const cartItem = cart[i];
        const invItem = (db.inventarioGlobal || []).find(item => item.id === cartItem.id);
        if (!invItem) continue;

        // Subtract stock locally
        invItem.stockActual -= cartItem.qty;
        stockUpdates.push(invItem);

        // Add history entry (with staggered timestamp to avoid onConflict: 'fecha' collisions)
        const entryTime = new Date(timestamp.getTime() + i * 10); 
        const historyEntry = {
            id: `hist_${entryTime.getTime()}_${Math.random().toString(36).slice(2,5)}`,
            fecha: entryTime.toISOString(),
            tecnico_nombre: userName,
            item_nombre: invItem.nombreItem,
            item_id: invItem.id,
            cantidad_retirada: cartItem.qty,
            sede: cartSelectedSede,
            ecosistema: projectEco, // Always use the project's ecosystem for history log visibility
            proyecto_id: cartDealId,
            cliente_nombre: clientName,
            tipo_movimiento: 'Salida (Proyecto)'
        };
        
        historyRecords.push(historyEntry);
        
        // Log to Kanban
        syncKanbanActivity({
            proyecto_id: cartDealId,
            evento: 'RETIRO_MATERIAL',
            campo_etiqueta: 'Inventario',
            archivo_nombre: `${cartItem.qty} x ${invItem.nombreItem}`,
            responsable_id: user?.id,
            fase_nombre: 'Materiales',
            skipSave: true
        });
    }

    // Map to Supabase column names (inventario_global uses nombre_item, locacion, stock_actual)
    const mappedStockUpdates = stockUpdates.map(item => ({
        id: item.id,
        nombre_item: item.nombreItem,
        locacion: item.locacion,
        ecosistema: item.ecosistema,
        category: item.category,
        medida: item.medida,
        boton: item.boton,
        color: item.color,
        stock_actual: item.stockActual,
        storage: item.storage,
        min_stock: item.minStock,
        price: item.price,
        image_url: item.imageUrl
    }));

    // Fast Granular saves
    const { saveGranular } = await import('../api.js');
    await saveGranular('inventario_global', mappedStockUpdates);
    await saveGranular('historial_inventario', historyRecords);

    // Update local cache for history since saveGranular might not handle 'historial_inventario' key perfectly for unshift
    if (!db.historialInventario) db.historialInventario = [];
    historyRecords.forEach(r => db.historialInventario.unshift(r));
    if (db.historialInventario.length > 500) db.historialInventario.length = 500;
}

window.deleteProjectMaterial = async (histId, dealId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro de retiro? El stock se devolverá al inventario.')) return;
    
    const db = getDB();
    const historial = db.historialInventario || [];
    const recordIndex = historial.findIndex(h => h.id === histId);
    if (recordIndex === -1) {
        showToast('Registro no encontrado', 'error');
        return;
    }
    
    const record = historial[recordIndex];
    const invItem = (db.inventarioGlobal || []).find(item => item.id === record.item_id);
    
    if (invItem) {
        // Return stock
        invItem.stockActual += record.cantidad_retirada;
        const mappedStockUpdate = {
            id: invItem.id,
            nombre_item: invItem.nombreItem,
            locacion: invItem.locacion,
            ecosistema: invItem.ecosistema,
            category: invItem.category,
            medida: invItem.medida,
            boton: invItem.boton,
            color: invItem.color,
            stock_actual: invItem.stockActual,
            storage: invItem.storage,
            min_stock: invItem.minStock,
            price: invItem.price,
            image_url: invItem.imageUrl
        };
        const { saveGranular } = await import('../api.js');
        await saveGranular('inventario_global', [mappedStockUpdate]);
    }
    
    // Remove from Supabase and local cache
    const { getSupabaseClient } = await import('../api.js');
    const supabase = getSupabaseClient();
    if (supabase) {
        await supabase.from('historial_inventario').delete().eq('id', histId);
    }
    
    historial.splice(recordIndex, 1);
    
    // Refresh project inventory list
    const list = document.getElementById(`project-inventory-list-${dealId}`);
    if (list) list.innerHTML = renderProjectInventory(dealId);
    showToast('Registro de retiro eliminado y stock devuelto', 'success');
};

async function renderDynamicAction(deal, pipeline, fases, curFidx, db) {
  const container = document.getElementById('dynamic-action-section');
  if (!container) return;
  
  if (curFidx === -1) {
    container.innerHTML = `
      <div class="slide-in-bottom" style="margin-top:24px; border-radius:24px; overflow:hidden; box-shadow:0 8px 32px ${pipeline.color}25;">
        <!-- Hero gradient banner -->
        <div style="background:linear-gradient(135deg,${pipeline.color},${pipeline.color}cc); padding:32px 24px; text-align:center; position:relative; overflow:hidden;">
          <div style="position:absolute;inset:0;background:radial-gradient(circle at 70% 30%,rgba(255,255,255,.15),transparent 60%);pointer-events:none;"></div>
          <!-- Big check icon -->
          <div style="width:72px;height:72px;background:rgba(255,255,255,.2);border:3px solid rgba(255,255,255,.5);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 0 0 12px rgba(255,255,255,.08);">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style="font-size:1.5rem;font-weight:900;color:#fff;margin:0 0 6px;letter-spacing:-0.5px;">¡Proyecto Finalizado!</h2>
          <p style="font-size:0.8rem;color:rgba(255,255,255,.8);font-weight:600;margin:0;text-transform:uppercase;letter-spacing:1px;">${pipeline.nombre || 'Todas las fases completadas'}</p>
        </div>
        <!-- Stats / Info row -->
        <div style="background:var(--surface,#fff);padding:20px 24px;display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:1px solid var(--border,#f0f0f0);">
          <div style="text-align:center;padding:12px;background:${pipeline.color}08;border-radius:14px;">
            <p style="font-size:1.4rem;font-weight:900;color:${pipeline.color};margin:0;">${fases.length}</p>
            <p style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin:4px 0 0;">Fases</p>
          </div>
          <div style="text-align:center;padding:12px;background:#10b98108;border-radius:14px;">
            <p style="font-size:1.4rem;font-weight:900;color:#10b981;margin:0;">100%</p>
            <p style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin:4px 0 0;">Completado</p>
          </div>
        </div>
        <!-- Action -->
        <div style="background:var(--surface,#fff);padding:16px 24px;border-radius:0 0 24px 24px;">
          <p style="font-size:0.75rem;color:#64748b;margin:0 0 14px;text-align:center;">Puedes revisar cualquier fase tocando los círculos del progreso.</p>
          <button onclick="window.appNavigate('dashboard')"
                  style="width:100%;background:${pipeline.color};color:#fff;border:none;border-radius:14px;padding:14px;font-size:0.9rem;font-weight:800;cursor:pointer;letter-spacing:0.5px;box-shadow:0 6px 20px ${pipeline.color}40;">
            ← Volver al Dashboard
          </button>
        </div>
      </div>
    `;
    return;
  }

  const actFase = fases[curFidx];
  const isLocked = deal.is_locked;
  const campos = db.Admin_Campos_Formulario.filter(c => c.fase_id === actFase.id);

  const existingResp = await getRespuestasByProyecto(deal.id);

  if (!campos.length) {
    const isWorkOrder = actFase.nombre.toLowerCase().includes('orden de trabajo');
    const isContract = actFase.nombre.toLowerCase().includes('contrato');
    const isCreditApp = actFase.nombre.toLowerCase().includes('aprobación') || actFase.nombre.toLowerCase().includes('crédito');
    
    container.innerHTML = `
      <div class="form-card slide-in-bottom" style="margin-top:24px; ${isLocked ? 'opacity:0.7; pointer-events:none; filter:grayscale(0.5)' : ''}">
        <div class="flex items-center gap-4 mb-4">
          <div class="bg-gray-100 text-gray-500 w-12 h-12 flex items-center justify-center rounded-full">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <h3 class="text-lg font-bold text-gray-800">${isLocked ? 'Fase Bloqueada' : (isWorkOrder ? 'Completar Orden de Trabajo' : isContract ? 'Completar Contrato' : isCreditApp ? 'Completar Aplicación de Crédito' : 'Fase en espera')}</h3>
            <p class="text-sm text-gray-600">${isLocked ? `Corresponde a: ${deal.rol_fase}` : (isWorkOrder || isContract || isCreditApp ? 'Ir a la sección correspondiente para llenarla.' : 'No hay acciones requeridas. Avanzar fase.')}</p>
          </div>
        </div>
        ${!isLocked && isWorkOrder ? `
          <button class="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity mb-3" style="background:#0d9488" id="btn-go-work-order">
            Llenar Orden de Trabajo
          </button>
        ` : ''}
        ${!isLocked && isContract ? `
          <button class="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity mb-3" style="background:#f59e0b" id="btn-go-contract">
            Llenar Contrato
          </button>
        ` : ''}
        ${!isLocked && isCreditApp ? `
          <button class="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity mb-3" style="background:#0284c7" id="btn-go-credit">
            Llenar Aplicación de Crédito
          </button>
        ` : ''}
        ${!isLocked && !isWorkOrder && !isContract && !isCreditApp ? `<button class="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity" style="background:${pipeline.color};" id="btn-advance-empty">Avanzar a la Siguiente Fase</button>` : ''}
      </div>`;
      
    if (!isLocked) {
      if (isWorkOrder) {
        const btnGo = document.getElementById('btn-go-work-order');
        if (btnGo) {
          btnGo.addEventListener('click', () => {
             const iframe = document.getElementById('iframe-work-order');
             if (iframe) iframe.src = 'FORMULARIO-RENEW-WATER-main/index.html?tab=workorder&proyectoId=' + deal.id;
             if (window.appNavigate) window.appNavigate('work-order');
          });
        }
      }
      if (isContract) {
        const btnGoC = document.getElementById('btn-go-contract');
        if (btnGoC) {
          btnGoC.addEventListener('click', () => {
             const iframe = document.getElementById('iframe-contract-app');
             if (iframe) iframe.src = 'CONTRATO-RENEW-WATER/index.html?tab=contract&v=' + Date.now() + '&proyectoId=' + deal.id + '&pipeline=' + encodeURIComponent(pipeline.nombre);
             if (window.appNavigate) window.appNavigate('contract-app');
          });
        }
      }
      if (isCreditApp) {
        const btnGoCr = document.getElementById('btn-go-credit');
        if (btnGoCr) {
          btnGoCr.addEventListener('click', () => {
             const iframe = document.getElementById('iframe-credit-app');
             if (iframe) iframe.src = 'FORMULARIO-RENEW-WATER-main/index.html?tab=credit&proyectoId=' + deal.id;
             if (window.appNavigate) window.appNavigate('credit-app');
          });
        }
      }
      const btnEmpty = document.getElementById('btn-advance-empty');
      if (btnEmpty) btnEmpty.addEventListener('click', () => submitPhase(deal.id, {}, pipeline.nombre));
    }
    return;
  }

  const fileAnswers = {};

  const inputsHtml = campos.map(c => {
    let html = '';
    const disabledAttr = isLocked ? 'disabled' : '';
    const lockedStyle = isLocked ? 'opacity:0.6; cursor:not-allowed;' : '';
    
    const saved = existingResp.find(r => r.campo_id === c.id);
    const val = saved ? saved.valor : '';

    if(c.tipo === 'Desplegable') {
       const opts = (c.opciones || "").split(',').map(o => {
         const optVal = o.trim();
         const isSelected = val === optVal ? 'selected' : '';
         return `<option value="${optVal}" ${isSelected}>${optVal}</option>`;
       }).join('');
       html = `<div class="input-wrap select-wrap no-icon"><select id="df_${c.id}" ${disabledAttr} style="${lockedStyle}"><option disabled ${!val ? 'selected' : ''}>Elegir...</option>${opts}</select></div>`;
    } else if (c.tipo === 'Aplicación de Crédito') {
       const isDone = !!(val && val !== 'No subido' && val !== 'No provisto');
       html = `
        <div style="margin-bottom:16px;">
          <label class="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">${c.etiqueta}</label>
          ${isDone ? `
            <div style="background:#0284c715; border:1px solid #0284c740; border-radius:12px; padding:12px 16px; display:flex; align-items:center; gap:12px;">
              <div style="background:#0284c720; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span style="color:#0284c7; font-size:0.85rem; font-weight:700;">Aplicación de Crédito Completada</span>
              ${val.startsWith('http') ? `<button onclick="window.open('${val}')" style="margin-left:auto; background:#0284c7; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:0.7rem; font-weight:bold; cursor:pointer">Ver PDF</button>` : ''}
            </div>
          ` : `
            <button type="button" class="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity" style="background:#0284c7" ${disabledAttr} onclick="
              const iframe = document.getElementById('iframe-credit-app');
              if (iframe) iframe.src = 'FORMULARIO-RENEW-WATER-main/index.html?tab=credit&proyectoId=${deal.id}';
              if (window.appNavigate) window.appNavigate('credit-app');
            ">
              Llenar Aplicación de Crédito
            </button>
          `}
          <input type="hidden" id="df_${c.id}" value="${val || 'Completado en Formulario Externo'}" />
        </div>
       `;
    } else if (c.tipo === 'Orden de Trabajo') {
       const isDone = !!(val && val !== 'No subido' && val !== 'No provisto');
       html = `
        <div style="margin-bottom:16px;">
          <label class="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">${c.etiqueta}</label>
          ${isDone ? `
            <div style="background:#0d948815; border:1px solid #0d948840; border-radius:12px; padding:12px 16px; display:flex; align-items:center; gap:12px;">
              <div style="background:#0d948820; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span style="color:#0d9488; font-size:0.85rem; font-weight:700;">Orden de Trabajo Completada</span>
              ${val.startsWith('http') ? `<button onclick="window.open('${val}')" style="margin-left:auto; background:#0d9488; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:0.7rem; font-weight:bold; cursor:pointer">Ver PDF</button>` : ''}
            </div>
          ` : `
            <button type="button" class="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity" style="background:#0d9488" ${disabledAttr} onclick="
              const iframe = document.getElementById('iframe-work-order');
              if (iframe) iframe.src = 'FORMULARIO-RENEW-WATER-main/index.html?tab=workorder&proyectoId=${deal.id}';
              if (window.appNavigate) window.appNavigate('work-order');
            ">
              Llenar Orden de Trabajo
            </button>
          `}
          <input type="hidden" id="df_${c.id}" value="${val || 'Completado en Formulario Externo'}" />
        </div>
       `;
    } else if (c.tipo === 'Contrato') {
        const pip = db.Admin_Pipelines?.find(p => p.id === deal.pipeline_id) || {};
        const prefix = (pip.nombre || '').toLowerCase().includes('solar') ? 'solar' : 'water';
        
        // Check both project responses and client metadata
        const hasProjectResp = !!(val && val !== 'No subido' && val !== 'No provisto');
        const hasClientMetadata = !!(deal[`contrato_${prefix}_url`] || deal.contrato_url);
        const isDone = hasProjectResp || hasClientMetadata;
        const finalUrl = hasProjectResp ? val : (deal[`contrato_${prefix}_url`] || deal.contrato_url);

        html = `
         <div style="margin-bottom:16px;">
           <label class="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">${c.etiqueta}</label>
           ${isDone ? `
             <div style="background:#f59e0b15; border:1px solid #f59e0b40; border-radius:12px; padding:12px 16px; display:flex; align-items:center; gap:12px;">
               <div style="background:#f59e0b20; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
               </div>
               <span style="color:#f59e0b; font-size:0.85rem; font-weight:700;">Contrato Firmado y Guardado</span>
               ${(finalUrl && finalUrl.startsWith('http')) ? `<button onclick="window.open('${finalUrl}')" style="margin-left:auto; background:#f59e0b; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:0.7rem; font-weight:bold; cursor:pointer">Ver PDF</button>` : ''}
             </div>
           ` : `
             <button type="button" class="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity" style="background:#f59e0b" ${disabledAttr} onclick="
               const iframe = document.getElementById('iframe-contract-app');
               if (iframe) iframe.src = 'CONTRATO-RENEW-WATER/index.html?tab=contract&v=${Date.now()}&proyectoId=${deal.id}&pipeline=${encodeURIComponent(pipeline.nombre)}';
               if (window.appNavigate) window.appNavigate('contract-app');
             ">
               Llenar Contrato
             </button>
           `}
           <input type="hidden" id="df_${c.id}" value="${val || 'Completado en Formulario Externo'}" />
         </div>
        `;
    } else if (c.tipo === 'Archivo') {
       let textLabel = ((c.etiqueta || "").toLowerCase().includes('subir') ? c.etiqueta : `Subir ${c.etiqueta}`) + (c.es_opcional ? ' (Opcional)' : '');

       // A field is "done" if it has a previously saved value (any format: base64 or URL)
       const hasFile = !!(val && val !== 'No subido' && val !== 'No provisto' && (val.startsWith('data:') || val.startsWith('http') || val.startsWith('/api/')));
       if (hasFile) fileAnswers[c.id] = val;

       // Also auto-fill from client's id_photo for ID photo fields
       const etiqLower = (c.etiqueta || '').toLowerCase();
       const isIdField = etiqLower.includes('foto id') || etiqLower.includes('id del cliente')
                      || etiqLower.includes('licencia de conducir') || etiqLower.includes('foto del cliente');
       if (!hasFile && isIdField && deal.id_photo) {
           fileAnswers[c.id] = deal.id_photo;
       }

       const isDone = hasFile || !!(fileAnswers[c.id]);
       
       let firstVal = (fileAnswers[c.id] || val);
       let valCount = 1;
       if (firstVal && firstVal.includes(',')) {
           const parts = firstVal.split(',').map(s=>s.trim()).filter(s=>s);
           if (parts.length > 0) {
               firstVal = parts[0];
               valCount = parts.length;
           }
       }

       const isImage = firstVal && (firstVal.startsWith('data:image') || firstVal.match(/\.(jpg|jpeg|png|gif|webp|svg)/i));
       const donePhotoSrc = isDone && isImage ? firstVal : (deal.id_photo?.startsWith('data:image') ? deal.id_photo : null);

       if (isDone) {
         // Render gallery of thumbnails and allow adding more
         const parts = (fileAnswers[c.id] || val || '').split(',').map(s=>s.trim()).filter(s=>s && s !== 'No subido' && s !== 'No provisto');
         
         const thumbnailsHtml = parts.map((fUrl, i) => {
             const isImg = fUrl.startsWith('data:image') || fUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
             const safeLabel = (c.etiqueta || '').replace(/'/g, "\\'");
             return `
               <div class="group relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center" style="width: 48px; height: 48px; flex-shrink: 0;">
                 ${isImg
                   ? `<img src="${fUrl}" class="w-full h-full object-cover" />`
                   : `<i class="fas fa-file-pdf text-red-400 text-xl"></i>`
                 }
                 <button onclick="event.preventDefault(); event.stopPropagation(); if(typeof window.openFilePreview === 'function') { window.openFilePreview('${c.id}', '${safeLabel}', { valor: '${fUrl}' }); } else { window.open('${fUrl}', '_blank'); }" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                   <i class="fas ${isImg ? 'fa-eye' : 'fa-download'} text-white text-xs"></i>
                 </button>
                 <button onclick="event.preventDefault(); event.stopPropagation(); window.deleteProjectDetailFile('${deal.id}', '${c.id}', '${fUrl}');" style="position:absolute; top:-2px; right:-2px; background:#ef4444; color:white; border:none; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.2);"><i class="fas fa-times" style="font-size:8px;"></i></button>
               </div>
             `;
         }).join('');

         html = `
          <div class="upload-area has-file" id="ubox_${c.id}"
               style="margin-bottom:16px;display:block;border-color:${pipeline.color};background:${pipeline.color}15;padding:12px 16px;position:relative;border-radius:12px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <div style="flex:1;min-width:0;">
                <p style="font-size:0.7rem;font-weight:800;text-transform:uppercase;color:${pipeline.color};letter-spacing:0.05em;margin:0;">${parts.length > 1 ? parts.length + ' Archivos Cargados' : 'Archivo Cargado'}</p>
                <p style="font-size:0.7rem;color:var(--text-muted);margin:0;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.etiqueta}</p>
              </div>
              ${!isLocked ? `
              <label for="df_${c.id}" style="background:${pipeline.color}; color:white; padding:6px 12px; border-radius:8px; font-size:0.7rem; font-weight:800; cursor:pointer; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
                <i class="fas fa-plus"></i> Añadir
              </label>
              <input type="file" id="df_${c.id}" accept="image/*,.pdf" multiple style="display:none" ${disabledAttr}/>
              ` : ''}
            </div>
            
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
               ${thumbnailsHtml}
            </div>
            <p id="ulbl_${c.id}" style="display:none;"></p>
          </div>
         `;
       } else {
         // OPEN: field not yet filled — show normal upload button
         html = `
          <label class="upload-area ${isLocked ? 'locked-upload' : ''}" id="ubox_${c.id}"
                 for="df_${c.id}"
                 style="margin-bottom:16px;cursor:${isLocked ? 'not-allowed' : 'pointer'};display:block;${lockedStyle}">
            <input type="file" id="df_${c.id}" accept="image/*,.pdf" multiple style="display:none" ${disabledAttr}/>
            <div class="upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <polyline points="9 15 12 12 15 15"/>
              </svg>
            </div>
            <p id="ulbl_${c.id}" style="font-size:0.75rem;font-weight:600;">${isLocked ? 'Lectura bloqueada' : textLabel}</p>
          </label>
         `;
       }
     } else if (c.tipo === 'Recibo Vendedor' || c.tipo === 'Recibo Representante' || c.tipo === 'Recibo Tecnico') {
        const isRepresentante = c.tipo === 'Recibo Vendedor' || c.tipo === 'Recibo Representante';
        const recColor   = isRepresentante ? '#3b82f6' : '#10b981';
       const isDone = !!(val && val !== 'No subido' && val !== 'No provisto');
       html = `
         <div style="margin-bottom:16px;" id="recibo-wrap-${c.id}">
           <label class="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">${c.etiqueta}</label>
           ${isDone ? `
             <div style="background:${recColor}15;border:1px solid ${recColor}40;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:12px;">
               <div style="background:${recColor}20;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${recColor}" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
               </div>
               <span style="color:${recColor};font-size:0.85rem;font-weight:700;">Recibo Completado <i class="fa-solid fa-check text-green-500"></i></span>
                               <button onclick="${val && (val.startsWith('http') || val.startsWith('/api/')) ? `window.open('${val}','_blank')` : `window._abrirReciboModal('${c.id}','${c.tipo}','${deal.id}')`}" style="margin-left:auto;background:${recColor};color:white;border:none;padding:4px 10px;border-radius:6px;font-size:0.7rem;font-weight:bold;cursor:pointer;">${val && (val.startsWith('http') || val.startsWith('/api/')) ? '<i class="fa-solid fa-eye"></i>️ Ver PDF' : 'Ver'}</button>
             </div>
           ` : `
             <button type="button" onclick="window._abrirReciboModal('${c.id}','${c.tipo}','${deal.id}')"
               style="width:100%;background:${recColor};color:white;border:none;padding:14px;border-radius:12px;font-size:0.9rem;font-weight:800;cursor:pointer;box-shadow:0 4px 16px ${recColor}30;" ${disabledAttr}>
               ${isRepresentante ? '<i class="fa-solid fa-money-bill"></i> Llenar Recibo de Pago – Representante de Ventas' : '<i class="fa-solid fa-wrench"></i> Llenar Recibo de Instalación – Técnico'}
             </button>
           `}
           <input type="hidden" id="df_${c.id}" value="${val || ''}"/>
         </div>
       `;
     } else if (c.tipo === 'Técnico') {
       // Cargar técnicos desde la DB
       const allUsers = getDB()?.Usuarios || [];
       const technicians = allUsers.filter(w => w.rol === 'Técnico' || w.rol === 'Tecnico');
       const opts = technicians.map(w => {
         const name = `${w.nombre} ${w.apellido || ''}`.trim();
         return `<option value="${w.id}" ${val === w.id ? 'selected' : ''}>${name}</option>`;
       }).join('');
       html = `
         <div class="input-wrap select-wrap no-icon">
           <select id="df_${c.id}" ${disabledAttr} style="${lockedStyle}; width:100%; padding:12px 14px; border-radius:12px; font-size:0.9rem; font-weight:600; background:var(--surface-alt); border:1px solid var(--border); color:var(--text-primary); appearance:none;">
             <option value="" ${!val ? 'selected' : ''}>Escoger Técnico...</option>
             ${opts}
           </select>
         </div>
       `;
     } else if (c.tipo === 'Fecha y Hora') {
       html = `
         <div class="input-wrap no-icon">
           <input type="datetime-local" id="df_${c.id}" value="${val}" ${disabledAttr}
                  style="${lockedStyle}; width:100%; padding:12px 14px; border-radius:12px; font-size:0.9rem; font-weight:600; background:var(--surface-alt); border:1px solid var(--border); color:var(--text-primary);"
                  onclick="this.showPicker ? this.showPicker() : ''">
         </div>
       `;
     } else if (c.tipo === 'Fecha') {
       html = `
         <div class="input-wrap no-icon">
           <input type="date" id="df_${c.id}" value="${val}" ${disabledAttr}
                  style="${lockedStyle}; width:100%; padding:12px 14px; border-radius:12px; font-size:0.9rem; font-weight:600; background:var(--surface-alt); border:1px solid var(--border); color:var(--text-primary);"
                  onclick="this.showPicker ? this.showPicker() : ''">
         </div>
       `;
     } else {
       html = `<div class="input-wrap no-icon"><input type="${c.tipo==='Número'?'number':'text'}" id="df_${c.id}" class="w-full" placeholder="${c.etiqueta}..." value="${val}" ${disabledAttr} style="${lockedStyle}"></div>`;
     }
    return c.tipo === 'Archivo' ? html : `<div class="field-group"><label>${c.etiqueta} ${c.es_opcional ? '<span style="text-transform:none; font-weight:normal; font-style:italic; font-size:0.85em; color:var(--text-muted);">(Opcional)</span>' : ''}</label>${html}</div>`;
  }).join('');

  const requiredCampos = campos.filter(c => !c.es_opcional);
  const numRequiredFilled = existingResp.filter(r => requiredCampos.some(c => c.id === r.campo_id) && r.valor && r.valor !== "No subido" && r.valor !== "No provisto").length;
  const isComplete = numRequiredFilled >= requiredCampos.length;

  // Force special buttons if phase name matches but they are not in campos
  const actNomLower = actFase.nombre.toLowerCase();
  const isCreditAppPhase = actNomLower.includes('aprobación') || actNomLower.includes('crédito');
  const isWorkOrderPhase = actNomLower.includes('orden de trabajo');
  const isContractPhase = actNomLower.includes('contrato');

  const hasCreditField = campos.some(c => c.tipo === 'Aplicación de Crédito');
  const hasWorkOrderField = campos.some(c => c.tipo === 'Orden de Trabajo');
  const hasContractField = campos.some(c => c.tipo === 'Contrato');
  
  let extraHtml = '';
  if (!isLocked) {
      if (isCreditAppPhase && !hasCreditField) {
          const isDone = existingResp.some(r => r.valor && (r.valor.startsWith('http') || r.valor.startsWith('/api/')) && (db.Admin_Campos_Formulario.find(c => c.id === r.campo_id)?.tipo === 'Aplicación de Crédito'));
          if (!isDone) {
            extraHtml += `
              <div style="margin-top:16px; padding-top:16px; border-top:1px dashed #e2e8f0;">
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Acción Requerida para ${actFase.nombre}</p>
                <button type="button" class="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity" style="background:#0284c7" onclick="
                  const iframe = document.getElementById('iframe-credit-app');
                  if (iframe) iframe.src = 'FORMULARIO-RENEW-WATER-main/index.html?tab=credit&proyectoId=${deal.id}';
                  if (window.appNavigate) window.appNavigate('credit-app');
                ">
                  Llenar Aplicación de Crédito
                </button>
              </div>
            `;
          }
      }
      if (isWorkOrderPhase && !hasWorkOrderField) {
          const isDone = existingResp.some(r => r.valor && (r.valor.startsWith('http') || r.valor.startsWith('/api/')) && (db.Admin_Campos_Formulario.find(c => c.id === r.campo_id)?.tipo === 'Orden de Trabajo'));
          if (!isDone) {
            extraHtml += `
              <div style="margin-top:16px; padding-top:16px; border-top:1px dashed #e2e8f0;">
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Acción Requerida para ${actFase.nombre}</p>
                <button type="button" class="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity" style="background:#0d9488" onclick="
                  const iframe = document.getElementById('iframe-work-order');
                  if (iframe) iframe.src = 'FORMULARIO-RENEW-WATER-main/index.html?tab=workorder&proyectoId=${deal.id}';
                  if (window.appNavigate) window.appNavigate('work-order');
                ">
                  Llenar Orden de Trabajo
                </button>
              </div>
            `;
          }
      }
      if (isContractPhase && !hasContractField) {
          const pip = db.Admin_Pipelines?.find(p => p.id === deal.pipeline_id) || {};
          const prefix = (pip.nombre || '').toLowerCase().includes('solar') ? 'solar' : 'water';
          
          const hasProjectResp = existingResp.some(r => r.valor && (r.valor.startsWith('http') || r.valor.startsWith('/api/')) && (db.Admin_Campos_Formulario.find(c => c.id === r.campo_id)?.tipo === 'Contrato'));
          const hasClientMetadata = !!(deal[`contrato_${prefix}_url`] || deal.contrato_url);
          const isDone = hasProjectResp || hasClientMetadata;

          if (!isDone) {
            extraHtml += `
              <div style="margin-top:16px; padding-top:16px; border-top:1px dashed #e2e8f0;">
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Acción Requerida para ${actFase.nombre}</p>
                <button type="button" class="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity" style="background:#f59e0b" onclick="
                  const iframe = document.getElementById('iframe-contract-app');
                  if (iframe) iframe.src = 'CONTRATO-RENEW-WATER/index.html?tab=contract&v=${Date.now()}&proyectoId=${deal.id}&pipeline=${encodeURIComponent(pipeline.nombre)}';
                  if (window.appNavigate) window.appNavigate('contract-app');
                ">
                  Llenar Contrato
                </button>
              </div>
            `;
          }
      }
  }

  container.innerHTML = `
    <div class="form-card slide-in-bottom border-l-4" style="border-left-color:${isLocked ? '#94a3b8' : pipeline.color}; padding-top:24px; padding-bottom:24px; border-radius:16px; margin-top:24px; position:relative;">
      ${isLocked ? `
        <div style="position:absolute; top:12px; right:16px; background:#f1f5f9; color:#64748b; padding:4px 10px; border-radius:8px; font-size:0.6rem; font-weight:800; display:flex; align-items:center; gap:4px; text-transform:uppercase;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Vista de Solo Lectura
        </div>
      ` : ''}
      
      <h3 class="text-lg font-bold text-gray-800 mb-2">${isLocked ? 'Fase en Proceso' : `Acción: Llenar ${actFase.nombre}`}</h3>
      <p class="text-xs text-gray-500 mb-6" id="phase-status-desc">
        ${isLocked ? `Esta etapa debe ser completada por <strong>${deal.rol_fase}</strong>. Puedes ver los avances aquí.` : 
          (isComplete ? '¡Todo listo! Ya puedes finalizar esta etapa.' : `Faltan <strong>${requiredCampos.length - numRequiredFilled}</strong> campos obligatorios para poder avanzar.`)}
      </p>
      
      <div id="form-fields-container" style="${isLocked ? 'pointer-events:none' : ''}">
        ${inputsHtml}
        ${extraHtml}
      </div>

      ${!isLocked ? `
        <button id="btn-dyn-submit" class="btn btn-primary slide-in-right" 
                style="width:100%; height:56px; font-size:1.05rem; box-shadow:0 8px 24px ${pipeline.color}40; background:${pipeline.color}; margin-top:20px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px"><polyline points="20 6 9 17 4 12"/></svg>
          <span id="label-submit-text">${isComplete ? 'Finalizar Fase y Enviar' : 'Guardar Avances'}</span>
        </button>
      ` : `
        <div style="margin-top:20px; padding:16px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:12px; text-align:center;">
          <p style="font-size:0.75rem; color:#64748b; font-weight:600;">Serás notificado cuando sea tu turno.</p>
        </div>
      `}
    </div>
  `;

  if (!isLocked) {
    const user = getCurrentUser();
    const btnSubmit = document.getElementById('btn-dyn-submit');

    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => {
        // ── VALIDACIÓN DE DATOS DEL CLIENTE ──
        // Bloquear avance si faltan datos básicos del cliente
        const missingFields = [];
        if (!deal.nombre_cliente || deal.nombre_cliente.trim() === '') missingFields.push('Nombre del cliente');
        if (!deal.email || deal.email.trim() === '' || deal.email === 'N/A') missingFields.push('Email');
        if (!deal.telefono || deal.telefono.trim() === '') missingFields.push('Teléfono');
        if (!deal.direccion || deal.direccion.trim() === '') missingFields.push('Dirección');

        if (missingFields.length > 0) {
          showToast(`<i class="fa-solid fa-triangle-exclamation text-orange-500"></i> Faltan datos del cliente: ${missingFields.join(', ')}. Completa el perfil antes de avanzar.`, 'error');
          return;
        }

        const resp = {};
        for (const c of campos) {
          const el = document.getElementById(`df_${c.id}`);
          const val = c.tipo === 'Archivo' ? (fileAnswers[c.id] || "") : (el?.value || "").trim();
          resp[c.id] = val || "No provisto";
        }
        btnSubmit.innerHTML = 'Espere...';
        submitPhase(deal.id, resp, actFase.nombre);
      });
    }

    setTimeout(() => {
      campos.filter(c => c.tipo === 'Archivo').forEach(c => {
        const input = document.getElementById(`df_${c.id}`);
        const area = document.getElementById(`ubox_${c.id}`);
        const label = document.getElementById(`ulbl_${c.id}`);
        if(input) {
          input.addEventListener('change', async () => {
            if (input.files.length) {
              const addBtn = document.querySelector(`label[for="df_${c.id}"]`);
              const oldHtml = addBtn ? addBtn.innerHTML : '';
              if (addBtn) addBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Subiendo...`;
              if (label) label.textContent = `Subiendo...`;
              
              let fileUrls = [];
              for (let i = 0; i < input.files.length; i++) {
                  const file = input.files[i];
                  const url = await uploadFile(file, 'projects');
                  if (url) fileUrls.push(url);
              }
              
              if (fileUrls.length > 0) {
                  const existingVals = (fileAnswers[c.id] || '').split(',').map(s=>s.trim()).filter(s=>s && s !== 'No subido' && s !== 'No provisto');
                  fileAnswers[c.id] = [...existingVals, ...fileUrls].join(',');
                  
                  if (area) {
                    area.classList.add('has-file');
                    area.style.borderColor = pipeline.color;
                    area.style.background = pipeline.color + '15';
                    const icon = area.querySelector('.upload-icon');
                    if (icon) icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${pipeline.color}" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
                  }
                  
                  const totalCount = [...existingVals, ...fileUrls].length;
                  if (label) { label.textContent = totalCount > 1 ? `${totalCount} Archivos Cargados` : `Archivo Cargado`; label.style.color = pipeline.color; }
                  
                  syncKanbanActivity({
                    proyecto_id: deal.id,
                    evento: 'ARCHIVO_SUBIDO',
                    campo_etiqueta: c.etiqueta,
                    archivo_nombre: input.files[0].name + (input.files.length > 1 ? ` y ${input.files.length-1} más` : ''),
                    responsable_id: user?.id,
                    fase_nombre: actFase.nombre
                  });

                  notifyWebhook({
                    evento: 'ARCHIVO_SUBIDO',
                    proyecto_id: deal.id,
                    cliente_nombre: deal.nombre_cliente,
                    pipeline: pipeline.nombre,
                    fase_actual: actFase.nombre,
                    campo_id: c.id,
                    campo_etiqueta: c.etiqueta,
                    archivo_nombre: input.files[0].name,
                    responsable_id: user?.id,
                    timestamp: new Date().toISOString()
                  });

                  submitPhase(deal.id, { [c.id]: fileAnswers[c.id] }, actFase.nombre, { preventAutoAdvance: true });
              } else {
                  if (label) label.textContent = `Error al subir`;
                  if (addBtn) addBtn.innerHTML = oldHtml;
              }
            }
          });
        }
      });
    }, 100);
  }
}

async function submitPhase(dealId, resp, faseNombre, options = {}) {
  try {
    const res = await advanceDealPhase(dealId, resp, options);
    if (res.didAdvance) {
      showToast(`¡Fase completada! Avanzando...`, 'success');
      setTimeout(() => {
        if (res.isCompletado) navigate('dashboard');
        else renderDetail(dealId); 
      }, 1000);
    } else {
      showToast(`Avances guardados correctamente.`, 'info');
      setTimeout(() => renderDetail(dealId), 800);
    }
  } catch(e) {
    showToast(e.message, 'error');
  }
}

window.deleteProjectDetailFile = async function(projectId, campoId, urlToDelete) {
    if (!confirm('¿Estás seguro de que deseas eliminar este archivo?')) return;
    
    try {
        const { getDB, saveGranular, deleteRecord } = await import('../api.js');
        const dbLocal = getDB() || {};
        const resp = (dbLocal.Respuestas_Dinamicas || []).find(r => r.proyecto_id === projectId && String(r.campo_id) === String(campoId));
        if (!resp || !resp.valor) return;

        let existingVals = resp.valor.split(',').map(s=>s.trim()).filter(s=>s);
        const newVals = existingVals.filter(url => url !== urlToDelete);
        const finalUrlStr = newVals.join(',');

        if (finalUrlStr === '') {
            if (deleteRecord) await deleteRecord('respuestas_dinamicas', resp.id);
            const idx = dbLocal.Respuestas_Dinamicas.findIndex(r => r.proyecto_id === projectId && String(r.campo_id) === String(campoId));
            if (idx > -1) dbLocal.Respuestas_Dinamicas.splice(idx, 1);
        } else {
            resp.valor = finalUrlStr;
            resp.actualizado_en = new Date().toISOString();
            if (saveGranular) await saveGranular('respuestas_dinamicas', [resp]);
        }

        // Check if it's a receipt to also delete the commission record
        const campo = (dbLocal.Admin_Campos_Formulario || []).find(c => String(c.id) === String(campoId));
        if (campo && finalUrlStr === '') {
            const label = (campo.etiqueta || '').toLowerCase();
            const isReceiptLabel = label.includes('recibo') || label.includes('pago') || label.includes('comisi') || label.includes('comprobante');
            if (isReceiptLabel) {
                const isVendedor = label.includes('vendedor') || label.includes('representante') || label.includes('comision vendedor') || label.includes('comisión vendedor');
                const reciboId = `rec_up_${projectId}_${isVendedor ? 'v' : 't'}`;
                const { deleteRecord } = await import('../api.js');
                if (deleteRecord) {
                    try { await deleteRecord('recibos_pagos', reciboId); } catch(e){}
                }
                const idx = (dbLocal.Recibos_Pagos || []).findIndex(r => r.id === reciboId);
                if (idx > -1) dbLocal.Recibos_Pagos.splice(idx, 1);
            }
        }

        showToast('Archivo eliminado', 'success');
        renderDetail(projectId);
    } catch (e) {
        console.error(e);
        alert('Error al eliminar el archivo: ' + e.message);
    }
};

// --------------------------------------------------------------
//  RECIBO MODAL – Representante & Técnico
// --------------------------------------------------------------
window._abrirReciboModal = async function(campoId, tipo, dealId) {
  const isVendedor = tipo === 'Recibo Vendedor' || tipo === 'Recibo Representante';
  const existingModal = document.getElementById('modal-recibo-dinamico');
  if (existingModal) existingModal.remove();

  // Importar herramientas necesarias
  const { getDB, saveRecibo, getCurrentUser } = await import('../api.js');
  const db = getDB();
  const user = getCurrentUser() || {};
  const deal = (db.Proyectos_Dinamicos || []).find(p => p.id === dealId) || {};
  const cli  = (db.Clientes_Maestro || []).find(c => c.id === deal.cliente_id) || {};
  const tecnicoAsignado = (db.Usuarios || []).find(u => (u.rol === "tecnico" || u.rol === "técnico") && (u.id === deal.tecnico_id || u.id === deal.asignado_a));
  
  const tecnicoNom = tecnicoAsignado ? (tecnicoAsignado.nombre + " " + (tecnicoAsignado.apellido || "")) : "";
  const vendedorNom = (user.nombre || "") + " " + (user.apellido || "");
  const clienteNom = cli.nombre || deal.nombre_cliente || "";

  const modal = document.createElement('div');
  modal.id = 'modal-recibo-dinamico';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:24px;width:100%;max-width:550px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 48px rgba(0,0,0,0.4);animation:modalIn 0.3s ease-out;">
      <div style="padding:24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:1.1rem;font-weight:900;color:var(--text-primary);margin:0;">${isVendedor ? 'Recibo de Pago' : 'Recibo de Instalación'}</h3>
          <p style="font-size:0.75rem;color:var(--text-muted);margin:4px 0 0;">${clienteNom}</p>
        </div>
        <button id="btn-close-recibo" style="background:var(--surface-alt);border:none;border-radius:12px;width:40px;height:40px;color:var(--text-primary);cursor:pointer;"><i class="fa-solid fa-xmark text-red-500"></i></button>
      </div>
      <div id="recibo-form-fields" style="flex:1;overflow-y:auto;padding:24px;background:var(--bg-main);">
        ${isVendedor ? _buildFormVendedor(vendedorNom, tecnicoNom, clienteNom) : (!tecnicoAsignado ? 
            `<div style="text-align:center;padding:40px 20px;">
              <i class="fa-solid fa-user-xmark text-red-500" style="font-size:3rem;margin-bottom:16px;"></i>
              <h4 style="font-size:1.2rem;font-weight:800;color:var(--text-primary);margin-bottom:8px;">No hay técnico asignado</h4>
              <p style="font-size:0.9rem;color:var(--text-muted);">El proyecto no tiene un técnico asignado. Por favor, asigna uno antes de llenar el recibo de instalación.</p>
            </div>` 
          : _buildFormTecnico(tecnicoNom, clienteNom))}
      </div>
      <div style="padding:24px;border-top:1px solid var(--border);display:flex;gap:12px;">
        <button id="btn-guardar-recibo" style="flex:1;background:var(--accent);color:white;border:none;border-radius:14px;padding:16px;font-weight:800;font-size:0.95rem;cursor:pointer;box-shadow:0 8px 16px var(--accent-alpha);" ${!isVendedor && !tecnicoAsignado ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
          Guardar Recibo
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  // Manejo de eventos
  modal.querySelector('#btn-close-recibo').onclick = () => modal.remove();
  
  if (!isVendedor) {
    modal.querySelector('#btn-add-item').onclick = () => {
      const container = modal.querySelector('#items-container');
      const row = document.createElement('div');
      row.className = 'item-row';
      row.style.cssText = 'display:grid;grid-template-columns:2fr 60px 1fr 80px 20px;gap:6px;margin-bottom:8px;align-items:center;';
      row.innerHTML = `
        <input type="text" placeholder="Descripción..." style="background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;"/>
        <input type="number" placeholder="1" value="1" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;"/>
        <input type="text" placeholder="Modelo" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;"/>
        <input type="number" placeholder="0.00" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;"/>
        <button type="button" onclick="this.closest('.item-row').remove()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.2rem;font-weight:900;"><i class="fa-solid fa-xmark text-red-500"></i></button>`;
      container.appendChild(row);
    };
  }

  modal.querySelector('#btn-guardar-recibo').onclick = async () => {
    const btn = modal.querySelector('#btn-guardar-recibo');
    btn.textContent = 'Guardando...';
    btn.disabled = true;
    
    try {
      const g = id => modal.querySelector('#rec-' + id)?.value || '';
      let datosJson = {};

      if (isVendedor) {
        const extraCharges = [...modal.querySelectorAll('.extra-charge-row')].map(r => {
          const [conc, monto] = r.querySelectorAll('input'); return { concepto: conc.value, monto: parseFloat(monto.value)||0 };
        }).filter(x => x.concepto);
        
        datosJson = {
          sales_representative: g('sales-rep'),
          check_number: g('check-number'),
          transfer_date: g('transfer-date'),
          customer_name: g("customer-name") || clienteNom,
          finance_company: g('finance'),
          sales_amount: parseFloat(g('sales-amount'))||0,
          aprobacion_pct: parseFloat(g('aprobacion-pct'))||0,
          monto_aprobacion: parseFloat(g('monto-aprobacion'))||0,
          cost: parseFloat(g('cost'))||0,
          costo_plan_pct: parseFloat(g('costo-plan-pct'))||0,
          total_costo: parseFloat(g('total-costo'))||0,
          linea_pozo: g('linea-pozo'),
          total_analista: parseFloat(g('total-analista'))||0,
          extra_charges: extraCharges,
          instalador: g('instalador'),
          grand_total: parseFloat(g('grand-total'))||0
        };
      } else {
        const items = [...modal.querySelectorAll('.item-row')].map(row => {
          const inputs = row.querySelectorAll('input');
          return { description: inputs[0].value, qty: parseFloat(inputs[1].value)||1, model: inputs[2].value, total: parseFloat(inputs[3].value)||0 };
        }).filter(i => i.description);
        
        datosJson = {
          installer_name: tecnicoNom,
          customer_name: g("customer-name") || clienteNom,
          address: cli.direccion || deal.direccion || '',
          date: g('date'),
          items,
          total_price: parseFloat(g('total-price'))||0
        };
      }

      const recibo = {
        proyecto_id: dealId,
        tipo: isVendedor ? 'vendedor' : 'tecnico',
        trabajador_id: user.id,
        trabajador_nombre: vendedorNom,
        cliente_nombre: clienteNom,
        direccion: cli.direccion || deal.direccion || '—',
        fecha_recibo: new Date().toISOString().split('T')[0],
        datos_json: { ...datosJson, campo_id: campoId }
      };

      await saveRecibo(recibo);
      
      // ── PERSISTENCIA: Guardar en Respuestas_Dinamicas para que el estado se mantenga tras recargar ──
      const { advanceDealPhase } = await import('../api.js');
      await advanceDealPhase(dealId, { [campoId]: 'Completado' }, { preventAutoAdvance: true });

      const hiddenField = document.getElementById('df_' + campoId);
      if (hiddenField) { 
        hiddenField.value = 'Completado'; 
        hiddenField.dispatchEvent(new Event('change')); 
      }
      
      const wrap = document.getElementById('recibo-wrap-' + campoId);
      if (wrap) {
        const b = wrap.querySelector('button');
        if (b) { b.disabled = true; b.textContent = '<i class="fa-solid fa-check text-green-500"></i> Recibo Completado'; b.style.opacity = '0.7'; }
      }

      const { showToast } = await import('../components/toast.js');
      showToast('Recibo guardado <i class="fa-solid fa-check text-green-500"></i>', 'success');
      modal.remove();
      
    } catch(err) {
      console.error(err);
      btn.textContent = 'Guardar Recibo';
      btn.disabled = false;
    }
  };
};

function _buildFormVendedor(vendedorNom = "", tecnicoNom = "", clienteNom = "") {
  const st = 'background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;';
  const today = new Date().toISOString().split('T')[0];
  const field = (lbl, id, type='text', ph='', val='') => `
    <div style="margin-bottom:12px;">
      <label style="font-size:0.68rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px;">${lbl}</label>
      <input type="${type}" id="${id}" placeholder="${ph}" value="${val}" style="${st}"/>
    </div>`;
  const sep = txt => `<p style="font-size:0.65rem;font-weight:900;color:#3b82f6;text-transform:uppercase;letter-spacing:1.5px;margin:16px 0 10px;padding-top:14px;border-top:1px solid var(--border);">${txt}</p>`;
  return `
    ${sep('INFORMACIÓN PRINCIPAL')}
    ${field('Customer Name','rec-customer-name','text','Nombre del cliente', clienteNom)}
    ${field('Sales Representative','rec-sales-rep','text','Nombre del vendedor', vendedorNom)}
    ${field('Check Number','rec-check-number','text','# de cheque')}
    ${field('Transfer Date','rec-transfer-date','date','',today)}
    ${field('Finance Company','rec-finance','text','Empresa financiera')}
    ${sep('Montos')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${field('Sales Amount ($)','rec-sales-amount','number','0.00')}
      ${field('Aprobación (%)','rec-aprobacion-pct','number','100')}
    </div>
    ${field('Monto Aprobación ($)','rec-monto-aprobacion','number','0.00')}
    ${sep('Costos')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${field('Cost ($)','rec-cost','number','0.00')}
      ${field('Costo Plan (%)','rec-costo-plan-pct','number','2')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${field('Total Costo ($)','rec-total-costo','number','0.00')}
      ${field('Total Analista ($)','rec-total-analista','number','0.00')}
    </div>
    ${field('LÍNEA POZO','rec-linea-pozo','text','Opcional')}
    ${sep('Extra Charges')}
    <div id="extra-charges-container">
      <div class="extra-charge-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="MILLAS" style="${st}" value="MILLAS"/><input type="number" placeholder="0" style="${st}" value="0"/></div>
      <div class="extra-charge-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="EXTRA" style="${st}" value="EXTRA"/><input type="number" placeholder="0" style="${st}" value="0"/></div>
    </div>
    ${sep('Deductions')}
    <div id="deductions-container">
      <div class="deduction-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="Bono" style="${st}" value="Bono"/><input type="number" placeholder="0" style="${st}" value="0"/></div>
      <div class="deduction-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="Reversa" style="${st}" value="Reversa"/><input type="number" placeholder="0" style="${st}" value="0"/></div>
    </div>
    ${sep('Instalador & Credits')}
    ${field('Nombre del Instalador','rec-instalador','text','Nombre del técnico', tecnicoNom)}
    <div id="credits-container">
      <div class="credit-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="Transfer" style="${st}" value="Transfer"/><input type="number" placeholder="0" style="${st}" value="0"/></div>
      <div class="credit-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="Adicional" style="${st}" value="Adicional"/><input type="number" placeholder="0" style="${st}" value="0"/></div>
    </div>
    ${sep('Total')}
    ${field('Monto Total ($)','rec-grand-total','number','0.00')}
  `;
}

function _buildFormTecnico(tecnicoNom = "", clienteNom = "") {
  const st = 'background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;';
  const today = new Date().toISOString().split('T')[0];
  const field = (lbl, id, type='text', ph='', val='') => `
    <div style="margin-bottom:12px;">
      <label style="font-size:0.68rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px;">${lbl}</label>
      <input type="${type}" id="${id}" placeholder="${ph}" value="${val}" style="${st}"/>
    </div>`;
  const sep = txt => `<p style="font-size:0.65rem;font-weight:900;color:#10b981;text-transform:uppercase;letter-spacing:1.5px;margin:16px 0 10px;padding-top:14px;border-top:1px solid var(--border);">${txt}</p>`;
  return `
    ${sep('Fecha')}
    ${field('Date','rec-date','date','',today)}
    ${sep('Items Instalados')}
    <div id="items-container">
      <div style="display:grid;grid-template-columns:2fr 60px 1fr 80px 20px;gap:6px;margin-bottom:4px;">
        <span style="font-size:0.62rem;color:var(--text-muted);font-weight:800;">DESCRIPCIÓN</span>
        <span style="font-size:0.62rem;color:var(--text-muted);font-weight:800;">QTY</span>
        <span style="font-size:0.62rem;color:var(--text-muted);font-weight:800;">MODELO</span>
        <span style="font-size:0.62rem;color:var(--text-muted);font-weight:800;">TOTAL ($)</span>
        <span></span>
      </div>
      <div class="item-row" style="display:grid;grid-template-columns:2fr 60px 1fr 80px 20px;gap:6px;margin-bottom:8px;align-items:center;">
        <input type="text" placeholder="Water treatment system" style="${st}"/>
        <input type="number" placeholder="1" value="1" style="${st}"/>
        <input type="text" placeholder="Renew City 6" style="${st}"/>
        <input type="number" placeholder="0.00" style="${st}"/>
        <span></span>
      </div>
    </div>
    <button type="button" id="btn-add-item" style="background:#10b98115;border:1px dashed #10b98160;color:#10b981;border-radius:10px;padding:8px 16px;font-size:0.8rem;font-weight:700;cursor:pointer;width:100%;margin-bottom:8px;">
      + Agregar Equipo
    </button>
    ${sep('Totales')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${field('Discount (%)','rec-discount-pct','number','0','0')}
      ${field('Total Price ($)','rec-total-price','number','0.00')}
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────
//  FASE PREVIEW – Read-only bottom-sheet para phases completadas
// ──────────────────────────────────────────────────────────────
window._previewFase = async function(faseId, faseNombreEnc, dealId) {
    const faseNombre = decodeURIComponent(faseNombreEnc);

    // Remove existing drawer
    const existing = document.getElementById('fase-preview-drawer');
    if (existing) { existing.remove(); return; }

    const { getDB, getRespuestasByProyecto, getAdminCampos, getAdminPipelines } = await import('../api.js');
    const db = getDB();
    const deal = (db.Proyectos_Dinamicos || []).find(p => p.id === dealId) || {};
    const pipelines = await getAdminPipelines();
    const pipeline = pipelines.find(p => p.id === deal.pipeline_id) || { color: '#00f5d4' };
    const allCampos = await getAdminCampos();
    const campos = allCampos.filter(c => c.fase_id === faseId);
    const respuestas = await getRespuestasByProyecto(dealId);

    // Build rows
    const renderValue = (campo, resp) => {
        const val = resp?.valor || '';
        if (!val || val === 'No provisto' || val === 'No subido') {
            return `<span style="color:#94a3b8;font-style:italic;font-size:0.8rem;">Sin respuesta</span>`;
        }
        if (val.match(/\.(pdf)$/i) || ((val.startsWith('http') || val.startsWith('/api/')) && val.includes('pdf'))) {
            return `<a href="${val}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:${pipeline.color}15;color:${pipeline.color};border:1px solid ${pipeline.color}40;border-radius:8px;padding:5px 12px;font-size:0.75rem;font-weight:700;text-decoration:none;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Ver PDF
            </a>`;
        }
        if (val.match(/\.(jpg|jpeg|png|webp|gif)$/i) || ((val.startsWith('http') || val.startsWith('/api/')) && val.includes('storage'))) {
            return `<img src="${val}" style="max-width:100%;max-height:160px;border-radius:10px;border:1px solid var(--border);object-fit:cover;" onclick="window.open('${val}')" title="Click para ampliar">`;
        }
        if (val.startsWith('data:image')) {
            return `<img src="${val}" style="max-width:100%;max-height:160px;border-radius:10px;border:1px solid var(--border);object-fit:cover;">`;
        }
        // Completado badge
        if (['Completado', 'Completado en Formulario Externo'].includes(val)) {
            return `<span style="background:${pipeline.color}15;color:${pipeline.color};border:1px solid ${pipeline.color}30;border-radius:6px;padding:3px 10px;font-size:0.75rem;font-weight:800;"><i class="fa-solid fa-check text-green-500"></i> Completado</span>`;
        }
        return `<span style="font-size:0.9rem;font-weight:600;color:var(--text-primary);">${val}</span>`;
    };

    const rowsHtml = campos.length
        ? campos.map(c => {
            const resp = respuestas.find(r => r.campo_id === c.id);
            return `
            <div style="padding:14px 0;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:6px;">
                <span style="font-size:0.65rem;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;">${c.etiqueta}${c.es_opcional ? ' <em style="font-style:italic;font-weight:400;text-transform:none;letter-spacing:0">(Opcional)</em>' : ''}</span>
                ${renderValue(c, resp)}
            </div>`;
          }).join('')
        : `<div style="padding:24px;text-align:center;color:#94a3b8;font-style:italic;font-size:0.85rem;">
              Esta fase no tiene campos de formulario.<br>
              <small style="font-size:0.7rem;margin-top:6px;display:block;">Se avanza directamente al completarse.</small>
           </div>`;

    const isDesktop = window.innerWidth >= 768;
    const drawer = document.createElement('div');
    drawer.id = 'fase-preview-drawer';
    drawer.style.cssText = isDesktop
        ? 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeIn .2s ease;'
        : 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s ease;';

    const sheetRadius = isDesktop ? '24px' : '28px 28px 0 0';
    const sheetMaxH   = isDesktop ? '82vh' : '85vh';
    const sheetMaxW   = isDesktop ? '680px' : '600px';
    const sheetAnim   = isDesktop ? 'modalIn' : 'slideUp';

    drawer.innerHTML = `
    <style>
        @keyframes slideUp  { from { transform:translateY(100%); } to { transform:translateY(0); } }
        @keyframes modalIn  { from { transform:scale(.95);opacity:0; } to { transform:scale(1);opacity:1; } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        #fase-preview-sheet { animation: ${sheetAnim} .28s cubic-bezier(0.16,1,0.3,1) both; }
    </style>
    <div id="fase-preview-sheet"
         style="background:var(--surface,#fff);width:100%;max-width:${sheetMaxW};border-radius:${sheetRadius};
                max-height:${sheetMaxH};display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,0.3);">
        <!-- Handle (mobile only) -->
        ${!isDesktop ? '<div style="width:40px;height:5px;background:#cbd5e1;border-radius:99px;margin:14px auto 0;flex-shrink:0;"></div>' : ''}

        <!-- Header -->
        <div style="padding:${isDesktop?'24px 28px 16px':'16px 20px 12px'};border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:14px;">
                <div style="width:${isDesktop?'48px':'40px'};height:${isDesktop?'48px':'40px'};border-radius:16px;background:${pipeline.color}15;
                            border:1px solid ${pipeline.color}30;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg width="${isDesktop?'22':'18'}" height="${isDesktop?'22':'18'}" viewBox="0 0 24 24" fill="none" stroke="${pipeline.color}" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>
                <div>
                    <h3 style="margin:0;font-size:${isDesktop?'1.15rem':'1rem'};font-weight:900;color:var(--text-primary);">${faseNombre}</h3>
                    <p style="margin:0;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${pipeline.color};">
                        Solo Lectura &nbsp;·&nbsp; ${pipeline.nombre || ''}
                    </p>
                </div>
            </div>
            <button onclick="document.getElementById('fase-preview-drawer').remove()"
                    style="width:36px;height:36px;border-radius:50%;border:none;background:var(--surface-alt,#f1f5f9);
                           color:var(--text-secondary,#64748b);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1rem;flex-shrink:0;">
                <i class="fa-solid fa-xmark text-red-500"></i>
            </button>
        </div>

        <!-- Body -->
        <div style="flex:1;overflow-y:auto;padding:${isDesktop?'0 28px 32px':'0 20px 32px'};-webkit-overflow-scrolling:touch;">
            ${rowsHtml}
        </div>
    </div>`;


    // Close on backdrop click
    drawer.addEventListener('click', e => {
        if (e.target === drawer) drawer.remove();
    });

    document.body.appendChild(drawer);
};
