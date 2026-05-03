/* ============================================================
   RENEW SOLAR – screens/calendar.js
   ============================================================ */
import { getCurrentUser, navigate } from '../app.js';
import { getDB } from '../api.js';
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
      </style>
      <div id="mi-calendario-container" style="background: var(--surface); border-radius: 24px; padding: 12px; box-shadow: var(--shadow-sm); min-height: 450px;"></div>
    </div>
    <button id="fab-add-event" style="position: fixed; bottom: 85px; right: 20px; width: 64px; height: 64px; border-radius: 50%; background: var(--primary); color: #000; border: none; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; cursor: pointer; box-shadow: 0 8px 30px rgba(0,223,191,0.5); z-index: 100; transition: transform 0.2s;">
      <i class="fa-solid fa-plus"></i>
    </button>
  `;

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
  }, 100);

  const calendarEl = document.getElementById('mi-calendario-container');
  if (!calendarEl) return;

  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    initialView: 'listWeek',
    customButtons: {
      addEvent: {
        text: '+ AÑADIR',
        click: function() { mostrarDetalleEventoCalendario(null); }
      }
    },
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'addEvent listWeek,dayGridMonth'
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
          return ev.colaboradores.some(c => c.id === user.id);
        });

        const mapped = userEvents.map(ev => {
          const colorMap = {
            'Verde': '#00ff88', 'Amarillo': '#fce803', 'Rojo': '#ff3366', 'Azul': '#00d4ff', 'Naranja': '#ff8c00'
          };
          return {
            id: ev.id,
            title: ev.nombre,
            start: ev.fecha_inicio,
            end: ev.fecha_fin,
            backgroundColor: colorMap[ev.color] || '#00f5d4',
            borderColor: 'transparent',
            extendedProps: {
              telefono: ev.telefono,
              direccion: ev.direccion,
              description: ev.descripcion,
              color: ev.color,
              colaboradores: ev.colaboradores
            }
          };
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
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: 'short' }
  });

  calendar.render();

  function mostrarDetalleEventoCalendario(event) {
    const modal = document.getElementById('modal-calendar-event');
    if (!modal) return;

    modal.classList.remove('nuclear-hidden');
    modal.style.display = 'flex';

    const btnGuardar = document.getElementById('btn-guardar-evento');
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
        
        document.getElementById('ev-nombre').value = event.title || '';
        document.getElementById('ev-nombre').readOnly = true;

        document.getElementById('ev-fecha-inicio').value = toLocalISOString(event.start);
        document.getElementById('ev-fecha-fin').value = toLocalISOString(event.end);
        document.getElementById('ev-fecha-inicio').readOnly = true;
        document.getElementById('ev-fecha-fin').readOnly = true;

        if (props.telefono) {
            document.getElementById('ev-telefono').classList.add('nuclear-hidden');
            const linkTel = document.getElementById('ev-telefono-link');
            linkTel.classList.remove('nuclear-hidden');
            linkTel.href = `tel:${props.telefono}`;
            document.getElementById('ev-telefono-txt').textContent = props.telefono;
        } else {
            document.getElementById('ev-telefono').value = '';
            document.getElementById('ev-telefono').readOnly = true;
            document.getElementById('ev-telefono').classList.remove('nuclear-hidden');
            document.getElementById('ev-telefono-link').classList.add('nuclear-hidden');
        }

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

    } else {
        // ADD MODE
        titleEl.innerHTML = `<i class="fa-solid fa-calendar-plus"></i> Añadir Evento`;
        btnGuardar.classList.remove('nuclear-hidden');
        btnGuardar.innerHTML = 'Guardar';
        btnGuardar.disabled = false;
        form.reset();

        document.getElementById('ev-nombre').readOnly = false;
        document.getElementById('ev-fecha-inicio').readOnly = false;
        document.getElementById('ev-fecha-fin').readOnly = false;

        document.getElementById('ev-telefono').readOnly = false;
        document.getElementById('ev-telefono').classList.remove('nuclear-hidden');
        document.getElementById('ev-telefono-link').classList.add('nuclear-hidden');

        document.getElementById('ev-direccion').readOnly = false;
        document.getElementById('ev-direccion').classList.remove('nuclear-hidden');
        document.getElementById('ev-direccion-link').classList.add('nuclear-hidden');

        document.getElementById('ev-descripcion').readOnly = false;
        document.getElementById('ev-colaboradores-wrapper').classList.add('nuclear-hidden');

        document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = false);
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
        
        const telefono = document.getElementById('ev-telefono').value;
        const direccion = document.getElementById('ev-direccion').value;
        const descripcion = document.getElementById('ev-descripcion').value;
        
        const colorNode = document.querySelector('input[name="ev-color"]:checked');
        const color = colorNode ? colorNode.value : 'Verde';

        // Vendor is automatically the collaborator
        const colaboradores = [{
            id: user.id,
            nombre: `${user.nombre || ''} ${user.apellido || ''}`.trim(),
            email: user.email || ''
        }];

        const db = getDB();
        if (!db.calendario_eventos) db.calendario_eventos = [];

        const newEvent = {
            id: 'ev-' + Date.now(),
            nombre,
            fecha_inicio,
            fecha_fin,
            telefono,
            direccion,
            descripcion,
            color,
            colaboradores,
            vendedor_id: user.id, // Track who created it
            creado_por: user.id,
            fecha_creacion: new Date().toISOString()
        };

        db.calendario_eventos.push(newEvent);
        await saveDB(db);

        // ── SYNC WITH GOOGLE CALENDAR (Service Account) ──
        try {
            const gEvent = {
                summary: nombre,
                location: direccion,
                description: descripcion + (telefono ? `\nTel: ${telefono}` : ''),
                start: {
                    dateTime: fecha_inicio,
                    timeZone: 'America/New_York'
                },
                end: {
                    dateTime: fecha_fin || new Date(new Date(fecha_inicio).getTime() + 3600000).toISOString(),
                    timeZone: 'America/New_York'
                },
                attendees: colaboradores.map(c => ({ email: c.email }))
            };

            fetch('/api/calendar/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    calendarId: 'c_0300a26935f9ffbe1772a440f9070fa95f02f551157e69bd0d71092777559943@group.calendar.google.com',
                    event: gEvent 
                })
            }).catch(e => console.error('[GCAL-SYNC-ERR]', e));
        } catch (gcalErr) {
            console.error('[GCAL-ERR]', gcalErr);
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
}

// Global helper for modal closing if not defined
if (!window.closeModals) {
    window.closeModals = function() {
        const modal = document.getElementById('modal-calendar-event');
        if (modal) {
            modal.classList.add('nuclear-hidden');
            modal.style.display = 'none';
        }
    };
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

