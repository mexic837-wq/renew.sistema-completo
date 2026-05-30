/* ============================================================
   RENEW OS – screens/adelantos.js
   Worker view for Préstamos y Adelantos (Full Screen)
   ============================================================ */
import { getDB, getCurrentUser } from '../api.js';
import { t } from '../i18n.js';

export function renderMisAdelantos() {
    const user = getCurrentUser();
    const screen = document.getElementById('screen-mis-adelantos');
    if (!user || !screen) return;

    const db = getDB();
    const myAdelantos = (db.rrhh_adelantos || []).filter(a => String(a.trabajador_id) === String(user.id));
    const totalMonto = myAdelantos.filter(a => a.status !== 'Solventado').reduce((sum, a) => sum + (Number(a.monto) || 0), 0);

    screen.innerHTML = `
        <div class="screen-header slide-in-left" style="background:linear-gradient(135deg,#0ea5e9,#2563eb);border:none;">
            <button class="back-btn" id="adelantos-back-btn" style="color:#fff;background:rgba(255,255,255,0.15);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="15 18 9 12 15 6"/>
                </svg>
            </button>
            <h2 style="color:#fff;">Mis Adelantos</h2>
            <span style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3);padding:4px 10px;border-radius:10px;font-size:0.7rem;font-weight:800;">
                ${myAdelantos.length} registro${myAdelantos.length !== 1 ? 's' : ''}
            </span>
        </div>

        <div style="padding:16px 16px 100px;" class="animate-fadeIn">
            <!-- Summary Card -->
            <div style="background:linear-gradient(135deg,rgba(14,165,233,0.1),rgba(37,99,235,0.05)); border:1.5px solid rgba(14,165,233,0.2); border-radius:24px; padding:24px; margin-bottom:24px; display:flex; align-items:center; justify-content:between; position:relative; overflow:hidden;">
                <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:#0ea5e9; opacity:0.1; filter:blur(40px);"></div>
                <div style="flex:1;">
                    <span style="font-size:0.65rem; font-weight:900; color:#0ea5e9; text-transform:uppercase; letter-spacing:1.5px; display:block; margin-bottom:4px;">Saldo Total Adeudado</span>
                    <h3 style="font-size:2rem; font-weight:950; color:var(--text-primary); margin:0; letter-spacing:-1px;">$${totalMonto.toLocaleString('en-US', {minimumFractionDigits:2})}</h3>
                </div>
                <div style="width:56px; height:56px; border-radius:18px; background:#0ea5e9; display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 8px 20px rgba(14,165,233,0.3);">
                    <i class="fa-solid fa-sack-dollar text-2xl"></i>
                </div>
            </div>

            <div class="space-y-3">
                ${myAdelantos.length === 0 ? `
                    <div style="text-align:center; padding:60px 20px; color:var(--text-muted); opacity:0.5;">
                        <i class="fa-solid fa-receipt text-5xl mb-4"></i>
                        <p style="font-weight:900; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px;">Sin adelantos registrados</p>
                    </div>
                ` : myAdelantos.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(adel => `
                    <div class="adelanto-card" style="background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:16px; margin-bottom:12px; display:flex; align-items:center; gap:16px; transition:all 0.2s; opacity:${adel.status === 'Solventado' ? '0.6' : '1'};">
                        <div style="width:48px; height:48px; border-radius:14px; background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.2); display:flex; align-items:center; justify-content:center; color:#0ea5e9; flex-shrink:0;">
                            <i class="fa-solid fa-hand-holding-dollar"></i>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:2px;">
                                <span style="font-size:1.1rem; font-weight:900; color:var(--text-primary);${adel.status === 'Solventado' ? 'text-decoration:line-through;' : ''}">$${Number(adel.monto).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                                <span style="font-size:0.6rem; font-weight:800; color:#0ea5e9; background:rgba(14,165,233,0.1); padding:2px 8px; border-radius:99px; text-transform:uppercase;">${adel.fecha}</span>
                                ${adel.status === 'Solventado' ? '<span style="font-size:0.6rem; font-weight:800; color:#10b981; background:rgba(16,185,129,0.1); padding:2px 8px; border-radius:99px; text-transform:uppercase;">Solventado</span>' : ''}
                            </div>
                            <p style="font-size:0.75rem; color:var(--text-muted); margin:0; font-style:italic; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${adel.motivo || 'Sin motivo especificado'}</p>
                        </div>
                        ${adel.document_url ? `
                            <a href="${adel.document_url}" target="_blank" onclick="event.stopPropagation();" style="width:40px; height:40px; border-radius:12px; background:rgba(14,165,233,0.05); color:#0ea5e9; display:flex; align-items:center; justify-content:center; text-decoration:none; border:1px solid rgba(14,165,233,0.1);">
                                <i class="fa-solid fa-file-pdf"></i>
                            </a>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            
            <div style="margin-top:32px; text-align:center; opacity:0.4;">
                <p style="font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:2px; color:var(--text-muted);">Consulte con RRHH para más detalles</p>
            </div>
        </div>
    `;

    document.getElementById('adelantos-back-btn')?.addEventListener('click', () => window.appNavigate('dashboard'));
}
