const fs = require('fs');
let c = fs.readFileSync('admin.html', 'utf8');

const replacements = [
    [/Ã³/g, 'ó'],
    [/Ã“/g, 'Ó'],
    [/Ã©/g, 'é'],
    [/Ã‰/g, 'É'],
    [/Ã¡/g, 'á'],
    [/Ã\sA/g, 'ÍA'],
    [/Ã\*/g, 'í'],
    [/Ã±/g, 'ñ'],
    [/Ã‘/g, 'Ñ'],
    [/Ãº/g, 'ú'],
    [/Ãš/g, 'Ú'],
    [/fÃ­sica/g, 'física'],
    [/artÃ­culos/g, 'artículos'],
    [/GarantÃ­a/g, 'Garantía']
];

replacements.forEach(([pattern, replacement]) => {
    c = c.replace(pattern, replacement);
});

fs.writeFileSync('admin.html', c);
console.log('Fixed more encoding issues');
