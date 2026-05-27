const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const prices = {
  'E-301': 2200,
  'E-302': 2400,
  'E-303': 2600,
  'E-P01': 3900,
  'E-P02': 4200,
  'E-PF1': 4500,
  'E-PF2': 4700,
  'C-A04': 3300,
  'C-M04': 3500,
  'C-S04': 3600,
  'C-C05': 3800,
  'C-C06': 4000,
  'C-D08': 4800,
  'C-P06': 4400,
  'P-01': 5700,
  'P-02': 6000,
  'P-03': 6500,
  'P-04': 6900,
  'P-05': 7400,
  'P-06': 7700,
  'P-07': 8000,
  'RO-5': 1200,
  'RO-6': 1300,
  'RO-7': 1400,
  'RO-CO': 3500
};

async function updatePrices() {
  console.log('Starting price updates for Iniciante...');
  for (const [codigo, precio] of Object.entries(prices)) {
    const { error } = await supabase
      .from('water_productos')
      .update({ precio_iniciante: precio })
      .eq('codigo', codigo);
    
    if (error) {
      console.error(`Error updating ${codigo}:`, error.message);
    } else {
      console.log(`Updated ${codigo} -> ${precio}`);
    }
  }
  console.log('Done updating prices!');
}

updatePrices();
