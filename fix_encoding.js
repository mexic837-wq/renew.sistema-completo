const fs = require('fs');

function fixEncoding(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Fixing common ISO-8859-1 -> UTF-8 mojibake
        content = content.replace(/Â¿/g, '¿');
        content = content.replace(/Ã‘/g, 'Ñ');
        content = content.replace(/Ã¡/g, 'á');
        content = content.replace(/Ã©/g, 'é');
        content = content.replace(/Ã­/g, 'í');
        content = content.replace(/Ã³/g, 'ó');
        content = content.replace(/Ãº/g, 'ú');
        content = content.replace(/Ã±/g, 'ñ');
        content = content.replace(/Â S/g, ' S');
        content = content.replace(/ESTÑ Â/g, 'ESTÁS'); // ESTÑ Â S SEGURO
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed encoding in ${filePath}`);
    } catch (e) {
        console.error(`Error fixing ${filePath}:`, e);
    }
}

fixEncoding('js/admin-app.js');
