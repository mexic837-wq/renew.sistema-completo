const fs = require('fs');

let calJs = fs.readFileSync('js/screens/calendar.js', 'utf8');

const s1 = `        if (props.color) {
            const colorRadio = document.querySelector(\`input[name="ev-color"][value="\${props.color}"]\`);
            if (colorRadio) colorRadio.checked = true;
        }`;

const r1 = `        if (props.color) {
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

calJs = calJs.replace(s1, r1);
fs.writeFileSync('js/screens/calendar.js', calJs);
console.log('Fixed selection logic');
