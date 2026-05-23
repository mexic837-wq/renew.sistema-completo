const fs = require('fs');

let html = fs.readFileSync('admin.html', 'utf8');

// Replace the garbled ES and EN buttons with proper ones
html = html.replace(
    /<button id="admin-lang-es"[\s\S]*?<\/button>/,
    `<button id="admin-lang-es" onclick="window.setAdminLang('es')"
                                    class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition-all"
                                    style="border-color: rgba(0,245,212,0.4); background: rgba(0,245,212,0.08); color: #00f5d4;">
                                    🇪🇸 ES
                                </button>`
);

html = html.replace(
    /<button id="admin-lang-en"[\s\S]*?<\/button>/,
    `<button id="admin-lang-en" onclick="window.setAdminLang('en')"
                                    class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border border-gray-700 text-gray-400 transition-all hover:border-blue-400 hover:text-blue-400">
                                    🇺🇸 EN
                                </button>`
);

fs.writeFileSync('admin.html', html, 'utf8');
console.log('Fixed flags');
