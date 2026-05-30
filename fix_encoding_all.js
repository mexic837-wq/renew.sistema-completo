const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('js', function(filePath) {
    if (filePath.endsWith('.js')) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            let original = content;
            
            content = content.replace(/Â¿/g, '¿');
            content = content.replace(/Â¡/g, '¡');
            content = content.replace(/Ã‘/g, 'Ñ');
            content = content.replace(/Ã¡/g, 'á');
            content = content.replace(/Ã©/g, 'é');
            content = content.replace(/Ã­/g, 'í');
            content = content.replace(/Ã³/g, 'ó');
            content = content.replace(/Ãº/g, 'ú');
            content = content.replace(/Ã±/g, 'ñ');
            
            if (content !== original) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Fixed encoding in ${filePath}`);
            }
        } catch (e) {
            console.error(`Error fixing ${filePath}:`, e);
        }
    }
});
