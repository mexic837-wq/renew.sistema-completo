const fs = require('fs');

let calJs = fs.readFileSync('js/screens/calendar.js', 'utf8');

calJs = calJs.replace(
    /attendees:\s*\[\],/,
    "attendees: attendees,"
);

fs.writeFileSync('js/screens/calendar.js', calJs);
console.log('Fixed attendees array injection');
