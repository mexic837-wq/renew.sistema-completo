const fs = require('fs');
const t = fs.readFileSync('server.js', 'utf8');

// Find SUPABASE_URL
const urlMatch = t.match(/['"]?SUPABASE[_]?URL['"]?\s*[=:]\s*['"]([^'"]+)['"]/i)
               || t.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/i)
               || t.match(/createClient\(['"]([^'"]+)['"]/i);
console.log('SUPABASE_URL:', urlMatch ? urlMatch[1] : 'NOT FOUND');

// Find SUPABASE_KEY
const keyMatch = t.match(/['"]?SUPABASE[_]?(?:ANON[_]?)?KEY['"]?\s*[=:]\s*['"]([^'"]{30,})['"]/i)
               || t.match(/supabaseKey\s*=\s*['"]([^'"]{30,})['"]/i);
console.log('SUPABASE_KEY:', keyMatch ? keyMatch[1].substring(0, 40) + '...' : 'NOT FOUND');

// Find API_BASE in api.js
const api = fs.readFileSync('js/api.js', 'utf8');
const apiBase = api.match(/API_BASE\s*=\s*['"]([^'"]+)['"]/);
console.log('API_BASE:', apiBase ? apiBase[1] : 'NOT FOUND');
const apiSupa = api.match(/supabase[^\n]{0,200}/gi);
if (apiSupa) console.log('SUPABASE in api.js:', apiSupa.slice(0,3));
