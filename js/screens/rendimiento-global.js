/* ============================================================
   RENEW OS – screens/rendimiento-global.js
   Gráfica multi-línea: Prospectos (Azul), Presentaciones (Amarillo), Ventas (Verde)
   Indicador separado: Tasa de Rendimiento (citas vs ventas concretadas)
   ============================================================ */
import { getDB, formatDate, isProjectFinished, getProjectDate } from '../api.js';

export async function renderRendimientoGlobal() {
    const canvas = document.getElementById('main-canvas');
    if (!canvas) return;

    canvas.innerHTML = `
        <div class="p-8 space-y-8 animate-fadeIn">

            <!-- Filters Row -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <!-- Tabs Ecosystem -->
                <div class="flex items-center gap-4 bg-gray-100 dark:bg-white/5 p-1.5 rounded-2xl w-fit">
                    <button id="tab-home"  onclick="window.filterGlobalEco('Home')"  class="eco-tab px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-gray-500 hover:text-tealAccent">Renew Home</button>
                    <button id="tab-solar" onclick="window.filterGlobalEco('Solar')" class="eco-tab px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-gray-500 hover:text-tealAccent">Renew Solar</button>
                    <button id="tab-water" onclick="window.filterGlobalEco('Water')" class="eco-tab px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-gray-500 hover:text-tealAccent">Renew Water</button>
                    <button id="tab-group" onclick="window.filterGlobalEco('Group')" class="eco-tab px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-gray-500 hover:text-tealAccent">Renew Group</button>
                </div>

                <!-- Time Filters -->  
                <div class="flex flex-col gap-3">
                    <!-- Quick filters -->
                    <div class="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-1.5 rounded-2xl w-fit">
                        <button id="range-weekly"  onclick="window.setGlobalRange('weekly')"  class="range-tab px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-gray-500 hover:text-tealAccent">Semanal</button>
                        <button id="range-monthly" onclick="window.setGlobalRange('monthly')" class="range-tab active px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Mensual</button>
                        <button id="range-annual"  onclick="window.setGlobalRange('annual')"  class="range-tab px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-gray-500 hover:text-tealAccent">Anual</button>
                        <button id="range-custom"  onclick="window.toggleDatePicker()"        class="range-tab px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-gray-500 hover:text-tealAccent flex items-center gap-1.5"><svg xmlns='http://www.w3.org/2000/svg' class='w-3 h-3' fill='none' viewBox='0 0 24 24' stroke='currentColor'><rect x='3' y='4' width='18' height='18' rx='2' stroke-width='2'/><line x1='16' y1='2' x2='16' y2='6' stroke-width='2'/><line x1='8' y1='2' x2='8' y2='6' stroke-width='2'/><line x1='3' y1='10' x2='21' y2='10' stroke-width='2'/></svg>Rango</button>
                    </div>
                    <!-- Custom date range (hidden by default) -->
                    <div id="custom-date-picker" class="hidden items-center gap-3 bg-white dark:bg-darkCard border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 shadow-lg">
                        <div class="flex items-center gap-2">
                            <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Desde</label>
                            <input id="date-from" type="date" onchange="window.applyCustomRange()" class="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-tealAccent/40">
                        </div>
                        <span class="text-gray-300 font-bold">→</span>
                        <div class="flex items-center gap-2">
                            <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hasta</label>
                            <input id="date-to" type="date" onchange="window.applyCustomRange()" class="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-tealAccent/40">
                        </div>
                        <button onclick="window.clearCustomRange()" class="ml-2 text-[10px] font-black text-gray-400 hover:text-red-400 transition-all uppercase tracking-widest"><i class="fa-solid fa-xmark text-red-500"></i> Limpiar</button>
                    </div>
                </div>
            </div>

            <!-- Vendor Filter Row -->
            <div class="flex items-center gap-4">
                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtrar por vendedor:</span>
                <div id="vendor-selector-wrapper" class="relative">
                    <!-- Trigger button -->
                    <button id="vendor-selector-btn" onclick="window.toggleVendorDropdown()" class="flex items-center gap-2 bg-white dark:bg-darkCard border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2.5 text-xs font-black text-gray-700 dark:text-white shadow-sm hover:border-tealAccent/40 transition-all min-w-[200px]">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-tealAccent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>
                        <span id="vendor-btn-label" class="flex-1 text-left">Todos los vendedores</span>
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <!-- Dropdown panel -->
                    <div id="vendor-dropdown" class="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-darkCard border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl min-w-[280px] overflow-hidden">
                        <!-- Header -->
                        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Seleccionar vendedores</span>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input id="vendor-cb-all" type="checkbox" checked onchange="window.selectAllVendors(this.checked)" class="w-4 h-4 accent-teal-400">
                                <span class="text-[10px] font-black text-tealAccent uppercase tracking-widest">Todos</span>
                            </label>
                        </div>
                        <!-- Vendor list -->
                        <div id="vendor-cb-list" class="max-h-[260px] overflow-y-auto py-2">
                            <p class="px-4 py-2 text-xs text-gray-400">Cargando...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- KPI Cards (4 cols) -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- Prospectos -->
                <div class="bg-white dark:bg-darkCard p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-premium group hover:border-blue-400/30 transition-all">
                    <p class="text[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Prospectos</p>
                    <div class="flex items-end gap-3">
                        <h3 id="kpi-total-contactos" class="text-3xl font-black text-gray-900 dark:text-white">0</h3>
                        <span id="kpi-prospectos-pct" class="text-sm font-black text-blue-400 mb-1"></span>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-1 font-medium">Total de contactos registrados</p>
                </div>

                <!-- Presentaciones -->
                <div class="bg-white dark:bg-darkCard p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-premium group hover:border-amber-400/30 transition-all">
                    <p class="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] mb-2">Presentaciones</p>
                    <div class="flex items-end gap-3">
                        <h3 id="kpi-proyectos-abiertos" class="text-3xl font-black text-gray-900 dark:text-white">0</h3>
                        <span id="kpi-presentaciones-pct" class="text-sm font-black text-amber-400 mb-1"></span>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-1 font-medium">Citas con presentación activa</p>
                </div>

                <!-- Ventas -->
                <div class="bg-white dark:bg-darkCard p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-premium group hover:border-emerald-400/30 transition-all">
                    <p class="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">Ventas</p>
                    <div class="flex items-end gap-3">
                        <h3 id="kpi-ventas-totales" class="text-3xl font-black text-gray-900 dark:text-white">0</h3>
                        <span id="kpi-ventas-pct" class="text-sm font-black text-emerald-400 mb-1"></span>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-1 font-medium">Proyectos concretados</p>
                </div>

                <!-- Tasa de Rendimiento (indicador visual) -->
                <div class="bg-white dark:bg-darkCard p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-premium group hover:border-purple-400/30 transition-all relative overflow-hidden">
                    <p class="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-2">Tasa de Rendimiento</p>
                    <div class="flex items-end gap-3">
                        <h3 id="kpi-tasa-cierre" class="text-3xl font-black text-gray-900 dark:text-white">0%</h3>
                        <span id="kpi-tasa-icon" class="text-xl mb-1">—</span>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-1 font-medium">Citas → ventas concretadas</p>
                    <!-- Progress bar -->
                    <div class="mt-4 w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div id="kpi-tasa-bar" class="h-full rounded-full transition-all duration-700"
                             style="width:0%; background: linear-gradient(90deg,#a855f7,#7c3aed);"></div>
                    </div>
                    <!-- Benchmark label -->
                    <div class="flex justify-between mt-1">
                        <span class="text-[9px] text-gray-400 font-bold">0%</span>
                        <span id="kpi-tasa-label" class="text-[9px] font-black text-purple-400">Calculando…</span>
                        <span class="text-[9px] text-gray-400 font-bold">100%</span>
                    </div>
                </div>
            </div>

            <!-- Chart + Legend -->
            <div class="bg-white dark:bg-darkCard p-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-premium">
                <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h4 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Desempeño Global</h4>
                        <p id="chart-subtitle" class="text-xs text-gray-500 font-medium mt-1">Evolución de prospectos, presentaciones y ventas del mes.</p>
                    </div>
                    <!-- Legend -->
                    <div class="flex items-center gap-6 flex-shrink-0">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full bg-blue-400 shadow-sm"></span>
                            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Prospectos</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full bg-amber-400 shadow-sm"></span>
                            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Presentaciones</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full bg-emerald-400 shadow-sm"></span>
                            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ventas</span>
                        </div>
                    </div>
                </div>
                <div class="h-[300px] relative">
                    <canvas id="globalPerformanceChart"></canvas>
                </div>
            </div>

            <!-- Global Leaderboard -->
            <div class="bg-white dark:bg-darkCard rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-premium overflow-hidden">
                <div class="p-10 border-b border-gray-100 dark:border-white/5">
                    <h4 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Global Leaderboard</h4>
                    <p class="text-xs text-gray-500 font-medium">Ranking de representantes por rendimiento.</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-50 dark:bg-white/5">
                                <th class="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Representante</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ventas</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tasa Cierre</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Comisiones Proy.</th>
                            </tr>
                        </thead>
                        <tbody id="global-leaderboard-body"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <style>
            .eco-tab.active  { background:#00f5d4; color:#000; box-shadow:0 4px 15px rgba(0,245,212,.2); }
            .range-tab.active{ background:#00f5d4; color:#000; box-shadow:0 4px 15px rgba(0,245,212,.2); }
            #custom-date-picker.visible { display:flex; }
            #date-from, #date-to { color-scheme: dark; }
            #vendor-dropdown { display:none; }
            #vendor-dropdown.open { display:block; }
            .vendor-checkbox-item:hover { background:rgba(0,245,212,.05); }
            .vendor-checkbox-item input[type=checkbox]:checked + span { color:#00f5d4; }
        </style>
    `;

    // ── State ──────────────────────────────────────────────────────────────────
    window.globalActiveEco      = 'Solar';
    window.globalTimeRange      = 'monthly';
    window.globalDateFrom       = null;
    window.globalDateTo         = null;
    window.globalSelectedVendors = []; // [] = todos

    window.filterGlobalEco = (eco) => {
        window.globalActiveEco = eco;
        document.querySelectorAll('.eco-tab').forEach(btn => {
            const match = btn.textContent.includes(eco);
            btn.classList.toggle('active', match);
            btn.classList.toggle('text-gray-500', !match);
            btn.classList.toggle('hover:text-tealAccent', !match);
        });
        // Re-populate vendor dropdown on ecosystem change
        _populateVendorDropdown(window.globalActiveEco);
        updateGlobalData(window.globalActiveEco, window.globalTimeRange, window.globalDateFrom, window.globalDateTo, window.globalSelectedVendors);
    };

    window.setGlobalRange = (range) => {
        window.globalTimeRange = range;
        // Hide date picker if switching away from custom
        if (range !== 'custom') {
            window.globalDateFrom = null;
            window.globalDateTo   = null;
            const picker = document.getElementById('custom-date-picker');
            if (picker) { picker.classList.remove('visible'); picker.classList.add('hidden'); }
            const rangeCustomBtn = document.getElementById('range-custom');
            if (rangeCustomBtn) rangeCustomBtn.classList.remove('active');
        }
        document.querySelectorAll('.range-tab').forEach(btn => {
            const match = btn.id === `range-${range}`;
            btn.classList.toggle('active', match);
            btn.classList.toggle('text-gray-500', !match);
            btn.classList.toggle('hover:text-tealAccent', !match);
        });
        updateGlobalData(window.globalActiveEco, window.globalTimeRange, window.globalDateFrom, window.globalDateTo, window.globalSelectedVendors);
    };

    window.toggleDatePicker = () => {
        const picker = document.getElementById('custom-date-picker');
        if (!picker) return;
        const isVisible = picker.classList.contains('visible');
        if (isVisible) {
            picker.classList.remove('visible'); picker.classList.add('hidden');
            document.getElementById('range-custom').classList.remove('active');
        } else {
            picker.classList.remove('hidden'); picker.classList.add('visible');
            document.getElementById('range-custom').classList.add('active');
            // Set default dates if empty
            const now = new Date();
            const fromEl = document.getElementById('date-from');
            const toEl   = document.getElementById('date-to');
            if (fromEl && !fromEl.value) {
                const first = new Date(now.getFullYear(), now.getMonth(), 1);
                fromEl.value = first.toISOString().split('T')[0];
            }
            if (toEl && !toEl.value) toEl.value = now.toISOString().split('T')[0];
            window.applyCustomRange();
        }
    };

    window.applyCustomRange = () => {
        const fromEl = document.getElementById('date-from');
        const toEl   = document.getElementById('date-to');
        if (!fromEl || !toEl || !fromEl.value || !toEl.value) return;
        window.globalDateFrom  = new Date(fromEl.value + 'T00:00:00');
        window.globalDateTo    = new Date(toEl.value   + 'T23:59:59');
        window.globalTimeRange = 'custom';
        // Mark all quick-filter buttons inactive except custom
        document.querySelectorAll('.range-tab').forEach(btn => {
            const match = btn.id === 'range-custom';
            btn.classList.toggle('active', match);
            btn.classList.toggle('text-gray-500', !match);
            btn.classList.toggle('hover:text-tealAccent', !match);
        });
        updateGlobalData(window.globalActiveEco, 'custom', window.globalDateFrom, window.globalDateTo, window.globalSelectedVendors);
    };

    window.clearCustomRange = () => {
        window.globalDateFrom = null; window.globalDateTo = null;
        const fromEl = document.getElementById('date-from');
        const toEl   = document.getElementById('date-to');
        if (fromEl) fromEl.value = ''; if (toEl) toEl.value = '';
        window.setGlobalRange('monthly');
    };

    // ── Vendor Selector ──────────────────────────────────────────────────────────
    window.selectAllVendors = (checked) => {
        const checks = document.querySelectorAll('#vendor-cb-list input[type=checkbox]');
        checks.forEach(cb => cb.checked = checked);
        window.globalSelectedVendors = []; // Always empty when 'All' is toggled (empty means all)
        if (!checked) {
             // If unchecking 'All', we technically select nothing? 
             // Usually unchecking 'All' means you want to pick specific ones.
             // Let's keep it simple: if 'All' is checked, we pass [].
        }
        window.applyVendorFilter();
    };

    window.toggleVendorDropdown = () => {
        const dd = document.getElementById('vendor-dropdown');
        if (dd) dd.classList.toggle('open');
    };

    window.applyVendorFilter = () => {
        const allCb = document.getElementById('vendor-cb-all');
        const listChecks = document.querySelectorAll('#vendor-cb-list input[type=checkbox]');
        const selected = [];
        
        listChecks.forEach(cb => { if (cb.checked) selected.push(cb.value); });

        // If we unchecked one individual, uncheck "All"
        if (selected.length < listChecks.length) {
            if (allCb) allCb.checked = false;
        } else if (selected.length === listChecks.length) {
            if (allCb) allCb.checked = true;
        }

        window.globalSelectedVendors = (allCb && allCb.checked) ? [] : selected;
        _updateVendorBtnLabel();
        updateGlobalData(window.globalActiveEco, window.globalTimeRange, window.globalDateFrom, window.globalDateTo, window.globalSelectedVendors);
    };

    // Build vendor checkbox list for the current ecosystem
    async function _populateVendorDropdown(eco) {
        const { getAdminWorkers } = await import('../api.js');
        const allWorkers = await getAdminWorkers();
        const vendors = allWorkers.filter(u => {
            const role = (u.rol || '').toLowerCase();
            return role.includes('vendedor') || role.includes('representante') || role.includes('admin') || role.includes('ceo');
        });
        const list = document.getElementById('vendor-cb-list');
        if (!list) return;
        list.innerHTML = vendors.map(v => `
            <label class="vendor-checkbox-item flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all">
                <input type="checkbox" value="${v.id}" onchange="window.applyVendorFilter()"
                       class="w-4 h-4 accent-teal-400 rounded"
                       ${(window.globalSelectedVendors.length === 0 || window.globalSelectedVendors.includes(v.id)) ? 'checked' : ''}>
                <span class="text-xs font-bold text-gray-700 dark:text-gray-200">${v.nombre} ${v.apellido || ''}</span>
                <span class="ml-auto text-[9px] font-black uppercase text-gray-400">${v.rol || ''}</span>
            </label>
        `).join('');
        
        // Sync 'All' checkbox
        const allCb = document.getElementById('vendor-cb-all');
        if (allCb) allCb.checked = (window.globalSelectedVendors.length === 0);
        
        _updateVendorBtnLabel();
    }

    function _updateVendorBtnLabel() {
        const btn = document.getElementById('vendor-selector-btn');
        if (!btn) return;
        const count = window.globalSelectedVendors.length;
        btn.querySelector('#vendor-btn-label').textContent = count === 0 ? 'Todos los vendedores' : `${count} vendedor${count > 1 ? 'es' : ''} seleccionado${count > 1 ? 's' : ''}`;
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('vendor-selector-wrapper');
        const dd = document.getElementById('vendor-dropdown');
        if (wrapper && dd && !wrapper.contains(e.target)) dd.classList.remove('open');
    }, { once: false });

    // Initial load
    window.filterGlobalEco('Solar');
}

// ── Chart instance ─────────────────────────────────────────────────────────────
let globalChartInstance = null;

// ── Main data function ─────────────────────────────────────────────────────────
async function updateGlobalData(ecosystem, range = 'monthly', dateFrom = null, dateTo = null, vendorIds = []) {
    const db = getDB();
    const { getAdminWorkers } = await import('../api.js');
    const allWorkers = await getAdminWorkers();
    const relevantVendors = allWorkers.filter(u => {
        const role = (u.rol || '').toLowerCase();
        return role.includes('vendedor') || role.includes('representante') || role.includes('admin') || role.includes('ceo');
    });

    const clients  = db.Clientes_Maestro   || [];
    const projects = db.Proyectos_Dinamicos || [];

    const isGroup        = ecosystem.toLowerCase() === 'group';
    const ecosystemLower = ecosystem.toLowerCase();
    const filterByVendors = vendorIds && vendorIds.length > 0;

    // ── 1. Filter clients by ecosystem [+ vendor] ─────────────────────────────
    const ecoClients = (isGroup ? clients : clients.filter(c =>
        (c.departamento || '').toLowerCase().includes(ecosystemLower)
    )).filter(c => {
        if (!filterByVendors) return true;
        return vendorIds.includes(String(c.vendedor_asignado_id));
    });

    // ── 2. Filter projects by ecosystem [+ vendor] ────────────────────────────
    const ecoProjects = (isGroup ? projects : projects.filter(p => {
        const pipe = (db.Admin_Pipelines || []).find(pip => String(pip.id) === String(p.pipeline_id));
        if (!pipe) return false;
        const pipeName = (pipe.nombre || '').toLowerCase();
        const ecoLower = ecosystemLower.replace('renew ', '').trim();
        return pipeName.includes(ecosystemLower) || pipeName.includes(ecoLower);
    })).filter(p => {
        if (!filterByVendors) return true;
        if (vendorIds.includes(String(p.responsable_id))) return true;
        const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(p.cliente_id));
        return cli && vendorIds.includes(String(cli.vendedor_asignado_id));
    });

    // ── 3. Time filter ────────────────────────────────────────────────────────
    const now          = new Date();
    const currentMonth = now.getMonth();
    const currentYear  = now.getFullYear();

    // Build start/end bounds for each range
    let rangeStart, rangeEnd;
    if (range === 'weekly') {
        const day = now.getDay(); // 0=Sun
        rangeStart = new Date(now); rangeStart.setDate(now.getDate() - day); rangeStart.setHours(0,0,0,0);
        rangeEnd   = new Date(now); rangeEnd.setHours(23,59,59,999);
    } else if (range === 'monthly') {
        rangeStart = new Date(currentYear, currentMonth, 1);
        rangeEnd   = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    } else if (range === 'annual') {
        rangeStart = new Date(currentYear, 0, 1);
        rangeEnd   = new Date(currentYear, 11, 31, 23, 59, 59);
    } else if (range === 'custom' && dateFrom && dateTo) {
        rangeStart = dateFrom;
        rangeEnd   = dateTo;
    } else {
        rangeStart = null; rangeEnd = null; // total / no filter
    }

    const safeDate = (raw) => {
        if (!raw) return null;
        let str = String(raw).trim();
        if (str.includes(' ') && !str.includes('T')) str = str.replace(' ', 'T');
        if (!str.includes('T')) str += 'T12:00:00';
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    };

    const inRange = (dateStr) => {
        if (!rangeStart || !rangeEnd) return true;
        const d = safeDate(dateStr);
        if (!d) return false;
        return d >= rangeStart && d <= rangeEnd;
    };

    // ── 4. KPIs based on Projects ──────────

    const filteredClients = ecoClients.filter(c => inRange(c.fecha_registro || c.fecha || c.created_at));
    const openProjects   = ecoProjects.filter(p => !isProjectFinished(p, db) && inRange(getProjectDate(p, db)));
    const closedProjects = ecoProjects.filter(p => isProjectFinished(p, db) && inRange(getProjectDate(p, db)));

    const totalProspectos     = filteredClients.length; // all clients in the ecosystem
    const totalPresentaciones = openProjects.length;
    const totalVentas         = closedProjects.length;

    // Tasa de Rendimiento
    const totalActivos  = totalProspectos;
    const closeRate     = totalActivos > 0 ? Math.round((totalVentas / totalActivos) * 100) : 0;

    // ── Percentages ───────────────────────────────────────────────────────────
    const prospectosPct = filteredClients.length > 0
        ? Math.round((totalPresentaciones / filteredClients.length) * 100)
        : 0;
    const presentacionesPct = totalActivos > 0
        ? Math.round((totalPresentaciones / totalActivos) * 100)
        : 0;
    const ventasPct = closeRate;

    document.getElementById('kpi-total-contactos').textContent    = totalProspectos;
    document.getElementById('kpi-proyectos-abiertos').textContent = totalPresentaciones;
    document.getElementById('kpi-ventas-totales').textContent     = totalVentas;
    document.getElementById('kpi-tasa-cierre').textContent        = `${closeRate}%`;

    const elPPct = document.getElementById('kpi-prospectos-pct');
    const elPresPct = document.getElementById('kpi-presentaciones-pct');
    const elVPct = document.getElementById('kpi-ventas-pct');
    if (elPPct)    elPPct.textContent    = prospectosPct > 0    ? `${prospectosPct}% con proyecto`    : '';
    if (elPresPct) elPresPct.textContent = totalPresentaciones > 0       ? `${presentacionesPct}% en curso`    : '';
    if (elVPct)    elVPct.textContent    = ventasPct > 0        ? `${ventasPct}% tasa de cierre`      : '';

    // Progress bar + icon
    const bar   = document.getElementById('kpi-tasa-bar');
    const icon  = document.getElementById('kpi-tasa-icon');
    const label = document.getElementById('kpi-tasa-label');
    if (bar) bar.style.width = `${Math.min(closeRate, 100)}%`;
    if (icon) {
        if      (closeRate >= 60) { icon.innerHTML = '<i class="fa-solid fa-rocket"></i>'; }
        else if (closeRate >= 30) { icon.innerHTML = '<i class="fa-solid fa-chart-line"></i>'; }
        else if (closeRate >  0)  { icon.innerHTML = '<i class="fa-solid fa-arrow-trend-down"></i>'; }
        else                      { icon.innerHTML = '—';  }
    }
    if (label) {
        if      (closeRate >= 60) label.textContent = 'Excelente';
        else if (closeRate >= 30) label.textContent = 'En progreso';
        else if (closeRate >  0)  label.textContent = 'Por mejorar';
        else                      label.textContent = 'Sin datos';
    }

    // ── 5. Leaderboard ────────────────────────────────────────────────────────
    const leaderboardData = relevantVendors.map(v => {
        const vProjects = ecoProjects.filter(p => {
            if (!inRange(getProjectDate(p, db))) return false;
            if (String(p.responsable_id) === String(v.id)) return true;
            const cli = ecoClients.find(c => String(c.id) === String(p.cliente_id));
            return cli && String(cli.vendedor_asignado_id) === String(v.id);
        });
        const vTotal   = vProjects.length;
        const vClosed  = vProjects.filter(p => isProjectFinished(p, db)).length;
        const vCloseRate = vTotal > 0 ? Math.round((vClosed / vTotal) * 100) : 0;
        return {
            ...v,
            sales:       vClosed,
            closeRate:   vCloseRate,
            commissions: vClosed * 1000
        };
    }).sort((a, b) => b.sales - a.sales);

    const tbody = document.getElementById('global-leaderboard-body');
    if (tbody) {
        tbody.innerHTML = leaderboardData.map(v => `
            <tr class="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                <td class="px-8 py-6">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full border-2 border-tealAccent/20 flex items-center justify-center text-xs font-black bg-tealAccent/10 text-tealAccent overflow-hidden">
                            ${v.foto ? `<img src="${v.foto}" class="w-full h-full object-cover">` : (v.initials || (v.nombre ? v.nombre[0] : '?'))}
                        </div>
                        <div>
                            <p class="text-sm font-black text-gray-900 dark:text-white leading-none">${v.nombre || 'Sin Nombre'} ${v.apellido || ''}</p>
                            <p class="text-[10px] text-gray-500 font-bold uppercase mt-1">${v.rol || 'Representante'}</p>
                        </div>
                    </div>
                </td>
                <td class="px-8 py-6">
                    <span class="text-sm font-black text-gray-900 dark:text-white">${v.sales}</span>
                </td>
                <td class="px-8 py-6">
                    <div class="flex items-center gap-2">
                        <div class="w-12 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full bg-tealAccent shadow-teal-glow" style="width:${v.closeRate}%"></div>
                        </div>
                        <span class="text-[10px] font-black text-gray-500">${v.closeRate}%</span>
                    </div>
                </td>
                <td class="px-8 py-6 text-right">
                    <span class="text-sm font-black text-tealAccent">$${v.commissions.toLocaleString()}</span>
                </td>
            </tr>
        `).join('');
    }

    // ── 6. Chart Data ─────────────────────────────────────────────────────────
    let labels = [];
    let dataProspectos    = [];
    let dataPresentaciones = [];
    let dataVentas        = [];
    let subtitleText      = '';

    // Plot helpers 
    const plotByDay = (start, end, clientsArr, openArr, closedArr) => {
        const msDay = 86400000;
        const days  = Math.round((end - start) / msDay) + 1;
        const lbs   = [];
        const dp    = Array(days).fill(0);
        const dpr   = Array(days).fill(0);
        const dv    = Array(days).fill(0);
        for (let i = 0; i < days; i++) {
            const d = new Date(start.getTime() + i * msDay);
            lbs.push(`${d.getDate()}/${d.getMonth()+1}`);
        }
        clientsArr.forEach(c => {
            const d = safeDate(c.fecha_registro || c.fecha || c.created_at);
            if (!d) return;
            const idx = Math.round((d - start) / msDay);
            if (idx >= 0 && idx < days) dp[idx]++;
        });
        openArr.forEach(p => {
            const d = safeDate(getProjectDate(p, db));
            if (!d) return;
            const idx = Math.round((d - start) / msDay);
            if (idx >= 0 && idx < days) dpr[idx]++;
        });
        closedArr.forEach(p => {
            const d = safeDate(getProjectDate(p, db));
            if (!d) return;
            const idx = Math.round((d - start) / msDay);
            if (idx >= 0 && idx < days) dv[idx]++;
        });
        return { lbs, dp, dpr, dv };
    };

    const plotByMonth = (year, clientsArr, openArr, closedArr) => {
        const mn  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const dp  = Array(12).fill(0);
        const dpr = Array(12).fill(0);
        const dv  = Array(12).fill(0);
        clientsArr.forEach(c => { const d = safeDate(c.fecha_registro||c.fecha||c.created_at); if(d && d.getFullYear()===year) dp[d.getMonth()]++; });
        openArr.forEach(p => { const d = safeDate(getProjectDate(p, db)); if(d && d.getFullYear()===year) dpr[d.getMonth()]++; });
        closedArr.forEach(p => { const d = safeDate(getProjectDate(p, db)); if(d && d.getFullYear()===year) dv[d.getMonth()]++; });
        return { lbs: mn, dp, dpr, dv };
    };

    // Data grouped for chart
    const chartClientes     = ecoClients;
    const chartEnProceso    = openProjects;
    const chartVentas       = closedProjects;

    if (range === 'weekly') {
        const r = plotByDay(rangeStart, rangeEnd, chartClientes, chartEnProceso, chartVentas);
        labels = r.lbs; dataProspectos = r.dp; dataPresentaciones = r.dpr; dataVentas = r.dv;
        subtitleText = 'Actividad de la semana en curso.';
    } else if (range === 'monthly') {
        const r = plotByDay(rangeStart, rangeEnd, chartClientes, chartEnProceso, chartVentas);
        labels = r.lbs; dataProspectos = r.dp; dataPresentaciones = r.dpr; dataVentas = r.dv;
        subtitleText = 'Evolución de prospectos, presentaciones y ventas del mes.';
    } else if (range === 'annual') {
        const r = plotByMonth(currentYear, chartClientes, chartEnProceso, chartVentas);
        labels = r.lbs; dataProspectos = r.dp; dataPresentaciones = r.dpr; dataVentas = r.dv;
        subtitleText = `Resumen anual ${currentYear}.`;
    } else if (range === 'custom' && rangeStart && rangeEnd) {
        const diffDays = Math.round((rangeEnd - rangeStart) / 86400000);
        if (diffDays <= 62) {
            const r = plotByDay(rangeStart, rangeEnd, chartClientes, chartEnProceso, chartVentas);
            labels = r.lbs; dataProspectos = r.dp; dataPresentaciones = r.dpr; dataVentas = r.dv;
        } else {
            const r = plotByMonth(rangeStart.getFullYear(), chartClientes, chartEnProceso, chartVentas);
            labels = r.lbs; dataProspectos = r.dp; dataPresentaciones = r.dpr; dataVentas = r.dv;
        }
        const fmt = d => d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
        subtitleText = `Rango personalizado: ${fmt(rangeStart)} → ${fmt(rangeEnd)}.`;

    }

    const subtitle = document.getElementById('chart-subtitle');
    if (subtitle && subtitleText) subtitle.textContent = subtitleText;

    // ── 7. Render Chart ───────────────────────────────────────────────────────
    const chartCanvas = document.getElementById('globalPerformanceChart');
    if (!chartCanvas) return;

    const ctx = chartCanvas.getContext('2d');
    if (globalChartInstance) { globalChartInstance.destroy(); globalChartInstance = null; }

    globalChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Prospectos', 'Presentaciones', 'Ventas'],
            datasets: [{
                data: [totalProspectos, totalPresentaciones, totalVentas],
                backgroundColor: ['#60a5fa', '#fbbf24', '#34d399'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#111827',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    bodyFont: { size: 12, weight: 'bold' },
                    padding: 12,
                    borderColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    displayColors: true,
                    usePointStyle: true
                }
            }
        }
    });
}
