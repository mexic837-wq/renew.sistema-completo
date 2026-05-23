const fs = require('fs');

const eventContentCode = `eventContent: function(arg) {
       const legacyColor = arg.event.backgroundColor || '#00f5d4';
       const deptos = arg.event.extendedProps?.departamentos || [];
       const colabs = arg.event.extendedProps?.colaboradores || [];
       
       let avatarsHtml = '';
       if (colabs && colabs.length > 0) {
           const maxAvatares = 3;
           const showColabs = colabs.slice(0, maxAvatares);
           const extraCount = colabs.length - maxAvatares;
           
           avatarsHtml = '<div style="display: flex; align-items: center; justify-content: flex-end; margin-top: auto; padding-top: 4px;">';
           showColabs.forEach(c => {
               const nameStr = (c && c.nombre) ? c.nombre : (typeof c === 'string' ? c : 'U');
               const initial = nameStr.charAt(0).toUpperCase();
               avatarsHtml += \`<div style="width: 22px; height: 22px; border-radius: 50%; background: #fff; color: #444; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; border: 1.5px solid #fff; margin-left: -6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 2;">\${initial}</div>\`;
           });
           if (extraCount > 0) {
               avatarsHtml += \`<div style="width: 22px; height: 22px; border-radius: 50%; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; border: 1.5px solid #fff; margin-left: -6px; z-index: 1;">+\${extraCount}</div>\`;
           }
           avatarsHtml += '</div>';
       }

       let baseColor = legacyColor;
       if (deptos.length > 0) {
           const colors = { 'Solar': '#84cc16', 'Home': '#fbbf24', 'Water': '#38bdf8' };
           const mapped = deptos.map(d => colors[d]).filter(Boolean);
           if (mapped.length > 0) baseColor = mapped[0];
       }

       const isLightMode = !document.documentElement.classList.contains('dark');
       const bgStyle = isLightMode ? \`background-color: \${baseColor}20;\` : \`background-color: \${baseColor}20;\`;
       const titleColor = isLightMode ? '#1e293b' : '#f8fafc';
       const timeColor = isLightMode ? '#64748b' : '#94a3b8';

       const isMonth = arg.view.type === 'dayGridMonth';
       const p = isMonth ? '2px 4px' : '6px 8px';
       const titleSize = isMonth ? '0.7rem' : '0.8rem';
       
       const timeText = arg.timeText ? \`<div style="font-size: 0.7rem; color: \${timeColor}; font-weight: 600; margin-bottom: 2px;">\${arg.timeText}</div>\` : '';
       
       let html = \`
         <div style="\${bgStyle} border-left: 4px solid \${baseColor}; border-radius: 8px; padding: \${p}; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;">
            <div style="font-size: \${titleSize}; font-weight: 800; color: \${titleColor}; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; margin-bottom: 2px;">\${arg.event.title}</div>
            \${timeText}
            \${avatarsHtml}
         </div>
       \`;
       return { html: html };
    },`;

function replaceEventContent(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Buscar eventContent: function(arg) { ... }
    const regex = /eventContent\s*:\s*function\s*\(\w+\)\s*\{[\s\S]*?return\s*\{\s*html\s*:\s*[^}]*\}\s*;\s*\}/g;
    
    if (regex.test(content)) {
        content = content.replace(regex, eventContentCode.replace(/,\s*$/, ''));
        fs.writeFileSync(filePath, content);
        console.log('Replaced in', filePath);
    } else {
        console.log('Not found in', filePath);
    }
}

replaceEventContent('js/admin-app.js');
replaceEventContent('js/screens/calendar.js');
