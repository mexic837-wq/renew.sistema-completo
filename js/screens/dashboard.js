/* ============================================================
   RENEW SOLAR \u2013 screens/dashboard.js
   ============================================================ */
import { getDealsByUser, STAGE_CONFIG, formatDate, getAdminWorkers, getDB, getDeptArray, getCurrentUser, logout, isProjectFinished, getProjectDate } from '../api.js';
import { showToast } from '../components/toast.js';
// Removed import from ../app.js to break circular dependency

import { t } from '../i18n.js';
import { initAdminBell, updateAdminBellBadge } from '../components/admin-notif-bell.js';


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ════════════════════════════════════════════════════════════
//  RANK SYSTEM — Renew Water (add more pipelines later)
//  type: 'total' = all-time accumulated sales
//        'monthly' = current month only (resets 1st of each month)
//
//  <i class="fa-solid fa-triangle-exclamation text-orange-500"></i>   UPDATE: Change 'minSales' for Iniciante and Junior once
//               the user provides those numbers.
// ════════════════════════════════════════════════════════════
// ========================================================================================================================
export const RANK_CONFIG = {
  'Renew Water': [
    { name: 'Nuevo', emoji: '<i class="fa-solid fa-seedling"></i>', color: '#5eead4', bg: 'rgba(94,234,212,0.1)',  border: 'rgba(94,234,212,0.25)', minSales: 0,  type: 'total', priceKey: 'precio_subvende' },
    { name: 'Novato',         emoji: '<i class="fa-solid fa-medal" style="color:#b08d57"></i>', color: '#2dd4bf', bg: 'rgba(45,212,191,0.1)',  border: 'rgba(45,212,191,0.25)', minSales: 3,  type: 'total', priceKey: 'precio_subvende' },
    { name: 'Iniciante',           emoji: '<i class="fa-solid fa-medal" style="color:#c0c0c0"></i>', color: '#0d9488', bg: 'rgba(13,148,136,0.1)', border: 'rgba(13,148,136,0.25)', minSales: 25, type: 'total', priceKey: 'precio_iniciante' },
    { name: 'Junior',              emoji: '<i class="fa-solid fa-medal" style="color:#ffd700"></i>', color: '#0284c7', bg: 'rgba(2,132,199,0.1)',  border: 'rgba(2,132,199,0.25)', minSales: 33, type: 'total', priceKey: 'precio_junior' },
    { name: 'Representante de Ventas',            emoji: '<i class="fa-solid fa-bolt"></i>',      color: '#1e40af', bg: 'rgba(30,64,175,0.1)',  border: 'rgba(30,64,175,0.25)', minSales: 53, type: 'total', priceKey: 'precio_vendedor' },
    { name: 'Distribuidor (Analista)', emoji: '<i class="fa-solid fa-crown"></i>', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', minSales: 73, type: 'total', priceKey: 'precio_analista' },
    { name: 'Distribuidor Mensual', emoji: '<i class="fa-solid fa-star"></i>',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', minSales: 15, type: 'monthly', priceKey: 'precio_oficina' },
  ]
};

export function computeUserRank(userId, activeUnit, db) {
  const ranks = RANK_CONFIG[activeUnit];
  if (!ranks) return null;

  const user = getCurrentUser();
  const dbUser = (db.Usuarios || []).find(u => String(u.id) === String(userId)) || user;
  
  if (dbUser && dbUser.rango && dbUser.rango !== 'auto' && dbUser.rango !== 'novato') {
    let targetRankName = '';
    if (dbUser.rango === 'referidos') targetRankName = 'Nuevo';
    else if (dbUser.rango === 'subvendedor') targetRankName = 'Novato';
    else if (dbUser.rango === 'iniciante') targetRankName = 'Iniciante';
    else if (dbUser.rango === 'junior') targetRankName = 'Junior';
    else if (dbUser.rango === 'representante') targetRankName = 'Representante de Ventas';
    else if (dbUser.rango === 'analista') targetRankName = 'Distribuidor (Analista)';
    else if (dbUser.rango === 'no_aplica') targetRankName = 'No Aplica';

    if (targetRankName === 'No Aplica') {
      return {
        cur: { name: 'No Aplica', emoji: '🚫', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.25)', minSales: 0, type: 'total', priceKey: null },
        next: null,
        progress: { count: 'N/A', total: 0, pct: 100 },
        isManual: true,
        isNoAplica: true,
        totalAT: 0,
        totalMonth: 0
      };
    }

    const manualRank = ranks.find(r => r.name === targetRankName);
    if (manualRank) {
      const idx = ranks.indexOf(manualRank);
      return {
        cur: manualRank,
        next: ranks[idx + 1] || null,
        progress: { count: 'N/A', total: manualRank.minSales, pct: 100 },
        isManual: true,
        totalAT: 0,
        totalMonth: 0
      };
    }
  }

  const pipeline   = (db.Admin_Pipelines || []).find(p => p.nombre === activeUnit);
  const myProjects = (db.Proyectos_Dinamicos || []).filter(p => {
    if (pipeline && p.pipeline_id !== pipeline.id) return false;
    if (!isProjectFinished(p, db)) return false;
    
    // A project belongs to the user if they are the responsable OR the assigned vendor in the client record
    const isResponsable = (p.responsable_id || '').split(',').map(id=>id.trim()).includes(String(userId)) || (p.asignado_a === userId) || (Array.isArray(p.colaboradores) && p.colaboradores.some(c => c.id === userId));
    if (isResponsable) return true;
    
    const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(p.cliente_id));
    if (cli) {
      const isVendor = (cli.vendedor_asignado_id || '').split(',').map(id=>id.trim()).includes(String(userId));
      return isVendor;
    }
    return false;
  });

  const now        = new Date();
  const curMonth   = now.getMonth();
  const curYear    = now.getFullYear();
  const totalAT    = myProjects.length;
  const totalMonth = myProjects.filter(p => {
    const dateToUse = p.fecha_cierre || p.fecha;
    if (!dateToUse) return false;
    let dStr = String(dateToUse).trim();
    if (dStr.includes(' ') && !dStr.includes('T')) dStr = dStr.replace(' ', 'T');
    if (!dStr.includes('T')) dStr += 'T12:00:00';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return false;
    return d.getMonth() === curMonth && d.getFullYear() === curYear;
  }).length;

  // Scan from lowest → highest, keep last qualifying rank
  let rankIdx = 0;
  for (let i = 0; i < ranks.length; i++) {
    const count = ranks[i].type === 'monthly' ? totalMonth : totalAT;
    if (count >= ranks[i].minSales) rankIdx = i;
  }

  const cur  = ranks[rankIdx];
  const next = ranks[rankIdx + 1] || null;

  let progress = 100, remaining = 0;
  if (next) {
    const myCount = next.type === 'monthly' ? totalMonth : totalAT;
    remaining = Math.max(0, next.minSales - myCount);
    progress  = Math.min(100, Math.round((myCount / next.minSales) * 100));
  }

  return { cur, next, rankIdx, totalRanks: ranks.length, totalAT, totalMonth, progress, remaining, isMax: !next };
}

function buildRankBannerHTML(rd, barId = 'rank-prog-bar') {
  const { cur, totalAT, totalMonth, isNoAplica } = rd;
  const displayCount = (cur.type === 'monthly' ? totalMonth : totalAT) || 0;
  const displayLabel = cur.type === 'monthly' ? 'ventas este mes' : 'ventas totales';

  if (isNoAplica) {
    return `
      <div style="background:rgba(156,163,175,0.1); border:1px solid rgba(156,163,175,0.25); border-radius:14px; padding:16px; text-align:center; margin-bottom:16px;">
        <span style="font-size:1.2rem; display:block; margin-bottom:6px;">🚫</span>
        <span style="font-size:.75rem; font-weight:900; color:#9ca3af; letter-spacing:-.2px;">SIN LISTA DE PRECIOS ASIGNADA</span>
        <div style="margin-top:6px; font-size:.58rem; color:var(--text-muted); font-style:italic;">
           No tienes una lista de precios asignada o configurada.
        </div>
      </div>
    `;
  }

  const progressSection = `
    <div style="background:linear-gradient(135deg,rgba(168,85,247,.15),rgba(0,245,212,.08));border:1px solid rgba(168,85,247,.3);border-radius:14px;padding:12px 14px;text-align:center;">
      <span style="font-size:.75rem;font-weight:900;color:#a855f7;letter-spacing:-.2px;">🎉 ¡SIGUE ASÍ, EXCELENTE TRABAJO!</span>
      <div style="margin-top:6px; font-size:.58rem; color:var(--text-muted); font-style:italic;">
        Has logrado ${displayCount} ${displayLabel}. ¡Sigue transformando vidas con Renew!
      </div>
    </div>
  `;

  return `
    <style id="rank-anim-css">
      @keyframes rankSlideIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
      @keyframes rankGlow { 0%,100%{box-shadow:0 0 0 0 ${cur.color}35} 50%{box-shadow:0 0 0 7px transparent} }
    </style>
    <div style="
      background:linear-gradient(135deg,${cur.bg},rgba(255,255,255,.01));
      border:1.5px solid ${cur.border};border-radius:20px;padding:16px 18px;
      margin-bottom:16px;position:relative;overflow:hidden;
      animation:rankSlideIn .5s cubic-bezier(.34,1.56,.64,1) both;
    ">
      <!-- ambient glow -->
      <div style="position:absolute;top:-28px;right:-14px;width:96px;height:96px;border-radius:50%;background:${cur.color};opacity:.06;filter:blur(28px);pointer-events:none;"></div>

      <!-- Header row -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="
          width:46px;height:46px;border-radius:14px;
          background:${cur.bg};border:1.5px solid ${cur.border};
          display:flex;align-items:center;justify-content:center;font-size:1.3rem;
          flex-shrink:0;animation:rankGlow 2.5s ease-in-out infinite;
        ">${cur.emoji}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.57rem;font-weight:900;color:${cur.color};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:1px;">Tu Rango / Lista de Precios</div>
          <div style="font-size:1.15rem;font-weight:900;color:var(--text-primary);letter-spacing:-.3px;">${cur.name}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:1.75rem;font-weight:900;color:${cur.color};line-height:1;">${displayCount}</div>
          <div style="font-size:.52rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;">${displayLabel}</div>
        </div>
      </div>

      ${progressSection}
    </div>
  `;
}

export async function renderDashboard() {
  const user = getCurrentUser();
  const screen = document.getElementById('screen-dashboard');
  let activeUnit = localStorage.getItem('active_unit') || 'Renew Solar';

  const isCC = user && user.rol && user.rol.toLowerCase().includes('call');

  // —— Destroy old charts ——————————————————————————————————\u2014
  if (window.rendimientoChartInstance?.destroy) { window.rendimientoChartInstance.destroy(); window.rendimientoChartInstance = null; }
  if (window.leaderboardChartInstance?.destroy) { window.leaderboardChartInstance.destroy(); window.leaderboardChartInstance = null; }

  screen.innerHTML = `
    <style>
      /* —— Pipeline chip selector —— */
      /* —— Pipeline chip selector —— */
      .pip-chips-row {
        display: flex; gap: 10px; padding: 0 16px;
        overflow-x: auto; scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch; scrollbar-width: none;
        justify-content: center;
      }
      .pip-chips-row::-webkit-scrollbar { display: none; }
      .pip-chip {
        flex-shrink: 0; scroll-snap-align: start;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 4px;
        padding: 8px 12px 6px;
        border-radius: 14px;
        border: 1.5px solid var(--border);
        background: var(--surface);
        cursor: pointer; min-width: 96px;
        transition: all 0.18s ease;
        position: relative; overflow: hidden;
      }
      .pip-chip.active {
        border-color: var(--pip-accent);
        background: color-mix(in srgb, var(--pip-accent) 10%, var(--surface));
        box-shadow: 0 4px 16px color-mix(in srgb, var(--pip-accent) 22%, transparent);
      }
      .pip-chip-logo {
        /* natural landscape logo “ let width fill the chip, control height */
        width: 72px; height: auto; max-height: 28px; object-fit: contain;
        filter: drop-shadow(0 1px 3px rgba(0,0,0,0.25));
      }
      .pip-chip-badge {
        font-size: 0.55rem; font-weight: 800; color: var(--text-muted);
        text-transform: uppercase; letter-spacing: 0.5px;
      }
      .pip-chip.active .pip-chip-badge { color: var(--pip-accent); }
      /* —— Tool list (Academia-style full-width rectangles) —— */
      @keyframes toolIn {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .tool-list { display: flex; flex-direction: column; gap: 20px; padding: 14px 16px 100px; }
      .tool-row {
        position: relative; overflow: hidden;
        min-height: 90px; height: auto !important;
        margin-bottom: 4px;
        border-radius: 20px;
        border: 1px solid var(--border);
        cursor: pointer;
        display: flex; align-items: center;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        animation: toolIn 0.35s ease both;
        background-size: cover; background-position: center;
      }
      .tool-row:active { transform: scale(0.98); }
      .tool-row:hover  { box-shadow: 0 8px 28px rgba(0,0,0,0.35); }
      .tool-row-overlay {
        position: absolute; inset: 0;
        background: linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.18) 100%);
      }
      .tool-row-body {
        position: relative; padding: 12px 16px;
        display: flex; align-items: center; gap: 12px;
        width: 100%;
      }
      .tool-row-icon {
        width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 1rem;
      }
      .tool-row-text { display: flex; flex-direction: column; }
      .tool-row-tag {
        font-size: 0.5rem; font-weight: 900; letter-spacing: 1.8px;
        text-transform: uppercase; color: var(--primary); margin-bottom: 2px;
      }
      .tool-row-name {
        font-size: 1rem; font-weight: 950; color: #fff;
        text-transform: uppercase; letter-spacing: -0.3px; line-height: 1;
      }
      body:not(.dark-theme) .tool-row-name { color: #0f172a; }
      body:not(.dark-theme) .tool-row-tag { color: rgba(0,0,0,0.6); }
      body:not(.dark-theme) .tool-row-overlay {
        background: linear-gradient(to right, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.1) 100%);
      }

      /* Tool colors variables */
      :root {
        --bg-tool-credito: linear-gradient(135deg, #f0f7ff, #e0f2fe);
        --bg-tool-trabajo: linear-gradient(135deg, #f0fdf4, #dcfce7);
        --bg-tool-inventario: linear-gradient(135deg, #fffbeb, #fef3c7);
        --bg-tool-clientes: linear-gradient(135deg, #fff7ed, #ffedd5);
        --bg-tool-calendario: linear-gradient(135deg, #f0fdfa, #ccfbf1);
        --bg-tool-admin: linear-gradient(135deg, #fff1f2, #ffe4e6);
        --bg-tool-callcenter: linear-gradient(135deg, #e6fffa, #ccfbf1);
        --bg-tool-default: linear-gradient(135deg, #f8fafc, #f1f5f9);
      }
      body.dark-theme {
        --bg-tool-credito: linear-gradient(135deg, #0f172a, #1e3a5f);
        --bg-tool-trabajo: linear-gradient(135deg, #0f1f1e, #063e38);
        --bg-tool-inventario: linear-gradient(135deg, #0f172a, #1e1b4b);
        --bg-tool-clientes: linear-gradient(135deg, #1a1200, #3d2e00);
        --bg-tool-calendario: linear-gradient(135deg, #001a0f, #003d1f);
        --bg-tool-admin: linear-gradient(135deg, #1a0a00, #3d1500);
        --bg-tool-callcenter: linear-gradient(135deg, #00302b, #004d40);
        --bg-tool-default: linear-gradient(135deg, #0f172a, #1e293b);
      }

      /* —— Desktop Proportions —— */
      @media (min-width: 768px) {
        .pip-chips-row {
          gap: 16px;
          margin: 10px 0 24px !important;
        }
        .pip-chip {
          min-width: 150px;
          padding: 14px 24px 12px;
          gap: 10px;
          border-radius: 20px;
          border-width: 2px;
        }
        .pip-chip-logo {
          width: 100px;
          max-height: 40px;
        }
        .pip-chip-badge {
          font-size: 0.7rem;
          letter-spacing: 0.8px;
        }
      }
    </style>

    <div class="dash-header" style="padding-bottom: 12px;">
      <div class="dash-header-top">
        <div class="dash-greeting">
          <div class="greeting-time">${getGreeting()}</div>
          <h1 class="text-xl font-black tracking-tight">Hola, ${user.nombre.split(' ')[0]} <i class="fa-solid fa-handshake"></i></h1>
        </div>

        <div class="flex items-center gap-4">
          <button id="btn-app-bell" title="Notificaciones Admin"
            class="relative w-10 h-10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-tealAccent transition-all active:scale-90 !bg-transparent !border-none !shadow-none">
            <i class="fa-solid fa-bell text-xl"></i>
            <span id="app-bell-badge" class="hidden absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-[#0b1120] animate-pulse"></span>
          </button>

          <button id="btn-chat-mobile" onclick="window.openInternalChat && window.openInternalChat()" 
            class="relative w-10 h-10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-tealAccent transition-all active:scale-90 !bg-transparent !border-none !shadow-none">
            <i class="fa-solid fa-comment-dots text-xl"></i>
            <span id="chat-badge-mobile" class="absolute -top-1 -right-1 bg-tealAccent text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-[#0b1120] ${window._unreadChatCount > 0 ? '' : 'hidden'}">${window._unreadChatCount || 0}</span>
          </button>
          
          <button class="avatar-btn" id="avatar-btn" aria-label="Perfil"
            style="${user.foto ? `background-image:url(${user.foto});background-size:cover;background-position:center;color:transparent;border:2px solid rgba(255,255,255,0.15)` : ''}">
            ${user.foto ? '' : (user.initials || (user.nombre[0] + (user.apellido ? user.apellido[0] : ''))).toUpperCase()}
          </button>
        </div>
      </div>
    </div>

    <div id="pip-chips-row" class="pip-chips-row" style="margin: 8px 0 10px;"></div>

    <div class="dash-tabs-wrapper">
      <div class="dash-tabs-container">
        <button class="dash-tab active" data-target="tab-inicio">Inicio</button>
        <button class="dash-tab" data-target="tab-rendimiento">${t('dash_tab_perf')}</button>
        ${((user.permisos && 'app_ranking' in user.permisos) ? user.permisos.app_ranking : true) ? `<button class="dash-tab" data-target="tab-leaderboard">${t('dash_tab_rank')}</button>` : ''}
      </div>
    </div>

    <div id="tab-inicio" class="dash-tab-content">
      <div id="dash-tools-grid" class="tool-list mobile-only"></div>
      
      <!-- DESKTOP WELCOME PRESENTATION -->
      <div class="desktop-only w-full">
        <div class="flex flex-col items-center justify-center text-center w-full" style="padding: 60px 20px; background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,245,212,0.02) 100%); border-radius: 32px; border: 1px solid rgba(255,255,255,0.05); margin-top: 20px; min-height: 400px; box-shadow: inset 0 0 40px rgba(0,0,0,0.2);">
          <div style="position: relative; margin-bottom: 30px;">
            <div style="position: absolute; inset: -20px; background: radial-gradient(circle, rgba(0,245,212,0.15) 0%, transparent 70%); border-radius: 50%; filter: blur(20px);"></div>
            <img src="assets/images/renew copia logo.png" alt="Equipo Renew" style="width: 130px; position: relative; z-index: 10; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.3));">
          </div>
          <h2 style="font-size: 2.2rem; font-weight: 900; color: var(--text-primary); margin-bottom: 16px; letter-spacing: -0.5px;">Bienvenido al <span style="color: #00f5d4;">Portal de Ventas</span></h2>
          <p style="color: var(--text-secondary); max-width: 550px; font-size: 1.15rem; line-height: 1.6; margin-bottom: 30px;">El centro de operaciones del Equipo Renew para llevar tu rendimiento al siguiente nivel. Selecciona una herramienta del menú lateral para comenzar tu jornada.</p>
          
          <div class="flex gap-4" style="justify-content: center;">
            <button onclick="document.querySelector('[data-target=\\'tab-rendimiento\\']').click()" style="background: rgba(0,245,212,0.1); color: #00f5d4; border: 1px solid rgba(0,245,212,0.3); padding: 12px 24px; border-radius: 12px; font-weight: 700; transition: all 0.2s hover:bg-opacity-20 hover:scale-105; cursor: pointer;">
              <i class="fa-solid fa-chart-line mr-2"></i> Ver Mi Rendimiento
            </button>
            <button onclick="document.querySelector('[data-target=\\'tab-leaderboard\\']').click()" style="background: var(--surface-alt); color: var(--text-primary); border: 1px solid var(--border); padding: 12px 24px; border-radius: 12px; font-weight: 600; transition: all 0.2s hover:bg-opacity-10 hover:scale-105; cursor: pointer;">
              <i class="fa-solid fa-trophy mr-2" style="color: #f59e0b;"></i> Leaderboard
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="desktop-dashboard-wrapper" style="padding:0 20px;">
      <div id="tab-rendimiento" class="dash-tab-content" style="display:none; padding:0 0 24px;">
        <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:16px; margin-top:8px;">${t('dash_month_perf')}</h3>
        <div style="background:rgba(255,255,255,0.03); backdrop-filter:blur(10px); padding:20px; border-radius:24px; border:1px solid rgba(255,255,255,0.08); box-shadow:var(--shadow-lg);">
          <canvas id="rendimientoChart" height="220"></canvas>
        </div>
        <div id="rendimiento-quick-stats" style="margin-top:24px;"></div>
        <div id="rank-banner-rendimiento" style="margin-top:20px;"></div>
      </div>

      <div id="tab-leaderboard" class="dash-tab-content" style="display:none; padding:0 0 24px;">
        <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:12px; margin-top:8px;">${t('dash_top_sellers')}</h3>
        <div style="background:var(--surface-alt); padding:16px; border-radius:16px; border:1px solid var(--border); box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <canvas id="leaderboardChart" height="240"></canvas>
      </div>
    </div>
  `;

  document.getElementById('avatar-btn').addEventListener('click', showProfileModal);

  // Init admin bell (re-init each time dashboard renders so bell button is fresh)
  initAdminBell();

  _buildPipelineChips(user, activeUnit);
  _renderToolsForPipeline(user, activeUnit);

  const tabs     = document.querySelectorAll('.dash-tab');
  const contents = document.querySelectorAll('.dash-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      const id = tab.dataset.target;
      document.getElementById(id).style.display = 'block';
      if (id === 'tab-rendimiento' && !window.rendimientoChartInstance) initRendimientoChart(user);
      if (id === 'tab-leaderboard' && !window.leaderboardChartInstance) initLeaderboardChart(user);
    });
  });
}

const PIPE_META = {
  'Renew Solar': { img: 'assets/images/2.png', accent: '#f4c430' },
  'Renew Water': { img: 'assets/images/1.png', accent: '#22c55e' },
  'Renew Home':  { img: 'assets/images/3.png', accent: '#a3d96b' },
};

function _buildPipelineChips(user, activeUnit) {
  const row = document.getElementById('pip-chips-row');
  if (!row) return;

  const db = getDB();
  const allPipelines = db.Admin_Pipelines || [];
  const allClientes  = db.Clientes_Maestro || [];
  const allProyectos = db.Proyectos_Dinamicos || [];
  const userRole     = (user.rol || '').toLowerCase().trim();
  const isHighRole   = ['admin', 'administrador', 'ceo', 'manager'].includes(userRole);

  const pipelineNames = ['Renew Solar', 'Renew Water', 'Renew Home'];
  
  row.innerHTML = pipelineNames.map(pipName => {
    const meta    = PIPE_META[pipName] || { img: '', accent: 'var(--primary)' };
    const isActive= pipName === activeUnit;

    const myClients = allClientes.filter(c => {
      if (!isHighRole) {
        // Ownership check (Strict for everyone)
        const isTecnicoOfProject = allProyectos.some(p => {
          if (p.cliente_id !== c.id || p.tecnico_id !== user.id) return false;
          const fase = (db.Admin_Fases || []).find(f => f.id === p.fase_id);
          if (!fase) return false;
          const rolFase = (fase.rol_encargado || '').toLowerCase();
          return rolFase.includes('tecnico') || rolFase.includes('técnico');
        });

        // Supervisor logic
        const isSupervisorOfRep = (userRole === 'supervisor' || userRole === 'supervisión') && 
          (user.equipo_ids || []).some(id => 
            c.creador_id === id || 
            (c.responsable_id || '').split(',').map(x=>x.trim()).includes(String(id)) || 
            (c.vendedor_asignado_id || '').split(',').map(x=>x.trim()).includes(String(id))
          );

        if (c.creador_id !== user.id && 
            !(c.responsable_id || '').split(',').map(id=>id.trim()).includes(String(user.id)) && 
            !(c.vendedor_asignado_id || '').split(',').map(id=>id.trim()).includes(String(user.id)) &&
            c.tecnico_id !== user.id &&
            !isTecnicoOfProject &&
            !isSupervisorOfRep) return false;
      }
      const cDepts = getDeptArray(c).map(d => d.toLowerCase());
      const pipShort = pipName.replace('Renew ','').toLowerCase();
      return cDepts.some(d => d === pipShort || d === pipName.toLowerCase() || pipName.toLowerCase().includes(d));
    });
    const prospectos = myClients.filter(c => !allProyectos.some(p => p.cliente_id === c.id)).length;
    const clientes   = myClients.filter(c =>  allProyectos.some(p => p.cliente_id === c.id)).length;
    const total      = prospectos + clientes;

    const hasAccess = isHighRole || (user.unidades && user.unidades.includes(pipName));
    const disabledStyle = hasAccess ? '' : 'filter: grayscale(1); opacity: 0.4; cursor: not-allowed; border-color: rgba(255,255,255,0.05);';

    return `
      <div class="pip-chip ${isActive ? 'active' : ''}" data-pip="${pipName}" data-access="${hasAccess}"
        style="--pip-accent:${meta.accent}; ${disabledStyle}">
        ${meta.img
          ? `<img class="pip-chip-logo" src="${meta.img}" alt="${pipName}">`
          : `<span style="font-weight:900;font-size:0.85rem;color:${meta.accent}">${pipName.replace('Renew ','')}</span>`
        }
        <span class="pip-chip-badge">${hasAccess ? `${total} ${total === 1 ? 'contacto' : 'contactos'}` : 'Sin acceso'}</span>
      </div>
    `;
  }).join('');

  row.querySelectorAll('.pip-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const hasAccess = chip.dataset.access === 'true';
      if (!hasAccess) {
          showToast('No tienes acceso autorizado para esta unidad.', 'error');
          return;
      }
      const pip = chip.dataset.pip;
      localStorage.setItem('active_unit', pip);
      row.querySelectorAll('.pip-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      // Destroy and nullify both chart instances to force re-render on next tab switch
      if (window.rendimientoChartInstance) {
        if (typeof window.rendimientoChartInstance.destroy === 'function') window.rendimientoChartInstance.destroy();
        window.rendimientoChartInstance = null;
      }
      if (window.leaderboardChartInstance) {
        if (typeof window.leaderboardChartInstance.destroy === 'function') window.leaderboardChartInstance.destroy();
        window.leaderboardChartInstance = null;
      }
    });
  });

  const remainingHTML = `
    <div id="tab-inicio" class="dash-tab-content">
      <div id="dash-tools-grid" class="tool-list mobile-only"></div>
      
      <!-- DESKTOP WELCOME PRESENTATION -->
      <div class="desktop-only w-full">
        <div class="flex flex-col items-center justify-center text-center w-full" style="padding: 60px 20px; background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,245,212,0.02) 100%); border-radius: 32px; border: 1px solid rgba(255,255,255,0.05); margin-top: 20px; min-height: 400px; box-shadow: inset 0 0 40px rgba(0,0,0,0.2);">
          <div style="position: relative; margin-bottom: 30px;">
            <div style="position: absolute; inset: -20px; background: radial-gradient(circle, rgba(0,245,212,0.15) 0%, transparent 70%); border-radius: 50%; filter: blur(20px);"></div>
            <img src="assets/images/renew copia logo.png" alt="Equipo Renew" style="width: 130px; position: relative; z-index: 10; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.3));">
          </div>
          <h2 style="font-size: 2.2rem; font-weight: 900; color: var(--text-primary); margin-bottom: 16px; letter-spacing: -0.5px;">Bienvenido al <span style="color: #00f5d4;">Portal de Ventas</span></h2>
          <p style="color: var(--text-secondary); max-width: 550px; font-size: 1.15rem; line-height: 1.6; margin-bottom: 30px;">El centro de operaciones del Equipo Renew para llevar tu rendimiento al siguiente nivel. Selecciona una herramienta del menú lateral para comenzar tu jornada.</p>
          
          <div class="flex gap-4" style="justify-content: center;">
            <button onclick="document.querySelector('[data-target=\\'tab-rendimiento\\']').click()" style="background: rgba(0,245,212,0.1); color: #00f5d4; border: 1px solid rgba(0,245,212,0.3); padding: 12px 24px; border-radius: 12px; font-weight: 700; transition: all 0.2s hover:bg-opacity-20 hover:scale-105; cursor: pointer;">
              <i class="fa-solid fa-chart-line mr-2"></i> Ver Mi Rendimiento
            </button>
            <button onclick="document.querySelector('[data-target=\\'tab-leaderboard\\']').click()" style="background: var(--surface-alt); color: var(--text-primary); border: 1px solid var(--border); padding: 12px 24px; border-radius: 12px; font-weight: 600; transition: all 0.2s hover:bg-opacity-10 hover:scale-105; cursor: pointer;">
              <i class="fa-solid fa-trophy mr-2" style="color: #f59e0b;"></i> Leaderboard
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="desktop-dashboard-wrapper" style="padding:0 20px;">
      <div id="tab-rendimiento" class="dash-tab-content" style="display:none; padding:0 0 24px;">
        <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:16px; margin-top:8px;">${t('dash_month_perf')}</h3>
        <div style="background:rgba(255,255,255,0.03); backdrop-filter:blur(10px); padding:20px; border-radius:24px; border:1px solid rgba(255,255,255,0.08); box-shadow:var(--shadow-lg);">
          <canvas id="rendimientoChart" height="220"></canvas>
        </div>
        <div id="rendimiento-quick-stats" style="margin-top:24px;"></div>
        <div id="rank-banner-rendimiento" style="margin-top:20px;"></div>
      </div>

      <div id="tab-leaderboard" class="dash-tab-content" style="display:none; padding:0 0 24px;">
        <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:12px; margin-top:8px;">${t('dash_top_sellers')}</h3>
        <div style="background:var(--surface-alt); padding:16px; border-radius:16px; border:1px solid var(--border); box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <canvas id="leaderboardChart" height="240"></canvas>
        </div>
      </div>
    </div>
  `;
  
  screen.innerHTML += remainingHTML;

  document.getElementById('avatar-btn').addEventListener('click', showProfileModal);

  // Init admin bell (re-init each time dashboard renders so bell button is fresh)
  initAdminBell();

  _buildPipelineChips(user, activeUnit);
  _renderToolsForPipeline(user, activeUnit);

  const tabs     = document.querySelectorAll('.dash-tab');
  const contents = document.querySelectorAll('.dash-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      const id = tab.dataset.target;
      document.getElementById(id).style.display = 'block';
      if (id === 'tab-rendimiento' && !window.rendimientoChartInstance) initRendimientoChart(user);
      if (id === 'tab-leaderboard' && !window.leaderboardChartInstance) initLeaderboardChart(user);
    });
  });
}

export function _renderToolsForPipeline(user, activeUnit) {
  const grid = document.getElementById('dash-tools-grid');
  // Note: grid may not exist when called from non-dashboard screens,
  // but we still want to populate the desktop sidebar, so we don't return early.

  const db          = getDB();
  const userRole    = (user.rol || '').toLowerCase().trim();
  const isTecnico   = /t[eé]cn[io]co/i.test(userRole);
  const isAdmin     = ['admin', 'administrador', 'desenvolvedor', 'ceo'].includes(userRole);
  const isVentas    = userRole.includes('vendedor') || userRole.includes('representante') || ['supervisor', 'supervisión', 'manager'].includes(userRole);
  let canInventory= [isTecnico, 'contabilidad','finanzas','procesador','ceo','admin','administrador','desarrollador','manager'].some(r => typeof r === 'boolean' ? r : r === userRole);
  if (user.permisos && 'app_inventario' in user.permisos) canInventory = user.permisos.app_inventario;

  const waterHighRoles = ['admin','administrador','desarrollador','ceo','supervisión','finanzas','contabilidad','procesador','manager'];
  let canWater = waterHighRoles.includes(userRole) || userRole.includes('call');
  if (!canWater && (isVentas || isTecnico)) {
    const waterPip = (db.Admin_Pipelines || []).find(p => (p.nombre||'').toLowerCase().includes('water'));
    const hasWaterUnit = (user.unidades || []).includes('Renew Water');
    if (waterPip) {
      canWater = hasWaterUnit || 
                 (user.pipeline_perms || []).includes(waterPip.id) ||
                 (db.Proyectos_Dinamicos || []).some(p => p.pipeline_id === waterPip.id && (p.vendedor_id === user.id || p.tecnico_id === user.id));
    } else {
      canWater = hasWaterUnit;
    }
  }

  const TOOLS = {
    'Renew Water': [
      ((user.permisos && 'app_callcenter' in user.permisos) ? user.permisos.app_callcenter : (['admin', 'administrador', 'ceo'].includes(userRole) || userRole.includes('call'))) ? {
        name: 'Gestión de Leads (Fase 1)', tag: 'Call Center',
        gradient: 'linear-gradient(90deg,#00f5d4,#00bbf9)',
        iconBg: 'rgba(0,245,212,0.12)', iconColor: '#00f5d4',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        action: () => window.appNavigate('call-center'), delay: '0s', screen: 'call-center'
      } : null,
      ((user.permisos && 'app_clientes' in user.permisos) ? user.permisos.app_clientes : (canWater || isTecnico || userRole === 'manager')) ? {
        name: isTecnico ? t('nav_clients_tech') : (userRole.includes('call') ? 'Mis Llamadas' : 'Mis Clientes'), tag: 'Renew Water',
        gradient: 'linear-gradient(90deg,#22c55e,#16a34a)',
        iconBg: 'rgba(34,197,94,0.12)', iconColor: '#22c55e',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        action: () => window.appNavigate('clients'), delay: '0s', screen: 'clients'
      } : null,
      ((user.permisos && 'app_plantillas' in user.permisos) ? user.permisos.app_plantillas : (canWater && !isTecnico)) ? {
        name: 'Plantillas', tag: 'Renew Water',
        gradient: 'linear-gradient(90deg,#2563eb,#0d9488)',
        iconBg: 'rgba(37,99,235,0.12)', iconColor: '#2563eb',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
        action: () => window.showPlantillasModal(), delay: '0s'
      } : null,
      canInventory ? {
        name: 'Inventario Real', tag: null,
        gradient: 'linear-gradient(90deg,#3b82f6,#6366f1)',
        iconBg: 'rgba(59,130,246,0.1)', iconColor: 'var(--info)',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
        action: () => window.appNavigate('inventory-tech'), delay: '0.12s', screen: 'inventory-tech'
      } : null,
      ((user.permisos && 'app_pagos' in user.permisos) ? user.permisos.app_pagos : (canWater || isTecnico)) ? {
        name: 'Mis Recibos de Pagos', tag: 'Renew Water',
        gradient: 'linear-gradient(90deg,#8b5cf6,#6366f1)',
        iconBg: 'rgba(139,92,246,0.12)', iconColor: '#8b5cf6',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
        action: () => window.appNavigate('mis-recibos'), delay: '0.15s', screen: 'mis-recibos'
      } : null,
      ((user.permisos && 'app_precios' in user.permisos) ? user.permisos.app_precios : (canWater && !isTecnico)) ? {
        name: 'Lista de Precios', tag: 'Renew Water',
        gradient: 'linear-gradient(90deg,#ec4899,#f43f5e)',
        iconBg: 'rgba(236,72,153,0.12)', iconColor: '#ec4899',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/></svg>`,
        action: () => window.appNavigate('lista-precios'), delay: '0.18s', screen: 'lista-precios'
      } : null,
    ],
    'Renew Solar': [
      ((user.permisos && 'app_callcenter' in user.permisos) ? user.permisos.app_callcenter : (['admin', 'administrador', 'ceo'].includes(userRole) || userRole.includes('call'))) ? {
        name: 'Gestión de Leads (Fase 1)', tag: 'Call Center',
        gradient: 'linear-gradient(90deg,#00f5d4,#00bbf9)',
        iconBg: 'rgba(0,245,212,0.12)', iconColor: '#00f5d4',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        action: () => window.appNavigate('call-center'), delay: '0s', screen: 'call-center'
      } : null,
      ((user.permisos && 'app_clientes' in user.permisos) ? user.permisos.app_clientes : (true || userRole === 'manager')) ? {
        name: isTecnico ? t('nav_clients_tech') : (userRole.includes('call') ? 'Mis Llamadas' : 'Mis Clientes'), tag: 'Renew Solar',
        gradient: 'linear-gradient(90deg,#f4c430,#f59e0b)',
        iconBg: 'rgba(244,196,48,0.12)', iconColor: '#f4c430',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        action: () => window.appNavigate('clients'), delay: '0s', screen: 'clients'
      } : null,
      ((user.permisos && 'app_plantillas' in user.permisos) ? user.permisos.app_plantillas : !isTecnico) ? {
        name: 'Plantillas', tag: 'Renew Solar',
        gradient: 'linear-gradient(90deg,#f4c430,#f59e0b)',
        iconBg: 'rgba(244,196,48,0.12)', iconColor: '#f4c430',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
        action: () => window.showPlantillasModal(), delay: '0s'
      } : null,
      canInventory ? {
        name: 'Inventario Real', tag: null,
        gradient: 'linear-gradient(90deg,#3b82f6,#6366f1)',
        iconBg: 'rgba(59,130,246,0.1)', iconColor: 'var(--info)',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
        action: () => window.appNavigate('inventory-tech'), delay: '0.06s', screen: 'inventory-tech'
      } : null,
      ((user.permisos && 'app_pagos' in user.permisos) ? user.permisos.app_pagos : true) ? {
        name: 'Mis Recibos de Pagos', tag: 'Renew Solar',
        gradient: 'linear-gradient(90deg,#f4c430,#f59e0b)',
        iconBg: 'rgba(244,196,48,0.12)', iconColor: '#f4c430',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
        action: () => window.appNavigate('mis-recibos'), delay: '0.15s', screen: 'mis-recibos'
      } : null,
    ],
    'Renew Home': [
      ((user.permisos && 'app_callcenter' in user.permisos) ? user.permisos.app_callcenter : (['admin', 'administrador', 'ceo'].includes(userRole) || userRole.includes('call'))) ? {
        name: 'Gestión de Leads (Fase 1)', tag: 'Call Center',
        gradient: 'linear-gradient(90deg,#00f5d4,#00bbf9)',
        iconBg: 'rgba(0,245,212,0.12)', iconColor: '#00f5d4',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        action: () => window.appNavigate('call-center'), delay: '0s', screen: 'call-center'
      } : null,
      ((user.permisos && 'app_clientes' in user.permisos) ? user.permisos.app_clientes : true) ? {
        name: isTecnico ? t('nav_clients_tech') : (userRole.includes('call') ? 'Mis Llamadas' : 'Mis Clientes'), tag: 'Renew Home',
        gradient: 'linear-gradient(90deg,#a3d96b,#84cc16)',
        iconBg: 'rgba(163,217,107,0.12)', iconColor: '#a3d96b',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        action: () => window.appNavigate('clients'), delay: '0s', screen: 'clients'
      } : null,
    ],
  };

  const commonTools = [
    ((user.permisos && 'app_mapa' in user.permisos) ? user.permisos.app_mapa : true) ? {
      name: 'Mi Mapa', tag: null,
      gradient: 'linear-gradient(90deg,#8b5cf6,#d946ef)',
      iconBg: 'rgba(139,92,246,0.1)', iconColor: '#a78bfa',
      icon: `<i class="fas fa-map-marked-alt"></i>`,
      action: () => window.appNavigate('mi-mapa'), delay: '0.19s', screen: 'mi-mapa'
    } : null,
    ((user.permisos && 'app_calendario' in user.permisos) ? user.permisos.app_calendario : true) ? {
      name: 'Calendario', tag: null,
      gradient: 'linear-gradient(90deg,#00ff88,#00d4ff)',
      iconBg: 'rgba(0,255,136,0.1)', iconColor: '#00ff88',
      icon: `<i class="fas fa-calendar-alt"></i>`,
      className: 'desktop-only',
      action: () => window.appNavigate('mi-calendario'), delay: '0.20s', screen: 'mi-calendario'
    } : null,
    {
      name: 'Mi Equipo', tag: null,
      gradient: 'linear-gradient(90deg,#f4c430,#f59e0b)',
      iconBg: 'rgba(244,196,48,0.12)', iconColor: '#f4c430',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      action: () => window.appNavigate('mi-equipo'), delay: '0.22s', screen: 'mi-equipo'
    },
    ((user.permisos && 'app_partners' in user.permisos) ? user.permisos.app_partners : (isAdmin || isVentas)) ? {
      name: 'Partners', tag: null,
      gradient: 'linear-gradient(90deg,#10b981,#059669)',
      iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10b981',
      icon: `<i class="fa-solid fa-handshake"></i>`,
      action: () => window.appNavigate('partners'), delay: '0.23s', screen: 'partners'
    } : null,
    ((user.permisos && 'app_os' in user.permisos) ? user.permisos.app_os : (isAdmin || userRole === 'manager')) ? {
      name: 'Renew OS (Admin)', tag: null,
      gradient: 'linear-gradient(90deg,#f59e0b,#ef4444)',
      iconBg: 'rgba(245,158,11,0.1)', iconColor: 'var(--warning)',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
      action: () => { window.location.href = 'admin.html'; }, delay: '0.24s'
    } : null,
    ((user.permisos && 'app_adelantos' in user.permisos) ? user.permisos.app_adelantos : !isAdmin) ? {
      name: 'Mis Adelantos', tag: 'RRHH',
      gradient: 'linear-gradient(90deg,#0ea5e9,#2563eb)',
      iconBg: 'rgba(14,165,233,0.12)', iconColor: '#0ea5e9',
      icon: `<i class="fa-solid fa-hand-holding-dollar"></i>`,
      action: () => window.appNavigate('mis-adelantos'), delay: '0.25s', screen: 'mis-adelantos'
    } : null
  ];

  const pipTools = (TOOLS[activeUnit] || TOOLS['Renew Solar']).filter(Boolean);
  const allTools = [...pipTools, ...commonTools.filter(Boolean)];

  const VARS = {
    'Plantillas':            'var(--bg-tool-credito)',
    'Inventario Real':       'var(--bg-tool-inventario)',
    'Mis Clientes':          'var(--bg-tool-clientes)',
    'Mis Llamadas':          'var(--bg-tool-clientes)',
    'Gestión de Leads (Fase 1)': 'var(--bg-tool-callcenter)',
    'Mi Mapa':               'var(--bg-tool-mapa)',
    'Calendario':         'var(--bg-tool-calendario)',
    'Renew OS (Admin)':      'var(--bg-tool-admin)',
    'Mis Adelantos':       'var(--bg-tool-credito)',
  };

  if (grid) {
    grid.innerHTML = allTools.map((tool, i) => `
      <div class="tool-row ${tool.className || ''}" id="tool-${i}"
        style="background: ${VARS[tool.name] || 'var(--bg-tool-default)'}; animation-delay:${tool.delay || `${i*0.07}s`};">
        <div class="tool-row-overlay"></div>
        <div style="position:absolute; top:0; left:0; right:0; height:2.5px; background:${tool.gradient};"></div>
        <div class="tool-row-body">
          <div class="tool-row-icon" style="background:${tool.iconBg}; color:${tool.iconColor};">
            ${tool.icon}
          </div>
          <div class="tool-row-text">
            ${tool.tag ? `<span class="tool-row-tag">${tool.tag}</span>` : ''}
            <span class="tool-row-name">${tool.name}</span>
          </div>
        </div>
      </div>
    `).join('');

    allTools.forEach((tool, i) => {
      const el = document.getElementById(`tool-${i}`);
      if (el && tool.action) el.addEventListener('click', tool.action);
    });
  }

  // Dynamically populate desktop sidebar
  const desktopContainer = document.getElementById('desktop-dynamic-tools');
  if (desktopContainer) {
    const desktopTools = allTools.filter(tool => tool.name !== 'Calendario');
    
    desktopContainer.innerHTML = desktopTools
      .map((tool, i) => `
      <a href="#" class="nav-item" id="desktop-tool-${i}" title="${tool.name}" data-screen="${tool.screen || ''}">
        <div style="width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
          ${tool.icon}
        </div>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${tool.name.replace(' (Admin)', '').replace('Gestión de Leads (Fase 1)', 'Leads').replace('Mis ', '').replace(' de Pagos', '').replace('Lista de ', '')}</span>
      </a>
    `).join('');

    desktopTools.forEach((tool, i) => {
      const btn = document.getElementById(`desktop-tool-${i}`);
      if (btn && tool.action) btn.addEventListener('click', (e) => {
        e.preventDefault();
        tool.action();
      });
    });
  }
}

function renderDeals(deals, user, screen, rankData = null) {
  const statsEl = document.getElementById('dash-stats');
  const listEl  = document.getElementById('deals-list');
  const countEl = document.getElementById('deals-count');

  const safeDeals = deals || [];
  const enProceso  = safeDeals.filter(d => d.etapa !== 'Completado').length;
  const completado = safeDeals.filter(d => d.etapa === 'Completado').length;

  statsEl.innerHTML = `
    <div class="stat-chip" style="background: rgba(59, 130, 246, 0.05) !important; border: 1px solid rgba(59, 130, 246, 0.15); box-shadow: 0 4px 15px rgba(59, 130, 246, 0.1);">
      <div class="stat-num" style="color: #3b82f6;">${safeDeals.length}</div>
      <div class="stat-label">Total</div>
    </div>
    <div class="stat-chip" style="background: rgba(0, 223, 191, 0.05) !important; border: 1px solid rgba(0, 223, 191, 0.15); box-shadow: 0 4px 15px rgba(0, 223, 191, 0.1);">
      <div class="stat-num" style="color: var(--primary);">${enProceso}</div>
      <div class="stat-label">En Proceso</div>
    </div>
    <div class="stat-chip" style="background: rgba(5, 213, 100, 0.05) !important; border: 1px solid rgba(5, 213, 100, 0.15); box-shadow: 0 4px 15px rgba(5, 213, 100, 0.1);">
      <div class="stat-num" style="color: #05d564;">${completado}</div>
      <div class="stat-label">Completados</div>
    </div>
  `;

  countEl.textContent = `${safeDeals.length} proyecto${safeDeals.length !== 1 ? 's' : ''}`;

  if (!safeDeals.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <h3>Sin proyectos a\u00FAn</h3>
        <p>Toca el bot\u00F3n <strong>+</strong> para registrar tu primer cliente.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = safeDeals.map(deal => {
    const cfg = STAGE_CONFIG[deal.etapa] || { label: deal.etapa, badge: 'badge-gray' };
    const accentMap = {
      'badge-blue': '#3b82f6', 'badge-purple': '#8b5cf6',
      'badge-green': '#059669', 'badge-teal': '#0d9488',
      'badge-orange': '#f59e0b', 'badge-gray': '#94a3b8',
      'badge-yellow': '#d97706', 'badge-red': '#ef4444',
    };
    const accent = accentMap[cfg.badge] || 'var(--primary)';
    
    const percentage = deal.total_fases > 0 
      ? Math.round((deal.fase_orden / deal.total_fases) * 100) 
      : 0;

    return `
      <div class="deal-card ${deal.is_locked || deal.etapa === 'Completado' ? 'deal-locked' : ''}" style="--card-accent:${accent}" data-id="${deal.id}" data-completed="${deal.etapa === 'Completado'}">
        <div class="deal-card-top">
          <div class="deal-client-name" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            ${deal.nombre_cliente}
            ${deal.is_locked ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="color:var(--text-muted)"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>` : ''}
            ${deal.tiene_problema ? `<span style="display:inline-flex; align-items:center; gap:3px; background:#fef2f2; color:#ef4444; padding:2px 6px; border-radius:8px; font-size:0.55rem; font-weight:800; text-transform:uppercase; border:1px solid #fecaca;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Problema</span>` : ''}
          </div>
          <span class="badge ${cfg.badge}">${cfg.label}</span>
        </div>
        
        <div class="deal-progress-wrap">
          <div class="deal-progress-info">
            <span style="display:flex; align-items:center; gap:4px">
              ${deal.etapa === 'Completado' ? `<span style="font-size:0.6rem; color:var(--text-muted); font-weight:700; text-transform:uppercase">\u2705 Proyecto cerrado</span>` : deal.is_locked ? `<span style="font-size:0.6rem; color:var(--text-muted); font-weight:700; text-transform:uppercase">Esperando a ${deal.rol_fase}</span>` : 'Progreso'}
            </span>
            <span class="deal-progress-percentage">${percentage}%</span>
          </div>
          <div class="deal-progress-bg">
            <div class="deal-progress-bar" style="width:${percentage}%; background:${accent}; opacity:${deal.is_locked ? '0.4' : '1'}"></div>
          </div>
        </div>

        <div class="deal-card-bottom">
          <div class="deal-date">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${formatDate(deal.fecha)}
          </div>
          <svg class="deal-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.deal-card').forEach(card => {
    card.addEventListener('click', () => {
      if (card.dataset.completed === 'true') {
        import('../components/toast.js').then(({showToast}) => {
          showToast('Este proyecto est\u00E1 cerrado y no admite m\u00E1s ediciones.', 'info');
        });
        return;
      }
      navigate('detail', card.dataset.id);
    });
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos d\u00EDas \u2600\uFE0F';
  if (h < 18) return 'Buenas tardes \uD83C\uDF24\uFE0F';
  return 'Buenas noches \uD83C\uDF19';
}

async function initRendimientoChart(user) {
  const ctx = document.getElementById('rendimientoChart');
  if (!ctx) return;
  
  const db = getDB();
  const allProjects = db.Proyectos_Dinamicos || [];
  const activeUnit = localStorage.getItem('active_unit') || 'Renew Solar';
  const pipeline = (db.Admin_Pipelines || []).find(pip => pip.nombre === activeUnit);
  
  const isTecnico = user && /t[eé]cn[io]co/i.test(user.rol || '');
  const userProjects = allProjects.filter(p => {
    const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(p.cliente_id)) || {};
    const isAssignedVendor = (cli.vendedor_asignado_id || '').split(',').map(id=>id.trim()).includes(String(user.id));
    const isCreator = (p.responsable_id || '').split(',').map(id=>id.trim()).includes(String(user.id));
    const isAssignedTech = isTecnico && String(p.tecnico_id) === String(user.id);

    return (isCreator || isAssignedVendor || isAssignedTech) && 
           (!pipeline || String(p.pipeline_id) === String(pipeline.id));
  });
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  const labels = [];
  const ventasMap = new Array(daysInMonth).fill(0);

  for (let i = 1; i <= daysInMonth; i++) {
    labels.push(i.toString());
  }

  let totalVentasMonth = 0;
  let closedMonth = 0;

  userProjects.forEach(p => {
    const isCompleted = isProjectFinished(p, db);
    const dateToUse = getProjectDate(p, db);
    let pDate = null;
    if (dateToUse) {
      let dStr = String(dateToUse).trim();
      if (dStr.includes(' ') && !dStr.includes('T')) dStr = dStr.replace(' ', 'T');
      if (!dStr.includes('T')) dStr += 'T12:00:00';
      const parsed = new Date(dStr);
      if (!isNaN(parsed.getTime())) pDate = parsed;
    }
    
    if (pDate && pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
      totalVentasMonth += 1;
      if (isCompleted) {
        closedMonth++;
      }
    }
  });

  const pendientes = totalVentasMonth - closedMonth;

  // Dynamically render Quick Stats below the graph
  const quickStatsEl = document.getElementById('rendimiento-quick-stats');
  if (quickStatsEl) {
    const currentMonthProjects = totalVentasMonth;
    const tasaDeCierre = currentMonthProjects > 0 ? Math.round((closedMonth / currentMonthProjects) * 100) : 0;
    const comisionesEstimadas = totalVentasMonth * 1000;
    
    if (isTecnico) {
      quickStatsEl.innerHTML = `
        <label style="font-size:.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:16px; margin-top: 10px;">ESTADÍSTICAS RÁPIDAS DEL MES</label>
        <div style="display:flex; gap:12px">
          <div style="flex:1; background:rgba(255,255,255,0.03); backdrop-filter: blur(10px); padding:20px; border-radius:20px; border:1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
            <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px; font-weight: 500;">Citas Asignadas</p>
            <p style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin:0">${totalVentasMonth}</p>
            <span style="font-size:0.65rem; color:var(--primary); font-weight:700; text-transform: uppercase;">Este Mes</span>
          </div>
          <div style="flex:1; background:rgba(255,255,255,0.03); backdrop-filter: blur(10px); padding:20px; border-radius:20px; border:1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
            <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px; font-weight: 500;">Citas Completadas</p>
            <p style="font-size:1.8rem; font-weight:800; color:#05d564; margin:0">${closedMonth}</p>
            <span style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform: uppercase;">Este Mes</span>
          </div>
        </div>
      `;
    } else {
      quickStatsEl.innerHTML = `
        <label style="font-size:.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:16px; margin-top: 10px;">ESTADÍSTICAS RÁPIDAS DEL MES</label>
        <div style="display:flex; gap:12px">
          <div style="flex:1; background:rgba(255,255,255,0.03); backdrop-filter: blur(10px); padding:20px; border-radius:20px; border:1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
            <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px; font-weight: 500;">Tasa de Cierre</p>
            <p style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin:0">${tasaDeCierre}%</p>
            <span style="font-size:0.65rem; color:var(--primary); font-weight:700; text-transform: uppercase;">Este Mes</span>
          </div>
          <div style="flex:1; background:rgba(255,255,255,0.03); backdrop-filter: blur(10px); padding:20px; border-radius:20px; border:1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
            <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px; font-weight: 500;">Comisiones Est.</p>
            <p style="font-size:1.8rem; font-weight:800; color:#3b82f6; margin:0">$${comisionesEstimadas.toLocaleString('en-US')}</p>
            <span style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform: uppercase;">Proyectadas</span>
          </div>
        </div>
      `;
    }
  }

  // —— Rank Banner in Rendimiento tab ———————————————————————————————
  const rankBannerRend = document.getElementById('rank-banner-rendimiento');
  const isCallCenter = user && (user.rol || '').toLowerCase().includes('call');
  if (rankBannerRend) {
    if (isTecnico || isCallCenter) {
      rankBannerRend.style.display = 'none';
    } else {
      const rankData = computeUserRank(user.id, activeUnit, db);
      if (rankData) {
        rankBannerRend.innerHTML = buildRankBannerHTML(rankData, 'rank-prog-bar-r');
        requestAnimationFrame(() => {
          setTimeout(() => {
            const bar = document.getElementById('rank-prog-bar-r');
            if (bar) bar.style.width = bar.dataset.w + '%';
          }, 120);
        });
      }
    }
  }

  window.rendimientoChartInstance = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: [isTecnico ? 'Completadas' : 'Ventas', isTecnico ? 'Pendientes' : 'En Proceso'],
      datasets: [
        {
          data: [closedMonth, pendientes],
          backgroundColor: ['#3b82f6', '#334155'],
          hoverBackgroundColor: ['#60a5fa', '#475569'],
          borderWidth: 0,
          hoverOffset: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      layout: {
        padding: 10
      },
      plugins: {
        legend: { 
          display: true,
          position: 'bottom',
          labels: { 
            color: document.body.classList.contains('dark-theme') ? '#e2e8f0' : '#64748b', 
            usePointStyle: true,
            pointStyle: 'circle',
            font: { family: 'Inter', size: 12, weight: '600' },
            padding: 20
          } 
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 13 },
          padding: 12,
          cornerRadius: 12,
          displayColors: true
        }
      }
    }
  });
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  CALL CENTER \u2014 Stats header
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function renderCCStats(user, screen) {
  let prospectos = [];
  try {
    const res = await fetch(`/api/cc-prospectos?operador_id=${encodeURIComponent(user.id)}`);
    if (res.ok) prospectos = await res.json();
  } catch(_) {}

  const now   = new Date();
  const thisM = now.getMonth();
  const thisY = now.getFullYear();

  const thisMonth = prospectos.filter(p => {
    const d = new Date(p.fecha_creacion || p.fecha_gestion || '');
    return d.getMonth() === thisM && d.getFullYear() === thisY;
  });

  const asignados = thisMonth.length;
  const aceptados = thisMonth.filter(p => p.estado === 'aceptado').length;
  const rechazados= thisMonth.filter(p => p.estado === 'rechazado').length;

  const statsEl = document.getElementById('dash-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-chip">
        <div class="stat-num">${asignados}</div>
        <div class="stat-label">Asignados</div>
      </div>
      <div class="stat-chip">
        <div class="stat-num" style="color:#22c55e">${aceptados}</div>
        <div class="stat-label">Aceptados</div>
      </div>
      <div class="stat-chip">
        <div class="stat-num" style="color:#ef4444">${rechazados}</div>
        <div class="stat-label">Rechazados</div>
      </div>
    `;
  }

  const listEl  = document.getElementById('deals-list');
  const countEl = document.getElementById('deals-count');
  if (countEl) countEl.textContent = `${asignados} este mes`;
  if (listEl) {
    const pendientes = prospectos.filter(p => p.estado === 'pendiente' || !p.estado);
    if (pendientes.length > 0) {
      listEl.innerHTML = `
        <div style="background:rgba(0,245,212,0.06);border:1px solid rgba(0,245,212,0.2);border-radius:16px;padding:16px;text-align:center;">
          <p style="font-size:28px;font-weight:900;color:var(--primary);margin:0;">${pendientes.length}</p>
          <p style="font-size:11px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:4px 0 12px;">Prospectos pendientes hoy</p>
          <button id="btn-go-cc" style="background:var(--primary);color:black;border:none;border-radius:12px;padding:12px 24px;font-size:13px;font-weight:900;cursor:pointer;">\uD83C\uDFA7 Ir al m\u00F3dulo Call Center</button>
        </div>`;
      setTimeout(() => {
        const btn = document.getElementById('btn-go-cc');
        if (btn) btn.addEventListener('click', () => navigate('call-center'));
      }, 0);
    } else {
      listEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size:3rem;margin-bottom:8px;">\u2705</div>
          <h3>\u00A1Todo al d\u00EDa!</h3>
          <p>No tienes prospectos pendientes por gestionar.</p>
        </div>`;
    }

    // AHORA AGREGAR LOS PROYECTOS DEL PIPELINE RENEW WATER (ROUND ROBIN)
    try {
      const { STAGE_CONFIG, formatDate } = await import('../api.js');
      // Import getDealsByUser explicitly since we need to call it here
      const { getDealsByUser } = await import('../api.js');
      // Fetch deals across ALL pipelines by passing null as the second argument
      const pipelineDeals = await getDealsByUser(user.id, null);
      
      if (pipelineDeals && pipelineDeals.length > 0) {
        const headerHtml = `<h3 style="font-size:13px; font-weight:800; color:var(--text-secondary); text-transform:uppercase; margin:24px 0 12px; letter-spacing:1px;">Proyectos Asignados</h3>`;
        
        const dealsHtml = pipelineDeals.map(deal => {
          const cfg = STAGE_CONFIG[deal.etapa] || { label: deal.etapa, badge: 'badge-gray' };
          const accentMap = {
            'badge-blue': '#3b82f6', 'badge-purple': '#8b5cf6', 'badge-green': '#059669', 'badge-teal': '#0d9488',
            'badge-orange': '#f59e0b', 'badge-gray': '#94a3b8', 'badge-yellow': '#d97706', 'badge-red': '#ef4444'
          };
          const accent = accentMap[cfg.badge] || 'var(--primary)';
          const percentage = deal.total_fases > 0 ? Math.round((deal.fase_orden / deal.total_fases) * 100) : 0;

          return `
            <div class="deal-card ${deal.is_locked || deal.etapa === 'Completado' ? 'deal-locked' : ''}" style="--card-accent:${accent}" data-id="${deal.id}" data-completed="${deal.etapa === 'Completado'}">
              <div class="deal-card-top">
                <div class="deal-client-name" style="display:flex; align-items:center; gap:6px">
                  ${deal.nombre_cliente}
                  ${deal.is_locked ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="color:var(--text-muted)"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' : ''}
                </div>
                <span class="badge ${cfg.badge}">${cfg.label}</span>
              </div>
              <div class="deal-progress-wrap">
                <div class="deal-progress-info">
                  <span style="display:flex; align-items:center; gap:4px">
                    ${deal.etapa === 'Completado' ? '<span style="font-size:0.6rem; color:var(--text-muted); font-weight:700; text-transform:uppercase">\u2705 Proyecto cerrado</span>' : deal.is_locked ? `<span style="font-size:0.6rem; color:var(--text-muted); font-weight:700; text-transform:uppercase">Esperando a ${deal.rol_fase}</span>` : 'Progreso'}
                  </span>
                  <span class="deal-progress-percentage">${percentage}%</span>
                </div>
                <div class="deal-progress-bg">
                  <div class="deal-progress-bar" style="width:${percentage}%; background:${accent}; opacity:${deal.is_locked ? '0.4' : '1'}"></div>
                </div>
              </div>
              <div class="deal-card-bottom">
                <div class="deal-date">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  ${formatDate(deal.fecha)}
                </div>
                <svg class="deal-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </div>`;
        }).join('');

        listEl.innerHTML += headerHtml + dealsHtml;

        // Add event listeners for the new deals
        listEl.querySelectorAll('.deal-card').forEach(card => {
          card.addEventListener('click', () => {
            if (card.dataset.completed === 'true') {
              import('../components/toast.js').then(({showToast}) => showToast('Proyecto cerrado.', 'info'));
              return;
            }
            import('../app.js').then(({navigate}) => navigate('detail', card.dataset.id));
          });
        });
      }
    } catch(err) {
      console.warn("No se pudieron cargar los proyectos de pipeline para Call Center:", err);
    }
  }
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  CALL CENTER \u2014 Mi Rendimiento: tasa de aceptaci\u00F3n del mes
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function initCCRendimientoChart(user) {
  const ctx = document.getElementById('rendimientoChart');
  if (!ctx) return;

  let prospectos = [];
  try {
    const res = await fetch(`/api/cc-prospectos?operador_id=${encodeURIComponent(user.id)}`);
    if (res.ok) prospectos = await res.json();
  } catch(_) {}

  const now          = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();
  const daysInMonth  = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Daily buckets
  const aceptadosByDay = new Array(daysInMonth).fill(0);
  const totalByDay     = new Array(daysInMonth).fill(0);
  const labels         = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

  let totalAceptados = 0;
  let totalMes       = 0;

  prospectos.forEach(p => {
    const ref = p.fecha_gestion || p.fecha_creacion;
    if (!ref) return;
    const d = new Date(ref);
    if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return;
    const day = d.getDate() - 1;
    totalByDay[day]++;
    totalMes++;
    if (p.estado === 'aceptado') {
      aceptadosByDay[day]++;
      totalAceptados++;
    }
  });

  // Acceptance rate % per day
  const pctByDay = totalByDay.map((t, i) => t > 0 ? Math.round((aceptadosByDay[i] / t) * 100) : null);

  const tasaMes  = totalMes > 0 ? Math.round((totalAceptados / totalMes) * 100) : 0;
  const rechazados = totalMes - totalAceptados;

  // Quick stats
  const quickStatsEl = document.getElementById('rendimiento-quick-stats');
  if (quickStatsEl) {
    quickStatsEl.innerHTML = `
      <label style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:12px;margin-top:10px;">\uD83D\uDCCA ESTAD\u00CDSTICAS DEL MES</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div style="background:rgba(255,255,255,0.03); backdrop-filter: blur(8px); padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,0.08);text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.1)">
          <p style="font-size:.68rem;color:var(--text-secondary);margin-bottom:4px;font-weight:500;">Tasa Aceptaci\u00F3n</p>
          <p style="font-size:1.4rem;font-weight:900;color:var(--primary);margin:0">${tasaMes}%</p>
          <span style="font-size:.55rem;color:var(--primary);font-weight:700;text-transform:uppercase;">Este Mes</span>
        </div>
        <div style="background:rgba(34,197,94,0.05); backdrop-filter: blur(8px); padding:14px;border-radius:16px;border:1px solid rgba(34,197,94,0.15);text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.1)">
          <p style="font-size:.68rem;color:var(--text-secondary);margin-bottom:4px;font-weight:500;">Aceptados</p>
          <p style="font-size:1.4rem;font-weight:900;color:#22c55e;margin:0">${totalAceptados}</p>
          <span style="font-size:.55rem;color:#22c55e;font-weight:700;text-transform:uppercase;">Leads</span>
        </div>
        <div style="background:rgba(239,68,68,0.05); backdrop-filter: blur(8px); padding:14px;border-radius:16px;border:1px solid rgba(239,68,68,0.15);text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.1)">
          <p style="font-size:.68rem;color:var(--text-secondary);margin-bottom:4px;font-weight:500;">Rechazados</p>
          <p style="font-size:1.4rem;font-weight:900;color:#ef4444;margin:0">${rechazados}</p>
          <span style="font-size:.55rem;color:#ef4444;font-weight:700;text-transform:uppercase;">No Calificados</span>
        </div>
      </div>
    `;
  }

  window.rendimientoChartInstance = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Aceptados', 'Rechazados'],
      datasets: [
        {
          data: [totalAceptados, rechazados],
          backgroundColor: ['#00f5d4', '#ef4444'],
          hoverBackgroundColor: ['#2dd4bf', '#f87171'],
          borderWidth: 0,
          hoverOffset: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      layout: {
        padding: 10
      },
      plugins: {
        legend: { 
          display: true,
          position: 'bottom',
          labels: { 
            color: document.body.classList.contains('dark-theme') ? '#e2e8f0' : '#64748b',
            pointStyle: 'circle',
            usePointStyle: true,
            font: { family: 'Inter', size: 12, weight: '600' } 
          } 
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 13 },
          padding: 12,
          cornerRadius: 12,
          displayColors: true
        }
      }
    }
  });
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//  CALL CENTER \u2014 Leaderboard: ranking operadores CC del mes
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function initCCLeaderboardChart(user) {
  const ctx = document.getElementById('leaderboardChart');
  const tab = document.getElementById('tab-leaderboard');
  if (!ctx) return;

  // Fetch ALL prospectos (no filter by operator) \u2014 need full list for ranking
  let prospectos = [];
  try {
    const res = await fetch('/api/cc-prospectos');
    if (res.ok) prospectos = await res.json();
  } catch(_) {}

  const now          = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();

  // Filter to this month
  const mesData = prospectos.filter(p => {
    const ref = p.fecha_gestion || p.fecha_creacion;
    if (!ref) return false;
    const d = new Date(ref);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // Aggregate by operator
  const opMap = {}; // { operador_nombre: { aceptados, rechazados, total } }
  mesData.forEach(p => {
    const name = p.operador_nombre || 'Sin asignar';
    if (!opMap[name]) opMap[name] = { aceptados: 0, rechazados: 0, total: 0, isMe: p.operador_id === user.id };
    opMap[name].total++;
    if (p.estado === 'aceptado')  opMap[name].aceptados++;
    if (p.estado === 'rechazado') opMap[name].rechazados++;
  });

  const sorted = Object.entries(opMap)
    .map(([name, v]) => ({ name, ...v, tasa: v.total > 0 ? Math.round((v.aceptados / v.total) * 100) : 0 }))
    .sort((a, b) => b.aceptados - a.aceptados)
    .slice(0, 8);

  if (sorted.length === 0) {
    if (tab) tab.innerHTML = `
      <h3 style="font-size:1.1rem;color:var(--text-primary);margin-bottom:12px;">\uD83C\uDFC6 Top Call Center \u2014 Mes Actual</h3>
      <div style="background:var(--surface-alt);padding:40px;border-radius:16px;border:1px solid var(--border);text-align:center;opacity:0.5;">
        <p style="font-size:2rem;">\uD83D\uDCEB</p>
        <p style="margin:8px 0 0;font-size:13px;color:var(--text-secondary);">Sin datos este mes</p>
      </div>`;
    return;
  }

  // Replace chart container with rich HTML leaderboard
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });
  if (tab) tab.innerHTML = `
    <h3 style="font-size:1.1rem;color:var(--text-primary);margin-bottom:4px;">\uD83C\uDFC6 Top Call Center</h3>
    <p style="font-size:.75rem;color:var(--text-muted);margin-bottom:16px;text-transform:capitalize;">${monthName} ${currentYear}</p>
    <div id="cc-leaderboard-list" style="display:flex;flex-direction:column;gap:10px;"></div>
  `;

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
  const listEl  = document.getElementById('cc-leaderboard-list');
  if (!listEl) return;

  sorted.forEach((op, i) => {
    const isMe   = op.isMe;
    const medal  = medals[i] || `<span style="font-size:.8rem;font-weight:900;color:var(--text-muted);">#${i+1}</span>`;
    const bar    = op.total > 0 ? (op.aceptados / sorted[0].aceptados) * 100 : 0;

    listEl.insertAdjacentHTML('beforeend', `
      <div style="background:${isMe ? 'rgba(0,245,212,0.06)' : 'var(--surface-alt)'};border:1.5px solid ${isMe ? 'rgba(0,245,212,0.3)' : 'var(--border)'};border-radius:16px;padding:14px 16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="font-size:1.2rem;width:24px;text-align:center;flex-shrink:0;">${medal}</span>
          <div style="flex:1;overflow:hidden;">
            <p style="font-size:.85rem;font-weight:800;color:${isMe ? 'var(--primary)' : 'var(--text-primary)'};margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${op.name}${isMe ? ' <span style="font-size:.65rem;opacity:.7;">(T\u00FA)</span>' : ''}
            </p>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <p style="font-size:1rem;font-weight:900;color:#22c55e;margin:0;">${op.aceptados}</p>
            <p style="font-size:.6rem;color:var(--text-muted);margin:0;font-weight:700;">aceptados</p>
          </div>
        </div>
        <!-- Bar -->
        <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:6px;">
          <div style="height:100%;width:${bar}%;background:${isMe ? 'var(--primary)' : '#0d9488'};border-radius:2px;transition:width .6s ease;"></div>
        </div>
        <!-- Mini stats -->
        <div style="display:flex;gap:12px;">
          <span style="font-size:.65rem;color:#22c55e;font-weight:700;">\u2705 ${op.aceptados} ac.</span>
          <span style="font-size:.65rem;color:#ef4444;font-weight:700;">\u274C ${op.rechazados} rej.</span>
          <span style="font-size:.65rem;color:var(--primary);font-weight:700;">\uD83D\uDCC8 ${op.tasa}% tasa</span>
        </div>
      </div>
    `);
  });

  // Dummy chart instance to avoid re-init
  window.leaderboardChartInstance = true;
}


async function initLeaderboardChart(user) {
  const tab = document.getElementById('tab-leaderboard');
  if (!tab) return;

  const workers = await getAdminWorkers();
  const db = getDB();
  const allProjects = db.Proyectos_Dinamicos || [];
  const activeUnit = localStorage.getItem('active_unit') || 'Renew Solar';
  const pipeline = (db.Admin_Pipelines || []).find(pip => pip.nombre === activeUnit);

  const isTecnico = user && /t[eé]cn[io]co/i.test(user.rol || '');
  const isCallCenter = user && (user.rol || '').toLowerCase().includes('call');

  const projectCountByUserId = {};
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  allProjects.forEach(p => {
    if (pipeline && p.pipeline_id !== pipeline.id) return;
    
    const isFinished = isProjectFinished(p, db);
    const shouldCount = isCallCenter ? true : isFinished;
    if (!shouldCount) return;

    const dateToUse = getProjectDate(p, db);
    if (!dateToUse) return;

    let dStr = String(dateToUse).trim();
    if (dStr.includes(' ') && !dStr.includes('T')) dStr = dStr.replace(' ', 'T');
    if (!dStr.includes('T')) dStr += 'T12:00:00';
    const pDate = new Date(dStr);
    
    if (isNaN(pDate.getTime()) || pDate.getMonth() !== currentMonth || pDate.getFullYear() !== currentYear) return;
    
    // Credit goes to tecnico if tecnico, otherwise to the assigned vendor in client OR the project creator
    let targetUserId = null;
    const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(p.cliente_id)) || {};
    if (isTecnico) {
      targetUserId = p.tecnico_id;
    } else {
      targetUserId = (cli.vendedor_asignado_id || '').split(',')[0].trim() || (p.responsable_id || '').split(',')[0].trim();
    }
    
    if (!targetUserId) return;

    if (!projectCountByUserId[targetUserId]) projectCountByUserId[targetUserId] = 0;
    projectCountByUserId[targetUserId]++;
  });

  const leaderboardData = [];
  workers.forEach(w => {
    const count = projectCountByUserId[w.id] || 0;
    const isWHighRole = ['admin', 'administrador', 'ceo'].includes((w.rol || '').toLowerCase());
    const hasUnitAccess = isWHighRole || (w.unidades && w.unidades.includes(activeUnit));
    
    const isWTecnico = /t[eé]cn[io]co/i.test(w.rol || '');
    const isWVendedor = (w.rol || '').toLowerCase().includes('vendedor') || (w.rol || '').toLowerCase().includes('representante');
    const isWCall = (w.rol || '').toLowerCase().includes('call');

    let shouldInclude = false;
    if (isTecnico) {
        shouldInclude = isWTecnico || w.id === user.id;
    } else if (isCallCenter) {
        shouldInclude = isWCall || w.id === user.id;
    } else {
        shouldInclude = isWVendedor || w.id === user.id;
    }

    if (count > 0 || (hasUnitAccess && shouldInclude)) {
      leaderboardData.push({
        id: w.id,
        name: `${w.nombre || ''} ${w.apellido || ''}`.trim() || 'Usuario',
        firstName: w.nombre || 'Usuario',
        sales: count,
        foto: w.foto || '',
        initials: ((w.nombre ? w.nombre[0] : 'U') + (w.apellido ? w.apellido[0] : '')).toUpperCase(),
        isMe: w.id === user.id
      });
    }
  });

  leaderboardData.sort((a, b) => b.sales - a.sales);
  const maxSales = leaderboardData.length > 0 ? leaderboardData[0].sales : 1;

  // Empty state
  if (leaderboardData.length === 0) {
    tab.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;opacity:.3;">\uD83D\uDCEB</div>
        <h3 style="color:var(--text-primary);font-size:1.1rem;margin:0 0 6px;">${t('lb_title')}</h3>
        <p style="color:var(--text-muted);font-size:.85rem;margin:0;">${t('lb_no_sales')}</p>
      </div>`;
    return;
  }

  // —— Avatar helper ——
  const avatar = (obj, sz, ring = '') => {
    const ringStyle = ring ? `padding:3px;background:${ring};` : '';
    if (obj.foto) {
      return `<div style="border-radius:50%;${ringStyle}flex-shrink:0;"><img src="${obj.foto}" style="width:${sz}px;height:${sz}px;border-radius:50%;object-fit:cover;display:block;border:2px solid rgba(0,0,0,0.2);"></div>`;
    }
    const colors = ['#6366f1','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#ec4899','#f97316'];
    const bg = colors[obj.initials.charCodeAt(0) % colors.length];
    return `<div style="border-radius:50%;${ringStyle}flex-shrink:0;"><div style="width:${sz}px;height:${sz}px;border-radius:50%;background:linear-gradient(135deg,${bg},${bg}cc);display:flex;align-items:center;justify-content:center;font-weight:900;color:white;font-size:${Math.round(sz * 0.38)}px;letter-spacing:-0.5px;border:2px solid rgba(255,255,255,0.15);">${obj.initials}</div></div>`;
  };

  // —— Podium config ——
  const medals = [
    { emoji: '\uD83D\uDC51', gradient: 'linear-gradient(135deg,#fef08a,#eab308)', glow: 'rgba(234,179,8,0.5)', color: '#eab308', textColor: '#fde047', height: 110, avatarSize: 72 },
    { emoji: '\uD83E\uDD48', gradient: 'linear-gradient(135deg,#e2e8f0,#94a3b8)', glow: 'rgba(148,163,184,0.4)', color: '#94a3b8', textColor: '#cbd5e1', height: 80, avatarSize: 58 },
    { emoji: '\uD83E\uDD49', gradient: 'linear-gradient(135deg,#fcd34d,#b45309)', glow: 'rgba(180,83,9,0.4)', color: '#b45309', textColor: '#fbbf24', height: 60, avatarSize: 58 }
  ];
  const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd visual order
  const top3 = leaderboardData.slice(0, 3);

  let podiumCards = '';
  const isAdminView = ['admin', 'administrador', 'ceo', 'project manager', 'manager de ventas', 'account manager', 'supervisión'].includes((user.rol || '').toLowerCase());
  
  podiumOrder.forEach(idx => {
    if (!top3[idx]) return;
    const p = top3[idx];
    const m = medals[idx];
    const rank = idx + 1;
    const salesLabel = isTecnico ? 'Citas' : (isCallCenter ? 'Leads' : t('lb_sales'));
    const hiddenLabel = isTecnico ? 'Citas Ocultas' : (isCallCenter ? 'Leads Ocultos' : 'Ventas Ocultas');
    const displaySales = p.isMe || isAdminView ? `${p.sales} ${salesLabel}` : hiddenLabel;
    podiumCards += `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;max-width:120px;padding:0 4px;">
        <div style="position:relative;margin-bottom:14px;">
          ${avatar(p, m.avatarSize, m.gradient)}
          <div style="position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);font-size:18px;z-index:2;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">${m.emoji}</div>
        </div>
        <p style="color:var(--text-primary);font-weight:800;font-size:${rank === 1 ? '.9rem' : '.8rem'};margin:0;text-align:center;line-height:1.2;width:100%;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.firstName}</p>
        <p style="color:${m.textColor};font-weight:900;font-size:.75rem;margin:4px 0 8px;">${displaySales}</p>
        <div style="width:100%;height:${m.height}px;background:${m.gradient};border-radius:12px 12px 0 0;position:relative;display:flex;align-items:center;justify-content:center;box-shadow:0 -4px 20px ${m.glow};">
          <span style="font-size:1.8rem;font-weight:900;color:rgba(0,0,0,0.2);">${rank}</span>
        </div>
      </div>`;
  });

  // \u2014\u2014\u2014 Rankings list \u2014\u2014\u2014
  let listHTML = '';
  leaderboardData.forEach((op, i) => {
    const rank = i + 1;
    const isMe = op.isMe;
    const pct = maxSales > 0 ? Math.round((op.sales / maxSales) * 100) : 0;
    const rankColors = { 1: '#eab308', 2: '#94a3b8', 3: '#b45309' };
    const rankColor = rankColors[rank] || 'var(--text-muted)';
    const meBorder = isMe ? 'border:1.5px solid var(--primary);box-shadow:0 0 12px rgba(0,223,191,0.15);' : 'border:1px solid var(--border);';
    const rankBadge = rank <= 3
      ? `<div style="width:28px;height:28px;border-radius:50%;background:${rankColor};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:${rank === 3 ? '#fff' : '#0f172a'};flex-shrink:0;">${rank}</div>`
      : `<div style="width:28px;height:28px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:var(--text-muted);flex-shrink:0;border:1px solid var(--border);">${rank}</div>`;

    listHTML += `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:14px;background:var(--surface-alt);${meBorder}transition:all .2s;">
        ${rankBadge}
        ${avatar(op, 40)}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-weight:700;font-size:.88rem;color:${isMe ? 'var(--primary)' : 'var(--text-primary)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${op.name}</span>
            ${isMe ? `<span style="font-size:.6rem;background:var(--primary);color:#0f172a;padding:1px 6px;border-radius:6px;font-weight:800;">${t('lb_you')}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
            <div style="flex:1;height:5px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${rank <= 3 ? rankColor : 'var(--primary)'};border-radius:99px;transition:width .8s ease;"></div>
            </div>
            <span style="font-size:.72rem;font-weight:800;color:${rank <= 3 ? rankColor : 'var(--text-muted)'};flex-shrink:0;">${isMe || isAdminView ? op.sales : '***'}</span>
          </div>
        </div>
      </div>`;
  });

  // ——— Final assembly ———
  tab.innerHTML = `
    <div style="margin-bottom:20px;">
      <h2 style="font-size:1.2rem;font-weight:900;color:var(--text-primary);margin:0 0 4px;text-align:center;">\uD83C\uDFC6 ${isTecnico ? 'Tabla de Posiciones' : t('lb_title')}</h2>
      <p style="text-align:center;font-size:.78rem;color:var(--text-muted);margin:0;">${activeUnit} \u00B7 ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
    </div>
    <div style="background:linear-gradient(180deg, rgba(0,223,191,0.08) 0%, var(--surface-alt) 60%);border-radius:20px;padding:24px 12px 0;margin-bottom:16px;border:1px solid rgba(0,223,191,0.1);">
      <p style="text-align:center;font-size:.75rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 18px;">${isTecnico ? 'MEJORES T\u00C9CNICOS' : (isCallCenter ? 'MEJORES OPERADORES' : t('lb_top_performers'))}</p>
      <div style="display:flex;justify-content:center;align-items:flex-end;gap:8px;">
        ${podiumCards}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${listHTML}
    </div>
  `;

  window.leaderboardChartInstance = true;
}

function showProfileModal() {
  const user = getCurrentUser();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.position = 'absolute'; // Fill the #app relative container
  overlay.style.inset = '0';
  overlay.style.zIndex = '1000';
  
  // —— Load pipelines dynamically from admin DB ——————————————
  const db = getDB();
  const adminPipelines = (db.Admin_Pipelines || []);

  // Icon map: match by pipeline name keywords
  const getPipelineIcon = (nombre, color) => {
    const n = nombre.toLowerCase();
    if (n.includes('solar') || n.includes('sun')) return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
    if (n.includes('water') || n.includes('agua') || n.includes('drop')) return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
    if (n.includes('home') || n.includes('casa') || n.includes('hogar')) return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    if (n.includes('hvac') || n.includes('aire') || n.includes('wind')) return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 10 16H2m15.73-8.27A2 2 0 1 1 19 12H2"/></svg>`;
    // Generic bolt icon for any other pipeline
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  };

  const allUnits = adminPipelines.map(pip => ({
    name: pip.nombre,
    color: pip.color || '#0d9488',
    icon: getPipelineIcon(pip.nombre, pip.color || '#0d9488')
  }));

  // Fallback if DB not yet initialized
  if (allUnits.length === 0) {
    allUnits.push(
      { name: 'Renew Solar', color: '#0d9488', icon: getPipelineIcon('solar', '#0d9488') },
      { name: 'Renew Water', color: '#0284c7', icon: getPipelineIcon('water', '#0284c7') }
    );
  }

  // Admins and CEOs have access to all pipelines automatically
  const isHighRole = ['admin', 'administrador', 'ceo'].includes((user.rol || '').toLowerCase());

  const unitsHtml = allUnits.map(u => {
    const hasUnit = isHighRole || (user.unidades && user.unidades.includes(u.name));
    const divStyle = [
      'display:flex', 'flex-direction:column', 'align-items:center',
      hasUnit ? 'cursor:default' : 'cursor:default; opacity:0.35; filter:grayscale(1)'
    ].join('; ');
    return `
      <div style="${divStyle}">
        <div style="width:48px; height:48px; border-radius:12px; background:${hasUnit ? u.color + '18' : 'var(--border)'}; color:${hasUnit ? u.color : 'var(--text-muted)'}; display:flex; align-items:center; justify-content:center; margin-bottom:6px; border: 1.5px solid ${hasUnit ? u.color + '30' : 'transparent'}">
          ${u.icon}
        </div>
        <span style="font-size:0.7rem; font-weight:700; color:${hasUnit ? 'var(--text-primary)' : 'var(--text-muted)'}">${u.name.replace('Renew ', '')}</span>
        ${hasUnit ? `<span style="font-size:0.55rem; font-weight:800; color:${u.color}; margin-top:2px; text-transform:uppercase; letter-spacing:.5px">Activo</span>` : ''}
      </div>
    `;
  }).join('');

  const fullName = `${user.nombre} ${user.apellido}`;
  const rol = user.rol || 'Representante de Ventas';
  const roleColor = rol.toLowerCase() === 'admin' ? 'badge-red' : 'badge-green';

  overlay.innerHTML = `
    <div class="modal-sheet" style="padding:0; text-align:center; width:100%; border-radius: 24px 24px 0 0; position:absolute; bottom:0; left:0; height:80vh; max-height:80vh; display:flex; flex-direction:column; overflow:hidden;">
      
      <!-- Fixed Handle area -->
      <div class="modal-handle" style="width: 40px; height: 5px; background: var(--border); border-radius: 99px; margin: 12px auto; cursor:pointer; flex-shrink:0;"></div>
      
      <!-- Scrollable Profile Content -->
      <div style="flex:1; overflow-y:auto; padding: 20px 24px 40px;">
        <!-- Center Profile Image -->
        <div class="avatar-btn" style="width:88px; height:88px; font-size:2.2rem; cursor:default; margin: 0 auto 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.1); ${user.foto ? `background-image: url(${user.foto}); background-size: cover; background-position: center; color: transparent;` : ''}">
          ${user.foto ? '' : (user.initials || (user.nombre[0] + (user.apellido ? user.apellido[0] : ''))).toUpperCase()}
        </div>
        
        <h2 style="font-size:1.4rem; font-weight:800; color:var(--text-primary); margin-bottom:6px">${fullName}</h2>
        <span class="badge ${roleColor}" style="padding:4px 14px; font-size:0.75rem">${rol}</span>
        
        <div class="divider" style="margin:24px 0"></div>
      
      <!-- Info Fields -->
      <div style="text-align:left; display:flex; flex-direction:column; gap:12px; margin-bottom:24px">
        <div class="field-group" style="margin-bottom:0">
          <label style="color:var(--text-muted); font-size:0.75rem; margin-bottom:6px">Email Corporativo</label>
          <div class="input-wrap no-icon">
            <input type="email" id="profile-email-readonly" value="${user.email}" readonly style="background:var(--surface-alt); color:var(--text-primary); border-color:transparent; font-weight:500" />
          </div>
        </div>
        <div class="field-group" style="margin-bottom:0">
          <label style="color:var(--text-muted); font-size:0.75rem; margin-bottom:6px">Tel\u00E9fono Laboral</label>
          <div class="input-wrap no-icon">
            <input type="tel" value="${user.telefono || 'No registrado'}" readonly style="background:var(--surface-alt); color:var(--text-primary); border-color:transparent; font-weight:500" />
          </div>
        </div>
      </div>
      
      <!-- Acceso a Ecosistemas -->
      <div style="text-align:left; margin-bottom:32px">
        <label style="font-size:.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:16px">Ecosistemas Autorizados</label>
        <div style="display:flex; justify-content:space-around">
          ${unitsHtml}
        </div>
      </div>
      

    </div>
  `;

  const app = document.getElementById('app');
  if (app) app.appendChild(overlay);
  else document.body.appendChild(overlay);

  // Close animation logic
  const closeModal = () => {
    const sheet = overlay.querySelector('.modal-sheet');
    sheet.style.animation = 'sheetDown .3s cubic-bezier(.4,0,.2,1) both';
    overlay.style.animation = 'overlayOut .3s ease both';
    setTimeout(() => overlay.remove(), 300);
  };
  
  // Close modal on outside click
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // Handle Drag/Click to close (Social Media style)
  const handle = overlay.querySelector('.modal-handle');
  const sheet = overlay.querySelector('.modal-sheet');
  handle.style.cursor = 'pointer';
  handle.addEventListener('click', closeModal);

  let touchStartY = 0;
  handle.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
    sheet.style.transition = 'none';
  }, { passive: true });

  handle.addEventListener('touchmove', e => {
    const diff = e.touches[0].clientY - touchStartY;
    if (diff > 0) {
      sheet.style.transform = `translateY(${diff}px)`;
    } else {
      sheet.style.transform = `translateY(0)`;
    }
  }, { passive: true });

  handle.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientY - touchStartY;
    sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    if (diff > 100) {
      closeModal();
    } else {
      sheet.style.transform = 'translateY(0)';
    }
  }, { passive: true });

  // Ecosistemas section is now READ-ONLY (pipeline is selected from home screen chips)
}


// Re-render chart on theme change
window.addEventListener('themechange', () => {
  const chartCanvas = document.getElementById('rendimientoChart');
  if (chartCanvas && chartCanvas.offsetParent !== null) {
    const user = getCurrentUser();
    if (window.rendimientoChartInstance) {
      window.rendimientoChartInstance.destroy();
    }
    const isCC = user && user.rol && user.rol.toLowerCase().includes('call');
    if (isCC) initCCRendimientoChart(user);
    else initRendimientoChart(user);
  }
});
