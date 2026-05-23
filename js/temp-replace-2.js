const fs = require('fs');
const file = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/screens/projectDetail.js';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
const start = 27; // lines are 0-indexed, line 28 is index 27
const end = 250;  // index 250 is line 251

const newCode = `function renderDiscussion(discusion, pipelineColor) {
    if (!discusion) return '<div style="text-align:center;padding:20px;color:var(--text-muted);font-style:italic;font-size:0.85rem;">No hay mensajes aún.</div>';
    let arr = discusion;
    if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch(e) { return '<div style="text-align:center;padding:20px;color:var(--text-muted);font-style:italic;font-size:0.85rem;">No hay mensajes aún.</div>'; }
    }
    if (!Array.isArray(arr) || arr.length === 0) return '<div style="text-align:center;padding:20px;color:var(--text-muted);font-style:italic;font-size:0.85rem;">No hay mensajes aún.</div>';
    
    let lastDateLabel = '';
    return arr.map(c => {
        if (c.type === 'system') {
            return \\\`<div style="text-align:center;margin:8px 0;"><span style="display:inline-block;background:var(--surface);color:var(--text-muted);font-size:0.65rem;font-weight:700;padding:4px 12px;border-radius:99px;">\${c.text}</span></div>\\\`;
        }
        
        const dateObj = new Date(c.date);
        const dateLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
        let dateSeparator = '';
        if (dateLabel !== lastDateLabel) {
            lastDateLabel = dateLabel;
            dateSeparator = \\\`<div style="text-align:center;margin:12px 0 8px;"><span style="display:inline-block;background:var(--surface-alt);border:1px solid var(--border);color:var(--text-muted);font-size:0.65rem;font-weight:800;padding:3px 12px;border-radius:99px;text-transform:capitalize;">\${dateLabel}</span></div>\\\`;
        }
        
        const isMe = getCurrentUser()?.id === c.user_id;
        const initials = ((c.user || '?')[0]).toUpperCase();
        const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const avatar = \\\`<div style="width:28px;height:28px;border-radius:50%;background:\${pipelineColor}20;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:900;color:\${pipelineColor};flex-shrink:0;overflow:hidden;">
            \${c.foto ? \\\`<img src="\${c.foto}" style="width:100%;height:100%;object-fit:cover;" />\\\` : initials}
        </div>\\\`;
        
        const msgBubble = \\\`
        <div style="display:flex;align-items:flex-start;gap:8px;max-width:85%;\${isMe ? 'flex-direction:row-reverse;margin-left:auto;' : ''}">
            \${avatar}
            <div style="display:flex;flex-direction:column;\${isMe ? 'align-items:flex-end;' : 'align-items:flex-start;'}">
                <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;\${isMe ? 'flex-direction:row-reverse;' : ''}">
                    <span style="font-size:0.7rem;font-weight:800;color:var(--text-primary);">\${isMe ? 'Tú' : c.user}</span>
                    <span style="font-size:0.6rem;color:var(--text-muted);">\${time}</span>
                </div>
                <div style="background:\${isMe ? pipelineColor : 'var(--surface)'};color:\${isMe ? 'white' : 'var(--text-primary)'};border-radius:\${isMe ? '12px 0 12px 12px' : '0 12px 12px 12px'};padding:8px 12px;font-size:0.8rem;line-height:1.4;box-shadow:0 1px 2px rgba(0,0,0,0.05);\${!isMe ? 'border:1px solid var(--border);' : ''}">\${c.text}</div>
            </div>
        </div>\\\`;
        
        return dateSeparator + msgBubble;
    }).join('');
}

function renderProjectInventory(dealId) {
    const db = getDB();
    const historial = db.historialInventario || [];
    const used = historial.filter(h => h.proyecto_id === dealId && h.tipo_movimiento === 'Salida (Proyecto)');
    
    if (!used.length) return '<div style="background:var(--surface-alt); border-radius:12px; padding:16px; font-size:0.85rem; color:var(--text-muted); border:1px solid var(--border); text-align:center; font-style:italic;">No se han retirado materiales.</div>';
    
    return used.map(h => \\\`
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-alt); padding:12px; border-radius:12px; border:1px solid var(--border);">
           <div>
              <div style="font-weight:800; font-size:0.85rem; color:var(--text-primary); text-transform:uppercase;">\${h.item_nombre}</div>
              <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;"><i class="fa-solid fa-user text-[8px] mr-1"></i> \${h.tecnico_nombre} &nbsp;&bull;&nbsp; \${new Date(h.fecha).toLocaleDateString()}</div>
           </div>
           <div style="display:flex; align-items:center; gap:8px;">
               <div style="background:#ef444415; color:#ef4444; font-weight:900; font-size:0.85rem; padding:6px 10px; border-radius:8px; border:1px solid #ef444430;">-\${h.cantidad_retirada}</div>
               <button onclick="window.deleteProjectMaterial('\${h.id}', '\${dealId}')" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:6px;" title="Borrar material retirado y devolver stock">
                   <i class="fa-solid fa-trash-can hover:text-red-500 transition-colors"></i>
               </button>
           </div>
        </div>
    \\\`).join('');
}

export async function renderDetail(dealId) {
  const screen = document.getElementById('screen-detail');
  if (!screen) return;

  screen.innerHTML = \\\`
    <div class="screen-header slide-in-left">
      <button class="back-btn" id="pd-back-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
      <h2>Cargando...</h2>
    </div>
    <div style="padding:24px 16px">
      <div class="skeleton" style="height:100px;border-radius:16px;margin-bottom:16px"></div>
      <div class="skeleton" style="height:150px;border-radius:16px"></div>
    </div>
  \\\`;

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
  const isAdmin = ['admin','administrador','ceo','desarrollador'].includes((currentUser?.rol || '').toLowerCase());
  const isResponsable = currentUser?.id === deal.responsable_id;
  const canManageObservers = isAdmin || isResponsable;
  const dbFull = getDB();
  const allWorkers = dbFull.Usuarios || [];

  const observadores = Array.isArray(deal.observadores) ? deal.observadores : [];
  const obsHtml = observadores.map(o => {
      const oi = ((o.nombre || '?')[0]).toUpperCase();
      return \\\`<div class="obs-avatar" title="\${o.nombre}" style="width:28px;height:28px;border-radius:50%;background:\${pipeline.color}20;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:900;color:\${pipeline.color};border:2px solid var(--bg);margin-left:-8px;overflow:hidden;">
        \${o.foto ? \\\`<img src="\${o.foto}" style="width:100%;height:100%;object-fit:cover;" />\\\` : oi}
      </div>\\\`;
  }).join('');

  screen.innerHTML = \\\`
    <div class="screen-header slide-in-left" style="background:\${pipeline.color}; border:none">
      <button class="back-btn" id="pd-back-btn2" style="color:#fff; background:rgba(255,255,255,0.2)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h2 style="color:white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">\${deal.nombre_cliente}</h2>
      <span class="badge" style="margin-left:auto; background:white; color:\${pipeline.color}; font-weight:800; box-shadow: 0 2px 8px rgba(0,0,0,0.1)">\${isCompleted ? 'Completado' : currentFaseObj.nombre}</span>
    </div>

    <div class="progress-section" style="margin-top:0; border-radius:0 0 24px 24px; box-shadow:0 8px 16px rgba(0,0,0,0.1)">
      <div class="progress-steps" style="padding-top:16px; overflow-x:auto; display:flex; flex-wrap:nowrap; -webkit-overflow-scrolling:touch; padding-bottom:20px; gap:8px">
        \${fases.map((f, i) => {
          const isDone = isCompleted || i < curFidx;
          const isActive = !isCompleted && i === curFidx;
          const isClickable = isDone || isActive;
          return \\\`
          <div class="progress-step \${isDone ? 'done' : isActive ? 'active' : ''}" 
               data-fase-id="\${f.id}" data-fase-nombre="\${f.nombre}" data-fase-idx="\${i}"
               style="min-width: 90px; flex: 0 0 auto; \${isClickable ? 'cursor:pointer;' : ''}"
               \${isClickable ? \\\`onclick="window._previewFase('\${f.id}','\${encodeURIComponent(f.nombre)}','\${deal.id}')"\\\` : ''}>
            <div class="step-circle" style="\${isDone ? \\\`background:\${pipeline.color}; border-color:\${pipeline.color}\\\` : (isActive ? \\\`border-color:\${pipeline.color}; color:\${pipeline.color}\\\` : '')}"
                 title="\${isClickable ? 'Ver detalles de esta fase' : ''}">
              \${isDone
                ? \\\`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>\\\`
                : (i + 1)}
            </div>
            <div class="step-label" style="white-space:normal; line-height:1.2">\${f.nombre}</div>
            \${isClickable ? \\\`<div style="font-size:0.5rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:\${isDone ? pipeline.color : pipeline.color}; opacity:0.7; margin-top:2px;">Ver</div>\\\` : ''}
          </div>\\\`;
        }).join('')}
      </div>
    </div>

    <div style="padding: 16px; padding-bottom: 40px;">
      <div id="dynamic-action-section"></div>

      \${(pipeline.nombre || '').toLowerCase().includes('water') ? \\\`
      <div class="info-card slide-in-bottom" style="margin-top:24px; padding:20px; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.05)">
        <h3 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:16px; font-weight:700; letter-spacing:0.5px; display:flex; justify-content:space-between; align-items:center;">
          Materiales del Proyecto
          <button onclick="window.openInventoryCart('\${deal.id}')" style="background:\${pipeline.color}15; color:\${pipeline.color}; border:1px solid \${pipeline.color}30; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">
             <i class="fa-solid fa-cart-plus mr-1"></i> Retirar Material
          </button>
        </h3>
        <div id="project-inventory-list-\${deal.id}" style="display:flex; flex-direction:column; gap:8px;">
          \${renderProjectInventory(deal.id)}
        </div>
      </div>
      \\\` : ''}

      <div class="info-card slide-in-bottom" style="margin-top:24px; padding:20px; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.05)">
        <h3 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:16px; font-weight:700; letter-spacing:0.5px">Datos de Contacto Central</h3>
        <div style="display:flex; flex-direction:column; gap:16px; background:var(--surface-alt); padding:20px; border-radius:12px; border:1px solid var(--border)">
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Email</span>
            <span style="font-size:0.95rem; font-weight:600; color:var(--text-primary); word-break:break-all">\${deal.email || 'N/A'}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Teléfono</span>
            <span style="font-size:0.95rem; font-weight:700; color:\${pipeline.color}; word-break:break-all">\${deal.telefono}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">Dirección</span>
            <span style="font-size:0.95rem; font-weight:500; color:var(--text-primary); word-break:break-all; line-height:1.4">\${deal.direccion}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">ID / Licencia de Conducir</span>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.95rem; font-weight:600; color:var(--text-primary); word-break:break-all">\${deal.licencia || '-'}</span>
              \${deal.foto_id ? \\\`<button onclick="window.open('\${deal.foto_id}')" style="background:\${pipeline.color}; color:white; border:none; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:bold; cursor:pointer">Ver Documento</button>\\\` : \\\`<span style="font-size:0.7rem; color:var(--text-muted); font-style:italic">Sin adjunto</span>\\\`}
            </div>
          </div>
        </div>
      </div>

      <div class="info-card slide-in-bottom" style="margin-bottom:120px; margin-top:24px; padding:0; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
        <!-- Header -->
        <div style="padding:16px 20px; border-bottom:1px solid var(--border); background:var(--surface-alt);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); margin:0; font-weight:700; letter-spacing:0.5px;">Chat del Proyecto</h3>
                <label style="font-size:0.7rem; font-weight:600; display:flex; align-items:center; gap:6px; cursor:pointer; color:var(--text-primary);">
                   <input type="checkbox" id="chk-has-issue" \${deal.tiene_problema ? 'checked' : ''} style="accent-color:#ef4444; width:14px; height:14px;">
                   Atención Req.
                </label>
            </div>
            <!-- Observers list -->
            <div style="margin-top:12px; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; padding-left:8px;">
                    \${obsHtml || \\\`<span style="font-size:0.7rem;color:var(--text-muted);">Solo involucrados</span>\\\`}
                </div>
                \${canManageObservers ? \\\`
                <button id="btn-manage-obs" style="background:transparent; border:1px solid var(--border); color:var(--text-primary); padding:4px 10px; border-radius:8px; font-size:0.7rem; font-weight:700;">
                    <i class="fa-solid fa-users mr-1"></i> Invitar
                </button>\\\` : ''}
            </div>
        </div>
        
        <!-- Messages -->
        <div id="discussion-list" style="padding:20px; font-size:0.85rem; height: 320px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; background:var(--bg);">
          \${renderDiscussion(deal.discusion, pipeline.color)}
        </div>
        
        <!-- Input -->
        <div style="display:flex; gap:8px; padding:12px; border-top:1px solid var(--border); background:var(--surface-alt); align-items:center;">
          <input type="text" id="discussion-input" placeholder="Escribe un mensaje..." style="flex:1; height:44px; min-width:0; border-radius:12px; background:var(--bg); border:1px solid var(--border); color:var(--text-primary); padding:0 14px; font-size:0.85rem; outline:none;" />
          <button id="btn-send-discussion" style="background:\${pipeline.color}; color:#fff; border:none; width:44px; height:44px; border-radius:12px; flex-shrink:0; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px \${pipeline.color}40;">
            <i class="fa-solid fa-paper-plane text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  \\\`;

  const backBtn2 = document.getElementById('pd-back-btn2');
  if (backBtn2) backBtn2.addEventListener('click', () => navigate('dashboard'));

  // Observers modal logic
  const btnManageObs = document.getElementById('btn-manage-obs');
  if (btnManageObs) {
      btnManageObs.addEventListener('click', () => {
          const div = document.createElement('div');
          div.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);';
          
          const curObs = Array.isArray(deal.observadores) ? deal.observadores : [];
          const curIds = new Set(curObs.map(o=>o.id));
          const eligible = allWorkers.filter(w => w.id !== deal.responsable_id && !curIds.has(w.id) && !w.is_suspended);
          
          div.innerHTML = \\\`
          <div style="background:var(--bg);width:100%;border-radius:24px 24px 0 0;padding:20px;max-height:80vh;display:flex;flex-direction:column;animation:slideInBottom 0.3s ease-out;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                  <h3 style="margin:0;font-size:1rem;font-weight:800;color:var(--text-primary);">Añadir Observador</h3>
                  <button id="close-obs" style="background:none;border:none;font-size:1.5rem;color:var(--text-muted);">&times;</button>
              </div>
              <div style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;padding-bottom:20px;">
                  \${eligible.length === 0 ? '<p style="text-align:center;color:var(--text-muted);font-size:0.8rem;padding:20px;">No hay más usuarios disponibles</p>' : ''}
                  \${eligible.map(w => \\\`
                  <div class="obs-item" data-id="\${w.id}" style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--surface-alt);border:1px solid var(--border);border-radius:12px;cursor:pointer;">
                      <div style="display:flex;align-items:center;gap:12px;">
                          <div style="width:36px;height:36px;border-radius:50%;background:\${pipeline.color}15;color:\${pipeline.color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem;">
                              \${w.foto ? \\\`<img src="\${w.foto}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">\\\` : (w.nombre[0].toUpperCase())}
                          </div>
                          <div>
                              <div style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">\${w.nombre}</div>
                              <div style="font-size:0.7rem;color:var(--text-muted);">\${w.rol}</div>
                          </div>
                      </div>
                      <button class="add-obs-btn" data-id="\${w.id}" style="background:\${pipeline.color}15;color:\${pipeline.color};border:none;padding:6px 12px;border-radius:8px;font-size:0.7rem;font-weight:800;">Añadir</button>
                  </div>
                  \\\`).join('')}
              </div>
          </div>\\\`;
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
                              showToast('Observador añadido', 'success');
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
              btnSend.innerHTML = \\\`<i class="fa-solid fa-paper-plane text-sm"></i>\\\`;
          }
      };

      btnSend.addEventListener('click', sendComment);
      inputDisc.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') sendComment();
      });
  }`;
const result = [...lines.slice(0, start), newCode.replace(/\\\\\`/g, '`'), ...lines.slice(end)].join('\n');
fs.writeFileSync(file, result, 'utf8');
console.log('done');
