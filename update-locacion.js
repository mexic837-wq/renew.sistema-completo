const fs = require('fs');

let db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

// Fix historialInventario sede values
if (db.historialInventario) {
  db.historialInventario = db.historialInventario.map(h => {
    if (h.sede === 'florida') h.sede = 'orlando';
    if (h.sede === 'texas') h.sede = 'dallas';
    return h;
  });
}

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log('Historial sede values updated.');
