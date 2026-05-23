const fs = require('fs');

let calJs = fs.readFileSync('js/screens/calendar.js', 'utf8');

const newColorMap = `const colorMap = {
            'Cita': '#4caf50', 'Hold': '#ffb300', 'Cancelado': '#d32f2f', 'Reagendar': '#1e88e5',
            'Verde': '#4caf50', 'Amarillo': '#ffb300', 'Rojo': '#d32f2f', 'Azul': '#1e88e5', 'Naranja': '#ffb300'
          };`;

// Note: Replace only the EXACT match.
calJs = calJs.replace(/const colorMap = \{[\s\S]*?\};/, newColorMap);
calJs = calJs.replace(/const textColor = .*;/g, "const textColor = (ev.color === 'Amarillo' || ev.color === 'Hold') ? '#000' : '#fff';");
calJs = calJs.replace(/const color \= colorNode \? colorNode\.value \: 'Verde';/g, "const color = colorNode ? colorNode.value : 'Cita';");

// Legacy color selection logic
const oldLegacySelect = `if (props.color) {
            const colorRadio = document.querySelector(\`input[name="ev-color"][value="\${props.color}"]\`);
            if (colorRadio) colorRadio.checked = true;
        }`;

const newLegacySelect = `if (props.color) {
            const legacyToNew = {
                'Verde': 'Cita',
                'Amarillo': 'Hold',
                'Naranja': 'Hold',
                'Azul': 'Reagendar',
                'Rojo': 'Cancelado'
            };
            const mappedVal = legacyToNew[props.color] || props.color;
            const colorRadio = document.querySelector(\`input[name="ev-color"][value="\${mappedVal}"]\`);
            if (colorRadio) colorRadio.checked = true;
        }`;

calJs = calJs.replace(oldLegacySelect, newLegacySelect);

fs.writeFileSync('js/screens/calendar.js', calJs);

console.log("Done fixing calendar.js");
