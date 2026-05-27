const fs = require('fs');

let content = fs.readFileSync('./js/admin-app.js', 'utf8');

const fixes = {
    'ðŸ§\'â€ðŸ\'¼': '🧑‍💼',
    'ðŸ"ž': '📞',
    'ðŸ" ': '📍',
    'ðŸ‡ªðŸ‡¸': '🇪🇸',
    'ðŸ‡ºðŸ‡¸': '🇺🇸',
    'ðŸŒ™': '🌙',
    'â˜€ï¸ ': '☀️',
    'ðŸ\'§': '💧'
};

// Also replace the specific ones from the map card HTML (lines 3552-3556 roughly):
// "ðŸ§‘â€ ðŸ’¼", "ðŸ“ž", "ðŸ“ "
const mapFixes = {
    'ðŸ§‘â€ ðŸ’¼': '🧑‍💼',
    'ðŸ“ž': '📞',
    'ðŸ“ ': '📍',
    'ðŸ’§': '💧'
};

for (const [bad, good] of Object.entries(fixes)) {
    content = content.split(bad).join(good);
}

for (const [bad, good] of Object.entries(mapFixes)) {
    content = content.split(bad).join(good);
}

fs.writeFileSync('./js/admin-app.js', content, 'utf8');
console.log('Done!');
