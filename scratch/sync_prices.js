const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MDQ4MDAwMDAsImV4cCI6MjUyODQ4MDAwMH0.KvxyKyMOZPu4RBhI_TKMsearLjskqC08kRj-krd6ZqI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const products = [
  {
    "nombre": "RENEW 3 PASOS S/CARCASA",
    "codigo": "E-301",
    "categoria": "LINEA RENEW ECONÓMICA",
    "precio_oficina": 1600,
    "precio_analista": 1750,
    "precio_vendedor": 1900,
    "precio_junior": 2000,
    "precio_subvende": 2500,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RENEW 4 PASOS S/CARCASA",
    "codigo": "E-302",
    "categoria": "LINEA RENEW ECONÓMICA",
    "precio_oficina": 1800,
    "precio_analista": 1900,
    "precio_vendedor": 2100,
    "precio_junior": 2200,
    "precio_subvende": 2700,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RENEW 5 PASOS S/CARCASA",
    "codigo": "E-303",
    "categoria": "LINEA RENEW ECONÓMICA",
    "precio_oficina": 1900,
    "precio_analista": 2100,
    "precio_vendedor": 2250,
    "precio_junior": 2350,
    "precio_subvende": 2900,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO BASICO 10X54 S/CARCASA",
    "codigo": "E-P01",
    "categoria": "LINEA RENEW ECONÓMICA",
    "precio_oficina": 3000,
    "precio_analista": 3300,
    "precio_vendedor": 3600,
    "precio_junior": 3800,
    "precio_subvende": 4400,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO BASICO 13X54 S/CARCASA",
    "codigo": "E-P02",
    "categoria": "LINEA RENEW ECONÓMICA",
    "precio_oficina": 3200,
    "precio_analista": 3500,
    "precio_vendedor": 3900,
    "precio_junior": 4100,
    "precio_subvende": 4700,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO FULL 10X54 S/CARCASA",
    "codigo": "E-PF1",
    "categoria": "LINEA RENEW ECONÓMICA",
    "precio_oficina": 3300,
    "precio_analista": 3650,
    "precio_vendedor": 4100,
    "precio_junior": 4300,
    "precio_subvende": 4900,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO FULL 13X54 S/CARCASA",
    "codigo": "E-PF2",
    "categoria": "LINEA RENEW ECONÓMICA",
    "precio_oficina": 3500,
    "precio_analista": 3800,
    "precio_vendedor": 4300,
    "precio_junior": 4500,
    "precio_subvende": 5100,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RENEW APTO (4 PASOS) PLASTIC",
    "codigo": "C-A04",
    "categoria": "LINEA RENEW CLÁSICA",
    "precio_oficina": 2300,
    "precio_analista": 2400,
    "precio_vendedor": 2800,
    "precio_junior": 3000,
    "precio_subvende": 3500,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RENEW MINI (4 PASOS)",
    "codigo": "C-M04",
    "categoria": "LINEA RENEW CLÁSICA",
    "precio_oficina": 2200,
    "precio_analista": 2500,
    "precio_vendedor": 2900,
    "precio_junior": 3200,
    "precio_subvende": 3700,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RENEW SMALL (4 PASOS) PLASTIC",
    "codigo": "C-S04",
    "categoria": "LINEA RENEW CLÁSICA",
    "precio_oficina": 2300,
    "precio_analista": 2650,
    "precio_vendedor": 3000,
    "precio_junior": 3300,
    "precio_subvende": 3800,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RENEW CITY (5 PASOS) PLASTIC",
    "codigo": "C-C05",
    "categoria": "LINEA RENEW CLÁSICA",
    "precio_oficina": 2500,
    "precio_analista": 2900,
    "precio_vendedor": 3300,
    "precio_junior": 3500,
    "precio_subvende": 4100,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RENEW CITY (6 PASOS) METAL",
    "codigo": "C-C06",
    "categoria": "LINEA RENEW CLÁSICA",
    "precio_oficina": 2700,
    "precio_analista": 3000,
    "precio_vendedor": 3500,
    "precio_junior": 3700,
    "precio_subvende": 4300,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RENEW DUO (8 PASOS) METAL",
    "codigo": "C-D08",
    "categoria": "LINEA RENEW CLÁSICA",
    "precio_oficina": 3600,
    "precio_analista": 3800,
    "precio_vendedor": 4000,
    "precio_junior": 4400,
    "precio_subvende": 5000,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RENEW PLUS (6 PASOS) PLASTIC",
    "codigo": "C-P06",
    "categoria": "LINEA RENEW CLÁSICA",
    "precio_oficina": 3000,
    "precio_analista": 3300,
    "precio_vendedor": 3600,
    "precio_junior": 4000,
    "precio_subvende": 4500,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO RENEW (2 T)",
    "codigo": "P-01",
    "categoria": "LINEA RENEW POZO",
    "precio_oficina": 4200,
    "precio_analista": 4500,
    "precio_vendedor": 5000,
    "precio_junior": 5300,
    "precio_subvende": 6000,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO RENEW PLUS 13 (2 T)",
    "codigo": "P-02",
    "categoria": "LINEA RENEW POZO",
    "precio_oficina": 4500,
    "precio_analista": 5000,
    "precio_vendedor": 5300,
    "precio_junior": 5500,
    "precio_subvende": 6300,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO RENEW PLUS + 10 (3 T)",
    "codigo": "P-03",
    "categoria": "LINEA RENEW POZO",
    "precio_oficina": 4700,
    "precio_analista": 5400,
    "precio_vendedor": 5600,
    "precio_junior": 6000,
    "precio_subvende": 6800,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO RENEW PLUS + 13 (3 T)",
    "codigo": "P-04",
    "categoria": "LINEA RENEW POZO",
    "precio_oficina": 5000,
    "precio_analista": 5600,
    "precio_vendedor": 6000,
    "precio_junior": 6500,
    "precio_subvende": 7200,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO RENEW PREMIUM 10 (2T)",
    "codigo": "P-05",
    "categoria": "LINEA RENEW POZO",
    "precio_oficina": 5600,
    "precio_analista": 6200,
    "precio_vendedor": 6500,
    "precio_junior": 7000,
    "precio_subvende": 7700,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO RENEW PREMIUM 13 (2T)",
    "codigo": "P-06",
    "categoria": "LINEA RENEW POZO",
    "precio_oficina": 6000,
    "precio_analista": 6600,
    "precio_vendedor": 6900,
    "precio_junior": 7300,
    "precio_subvende": 8000,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "POZO RENEW PREMIUM + PLUS (3T)",
    "codigo": "P-07",
    "categoria": "LINEA RENEW POZO",
    "precio_oficina": 6500,
    "precio_analista": 7000,
    "precio_vendedor": 7300,
    "precio_junior": 7500,
    "precio_subvende": 8300,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RO RENEW 5 ETAPAS BASICO",
    "codigo": "RO-5",
    "categoria": "LINEA RENEW RO",
    "precio_oficina": 600,
    "precio_analista": 700,
    "precio_vendedor": 900,
    "precio_junior": 1000,
    "precio_subvende": 1500,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RO RENEW 6 ETAPAS ALKALINO",
    "codigo": "RO-6",
    "categoria": "LINEA RENEW RO",
    "precio_oficina": 700,
    "precio_analista": 900,
    "precio_vendedor": 1000,
    "precio_junior": 1150,
    "precio_subvende": 1600,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RO RENEW PRO 7 ETAPAS UV",
    "codigo": "RO-7",
    "categoria": "LINEA RENEW RO",
    "precio_oficina": 900,
    "precio_analista": 1100,
    "precio_vendedor": 1200,
    "precio_junior": 1300,
    "precio_subvende": 1700,
    "sede": "todas",
    "es_activo": true
  },
  {
    "nombre": "RO RENEW COMERCIAL",
    "codigo": "RO-CO",
    "categoria": "LINEA RENEW RO",
    "precio_oficina": 1900,
    "precio_analista": 2300,
    "precio_vendedor": 2500,
    "precio_junior": 3000,
    "precio_subvende": 3800,
    "sede": "todas",
    "es_activo": true
  }
];

async function sync() {
  console.log('Iniciando sincronización de precios...');
  
  // Limpiar tabla antes de insertar (opcional, pero recomendado para evitar duplicados si se corre varias veces)
  const { error: delError } = await supabase
    .from('water_productos')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (delError) {
    console.error('Error al limpiar tabla:', delError);
  }

  const { data, error } = await supabase
    .from('water_productos')
    .insert(products);

  if (error) {
    console.error('Error al insertar productos:', error);
  } else {
    console.log('Sincronización completada con éxito. ' + products.length + ' productos insertados.');
  }
}

sync();
