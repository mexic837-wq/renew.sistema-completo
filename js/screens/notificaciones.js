import { initDB, getDB, saveDB, saveGranular, getCurrentUser } from '../api.js';

export async function renderNotificaciones() {
  const user = getCurrentUser();
  const screen = document.getElementById('screen-notificaciones');
  if (!screen) return;

  // Asegurar que la pantalla tenga fondo
  screen.style.background = 'var(--bg)';

  if (!user) {
    screen.innerHTML = `<div style="padding:40px; text-align:center; color:white;">Sesión no iniciada</div>`;
    return;
  }

  try {
    const db = getDB() || {};
    const anuncios = db.anuncios_corporativos || [];
    const meetings = db.admin_meetings || [];
    const meetingReads = db.admin_meetings_reads || [];

    // localStorage is the reliable source of truth for meeting reads
    // (Supabase rejects custom string IDs in UUID columns silently)
    const localReadsKey = `rs_meeting_reads_${user.id}`;
    const localReadIds = JSON.parse(localStorage.getItem(localReadsKey) || '[]');

  // Recopilar Anuncios para el usuario
  const misAnuncios = anuncios.filter(an => {
    if (!an.estado_lecturas) return false;
    const miLectura = an.estado_lecturas.find(l => l.vendedor_id === user.id);
    return !!miLectura;
  }).map(an => {
    const miLectura = an.estado_lecturas.find(l => l.vendedor_id === user.id);
    return {
      type: 'anuncio',
      id: an.id,
      title: an.titulo,
      message: an.mensaje,
      date: new Date(an.fecha),
      isRead: miLectura ? miLectura.leido : false,
      foto_url: an.foto_url,
      originalData: an
    };
  });

  // Recopilar Meetings para el usuario
  // Meetings usan tags de audiencia.
  const myWorkers = window._cachedAdminWorkers || []; 
  // Wait, in app, we don't have _cachedAdminWorkers easily. 
  // If the meeting has `audiencia_tags`, check if user matches.
  // "Todos", role, or pipeline.
  const misMeetings = meetings.filter(mt => {
      const tags = mt.audiencia_tags || [mt.audiencia || 'Todos'];
      const isAll = tags.includes('todos') || tags.includes('Todos');
      if (isAll) return true;
      const matchesRole = tags.some(tag => tag.toLowerCase() === (user.rol || '').toLowerCase());
      const pipelinePerms = user.pipeline_perms || [];
      const matchesPipe = tags.some(tag => pipelinePerms.includes(tag) || (user.unidades || []).includes(tag));
      const matchesUser = tags.includes(`user_${user.id}`);
      return matchesRole || matchesPipe || matchesUser;
  }).map(mt => {
      // Check localStorage first (reliable), then DB as fallback
      const isRead = localReadIds.includes(String(mt.id))
                  || meetingReads.some(r => String(r.meeting_id) === String(mt.id) && String(r.user_id) === String(user.id));
      return {
          type: 'meeting',
          id: mt.id,
          title: mt.titulo,
          message: mt.texto,
          date: new Date(mt.created_at),
          isRead: isRead,
          enlace: mt.enlace,
          foto_url: mt.imagen_url,
          originalData: mt
      };
  });

  // Recopilar Asignaciones de Técnico
  const misAsignaciones = (db.Proyectos_Dinamicos || []).filter(p => {
      if (p.tecnico_id !== user.id) return false;
      // Sólo si es pipeline de Water o si el técnico está asignado a otro que requiera
      const pipe = (db.Admin_Pipelines || []).find(x => x.id === p.pipeline_id);
      if (!pipe || !pipe.nombre.toLowerCase().includes('water')) return false;
      // Verificar si ya respondió localmente
      const hasResponded = localStorage.getItem(`rs_asig_resp_${p.id}_${user.id}`);
      return !hasResponded; // Si no hay respuesta, está pendiente
  }).map(p => {
      const cli = (db.Clientes_Maestro || []).find(c => c.id === p.cliente_id) || {};
      return {
          type: 'asignacion',
          id: p.id,
          title: `Nueva Asignación: ${cli.nombre || 'Cliente'}`,
          message: `Has sido asignado a un nuevo proyecto de Water para ${cli.nombre || 'Cliente'}. Por favor acepta o rechaza la asignación.`,
          date: new Date(p.fecha || p.created_at || Date.now()),
          isRead: false,
          originalData: p,
          cliente: cli
      };
  });

  // Recopilar Eventos de Calendario
  const misEventosCalendario = (db.calendario_eventos || []).filter(ev => {
      if (!ev.attendees || !Array.isArray(ev.attendees)) return false;
      return ev.attendees.some(a => String(a.id) === String(user.id));
  }).map(ev => {
      const isRead = (db.calendario_eventos_reads || []).some(r => r.event_id === ev.id && r.user_id === user.id);
      return {
          type: 'evento_calendario',
          id: ev.id,
          title: `Invitación a Evento: ${ev.nombre}`,
          message: `Has sido invitado al evento "${ev.nombre}" el ${new Date(ev.fecha_inicio).toLocaleDateString()}.`,
          date: new Date(ev.created_at || ev.fecha_inicio),
          isRead: isRead,
          originalData: ev
      };
  });

  // Recopilar Asignaciones como Observador
  const misObservaciones = (db.Proyectos_Dinamicos || []).filter(p => {
      if (!p.observadores) return false;
      return p.observadores.some(o => String(o.id) === String(user.id));
  }).map(p => {
      const cli = (db.Clientes_Maestro || []).find(c => c.id === p.cliente_id) || {};
      const obs = p.observadores.find(o => String(o.id) === String(user.id));
      const isRead = (db.Observadores_Reads || []).some(r => r.proyecto_id === p.id && String(r.user_id) === String(user.id));
      return {
          type: 'observador',
          id: p.id,
          title: `Observador en Proyecto`,
          message: `Has sido añadido como observador en el proyecto de ${cli.nombre || 'Cliente'}.`,
          date: new Date(obs.added_at || p.created_at || Date.now()),
          isRead: isRead,
          originalData: p,
          cliente: cli
      };
  });

  // Recopilar Menciones en Chat
  const misMencionesChat = (db.Proyectos_Dinamicos || []).flatMap(p => {
      let discusionArray = [];
      try { discusionArray = typeof p.discusion === 'string' ? JSON.parse(p.discusion || '[]') : (p.discusion || []); } catch(e) {}
      
      const mentionsToMe = discusionArray.filter(msg => (msg.mentions || []).includes(String(user.id)));
      if (mentionsToMe.length === 0) return [];
      
      const lastMessage = mentionsToMe[mentionsToMe.length - 1];
      const chatReadData = JSON.parse(localStorage.getItem(`chat_read_${user.id}_${p.id}`) || '0');
      const msgDate = new Date(lastMessage.date).getTime();
      const isRead = msgDate <= chatReadData;

      const cli = (db.Clientes_Maestro || []).find(c => c.id === p.cliente_id) || {};
      
      return {
          type: 'chat_mention',
          id: p.id,
          title: `Mención en Chat de Proyecto`,
          message: `${lastMessage.user || 'Alguien'} te mencionó: "${lastMessage.text}"`,
          date: new Date(lastMessage.date),
          isRead: isRead,
          originalData: p,
          cliente: cli
      };
  });

  // Show ONLY global announcements and global meetings
  const allItems = [...misAnuncios, ...misMeetings].sort((a,b) => b.date - a.date);

  let listHtml = '';
  if (allItems.length === 0) {
    listHtml = `
      <div style="padding: 80px 20px; text-align: center; display: flex; flex-direction: column; align-items: center;">
        <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--surface-alt); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);">
          <i class="fa-solid fa-inbox" style="font-size: 2.2rem; color: var(--text-muted); opacity: 0.6;"></i>
        </div>
        <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">Todo al día</h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 250px;">No tienes mensajes nuevos en tu bandeja de entrada.</p>
      </div>
    `;
  } else {
    listHtml = allItems.map(item => {
      const dateStr = item.date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
      const isUnread = !item.isRead;
      
      const iconContainerStyle = item.type === 'meeting' 
        ? 'background: rgba(59, 130, 246, 0.15); color: #60a5fa;' 
        : item.type === 'asignacion' 
          ? 'background: rgba(245, 158, 11, 0.15); color: #f59e0b;' 
          : item.type === 'evento_calendario'
            ? 'background: rgba(16, 185, 129, 0.15); color: #10b981;'
            : item.type === 'observador'
              ? 'background: rgba(139, 92, 246, 0.15); color: #8b5cf6;'
                : item.type === 'adelanto'
                  ? 'background: rgba(14, 165, 233, 0.15); color: #0ea5e9;'
                  : item.type === 'chat_mention'
                    ? 'background: rgba(168, 85, 247, 0.15); color: #a855f7;'
                    : 'background: rgba(0, 245, 212, 0.15); color: var(--primary);';
      const iconClass = item.type === 'meeting' ? 'fa-video' : item.type === 'asignacion' ? 'fa-clipboard-user' : item.type === 'evento_calendario' ? 'fa-calendar-check' : item.type === 'observador' ? 'fa-eye' : item.type === 'adelanto' ? 'fa-hand-holding-dollar' : item.type === 'chat_mention' ? 'fa-comments' : 'fa-bullhorn';

      return `
        <div class="notif-item border-b border-gray-100 dark:border-white/5" data-id="${item.id}" data-type="${item.type}" style="display: flex; align-items: flex-start; padding: 20px 24px; cursor: pointer; transition: all 0.25s ease; position: relative; ${isUnread ? 'background: linear-gradient(to right, rgba(0,245,212,0.03), transparent);' : ''}">
          
          ${isUnread ? '<div class="unread-border" style="position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--primary); box-shadow: 0 0 12px var(--primary-glow); border-radius: 0 4px 4px 0;"></div>' : ''}

          <div style="width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; margin-right: 18px; ${iconContainerStyle} box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <i class="fa-solid ${iconClass}"></i>
          </div>
          
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <h4 class="notif-title" style="margin: 0; font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); transition: all 0.2s; ${isUnread ? 'font-weight: 800;' : 'font-weight: 500; opacity: 0.7;'}">${item.title}</h4>
              <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 12px; flex-shrink: 0; font-weight: 600;">${dateStr}</span>
            </div>
            <p class="notif-msg" style="margin: 0; font-size: 0.9rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: all 0.2s; ${isUnread ? 'font-weight: 700;' : 'font-weight: 400; opacity: 0.6;'}">${item.message}</p>
          </div>

          ${isUnread ? '<div class="unread-dot" style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 8px var(--primary); margin-left: 16px; align-self: center; flex-shrink: 0;"></div>' : ''}
        </div>
      `;
    }).join('');
  }

  screen.innerHTML = `
    <div id="notif-list-view" style="width: 100%;">
      <div class="dash-header" style="padding-bottom: 12px; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.03); margin-bottom: 20px;">
        <div class="dash-header-top" style="max-width: 800px; margin: 0 auto; width: 100%;">
          <div class="dash-greeting">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <div class="greeting-time" style="margin-bottom:0;">Mantente al día con el equipo</div>
            </div>
            <h1 style="font-size:1.3rem;">Anuncios <i class="fa-solid fa-bullhorn"></i></h1>
          </div>
        </div>
      </div>
      <div class="notifs-container" style="min-height: calc(100vh - 150px); padding-bottom: 120px; max-width: 800px; margin: 0 auto; width: 100%;">
          ${listHtml}
      </div>
    </div>

    <!-- Detalles View (Integrated, not a popup) -->
    <div id="notif-detail-view" style="display: none; width: 100%; min-height: 100vh; background: var(--bg);">
        <!-- Header background spans full width -->
        <div class="bg-white/80 dark:bg-[#121212]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 sticky top-0 z-10 w-full">
            <!-- Header content centered -->
            <div style="display: flex; align-items: center; padding: 20px 24px; max-width: 900px; margin: 0 auto; width: 100%;">
                <button id="btn-close-notif-detail" class="bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10" style="width: 44px; height: 44px; border-radius: 50%; border: none; font-size: 1.2rem; cursor: pointer; margin-right: 18px; display: flex; justify-content: center; align-items: center; transition: all 0.2s ease;">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.4px;">Leer Mensaje</h3>
            </div>
        </div>

        <!-- Content Area -->
        <div id="notif-detail-content" style="max-width: 900px; margin: 0 auto; padding-bottom: 100px; width: 100%;">
        </div>
    </div>
  `;

  // Attach event listeners for each item
  const items = screen.querySelectorAll('.notif-item');
  items.forEach(el => {
      el.addEventListener('click', async () => {
          const id = el.dataset.id;
          const type = el.dataset.type;
          const item = allItems.find(i => i.id === id && i.type === type);
          if (!item) return;

          if (type === 'chat_mention') {
             localStorage.setItem(`chat_read_${user.id}_${id}`, Date.now().toString());
             window.location.hash = '#detail/' + id;
             return;
          }

          // Mostrar Modal
          const modal = document.getElementById('notif-detail-modal');
          const content = document.getElementById('notif-detail-content');
          
          let html = `
            <div style="height: 32px;"></div>
            <div style="padding: 0 24px;">
              <div style="display: inline-flex; align-items: center; padding: 6px 14px; background: ${item.type === 'meeting' ? 'rgba(59, 130, 246, 0.15)' : item.type === 'asignacion' ? 'rgba(245, 158, 11, 0.15)' : item.type === 'evento_calendario' ? 'rgba(16, 185, 129, 0.15)' : item.type === 'observador' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(0, 245, 212, 0.15)'}; color: ${item.type === 'meeting' ? '#60a5fa' : item.type === 'asignacion' ? '#f59e0b' : item.type === 'evento_calendario' ? '#10b981' : item.type === 'observador' ? '#8b5cf6' : 'var(--primary)'}; border-radius: 20px; font-size: 0.75rem; font-weight: 800; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${item.type === 'meeting' ? '<i class="fa-solid fa-video" style="margin-right: 8px;"></i> Reunión' : item.type === 'asignacion' ? '<i class="fa-solid fa-clipboard-user" style="margin-right: 8px;"></i> Asignación de Proyecto' : item.type === 'evento_calendario' ? '<i class="fa-solid fa-calendar-check" style="margin-right: 8px;"></i> Invitación a Evento' : item.type === 'observador' ? '<i class="fa-solid fa-eye" style="margin-right: 8px;"></i> Observador de Proyecto' : '<i class="fa-solid fa-bullhorn" style="margin-right: 8px;"></i> Anuncio Corporativo'}
              </div>
              <h2 style="font-size: 1.7rem; font-weight: 900; color: var(--text-primary); margin: 0 0 12px 0; line-height: 1.25; letter-spacing: -0.5px;">${item.title}</h2>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 32px; display: flex; align-items: center; font-weight: 500;">
                  <i class="fa-regular fa-clock" style="margin-right: 8px; font-size: 0.95rem;"></i> ${item.date.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
              </div>
              
              <div style="font-size: 1.1rem; line-height: 1.7; color: #cbd5e1; white-space: pre-wrap; margin-bottom: 32px; font-weight: 400; letter-spacing: 0.2px;">${item.message}</div>
              
              ${item.foto_url ? `
                <div style="width: 100%; border-radius: 20px; overflow: hidden; margin-bottom: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05);">
                  <img src="${item.foto_url}" style="width: 100%; display: block; object-fit: cover;">
                </div>
              ` : ''}
          `;

          if (item.type === 'meeting' && item.enlace) {
              html += `
                <div style="background: rgba(59, 130, 246, 0.04); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: 20px; padding: 28px 24px; text-align: center; margin-top: 20px; position: relative; overflow: hidden;">
                  <div style="position: absolute; top: -20px; left: -20px; width: 80px; height: 80px; background: rgba(59, 130, 246, 0.1); border-radius: 50%; filter: blur(20px);"></div>
                  <h4 style="margin: 0 0 16px 0; color: #e2e8f0; font-size: 1.15rem; font-weight: 800; position: relative; z-index: 1;">Sala Virtual</h4>
                  <a href="${item.enlace}" target="_blank" style="display: inline-flex; align-items: center; justify-content: center; padding: 16px 32px; background: #3b82f6; color: white; border-radius: 16px; font-weight: 800; text-decoration: none; width: 100%; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.35); transition: all 0.2s ease; font-size: 1.05rem; position: relative; z-index: 1;">
                      <i class="fa-solid fa-video" style="margin-right: 12px; font-size: 1.2rem;"></i> Unirse a la Reunión
                  </a>
                </div>
              `;
          }

          if (item.type === 'asignacion') {
              html += `
                <div style="background: rgba(245, 158, 11, 0.04); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: 20px; padding: 28px 24px; text-align: center; margin-top: 20px; position: relative;">
                  <h4 style="margin: 0 0 16px 0; color: #e2e8f0; font-size: 1.15rem; font-weight: 800; position: relative; z-index: 1;">Responde a esta asignación</h4>
                  
                  <div id="asignacion-actions" style="display:flex; gap:12px; justify-content:center; position:relative; z-index:1;">
                      <button id="btn-rechazar-asig" style="flex:1; padding: 14px 20px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid #ef4444; border-radius: 12px; font-weight: 800; cursor:pointer; transition: all 0.2s;">
                          <i class="fa-solid fa-xmark mr-2"></i> Rechazar
                      </button>
                      <button id="btn-aceptar-asig" style="flex:1; padding: 14px 20px; background: #f59e0b; color: white; border: none; border-radius: 12px; font-weight: 800; cursor:pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);">
                          <i class="fa-solid fa-check mr-2"></i> Aceptar
                      </button>
                  </div>

                  <div id="asignacion-horario" style="display:none; margin-top:20px; text-align:center; position:relative; z-index:1;">
                      <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:16px;">Procesando tu respuesta...</p>
                  </div>
                </div>
              `;
          }

          if (item.type === 'evento_calendario') {
              html += `
                <div style="background: rgba(16, 185, 129, 0.04); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 20px; padding: 28px 24px; text-align: center; margin-top: 20px; position: relative; overflow: hidden;">
                  <h4 style="margin: 0 0 16px 0; color: #e2e8f0; font-size: 1.15rem; font-weight: 800; position: relative; z-index: 1;">Ir al Calendario</h4>
                  <a href="#" onclick="window.appNavigate('mi-calendario'); document.getElementById('notif-detail-view').style.display = 'none'; document.getElementById('notif-list-view').style.display = 'block'; return false;" style="display: inline-flex; align-items: center; justify-content: center; padding: 16px 32px; background: #10b981; color: white; border-radius: 16px; font-weight: 800; text-decoration: none; width: 100%; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.35); transition: all 0.2s ease; font-size: 1.05rem; position: relative; z-index: 1;">
                      <i class="fa-solid fa-calendar-check" style="margin-right: 12px; font-size: 1.2rem;"></i> Ver en mi Calendario
                  </a>
                </div>
              `;
          }

          if (item.type === 'adelanto') {
              html += `
                <div style="background: rgba(14, 165, 233, 0.04); border: 1px solid rgba(14, 165, 233, 0.15); border-radius: 20px; padding: 28px 24px; text-align: center; margin-top: 20px; position: relative; overflow: hidden;">
                  <h4 style="margin: 0 0 16px 0; color: #e2e8f0; font-size: 1.15rem; font-weight: 800; position: relative; z-index: 1;">Ver mis Adelantos</h4>
                  <a href="#" onclick="window.appNavigate('mis-adelantos'); document.getElementById('notif-detail-view').style.display = 'none'; document.getElementById('notif-list-view').style.display = 'block'; return false;" style="display: inline-flex; align-items: center; justify-content: center; padding: 16px 32px; background: #0ea5e9; color: white; border-radius: 16px; font-weight: 800; text-decoration: none; width: 100%; box-shadow: 0 10px 25px rgba(14, 165, 233, 0.35); transition: all 0.2s ease; font-size: 1.05rem; position: relative; z-index: 1;">
                      <i class="fa-solid fa-hand-holding-dollar" style="margin-right: 12px; font-size: 1.2rem;"></i> Ver Mis Adelantos
                  </a>
                </div>
              `;
          }
          
          html += `</div>`; // Cierra el div de padding

          content.innerHTML = html;
          
          document.getElementById('notif-list-view').style.display = 'none';
          document.getElementById('notif-detail-view').style.display = 'block';
          window.scrollTo(0, 0);

          document.getElementById('btn-close-notif-detail').onclick = () => {
              document.getElementById('notif-detail-view').style.display = 'none';
              document.getElementById('notif-list-view').style.display = 'block';
          };

          if (item.type === 'asignacion') {
              const btnRechazar = document.getElementById('btn-rechazar-asig');
              const btnAceptar = document.getElementById('btn-aceptar-asig');
              const divHorario = document.getElementById('asignacion-horario');
              const divActions = document.getElementById('asignacion-actions');
              const btnConfirmar = document.getElementById('btn-confirmar-horario');
              const inpHorario = document.getElementById('inp-horario-asig');

              if (btnAceptar) {
                  btnAceptar.onclick = async () => {
                      btnAceptar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aceptando...';
                      divActions.style.pointerEvents = 'none';

                      // Buscar la fecha y hora seleccionada por el admin
                      let horarioAsignado = null;
                      const respuestas = db.Respuestas_Dinamicas || [];
                      const campos = db.Admin_Campos_Formulario || [];
                      
                      // Buscar respuesta para este proyecto cuyo campo sea de tipo FechaHora
                      const respHorario = respuestas.find(r => 
                          r.proyecto_id === item.originalData.id && 
                          campos.some(c => c.id === r.campo_id && (c.tipo === 'FechaHora' || c.tipo === 'Fecha y Hora'))
                      );
                      if (respHorario && respHorario.valor && respHorario.valor !== 'No provisto' && respHorario.valor !== 'No subido') {
                          horarioAsignado = respHorario.valor;
                      } else {
                          // Fallback si no hay fecha asignada
                          horarioAsignado = new Date().toISOString(); 
                      }

                      await procesarRespuestaAsignacion(item.originalData, item.cliente, 'Aceptado', horarioAsignado, user);
                      document.getElementById('btn-close-notif-detail').click();
                      renderNotificaciones(); // reload list
                  };
              }

              if (btnRechazar) {
                  btnRechazar.onclick = async () => {
                      btnRechazar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
                      await procesarRespuestaAsignacion(item.originalData, item.cliente, 'Rechazado', null, user);
                      document.getElementById('btn-close-notif-detail').click();
                      renderNotificaciones(); // reload list
                  };
              }

              // El botón btnConfirmar ha sido eliminado ya que no hay selección manual de horario
          }

          // Marcar como leído
          if (!item.isRead) {
              if (item.type === 'anuncio') {
                  const miLectura = item.originalData.estado_lecturas.find(l => l.vendedor_id === user.id);
                  if (miLectura) {
                      miLectura.leido = true;
                      miLectura.fecha_lectura = new Date().toISOString();
                      await saveDB(db);
                  }
              } else if (item.type === 'meeting') {
                  // PRIMARY: Save to localStorage (always works, survives re-renders and refreshes)
                  const lrKey = `rs_meeting_reads_${user.id}`;
                  const lrIds = JSON.parse(localStorage.getItem(lrKey) || '[]');
                  if (!lrIds.includes(String(item.id))) {
                      lrIds.push(String(item.id));
                      localStorage.setItem(lrKey, JSON.stringify(lrIds));
                  }
                  // Also update the local localReadIds array so badge updates immediately
                  if (!localReadIds.includes(String(item.id))) {
                      localReadIds.push(String(item.id));
                  }
                  // SECONDARY: Try to sync to Supabase (best-effort, may fail if IDs are not UUID format)
                  try {
                      const dbNow = getDB();
                      if (!dbNow.admin_meetings_reads) dbNow.admin_meetings_reads = [];
                      const alreadyInCache = dbNow.admin_meetings_reads.some(r => String(r.meeting_id) === String(item.id) && String(r.user_id) === String(user.id));
                      if (!alreadyInCache) {
                          const readId = `rd_${String(item.id)}_${String(user.id)}`;
                          const newRead = { id: readId, meeting_id: String(item.id), user_id: String(user.id), read_at: new Date().toISOString() };
                          dbNow.admin_meetings_reads.push(newRead);
                          meetingReads.push(newRead);
                          await saveGranular('admin_meetings_reads', [newRead]);
                      }
                  } catch(syncErr) {
                      console.warn('[Notif] No se pudo sincronizar lectura de meeting a Supabase:', syncErr.message);
                  }
              } else if (item.type === 'evento_calendario') {
                  if (!db.calendario_eventos_reads) db.calendario_eventos_reads = [];
                  const newRead = {
                      id: 'rd_' + Date.now().toString(36),
                      event_id: item.id,
                      user_id: user.id,
                      read_at: new Date().toISOString()
                  };
                  db.calendario_eventos_reads.push(newRead);
                  await saveGranular('calendario_eventos_reads', [newRead]);
              } else if (item.type === 'observador') {
                  if (!db.Observadores_Reads) db.Observadores_Reads = [];
                  const newRead = {
                      id: 'rd_' + Date.now().toString(36),
                      proyecto_id: item.id,
                      user_id: user.id,
                      read_at: new Date().toISOString()
                  };
                  db.Observadores_Reads.push(newRead);
                  await saveGranular('observadores_reads', [newRead]);
              }
              
              // Actualizar badge del menu principal
              if (window.verificarAnunciosNuevos) {
                  window.verificarAnunciosNuevos();
              }
              
              // Actualizar UI para quitar la marca de no leído de forma animada
              el.style.background = 'transparent';
              const border = el.querySelector('.unread-border');
              if (border) border.style.opacity = '0';
              const dot = el.querySelector('.unread-dot');
              if (dot) dot.style.opacity = '0';
              
              const title = el.querySelector('.notif-title');
              const msg = el.querySelector('.notif-msg');
              if (title) { title.style.fontWeight = '500'; title.style.opacity = '0.7'; }
              if (msg) { msg.style.fontWeight = '400'; msg.style.color = 'var(--text-secondary)'; msg.style.opacity = '0.6'; }
              
              item.isRead = true;
          }
      });
  });

  } catch (err) {
    console.error("Error en renderNotificaciones:", err);
    screen.innerHTML = `
      <div style="padding: 100px 20px; text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: #ff4757; margin-bottom: 20px; display: block;"></i>
        <h2 style="color: white; margin-bottom: 10px;">Hubo un error al cargar</h2>
        <p style="font-size: 0.8rem;">${err.message}</p>
        <button onclick="location.reload()" style="margin-top: 24px; padding: 12px 24px; background: var(--primary); color: black; border: none; border-radius: 12px; font-weight: 800;">REINTENTAR</button>
      </div>
    `;
  }
}

async function procesarRespuestaAsignacion(proyecto, cliente, decision, horario, user) {
    const db = getDB();
    
    // 1. Guardar la respuesta en localStorage para evitar volver a preguntar en este dispositivo
    // Ya que no podemos insertar IDs de campos falsos en Respuestas_Dinamicas por la llave foránea
    localStorage.setItem(`rs_asig_resp_${proyecto.id}_${user.id}`, decision);

    // 2. Si Aceptado, guardar en calendario_eventos
    if (decision === 'Aceptado' && horario) {
        const evtId = 'ev_' + Date.now().toString(36);
        const fechaInicio = new Date(horario).toISOString();
        const endDate = new Date(new Date(horario).getTime() + 2 * 3600000); // +2 hours
        
        const colaboradores = [{
            id: user.id,
            nombre: `${user.nombre || ''} ${user.apellido || ''}`.trim(),
            email: user.email || ''
        }];
        
        if (proyecto.vendedor_id || proyecto.responsable_id) {
            colaboradores.push({
                id: proyecto.vendedor_id || proyecto.responsable_id,
                nombre: 'Vendedor',
                email: ''
            });
        }

        const newEvent = {
            id: evtId,
            nombre: `Instalación Water: ${cliente.nombre || 'Cliente'}`,
            fecha_inicio: fechaInicio,
            fecha_fin: endDate.toISOString(),
            direccion: cliente.direccion || '',
            descripcion: 'Instalación programada confirmada por el técnico.',
            color: 'Azul',
            colaboradores: colaboradores,
            departamentos: ['Water'],
            attendees: [],
            created_at: new Date().toISOString(),
            proyecto_id: proyecto.id
        };
        if (!db.calendario_eventos) db.calendario_eventos = [];
        db.calendario_eventos.push(newEvent);
        await saveGranular('calendario_eventos', [newEvent]);
    }

    // 3. Enviar Webhook
    try {
        const payload = {
            proyecto_id: proyecto.id,
            cliente_nombre: cliente.nombre || 'Desconocido',
            tecnico_id: user.id,
            tecnico_nombre: user.nombre + ' ' + (user.apellido || ''),
            vendedor_id: proyecto.vendedor_id || proyecto.responsable_id || null,
            decision: decision,
            horario: horario || null,
            admin_link: `https://renewgroup.site/admin.html`,
            timestamp: new Date().toISOString()
        };

        await fetch('https://n8n.renewgroup.site/webhook/tecnico-respuesta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("Error enviando webhook de respuesta de técnico", e);
    }
}
