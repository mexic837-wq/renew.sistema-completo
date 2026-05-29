const fs = require('fs');
const file = 'js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

// The core mojibake pattern: Latin-1 mis-decoded UTF-8
// Ã© = é, Ã³ = ó, Ã± = ñ, Ã¡ = á, Ã­ = í, Ãº = ú, Ã¼ = ü, Ã  = à
// More complex patterns from multi-byte sequences
const fixes = [
  // Multi-byte mojibake patterns first (most specific)
  ['Ã¢â€â‚¬', '–'],   // en dash context
  ['Ã¢â€â€', '—'],    // em dash
  ['Ã¢â€"', '—'],
  ['Ã¢Å¡Â ', '⚠ '],
  ['Ã¢Å¡Â', '⚠'],
  ['Ã¯Â¸Â ', '️'],
  ['Ã¯Â¸Â', '️'],
  ['Ãâ€"', '×'],
  ['Ã¢Ëœâ‚¬', '☀'],
  ['Ã¢Å"â€œ', '✓'],
  ['ÃÂS', 'ÁS'],    // ESTÁS
  ['ÃÅ¡lt', 'Últ'],
  ['ÃÂre', 'Ère'],
  // Single char mojibake (Spanish accented letters)
  ['Ã©', 'é'],
  ['Ã³', 'ó'],
  ['Ã±', 'ñ'],
  ['Ã¡', 'á'],
  ['Ã­', 'í'],
  ['Ãº', 'ú'],
  ['Ã¼', 'ü'],
  ['Ã ', 'à'],
  ['Ã¨', 'è'],
  ['Ã¢', 'â'],
  ['Ã´', 'ô'],
  ['Ã®', 'î'],
  ['Ã»', 'û'],
  ['Ã€', 'À'],
  ['Ã‰', 'É'],
  ['Ã"', 'Ó'],
  ['Ã', 'Ñ'],   // must come after more specific patterns
];

for (const [bad, good] of fixes) {
  content = content.split(bad).join(good);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Done fixing remaining Spanish encoding.');
