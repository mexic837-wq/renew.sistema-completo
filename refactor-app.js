const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'LENOVO', 'Desktop', 'SISTEMA-COMPLETO-RENEW', 'js', 'admin-app.js');
let text = fs.readFileSync(filePath, 'utf-8');

const replacements = {
    'bg-darkBg': 'bg-bgLight dark:bg-bgDark transition-colors duration-300',
    'bg-darkSurface': 'bg-surfaceLight dark:bg-surfaceDark transition-colors duration-300',
    'border-gray-700': 'border-gray-200 dark:border-gray-700',
    'border-gray-600': 'border-gray-300 dark:border-gray-600',
    'bg-[#151e32]': 'bg-gray-100 dark:bg-[#151e32]',
    'bg-[#0f172a]': 'bg-gray-50 dark:bg-[#0f172a]',
    'bg-[#1e293b]': 'bg-white dark:bg-[#1e293b]',
    'text-white': 'text-gray-800 dark:text-white',
    // Carefully handle specific gray text classes
    'text-gray-400': 'text-gray-500 dark:text-gray-400',
    'text-gray-300': 'text-gray-600 dark:text-gray-300'
};

for (const [k, v] of Object.entries(replacements)) {
    text = text.split(k).join(v);
}

fs.writeFileSync(filePath, text, 'utf-8');
console.log('Done admin-app.js!');
