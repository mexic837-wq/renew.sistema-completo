const fs = require('fs');

let calJs = fs.readFileSync('js/screens/calendar.js', 'utf8');

// 1. colorMap
calJs = calJs.replace(
    /const colorMap = \{[\s\S]*?\};/,
    `const colorMap = {
            'Cita': '#4caf50', 'Hold': '#ffb300', 'Cancelado': '#d32f2f', 'Reagendar': '#1e88e5',
            'Verde': '#4caf50', 'Amarillo': '#ffb300', 'Rojo': '#d32f2f', 'Azul': '#1e88e5', 'Naranja': '#ffb300'
          };`
);

// 2. textColor
calJs = calJs.replace(
    /const textColor = \(ev\.color === 'Azul' \|\| ev\.color === 'Verde' \|\| ev\.color === 'Amarillo'\) \? '#000' \: '#fff';/g,
    "const textColor = (ev.color === 'Amarillo' || ev.color === 'Hold') ? '#000' : '#fff';"
);

// 3. colorNode default
calJs = calJs.replace(
    /const color = colorNode \? colorNode\.value : 'Verde';/g,
    "const color = colorNode ? colorNode.value : 'Cita';"
);

// 4. legacy assignment
const oldAssig = "const colorRadio = document.querySelector(`input[name=\"ev-color\"][value=\"${props.color}\"]`);";
const newAssig = `const legacyToNew = { 'Verde': 'Cita', 'Amarillo': 'Hold', 'Naranja': 'Hold', 'Azul': 'Reagendar', 'Rojo': 'Cancelado' };
            const mappedVal = legacyToNew[props.color] || props.color;
            const colorRadio = document.querySelector(\`input[name="ev-color"][value="\${mappedVal}"]\`);`;
            
calJs = calJs.replace(oldAssig, newAssig);

fs.writeFileSync('js/screens/calendar.js', calJs);
console.log('Fixed everything');
