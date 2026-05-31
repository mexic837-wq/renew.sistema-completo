const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/screens/dashboard.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix tab
const targetTab = `<button class="dash-tab" data-target="tab-leaderboard">\${t('dash_tab_rank')}</button>`;
const replacementTab = `\${((user.permisos && 'app_ranking' in user.permisos) ? user.permisos.app_ranking : true) ? \`<button class="dash-tab" data-target="tab-leaderboard">\${t('dash_tab_rank')}</button>\` : ''}`;

content = content.replace(targetTab, replacementTab);

// Fix button
const targetBtn = `<button onclick="document.querySelector('[data-target=\\'tab-leaderboard\\']').click()" style="background: var(--surface-alt); color: var(--text-primary); border: 1px solid var(--border); padding: 12px 24px; border-radius: 12px; font-weight: 600; transition: all 0.2s hover:bg-opacity-10 hover:scale-105; cursor: pointer;">
              <i class="fa-solid fa-trophy mr-2" style="color: #f59e0b;"></i> Leaderboard
            </button>`;
const replacementBtn = `\${((user.permisos && 'app_ranking' in user.permisos) ? user.permisos.app_ranking : true) ? \`<button onclick="document.querySelector('[data-target=\\\\'tab-leaderboard\\\\']').click()" style="background: var(--surface-alt); color: var(--text-primary); border: 1px solid var(--border); padding: 12px 24px; border-radius: 12px; font-weight: 600; transition: all 0.2s hover:bg-opacity-10 hover:scale-105; cursor: pointer;">
              <i class="fa-solid fa-trophy mr-2" style="color: #f59e0b;"></i> Leaderboard
            </button>\` : ''}`;

content = content.replace(targetBtn, replacementBtn);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed leaderboard ranking permissions in dashboard.js');
