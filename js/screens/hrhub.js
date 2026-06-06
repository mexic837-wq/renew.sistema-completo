import { getAdminWorkers, uploadFile, saveAdminWorker, getDB, deleteAdminWorker } from '../api.js';

export async function renderHRHub() {
    const canvas = document.getElementById('main-canvas');
    if (!canvas) return;

    // Define globally immediately to avoid race conditions
    window.openAdelantoModal = openAdelantoModal;

    // UI HTML
    canvas.innerHTML = `
    <div class="h-full flex flex-col animate-fadeIn pt-2">
        <div class="flex items-center gap-2 mb-6 overflow-x-auto py-2 hide-scrollbar">
            <button class="hr-view-btn active px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap border-tealAccent text-tealAccent bg-tealAccent/10" data-target="directorio">Directorio Base</button>
            <button class="hr-view-btn px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 text-gray-500 hover:text-white transition-all whitespace-nowrap" data-target="kanban">Onboarding Pulse</button>
            <button class="hr-view-btn px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 text-gray-500 hover:text-white transition-all whitespace-nowrap" data-target="recibos">
                <i class="fa-solid fa-receipt mr-1"></i>Recibos de Pago
            </button>
            <button class="hr-view-btn px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 text-gray-500 hover:text-white transition-all whitespace-nowrap" data-target="adelantos">
                <i class="fa-solid fa-hand-holding-dollar mr-1"></i>Préstamos / Adelantos
            </button>
        </div>

        <!-- DIRECTORIO BASE -->
        <div id="view-directorio" class="hr-view-container block flex-1">
            <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-2xl shadow-premium overflow-hidden overflow-x-auto hide-scrollbar">
                <table class="w-full text-xs min-w-[1100px]">
                    <thead class="bg-gray-50 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
                        <tr>
                            <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">Colaborador</th>
                            <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">División / Depto</th>
                            <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">Ecosistemas</th>
                            <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">Email Autenticación</th>
                            <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">Teléfono Móvil</th>
                            <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">Status Documentos</th>
                            <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] whitespace-nowrap">Acceso</th>
                            <th class="px-4 py-3 text-right"></th>
                        </tr>
                    </thead>
                    <tbody id="hr-table-body" class="divide-y divide-gray-100 dark:divide-white/5">
                        <!-- JS Rows -->
                    </tbody>
                </table>
            </div>
        </div>

        <!-- KANBAN -->
        <div id="view-kanban" class="hr-view-container hidden flex-1 overflow-x-auto hide-scrollbar">
            <div class="flex gap-4 min-h-full items-start pb-4">
                <div class="w-[320px] min-w-[320px] bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl flex flex-col max-h-full" data-status="Inscrito">
                    <div class="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <h3 class="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2"><span class="text-tealAccent">1.</span> Inscrito</h3>
                        <span class="bg-white dark:bg-white/10 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-full" id="count-inscrito">0</span>
                    </div>
                    <div class="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 kanban-cards min-h-[200px]" id="col-inscrito"></div>
                </div>
                <div class="w-[320px] min-w-[320px] bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl flex flex-col max-h-full" data-status="Faltan Documentos">
                    <div class="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <h3 class="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2"><span class="text-amber-500">2.</span> Faltan Documentos</h3>
                        <span class="bg-white dark:bg-white/10 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-full" id="count-docs">0</span>
                    </div>
                    <div class="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 kanban-cards min-h-[200px]" id="col-docs"></div>
                </div>
                <div class="w-[320px] min-w-[320px] bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl flex flex-col max-h-full" data-status="Capacitacion">
                    <div class="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <h3 class="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2"><span class="text-blue-500">3.</span> Capacitación</h3>
                        <span class="bg-white dark:bg-white/10 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-full" id="count-cap">0</span>
                    </div>
                    <div class="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 kanban-cards min-h-[200px]" id="col-cap"></div>
                </div>
                <div class="w-[320px] min-w-[320px] bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl flex flex-col max-h-full" data-status="Equipo Activo">
                    <div class="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <h3 class="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2"><span class="text-emerald-500">4.</span> Equipo Activo</h3>
                        <span class="bg-white dark:bg-white/10 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-full" id="count-activo">0</span>
                    </div>
                    <div class="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 kanban-cards min-h-[200px]" id="col-activo"></div>
                </div>
                <div class="w-[320px] min-w-[320px] bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl flex flex-col max-h-full" data-status="Inactivo">
                    <div class="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <h3 class="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2"><span class="text-red-500">5.</span> Inactivo</h3>
                        <span class="bg-white dark:bg-white/10 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-full" id="count-inactivo">0</span>
                    </div>
                    <div class="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 kanban-cards min-h-[200px]" id="col-inactivo"></div>
                </div>
            </div>
        </div>

        <!-- RECIBOS DE PAGO -->
        <div id="view-recibos" class="hr-view-container hidden flex-1">
            <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-2xl shadow-premium p-6">
                <!-- Header + Filters -->
                <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div>
                        <h3 class="text-sm font-black text-gray-900 dark:text-white">Recibos de Pago</h3>
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Historial completo del equipo</p>
                    </div>
                    <button id="btn-add-recibo" onclick="window.openReciboModal && window.openReciboModal()" class="px-6 py-2.5 bg-tealAccent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i> Nuevo Recibo
                    </button>
                </div>
                <!-- Row 1: Role Filter -->
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <span class="text-[8px] font-black text-gray-400 uppercase tracking-widest w-14">Rol:</span>
                    <button data-rf="vendedor" class="rrhh-rf-btn active px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-tealAccent bg-tealAccent/10 text-tealAccent transition-all">
                        <i class="fa-solid fa-dollar-sign mr-1"></i>Vendedores
                    </button>
                    <button data-rf="tecnico"  class="rrhh-rf-btn px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-gray-200 dark:border-white/5 text-gray-500 hover:text-emerald-500 hover:border-emerald-300 transition-all">
                        <i class="fa-solid fa-tools mr-1"></i>Técnicos
                    </button>
                    <button data-rf="oficina"  class="rrhh-rf-btn px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-gray-200 dark:border-white/5 text-gray-500 hover:text-blue-500 hover:border-blue-300 transition-all">
                        <i class="fa-solid fa-building mr-1"></i>Oficina
                    </button>
                </div>
                <!-- Row 2: Department Filter -->
                <div class="flex items-center gap-2 mb-6 flex-wrap">
                    <span class="text-[8px] font-black text-gray-400 uppercase tracking-widest w-14">Dpto:</span>
                    <button data-dept="all"   class="rrhh-dept-btn active px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-gray-400 bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300 transition-all">Todos</button>
                    <button data-dept="water" class="rrhh-dept-btn px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-gray-200 dark:border-white/5 text-gray-500 hover:text-sky-500 hover:border-sky-300 transition-all">
                        <i class="fa-solid fa-water"></i> Water
                    </button>
                    <button data-dept="solar" class="rrhh-dept-btn px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-gray-200 dark:border-white/5 text-gray-500 hover:text-amber-500 hover:border-amber-300 transition-all">
                        ☀️ Solar
                    </button>
                    <button data-dept="home"  class="rrhh-dept-btn px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-gray-200 dark:border-white/5 text-gray-500 hover:text-purple-500 hover:border-purple-300 transition-all">
                        🏠 Home
                    </button>
                </div>

                <!-- Search bar -->
                <div class="relative mb-4">
                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] pointer-events-none"></i>
                    <input id="rrhh-recibos-search" type="text" placeholder="Buscar por nombre de representante o cliente..."
                        class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.03] text-xs font-semibold text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-tealAccent transition-all">
                </div>

                <!-- Table -->
                <div class="overflow-x-auto">
                    <table class="w-full text-xs min-w-[980px]">
                        <thead class="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                            <tr>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap">Representante</th>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap">Rol</th>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap">Departamento</th>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap">Cliente</th>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap">Monto</th>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap">Fecha</th>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap">Tipo</th>
                                <th class="px-4 py-3 text-right text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap">PDF</th>
                            </tr>
                        </thead>
                        <tbody id="rrhh-recibos-body" class="divide-y divide-gray-100 dark:divide-white/5">
                            <tr><td colspan="8" class="py-12 text-center text-gray-400 text-xs italic">Cargando recibos...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- PRÉSTAMOS O ADELANTOS -->
        <div id="view-adelantos" class="hr-view-container hidden flex-1">
            <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-2xl shadow-premium p-6">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h3 class="text-sm font-black text-gray-900 dark:text-white">Préstamos y Adelantos</h3>
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Gestión de créditos al personal</p>
                    </div>
                    <button id="btn-add-adelanto" onclick="window.openAdelantoModal && window.openAdelantoModal()" class="px-6 py-2.5 bg-tealAccent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i> Nuevo Adelanto
                    </button>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-xs min-w-[900px]">
                        <thead class="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                            <tr>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Colaborador</th>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Monto</th>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Fecha</th>
                                <th class="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Motivo</th>
                                <th class="px-4 py-3 text-right text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Documento</th>
                            </tr>
                        </thead>
                        <tbody id="rrhh-adelantos-body" class="divide-y divide-gray-100 dark:divide-white/5">
                            <tr><td colspan="5" class="py-12 text-center text-gray-400 text-xs italic">Cargando adelantos...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    `;

    // Script Logic
    let empleadosData = [];

    async function init() {
        bindHRToggle();
        await fetchEmpleados();
        renderTabla();
        renderKanban();
        initSortableKanban();
        
        // Initial binding for buttons that are part of the main HTML
        const addAdelantoBtn = document.getElementById('btn-add-adelanto');
        if (addAdelantoBtn) addAdelantoBtn.onclick = openAdelantoModal;

        window.deleteRecibo = async (id) => {
            if (!confirm('¿Estás seguro de que deseas eliminar este recibo? Esta acción no se puede deshacer.')) return;
            try {
                const { deleteRecord } = await import('../api.js');
                await deleteRecord('recibos_pagos', id);
                
                const db = getDB();
                if (db.Recibos_Pagos) {
                    db.Recibos_Pagos = db.Recibos_Pagos.filter(r => r.id !== id);
                    localStorage.setItem('rs_admin_db', JSON.stringify(db));
                }
                
                import('../components/toast.js').then(m => m.showToast('Recibo eliminado exitosamente', 'success'));
                
                // Determine current active filter and re-render
                const roleBtn = document.querySelector('.rrhh-rf-btn.active');
                const deptBtn = document.querySelector('.rrhh-dept-btn.active');
                renderRecibos(roleBtn ? roleBtn.dataset.rf : 'all', deptBtn ? deptBtn.dataset.dept : 'all');
                
            } catch (err) {
                console.error("Error deleting recibo:", err);
                import('../components/toast.js').then(m => m.showToast('Error al eliminar recibo', 'error'));
            }
        };

        window.solventarAdelanto = async (id) => {
            if (!confirm('¿Estás seguro de que deseas marcar este adelanto como pagado?')) return;
            try {
                const db = getDB();
                if (db.rrhh_adelantos) {
                    const adelanto = db.rrhh_adelantos.find(a => String(a.id) === String(id));
                    if (adelanto) {
                        adelanto.status = 'Pagado';
                        const { saveGranular } = await import('../api.js');
                        await saveGranular('rrhh_adelantos', [adelanto]);
                        localStorage.setItem('rs_admin_db', JSON.stringify(db));
                        import('../components/toast.js').then(m => m.showToast('Adelanto marcado como pagado', 'success'));
                        renderAdelantos();
                    }
                }
            } catch (err) {
                console.error("Error al pagar adelanto:", err);
                import('../components/toast.js').then(m => m.showToast('Error al pagar adelanto', 'error'));
            }
        };

        window.deleteAdelanto = async (id) => {
            if (!confirm('¿Estás seguro de que deseas eliminar este adelanto? Esta acción no se puede deshacer.')) return;
            try {
                const { deleteRecord } = await import('../api.js');
                await deleteRecord('rrhh_adelantos', id);
                
                const db = getDB();
                if (db.rrhh_adelantos) {
                    db.rrhh_adelantos = db.rrhh_adelantos.filter(a => String(a.id) !== String(id));
                    localStorage.setItem('rs_admin_db', JSON.stringify(db));
                }
                
                import('../components/toast.js').then(m => m.showToast('Adelanto eliminado exitosamente', 'success'));
                renderAdelantos();
            } catch (err) {
                console.error("Error al eliminar adelanto:", err);
                import('../components/toast.js').then(m => m.showToast('Error al eliminar adelanto', 'error'));
            }
        };
    }

    function bindHRToggle() {
        const btns = document.querySelectorAll('.hr-view-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                btns.forEach(b => {
                    b.classList.remove('active', 'border-tealAccent', 'text-tealAccent', 'bg-tealAccent/10');
                    b.classList.add('border-white/5', 'text-gray-500');
                });
                const targetBtn = e.target.closest('.hr-view-btn');
                targetBtn.classList.remove('border-white/5', 'text-gray-500');
                targetBtn.classList.add('active', 'border-tealAccent', 'text-tealAccent', 'bg-tealAccent/10');

                document.querySelectorAll('.hr-view-container').forEach(c => {
                    c.classList.remove('block', 'flex');
                    c.classList.add('hidden');
                });
                
                const target = targetBtn.getAttribute('data-target');
                const showContainer = document.getElementById('view-' + target);
                showContainer.classList.remove('hidden');
                if (target === 'kanban') showContainer.classList.add('flex');
                else showContainer.classList.add('block');

                // Render views when tab is clicked
        if (target === 'recibos') renderRecibos('vendedor');
        if (target === 'adelantos') renderAdelantos();
            });
        });
    }

    async function fetchEmpleados() {
        try {
            const baseUsers = await getAdminWorkers();
            empleadosData = baseUsers.map(u => {
                return {
                    ...u,
                    w9_url: u.w9_url || u.w9Url || null,
                    carnet_url: u.carnet_url || u.carnetUrl || null,
                    contrato_url: u.contrato_url || u.contratoUrl || null,
                    estatus_rrhh: u.estatus_rrhh || 'Inscrito',
                    fecha_nacimiento: u.fecha_nacimiento || null
                };
            });
            empleadosData.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        } catch (err) {
            console.error("Error fetching empleados:", err);
            empleadosData = [];
        }
    }

    function renderTabla() {
        const tbody = document.getElementById('hr-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        empleadosData.forEach(emp => {
            const docsMissing = [];
            if (!emp.w9_url && !emp.w9Url) docsMissing.push('W-9');
            if (!emp.carnet_url && !emp.carnetUrl) docsMissing.push('Carnet');
            if (!emp.contrato_url && !emp.contratoUrl) docsMissing.push('Contrato');

            let docsBadgeHtml = '';
            if (docsMissing.length > 0) {
                docsBadgeHtml = `<span class="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide"><i class="fa-solid fa-triangle-exclamation text-[7px]"></i> FALTA ${docsMissing.join(', ')}</span>`;
            } else {
                docsBadgeHtml = `<span class="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide"><i class="fa-solid fa-circle-check text-[7px]"></i> COMPLETO</span>`;
            }

            const initial = emp.nombre ? emp.nombre[0].toUpperCase() : '?';
            const avatar = emp.foto ? `<img src="${emp.foto}" class="w-8 h-8 rounded-full object-cover border border-white/10">` : `<div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-black text-gray-500 text-[10px]">${initial}</div>`;
            
            const ecosistemas = (emp.unidades || []).map(pip => `<span class="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[7px] font-black uppercase tracking-widest rounded-md border border-blue-200 dark:border-blue-500/20">${pip.trim()}</span>`).join(' ') || '<span class="text-[8px] text-gray-600 italic">Sin asignar</span>';

            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer btn-open-hrpanel';
            tr.setAttribute('data-id', emp.id);
            tr.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                        ${avatar}
                        <div class="flex flex-col">
                            <span class="font-bold text-gray-900 dark:text-white text-xs tracking-tight">${emp.nombre} ${emp.apellido || ''}</span>
                            <span class="text-[8px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">${emp.rol || 'N/A'}</span>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap min-w-[120px]">
                    <span class="px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-tealAccent text-[8px] font-black uppercase tracking-widest rounded-md border border-gray-200 dark:border-white/5">${emp.department || 'RENEW GROUP'}</span>
                </td>
                <td class="px-4 py-3 min-w-[180px]">
                    <div class="flex flex-wrap gap-1 max-w-[250px]">${ecosistemas}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-[10px] text-gray-500 font-medium min-w-[180px]">${emp.email || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-[10px] text-gray-500 font-medium min-w-[120px]">${emp.telefono || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap min-w-[160px]">${docsBadgeHtml}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <label class="relative inline-flex items-center cursor-pointer" onclick="event.stopPropagation()">
                        <input type="checkbox" class="sr-only peer toggle-worker-status" data-id="${emp.id}" ${emp.is_suspended ? '' : 'checked'}>
                        <div class="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-tealAccent"></div>
                    </label>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right">
                    <button class="text-gray-400 hover:text-tealAccent transition-colors p-2"><i class="fa-solid fa-pen text-[10px]"></i></button>
                    <button class="text-gray-400 hover:text-red-500 transition-colors p-2 btn-delete-worker" data-id="${emp.id}" title="Eliminar trabajador"><i class="fa-solid fa-trash text-[10px]"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        document.querySelectorAll('.btn-delete-worker').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Evitar que se abra el panel
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm('¿Estás seguro de que deseas eliminar a este trabajador de forma permanente?')) {
                    try {
                        await deleteAdminWorker(id);
                        await fetchEmpleados();
                        renderTabla();
                        renderKanban();
                        import('../components/toast.js').then(m => m.showToast('Trabajador eliminado correctamente.', 'success'));
                    } catch (err) {
                        console.error('Error deleting worker:', err);
                        import('../components/toast.js').then(m => m.showToast('Error al eliminar el trabajador.', 'error'));
                    }
                }
            });
        });

        document.querySelectorAll('.btn-open-hrpanel').forEach(row => {
            row.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                openHRPanel(id);
            });
        });
    }

    function renderKanban() {
        const cols = {
            "Inscrito": document.getElementById('col-inscrito'),
            "Faltan Documentos": document.getElementById('col-docs'),
            "Capacitacion": document.getElementById('col-cap'),
            "Equipo Activo": document.getElementById('col-activo'),
            "Inactivo": document.getElementById('col-inactivo')
        };
        
        Object.values(cols).forEach(c => { if(c) c.innerHTML = ''; });
        const counts = { "Inscrito":0, "Faltan Documentos":0, "Capacitacion":0, "Equipo Activo":0, "Inactivo":0 };

        empleadosData.forEach(emp => {
            // Normalización de estados para evitar inconsistencias con acentos o nombres previos
            let status = (emp.estatus_rrhh || 'Inscrito').trim();
            if (status === 'Entrevistas' || status === 'Nuevo Ingreso' || !status) status = 'Inscrito';
            if (status === 'Falta Documentacion' || status === 'Falta Documentación') status = 'Faltan Documentos';
            if (status === 'Capacitación') status = 'Capacitacion';

            const hasW9 = !!(emp.w9_url || emp.w9Url) && String(emp.w9_url || emp.w9Url).length > 5;
            const hasCarnet = !!(emp.carnet_url || emp.carnetUrl) && String(emp.carnet_url || emp.carnetUrl).length > 5;
            const hasContrato = !!(emp.contrato_url || emp.contratoUrl) && String(emp.contrato_url || emp.contratoUrl).length > 5;
            const hasBanco = !!(emp.banco_nombre && emp.banco_cuenta && emp.banco_ruta) &&
                             emp.banco_nombre.trim().length > 0 &&
                             emp.banco_cuenta.trim().length > 0 &&
                             emp.banco_ruta.trim().length > 0;
            const allDocs = hasW9 && hasCarnet && hasContrato && hasBanco;
            
            console.log(`[HR-AUTO] ${emp.nombre}: W9=${hasW9}, Carnet=${hasCarnet}, Contrato=${hasContrato}, Banco=${hasBanco}, All=${allDocs}, Current Status=${status}`);

            if (allDocs && (status === 'Inscrito' || status === 'Faltan Documentos')) {
                console.log(`[HR-AUTO] Moving ${emp.nombre} to Capacitacion (Docs + Banco Complete)`);
                status = 'Capacitacion';
                emp.estatus_rrhh = 'Capacitacion';
                saveAdminWorker(emp).catch(e => console.error("Error auto-moving:", e));
            } else if (!allDocs && (status === 'Inscrito' || status === 'Capacitacion')) {
                console.log(`[HR-AUTO] Moving ${emp.nombre} to Faltan Documentos (Docs or Banco Missing)`);
                status = 'Faltan Documentos';
                emp.estatus_rrhh = 'Faltan Documentos';
                saveAdminWorker(emp).catch(e => console.error("Error auto-moving back:", e));
            }

            if (!cols[status]) status = 'Inscrito';
            
            const colDiv = cols[status];
            if(!colDiv) return;
            counts[status]++;
            
            const initial = emp.nombre ? emp.nombre[0].toUpperCase() : '?';
            const avatar = emp.foto ? `<img src="${emp.foto}" class="w-6 h-6 rounded-full object-cover">` : `<div class="w-6 h-6 rounded-full bg-tealAccent/20 flex items-center justify-center font-black text-tealAccent text-[8px]">${initial}</div>`;
            
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-[#151c2c] border border-gray-100 dark:border-white/5 rounded-xl p-4 shadow-sm hover:border-tealAccent/40 hover:shadow-teal-glow transition-all cursor-grab active:cursor-grabbing group btn-open-hrpanel';
            card.setAttribute('data-id', emp.id);
            card.innerHTML = `
                <div class="flex items-center justify-between mb-3 pointer-events-none">
                    <span class="text-[8px] font-black uppercase tracking-widest text-gray-400 group-hover:text-tealAccent transition-colors">ID: ${emp.id}</span>
                </div>
                <h4 class="text-xs font-bold text-gray-900 dark:text-white mb-1 tracking-tight truncate pointer-events-none">${emp.nombre} ${emp.apellido || ''}</h4>
                <div class="flex items-center justify-between mt-3 pointer-events-none">
                    <div class="flex items-center gap-2">
                        ${avatar}
                        <span class="text-[9px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[120px]">${emp.rol || 'Sin Rol'}</span>
                    </div>
                </div>
            `;
            colDiv.appendChild(card);
            
            card.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                openHRPanel(id);
            });
        });
        
        document.getElementById('count-inscrito').textContent = counts["Inscrito"];
        document.getElementById('count-docs').textContent = counts["Faltan Documentos"];
        document.getElementById('count-cap').textContent = counts["Capacitacion"];
        document.getElementById('count-activo').textContent = counts["Equipo Activo"];
        document.getElementById('count-inactivo').textContent = counts["Inactivo"];
    }

    function initSortableKanban() {
        if(typeof window.Sortable === 'undefined') {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js";
            script.onload = applySortable;
            document.head.appendChild(script);
        } else {
            applySortable();
        }
    }

    function applySortable() {
        const containers = document.querySelectorAll('.kanban-cards');
        containers.forEach(container => {
            new window.Sortable(container, {
                group: 'hr-kanban',
                animation: 150,
                ghostClass: 'opacity-40',
                dragClass: 'shadow-2xl',
                onEnd: async function (evt) {
                    const itemEl = evt.item;
                    const toList = evt.to;
                    const empId = itemEl.getAttribute('data-id');
                    const nuevoEstatus = toList.parentElement.getAttribute('data-status');
                    
                    const emp = empleadosData.find(e => String(e.id) === String(empId));
                    if(emp) {
                        emp.estatus_rrhh = nuevoEstatus;
                        
                        try {
                            await saveAdminWorker(emp);
                        } catch(err) { console.error("Error updating HR status:", err); }
                        
                        renderTabla();
                        renderKanban(); 
                    }
                }
            });
        });
    }

    function renderRecibos(roleFilter = 'vendedor', deptFilter = 'all', searchQuery = '') {
        const db = getDB();
        const allRecibos   = db.Recibos_Pagos     || [];
        allRecibos.sort((a, b) => {
            const dateA = new Date(a.fecha_recibo || a.created_at || 0);
            const dateB = new Date(b.fecha_recibo || b.created_at || 0);
            return dateB - dateA;
        });
        const usuarios     = db.Usuarios           || [];
        const proyectos    = db.Proyectos_Dinamicos|| [];
        const pipelines    = db.Admin_Pipelines    || [];

        // Helper: resolve department key (water/solar/home/otro) from recibo
        function getDeptKey(r) {
            if (r.departamento) return r.departamento.toLowerCase();
            if (r.proyecto_id) {
                const proy = proyectos.find(p => String(p.id) === String(r.proyecto_id));
                if (proy) {
                    const pip = pipelines.find(p => String(p.id) === String(proy.pipeline_id));
                    if (pip) {
                        const n = (pip.nombre || '').toLowerCase();
                        if (n.includes('water')) return 'water';
                        if (n.includes('solar')) return 'solar';
                        if (n.includes('home'))  return 'home';
                    }
                }
            }
            return 'otro';
        }

        // Dept config map
        const DEPT_CFG = {
            water: { label: 'Water', color: '#0ea5e9', icon: '<i class="fa-solid fa-water"></i>' },
            solar: { label: 'Solar', color: '#f59e0b', icon: '☀️' },
            home:  { label: 'Home',  color: '#a855f7', icon: '🏠' },
            otro:  { label: 'Otro',  color: '#94a3b8', icon: '<i class="fa-solid fa-clipboard"></i>' }
        };

        // Apply role + dept filters
        let filtered = allRecibos;
        if (roleFilter !== 'all') {
            if (roleFilter === 'oficina') {
                filtered = filtered.filter(r => r.tipo === 'oficina' || (r.trabajador_id && usuarios.find(u => String(u.id) === String(r.trabajador_id) && ['Manager', 'Admin', 'CEO'].includes(u.rol))));
            } else {
                filtered = filtered.filter(r => r.tipo === roleFilter);
            }
        }
        if (deptFilter !== 'all') filtered = filtered.filter(r => getDeptKey(r) === deptFilter);

        // Apply search query (worker name or client name)
        if (searchQuery) {
            filtered = filtered.filter(r =>
                (r.trabajador_nombre || '').toLowerCase().includes(searchQuery) ||
                (r.cliente_nombre   || '').toLowerCase().includes(searchQuery)
            );
        }

        const tbody = document.getElementById('rrhh-recibos-body');
        if (!tbody) return;

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-12 text-center text-gray-400 text-xs italic">Sin recibos para los filtros seleccionados.</td></tr>`;
            // Still wire buttons
            wireFilterBtns(roleFilter, deptFilter);
            return;
        }

        // Sort newest first
        const sorted = [...filtered].sort((a, b) => (b.fecha_recibo || '').localeCompare(a.fecha_recibo || ''));

        tbody.innerHTML = sorted.map(r => {
            const isVendedor = r.tipo === 'vendedor';
            const isOficina  = r.tipo === 'oficina' || (r.trabajador_id && usuarios.find(u => String(u.id) === String(r.trabajador_id) && ['Manager', 'Admin', 'CEO'].includes(u.rol)));
            const color      = isOficina ? '#8b5cf6' : (isVendedor ? '#3b82f6' : '#10b981');
            const tipoLabel  = isOficina ? 'Oficina' : (isVendedor ? 'Vendedor' : 'Técnico');
            const tipoIcon   = isOficina ? 'fa-building' : (isVendedor ? 'fa-dollar-sign' : 'fa-tools');

            // Worker info
            const worker     = r.trabajador_id ? usuarios.find(u => String(u.id) === String(r.trabajador_id)) : null;
            const workerName = worker ? `${worker.nombre || ''} ${worker.apellido || ''}`.trim() : (r.trabajador_nombre || 'Staff');
            const workerRol  = worker ? (worker.rol || '-') : (isOficina ? 'Oficina' : (isVendedor ? 'Vendedor' : 'Técnico'));
            const initial    = workerName[0]?.toUpperCase() || '?';
            const avatar     = worker?.foto
                ? `<img src="${worker.foto}" class="w-8 h-8 rounded-full object-cover border border-gray-100">`
                : `<div class="w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px]" style="background:${color}20;color:${color}">${initial}</div>`;

            // Department
            const dk   = getDeptKey(r);
            const dept = DEPT_CFG[dk] || DEPT_CFG.otro;

            // Monto
            const d = r.datos_json || {};
            const monto = isOficina
                ? (r.monto ? '$' + Number(r.monto).toLocaleString('en-US', {minimumFractionDigits:2}) : (d.grand_total ? '$' + Number(d.grand_total).toLocaleString('en-US', {minimumFractionDigits:2}) : '-'))
                : (isVendedor
                    ? (d.grand_total ? '$' + Number(d.grand_total).toLocaleString('en-US', {minimumFractionDigits:2}) : '-')
                    : (d.total_price  ? '$' + Number(d.total_price).toLocaleString('en-US',  {minimumFractionDigits:2}) : '-'));

            return `
            <tr class="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                        ${avatar}
                        <span class="font-bold text-gray-900 dark:text-white text-xs">${workerName}</span>
                    </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest" style="background:${color}15;color:${color};border:1px solid ${color}30">${workerRol}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 w-max" style="background:${dept.color}15;color:${dept.color};border:1px solid ${dept.color}30">
                        ${dept.icon} ${dept.label}
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-[10px] text-gray-600 dark:text-gray-400 font-medium">${r.cliente_nombre || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-[11px] font-black" style="color:${color}">${monto}</td>
                <td class="px-4 py-3 whitespace-nowrap text-[10px] text-gray-500">${r.fecha_recibo || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="flex items-center gap-1 text-[8px] font-black uppercase" style="color:${color}">
                        <i class="fa-solid ${tipoIcon} text-[7px]"></i>${tipoLabel}
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right">
                    ${r.pdf_url
                        ? `<a href="${r.pdf_url}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all" style="background:${color}15;color:${color};border:1px solid ${color}30;">
                               <i class="fa-solid fa-file-pdf"></i> Ver PDF</a>`
                        : `<span class="text-[9px] text-gray-300 italic">Sin PDF</span>`
                    }
                    <button onclick="event.stopPropagation(); window.openReciboModal && window.openReciboModal('${r.id}')" class="ml-2 text-tealAccent hover:text-teal-400 transition-colors p-2" title="Editar Recibo"><i class="fa-solid fa-pen text-[10px]"></i></button>
                    <button onclick="event.stopPropagation(); window.deleteRecibo('${r.id}')" class="text-red-400 hover:text-red-600 transition-colors p-2" title="Eliminar Recibo"><i class="fa-solid fa-trash text-[10px]"></i></button>
                </td>
            </tr>`;
        }).join('');

        wireFilterBtns(roleFilter, deptFilter);
    }

    async function renderAdelantos() {
        const tbody = document.getElementById('rrhh-adelantos-body');
        if (!tbody) return;

        try {
            const db = getDB();
            const adelantos = db.rrhh_adelantos || [];
            const usuarios = db.Usuarios || [];
            
            if (adelantos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-gray-400 text-xs italic">No se han registrado préstamos ni adelantos.</td></tr>`;
            } else {
                tbody.innerHTML = adelantos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(adel => {
                    const worker = usuarios.find(u => String(u.id) === String(adel.trabajador_id));
                    const name = worker ? `${worker.nombre} ${worker.apellido || ''}` : (adel.trabajador_nombre || 'N/A');
                    const initial = name[0]?.toUpperCase() || '?';
                    const avatar = worker?.foto ? `<img src="${worker.foto}" class="w-8 h-8 rounded-full object-cover">` : `<div class="w-8 h-8 rounded-full bg-tealAccent/10 flex items-center justify-center font-black text-tealAccent text-[10px]">${initial}</div>`;
                    
                    return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td class="px-4 py-3 whitespace-nowrap">
                            <div class="flex items-center gap-3">
                                ${avatar}
                                <span class="font-bold text-gray-900 dark:text-white text-xs">${name}</span>
                            </div>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap font-black text-tealAccent text-xs">$${Number(adel.monto).toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-[10px] text-gray-500">${adel.fecha || '-'}</td>
                        <td class="px-4 py-3 text-[10px] text-gray-600 dark:text-gray-400 italic">${adel.motivo || '-'}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-right flex items-center justify-end gap-1">
                            ${adel.document_url ? `<a href="${adel.document_url}" target="_blank" class="px-3 py-1 bg-tealAccent/10 text-tealAccent rounded-lg text-[8px] font-black uppercase border border-tealAccent/20 hover:bg-tealAccent/20 transition-all"><i class="fa-solid fa-file-pdf mr-1"></i>Ver Doc</a>` : '<span class="text-[9px] text-gray-300">Sin Doc</span>'}
                            ${(adel.status === 'Solventado' || adel.status === 'Pagado')
                                ? `<span class="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[8px] font-black uppercase border border-emerald-500/20">Pagado</span>`
                                : `<div class="flex items-center gap-2 justify-end">
                                     <span class="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[8px] font-black uppercase border border-amber-500/20">Pending</span>
                                     <button onclick="event.stopPropagation(); window.solventarAdelanto('${adel.id}')" class="px-3 py-1 bg-tealAccent/10 text-tealAccent rounded-lg text-[8px] font-black uppercase border border-tealAccent/20 hover:bg-tealAccent/20 transition-all" title="Marcar como Pagado"><i class="fa-solid fa-check mr-1"></i>Pagar</button>
                                   </div>`}
                            <button onclick="event.stopPropagation(); window.deleteAdelanto('${adel.id}')" class="px-2 py-1 bg-red-500/10 text-red-500 rounded-lg text-[10px] hover:bg-red-500/20 transition-all ml-1" title="Eliminar Adelanto"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>`;
                }).join('');
            }

            // Bind Add Button (re-bind just in case)
            window.openAdelantoModal = openAdelantoModal;

        } catch (err) {
            console.error("Error rendering adelantos:", err);
        }
    }

    function openAdelantoModal() {
        console.log("Opening Adelanto Modal...");
        const modal = document.getElementById('modal-adelanto');
        const select = document.getElementById('adel-trabajador-id');
        if (!modal || !select) {
            console.error("Modal elements not found!", { modal, select });
            return;
        }

        // Populate workers select
        select.innerHTML = '<option value="">Seleccione un trabajador...</option>' + 
            empleadosData.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(e => `<option value="${e.id}">${e.nombre} ${e.apellido || ''}</option>`).join('');

        // Use the application's standard modal display function
        if (window.showModal) {
            console.log("Using standard window.showModal...");
            window.showModal(modal);
        } else {
            console.warn("window.showModal not found, using fallback manual display...");
            modal.classList.remove('nuclear-hidden');
            modal.style.display = 'flex';
            modal.style.setProperty('display', 'flex', 'important');
            modal.style.zIndex = '10000';
        }

        // Diagnostic logs
        setTimeout(() => {
            const rect = modal.getBoundingClientRect();
            console.log("--- MODAL DIAGNOSTIC ---");
            console.log("ID:", modal.id);
            console.log("Size:", rect.width, "x", rect.height);
            console.log("Visible Style:", window.getComputedStyle(modal).display);
            console.log("Opacity:", window.getComputedStyle(modal).opacity);
            console.log("Z-Index:", window.getComputedStyle(modal).zIndex);
            console.log("Parent:", modal.parentElement ? modal.parentElement.tagName : 'None');
            console.log("------------------------");
        }, 100);

        // Initialize flatpickr explicitly attached to this modal to fix z-index issues
        if (typeof flatpickr !== 'undefined') {
            const dateInput = document.getElementById('adel-fecha');
            if (dateInput) {
                // If it was already initialized, destroy it first
                if (dateInput._flatpickr) dateInput._flatpickr.destroy();
                flatpickr(dateInput, {
                    dateFormat: "Y-m-d",
                    altInput: true,
                    altFormat: "m/d/Y",
                    allowInput: true,
                    monthSelectorType: "static",
                    animate: true,
                    disableMobile: "true",
                    appendTo: modal,
                    onReady: function(selectedDates, dateStr, instance) {
                        if (instance.calendarContainer) {
                            instance.calendarContainer.style.zIndex = '2147483647';
                        }
                    }
                });
            }
        }

        // Handle file change and drag/drop
        const dropZone = document.getElementById('drop-adelanto-doc');
        const fileInp = document.getElementById('inp-adelanto-doc');
        const label = document.getElementById('lbl-adelanto-doc');
        
        fileInp.onchange = (e) => {
            const file = e.target.files[0];
            if (file) label.textContent = file.name;
        };
        
        if (dropZone) {
            dropZone.ondragover = (e) => {
                e.preventDefault();
                dropZone.classList.add('border-tealAccent', 'bg-tealAccent/10');
            };
            dropZone.ondragleave = (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-tealAccent', 'bg-tealAccent/10');
            };
            dropZone.ondrop = (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-tealAccent', 'bg-tealAccent/10');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    fileInp.files = e.dataTransfer.files;
                    label.textContent = e.dataTransfer.files[0].name;
                }
            };
        }

        // Handle save
        document.getElementById('btn-save-adelanto').onclick = async () => {
            const workerId = select.value;
            const monto = document.getElementById('adel-monto').value;
            const fecha = document.getElementById('adel-fecha').value;
            const motivo = document.getElementById('adel-motivo').value;
            const deptoEl = document.getElementById('adel-departamento');
            const depto = deptoEl ? deptoEl.value : 'otro';
            const file = fileInp.files[0];

            if (!workerId || !monto || !fecha) {
                import('../components/toast.js').then(m => m.showToast('Complete los campos obligatorios.', 'error'));
                return;
            }

            const btn = document.getElementById('btn-save-adelanto');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

            try {
                let docUrl = null;
                if (file) {
                    docUrl = await uploadFile(file, 'hr-adelantos');
                }

                const worker = empleadosData.find(e => String(e.id) === String(workerId));
                const newAdelanto = {
                    id: (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
                    trabajador_id: workerId,
                    trabajador_nombre: worker ? `${worker.nombre} ${worker.apellido || ''}` : 'Staff',
                    monto: parseFloat(monto.replace(/,/g, '')),
                    fecha: fecha,
                    motivo: motivo,
                    departamento: depto,
                    document_url: docUrl,
                    created_at: new Date().toISOString()
                };

                const db = getDB();
                if (!db.rrhh_adelantos) db.rrhh_adelantos = [];
                db.rrhh_adelantos.push(newAdelanto);
                // Persist locally so data survives page reload
                try { localStorage.setItem('rs_admin_db', JSON.stringify(db)); } catch(e) {}

                const { saveGranular } = await import('../api.js');
                await saveGranular('rrhh_adelantos', [newAdelanto]);

                import('../components/toast.js').then(m => m.showToast('Adelanto registrado correctamente.', 'success'));
                
                // Clear fields
                document.getElementById('adel-monto').value = '';
                document.getElementById('adel-fecha').value = '';
                document.getElementById('adel-motivo').value = '';
                if (deptoEl) deptoEl.value = 'otro';
                select.value = '';
                fileInp.value = '';
                label.textContent = 'Haga clic para subir archivo';

                // Hide modal correctly
                if (window.hideModal) {
                    window.hideModal(modal);
                } else {
                    modal.classList.add('nuclear-hidden');
                    modal.style.display = 'none';
                    modal.style.setProperty('display', 'none', 'important');
                }
                
                // Update bell badge
                import('./../components/admin-notif-bell.js').then(m => {
                    if (m.updateAdminBellBadge) m.updateAdminBellBadge();
                });
                
                renderAdelantos();

            } catch (err) {
                console.error("Error saving adelanto:", err);
                import('../components/toast.js').then(m => m.showToast('Error al guardar.', 'error'));
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Guardar y Notificar';
            }
        };
    }
    window.openAdelantoModal = openAdelantoModal;

    function openReciboModal(editId = null) {
        console.log("Opening Recibo Modal...", editId);
        const modal = document.getElementById('modal-recibo-manual');
        const select = document.getElementById('recibo-trabajador-id');
        if (!modal || !select) {
            console.error("Modal elements not found!", { modal, select });
            return;
        }

        // Check if editing
        const db = getDB();
        const allRecibos = db.Recibos_Pagos || [];
        const editRecibo = editId ? allRecibos.find(r => r.id === editId) : null;

        // Populate workers select - include all workers
        const allowedWorkers = empleadosData.sort((a,b) => a.nombre.localeCompare(b.nombre));
        select.innerHTML = '<option value="">Seleccione un trabajador...</option>' + 
            allowedWorkers.map(e => `<option value="${e.id}">${e.nombre} ${e.apellido || ''} (${e.rol || 'Sin Rol'})</option>`).join('');

        if (window.showModal) {
            window.showModal(modal);
        } else {
            modal.classList.remove('nuclear-hidden');
            modal.style.display = 'flex';
            modal.style.setProperty('display', 'flex', 'important');
            modal.style.zIndex = '10000';
        }

        // Initialize flatpickr explicitly attached to this modal to fix z-index issues
        if (typeof flatpickr !== 'undefined') {
            const dateInput = document.getElementById('recibo-fecha');
            if (dateInput) {
                // If it was already initialized, destroy it first
                if (dateInput._flatpickr) dateInput._flatpickr.destroy();
                flatpickr(dateInput, {
                    dateFormat: "Y-m-d",
                    altInput: true,
                    altFormat: "m/d/Y",
                    allowInput: true,
                    monthSelectorType: "static",
                    animate: true,
                    disableMobile: "true",
                    appendTo: modal,
                    onReady: function(selectedDates, dateStr, instance) {
                        if (instance.calendarContainer) {
                            instance.calendarContainer.style.zIndex = '2147483647';
                        }
                    }
                });
            }
        }

        // Handle file change and drag/drop
        const dropZoneR = document.getElementById('drop-recibo-doc');
        const fileInp = document.getElementById('inp-recibo-doc');
        const label = document.getElementById('lbl-recibo-doc');
        
        // Reset or populate fields
        const btnSave = document.getElementById('btn-save-recibo-manual');
        btnSave.removeAttribute('data-edit-id');
        if (editRecibo) {
            select.value = editRecibo.trabajador_id || '';
            const d = editRecibo.datos_json || {};
            const amt = d.grand_total || d.total_price || editRecibo.monto || '';
            document.getElementById('recibo-monto').value = amt;
            if (document.getElementById('recibo-fecha')._flatpickr) {
                document.getElementById('recibo-fecha')._flatpickr.setDate(editRecibo.fecha_recibo || editRecibo.created_at);
            } else {
                document.getElementById('recibo-fecha').value = editRecibo.fecha_recibo || '';
            }
            document.getElementById('recibo-motivo').value = editRecibo.cliente_nombre || '';
            const deptoEl = document.getElementById('recibo-departamento');
            if (deptoEl) deptoEl.value = editRecibo.departamento || d.dpto || 'otro';
            label.textContent = editRecibo.pdf_url ? 'PDF Actual (Reemplazar opcional)' : 'Selecciona un documento PDF';
            btnSave.setAttribute('data-edit-id', editRecibo.id);
        } else {
            select.value = '';
            document.getElementById('recibo-monto').value = '';
            if (document.getElementById('recibo-fecha')._flatpickr) {
                document.getElementById('recibo-fecha')._flatpickr.clear();
            } else {
                document.getElementById('recibo-fecha').value = '';
            }
            document.getElementById('recibo-motivo').value = '';
            const deptoEl = document.getElementById('recibo-departamento');
            if (deptoEl) deptoEl.value = 'otro';
            label.textContent = 'Selecciona un documento PDF';
            fileInp.value = '';
        }
        
        fileInp.onchange = (e) => {
            const file = e.target.files[0];
            if (file) label.textContent = file.name;
        };
        
        if (dropZoneR) {
            dropZoneR.ondragover = (e) => {
                e.preventDefault();
                dropZoneR.classList.add('border-tealAccent', 'bg-tealAccent/10');
            };
            dropZoneR.ondragleave = (e) => {
                e.preventDefault();
                dropZoneR.classList.remove('border-tealAccent', 'bg-tealAccent/10');
            };
            dropZoneR.ondrop = (e) => {
                e.preventDefault();
                dropZoneR.classList.remove('border-tealAccent', 'bg-tealAccent/10');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    fileInp.files = e.dataTransfer.files;
                    label.textContent = e.dataTransfer.files[0].name;
                }
            };
        }

        document.getElementById('btn-save-recibo-manual').onclick = async () => {
            const workerId = select.value;
            const monto = document.getElementById('recibo-monto').value;
            const fecha = document.getElementById('recibo-fecha').value;
            const motivo = document.getElementById('recibo-motivo').value;
            const deptoEl = document.getElementById('recibo-departamento');
            const depto = deptoEl ? deptoEl.value : 'otro';
            const file = fileInp.files[0];

            if (!workerId || !monto || !fecha) {
                import('../components/toast.js').then(m => m.showToast('Complete los campos obligatorios.', 'error'));
                return;
            }

            const btn = document.getElementById('btn-save-recibo-manual');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

            try {
                let docUrl = null;
                if (file) {
                    docUrl = await uploadFile(file, 'hr-recibos');
                }

                const worker = empleadosData.find(e => String(e.id) === String(workerId));
                let computedTipo = 'oficina';
                if (worker) {
                    const r = (worker.rol || '').toLowerCase();
                    if (r.includes('técnico') || r.includes('tecnico')) {
                        computedTipo = 'tecnico';
                    } else if (r.includes('ventas') || r.includes('vendedor')) {
                        computedTipo = 'vendedor';
                    }
                }

                const editIdAttr = btn.getAttribute('data-edit-id');
                const db = getDB();
                if (!db.Recibos_Pagos) db.Recibos_Pagos = [];

                const payload = {
                    trabajador_id: workerId,
                    trabajador_nombre: worker ? `${worker.nombre} ${worker.apellido || ''}` : 'Staff',
                    cliente_nombre: motivo || 'Pago Manual',
                    tipo: computedTipo === 'oficina' ? 'vendedor' : computedTipo,
                    departamento: depto,
                    fecha_recibo: fecha,
                    datos_json: { grand_total: parseFloat(monto.toString().replace(/,/g, '')), subtipo: computedTipo, dpto: depto }
                };
                if (docUrl) payload.pdf_url = docUrl;

                let finalRecibo;
                if (editIdAttr) {
                    const idx = db.Recibos_Pagos.findIndex(r => String(r.id) === String(editIdAttr));
                    if (idx > -1) {
                        db.Recibos_Pagos[idx] = { ...db.Recibos_Pagos[idx], ...payload, actualizado_en: new Date().toISOString() };
                        finalRecibo = db.Recibos_Pagos[idx];
                    }
                } else {
                    finalRecibo = {
                        ...payload,
                        id: (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
                        created_at: new Date().toISOString()
                    };
                    db.Recibos_Pagos.push(finalRecibo);
                }

                try { localStorage.setItem('rs_admin_db', JSON.stringify(db)); } catch(e) {}

                const { saveGranular } = await import('../api.js');
                if (finalRecibo) {
                    await saveGranular('recibos_pagos', [finalRecibo]);
                }

                import('../components/toast.js').then(m => m.showToast(editIdAttr ? 'Recibo actualizado correctamente.' : 'Recibo registrado correctamente.', 'success'));
                
                // Clear fields
                document.getElementById('recibo-monto').value = '';
                document.getElementById('recibo-fecha').value = '';
                document.getElementById('recibo-motivo').value = '';
                if(deptoEl) deptoEl.value = 'otro';
                select.value = '';
                fileInp.value = '';
                label.textContent = 'Haga clic para subir archivo';
                btn.disabled = false;
                btn.innerHTML = 'Guardar y Notificar';

                if (window.hideModal) {
                    window.hideModal(modal);
                } else {
                    modal.classList.add('nuclear-hidden');
                    modal.style.display = 'none';
                    modal.style.setProperty('display', 'none', 'important');
                }
                
                // Re-render
                const roleBtn = document.querySelector('.rrhh-rf-btn.active');
                const deptBtn = document.querySelector('.rrhh-dept-btn.active');
                renderRecibos(roleBtn ? roleBtn.dataset.rf : 'all', deptBtn ? deptBtn.dataset.dept : 'all');

            } catch (err) {
                console.error("Error saving recibo:", err);
                btn.disabled = false;
                btn.innerHTML = 'Guardar y Notificar';
                import('../components/toast.js').then(m => m.showToast('Error al guardar.', 'error'));
            }
        };
    }
    window.openReciboModal = openReciboModal;

    function wireFilterBtns(currentRole, currentDept) {
        // Role filter buttons
        document.querySelectorAll('.rrhh-rf-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.rrhh-rf-btn').forEach(b => {
                    b.classList.remove('border-tealAccent', 'bg-tealAccent/10', 'text-tealAccent', 'active');
                    b.classList.add('border-gray-200', 'text-gray-500');
                });
                btn.classList.add('border-tealAccent', 'bg-tealAccent/10', 'text-tealAccent', 'active');
                btn.classList.remove('border-gray-200', 'text-gray-500');
                const activeDept = document.querySelector('.rrhh-dept-btn.active')?.dataset.dept || 'all';
                const searchQ = (document.getElementById('rrhh-recibos-search')?.value || '').toLowerCase().trim();
                renderRecibos(btn.dataset.rf, activeDept, searchQ);
            };
        });

        // Dept filter buttons
        const DEPT_COLORS = { water: '#0ea5e9', solar: '#f59e0b', home: '#a855f7' };
        document.querySelectorAll('.rrhh-dept-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.rrhh-dept-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.borderColor = '';
                    b.style.background  = '';
                    b.style.color       = '';
                    b.classList.add('border-gray-200', 'text-gray-500');
                });
                btn.classList.remove('border-gray-200', 'text-gray-500');
                btn.classList.add('active');
                const dk = btn.dataset.dept;
                if (dk === 'all') {
                    btn.style.borderColor = '#9ca3af';
                    btn.style.background  = 'rgba(156,163,175,0.1)';
                    btn.style.color       = '#4b5563';
                } else {
                    const c = DEPT_COLORS[dk] || '#9ca3af';
                    btn.style.borderColor = c;
                    btn.style.background  = c + '15';
                    btn.style.color       = c;
                }
                const activeRole = document.querySelector('.rrhh-rf-btn.active')?.dataset.rf || 'vendedor';
                const searchQ = (document.getElementById('rrhh-recibos-search')?.value || '').toLowerCase().trim();
                renderRecibos(activeRole, dk, searchQ);
            };
        });

        // Search input
        const searchInp = document.getElementById('rrhh-recibos-search');
        if (searchInp && !searchInp._wired) {
            searchInp._wired = true;
            searchInp.addEventListener('input', () => {
                const q = searchInp.value.toLowerCase().trim();
                const activeRole = document.querySelector('.rrhh-rf-btn.active')?.dataset.rf || 'vendedor';
                const activeDept = document.querySelector('.rrhh-dept-btn.active')?.dataset.dept || 'all';
                renderRecibos(activeRole, activeDept, q);
            });
        }
    }

    function openHRPanel(empId) {
        if (window.showWorkerDetail) {
            window.showWorkerDetail(empId);
        } else {
            console.warn("showWorkerDetail no está disponible");
        }
    }

    await init();
}

window.initHRModule = async function() {
    if (document.getElementById('main-canvas')) {
        await renderHRHub();
    }
};
