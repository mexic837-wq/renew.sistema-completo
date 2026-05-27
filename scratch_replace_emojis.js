const fs = require('fs');
const path = require('path');

const replacements = {
  '<i class="fa-solid fa-bullhorn"></i>': '<i class=\"fa-solid fa-bullhorn\"></i>',
  '<i class="fa-solid fa-champagne-glasses"></i>': '<i class=\"fa-solid fa-champagne-glasses\"></i>',
  '<i class="fa-solid fa-check text-green-500"></i>': '<i class=\"fa-solid fa-check text-green-500\"></i>',
  '<i class="fa-solid fa-xmark text-red-500"></i>': '<i class=\"fa-solid fa-xmark text-red-500\"></i>',
  '<i class="fa-solid fa-xmark text-red-500"></i>': '<i class=\"fa-solid fa-xmark text-red-500\"></i>',
  '<i class="fa-solid fa-xmark text-red-500"></i>': '<i class=\"fa-solid fa-xmark text-red-500\"></i>',
  '<i class="fa-solid fa-check text-green-500"></i>': '<i class=\"fa-solid fa-check text-green-500\"></i>',
  '<i class="fa-solid fa-triangle-exclamation text-orange-500"></i>': '<i class=\"fa-solid fa-triangle-exclamation text-orange-500\"></i>',
  '<i class="fa-solid fa-triangle-exclamation text-orange-500"></i>': '<i class=\"fa-solid fa-triangle-exclamation text-orange-500\"></i>',
  '<i class="fa-solid fa-eye"></i>': '<i class=\"fa-solid fa-eye\"></i>',
  '<i class="fa-solid fa-handshake"></i>': '<i class=\"fa-solid fa-handshake\"></i>',
  '<i class="fa-solid fa-pen-nib"></i>': '<i class=\"fa-solid fa-pen-nib\"></i>',
  '<i class="fa-solid fa-star"></i>': '<i class=\"fa-solid fa-star\"></i>',
  '<i class="fa-solid fa-fire text-orange-500"></i>': '<i class=\"fa-solid fa-fire text-orange-500\"></i>',
  '<i class="fa-solid fa-lock"></i>': '<i class=\"fa-solid fa-lock\"></i>',
  '<i class="fa-solid fa-satellite-dish"></i>': '<i class=\"fa-solid fa-satellite-dish\"></i>',
  '<i class="fa-solid fa-water"></i>': '<i class=\"fa-solid fa-water\"></i>',
  '<i class="fa-solid fa-moon"></i>': '<i class=\"fa-solid fa-moon\"></i>',
  '<i class="fa-solid fa-paperclip"></i>': '<i class=\"fa-solid fa-paperclip\"></i>',
  '<i class="fa-solid fa-box"></i>': '<i class=\"fa-solid fa-box\"></i>',
  '<i class="fa-solid fa-handshake"></i>': '<i class=\"fa-solid fa-handshake\"></i>', // changed from hand-wave (pro uses hand-wave, handshake is safer)
  '<i class="fa-solid fa-cake-candles"></i>': '<i class=\"fa-solid fa-cake-candles\"></i>',
  '<i class="fa-solid fa-envelope-open"></i>': '<i class=\"fa-solid fa-envelope-open\"></i>',
  '<i class="fa-solid fa-headphones"></i>': '<i class=\"fa-solid fa-headphones\"></i>',
  '<i class="fa-solid fa-phone"></i>': '<i class=\"fa-solid fa-phone\"></i>',
  '<i class="fa-solid fa-mobile-screen"></i>': '<i class=\"fa-solid fa-mobile-screen\"></i>',
  '<i class="fa-solid fa-location-dot"></i>': '<i class=\"fa-solid fa-location-dot\"></i>',
  '<i class="fa-solid fa-leaf"></i>': '<i class=\"fa-solid fa-leaf\"></i>',
  '<i class="fa-solid fa-file-pen"></i>': '<i class=\"fa-solid fa-file-pen\"></i>',
  '<i class="fa-solid fa-bolt"></i>': '<i class=\"fa-solid fa-bolt\"></i>',
  '<i class="fa-solid fa-clipboard"></i>': '<i class=\"fa-solid fa-clipboard\"></i>',
  '<i class="fa-solid fa-pencil"></i>': '<i class=\"fa-solid fa-pencil\"></i>',
  '<i class="fa-solid fa-receipt"></i>': '<i class=\"fa-solid fa-receipt\"></i>',
  '<i class="fa-solid fa-wrench"></i>': '<i class=\"fa-solid fa-wrench\"></i>',
  '<i class="fa-solid fa-sack-dollar"></i>': '<i class=\"fa-solid fa-sack-dollar\"></i>',
  '<i class="fa-solid fa-money-bill"></i>': '<i class=\"fa-solid fa-money-bill\"></i>',
  '<i class="fa-solid fa-user"></i>': '<i class=\"fa-solid fa-user\"></i>',
  '<i class="fa-solid fa-file-lines"></i>': '<i class=\"fa-solid fa-file-lines\"></i>',
  '<i class="fa-solid fa-rocket"></i>': '<i class=\"fa-solid fa-rocket\"></i>',
  '<i class="fa-solid fa-chart-line"></i>': '<i class=\"fa-solid fa-chart-line\"></i>',
  '<i class="fa-solid fa-chart-line-down"></i>': '<i class=\"fa-solid fa-chart-line-down\"></i>',
  '<i class="fa-solid fa-shield"></i>': '<i class=\"fa-solid fa-shield\"></i>',
  '<i class="fa-solid fa-magnifying-glass"></i>': '<i class=\"fa-solid fa-magnifying-glass\"></i>',
  '<i class="fa-solid fa-mobile"></i>': '<i class=\"fa-solid fa-mobile\"></i>',
  '<i class="fa-solid fa-lock"></i>': '<i class=\"fa-solid fa-lock\"></i>',
  '<i class="fa-solid fa-image"></i>': '<i class=\"fa-solid fa-image\"></i>',
  '<i class="fa-solid fa-link"></i>': '<i class=\"fa-solid fa-link\"></i>',
  '<i class="fa-solid fa-seedling"></i>': '<i class=\"fa-solid fa-seedling\"></i>',
  '<i class="fa-solid fa-medal" style="color:#b08d57"></i>': '<i class=\"fa-solid fa-medal\" style=\"color:#b08d57\"></i>',
  '<i class="fa-solid fa-medal" style="color:#c0c0c0"></i>': '<i class=\"fa-solid fa-medal\" style=\"color:#c0c0c0\"></i>',
  '<i class="fa-solid fa-medal" style="color:#ffd700"></i>': '<i class=\"fa-solid fa-medal\" style=\"color:#ffd700\"></i>',
  '<i class="fa-solid fa-crown"></i>': '<i class=\"fa-solid fa-crown\"></i>'
};

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'scratch') walk(p);
    } else if (p.endsWith('.js') || p.endsWith('.html')) {
      let content = fs.readFileSync(p, 'utf8');
      let changed = false;
      
      for (const [emoji, tag] of Object.entries(replacements)) {
        if (content.includes(emoji)) {
          content = content.split(emoji).join(tag);
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(p, content, 'utf8');
        console.log('Updated: ' + p);
      }
    }
  });
}
walk('.');
