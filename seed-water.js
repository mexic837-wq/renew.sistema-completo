const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
let db = { inventarioGlobal: [] };

if (fs.existsSync(dbPath)) {
  try {
    db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (err) {
    console.error('Error reading db.json', err);
  }
}

if (!db.inventarioGlobal) db.inventarioGlobal = [];

const products = [
  { id: 'E-301', nombreItem: 'RENEW 3 PASOS S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '10 X 44', boton: '3B', color: 'NEGRO', category: 'water', stockActual: 0, costo: 2200 },
  { id: 'E-302', nombreItem: 'RENEW 4 PASOS S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '9 X 48', boton: '3B', color: 'NEGRO', category: 'water', stockActual: 0, costo: 2400 },
  { id: 'E-303', nombreItem: 'RENEW 4 PASOS S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '10 X 54', boton: '3B', color: 'NEGRO', category: 'water', stockActual: 0, costo: 2600 },
  { id: 'E-P01', nombreItem: 'POZO BASICO 10X54 S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '10 X 54', boton: '3B', color: 'NEGRO', category: 'water', stockActual: 0, costo: 4000 },
  { id: 'E-P02', nombreItem: 'POZO BASICO 13X54 S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '13 X 54', boton: '3B', color: 'NEGRO', category: 'water', stockActual: 0, costo: 4300 },
  { id: 'E-PF1', nombreItem: 'POZO FULL 10X54 S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '10 X 54', boton: '3B', color: 'NEGRO', category: 'water', stockActual: 0, costo: 4500 },
  { id: 'E-PF2', nombreItem: 'POZO FULL 13X54 S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '13 X 54', boton: '3B', color: 'NEGRO', category: 'water', stockActual: 0, costo: 4800 },
  { id: 'C-A04', nombreItem: 'RENEW APTO (4 PASOS) PLASTIC', ecosistema: 'LINEA RENEW CLÁSICA', medida: 'ESTÁNDAR', boton: '5B', color: 'GRIS', category: 'water', stockActual: 0, costo: 3300 },
  { id: 'C-M04', nombreItem: 'RENEW MINI (4 PASOS)', ecosistema: 'LINEA RENEW CLÁSICA', medida: '10 X 44', boton: '3B', color: 'GRIS', category: 'water', stockActual: 0, costo: 3500 },
  { id: 'C-S04', nombreItem: 'RENEW SMALL (4 PASOS) PLASTIC', ecosistema: 'LINEA RENEW CLÁSICA', medida: '9 X 48', boton: '5B', color: 'BEIGE/GRIS', category: 'water', stockActual: 0, costo: 3600 },
  { id: 'C-C05', nombreItem: 'RENEW CITY (5 PASOS) PLASTIC', ecosistema: 'LINEA RENEW CLÁSICA', medida: '10 X 54', boton: '5B', color: 'PLASTICO', category: 'water', stockActual: 0, costo: 3800 },
  { id: 'C-C06', nombreItem: 'RENEW CITY (6 PASOS) METAL', ecosistema: 'LINEA RENEW CLÁSICA', medida: '10 X 54', boton: '5B', color: 'METAL', category: 'water', stockActual: 0, costo: 4000 },
  { id: 'C-D08', nombreItem: 'RENEW DUO (8 PASOS) METAL', ecosistema: 'LINEA RENEW CLÁSICA', medida: '10 X 54', boton: '5B', color: 'METAL', category: 'water', stockActual: 0, costo: 4800 },
  { id: 'C-P06', nombreItem: 'RENEW PLUS (6 PASOS) PLASTIC', ecosistema: 'LINEA RENEW CLÁSICA', medida: '13 X 54', boton: '5B', color: 'BEIGE', category: 'water', stockActual: 0, costo: 4400 },
  { id: 'P-01', nombreItem: 'POZO RENEW( 2 T )', ecosistema: 'LINEA RENEW POZO', medida: '10 X 54', boton: 'GOLD', color: 'NEG/GRI/BEIG', category: 'water', stockActual: 0, costo: 5700 },
  { id: 'P-02', nombreItem: 'POZO RENEW PLUS 13 (2 T )', ecosistema: 'LINEA RENEW POZO', medida: '13 X 54', boton: 'GOLD', color: 'BEIGE', category: 'water', stockActual: 0, costo: 6000 },
  { id: 'P-03', nombreItem: 'POZO RENEW PLUS + 10 (3 T)', ecosistema: 'LINEA RENEW POZO', medida: '10 X 54', boton: 'GOLD', color: 'NEG/GRI/BEIG', category: 'water', stockActual: 0, costo: 6500 },
  { id: 'P-04', nombreItem: 'POZO RENEW PLUS + 13 (3 T)', ecosistema: 'LINEA RENEW POZO', medida: '13 X 54', boton: 'GOLD', color: 'BEIGE', category: 'water', stockActual: 0, costo: 6900 },
  { id: 'P-05', nombreItem: 'POZO RENEW PREMIUM 10 (2 T)', ecosistema: 'LINEA RENEW POZO', medida: '10 X 54', boton: 'GOLD', color: 'NEG/GRI/BEIG', category: 'water', stockActual: 0, costo: 7400 },
  { id: 'P-06', nombreItem: 'POZO RENEW PREMIUM 13 (2T)', ecosistema: 'LINEA RENEW POZO', medida: '13 X 54', boton: 'GOLD', color: 'BEIGE', category: 'water', stockActual: 0, costo: 7700 },
  { id: 'P-07', nombreItem: 'POZO RENEW PREMIUM + PLUS (3T)', ecosistema: 'LINEA RENEW POZO', medida: '13 X 54', boton: 'GOLD', color: 'BEIGE', category: 'water', stockActual: 0, costo: 8000 },
  { id: 'RO-5', nombreItem: 'RO RENEW 5 ETAPAS BASICO', ecosistema: 'LINEA RENEW RO', medida: '', boton: '', color: '', category: 'water', stockActual: 0, costo: 1200 },
  { id: 'RO-6', nombreItem: 'RO RENEW 6 ETAPAS ALKALINO', ecosistema: 'LINEA RENEW RO', medida: '', boton: '', color: '', category: 'water', stockActual: 0, costo: 1300 },
  { id: 'RO-7', nombreItem: 'RO RENEW PRO 7 ETAPAS UV', ecosistema: 'LINEA RENEW RO', medida: '', boton: '', color: '', category: 'water', stockActual: 0, costo: 1400 },
  { id: 'RO-CO', nombreItem: 'RO RENEW COMERCIAL', ecosistema: 'LINEA RENEW RO', medida: '', boton: '', color: '', category: 'water', stockActual: 0, costo: 3700 },
];

const sedes = ['orlando', 'miami', 'dallas', 'new_york'];
let count = 0;

for (const item of products) {
  for (const sede of sedes) {
    const uniqueId = `${item.id}-${sede.substring(0, 3).toUpperCase()}`; // e.g. E-301-ORL
    const newItem = {
      ...item,
      id: uniqueId,
      locacion: sede,
      storage: sede
    };
    
    const idx = db.inventarioGlobal.findIndex(i => i.id === uniqueId);
    if (idx > -1) {
      db.inventarioGlobal[idx] = { ...db.inventarioGlobal[idx], ...newItem };
    } else {
      db.inventarioGlobal.push(newItem);
    }
    count++;
  }
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log(`Se han agregado/actualizado ${count} items de inventario en db.json`);
console.log('IMPORTANTE: Para que se sincronicen con Supabase, reinicia tu servidor Node (server.js) y abre la aplicación en tu navegador.');
