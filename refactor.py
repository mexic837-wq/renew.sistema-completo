import os, re
path = r'c:\\Users\\LENOVO\\Desktop\\SISTEMA-COMPLETO-RENEW\\admin.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update tailwind config
text = text.replace('extend: {', 'darkMode: "class",\\n                extend: {')
colors_replacement = '''colors: {
                        darkBg: "#0f172a",      
                        darkSurface: "#1e293b", 
                        tealAccent: "#0d9488",
                        bgLight: "#f8fafc",
                        surfaceLight: "#ffffff",
                        bgDark: "#0f172a",
                        surfaceDark: "#1e293b"
                    }'''
text = re.sub(r'colors: \{[^\}]+\}', colors_replacement, text, flags=re.DOTALL)

# 2. Update styles
text = text.replace('.glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); }', 
    '.glass { backdrop-filter: blur(10px); }')

# 3. Replace fixed colors with dynamic ones
replacements = {
    'bg-darkBg': 'bg-bgLight dark:bg-bgDark transition-colors duration-300',
    'bg-darkSurface': 'bg-surfaceLight dark:bg-surfaceDark transition-colors duration-300',
    'border-gray-700': 'border-gray-200 dark:border-gray-700',
    'border-gray-600': 'border-gray-300 dark:border-gray-600',
    'bg-[#0b1120]': 'bg-bgLight dark:bg-bgDark transition-colors duration-300',
    'text-white': 'text-gray-800 dark:text-white',
    'text-gray-400': 'text-gray-500 dark:text-gray-400',
    'text-gray-300': 'text-gray-800 dark:text-gray-300',
}
for k, v in replacements.items():
    text = text.replace(k, v)


# The toggle button and logic script
toggle_html = '''        <div class="px-4 mt-auto mb-4">
            <button id="btn-theme-toggle" class="w-full flex items-center justify-between px-4 py-3 bg-surfaceLight dark:bg-surfaceDark border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow transition-all text-gray-600 dark:text-gray-400">
                <span class="font-medium text-sm">Tema Visual</span>
                <i class="fa-solid fa-moon dark:hidden"></i>
                <i class="fa-solid fa-sun hidden dark:block text-yellow-400"></i>
            </button>
        </div>'''

text = text.replace('<div class="p-6 border-t border-gray-200 dark:border-gray-700">', toggle_html + '\\n        <div class="p-6 border-t border-gray-200 dark:border-gray-700">')

script_html = '''    <script>
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
'''

text = text.replace('<!-- Module script -->', script_html + '    <!-- Module script -->')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
