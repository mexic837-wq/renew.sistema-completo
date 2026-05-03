/* ============================================================
   RENEW OS – screens/rendimiento-global.js
   ============================================================ */
import { getDB, formatDate } from '../api.js';

export async function renderRendimientoGlobal() {
    const canvas = document.getElementById('main-canvas');
    if (!canvas) return;

    // UI Structure
    canvas.innerHTML = `
        <div class="p-8 space-y-8 animate-fadeIn">
            <!-- Filters Row -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <!-- Tabs Ecosystem -->
                <div class="flex items-center gap-4 bg-gray-100 dark:bg-white/5 p-1.5 rounded-2xl w-fit">
                    <button id="tab-home" onclick="window.filterGlobalEco('Home')" class="eco-tab active px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all">Renew Home</button>
                    <button id="tab-solar" onclick="window.filterGlobalEco('Solar')" class="eco-tab px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-gray-500 hover:text-tealAccent">Renew Solar</button>
                    <button id="tab-water" onclick="window.filterGlobalEco('Water')" class="eco-tab px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-gray-500 hover:text-tealAccent">Renew Water</button>
                </div>

                <!-- Time Range Toggle -->
                <div class="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-1.5 rounded-2xl w-fit">
                    <button id="range-monthly" onclick="window.setGlobalRange('monthly')" class="range-tab active px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Este Mes</button>
                    <button id="range-total" onclick="window.setGlobalRange('total')" class="range-tab px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-gray-500 hover:text-tealAccent">Histórico Total</button>
                </div>
            </div>

            <!-- KPI Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white dark:bg-darkCard p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-premium">
                    <p class="text-[10px] font-black text-tealAccent uppercase tracking-[0.2em] mb-2">Total Contactos</p>
                    <h3 id="kpi-total-contactos" class="text-4xl font-black text-gray-900 dark:text-white">0</h3>
                </div>
                <div class="bg-white dark:bg-darkCard p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-premium">
                    <p class="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2">Ventas Cerradas</p>
                    <h3 id="kpi-ventas-totales" class="text-4xl font-black text-gray-900 dark:text-white">0</h3>
                </div>
                <div class="bg-white dark:bg-darkCard p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-premium">
                    <p class="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] mb-2">Tasa de Cierre</p>
                    <h3 id="kpi-tasa-cierre" class="text-4xl font-black text-gray-900 dark:text-white">0%</h3>
                </div>
            </div>

            <!-- Global Chart -->
            <div class="bg-white dark:bg-darkCard p-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-premium">
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <h4 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Desempeño Global</h4>
                        <p class="text-xs text-gray-500 font-medium">Curva de ventas de toda la empresa este mes.</p>
                    </div>
                </div>
                <div class="h-[300px] relative">
                    <canvas id="globalPerformanceChart"></canvas>
                </div>
            </div>

            <!-- Leaderboard -->
            <div class="bg-white dark:bg-darkCard rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-premium overflow-hidden">
                <div class="p-10 border-b border-gray-100 dark:border-white/5">
                    <h4 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Global Leaderboard</h4>
                    <p class="text-xs text-gray-500 font-medium">Ranking de vendedores por rendimiento.</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-50 dark:bg-white/5">
                                <th class="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendedor</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ventas</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tasa Cierre</th>
                                <th class="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Comisiones Proy.</th>
                            </tr>
                        </thead>
                        <tbody id="global-leaderboard-body">
                            <!-- Populated by JS -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <style>
            .eco-tab.active, .range-tab.active {
                background: #00f5d4;
                color: #000;
                box-shadow: 0 4px 15px rgba(0, 245, 212, 0.2);
            }
        </style>
    `;

    // State
    window.globalActiveEco = 'Solar';
    window.globalTimeRange = 'monthly';

    // Global filtering function
    window.filterGlobalEco = (eco) => {
        window.globalActiveEco = eco;
        document.querySelectorAll('.eco-tab').forEach(btn => {
            if (btn.textContent.includes(eco)) {
                btn.classList.add('active');
                btn.classList.remove('text-gray-500', 'hover:text-tealAccent');
            } else {
                btn.classList.remove('active');
                btn.classList.add('text-gray-500', 'hover:text-tealAccent');
            }
        });
        updateGlobalData(window.globalActiveEco, window.globalTimeRange);
    };

    window.setGlobalRange = (range) => {
        window.globalTimeRange = range;
        document.querySelectorAll('.range-tab').forEach(btn => {
            if (btn.id.includes(range)) {
                btn.classList.add('active');
                btn.classList.remove('text-gray-500', 'hover:text-tealAccent');
            } else {
                btn.classList.remove('active');
                btn.classList.add('text-gray-500', 'hover:text-tealAccent');
            }
        });
        updateGlobalData(window.globalActiveEco, window.globalTimeRange);
    };

    // Initial load
    window.filterGlobalEco('Solar');
}

let globalChartInstance = null;

async function updateGlobalData(ecosystem, range = 'monthly') {
    const db = getDB();
    const vendors = (db.Usuarios || []);
    
    // Use getAdminWorkers to include all team members (Mock + Dynamic)
    const { getAdminWorkers } = await import('../api.js');
    const allWorkers = await getAdminWorkers();
    const relevantVendors = allWorkers.filter(u => {
        const role = (u.rol || '').toLowerCase();
        return role.includes('vendedor') || role.includes('admin') || role.includes('ceo');
    });

    const clients = db.Clientes_Maestro || [];
    const projects = db.Proyectos_Dinamicos || [];

    const ecosystemLower = ecosystem.toLowerCase();

    // 1. Correct "Total Contactos" calculation (Sync with mobile chip logic)
    const ecoClients = clients.filter(c => {
        const deptsStr = (c.departamento || '').toLowerCase();
        // Check for "Solar", "Water", "Home" etc in the departamento string
        return deptsStr.includes(ecosystemLower);
    });

    // 2. Ecosystem Projects
    const ecoProjects = projects.filter(p => {
        const pipe = (db.Admin_Pipelines || []).find(pip => String(pip.id) === String(p.pipeline_id));
        if (!pipe) return false;
        const pipeName = (pipe.nombre || '').toLowerCase();
        const ecoLower = ecosystemLower.replace('renew ', '').trim();
        return pipeName.includes(ecosystemLower) || pipeName.includes(ecoLower);
    });

    // 3. Time Filtering
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filteredProjects = ecoProjects.filter(p => {
        if (range === 'total') return true; // Include everything for historical
        
        const dateToUse = (p.estado === 'Completado' || p.fase_id === 'Completado') ? (p.fecha_cierre || p.fecha) : p.fecha;
        if (!dateToUse) return false;
        const d = new Date(dateToUse + 'T12:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // We keep "Ventas Cerradas" as the final stage
    const closedSales = filteredProjects.filter(p => {
        const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(p.cliente_id)) || {};
        return p.fase_id === 'Completado' || p.estado === 'Completado';
    });

    // Update KPIs
    document.getElementById('kpi-total-contactos').textContent = ecoClients.length;
    document.getElementById('kpi-ventas-totales').textContent = closedSales.length;
    const closeRate = filteredProjects.length > 0 ? Math.round((closedSales.length / filteredProjects.length) * 100) : 0;
    document.getElementById('kpi-tasa-cierre').textContent = `${closeRate}%`;

    // Leaderboard data (Matching mobile dashboard.js logic)
    const leaderboardData = relevantVendors.map(v => {
        // Only count projects that are 100% finished
        const vProjects = filteredProjects.filter(p => String(p.responsable_id) === String(v.id));
        const vClosed = vProjects.filter(p => {
            const cli = (db.Clientes_Maestro || []).find(c => String(c.id) === String(p.cliente_id)) || {};
            return p.fase_id === 'Completado' || p.estado === 'Completado';
        });
        const vCloseRate = vProjects.length > 0 ? Math.round((vClosed.length / vProjects.length) * 100) : 0;
        
        // Match mobile "Ventas" count (ONLY 100% finished projects)
        const salesCount = vClosed.length; 
        const vCommissions = vClosed.length * 1000; // Commissions usually on closed deals

        return {
            ...v,
            sales: salesCount,
            closeRate: vCloseRate,
            commissions: vCommissions
        };
    }).filter(v => v.sales > 0 || (v.rol || '').toLowerCase().includes('vendedor'))
      .sort((a, b) => b.sales - a.sales);

    const tbody = document.getElementById('global-leaderboard-body');
    if (tbody) {
        tbody.innerHTML = leaderboardData.map(v => `
            <tr class="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                <td class="px-8 py-6">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full border-2 border-tealAccent/20 flex items-center justify-center text-xs font-black bg-tealAccent/10 text-tealAccent overflow-hidden">
                            ${v.foto ? `<img src="${v.foto}" class="w-full h-full object-cover">` : (v.initials || v.nombre[0])}
                        </div>
                        <div>
                            <p class="text-sm font-black text-gray-900 dark:text-white leading-none">${v.nombre} ${v.apellido || ''}</p>
                            <p class="text-[10px] text-gray-500 font-bold uppercase mt-1">Estatus: Activo</p>
                        </div>
                    </div>
                </td>
                <td class="px-8 py-6">
                    <span class="text-sm font-black text-gray-900 dark:text-white">${v.sales}</span>
                </td>
                <td class="px-8 py-6">
                    <div class="flex items-center gap-2">
                        <div class="w-12 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full bg-tealAccent shadow-teal-glow" style="width: ${v.closeRate}%"></div>
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

    // Chart Logic
    let labels = [];
    let chartDataArr = [];

    if (range === 'monthly') {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        chartDataArr = Array.from({ length: daysInMonth }, () => 0);

        closedSales.forEach(p => {
            const dateToUse = p.fecha_cierre || p.fecha;
            const d = new Date(dateToUse + 'T12:00:00');
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear && d.getDate() <= daysInMonth) {
                chartDataArr[d.getDate() - 1]++;
            }
        });
        document.querySelector('#globalPerformanceChart').parentElement.previousElementSibling.querySelector('p').textContent = 'Curva de ventas de toda la empresa este mes.';
    } else {
        // Range Total: Group by month of current year
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        labels = monthNames;
        chartDataArr = Array.from({ length: 12 }, () => 0);

        closedSales.forEach(p => {
            const dateToUse = p.fecha_cierre || p.fecha;
            const d = new Date(dateToUse + 'T12:00:00');
            if (d.getFullYear() === currentYear) {
                chartDataArr[d.getMonth()]++;
            }
        });
        document.querySelector('#globalPerformanceChart').parentElement.previousElementSibling.querySelector('p').textContent = 'Crecimiento de ventas acumulado este año.';
    }

    const canvas = document.getElementById('globalPerformanceChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (globalChartInstance) globalChartInstance.destroy();

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(0, 245, 212, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 245, 212, 0)');

        globalChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas Cerradas',
                    data: chartDataArr,
                    borderColor: '#00f5d4',
                    borderWidth: 4,
                    pointBackgroundColor: '#00f5d4',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.4,
                    fill: true,
                    backgroundColor: gradient
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111827',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: (context) => `Ventas: ${context.raw}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#64748b', font: { weight: 'bold', size: 10 }, stepSize: 1 }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { weight: 'bold', size: 10 } }
                    }
                }
            }
        });
    }
}
