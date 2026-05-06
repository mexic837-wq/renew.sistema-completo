const fs = require('fs');
const path = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /<div class="grid grid-cols-2 gap-3 mb-8">\s*\${pipsOptionsHtml}\s*<\/div>\s*<div class="bg-white dark:bg-darkCard p-8 rounded-3xl border border-gray-100 dark:border-white\/5 shadow-sm">/;

const replacement = `<div class="grid grid-cols-2 gap-3 mb-8">
               \${pipsOptionsHtml}
            </div>

            <div class="flex gap-3">
               <button id="btn-save-academia" class="flex-1 btn-premium py-4 rounded-xl text-xs tracking-widest font-black uppercase">
                  <i class="fa-solid fa-save"></i> \${t('aca_btn_save')}
               </button>
               <button id="aca-cancel-edit" class="hidden px-6 py-4 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 font-black text-xs uppercase tracking-widest rounded-xl transition-colors">
                  \${t('aca_btn_cancel')}
               </button>
            </div>
         </div>
         
         <!-- LIST -->
         <div class="bg-white dark:bg-darkCard p-8 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(path, content);
    console.log('✅ File restored successfully with regex');
} else {
    console.log('❌ Regex not found for restoration');
}
