const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://admin:Renew123%25@supabase.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyY2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjQwNTIyODAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const products = [
  { id: 'E-301', nombre_item: 'RENEW 3 PASOS S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '10 X 44', boton: '3B', color: 'NEGRO', category: 'water', stock_actual: 0 },
  { id: 'E-302', nombre_item: 'RENEW 4 PASOS S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '9 X 48', boton: '3B', color: 'NEGRO', category: 'water', stock_actual: 0 },
  { id: 'E-303', nombre_item: 'RENEW 4 PASOS S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '10 X 54', boton: '3B', color: 'NEGRO', category: 'water', stock_actual: 0 },
  { id: 'E-P01', nombre_item: 'POZO BASICO 10X54 S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '10 X 54', boton: '3B', color: 'NEGRO', category: 'water', stock_actual: 0 },
  { id: 'E-P02', nombre_item: 'POZO BASICO 13X54 S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '13 X 54', boton: '3B', color: 'NEGRO', category: 'water', stock_actual: 0 },
  { id: 'E-PF1', nombre_item: 'POZO FULL 10X54 S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '10 X 54', boton: '3B', color: 'NEGRO', category: 'water', stock_actual: 0 },
  { id: 'E-PF2', nombre_item: 'POZO FULL 13X54 S/CARCASA', ecosistema: 'LINEA RENEW ECONÓMICA', medida: '13 X 54', boton: '3B', color: 'NEGRO', category: 'water', stock_actual: 0 },
  { id: 'C-A04', nombre_item: 'RENEW APTO (4 PASOS) PLASTIC', ecosistema: 'LINEA RENEW CLÁSICA', medida: 'ESTÁNDAR', boton: '5B', color: 'GRIS', category: 'water', stock_actual: 0 },
  { id: 'C-M04', nombre_item: 'RENEW MINI (4 PASOS)', ecosistema: 'LINEA RENEW CLÁSICA', medida: '10 X 44', boton: '3B', color: 'GRIS', category: 'water', stock_actual: 0 },
  { id: 'C-S04', nombre_item: 'RENEW SMALL (4 PASOS) PLASTIC', ecosistema: 'LINEA RENEW CLÁSICA', medida: '9 X 48', boton: '5B', color: 'BEIGE/GRIS', category: 'water', stock_actual: 0 },
  { id: 'C-C05', nombre_item: 'RENEW CITY (5 PASOS) PLASTIC', ecosistema: 'LINEA RENEW CLÁSICA', medida: '10 X 54', boton: '5B', color: 'PLASTICO', category: 'water', stock_actual: 0 },
  { id: 'C-C06', nombre_item: 'RENEW CITY (6 PASOS) METAL', ecosistema: 'LINEA RENEW CLÁSICA', medida: '10 X 54', boton: '5B', color: 'METAL', category: 'water', stock_actual: 0 },
  { id: 'C-D08', nombre_item: 'RENEW DUO (8 PASOS) METAL', ecosistema: 'LINEA RENEW CLÁSICA', medida: '10 X 54', boton: '5B', color: 'METAL', category: 'water', stock_actual: 0 },
  { id: 'C-P06', nombre_item: 'RENEW PLUS (6 PASOS) PLASTIC', ecosistema: 'LINEA RENEW CLÁSICA', medida: '13 X 54', boton: '5B', color: 'BEIGE', category: 'water', stock_actual: 0 },
  { id: 'P-01', nombre_item: 'POZO RENEW( 2 T )', ecosistema: 'LINEA RENEW POZO', medida: '10 X 54', boton: 'GOLD', color: 'NEG/GRI/BEIG', category: 'water', stock_actual: 0 },
  { id: 'P-02', nombre_item: 'POZO RENEW PLUS 13 (2 T )', ecosistema: 'LINEA RENEW POZO', medida: '13 X 54', boton: 'GOLD', color: 'BEIGE', category: 'water', stock_actual: 0 },
  { id: 'P-03', nombre_item: 'POZO RENEW PLUS + 10 (3 T)', ecosistema: 'LINEA RENEW POZO', medida: '10 X 54', boton: 'GOLD', color: 'NEG/GRI/BEIG', category: 'water', stock_actual: 0 },
  { id: 'P-04', nombre_item: 'POZO RENEW PLUS + 13 (3 T)', ecosistema: 'LINEA RENEW POZO', medida: '13 X 54', boton: 'GOLD', color: 'BEIGE', category: 'water', stock_actual: 0 },
  { id: 'P-05', nombre_item: 'POZO RENEW PREMIUM 10 (2 T)', ecosistema: 'LINEA RENEW POZO', medida: '10 X 54', boton: 'GOLD', color: 'NEG/GRI/BEIG', category: 'water', stock_actual: 0 },
  { id: 'P-06', nombre_item: 'POZO RENEW PREMIUM 13 (2T)', ecosistema: 'LINEA RENEW POZO', medida: '13 X 54', boton: 'GOLD', color: 'BEIGE', category: 'water', stock_actual: 0 },
  { id: 'P-07', nombre_item: 'POZO RENEW PREMIUM + PLUS (3T)', ecosistema: 'LINEA RENEW POZO', medida: '13 X 54', boton: 'GOLD', color: 'BEIGE', category: 'water', stock_actual: 0 },
  { id: 'RO-5', nombre_item: 'RO RENEW 5 ETAPAS BASICO', ecosistema: 'LINEA RENEW RO', medida: '', boton: '', color: '', category: 'water', stock_actual: 0 },
  { id: 'RO-6', nombre_item: 'RO RENEW 6 ETAPAS ALKALINO', ecosistema: 'LINEA RENEW RO', medida: '', boton: '', color: '', category: 'water', stock_actual: 0 },
  { id: 'RO-7', nombre_item: 'RO RENEW PRO 7 ETAPAS UV', ecosistema: 'LINEA RENEW RO', medida: '', boton: '', color: '', category: 'water', stock_actual: 0 },
  { id: 'RO-CO', nombre_item: 'RO RENEW COMERCIAL', ecosistema: 'LINEA RENEW RO', medida: '', boton: '', color: '', category: 'water', stock_actual: 0 },
];

const sedes = ['orlando', 'miami', 'dallas', 'new_york'];
let count = 0;

async function seed() {
  const toInsert = [];
  for (const item of products) {
    for (const sede of sedes) {
      const uniqueId = `${item.id}-${sede.substring(0, 3).toUpperCase()}`; // e.g. E-301-ORL
      toInsert.push({
        ...item,
        id: uniqueId,
        locacion: sede,
        storage: sede
      });
      count++;
    }
  }

  const { data, error } = await supabase.from('inventario_global').upsert(toInsert, { onConflict: 'id' });
  if (error) {
    console.error('Error inserting directly to Supabase', error);
  } else {
    console.log(`Successfully seeded ${count} items to Supabase!`);
  }
}
seed();
