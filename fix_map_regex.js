const fs = require('fs');
let mapaJs = fs.readFileSync('js/screens/mapa.js', 'utf8');

const regex = /const myClients = allClients\.filter\(c =>[\s\S]*?userClientIds\.has\(c\.id\)[\s\S]*?\);/;

const replacement = `const userRole = (user.rol || '').toLowerCase();
      const isAdmin = ['admin', 'administrador', 'ceo', 'desenvolvedor', 'master'].includes(userRole);

      const myClients = isAdmin ? allClients : allClients.filter(c =>
        c.vendedor_asignado_id === user.id ||
        c.creador_id === user.id ||
        userClientIds.has(c.id)
      );`;

mapaJs = mapaJs.replace(regex, replacement);
fs.writeFileSync('js/screens/mapa.js', mapaJs);

console.log("Fixed map logic using regex");
