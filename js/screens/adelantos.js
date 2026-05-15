/* ============================================================
   RENEW OS – screens/adelantos.js
   Worker view for Préstamos y Adelantos
   ============================================================ */
import { getDB, getCurrentUser } from '../api.js';
import { t } from '../i18n.js';

export function renderMisAdelantos() {
    // We'll use a modal instead of a full screen to keep it simple and 'card-like'
    const user = getCurrentUser();
    if (!user) return;

    const db = getDB();
    const myAdelantos = (db.rrhh_adelantos || []).filter(a => String(a.trabajador_id) === String(user.id));

    // Create modal if not exists
    let modal = document.getElementById('modal-mis-adelantos');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-mis-adelantos';
        modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-[1000] flex items-center justify-center p-4 nuclear-hidden';
        document.body.appendChild(modal);
    }

    const totalMonto = myAdelantos.reduce((sum, a) => sum + (Number(a.monto) || 0), 0);

    modal.innerHTML = `
        <div class="bg-white dark:bg-[#0f172a] w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scaleIn relative group">
            <div class="absolute -top-24 -right-24 w-48 h-48 bg-tealAccent/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div class="p-8 pb-0 relative z-10">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-tealAccent/10 rounded-2xl flex items-center justify-center border border-tealAccent/20">
                            <i class="fa-solid fa-hand-holding-dollar text-xl text-tealAccent"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">Mis Adelantos</h3>
                            <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">Historial de Préstamos</p>
                        </div>
                    </div>
                    <button onclick="document.getElementById('modal-mis-adelantos').classList.add('nuclear-hidden')" class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-400">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="bg-tealAccent/5 border border-tealAccent/20 rounded-2xl p-4 mb-6 flex items-center justify-between">
                    <div>
                        <span class="text-[9px] font-black text-tealAccent uppercase tracking-widest block mb-1">Monto Total Adeudado</span>
                        <span class="text-2xl font-black text-gray-900 dark:text-white">$${totalMonto.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                    </div>
                    <div class="w-10 h-10 bg-tealAccent rounded-xl flex items-center justify-center text-black shadow-lg shadow-tealAccent/20">
                        <i class="fa-solid fa-sack-dollar text-lg"></i>
                    </div>
                </div>
            </div>

            <div class="p-8 pt-2 max-h-[50vh] overflow-y-auto hide-scrollbar relative z-10">
                <div class="space-y-3">
                    ${myAdelantos.length === 0 ? `
                        <div class="py-10 text-center opacity-30">
                            <i class="fa-solid fa-receipt text-3xl mb-3"></i>
                            <p class="text-[10px] font-black uppercase tracking-widest">No hay adelantos registrados</p>
                        </div>
                    ` : myAdelantos.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(adel => `
                        <div class="bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-xs font-black text-gray-900 dark:text-white">$${Number(adel.monto).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                                    <span class="text-[8px] font-black text-tealAccent uppercase tracking-widest bg-tealAccent/10 px-2 py-0.5 rounded-full">${adel.fecha}</span>
                                </div>
                                <p class="text-[10px] text-gray-500 italic line-clamp-1">${adel.motivo || 'Sin motivo especificado'}</p>
                            </div>
                            ${adel.document_url ? `
                                <a href="${adel.document_url}" target="_blank" class="w-10 h-10 flex items-center justify-center rounded-xl bg-tealAccent/10 text-tealAccent hover:bg-tealAccent/20 transition-all ml-3">
                                    <i class="fa-solid fa-file-pdf"></i>
                                </a>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="p-6 pt-0 relative z-10 text-center">
                <p class="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Consulte con RRHH para más detalles</p>
            </div>
        </div>
    `;

    modal.classList.remove('nuclear-hidden');
    modal.classList.add('flex');
}

// Expose to window for the dashboard tool-row
window.showMisAdelantos = renderMisAdelantos;
