const fs = require('fs');
const path = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js';
let content = fs.readFileSync(path, 'utf8');

// Use a more robust regex-based replacement
const regex = /if\(file\s*\|\|\s*miniaturaFile\)\s*\{[\s\S]*?if\(data\.miniaturaUrl\)\s*miniaturaUrl\s*=\s*data\.miniaturaUrl;\s*\}/;

const replacement = `if(file || miniaturaFile) {
               try {
                   const data = await uploadAcademia(file, miniaturaFile);
                   if(data.videoUrl) videoUrl = data.videoUrl;
                   if(data.miniaturaUrl) miniaturaUrl = data.miniaturaUrl;
               } catch (err) {
                   console.error('Upload Error:', err);
                   throw new Error('No se pudo conectar con el servidor de subida. Asegúrate de que el backend esté en ejecución.');
               }
           }`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(path, content);
    console.log('✅ File updated successfully with regex');
} else {
    console.log('❌ Regex did not match');
    // Try a simpler search to debug
    if (content.includes('http://localhost:3010/api/upload-academia')) {
        console.log('Found hardcoded URL, but regex failed. Performing line-by-line fix...');
        // Fallback: manual string replacement for the fetch call only
        const lines = content.split('\n');
        let fixed = false;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("fetch('http://localhost:3010/api/upload-academia'")) {
                console.log(`Found hardcoded URL at line ${i+1}`);
                // Find the beginning of the try block
                let start = i;
                while (start > 0 && !lines[start].includes('try {')) start--;
                // Find the end of the error handling
                let end = i;
                while (end < lines.length && !lines[end].includes('if(data.miniaturaUrl)')) end++;
                
                if (start > 0 && end < lines.length) {
                    const before = lines.slice(0, start).join('\n');
                    const after = lines.slice(end + 2).join('\n'); // skip the if(miniaturaUrl) lines
                    const middle = `                try {
                    const data = await uploadAcademia(file, miniaturaFile);
                    if(data.videoUrl) videoUrl = data.videoUrl;
                    if(data.miniaturaUrl) miniaturaUrl = data.miniaturaUrl;
                } catch (err) {
                    console.error('Upload Error:', err);
                    throw new Error('No se pudo conectar con el servidor de subida. Asegúrate de que el backend esté en ejecución.');
                }`;
                    fs.writeFileSync(path, before + '\n' + middle + '\n' + after);
                    fixed = true;
                    break;
                }
            }
        }
        if (fixed) console.log('✅ File updated successfully with fallback');
        else console.log('❌ Fallback also failed');
    }
}
