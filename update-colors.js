const fs = require('fs');
const path = require('path');

function refactorFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let text = fs.readFileSync(filePath, 'utf-8');

    // 1. Update tailwind config (if admin.html)
    if (filePath.endsWith('admin.html')) {
        const colorsReplacement = `colors: {
                        darkBg: '#0b1120',      
                        darkSurface: '#162032', 
                        tealAccent: '#00dfbf',
                        greenAccent: '#05d564',
                        yellowAccent: '#ffc107',
                        bgLight: '#f4f7f6',
                        surfaceLight: '#ffffff',
                        bgDark: '#0b1120',
                        surfaceDark: '#162032'
                    }`;
        text = text.replace(/colors:\s*\{[^}]+\}/, colorsReplacement);
    }

    // Fix the black box hover issue in menus
    text = text.replace(/hover:bg-gray-800 hover:text-gray-800 dark:text-white/g, 'hover:bg-tealAccent/10 hover:text-tealAccent dark:hover:text-tealAccent');
    text = text.replace(/hover:text-gray-800 dark:text-white/g, 'dark:text-white');
    text = text.replace(/hover:bg-gray-800/g, 'hover:bg-tealAccent/10');

    // Fix the cards in the canvas (admin-app.js)
    if (filePath.endsWith('admin-app.js')) {
        text = text.replace(/bg-bgLight dark:bg-bgDark transition-colors duration-300/g, 'bg-surfaceLight dark:bg-surfaceDark transition-colors duration-300'); // Cards should be surface
        text = text.replace(/bg-gray-50 dark:bg-\[#0f172a\]/g, 'bg-bgLight dark:bg-darkBg');
        text = text.replace(/bg-white dark:bg-\[#1e293b\]/g, 'bg-surfaceLight dark:bg-darkSurface');
    }

    // Fix text colors for headers
    text = text.replace(/text-gray-800 dark:text-gray-300/g, 'text-gray-800 dark:text-gray-200');

    // Fix button background in light mode
    text = text.replace(/bg-gray-800 text-gray-800/g, 'bg-gray-200 text-gray-800 hover:bg-gray-300');

    fs.writeFileSync(filePath, text, 'utf-8');
}

["admin.html", "js/admin-app.js", "index.html", "css/styles.css"].forEach(f => {
    refactorFile(path.join('c:', 'Users', 'LENOVO', 'Desktop', 'SISTEMA-COMPLETO-RENEW', f));
});

// Update styles.css specific CSS vars for the mobile app
const cssPath = path.join('c:', 'Users', 'LENOVO', 'Desktop', 'SISTEMA-COMPLETO-RENEW', 'css', 'styles.css');
if (fs.existsSync(cssPath)) {
    let cssText = fs.readFileSync(cssPath, 'utf-8');
    
    // Update --primary and --accent to the new logo colors
    cssText = cssText.replace(/--primary:\s*#[a-fA-F0-9]+;/g, '--primary: #00dfbf;');
    cssText = cssText.replace(/--primary-dark:\s*#[a-fA-F0-9]+;/g, '--primary-dark: #00bfa3;');
    cssText = cssText.replace(/--primary-light:\s*#[a-fA-F0-9]+;/g, '--primary-light: #ccfbf1;');
    
    cssText = cssText.replace(/--accent:\s*#[a-fA-F0-9]+;/g, '--accent: #05d564;');
    cssText = cssText.replace(/--accent-dark:\s*#[a-fA-F0-9]+;/g, '--accent-dark: #04b353;');

    // update the darkBg classes in CSS
    cssText = cssText.replace(/#0f172a/g, '#0b1120'); // old darkBg to new darkBg
    cssText = cssText.replace(/#1e293b/g, '#162032'); // old darkSurface to new darkSurface

    fs.writeFileSync(cssPath, cssText, 'utf-8');
}

console.log("Colors optimized.");
