const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir(path.join(__dirname, 'js'), function(filePath) {
    if (filePath.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        
        // Fixing dash encoding issues
        content = content.replace(/ââ‚¬â€ /g, '- ');
        content = content.replace(/ââ‚¬â€œ/g, '-');
        content = content.replace(/ââ‚¬/g, '-');
        
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Fixed encoding in ${filePath}`);
        }
    }
});
