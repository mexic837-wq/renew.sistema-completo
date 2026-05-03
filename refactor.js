const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'LENOVO', 'Desktop', 'SISTEMA-COMPLETO-RENEW', 'admin.html');
let text = fs.readFileSync(filePath, 'utf-8');

// 1. Update tailwind config
text = text.replace('extend: {', 'darkMode: "class",\n                extend: {');
const colorsReplacement = `colors: {
                        darkBg: '#0f172a',      
                        darkSurface: '#1e293b', 
                        tealAccent: '#0d9488',
                        bgLight: '#f8fafc',
                        surfaceLight: '#ffffff',
                        bgDark: '#0f172a',
                        surfaceDark: '#1e293b'
                    }`;
text = text.replace(/colors:\s*\{[^}]+\}/, colorsReplacement);

// 2. Update styles
text = text.replace('.glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); }', 
    '.glass { backdrop-filter: blur(10px); }');

// 3. Replace fixed colors with dynamic ones
const replacements = {
    'bg-darkBg': 'bg-bgLight dark:bg-bgDark transition-colors duration-300',
    'bg-darkSurface': 'bg-surfaceLight dark:bg-surfaceDark transition-colors duration-300',
    'border-gray-700': 'border-gray-200 dark:border-gray-700',
    'border-gray-600': 'border-gray-300 dark:border-gray-600',
    'bg-[#0b1120]': 'bg-bgLight dark:bg-bgDark transition-colors duration-300',
};

for (const [k, v] of Object.entries(replacements)) {
    // split/join replaces all occurrences
    text = text.split(k).join(v);
}

// Complex replaces for text-colors inside class attributes
text = text.replace(/class="([^"]+)"/g, (match, p1) => {
    let classes = p1;
    // Replace body background explicitly handled above, but let's do text colors
    if (classes.includes('text-gray-300')) classes = classes.split('text-gray-300').join('text-gray-800 dark:text-gray-300 transition-colors duration-300');
    if (classes.includes('text-gray-400')) classes = classes.split('text-gray-400').join('text-gray-500 dark:text-gray-400');
    if (classes.includes('text-white')) classes = classes.split('text-white').join('text-gray-800 dark:text-white');
    return `class="${classes}"`;
});

// The toggle button and logic script
const toggleHtml = `        <div class="px-4 mt-auto mb-4">
            <button id="btn-theme-toggle" class="w-full flex items-center justify-between px-4 py-3 bg-surfaceLight dark:bg-surfaceDark border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow transition-all text-gray-600 dark:text-gray-400">
                <span class="font-medium text-sm">Tema Visual</span>
                <i class="fa-solid fa-moon dark:hidden"></i>
                <i class="fa-solid fa-sun hidden dark:block text-yellow-400"></i>
            </button>
        </div>`;

text = text.replace('<div class="p-6 border-t border-gray-200 dark:border-gray-700">', toggleHtml + '\n        <div class="p-6 border-t border-gray-200 dark:border-gray-700">');

const scriptHtml = `    <script>
        // Init theme
        if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        document.getElementById('btn-theme-toggle').addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            if (document.documentElement.classList.contains('dark')) {
                localStorage.setItem('theme', 'dark');
            } else {
                localStorage.setItem('theme', 'light');
            }
        });
    </script>
`;

text = text.replace('<!-- Module script -->', scriptHtml + '    <!-- Module script -->');

fs.writeFileSync(filePath, text, 'utf-8');
console.log('Done!');
