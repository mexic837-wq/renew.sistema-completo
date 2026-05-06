const fs = require('fs');
const path = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js';
let content = fs.readFileSync(path, 'utf8');

// Find the open if (saveAcademiaBtn) and close it at the end of the academia view block
// The academia view block ends at line 3877 with a } before else if (state.activeView === 'inventario')

const searchPattern = `        acaTipoSelect.addEventListener('change', () => {
          thumbWrapCont.style.display = (acaTipoSelect.value === 'Video de Entrenamiento') ? 'block' : 'none';
        });
     }

  }`;

const replacementPattern = `        acaTipoSelect.addEventListener('change', () => {
          thumbWrapCont.style.display = (acaTipoSelect.value === 'Video de Entrenamiento') ? 'block' : 'none';
        });
     }
    } // Closing if (saveAcademiaBtn)

  }`;

if (content.includes(searchPattern)) {
    content = content.replace(searchPattern, replacementPattern);
    fs.writeFileSync(path, content);
    console.log('✅ Syntax error fixed (added missing closing brace)');
} else {
    // Try a more flexible regex if the exact string fails
    const regex = /acaTipoSelect\.addEventListener\('change', \(\) => \{\s*thumbWrapCont\.style\.display = \(acaTipoSelect\.value === 'Video de Entrenamiento'\) \? 'block' : 'none';\s*\}\);\s*\}\s*(\r?\n\s*)\}/;
    if (regex.test(content)) {
        content = content.replace(regex, (match, p1) => {
             return match.replace(/(\s*)\}/, `$1} } // Closing if (saveAcademiaBtn)`);
        });
        fs.writeFileSync(path, content);
        console.log('✅ Syntax error fixed with regex');
    } else {
        console.log('❌ Could not find location to fix syntax error');
    }
}
