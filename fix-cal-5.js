const fs = require('fs');
let content = fs.readFileSync('js/screens/calendar.js', 'utf8');

// 1. Delete eventDidMount
content = content.replace(/eventDidMount\s*:\s*function\s*\(\w+\)\s*\{[\s\S]*?\}\n\s*\}\n\s*\}/g, '}');

// 2. Replace events mapping logic
const newEventsFunc = `events: function(fetchInfo, successCallback, failureCallback) {
      try {
        const db = getDB();
        const data = db.calendario_eventos || [];
        const userEvents = data.filter(ev => {
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
        successCallback(mapped);
      } catch (error) { failureCallback(error); }
    },`;

content = content.replace(/events\s*:\s*function\s*\(fetchInfo[\s\S]*?successCallback\(mapped\);\n\s*\}\s*catch\s*\(error\)\s*\{\s*failureCallback\(error\);\s*\}\n\s*\},/g, newEventsFunc);

fs.writeFileSync('js/screens/calendar.js', content);
console.log('Fixed calendar.js');
