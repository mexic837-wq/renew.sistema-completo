/* ============================================================
   RENEW SOLAR – screens/calendar.js
   ============================================================ */
import { getCurrentUser, navigate } from '../app.js';
import { getDB, saveGranular, deleteRecord, getAdminWorkers } from '../api.js';
import { t } from '../i18n.js';

export async function renderMiCalendario() {
  const user = getCurrentUser();
  const screen = document.getElementById('screen-mi-calendario');
  if (!screen) return;

  screen.innerHTML = `
    <div class="dash-header" style="padding-bottom: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; min-height: 44px;">
        <button id="btn-calendar-back" style="background: none; border: none; color: var(--text-primary); padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          <i class="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div style="text-align: center; flex: 1;">
          <h1 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">Mi Calendario</h1>
          <p style="color:var(--text-muted); font-size:0.7rem; margin: 0; font-weight: 500;">Eventos asignados</p>
        </div>
        <div style="width: 44px;"></div> <!-- Placeholder -->
      </div>
    </div>
    <div style="padding: 16px; padding-bottom: 100px;">
      <style>
        /* FullCalendar Mobile Tweaks */
        @media (max-width: 600px) {
          .fc .fc-toolbar {
            flex-direction: column;
            gap: 12px;
          }
          .fc-toolbar-title {
            font-size: 1.1rem !important;
            text-align: center;
          }
        }
        /* Hide toolbar button on mobile, show only FAB */
        @media (max-width: 767px) {
          .fc-addEvent-button { display: none !important; }
        }
        /* Hide FAB on desktop, show toolbar button */
        @media (min-width: 768px) {
          #fab-add-event { display: none !important; }
        }
        .nuclear-hidden { display: none !important; }
        
        .fc-addEvent-button {
          background-color: var(--primary) !important;
          border-color: var(--primary) !important;
          color: #000 !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          font-size: 0.7rem !important;
          padding: 8px 16px !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 12px rgba(0,223,191,0.3) !important;
          transition: all 0.2s !important;
        }
        .fc-addEvent-button:hover {
          transform: translateY(-2px) !important;
          filter: brightness(1.1) !important;
        }

        /* --- NUEVOS ESTILOS PARA PROPORCIONES DE TARJETAS --- */
        /* Estilo píldora específico para la cuadrícula del mes */
        .fc-daygrid-event {
          border: none !important;
          border-radius: 8px !important;
          padding: 0 !important;
          margin: 2px auto !important;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1) !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          height: auto !important;
          min-height: 40px !important;
          display: flex !important;
          align-items: stretch !important;
          overflow: hidden !important;
          width: 95% !important;
          background-color: transparent !important;
          white-space: normal !important;
        }
        .fc-daygrid-event-harness {
          display: flex !important;
          justify-content: center !important;
        }
        .fc-daygrid-event:hover {
          transform: translateY(-1px) scale(1.02) !important;
          box-shadow: 0 8px 20px rgba(0,0,0,0.3) !important;
          filter: brightness(1.1);
        }
        .fc-daygrid-event .fc-event-main {
          color: inherit !important;
          font-weight: 800 !important;
          font-size: 0.68rem !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          width: 100%;
          overflow: hidden;
        }
        /* Ajustes para la vista de lista (semanal) */
        .fc-list-event {
          cursor: pointer !important;
        }
        .fc-list-event-title {
          font-weight: 800 !important;
          font-size: 0.85rem !important;
        }
        .fc-list-event-time {
          font-weight: 900 !important;
          color: var(--primary) !important;
        }
        .fc-list-day-cushion {
          background-color: var(--surface-alt) !important;
          color: var(--text-primary) !important;
          padding: 12px 16px !important;
        }
        .fc-list-day-text, .fc-list-day-side-text {
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          font-size: 0.7rem !important;
          color: var(--text-primary) !important;
        }
        .fc-list-table {
          background-color: transparent !important;
        }
        .fc-list-empty {
          background-color: var(--surface) !important;
          color: var(--text-muted) !important;
        }
        .fc-event-time {
          background: rgba(0,0,0,0.1);
          padding: 1px 6px;
          border-radius: 8px;
          font-size: 0.6rem !important;
          font-weight: 900 !important;
          color: rgba(0,0,0,0.7) !important;
          flex-shrink: 0;
        }
        .fc-event-title {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fc-daygrid-event {
          margin-top: 2px !important;
          margin-bottom: 2px !important;
        }
        .fc-daygrid-day-number {
          font-weight: 800 !important;
          font-size: 0.85rem !important;
          color: var(--text-muted) !important;
          padding: 10px !important;
          text-decoration: none !important;
        }
        .fc-col-header-cell-cushion {
          font-size: 0.65rem !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: 1.5px !important;
          color: var(--text-muted) !important;
          padding: 10px 0 !important;
          text-decoration: none !important;
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border: 1px solid rgba(255,255,255,0.03) !important;
        }
        .fc-daygrid-day-frame {
          min-height: 80px !important;
        }
        .fc-scrollgrid {
          border: none !important;
          border-radius: 20px !important;
          overflow: hidden !important;
        }
        .fc-day-today {
          background: rgba(0,245,212,0.05) !important;
        }
        .fc-day-today .fc-daygrid-day-number {
          color: var(--primary) !important;
          font-size: 1.1rem !important;
          font-weight: 900 !important;
        }
      </style>
      <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">
          <input type="checkbox" id="chk-filter-eventos" checked style="width: 16px; height: 16px; accent-color: var(--primary);">
          <span>Eventos</span>
        </label>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">
          <input type="checkbox" id="chk-filter-cumple" checked style="width: 16px; height: 16px; accent-color: #ec4899;">
          <span>Cumpleaños</span>
        </label>
      </div>
      <div id="mi-calendario-container" style="background: var(--surface); border-radius: 32px; padding: 12px; box-shadow: var(--shadow-xl); min-height: 550px; border: 1px solid var(--border);"></div>
    </div>
    <button id="fab-add-event" style="position: fixed; bottom: 85px; right: 20px; width: 64px; height: 64px; border-radius: 50%; background: var(--primary); color: #000; border: none; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; cursor: pointer; box-shadow: 0 8px 30px rgba(0,223,191,0.5); z-index: 100; transition: transform 0.2s;">
      <i class="fa-solid fa-plus"></i>
    </button>
  `;

  let currentEventId = null;

  // Listeners
  setTimeout(() => {
    const btnBack = document.getElementById('btn-calendar-back');
    if (btnBack) btnBack.addEventListener('click', () => navigate('dashboard'));

    const fabAdd = document.getElementById('fab-add-event');
    if (fabAdd) fabAdd.addEventListener('click', () => mostrarDetalleEventoCalendario(null));

    const btnGuardar = document.getElementById('btn-guardar-evento');
    if (btnGuardar) {
        const newBtn = btnGuardar.cloneNode(true);
        btnGuardar.parentNode.replaceChild(newBtn, btnGuardar);
        newBtn.addEventListener('click', (e) => guardarEventoCalendario(e));
    }

    const btnEditar = document.getElementById('btn-editar-evento');
    if (btnEditar) btnEditar.addEventListener('click', () => switchEventToEditMode());

    const btnEliminar = document.getElementById('btn-eliminar-evento');
    if (btnEliminar) btnEliminar.addEventListener('click', () => eliminarEventoCalendario());
  }, 100);

  const calendarEl = document.getElementById('mi-calendario-container');
  if (!calendarEl) return;

  const chkEventos = document.getElementById('chk-filter-eventos');
  const chkCumple = document.getElementById('chk-filter-cumple');
  if (chkEventos) chkEventos.addEventListener('change', () => { if (window.currentCalendarApp) window.currentCalendarApp.refetchEvents(); });
  if (chkCumple) chkCumple.addEventListener('change', () => { if (window.currentCalendarApp) window.currentCalendarApp.refetchEvents(); });

  // Forzar estilos para sobrescribir los pills de FullCalendar
  if (!document.getElementById('calendar-custom-styles')) {
    const style = document.createElement('style');
    style.id = 'calendar-custom-styles';
    style.innerHTML = `
      .fc-event, .fc-event-dot { background-color: transparent !important; border: none !important; }
      .fc-event-main { padding: 0 !important; width: 100%; height: 100%; }
      .fc-h-event { background: transparent !important; border: none !important; }
      .fc-daygrid-event { background: transparent !important; border: none !important; }
    `;
    document.head.appendChild(style);
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    initialView: 'dayGridMonth',
    customButtons: {
      addEvent: {
        text: '+ AÑADIR',
        click: function() { mostrarDetalleEventoCalendario(null); }
      }
    },
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'addEvent dayGridMonth,listWeek'
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      listWeek: 'Semana'
    },
    eventDisplay: 'block',
    displayEventTime: false,
    
    
    

    events: function(fetchInfo, successCallback, failureCallback) {
      try {
        const db = getDB();
        const data = db.calendario_eventos || [];
        // Admin / CEO roles see ALL events regardless of participation
        const isAdminRole = ['admin', 'administrador', 'ceo', 'gerente', 'súper admin', 'super admin'].includes((user.rol || '').toLowerCase()) ||
                            ['admin', 'administrador', 'ceo', 'gerente', 'súper admin', 'super admin'].includes((user.rango || '').toLowerCase());

        const userEvents = isAdminRole ? data : data.filter(ev => {
          let hasColab = false;
          if (ev.colaboradores && Array.isArray(ev.colaboradores)) {
            hasColab = ev.colaboradores.some(c => {
              let colabObj = c;
              if (typeof c === 'string') {
                try { colabObj = JSON.parse(c); } catch(e) {}
              }
              return String(colabObj.id) === String(user.id);
            });
          }
          let hasAttendee = false;
          if (ev.attendees && Array.isArray(ev.attendees)) {
            hasAttendee = ev.attendees.some(a => String(a.id) === String(user.id));
          }
          return hasColab || hasAttendee;
        });

        const mapped = userEvents.map(ev => {
          const normalizedColab = (ev.colaboradores || []).map(c => {
            if (typeof c === 'string') {
              try { return JSON.parse(c); } catch(e) { return {}; }
            }
            return c;
          });
          const colorMap = {
            'Cita': '#4caf50', 'Hold': '#ffb300', 'Cancelado': '#d32f2f', 'Reagendar': '#1e88e5',
            'Verde': '#4caf50', 'Amarillo': '#ffb300', 'Rojo': '#d32f2f', 'Azul': '#1e88e5', 'Naranja': '#ffb300'
          };
          
          return {
            id: ev.id,
            title: ev.nombre,
            start: ev.fecha_inicio,
            backgroundColor: colorMap[ev.color] || '#00f5d4',
            borderColor: 'transparent',
            extendedProps: {
              real_end: ev.fecha_fin,
              direccion: ev.direccion,
              description: ev.descripcion,
              color: ev.color,
              colaboradores: normalizedColab,
              departamentos: ev.departamentos || []
            }
          };
        });

        // Add birthdays
        const mappedBirthdays = [];
        const workers = db.Usuarios || [];
        const yearStart = parseInt(fetchInfo.startStr.substring(0, 4)) || new Date().getFullYear();
        const yearEnd = parseInt(fetchInfo.endStr.substring(0, 4)) || new Date().getFullYear();

        workers.forEach(w => {
            if (!w.dob) return;
            let month, day;
            if (w.dob.includes('/')) {
                const p = w.dob.split('/');
                month = p[0].padStart(2, '0');
                day = p[1].padStart(2, '0');
            } else if (w.dob.includes('-')) {
                const p = w.dob.split('-');
                if (p[0].length === 4) { month = p[1]; day = p[2]; } else { month = p[0]; day = p[1]; }
            }
            if (!month || !day) return;

            for (let y = yearStart; y <= yearEnd; y++) {
                mappedBirthdays.push({
                    id: 'bday_' + w.id + '_' + y,
                    title: '🎂 Cumpleaños de ' + (w.nombre || '') + ' ' + (w.apellido || ''),
                    start: `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
                    allDay: true,
                    backgroundColor: '#ec4899',
                    borderColor: 'transparent',
                    extendedProps: { isBirthday: true, workerId: w.id }
                });
            }
        });

        // Filter based on checkboxes
        const showEventos = document.getElementById('chk-filter-eventos') ? document.getElementById('chk-filter-eventos').checked : true;
        const showCumple = document.getElementById('chk-filter-cumple') ? document.getElementById('chk-filter-cumple').checked : true;
        
        let finalEvents = [];
        if (showEventos) {
            finalEvents = finalEvents.concat(mapped);
        }
        if (showCumple) {
            finalEvents = finalEvents.concat(mappedBirthdays);
        }

        successCallback(finalEvents);
      } catch (error) { failureCallback(error); }
    },
    eventContent: function(arg) {
       const baseColor = arg.event.backgroundColor || '#00f5d4';
       const colabs = arg.event.extendedProps?.colaboradores || [];
       const deptos = arg.event.extendedProps?.departamentos || [];
       
       let deptHtml = '';
       if (deptos.length > 0) {
           const colors = { 'Solar': '#84cc16', 'Home': '#fbbf24', 'Water': '#38bdf8' };
           const c = colors[deptos[0]];
           if (c) {
               deptHtml = `<span title="${deptos[0]}" style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${c}; margin-left:4px; vertical-align:middle; box-shadow:0 0 2px rgba(0,0,0,0.2);"></span>`;
           }
       }
       
       let avatarsHtml = '';
       if (colabs && colabs.length > 0) {
           const maxAvatares = 3;
           const showColabs = colabs.slice(0, maxAvatares);
           const extraCount = colabs.length - maxAvatares;
           
           avatarsHtml = '<div style="display: flex; align-items: center; justify-content: flex-end; margin-top: auto; padding-top: 4px;">';
           showColabs.forEach(c => {
               const nameStr = (c && c.nombre) ? c.nombre : (typeof c === 'string' ? c : 'U');
               const initial = nameStr.charAt(0).toUpperCase();
               avatarsHtml += `<div title="${nameStr}" style="width: 22px; height: 22px; border-radius: 50%; background: #fff; color: #444; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; border: 1.5px solid #fff; margin-left: -6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 2; cursor: help;">${initial}</div>`;
           });
           if (extraCount > 0) {
               avatarsHtml += `<div title="+${extraCount} colaboradores más" style="width: 22px; height: 22px; border-radius: 50%; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; border: 1.5px solid #fff; margin-left: -6px; z-index: 1;">+${extraCount}</div>`;
           }
           avatarsHtml += '</div>';
       }

       const isLightMode = !document.body.classList.contains('dark-theme') && !document.documentElement.classList.contains('dark');
       const bgStyle = `background-color: ${baseColor}20;`;
       const titleColor = isLightMode ? '#1e293b' : '#f8fafc';
       const timeColor = isLightMode ? '#64748b' : '#94a3b8';

       const isMonth = arg.view.type === 'dayGridMonth' || arg.view.type === 'listWeek';
       const p = isMonth ? '2px 4px' : '6px 8px';
       const titleSize = isMonth ? '0.7rem' : '0.8rem';
       
       const timeText = arg.timeText ? `<div style="font-size: 0.7rem; color: ${timeColor}; font-weight: 600; margin-bottom: 2px;">${arg.timeText}</div>` : '';
       
       let html = `
         <div style="${bgStyle} border-left: 4px solid ${baseColor}; border-radius: 8px; padding: ${p}; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;">
            <div style="font-size: ${titleSize}; font-weight: 800; color: ${titleColor}; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; margin-bottom: 2px;">${arg.event.title} ${deptHtml}</div>
            ${timeText}
            ${avatarsHtml}
         </div>
       `;
       return { html: html };
    },
    eventClick: function(info) {
      info.jsEvent.preventDefault();
      mostrarDetalleEventoCalendario(info.event);
    },
    height: 'auto',
    themeSystem: 'standard',
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: 'short' }
  });

  calendar.render();
  window.currentCalendarApp = calendar;

  function mostrarDetalleEventoCalendario(event) {
    const modal = document.getElementById('modal-calendar-event');
    if (!modal) return;

    modal.classList.remove('nuclear-hidden');
    modal.style.display = 'flex';

    const btnGuardar = document.getElementById('btn-guardar-evento');
    const btnEditar = document.getElementById('btn-editar-evento');
    const btnEliminar = document.getElementById('btn-eliminar-evento');
    const titleEl = document.getElementById('modal-calendar-title');
    const form = document.getElementById('form-calendario-evento');
    
    const props = (event && event.extendedProps) ? event.extendedProps : {};
    
    const colabWrapper = document.getElementById('ev-colaboradores-wrapper');
    if(colabWrapper) {
        colabWrapper.classList.remove('hidden', 'nuclear-hidden');
        const container = document.getElementById('ev-colaboradores-list');
        if (container) {
            container.innerHTML = '<p class="text-xs text-gray-400 italic">Cargando equipo...</p>';
            getAdminWorkers().then(workers => {
                if (!workers || workers.length === 0) {
                    container.innerHTML = '<p class="text-xs text-gray-400 italic">No hay colaboradores registrados.</p>';
                } else {
                    container.innerHTML = workers.map(w => {
                        const fullName = `${w.nombre || ''} ${w.apellido || ''}`.trim();
                        const rol = w.rol || 'Sin rol';
                        const email = w.email || '';
                        const workerData = JSON.stringify({ id: w.id, nombre: fullName, email }).replace(/"/g, '&quot;');
                        
                        let isChecked = false;
                        if (props && props.attendees && Array.isArray(props.attendees)) {
                            isChecked = props.attendees.some(a => String(a.id) === String(w.id) || a.email === email);
                        }
                        
                        return `
                        <label class="flex items-center gap-3 cursor-pointer group py-1.5 rounded-lg hover:bg-tealAccent/5 px-2 transition-all">
                            <input type="checkbox" 
                                class="ev-colab-chk w-4 h-4 rounded accent-teal-500 cursor-pointer flex-shrink-0" 
                                data-worker="${workerData}" ${isChecked ? 'checked' : ''} ${event && event.title ? 'disabled' : ''}>
                            <div class="flex items-center gap-2 min-w-0">
                                <div class="w-6 h-6 rounded-full bg-tealAccent/20 border border-tealAccent/30 flex items-center justify-center flex-shrink-0">
                                    <span class="text-[9px] font-black text-tealAccent">${fullName.charAt(0).toUpperCase()}</span>
                                </div>
                                <div class="min-w-0">
                                    <p class="text-xs font-bold text-gray-800 dark:text-white truncate">${fullName} <span class="font-normal text-gray-400">(${rol})</span></p>
                                    ${email ? `<p class="text-[9px] text-tealAccent/70 truncate">${email}</p>` : ''}
                                </div>
                            </div>
                        </label>`;
                    }).join('');
                }
            }).catch(err => {
                container.innerHTML = '<p class="text-xs text-red-400 italic">Error cargando colaboradores.</p>';
                console.error('[CALENDAR] Error loading workers:', err);
            });
        }
    }
    
    const toLocalISOString = (d) => {
        if (!d) return "";
        const pad = n => n < 10 ? '0'+n : n;
        return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    };

    if (event && event.title) {
        // VIEW MODE
        const props = event.extendedProps || {};
        titleEl.innerHTML = props.isBirthday ? `<i class="fa-solid fa-cake-candles"></i> ${event.title}` : `<i class="fa-solid fa-calendar-check"></i> ${event.title}`;
        btnGuardar.classList.add('nuclear-hidden');

        currentEventId = props.originalId || event.id;
        
        btnEditar.classList.remove('hidden');
        btnEliminar.classList.remove('hidden');

        document.getElementById('ev-nombre').value = event.title || '';
        document.getElementById('ev-nombre').readOnly = true;

        document.getElementById('ev-fecha-inicio').value = toLocalISOString(event.start);
        if (props.real_end) {
            document.getElementById('ev-fecha-fin').value = toLocalISOString(new Date(props.real_end));
        } else if (event.end) {
            document.getElementById('ev-fecha-fin').value = toLocalISOString(event.end);
        } else {
            document.getElementById('ev-fecha-fin').value = toLocalISOString(event.start);
        }
        document.getElementById('ev-fecha-inicio').readOnly = true;
        document.getElementById('ev-fecha-fin').readOnly = true;

        if (props.direccion) {
            document.getElementById('ev-direccion').classList.add('nuclear-hidden');
            const linkDir = document.getElementById('ev-direccion-link');
            linkDir.classList.remove('nuclear-hidden');
            const addressUrl = encodeURIComponent(props.direccion);
            linkDir.href = `https://www.google.com/maps/search/?api=1&query=${addressUrl}`;
        } else {
            document.getElementById('ev-direccion').value = '';
            document.getElementById('ev-direccion').readOnly = true;
            document.getElementById('ev-direccion').classList.remove('nuclear-hidden');
            document.getElementById('ev-direccion-link').classList.add('nuclear-hidden');
        }

        if (props.isBirthday) {
            document.getElementById('ev-descripcion').value = 'Cumpleaños generado desde el perfil del usuario.';
            document.getElementById('ev-descripcion').readOnly = true;
            document.querySelectorAll('.ev-color-picker').forEach(el => el.classList.add('hidden'));
            const colorContainer = document.querySelector('.ev-color-picker')?.parentElement;
            if(colorContainer) colorContainer.classList.add('hidden');
            const deptoContainer = document.querySelector('input[name="ev-depto"]')?.closest('.mb-6');
            if(deptoContainer) deptoContainer.classList.add('hidden');
            if(colabWrapper) colabWrapper.classList.add('nuclear-hidden');
            
            btnEditar.classList.add('hidden');
            if (user && ['Admin', 'Súper Admin', 'Gerente', 'Administrador'].includes(user.rango || user.rol)) {
                btnEliminar.classList.remove('hidden');
            } else {
                btnEliminar.classList.add('hidden');
            }
        } else {
            // Restore hidden containers
            const colorContainer = document.querySelector('.ev-color-picker')?.parentElement;
            if(colorContainer) colorContainer.classList.remove('hidden');
            const deptoContainer = document.querySelector('input[name="ev-depto"]')?.closest('.mb-6');
            if(deptoContainer) deptoContainer.classList.remove('hidden');

            document.getElementById('ev-descripcion').value = props.description || '';
            document.getElementById('ev-descripcion').readOnly = true;

            if (props.color) {
                const legacyToNew = { 'Verde': 'Cita', 'Amarillo': 'Hold', 'Naranja': 'Hold', 'Azul': 'Reagendar', 'Rojo': 'Cancelado' };
                const mappedVal = legacyToNew[props.color] || props.color;
                const colorRadio = document.querySelector(`input[name="ev-color"][value="${mappedVal}"]`);
                if (colorRadio) colorRadio.checked = true;
            }
        }
        document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = true);

        // Departamentos
        document.querySelectorAll('input[name="ev-depto"]').forEach(r => {
            r.checked = false;
            r.disabled = true;
        });
        if (props.departamentos && Array.isArray(props.departamentos)) {
            props.departamentos.forEach(d => {
                const dChk = document.querySelector(`input[name="ev-depto"][value="${d}"]`);
                if (dChk) dChk.checked = true;
            });
        }
    } else {
        // ADD MODE
        currentEventId = null;
        titleEl.innerHTML = `<i class="fa-solid fa-calendar-plus"></i> Añadir Evento`;
        btnGuardar.classList.remove('nuclear-hidden');
        btnEditar.classList.add('hidden');
        btnEliminar.classList.add('hidden');
        btnGuardar.innerHTML = 'Guardar';
        btnGuardar.disabled = false;
        form.reset();

        document.getElementById('ev-nombre').readOnly = false;
        document.getElementById('ev-fecha-inicio').readOnly = false;
        document.getElementById('ev-fecha-fin').readOnly = false;
        document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = false);
        document.querySelectorAll('input[name="ev-depto"]').forEach(r => r.disabled = false);
        document.getElementById('ev-descripcion').readOnly = false;
        document.getElementById('ev-direccion').readOnly = false;
        document.getElementById('ev-direccion').classList.remove('nuclear-hidden');
        document.getElementById('ev-direccion-link').classList.add('nuclear-hidden');

        // Google Places Autocomplete for address field
        const evDirInput = document.getElementById('ev-direccion');
        const evMapPreview = document.getElementById('ev-map-preview');
        const evMapCanvas = document.getElementById('ev-map-canvas');

        if (evDirInput && window.google && window.google.maps) {
            const updateMiniMap = (lat, lng) => {
                if (evMapPreview) evMapPreview.classList.remove('hidden');
                if (!evDirInput._evMap) {
                    evDirInput._evMap = new google.maps.Map(evMapCanvas, {
                        center: { lat, lng },
                        zoom: 15,
                        mapTypeId: 'roadmap',
                        disableDefaultUI: true,
                        gestureHandling: 'none',
                        styles: [
                            { elementType: 'geometry', stylers: [{ color: '#1a2035' }] },
                            { elementType: 'labels.text.fill', stylers: [{ color: '#00f5d4' }] },
                            { elementType: 'labels.text.stroke', stylers: [{ color: '#0a1628' }] },
                            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
                            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1f3c' }] },
                            { featureType: 'poi', stylers: [{ visibility: 'off' }] }
                        ]
                    });
                    evDirInput._evMarker = new google.maps.Marker({
                        position: { lat, lng },
                        map: evDirInput._evMap,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: '#00f5d4',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 2
                        }
                    });
                } else {
                    evDirInput._evMap.setCenter({ lat, lng });
                    evDirInput._evMarker.setPosition({ lat, lng });
                    google.maps.event.trigger(evDirInput._evMap, 'resize');
                }
            };

            if (!evDirInput._placesInit && window.google.maps.places) {
                evDirInput._placesInit = true;
                const autocomplete = new google.maps.places.Autocomplete(evDirInput, {
                    types: ['address'],
                    fields: ['formatted_address', 'geometry', 'name']
                });

                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place && place.geometry) {
                        const loc = place.geometry.location;
                        updateMiniMap(loc.lat(), loc.lng());
                        evDirInput.value = place.formatted_address || place.name || evDirInput.value;
                    }
                });

                evDirInput.addEventListener('input', () => {
                    if (!evDirInput.value.trim() && evMapPreview) {
                        evMapPreview.classList.add('hidden');
                    }
                });
            }

            if (evDirInput.value.trim()) {
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ address: evDirInput.value }, (results, status) => {
                    if (status === 'OK' && results[0].geometry) {
                        const loc = results[0].geometry.location;
                        updateMiniMap(loc.lat(), loc.lng());
                    }
                });
            } else if (evMapPreview) {
                evMapPreview.classList.add('hidden');
            }
        }
    }
  }

  async function guardarEventoCalendario(e) {
    if (e) e.preventDefault();
    const btnGuardar = document.getElementById('btn-guardar-evento');
    
    try {
        const nombre = document.getElementById('ev-nombre').value;
        if (!nombre) { import('../components/toast.js').then(m => m.showToast('Nombre obligatorio', 'error')); return; }

        const fechaInicioVal = document.getElementById('ev-fecha-inicio').value;
        if (!fechaInicioVal) { import('../components/toast.js').then(m => m.showToast('Fecha inicio obligatoria', 'error')); return; }

        btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btnGuardar.disabled = true;

        const fecha_inicio = new Date(fechaInicioVal).toISOString();
        const fecha_fin_val = document.getElementById('ev-fecha-fin').value;
        const fecha_fin = fecha_fin_val ? new Date(fecha_fin_val).toISOString() : null;
        
        const direccion = document.getElementById('ev-direccion').value;
        const descripcion = document.getElementById('ev-descripcion').value;
        
        const colorNode = document.querySelector('input[name="ev-color"]:checked');
        let color = colorNode ? colorNode.value : 'Cita';
        const newToLegacy = { 'Cita': 'Verde', 'Hold': 'Amarillo', 'Reagendar': 'Azul', 'Cancelado': 'Rojo' };
        color = newToLegacy[color] || color;

        const departamentos = Array.from(document.querySelectorAll('input[name="ev-depto"]:checked')).map(el => el.value);
        
        const attendees = Array.from(document.querySelectorAll('.ev-colab-chk:checked')).map(chk => {
            try { return JSON.parse(chk.getAttribute('data-worker')); } catch(e) { return null; }
        }).filter(Boolean);

        // Vendor is automatically the collaborator
        const colaboradores = [{
            id: user.id,
            nombre: `${user.nombre || ''} ${user.apellido || ''}`.trim(),
            email: user.email || ''
        }];

        const db = getDB();
        if (!db.calendario_eventos) db.calendario_eventos = [];

        const existingIdx = db.calendario_eventos.findIndex(ev => ev.id === currentEventId);

        const newEvent = {
            id: currentEventId || ('ev_' + Date.now()),
            nombre,
            fecha_inicio,
            fecha_fin,
            direccion,
            descripcion,
            color,
            colaboradores,
            departamentos,
            attendees: attendees,
            created_at: new Date().toISOString()
        };

        if (existingIdx !== -1) {
            db.calendario_eventos[existingIdx] = newEvent;
        } else {
            db.calendario_eventos.push(newEvent);
        }
        await saveGranular('calendario_eventos', [newEvent]);

        // ── SYNC WITH GOOGLE CALENDAR VIA N8N ──
        try {
            fetch('https://n8n.renewgroup.site/webhook/calendario-renew', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'create_event',
                    source: 'mobile_app',
                    user: {
                        id: user.id,
                        nombre: `${user.nombre || ''} ${user.apellido || ''}`.trim(),
                        email: user.email || ''
                    },
                    event: {
                        id: newEvent.id,
                        summary: nombre,
                        location: direccion || '',
                    direccion: direccion || '',
                        description: descripcion,
                        start: fecha_inicio,
                        end: fecha_fin || new Date(new Date(fecha_inicio).getTime() + 3600000).toISOString(),
                        color: color,
                        colaboradores: colaboradores
                    }
                })
            }).catch(e => console.error('[N8N-SYNC-ERR]', e));
        } catch (n8nErr) {
            console.error('[N8N-ERR]', n8nErr);
        }

        import('../components/toast.js').then(m => m.showToast('Evento guardado', 'success'));
        
        // Close modal
        const modal = document.getElementById('modal-calendar-event');
        if (modal) {
            modal.classList.add('nuclear-hidden');
            modal.style.display = 'none';
        }

        // Refresh calendar
        calendar.refetchEvents();

    } catch (err) {
        console.error(err);
        import('../components/toast.js').then(m => m.showToast('Error al guardar', 'error'));
    } finally {
        btnGuardar.innerHTML = 'Guardar';
        btnGuardar.disabled = false;
    }
  }

  function switchEventToEditMode() {
      const btnGuardar = document.getElementById('btn-guardar-evento');
      const btnEditar = document.getElementById('btn-editar-evento');
      const titleEl = document.getElementById('modal-calendar-title');
      
      titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Evento`;
      btnGuardar.classList.remove('nuclear-hidden');
      btnEditar.classList.add('hidden');
      
      document.getElementById('ev-nombre').readOnly = false;
      document.getElementById('ev-fecha-inicio').readOnly = false;
      document.getElementById('ev-fecha-fin').readOnly = false;
      document.getElementById('ev-descripcion').readOnly = false;
      document.getElementById('ev-direccion').readOnly = false;
      document.getElementById('ev-direccion').classList.remove('nuclear-hidden');
      document.getElementById('ev-direccion-link').classList.add('nuclear-hidden');
      document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = false);
      document.querySelectorAll('input[name="ev-depto"]').forEach(r => r.disabled = false);
  }

  async function eliminarEventoCalendario() {
      if (!currentEventId) return;
      if (!confirm('¿Estás seguro de eliminar este evento?')) return;
      
      try {
          const btnEliminar = document.getElementById('btn-eliminar-evento');
          btnEliminar.disabled = true;
          btnEliminar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
          
          if (currentEventId.startsWith('bday_')) {
              // Delete birthday
              const workerId = currentEventId.split('_')[1];
              const db = getDB();
              const worker = (db.Usuarios || []).find(w => String(w.id) === String(workerId));
              if (worker) {
                  worker.dob = ''; // Clear DOB
                  await saveGranular('Usuarios', [worker]);
              }
              import('../components/toast.js').then(m => m.showToast('Cumpleaños eliminado', 'success'));
          } else {
              // Delete normal event
              await deleteRecord('calendario_eventos', currentEventId);
              
              const db = getDB();
              db.calendario_eventos = (db.calendario_eventos || []).filter(ev => ev.id !== currentEventId);
              
              import('../components/toast.js').then(m => m.showToast('Evento eliminado', 'success'));
          }
          
          // Close modal
          const modal = document.getElementById('modal-calendar-event');
          if (modal) {
              modal.classList.add('nuclear-hidden');
              modal.style.display = 'none';
          }
          
          calendar.refetchEvents();
      } catch (err) {
          console.error(err);
          import('../components/toast.js').then(m => m.showToast('Error al eliminar', 'error'));
      } finally {
          const btnEliminar = document.getElementById('btn-eliminar-evento');
          if (btnEliminar) {
              btnEliminar.disabled = false;
              btnEliminar.innerHTML = 'Eliminar';
          }
      }
  }
}


if (!window.onStartDateChange) {
    window.onStartDateChange = function(el) {
        const endInput = document.getElementById('ev-fecha-fin');
        if (el.value && endInput && !endInput.value) {
            const d = new Date(el.value);
            d.setHours(d.getHours() + 1);
            const pad = n => n < 10 ? '0'+n : n;
            const iso = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
            endInput.value = iso;
        }
    };
}

