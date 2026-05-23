const fs = require('fs');

// Fix admin.html
let adminHtml = fs.readFileSync('admin.html', 'utf8');
adminHtml = adminHtml.replace(/<label class="aqua-label">.*?rea de Cobertura<\/label>/g, '<label class="aqua-label">Área de Cobertura</label>');
fs.writeFileSync('admin.html', adminHtml);

// Fix js/admin-app.js
let adminJs = fs.readFileSync('js/admin-app.js', 'utf8');
// Fix title
adminJs = adminJs.replace(/textContent = 'A.*?adir Partner \/ Proveedor';/g, "textContent = 'Añadir Partner / Proveedor';");

// Fix Emojis
adminJs = adminJs.replace(/>[^<]*?\$\{t\('partner_cat_fence'\)\}/, '>🚧 ${t(\'partner_cat_fence\')}');
adminJs = adminJs.replace(/>[^<]*?\$\{t\('partner_cat_roofing'\)\}/, '>🏠 ${t(\'partner_cat_roofing\')}');
adminJs = adminJs.replace(/>[^<]*?\$\{t\('partner_cat_solar'\)\}/, '>☀️ ${t(\'partner_cat_solar\')}');
adminJs = adminJs.replace(/>[^<]*?\$\{t\('partner_cat_hvac'\)\}/, '>❄️ ${t(\'partner_cat_hvac\')}');
adminJs = adminJs.replace(/>[^<]*?\$\{t\('partner_cat_painting'\)\}/, '>🎨 ${t(\'partner_cat_painting\')}');
adminJs = adminJs.replace(/>[^<]*?\$\{t\('partner_cat_remodelacion'\)\}/, '>🛠️ ${t(\'partner_cat_remodelacion\')}');
adminJs = adminJs.replace(/>[^<]*?\$\{t\('partner_cat_dumpsters'\)\}/, '>🗑️ ${t(\'partner_cat_dumpsters\')}');
adminJs = adminJs.replace(/>[^<]*?\$\{t\('partner_cat_gutters'\)\}/, '>🌧️ ${t(\'partner_cat_gutters\')}');
adminJs = adminJs.replace(/>[^<]*?\$\{t\('partner_cat_screens'\)\}/, '>🪟 ${t(\'partner_cat_screens\')}');
adminJs = adminJs.replace(/>[^<]*?\$\{t\('partner_cat_general'\)\}/, '>⚙️ ${t(\'partner_cat_general\')}');

fs.writeFileSync('js/admin-app.js', adminJs);

console.log("Encoding and Emojis Fixed");
