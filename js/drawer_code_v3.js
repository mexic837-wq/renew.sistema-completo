function openKanbanDrawer(projectId, targetPhaseId = null) {
  window.openKanbanDrawer = openKanbanDrawer;
  const db = getDB();
  const p = (db.Proyectos_Dinamicos || []).find(x => x.id === projectId);
  if (!p) return;

  const cli = (db.Clientes_Maestro || []).find(c => c.id === p.cliente_id) || { nombre: 'Cliente', telefono: '-' };
  const pipeline = (db.Admin_Pipelines || []).find(pip => pip.id === p.pipeline_id) || { nombre: 'N/A', color: '#0d9488' };
  const fases = (db.Admin_Fases || []).filter(f => f.pipeline_id === p.pipeline_id).sort((a, b) => a.orden - b.orden);
  const faseActual = fases.find(f => f.id === p.fase_id) || { nombre: 'Completado' };
  const isProjectCompleted = cli.estado === 'Completado' || p.fase_id === 'Completado' || p.fase_id === null;
  const displayPhaseId = targetPhaseId !== null ? targetPhaseId : (isProjectCompleted && fases.length > 0 ? fases[fases.length - 1].id : p.fase_id);
  const isCurrentPhase = !isProjectCompleted && displayPhaseId === p.fase_id;
  const displayPhase = fases.find(f => f.id === displayPhaseId) || faseActual;
  window._currentDrawerPhaseId = displayPhaseId;
  const campos = db.Admin_Campos_Formulario || [];
  const respuestas = (db.Respuestas_Dinamicas || []).filter(r => r.proyecto_id === p.id);

  const currentUser = getCurrentUser();
  const isAdmin = ['admin','administrador','ceo','desarrollador'].includes((currentUser?.rol || '').toLowerCase());
  const responsableIds = (p.responsable_id || '').split(',').map(id => id.trim()).filter(id => id);
  const isResponsable = responsableIds.includes(String(currentUser?.id));
  const canManageObservers = isAdmin || isResponsable;
  
  const allWorkers = db.Usuarios || [];
  const observadores = Array.isArray(p.observadores) ? p.observadores : [];

  const obsHtml = observadores.map(o => {
      const oi = ((o.nombre || '?')[0]).toUpperCase();
      return `<div class="flex items-center gap-2 mb-2">
        <div title="${o.nombre}" style="width:24px;height:24px;border-radius:50%;background:${pipeline.color}20;display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:900;color:${pipeline.color};overflow:hidden;">
            ${o.foto ? `<img src="${o.foto}" style="width:100%;height:100%;object-fit:cover;" />` : oi}
        </div>
        <span class="text-[11px] text-gray-600 font-medium">${o.nombre}</span>
      </div>`;
  }).join('');

  // Combine dynamic file responses with fixed office attachments
  const fileRespuestas = respuestas.filter(r => {
    const campo = campos.find(c => c.id === r.campo_id);
    return campo && campo.tipo === 'Archivo' && r.valor && (r.valor.startsWith('data:') || r.valor.startsWith('http'));
  });
  const combinedFiles = [...fileRespuestas.map(r => {
      const campo = campos.find(c => c.id === r.campo_id);
      return { url: r.valor, etiqueta: campo?.etiqueta || 'Archivo', id: r.campo_id };
  })];
  
  if (cli.adjuntos_oficina) {
      if (cli.adjuntos_oficina.orden_trabajo_url) combinedFiles.push({ url: cli.adjuntos_oficina.orden_trabajo_url, etiqueta: 'Orden de Trabajo', id: 'sys-orden' });
      if (cli.adjuntos_oficina.contrato_url) combinedFiles.push({ url: cli.adjuntos_oficina.contrato_url, etiqueta: 'Contrato Firmado', id: 'sys-contrato' });
      if (cli.adjuntos_oficina.app_url) combinedFiles.push({ url: cli.adjuntos_oficina.app_url, etiqueta: 'Hoja de Aplicación', id: 'sys-app' });
      const rUrl = cli.adjuntos_oficina.recibo_url || cli.adjuntos_oficina.recibo_vendedor_url || cli.adjuntos_oficina.recibo_tecnico_url;
      if (rUrl) combinedFiles.push({ url: rUrl, etiqueta: 'Recibo de Pago', id: 'sys-recibo' });
  }

  const filesHtml = combinedFiles.length > 0
    ? combinedFiles.map(f => {
        const isImage = f.url.startsWith('data:image') || f.url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
        const etiqueta = (f.etiqueta || 'Archivo').replace(/'/g, "\\'");
        const filename = etiqueta.replace(/\s+/g, '_');
        return `
          <div class="group relative bg-white p-2 rounded-lg border border-gray-200">
            ${isImage
              ? `<div class="w-full h-16 rounded overflow-hidden relative">
                  <img src="${f.url}" class="w-full h-full object-cover" />
                  <button onclick="window.openFilePreview('${f.id}', '${etiqueta}')" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-eye text-white"></i></button>
                </div>`
              : `<div class="w-full h-16 rounded border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 relative">
                  <i class="fas fa-file-pdf text-red-400 text-xl"></i>
                  <a href="${f.url}" target="_blank" download="${filename}" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-download text-white"></i></a>
                </div>`
            }
            <p class="text-[9px] font-bold text-gray-500 mt-1 truncate" title="${f.etiqueta}">${f.etiqueta}</p>
          </div>
        `;
      }).join('')
    : `<div class="col-span-3 py-4 text-center text-xs text-gray-400">Sin archivos</div>`;

  const assignedIds = (cli.vendedor_asignado_id || '').split(',').map(id => id.trim()).filter(id => id);
  const currentWorkers = allWorkers.filter(w => assignedIds.includes(w.id));
  const assigneeName = currentWorkers.length > 0 ? currentWorkers.map(w => `${w.nombre} ${w.apellido || ''}`).join(', ') : 'Sin asignar';

  // Build drawer
  const existing = document.getElementById('kanban-drawer-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'kanban-drawer-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;justify-content:center;align-items:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);';
  overlay.innerHTML = `
    <div id="kanban-split-modal" style="width:90vw;height:90vh;max-width:1400px;background:#f8fafc;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);display:flex;overflow:hidden;animation:zoomIn 0.2s ease-out;">
      
      <!-- LEFT PANEL: Info & Subtasks -->
      <div style="width:45%;min-width:400px;max-width:600px;background:white;display:flex;flex-direction:column;border-right:1px solid #e2e8f0;flex-shrink:0;">
        
        <!-- Header Left -->
        <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:12px;min-width:0;">
                <div style="width:32px;height:32px;border-radius:8px;background:${pipeline.color};display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:12px;flex-shrink:0;">
                    ${cli.nombre[0].toUpperCase()}
                </div>
                <div style="min-width:0;">
                    <h2 class="text-sm font-bold text-gray-800 truncate" title="${cli.nombre}">${cli.nombre}</h2>
                    <p class="text-[10px] text-gray-500">ID: ${p.id.substring(0,8).toUpperCase()}</p>
                </div>
            </div>
            <button id="kanban-drawer-close-btn" class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <div style="flex:1;overflow-y:auto;" class="hide-scrollbar">
            <!-- Properties -->
            <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
                <div class="grid grid-cols-[100px_1fr] gap-y-3 gap-x-2 text-xs items-center">
                    <div class="text-gray-400 font-medium">Descripción:</div>
                    <div class="text-gray-800 text-[11px]">${p.descripcion || 'Sin descripción'}</div>
                    
                    <div class="text-gray-400 font-medium">Asignado a:</div>
                    <div class="text-gray-800 font-medium flex items-center gap-2">
                        <i class="fas fa-user-circle text-gray-300"></i> ${assigneeName}
                    </div>

                    <div class="text-gray-400 font-medium">Creado el:</div>
                    <div class="text-gray-800">${new Date(p.fecha).toLocaleDateString()}</div>
                    
                    <div class="text-gray-400 font-medium">Fecha Límite:</div>
                    <div class="text-gray-800">
                        <input type="date" id="proj-deadline-input" value="${p.fecha_finalizacion ? p.fecha_finalizacion.substring(0,10) : ''}" class="text-[11px] bg-transparent border border-dashed border-gray-300 rounded px-2 py-1 outline-none hover:border-blue-400 cursor-pointer text-gray-700 w-full max-w-[130px] transition-colors" ${isAdmin ? '' : 'disabled title="Solo administradores pueden editar"'}>
                    </div>
                    
                    <div class="text-gray-400 font-medium mt-2">Proyecto:</div>
                    <div class="text-gray-800 mt-2 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full" style="background:${pipeline.color}"></span> ${pipeline.nombre}
                    </div>
                    
                    <div class="text-gray-400 font-medium">Etapa Actual:</div>
                    <div class="text-gray-800 font-medium">${faseActual.nombre}</div>
                    
                    <div class="text-gray-400 font-medium mt-2">Observadores:</div>
                    <div class="mt-2">
                        ${obsHtml || '<span class="text-[10px] text-gray-400 italic">No hay observadores</span>'}
                        ${canManageObservers ? `
                        <button id="btn-manage-obs" class="text-[10px] text-blue-500 hover:underline mt-1"><i class="fas fa-plus"></i> Añadir observador</button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Accordion -->
            <div style="padding:16px 20px 0;">
                <h3 class="text-xs font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-tasks text-blue-500"></i> Subtasks (Fases): ${fases.length}</h3>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    ${fases.map((f, i) => {
                        const isDone = isProjectCompleted || i < fases.findIndex(fx => fx.id === p.fase_id);
                        const isCurrent = !isProjectCompleted && f.id === p.fase_id;
                        const isViewing = f.id === displayPhaseId;
                        return `
                        <div class="mb-1">
                            <div class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${isViewing ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:bg-gray-50'}"
                                 onclick="window.openKanbanDrawer('${p.id}', '${isViewing ? '' : f.id}')">
                                <div class="flex items-center gap-3">
                                    <i class="fas ${isDone ? 'fa-check-circle text-green-500' : (isCurrent ? 'fa-dot-circle text-blue-500' : 'fa-circle text-gray-200')}"></i>
                                    <span class="text-xs font-bold ${isViewing ? 'text-blue-700' : 'text-gray-700'}">${f.nombre}</span>
                                </div>
                                <i class="fas fa-chevron-${isViewing ? 'down' : 'right'} text-[10px] text-${isViewing ? 'blue-500' : 'gray-300'}"></i>
                            </div>
                            ${isViewing ? `
                            <div class="mt-2 ml-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm relative before:absolute before:-left-4 before:top-4 before:w-4 before:h-px before:bg-gray-200">
                                <div id="drawer-dynamic-fields">
                                    <p style="font-size:11px; color:#64748b; font-style:italic;">Cargando campos...</p>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div style="padding:20px 20px 20px;border-top:1px solid #f1f5f9;margin-top:16px;">
                <h3 class="text-xs font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-paperclip text-gray-400"></i> Archivos Globales</h3>
                <div class="grid grid-cols-3 gap-2">
                    ${filesHtml}
                </div>
            </div>
        </div>
      </div>
      
      <!-- RIGHT PANEL: Task Chat -->
      <div style="flex:1;display:flex;flex-direction:column;background:#dce9f5;position:relative;">
        <!-- Chat Header -->
        <div style="height:60px;background:white;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;flex-shrink:0;">
            <div>
                <h2 class="text-[15px] font-bold text-gray-800 flex items-center gap-2"><i class="far fa-comments text-blue-500"></i> Chat del Proyecto</h2>
                <p class="text-[11px] text-gray-500">${observadores.length + 2} participantes</p>
            </div>
            <div class="flex items-center gap-3">
                <button class="bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold py-1.5 px-4 rounded-full flex items-center gap-2 shadow-sm transition-colors">
                    <i class="fas fa-video"></i> Videollamada
                </button>
                <div class="w-px h-6 bg-gray-200 mx-1"></div>
                <div class="relative bg-gray-50 rounded-full flex items-center px-3 h-8 shadow-inner transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:bg-white border border-transparent focus-within:border-blue-300">
                    <i class="fas fa-search text-gray-400 text-xs mr-2"></i>
                    <input type="text" id="chat-search-input" placeholder="Buscar mensaje..." class="bg-transparent outline-none text-xs text-gray-700 w-24 focus:w-40 transition-all duration-300" />
                </div>
            </div>
        </div>
        
        <!-- Chat Background Overlay -->
        <div style="position:absolute;inset:0;top:60px;bottom:70px;background-image:radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px);background-size:20px 20px;pointer-events:none;opacity:0.6;"></div>
        
        <!-- Messages Area -->
        <div id="discussion-list" style="flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:12px;position:relative;z-index:1;">
            ${renderDiscussionHTML(p.discusion, pipeline.color)}
        </div>
        
        <!-- Chat Input -->
        <div style="height:70px;background:white;border-top:1px solid #e2e8f0;padding:12px 24px;display:flex;align-items:center;gap:12px;flex-shrink:0;z-index:1;">
            <div class="flex-1 bg-white border border-gray-200 rounded-full flex items-center px-4 h-10 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <input type="file" id="chat-file-input" style="display:none" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                <label for="chat-file-input" style="margin:0;cursor:pointer;display:flex;align-items:center;">
                    <i class="fas fa-paperclip text-gray-400 mr-2 hover:text-gray-600"></i>
                </label>
                <div id="chat-file-preview" style="display:none; font-size:10px; background:#e2e8f0; padding:2px 6px; border-radius:4px; margin-right:4px; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;" onclick="document.getElementById('chat-file-input').value='';this.style.display='none';" title="Click para quitar"></div>
                <input type="text" id="discussion-input" placeholder="Escribe un mensaje o menciona a alguien..." class="flex-1 bg-transparent outline-none text-sm text-gray-700 h-full" />
                <i class="far fa-smile text-gray-400 ml-2 cursor-pointer hover:text-gray-600"></i>
            </div>
            <button id="btn-send-discussion" class="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-md transition-colors">
                <i class="fas fa-paper-plane text-sm"></i>
            </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // --- Deadline Logic ---
  const dInput = document.getElementById('proj-deadline-input');
  if (dInput) {
      dInput.addEventListener('change', async (e) => {
          p.fecha_finalizacion = e.target.value;
          try {
              await saveGranular('proyectos_dinamicos', [p]);
              showToast('Fecha de finalización guardada', 'success');
          } catch(err) {
              console.error(err);
              showToast('Error al guardar fecha', 'error');
          }
      });
  }

  // --- Render Phase Fields in Drawer ---
  if (displayPhaseId !== '') {
      const fieldsContainer = document.getElementById('drawer-dynamic-fields');
      if (fieldsContainer) {
          const phaseCampos = campos.filter(c => c.fase_id === displayPhaseId);
          
          if (phaseCampos.length === 0) {
            fieldsContainer.innerHTML = `
              <div style="padding:16px; text-align:center;">
                <p style="font-size:11px; color:#94a3b8; font-weight:700;">ESTA FASE NO TIENE CAMPOS</p>
                ${isCurrentPhase ? `<button id="btn-advance-drawer-empty" style="margin-top:12px; width:100%; background:${pipeline.color}; color:white; border:none; padding:8px; border-radius:6px; font-weight:700; font-size:11px; cursor:pointer;">
                   AVANZAR FASE
                </button>` : ''}
              </div>
            `;
            const btnAdv = document.getElementById('btn-advance-drawer-empty');
            if (btnAdv) {
              btnAdv.onclick = async () => {
                 btnAdv.textContent = 'Espere...';
                 const res = await advanceDealPhase(p.id, {});
                 if (res.didAdvance) {
                    showToast('Fase completada', 'success');
                    closeDrawer();
                    renderView();
                 }
              };
            }
          } else {
            const requiredCampos = phaseCampos.filter(c => !c.es_opcional);
            const numRequiredFilled = respuestas.filter(r => requiredCampos.some(c => c.id === r.campo_id) && r.valor && r.valor !== "No subido" && r.valor !== "No provisto").length;
            const isComplete = numRequiredFilled >= requiredCampos.length;

            const inputsHtml = phaseCampos.map(c => {
              const saved = respuestas.find(r => r.campo_id === c.id);
              const val = saved ? saved.valor : '';
              let fieldHtml = '';
              
              if (c.tipo === 'Archivo') {
                const hasFile = val && (val.startsWith('data:') || val.startsWith('http'));
                fieldHtml = `
                  <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:9px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase;">
                      ${c.etiqueta} ${c.es_opcional ? '<span style="text-transform:none; font-weight:normal; font-style:italic;">(Opcional)</span>' : ''}
                    </label>
                    <div style="display:flex; align-items:center; gap:8px; padding:8px; background:#f8fafc; border:1px solid ${hasFile ? pipeline.color : '#e2e8f0'}; border-radius:8px;">
                       <i class="fas ${hasFile ? 'fa-check-circle' : 'fa-cloud-upload'}" style="color:${hasFile ? pipeline.color : '#94a3b8'};font-size:14px;"></i>
                       <span style="font-size:10px; font-weight:600; flex:1; color:${hasFile ? pipeline.color : '#94a3b8'}">${hasFile ? 'Cargado' : 'Pendiente'}</span>
                       <input type="file" id="dfd_${c.id}" style="display:none" accept="image/*,.pdf" onchange="window.handleDrawerFileUpload('${p.id}', '${c.id}', this)">
                       <label for="dfd_${c.id}" style="background:${hasFile ? '#e2e8f0' : pipeline.color}; color:${hasFile ? '#475569' : 'white'}; padding:4px 8px; border-radius:4px; font-size:9px; font-weight:800; cursor:pointer; text-transform:uppercase;">
                         ${hasFile ? 'Editar' : 'Subir'}
                       </label>
                    </div>
                  </div>
                `;
              } else if (c.tipo === 'Desplegable') {
                const options = (c.opciones || "").split(',').map(o => o.trim());
                fieldHtml = `
                  <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:9px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase;">
                      ${c.etiqueta} ${c.es_opcional ? '<span style="text-transform:none; font-weight:normal; font-style:italic;">(Opcional)</span>' : ''}
                    </label>
                    <select id="dfd_${c.id}" style="width:100%; padding:6px 10px; border-radius:6px; font-size:11px; border:1px solid #e2e8f0; outline:none; background:#f8fafc;">
                      <option value="">Seleccionar...</option>
                      ${options.map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                  </div>
                `;
              } else if (c.tipo === 'Técnico') {
                const technicians = (window.state?.workers || allWorkers).filter(w => w.rol === 'Técnico' || w.rol === 'Tecnico');
                fieldHtml = `
                  <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:9px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase;">
                      ${c.etiqueta} ${c.es_opcional ? '<span style="text-transform:none; font-weight:normal; font-style:italic;">(Opcional)</span>' : ''}
                    </label>
                    <select id="dfd_${c.id}" style="width:100%; padding:6px 10px; border-radius:6px; font-size:11px; border:1px solid #e2e8f0; outline:none; background:#f8fafc;">
                      <option value="">Seleccionar Técnico...</option>
                      ${technicians.map(w => `<option value="${w.id}" ${val === w.id ? 'selected' : ''}>${w.nombre} ${w.apellido || ''}</option>`).join('')}
                    </select>
                  </div>
                `;
              } else {
                fieldHtml = `
                  <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:9px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase;">
                      ${c.etiqueta} ${c.es_opcional ? '<span style="text-transform:none; font-weight:normal; font-style:italic;">(Opcional)</span>' : ''}
                    </label>
                    <input type="${c.tipo === 'Número' ? 'number' : (c.tipo==='Fecha'?'date':'text')}" id="dfd_${c.id}" value="${val}" style="width:100%; padding:6px 10px; border-radius:6px; font-size:11px; border:1px solid #e2e8f0; outline:none; background:#f8fafc;">
                  </div>
                `;
              }
              return fieldHtml;
            }).join('');

            fieldsContainer.innerHTML = inputsHtml + `
               <div style="margin-top:16px; display:flex; gap:8px;">
                  <button id="btn-save-drawer-fields" style="flex:1; background:#e2e8f0; color:#475569; border:none; padding:8px; border-radius:6px; font-weight:700; font-size:10px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#cbd5e1'" onmouseout="this.style.background='#e2e8f0'">
                     Guardar Progreso
                  </button>
                  ${isCurrentPhase ? `
                  <button id="btn-advance-drawer-fields" ${!isComplete ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="flex:1; background:${pipeline.color}; color:white; border:none; padding:8px; border-radius:6px; font-weight:700; font-size:10px; cursor:pointer; transition:filter 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='brightness(1)'">
                     Avanzar Fase
                  </button>
                  ` : ''}
               </div>
            `;

            const btnSave = document.getElementById('btn-save-drawer-fields');
            if (btnSave) {
                btnSave.onclick = async () => {
                    btnSave.textContent = 'Guardando...';
                    const updates = {};
                    phaseCampos.forEach(c => {
                        if(c.tipo !== 'Archivo') {
                            const el = document.getElementById('dfd_'+c.id);
                            if(el) updates[c.id] = el.value;
                        }
                    });
                    await saveDynamicFields(p.id, updates);
                    showToast('Campos guardados', 'success');
                    openKanbanDrawer(p.id, displayPhaseId);
                };
            }

            const btnAdv = document.getElementById('btn-advance-drawer-fields');
            if (btnAdv && isComplete) {
                btnAdv.onclick = async () => {
                    btnAdv.textContent = 'Espere...';
                    const updates = {};
                    phaseCampos.forEach(c => {
                        if(c.tipo !== 'Archivo') {
                            const el = document.getElementById('dfd_'+c.id);
                            if(el) updates[c.id] = el.value;
                        }
                    });
                    const res = await advanceDealPhase(p.id, updates);
                    if(res.didAdvance) {
                        showToast('Fase completada', 'success');
                        closeDrawer();
                        renderView();
                    }
                };
            }
          }
      }
  }

  // File Upload Handler is already globally attached to window.handleDrawerFileUpload
  
  // Store file data for preview access
  window._kanbanFileCache = {};
  fileRespuestas.forEach(r => { window._kanbanFileCache[r.campo_id] = { valor: r.valor, campo: campos.find(c => c.id === r.campo_id) }; });

  // Close handlers
  const closeDrawer = () => {
    const panel = document.getElementById('kanban-split-modal');
    if (panel) panel.style.animation = 'zoomOut 0.2s ease-in both';
    setTimeout(() => overlay.remove(), 200);
  };
  document.getElementById('kanban-drawer-close-btn').addEventListener('click', closeDrawer);
  document.getElementById('kanban-drawer-overlay').addEventListener('click', (e) => {
      if(e.target === overlay) closeDrawer();
  });
  
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { closeDrawer(); document.removeEventListener('keydown', esc); } });

  // Chat Observers Add logic
  const btnManageObs = document.getElementById('btn-manage-obs');
  if (btnManageObs) {
      btnManageObs.addEventListener('click', () => {
          const div = document.createElement('div');
          div.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
          
          const curIds = new Set(observadores.map(o=>o.id));
          const pRespIds = (p.responsable_id || '').split(',').map(id => id.trim()).filter(id => id);
          const eligible = allWorkers.filter(w => !pRespIds.includes(String(w.id)) && !curIds.has(w.id) && !w.is_suspended);
          
          div.innerHTML = `
          <div style="background:white;width:400px;border-radius:12px;padding:24px;max-height:80vh;display:flex;flex-direction:column;animation:zoomIn 0.2s ease-out;box-shadow:0 20px 40px rgba(0,0,0,0.2);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                  <h3 class="text-sm font-bold text-gray-800">Añadir Observador</h3>
                  <button id="close-obs" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
              </div>
              <div style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;">
                  ${eligible.length === 0 ? '<p class="text-center text-xs text-gray-400 py-4">No hay más usuarios disponibles</p>' : ''}
                  ${eligible.map(w => `
                  <div class="obs-item flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors" data-id="${w.id}">
                      <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center font-bold text-xs">
                              ${w.foto ? `<img src="${w.foto}" class="w-full h-full rounded-full object-cover">` : (w.nombre[0].toUpperCase())}
                          </div>
                          <div>
                              <div class="text-xs font-bold text-gray-800">${w.nombre} ${w.apellido||''}</div>
                              <div class="text-[10px] text-gray-500">${w.rol}</div>
                          </div>
                      </div>
                      <button class="add-obs-btn text-[10px] font-bold text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors" data-id="${w.id}">Añadir</button>
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
                      import('./api.js').then(async ({addObserver}) => {
                          try {
                              await addObserver(p.id, worker);
                              showToast('Observador añadido', 'success');
                              div.remove();
                              openKanbanDrawer(p.id, displayPhaseId);
                          } catch(e) {
                              showToast('Error: ' + e.message, 'error');
                          }
                      }).catch(e => {
                         showToast('Error de red', 'error');
                      });
                  }
              };
          });
      });
  }

  // Chat Search Logic
  const chatSearchInput = document.getElementById('chat-search-input');
  if (chatSearchInput) {
      chatSearchInput.addEventListener('input', (e) => {
          const query = e.target.value.toLowerCase().trim();
          let filtered = p.discusion || [];
          if (typeof filtered === 'string') {
              try { filtered = JSON.parse(filtered); } catch(err) { filtered = []; }
          }
          if (query) {
              filtered = filtered.filter(c => 
                  (c.text && c.text.toLowerCase().includes(query)) || 
                  (c.user && c.user.toLowerCase().includes(query)) ||
                  (c.fileName && c.fileName.toLowerCase().includes(query))
              );
          }
          const list = document.getElementById('discussion-list');
          if (list) {
              list.innerHTML = renderDiscussionHTML(filtered, pipeline.color);
          }
      });
  }

  // Chat Send Logic
  const btnSend = document.getElementById('btn-send-discussion');
  const inputDisc = document.getElementById('discussion-input');

  if (btnSend && inputDisc) {
      // Chat input file listener
      const chatFileInput = document.getElementById('chat-file-input');
      const chatFilePreview = document.getElementById('chat-file-preview');
      if (chatFileInput && chatFilePreview) {
          chatFileInput.addEventListener('change', (e) => {
              if (e.target.files && e.target.files.length > 0) {
                  chatFilePreview.textContent = e.target.files[0].name;
                  chatFilePreview.style.display = 'block';
              } else {
                  chatFilePreview.style.display = 'none';
              }
          });
      }

      const sendComment = async () => {
          const text = inputDisc.value.trim();
          const hasFile = chatFileInput && chatFileInput.files && chatFileInput.files.length > 0;
          
          if (!text && !hasFile) return;
          const user = getCurrentUser();
          
          let fileUrl = null;
          let fileName = null;
          
          if (hasFile) {
              const file = chatFileInput.files[0];
              fileName = file.name;
              try {
                  btnSend.innerHTML = '...';
                  if (typeof uploadFile === 'function') {
                      fileUrl = await uploadFile(file, 'chat');
                  } else {
                      fileUrl = await new Promise((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result);
                          reader.onerror = reject;
                          reader.readAsDataURL(file);
                      });
                  }
              } catch(e) {
                  console.error("Chat file upload error", e);
                  showToast('Error subiendo archivo', 'error');
                  btnSend.innerHTML = `<i class="fas fa-paper-plane text-sm"></i>`;
                  return;
              }
          }
          
          const comment = {
              type: 'user',
              user_id: user?.id,
              foto: user?.foto,
              user: user?.nombre || 'Usuario',
              text: text,
              fileUrl: fileUrl,
              fileName: fileName,
              date: new Date().toISOString()
          };
          
          if (!p.discusion) p.discusion = [];
          if (typeof p.discusion === 'string') {
              try { p.discusion = JSON.parse(p.discusion); } catch(e) { p.discusion = []; }
          }
          
          p.discusion.push(comment);

          try {
              btnSend.innerHTML = '...';
              await saveGranular('proyectos_dinamicos', [p]);
              inputDisc.value = '';
              if (chatFileInput) chatFileInput.value = '';
              if (chatFilePreview) chatFilePreview.style.display = 'none';
              const list = document.getElementById('discussion-list');
              list.innerHTML = renderDiscussionHTML(p.discusion, pipeline.color);
              list.scrollTop = list.scrollHeight;
          } catch(e) {
              console.error("Save discussion error:", e);
              showToast('Error al guardar: ' + e.message, 'error');
              p.discusion.pop();
          } finally {
              btnSend.innerHTML = `<i class="fas fa-paper-plane text-sm"></i>`;
          }
      };

      btnSend.addEventListener('click', sendComment);
      inputDisc.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') sendComment();
      });
      // auto-scroll chat to bottom
      setTimeout(() => {
         const list = document.getElementById('discussion-list');
         if(list) list.scrollTop = list.scrollHeight;
      }, 50);
  }
}
