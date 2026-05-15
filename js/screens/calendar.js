/* ============================================================
   RENEW SOLAR – screens/calendar.js
   ============================================================ */
import { getCurrentUser, navigate } from '../app.js';
import { getDB, saveGranular, deleteRecord } from '../api.js';
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
          border-radius: 100px !important;
          padding: 2px 10px !important;
          margin: 2px auto !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.15) !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          overflow: hidden !important;
          width: fit-content !important;
          min-width: 60px !important;
          max-width: 95% !important;
          background-color: var(--fc-event-bg-color, #00f5d4) !important;
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
    events: function(fetchInfo, successCallback, failureCallback) {
      try {
        const db = getDB();
        const data = db.calendario_eventos || [];
        const userEvents = data.filter(ev => {
          if (!ev.colaboradores || !Array.isArray(ev.colaboradores)) return false;
          return ev.colaboradores.some(c => {
            let colabObj = c;
            if (typeof c === 'string') {
              try { colabObj = JSON.parse(c); } catch(e) {}
            }
            return colabObj.id === user.id;
          });
        });

        const mapped = [];
        userEvents.forEach(ev => {
          const normalizedColab = (ev.colaboradores || []).map(c => {
            if (typeof c === 'string') {
              try { return JSON.parse(c); } catch(e) { return {}; }
            }
            return c;
          });
          const colorMap = {
            'Verde': '#00ff88', 'Amarillo': '#fce803', 'Rojo': '#ff3366', 'Azul': '#00d4ff', 'Naranja': '#ff8c00'
          };
          
          let startStr = ev.fecha_inicio;
          let endStr = ev.fecha_fin;
          if (!endStr && startStr) {
             const d = new Date(startStr);
             d.setHours(d.getHours() + 1);
             endStr = d.toISOString();
          }

          const startDate = new Date(startStr);
          const endDate = new Date(endStr);
          
          // Helper to check if same day
          const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

          const mappedColor = colorMap[ev.color] || '#00f5d4';
          const textColor = (ev.color === 'Azul' || ev.color === 'Verde' || ev.color === 'Amarillo') ? '#000' : '#fff';

          if (!isSameDay(startDate, endDate)) {
            let current = new Date(startDate);
            while (current <= endDate) {
              const dayStart = new Date(current);
              dayStart.setHours(0,0,0,0);
              const dayEnd = new Date(current);
              dayEnd.setHours(23,59,59,999);

              mapped.push({
                id: ev.id + '_' + current.getTime(),
                title: ev.nombre,
                start: isSameDay(current, startDate) ? startStr : dayStart.toISOString(),
                end: isSameDay(current, endDate) ? endStr : dayEnd.toISOString(),
                backgroundColor: mappedColor,
                textColor: textColor,
                borderColor: 'transparent',
                display: 'block', // Forzar modo bloque
                allDay: !isSameDay(current, startDate),
                extendedProps: {
                  originalId: ev.id,
                  real_end: ev.fecha_fin,
                  direccion: ev.direccion,
                  description: ev.descripcion,
                  color: ev.color,
                  colaboradores: normalizedColab,
                  departamentos: ev.departamentos || []
                }
              });
              current.setDate(current.getDate() + 1);
            }
          } else {
            mapped.push({
              id: ev.id,
              title: ev.nombre,
              start: startStr,
              end: endStr,
              backgroundColor: mappedColor,
              textColor: textColor,
              borderColor: 'transparent',
              display: 'block',
              extendedProps: {
                real_end: ev.fecha_fin,
                direccion: ev.direccion,
                description: ev.descripcion,
                color: ev.color,
                colaboradores: normalizedColab,
                departamentos: ev.departamentos || []
              }
            });
          }
        });
        successCallback(mapped);
      } catch (error) { failureCallback(error); }
    },
    eventClick: function(info) {
      info.jsEvent.preventDefault();
      mostrarDetalleEventoCalendario(info.event);
    },
    height: 'auto',
    themeSystem: 'standard',
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: 'short' },
    eventDidMount: function(arg) {
       const legacyColor = arg.event.backgroundColor || '#00f5d4';
       const deptos = arg.event.extendedProps.departamentos || [];
       if (deptos.length > 0) {
           const colors = { 'Solar': '#84cc16', 'Home': '#fbbf24', 'Water': '#38bdf8' };
           const c = deptos.map(d => colors[d]).filter(Boolean);
           if (c.length === 1) {
               arg.el.style.background = c[0];
           } else if (c.length === 2) {
               arg.el.style.background = `linear-gradient(90deg, ${c[0]} 50%, ${c[1]} 50%)`;
           } else if (c.length >= 3) {
               arg.el.style.background = `linear-gradient(90deg, ${c[0]} 33.33%, ${c[1]} 33.33%, ${c[1]} 66.66%, ${c[2]} 66.66%)`;
           }
           arg.el.style.borderLeft = `4px solid ${legacyColor}`;
           
           // Ensure internal text elements inherit white for contrast
           const mainEl = arg.el.querySelector('.fc-event-main');
           if (mainEl) mainEl.style.color = '#fff';
       }
    }
  });

  calendar.render();

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
    
    const toLocalISOString = (d) => {
        if (!d) return "";
        const pad = n => n < 10 ? '0'+n : n;
        return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    };

    if (event && event.title) {
        // VIEW MODE
        titleEl.innerHTML = `<i class="fa-solid fa-calendar-check"></i> ${event.title}`;
        btnGuardar.classList.add('nuclear-hidden');

        const props = event.extendedProps || {};
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

        document.getElementById('ev-descripcion').value = props.description || '';
        document.getElementById('ev-descripcion').readOnly = true;

        document.getElementById('ev-colaboradores-wrapper').classList.add('nuclear-hidden');

        if (props.color) {
            const colorRadio = document.querySelector(`input[name="ev-color"][value="${props.color}"]`);
            if (colorRadio) colorRadio.checked = true;
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
        const color = colorNode ? colorNode.value : 'Verde';

        const departamentos = Array.from(document.querySelectorAll('input[name="ev-depto"]:checked')).map(el => el.value);

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
            attendees: [],
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
          
          await deleteRecord('calendario_eventos', currentEventId);
          
          const db = getDB();
          db.calendario_eventos = (db.calendario_eventos || []).filter(ev => ev.id !== currentEventId);
          
          import('../components/toast.js').then(m => m.showToast('Evento eliminado', 'success'));
          
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

