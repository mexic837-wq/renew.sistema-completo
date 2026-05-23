const fs = require('fs');
let c = fs.readFileSync('admin.html', 'utf8');

const replacements = [
    [/Â¡/g, '¡'],
    [/Â¿/g, '¿'],
    [/CrÃ­tico/g, 'Crítico'],
    [/ArtÃ­culo/g, 'Artículo'],
    [/CategorÃ­a/g, 'Categoría'],
    [/MÃ­nimo/g, 'Mínimo'],
    [/RÃ\sPIDO/g, 'RÁPIDO'],
    [/EstÃ¡s/g, 'Estás'],
    [/eliminarÃ¡n/g, 'eliminarán']
];

replacements.forEach(([pattern, replacement]) => {
    c = c.replace(pattern, replacement);
});

fs.writeFileSync('admin.html', c);
console.log('Fixed additional encoding issues');
