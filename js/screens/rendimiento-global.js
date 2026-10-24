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
        <div class="space-y-6 animate-fadeIn">

            <!-- Filters Row -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <!-- Tabs Ecosystem -->
                <div class="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200/50 dark:border-white/5 w-fit" id="rendimiento-eco-tabs">
                    <!-- Tabs will be dynamically inserted here -->
                </div>

                <!-- Time Filters -->  
                <div class="flex flex-col sm:flex-row items-center gap-3">
                    <!-- Quick filters -->
                    <div class="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200/50 dark:border-white/5 w-fit">
                        <button id="range-weekly"  onclick="window.setGlobalRange('weekly')"  class="range-tab px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-500 hover:text-tealAccent">Semanal</button>
                        <button id="range-monthly" onclick="window.setGlobalRange('monthly')" class="range-tab active px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white dark:bg-[#0c1322] text-tealAccent shadow-sm">Mensual</button>
                        <button id="range-annual"  onclick="window.setGlobalRange('annual')"  class="range-tab px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-500 hover:text-tealAccent">Anual</button>
                        
                        <!-- Selector de Meses del Año -->
                        <div class="relative inline-block" id="months-selector-wrapper">
                            <button id="range-months-btn" onclick="window.toggleMonthsDropdown()" class="range-tab px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-500 hover:text-tealAccent flex items-center gap-1.5">
                                <svg xmlns='http://www.w3.org/2000/svg' class='w-3.5 h-3.5 text-tealAccent' fill='none' viewBox='0 0 24 24' stroke='currentColor'><rect x='3' y='4' width='18' height='18' rx='2' stroke-width='2'/><line x1='16' y1='2' x2='16' y2='6' stroke-width='2'/><line x1='8' y1='2' x2='8' y2='6' stroke-width='2'/><line x1='3' y1='10' x2='21' y2='10' stroke-width='2'/></svg>
                                <span id="range-months-btn-text">Meses</span>
                                <i class="fa-solid fa-chevron-down text-[9px] text-gray-400"></i>
                            </button>
                            <!-- Dropdown de meses -->
                            <div id="months-dropdown" class="hidden absolute right-0 mt-2 z-50 bg-white dark:bg-[#0c1322] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-3 min-w-[280px]">
                                <div class="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/5">
                                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-wider">Meses del Año (2026)</span>
                                    <button onclick="window.closeMonthsDropdown()" class="text-gray-400 hover:text-red-400 text-xs"><i class="fa-solid fa-xmark"></i></button>
                                </div>
                                <div class="grid grid-cols-3 gap-1.5" id="months-grid-btns">
                                    <!-- Dynamic month buttons -->
                                </div>
                            </div>
                        </div>

                        <!-- Selector manual si desean fechas específicas -->
                        <button id="range-custom" onclick="window.toggleDatePicker()" class="range-tab px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-500 hover:text-tealAccent flex items-center gap-1" title="Rango personalizado de fechas">
                            <i class="fa-solid fa-sliders text-[11px]"></i>
                        </button>
                    </div>
                    <!-- Custom date range (hidden by default) -->
                    <div id="custom-date-picker" class="hidden items-center gap-3 bg-white/90 dark:bg-[#0c1322] border border-gray-200/80 dark:border-white/10 rounded-xl px-3.5 py-2 shadow-lg">
                        <div class="flex items-center gap-2">
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Desde</label>
                            <input id="date-from" type="date" onchange="window.applyCustomRange()" class="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-tealAccent">
                        </div>
                        <span class="text-gray-400 font-bold">→</span>
                        <div class="flex items-center gap-2">
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hasta</label>
                            <input id="date-to" type="date" onchange="window.applyCustomRange()" class="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-tealAccent">
                        </div>
                        <button onclick="window.clearCustomRange()" class="ml-1 text-[10px] font-bold text-gray-400 hover:text-red-400 transition-all uppercase tracking-wider"><i class="fa-solid fa-xmark text-red-500"></i> Limpiar</button>
                    </div>
                </div>
            </div>

            <!-- Vendor Filter Row -->
            <div class="flex items-center gap-3">
                <span class="text-xs font-semibold text-gray-400">Filtrar por vendedor:</span>
                <div id="vendor-selector-wrapper" class="relative">
                    <!-- Trigger button -->
                    <button id="vendor-selector-btn" onclick="window.toggleVendorDropdown()" class="flex items-center gap-2 bg-white/80 dark:bg-[#0c1322] border border-gray-200/80 dark:border-white/5 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-white shadow-sm hover:border-tealAccent/40 transition-all min-w-[200px]">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-tealAccent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>
                        <span id="vendor-btn-label" class="flex-1 text-left">Todos los vendedores</span>
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <!-- Dropdown panel -->
                    <div id="vendor-dropdown" class="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-[#0c1322] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl min-w-[280px] overflow-hidden">
                        <!-- Header -->
                        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Seleccionar vendedores</span>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input id="vendor-cb-all" type="checkbox" checked onchange="window.selectAllVendors(this.checked)" class="w-3.5 h-3.5 accent-teal-400">
                                <span class="text-[10px] font-bold text-tealAccent uppercase tracking-wider">Todos</span>
                            </label>
                        </div>
                        <!-- Vendor list -->
                        <div id="vendor-cb-list" class="max-h-[260px] overflow-y-auto py-2">
                            <p class="px-4 py-2 text-xs text-gray-400">Cargando...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- KPI Cards (5 cols matching modern OS standard) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <!-- Prospectos -->
                <div onclick="window.showKpiDetailModal('prospectos')" class="bg-white/80 dark:bg-[#0c1322] p-5 rounded-2xl border border-gray-200/80 dark:border-white/5 shadow-sm group hover:border-blue-400/50 hover:scale-[1.02] hover:shadow-lg transition-all cursor-pointer select-none">
                    <div class="flex items-center justify-between mb-1">
                        <p class="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Prospectos</p>
                        <span class="text-[9px] font-bold text-blue-400/70 group-hover:text-blue-400 flex items-center gap-1 transition-colors">Ver lista <i class="fa-solid fa-arrow-right text-[8px]"></i></span>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <h3 id="kpi-total-contactos" class="text-2xl font-bold text-gray-900 dark:text-white">0</h3>
                        <span id="kpi-prospectos-pct" class="text-xs font-bold text-blue-400"></span>
                    </div>
                    <p class="text-[11px] text-gray-400 mt-1">Total registrados</p>
                </div>

                <!-- Presentaciones -->
                <div onclick="window.showKpiDetailModal('presentaciones')" class="bg-white/80 dark:bg-[#0c1322] p-5 rounded-2xl border border-gray-200/80 dark:border-white/5 shadow-sm group hover:border-amber-400/50 hover:scale-[1.02] hover:shadow-lg transition-all cursor-pointer select-none">
                    <div class="flex items-center justify-between mb-1">
                        <p class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Presentaciones</p>
                        <span class="text-[9px] font-bold text-amber-400/70 group-hover:text-amber-400 flex items-center gap-1 transition-colors">Ver lista <i class="fa-solid fa-arrow-right text-[8px]"></i></span>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <h3 id="kpi-proyectos-abiertos" class="text-2xl font-bold text-gray-900 dark:text-white">0</h3>
                        <span id="kpi-presentaciones-pct" class="text-xs font-bold text-amber-400"></span>
                    </div>
                    <p class="text-[11px] text-gray-400 mt-1">Citas con presentación</p>
                </div>

                <!-- Ventas -->
                <div onclick="window.showKpiDetailModal('ventas')" class="bg-white/80 dark:bg-[#0c1322] p-5 rounded-2xl border border-gray-200/80 dark:border-white/5 shadow-sm group hover:border-emerald-400/50 hover:scale-[1.02] hover:shadow-lg transition-all cursor-pointer select-none">
                    <div class="flex items-center justify-between mb-1">
                        <p class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Ventas</p>
                        <span class="text-[9px] font-bold text-emerald-400/70 group-hover:text-emerald-400 flex items-center gap-1 transition-colors">Ver lista <i class="fa-solid fa-arrow-right text-[8px]"></i></span>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <h3 id="kpi-ventas-totales" class="text-2xl font-bold text-gray-900 dark:text-white">0</h3>
                        <span id="kpi-ventas-pct" class="text-xs font-bold text-emerald-400"></span>
                    </div>
                    <p class="text-[11px] text-gray-400 mt-1">Proyectos cerrados</p>
                </div>

                <!-- Declinados -->
                <div onclick="window.showKpiDetailModal('declinados')" class="bg-white/80 dark:bg-[#0c1322] p-5 rounded-2xl border border-gray-200/80 dark:border-white/5 shadow-sm group hover:border-red-400/50 hover:scale-[1.02] hover:shadow-lg transition-all cursor-pointer select-none">
                    <div class="flex items-center justify-between mb-1">
                        <p class="text-[10px] font-bold text-red-400 uppercase tracking-wider">Declinados</p>
                        <span class="text-[9px] font-bold text-red-400/70 group-hover:text-red-400 flex items-center gap-1 transition-colors">Ver lista <i class="fa-solid fa-arrow-right text-[8px]"></i></span>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <h3 id="kpi-declinados-totales" class="text-2xl font-bold text-gray-900 dark:text-white">0</h3>
                    </div>
                    <p class="text-[11px] text-gray-400 mt-1">Prospectos rechazados</p>
                </div>

                <!-- Tasa de Rendimiento (indicador visual) -->
                <div class="bg-white/80 dark:bg-[#0c1322] p-5 rounded-2xl border border-gray-200/80 dark:border-white/5 shadow-sm group hover:border-purple-400/30 transition-all relative overflow-hidden">
                    <p class="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Rendimiento</p>
                    <div class="flex items-baseline gap-2">
                        <h3 id="kpi-tasa-cierre" class="text-2xl font-bold text-gray-900 dark:text-white">0%</h3>
                        <span id="kpi-tasa-icon" class="text-sm font-bold text-purple-400">—</span>
                    </div>
                    <p class="text-[11px] text-gray-400 mt-1">Citas vs ventas</p>
                    <!-- Progress bar -->
                    <div class="mt-3 w-full h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div id="kpi-tasa-bar" class="h-full rounded-full transition-all duration-700"
                             style="width:0%; background: linear-gradient(90deg,#a855f7,#7c3aed);"></div>
                    </div>
                    <!-- Benchmark label -->
                    <div class="flex justify-between mt-1">
                        <span class="text-[9px] text-gray-400">0%</span>
                        <span id="kpi-tasa-label" class="text-[9px] font-bold text-purple-400">Calculando…</span>
                        <span class="text-[9px] text-gray-400">100%</span>
                    </div>
                </div>
            </div>

            <!-- Chart + Legend (Modern Container) -->
            <div class="bg-white/80 dark:bg-[#0c1322] p-6 rounded-2xl border border-gray-200/80 dark:border-white/5 shadow-sm">
                <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div>
                        <h4 class="text-base font-bold text-gray-900 dark:text-white tracking-tight">Desempeño Global</h4>
                        <p id="chart-subtitle" class="text-xs text-gray-500 font-normal mt-0.5">Evolución de prospectos, presentaciones y ventas del mes.</p>
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
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full bg-red-400 shadow-sm"></span>
                            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Declinados</span>
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
                                <th class="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Comisiones</th>
                            </tr>
                        </thead>
                        <tbody id="global-leaderboard-body"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <style>
            .eco-tab.active  { background:#00f5d4; color:#000; font-weight: 700; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
            .range-tab.active{ background:#00f5d4; color:#000; font-weight: 700; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
            #custom-date-picker.visible { display:flex; }
            #date-from, #date-to { color-scheme: dark; }
            #vendor-dropdown { display:none; }
            #vendor-dropdown.open { display:block; }
            .vendor-checkbox-item:hover { background:rgba(0,245,212,.05); }
            .vendor-checkbox-item input[type=checkbox]:checked + span { color:#00f5d4; }
        </style>
    `;

    // ── State ──────────────────────────────────────────────────────────────────
    window.globalTimeRange      = 'monthly';
    window.globalDateFrom       = null;
    window.globalDateTo         = null;
    window.globalSelectedVendors = []; // [] = todos

    // Role-based ecosystem tab filtering
    const usr = JSON.parse(localStorage.getItem('rs_user') || '{}');
    const isRestrictedManager = window.getUserRoles(usr).some(r => ['manager', 'manager de ventas', 'account manager', 'supervisión', 'project manager'].includes(r));
    
    let allowedEcos = ['Solar', 'Home', 'Water', 'Group'];
    if (isRestrictedManager && usr.unidades && usr.unidades.length > 0) {
        allowedEcos = ['Solar', 'Home', 'Water'].filter(eco => {
            return usr.unidades.some(u => u.toLowerCase().includes(eco.toLowerCase()));
        });
        if (allowedEcos.length > 1) {
            allowedEcos.push('Group'); // Allow Group if they have multiple
        }
    }

    if (allowedEcos.length === 0) {
         allowedEcos = ['Solar']; // Fallback
    }

    window.globalActiveEco = allowedEcos[0];

    const ecoTabsContainer = document.getElementById('rendimiento-eco-tabs');
    if (ecoTabsContainer) {
        ecoTabsContainer.innerHTML = allowedEcos.map(eco => `
            <button id="tab-${eco.toLowerCase()}" onclick="window.filterGlobalEco('${eco}')" class="eco-tab px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-500 hover:text-tealAccent">Renew ${eco}</button>
        `).join('');
    }

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

    // Poblar botones de meses en el dropdown
    const monthNamesList = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthShortList = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthsGrid = document.getElementById('months-grid-btns');
    if (monthsGrid) {
        const currentM = new Date().getMonth();
        monthsGrid.innerHTML = monthShortList.map((m, idx) => `
            <button onclick="window.selectSpecificMonth(${idx})" id="btn-month-opt-${idx}" class="month-grid-btn px-2.5 py-2 rounded-xl text-xs font-bold transition-all text-center border border-gray-100 dark:border-white/5 hover:border-tealAccent hover:text-tealAccent dark:hover:text-tealAccent ${idx === currentM ? 'bg-tealAccent/10 text-tealAccent font-black' : 'text-gray-600 dark:text-gray-300'}">
                ${m}
            </button>
        `).join('');
    }

    window.toggleMonthsDropdown = () => {
        const dd = document.getElementById('months-dropdown');
        if (dd) dd.classList.toggle('hidden');
    };

    window.closeMonthsDropdown = () => {
        const dd = document.getElementById('months-dropdown');
        if (dd) dd.classList.add('hidden');
    };

    window.selectSpecificMonth = (monthIndex) => {
        const year = 2026;
        // Del primer día del mes a las 00:00:00 al último día del mes a las 23:59:59
        const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const end   = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

        window.globalDateFrom  = start;
        window.globalDateTo    = end;
        window.globalTimeRange = 'specific_month';
        window.globalSelectedMonthIndex = monthIndex;

        // Actualizar etiqueta del botón
        const label = document.getElementById('range-months-btn-text');
        if (label) label.textContent = `Mes: ${monthShortList[monthIndex]}`;

        // Estilos activos
        document.querySelectorAll('.range-tab').forEach(btn => {
            btn.classList.remove('active', 'bg-white', 'dark:bg-[#0c1322]', 'text-tealAccent', 'shadow-sm');
            btn.classList.add('text-gray-500');
        });

        const monthsBtn = document.getElementById('range-months-btn');
        if (monthsBtn) {
            monthsBtn.classList.add('active', 'bg-white', 'dark:bg-[#0c1322]', 'text-tealAccent', 'shadow-sm');
            monthsBtn.classList.remove('text-gray-500');
        }

        // Resaltar en el grid
        document.querySelectorAll('.month-grid-btn').forEach((b, i) => {
            b.classList.toggle('bg-tealAccent', i === monthIndex);
            b.classList.toggle('text-black', i === monthIndex);
            b.classList.toggle('font-black', i === monthIndex);
        });

        window.closeMonthsDropdown();

        // Ocultar picker personalizado si estuviera abierto
        const picker = document.getElementById('custom-date-picker');
        if (picker) { picker.classList.remove('visible'); picker.classList.add('hidden'); }
        const rangeCustomBtn = document.getElementById('range-custom');
        if (rangeCustomBtn) rangeCustomBtn.classList.remove('active');

        updateGlobalData(window.globalActiveEco, 'specific_month', window.globalDateFrom, window.globalDateTo, window.globalSelectedVendors);
    };

    window.setGlobalRange = (range) => {
        window.globalTimeRange = range;
        
        // Reset months label if switching away
        const monthsLabel = document.getElementById('range-months-btn-text');
        if (monthsLabel) monthsLabel.textContent = 'Meses';
        window.closeMonthsDropdown();

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
            btn.classList.toggle('bg-white', match);
            btn.classList.toggle('dark:bg-[#0c1322]', match);
            btn.classList.toggle('text-tealAccent', match);
            btn.classList.toggle('shadow-sm', match);
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
        }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
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

        const mWrapper = document.getElementById('months-selector-wrapper');
        const mDd = document.getElementById('months-dropdown');
        if (mWrapper && mDd && !mWrapper.contains(e.target)) mDd.classList.add('hidden');
    }, { once: false });

    // Initial load
    window.filterGlobalEco(window.globalActiveEco);
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
    const ecoClients = (isGroup ? clients : clients.filter(c => {
        const activeKeyword = ecosystemLower.replace('renew ', '').trim();
        const hasModernDepts = Array.isArray(c.departamentos_activos) && c.departamentos_activos.length > 0;
        let clientDepts = [];
        if (hasModernDepts) {
            clientDepts = c.departamentos_activos.map(d => d.toLowerCase().trim());
        } else {
            let fallback = c.departamento || c.empresa || '';
            if (fallback) {
                clientDepts = fallback.includes(',') ? fallback.split(',').map(s=>s.trim().toLowerCase()) : [fallback.trim().toLowerCase()];
            }
        }
        
        if (hasModernDepts) {
            return clientDepts.some(d => d.includes(activeKeyword));
        } else {
            const legacyDept = (c.departamento || c.empresa || '').toLowerCase().trim();
            const isGeneric = !legacyDept || legacyDept === 'lead (nuevo)' || legacyDept === '-' || legacyDept === 'renew' || legacyDept === 'renew group';
            if (clientDepts.length === 0 && isGeneric) return activeKeyword === 'solar';
            
            const matchesActive = clientDepts.some(d => d.includes(activeKeyword));
            const matchesLegacy = !isGeneric && legacyDept.includes(activeKeyword);
            return matchesActive || matchesLegacy;
        }
    })).filter(c => {
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

    // Build start/end bounds for each range (estricto: del 1er día al último día)
    let rangeStart, rangeEnd;
    if (range === 'weekly') {
        const day = now.getDay(); // 0=Sun
        rangeStart = new Date(now); rangeStart.setDate(now.getDate() - day); rangeStart.setHours(0,0,0,0);
        rangeEnd   = new Date(now); rangeEnd.setHours(23,59,59,999);
    } else if (range === 'monthly') {
        rangeStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
        rangeEnd   = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    } else if (range === 'annual') {
        rangeStart = new Date(currentYear, 0, 1, 0, 0, 0, 0);
        rangeEnd   = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    } else if ((range === 'custom' || range === 'specific_month') && dateFrom && dateTo) {
        rangeStart = dateFrom;
        rangeEnd   = dateTo;
    } else {
        rangeStart = null; rangeEnd = null; // total / no filter
    }

    const safeDate = (raw) => {
        if (!raw) return null;
        let str = String(raw).trim();
        if (/^\d{4}\s\d{2}\s\d{2}/.test(str)) str = str.replace(/\s/g, '-');
        if (str.includes(' ') && !str.includes('T')) str = str.replace(' ', 'T');
        if (!str.includes('T')) str += 'T12:00:00';
        let d = new Date(str);
        if (isNaN(d.getTime())) {
            // Intento parsear DD/MM/YYYY o DD-MM-YYYY
            const parts = String(raw).split(/[\/\-]/);
            if (parts.length === 3) {
                if (parseInt(parts[0]) > 12) {
                    d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
                } else {
                    d = new Date(`${parts[2]}-${parts[0]}-${parts[1]}T12:00:00`);
                }
            }
        }
        return isNaN(d.getTime()) ? null : d;
    };

    const inRange = (dateStr) => {
        if (!rangeStart || !rangeEnd) return true;
        const d = safeDate(dateStr);
        // Cuando hay un filtro de fechas activo, registros sin fecha válida NO se incluyen en el mes
        if (!d) return false;
        return d >= rangeStart && d <= rangeEnd;
    };

    const getClientDate = (c) => {
        if (!c) return null;
        return c.fecha || c.fecha_inicio || c.fecha_registro || c.created_at || null;
    };

    const inClientRange = (c) => {
        if (!rangeStart || !rangeEnd) return true;
        const rawDate = getClientDate(c);
        if (rawDate) {
            const d = safeDate(rawDate);
            if (d) {
                // En vista Anual, incluir registros del año o declinados operativos del equipo
                if (range === 'annual' && c.macro_estado === 'Declinado') return true;
                return d >= rangeStart && d <= rangeEnd;
            }
        }
        // En vista Anual, los registros sin fecha explícita corresponden a la base importada operativa anual
        if (range === 'annual') return true;
        return false;
    };

    // ── Helper de Detección de Ventas y Fechas ──
    const isProjectClosedSale = (p) => {
        if (!p) return false;
        if (p.fecha_cierre) return true;
        const est = String(p.estado || '').toLowerCase();
        const fId = String(p.fase_id || '').toLowerCase();
        const finishedTerms = ['completado', 'finalizado', 'finished', 'cerrado', 'closed', 'venta', 'liquidado'];
        if (finishedTerms.some(t => est === t || fId === t)) return true;
        if (p.fase_id === null && p.pipeline_id === 'pip_water') return true;
        if (db && db.Admin_Fases) {
            const fObj = db.Admin_Fases.find(f => String(f.id).toLowerCase() === fId);
            if (fObj) {
                const fNom = String(fObj.nombre || '').toLowerCase();
                if (finishedTerms.some(t => fNom.includes(t)) || fNom.includes('comisión') || fNom.includes('comision')) return true;
                if (db.Admin_Pipelines) {
                    const pipeline = db.Admin_Pipelines.find(pip => pip.id === fObj.pipeline_id);
                    if (pipeline && String(pipeline.nombre || '').toLowerCase().includes('solar')) {
                        if (typeof fObj.orden === 'number' && fObj.orden >= 2) return true;
                    }
                }
            }
        }
        return false;
    };

    const getProjectSaleDate = (p) => {
        if (p.fecha_cierre) return p.fecha_cierre;
        if (p.fecha) return p.fecha;
        if (p.created_at) return p.created_at;
        const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(p.cliente_id));
        return cli ? (cli.fecha_cierre || cli.fecha_conversion || cli.fecha || cli.fecha_inicio || cli.fecha_registro || cli.created_at) : null;
    };

    const getProjectActiveDate = (p) => {
        if (p.fecha) return p.fecha;
        if (p.created_at) return p.created_at;
        const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(p.cliente_id));
        return cli ? (cli.fecha || cli.fecha_inicio || cli.fecha_registro || cli.created_at) : null;
    };

    // ── 4. KPIs based on Projects & Clients ──────────
    const filteredClients = ecoClients.filter(c => inClientRange(c));
    const closedProjects = ecoProjects.filter(p => isProjectClosedSale(p) && inRange(getProjectSaleDate(p)));
    const openProjects   = ecoProjects.filter(p => !isProjectClosedSale(p) && inRange(getProjectActiveDate(p)));

    let prospectosList = [];
    let declinadosList = [];

    filteredClients.forEach(c => {
        if (c.macro_estado === 'Declinado') {
            declinadosList.push(c);
            return;
        }
        const clientProjects = ecoProjects.filter(p => String(p.cliente_id) === String(c.id));
        if (clientProjects.length === 0) {
            prospectosList.push(c);
        }
    });

    const totalProspectos     = prospectosList.length;
    const totalDeclinados     = declinadosList.length;
    const totalPresentaciones = openProjects.length;
    const totalVentas         = closedProjects.length;

    // Guardar colecciones detalladas para los modales interactivos
    window._currentFilteredProspectos     = prospectosList;
    window._currentFilteredDeclinados     = declinadosList;
    window._currentFilteredPresentaciones = openProjects;
    window._currentFilteredVentas         = closedProjects;
    window._currentFilteredEco            = ecosystem;
    window._currentDateBounds             = { start: rangeStart, end: rangeEnd };

    // Tasa de Rendimiento
    const totalActivos  = totalPresentaciones + totalVentas;
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
    if(document.getElementById('kpi-declinados-totales')) document.getElementById('kpi-declinados-totales').textContent = totalDeclinados;
    document.getElementById('kpi-tasa-cierre').textContent        = `${closeRate}%`;

    const elPPct = document.getElementById('kpi-prospectos-pct');
    const elPresPct = document.getElementById('kpi-presentaciones-pct');
    const elVPct = document.getElementById('kpi-ventas-pct');
    if (elPPct)    elPPct.textContent    = '';
    if (elPresPct) elPresPct.textContent = '';
    if (elVPct)    elVPct.textContent    = '';

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
    let filteredVendors = filterByVendors ? relevantVendors.filter(v => vendorIds.includes(String(v.id))) : relevantVendors;

    const leaderboardData = filteredVendors.map(v => {
        const vProjects = ecoProjects.filter(p => {
            const isFin = isProjectClosedSale(p);
            const pDate = isFin ? getProjectSaleDate(p) : getProjectActiveDate(p);
            if (!inRange(pDate)) return false;
            if (String(p.responsable_id) === String(v.id)) return true;
            const cli = ecoClients.find(c => String(c.id) === String(p.cliente_id));
            return cli && String(cli.vendedor_asignado_id) === String(v.id);
        });
        const vTotal   = vProjects.length;
        const vClosed  = vProjects.filter(p => isProjectClosedSale(p)).length;
        const vCloseRate = vTotal > 0 ? Math.round((vClosed / vTotal) * 100) : 0;
        
        let vCommissions = 0;
        const vRecibos = db.Recibos_Pagos || [];
        vRecibos.forEach(r => {
            if (String(r.trabajador_id) !== String(v.id)) return;
            if (inRange(r.fecha_recibo || r.created_at)) {
                const json = r.datos_json || {};
                vCommissions += (parseFloat(json.grand_total) || parseFloat(json.total_price) || 0);
            }
        });

        return {
            ...v,
            sales:       vClosed,
            closeRate:   vCloseRate,
            commissions: vCommissions
        };
    }).sort((a, b) => {
        if (b.sales !== a.sales) return b.sales - a.sales;
        return (a.nombre || '').localeCompare(b.nombre || '');
    });

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
                    <span class="text-sm font-black text-tealAccent">$${v.commissions.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </td>
            </tr>
        `).join('');
    }

    // ── 6. Chart Data ─────────────────────────────────────────────────────────
    let labels = [];
    let dataProspectos    = [];
    let dataPresentaciones = [];
    let dataVentas        = [];
    let dataDeclinados    = [];
    let subtitleText      = '';

    // Plot helpers 
    const plotByDay = (start, end, clientsArr, openArr, closedArr) => {
        const msDay = 86400000;
        const days  = Math.round((end - start) / msDay) + 1;
        const lbs   = [];
        const dp    = Array(days).fill(0);
        const dd    = Array(days).fill(0);
        const dpr   = Array(days).fill(0);
        const dv    = Array(days).fill(0);
        for (let i = 0; i < days; i++) {
            const d = new Date(start.getTime() + i * msDay);
            lbs.push(`${d.getDate()}/${d.getMonth()+1}`);
        }
        clientsArr.forEach(c => {
            const d = safeDate(getClientDate(c));
            if (!d) return;
            const idx = Math.round((d - start) / msDay);
            if (idx >= 0 && idx < days) {
                if (c.macro_estado === 'Declinado') {
                    dd[idx]++;
                } else {
                    const clientProjects = ecoProjects.filter(p => String(p.cliente_id) === String(c.id));
                    if (clientProjects.length === 0) dp[idx]++;
                }
            }
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
        return { lbs, dp, dpr, dv, dd };
    };

    const plotByMonth = (year, clientsArr, openArr, closedArr) => {
        const mn  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const dp  = Array(12).fill(0);
        const dd  = Array(12).fill(0);
        const dpr = Array(12).fill(0);
        const dv  = Array(12).fill(0);
        clientsArr.forEach(c => { 
            const d = safeDate(getClientDate(c)); 
            if(d && d.getFullYear()===year) {
                if (c.macro_estado === 'Declinado') {
                    dd[d.getMonth()]++;
                } else {
                    const clientProjects = ecoProjects.filter(p => String(p.cliente_id) === String(c.id));
                    if (clientProjects.length === 0) dp[d.getMonth()]++;
                }
            }
        });
        openArr.forEach(p => { const d = safeDate(getProjectDate(p, db)); if(d && d.getFullYear()===year) dpr[d.getMonth()]++; });
        closedArr.forEach(p => { const d = safeDate(getProjectDate(p, db)); if(d && d.getFullYear()===year) dv[d.getMonth()]++; });
        return { lbs: mn, dp, dpr, dv, dd };
    };

    // Data grouped for chart
    const chartClientes     = ecoClients;
    const chartEnProceso    = openProjects;
    const chartVentas       = closedProjects;

    if (range === 'weekly') {
        const r = plotByDay(rangeStart, rangeEnd, chartClientes, chartEnProceso, chartVentas);
        labels = r.lbs; dataProspectos = r.dp; dataPresentaciones = r.dpr; dataVentas = r.dv; dataDeclinados = r.dd;
        subtitleText = 'Actividad de la semana en curso.';
    } else if (range === 'monthly') {
        const r = plotByDay(rangeStart, rangeEnd, chartClientes, chartEnProceso, chartVentas);
        labels = r.lbs; dataProspectos = r.dp; dataPresentaciones = r.dpr; dataVentas = r.dv; dataDeclinados = r.dd;
        subtitleText = 'Evolución de prospectos, presentaciones y ventas del mes.';
    } else if (range === 'annual') {
        const r = plotByMonth(currentYear, chartClientes, chartEnProceso, chartVentas);
        labels = r.lbs; dataProspectos = r.dp; dataPresentaciones = r.dpr; dataVentas = r.dv; dataDeclinados = r.dd;
        subtitleText = `Resumen anual ${currentYear}.`;
    } else if ((range === 'custom' || range === 'specific_month') && rangeStart && rangeEnd) {
        const diffDays = Math.round((rangeEnd - rangeStart) / 86400000);
        if (diffDays <= 62) {
            const r = plotByDay(rangeStart, rangeEnd, chartClientes, chartEnProceso, chartVentas);
            labels = r.lbs; dataProspectos = r.dp; dataPresentaciones = r.dpr; dataVentas = r.dv; dataDeclinados = r.dd;
        } else {
            const r = plotByMonth(rangeStart.getFullYear(), chartClientes, chartEnProceso, chartVentas);
            labels = r.lbs; dataProspectos = r.dp; dataPresentaciones = r.dpr; dataVentas = r.dv; dataDeclinados = r.dd;
        }
        const fmt = d => d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
        if (range === 'specific_month' && window.globalSelectedMonthIndex !== undefined) {
            const mFullNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            subtitleText = `Evolución de prospectos, presentaciones y ventas de ${mFullNames[window.globalSelectedMonthIndex]} 2026.`;
        } else {
            subtitleText = `Rango personalizado: ${fmt(rangeStart)} → ${fmt(rangeEnd)}.`;
        }
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
            labels: ['Prospectos', 'Presentaciones', 'Ventas', 'Declinados'],
            datasets: [{
                data: [totalProspectos, totalPresentaciones, totalVentas, totalDeclinados],
                backgroundColor: ['#60a5fa', '#fbbf24', '#34d399', '#f87171'],
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

// ── Modal de Detalle de KPIs (Ventas, Declinados, Presentaciones, Prospectos) ──
let _currentKpiModalData = [];
let _currentKpiModalType = '';

window.showKpiDetailModal = function(type) {
    const db = getDB();
    const workers = db.Usuarios || [];
    const fases = db.Admin_Fases || [];

    let items = [];
    let config = {
        title: 'Detalle de Métrica',
        icon: 'fa-chart-pie',
        color: 'text-tealAccent',
        badgeBg: 'bg-tealAccent/10 text-tealAccent border-tealAccent/20',
        emptyMsg: 'No hay registros en este período'
    };

    if (type === 'ventas') {
        items = window._currentFilteredVentas || [];
        config = {
            title: 'Ventas Cerradas / Concretadas',
            icon: 'fa-trophy',
            color: 'text-emerald-400',
            badgeBg: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
            emptyMsg: 'No hay ventas registradas en el período seleccionado.'
        };
    } else if (type === 'declinados') {
        items = window._currentFilteredDeclinados || [];
        config = {
            title: 'Prospectos Declinados / Rechazados',
            icon: 'fa-ban',
            color: 'text-red-400',
            badgeBg: 'bg-red-400/10 text-red-400 border-red-400/20',
            emptyMsg: 'No hay prospectos declinados en el período seleccionado.'
        };
    } else if (type === 'presentaciones') {
        items = window._currentFilteredPresentaciones || [];
        config = {
            title: 'Presentaciones / Proyectos en Proceso',
            icon: 'fa-clock',
            color: 'text-amber-400',
            badgeBg: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
            emptyMsg: 'No hay presentaciones activas en el período seleccionado.'
        };
    } else if (type === 'prospectos') {
        items = window._currentFilteredProspectos || [];
        config = {
            title: 'Prospectos Registrados',
            icon: 'fa-users',
            color: 'text-blue-400',
            badgeBg: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
            emptyMsg: 'No hay prospectos registrados en el período seleccionado.'
        };
    }

    _currentKpiModalType = type;
    _currentKpiModalData = items;

    let container = document.getElementById('modal-kpi-detail-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'modal-kpi-detail-container';
        document.body.appendChild(container);
    }

    const fmtDate = (dStr) => {
        if (!dStr) return 'Sin fecha';
        try {
            const d = new Date(dStr.includes('T') ? dStr : dStr + 'T12:00:00');
            if (isNaN(d.getTime())) return dStr;
            return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (_) { return dStr; }
    };

    const renderList = (filterQuery = '') => {
        const q = filterQuery.toLowerCase().trim();
        const filtered = items.filter(item => {
            if (!q) return true;
            let cliName = '';
            let repName = '';
            let phone = '';
            let faseName = '';

            if (type === 'ventas' || type === 'presentaciones') {
                const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(item.cliente_id)) || {};
                cliName = `${cli.nombre || ''} ${cli.apellido || ''} ${item.nombre || ''}`.toLowerCase();
                phone = `${cli.telefono || ''} ${cli.tel || ''}`.toLowerCase();
                
                const rep = workers.find(w => String(w.id) === String(item.responsable_id || cli.vendedor_asignado_id));
                repName = rep ? `${rep.nombre || ''} ${rep.apellido || ''}`.toLowerCase() : '';

                const f = fases.find(x => String(x.id) === String(item.fase_id));
                faseName = f ? f.nombre.toLowerCase() : (item.fase_id || '');
            } else {
                cliName = `${item.nombre || ''} ${item.apellido || ''}`.toLowerCase();
                phone = `${item.telefono || ''} ${item.tel || ''}`.toLowerCase();
                const rep = workers.find(w => String(w.id) === String(item.vendedor_asignado_id || item.responsable_id));
                repName = rep ? `${rep.nombre || ''} ${rep.apellido || ''}`.toLowerCase() : '';
                faseName = (item.macro_estado || item.estado || '').toLowerCase();
            }

            return cliName.includes(q) || repName.includes(q) || phone.includes(q) || faseName.includes(q);
        });

        if (filtered.length === 0) {
            return `
                <div class="py-12 text-center text-gray-400">
                    <i class="fa-solid fa-inbox text-3xl opacity-30 mb-3 block"></i>
                    <p class="text-sm font-semibold">${filterQuery ? 'No se encontraron resultados para la búsqueda' : config.emptyMsg}</p>
                </div>
            `;
        }

        return `
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-gray-100 dark:border-white/5 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                            <th class="py-3 px-4">Cliente / Registro</th>
                            <th class="py-3 px-4">Vendedor Asignado</th>
                            <th class="py-3 px-4">Fecha</th>
                            <th class="py-3 px-4">Fase / Estado</th>
                            <th class="py-3 px-4 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                        ${filtered.map(item => {
                            let cli = item;
                            let p = null;
                            let dateRaw = '';
                            let rep = null;
                            let faseLabel = '';
                            let clientId = item.id;
                            let projectId = null;

                            if (type === 'ventas' || type === 'presentaciones') {
                                p = item;
                                projectId = p.id;
                                cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(p.cliente_id)) || {};
                                clientId = cli.id || p.cliente_id;
                                dateRaw = type === 'ventas' ? (p.fecha_cierre || p.fecha || p.created_at) : (p.fecha || p.created_at);
                                rep = workers.find(w => String(w.id) === String(p.responsable_id || cli.vendedor_asignado_id));
                                const fObj = fases.find(x => String(x.id) === String(p.fase_id));
                                faseLabel = fObj ? fObj.nombre : (p.fase_id ? p.fase_id : (type === 'ventas' ? 'Venta Cerrada' : 'En Proceso'));
                            } else {
                                cli = item;
                                clientId = cli.id;
                                dateRaw = cli.fecha || cli.fecha_inicio || cli.fecha_registro || cli.created_at;
                                rep = workers.find(w => String(w.id) === String(cli.vendedor_asignado_id || cli.responsable_id));
                                faseLabel = cli.macro_estado || cli.estado || (type === 'declinados' ? 'Declinado' : 'Prospecto');
                            }

                            const clientFullName = `${cli.nombre || 'Sin Nombre'} ${cli.apellido || ''}`.trim();
                            const repFullName = rep ? `${rep.nombre || ''} ${rep.apellido || ''}`.trim() : (cli.vendedor_asignado_nombre || 'Sin asignar');
                            const phone = cli.telefono || cli.tel || '';

                            return `
                                <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <td class="py-3 px-4">
                                        <div class="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <span>${clientFullName}</span>
                                        </div>
                                        ${phone ? `<div class="text-[11px] text-gray-400 mt-0.5"><i class="fa-solid fa-phone text-[9px] mr-1"></i>${phone}</div>` : ''}
                                    </td>
                                    <td class="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                                        <div class="flex items-center gap-2">
                                            <div class="w-6 h-6 rounded-full bg-tealAccent/10 text-tealAccent flex items-center justify-center text-[10px] font-black">
                                                ${rep && rep.nombre ? rep.nombre[0].toUpperCase() : 'U'}
                                            </div>
                                            <span>${repFullName}</span>
                                        </div>
                                    </td>
                                    <td class="py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                                        ${fmtDate(dateRaw)}
                                    </td>
                                    <td class="py-3 px-4 whitespace-nowrap">
                                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.badgeBg}">
                                            ${faseLabel}
                                        </span>
                                    </td>
                                    <td class="py-3 px-4 text-right whitespace-nowrap">
                                        <div class="flex items-center justify-end gap-1.5">
                                            ${projectId && !projectId.startsWith('VIRTUAL_') ? `
                                                <button onclick="window.closeKpiDetailModal(); if (window.appNavigate) window.appNavigate('detail', '${projectId}'); else window.location.hash = '#detail/${projectId}';" class="px-2.5 py-1 rounded-lg bg-tealAccent text-black font-bold text-[11px] hover:brightness-110 transition-all shadow-sm flex items-center gap-1">
                                                    <i class="fa-solid fa-folder-open text-[10px]"></i> Proyecto
                                                </button>
                                            ` : ''}
                                            ${clientId ? `
                                                <button onclick="window.closeKpiDetailModal(); if (typeof window.openClientOrProspectModal === 'function') { window.openClientOrProspectModal('${clientId}', '${projectId || ''}'); } else if (window.appNavigate && '${projectId}' && !'${projectId}'.startsWith('VIRTUAL_')) { window.appNavigate('detail', '${projectId}'); }" class="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 font-bold text-[11px] hover:bg-gray-200 dark:hover:bg-white/20 transition-all flex items-center gap-1">
                                                    <i class="fa-solid fa-user text-[10px]"></i> Cliente
                                                </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn" id="kpi-modal-backdrop" onclick="if(event.target === this) window.closeKpiDetailModal();">
            <div class="relative bg-white dark:bg-[#0c1322] border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-slideUp">
                <!-- Header -->
                <div class="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${config.badgeBg}">
                            <i class="fa-solid ${config.icon}"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="text-lg font-black text-gray-900 dark:text-white">${config.title}</h3>
                                <span class="px-2 py-0.5 rounded-full text-xs font-black bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white">${items.length}</span>
                            </div>
                            <p class="text-xs text-gray-400 font-medium">Ecosistema: Renew ${window._currentFilteredEco || 'Water'} · Registros filtrados del período</p>
                        </div>
                    </div>
                    <button onclick="window.closeKpiDetailModal()" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-red-500/10 hover:text-red-500 text-gray-400 flex items-center justify-center transition-colors">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                <!-- Search Filter Bar -->
                <div class="px-6 py-3 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
                    <i class="fa-solid fa-magnifying-glass text-gray-400 text-xs"></i>
                    <input type="text" id="kpi-modal-search" oninput="window.filterKpiModalList(this.value)" placeholder="Filtrar por nombre de cliente, vendedor, teléfono o fase..." class="w-full bg-transparent text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 outline-none">
                </div>

                <!-- Table Content Container -->
                <div class="p-6 overflow-y-auto flex-1" id="kpi-modal-body">
                    ${renderList()}
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 bg-gray-50/50 dark:bg-white/[0.01] border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-xs text-gray-400">
                    <span>Mostrando <strong id="kpi-modal-visible-count" class="text-gray-700 dark:text-gray-200">${items.length}</strong> de ${items.length} registros</span>
                    <button onclick="window.closeKpiDetailModal()" class="px-4 py-1.5 rounded-xl bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-white font-bold text-xs hover:bg-gray-300 dark:hover:bg-white/20 transition-all">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;

    window.filterKpiModalList = (query) => {
        const body = document.getElementById('kpi-modal-body');
        if (body) body.innerHTML = renderList(query);
    };

    window.closeKpiDetailModal = () => {
        const container = document.getElementById('modal-kpi-detail-container');
        if (container) container.innerHTML = '';
    };

    // Close on Escape
    const onKey = (e) => {
        if (e.key === 'Escape') {
            window.closeKpiDetailModal();
            document.removeEventListener('keydown', onKey);
        }
    };
    document.addEventListener('keydown', onKey);
};
