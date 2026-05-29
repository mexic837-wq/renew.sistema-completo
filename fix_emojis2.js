const fs = require('fs');
let code = fs.readFileSync('js/admin-app.js', 'utf8');

// Use string replacement for the html we found:
code = code.replace(
  '<span class="px-2 py-0.5 bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-orange-500/20">â˜€ï¸  ${t(\'partner_cat_solar\')}</span>',
  '<span class="px-2 py-0.5 bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-orange-500/20"><i class="fa-solid fa-sun"></i> ${t(\'partner_cat_solar\')}</span>'
);

code = code.replace(
  '<span class="px-2 py-0.5 bg-cyan-500/10 text-cyan-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-cyan-500/20">â „ï¸  ${t(\'partner_cat_hvac\')}</span>',
  '<span class="px-2 py-0.5 bg-cyan-500/10 text-cyan-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-cyan-500/20"><i class="fa-solid fa-snowflake"></i> ${t(\'partner_cat_hvac\')}</span>'
);

code = code.replace(
  '<span class="px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-gray-200 dark:border-white/5">âš™ï¸  ${t(\'partner_cat_general\')}</span>',
  '<span class="px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-gray-200 dark:border-white/5"><i class="fa-solid fa-gear"></i> ${t(\'partner_cat_general\')}</span>'
);

fs.writeFileSync('js/admin-app.js', code);
console.log('Fixed');
