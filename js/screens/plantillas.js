/* ============================================================
   RENEW OS – plantillas.js
   Full-page Plantillas hub screen (replaces modal popup)
   ============================================================ */

export function renderPlantillas() {
    const screen = document.getElementById('screen-plantillas');
    if (!screen) return;

    screen.innerHTML = `
    <style>
        .plant-header {
            position: sticky; top: 0; z-index: 10;
            background: var(--surface, #fff);
            border-bottom: 1px solid var(--border, #e5e7eb);
            padding: 14px 20px 12px;
            display: flex; align-items: center; gap: 12px;
        }
        .plant-back-btn {
            width: 38px; height: 38px; border-radius: 50%; border: none;
            background: var(--surface-alt, #f1f5f9); color: var(--text-secondary, #64748b);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; flex-shrink: 0; transition: all .2s;
        }
        .plant-back-btn:hover { background: rgba(0,245,212,.12); color: var(--primary, #00f5d4); }

        .plant-hero {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0d2a2a 100%);
            padding: 36px 24px 28px;
            text-align: center;
            position: relative; overflow: hidden;
        }
        .plant-hero::before {
            content: '';
            position: absolute; top: -60px; left: 50%; transform: translateX(-50%);
            width: 320px; height: 320px;
            background: radial-gradient(circle, rgba(0,245,212,.15) 0%, transparent 70%);
            pointer-events: none;
        }
        .plant-hero-icon {
            width: 72px; height: 72px; margin: 0 auto 16px;
            background: rgba(0,245,212,.12); border: 1px solid rgba(0,245,212,.25);
            border-radius: 24px; display: flex; align-items: center; justify-content: center;
            font-size: 2rem; position: relative; z-index: 1;
            box-shadow: 0 0 40px rgba(0,245,212,.2);
        }
        .plant-hero h1 {
            font-size: 1.8rem; font-weight: 900; color: #fff;
            letter-spacing: -0.5px; margin: 0 0 6px; position: relative; z-index: 1;
        }
        .plant-hero p {
            font-size: 0.75rem; color: rgba(0,245,212,.7); font-weight: 700;
            text-transform: uppercase; letter-spacing: 2px; margin: 0; position: relative; z-index: 1;
        }

        .plant-cats {
            display: flex; gap: 8px; overflow-x: auto; padding: 16px 20px 4px;
            -ms-overflow-style: none; scrollbar-width: none;
        }
        .plant-cats::-webkit-scrollbar { display: none; }
        .plant-cat-btn {
            flex-shrink: 0; padding: 7px 16px; border-radius: 50px; font-size: 0.7rem;
            font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border: none;
            cursor: pointer; transition: all .2s;
            background: var(--surface-alt, #f1f5f9); color: var(--text-secondary, #64748b);
        }
        .plant-cat-btn.active {
            background: var(--primary, #00f5d4); color: #0f172a;
            box-shadow: 0 4px 16px rgba(0,245,212,.35);
        }

        .plant-grid {
            padding: 12px 16px 100px;
            display: grid; grid-template-columns: 1fr;
            gap: 14px;
        }
        @media (min-width: 480px) { .plant-grid { grid-template-columns: 1fr 1fr; } }

        .plant-card {
            background: var(--surface, #fff);
            border: 1px solid var(--border, #e5e7eb);
            border-radius: 20px; padding: 22px 20px;
            display: flex; flex-direction: column; gap: 14px;
            cursor: pointer; transition: all .25s; position: relative; overflow: hidden;
            box-shadow: 0 2px 12px rgba(0,0,0,.04);
        }
        .plant-card::before {
            content: '';
            position: absolute; inset: 0; opacity: 0; transition: opacity .25s;
            background: linear-gradient(135deg, var(--card-accent, rgba(0,245,212,.06)), transparent);
        }
        .plant-card:active, .plant-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,.1); }
        .plant-card:hover::before { opacity: 1; }

        .plant-card-icon {
            width: 52px; height: 52px; border-radius: 16px;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.4rem; flex-shrink: 0;
        }
        .plant-card-body { flex: 1; }
        .plant-card-title { font-size: 1rem; font-weight: 900; color: var(--text-primary, #0f172a); margin: 0 0 4px; }
        .plant-card-sub   { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; }
        .plant-card-desc  { font-size: 0.72rem; color: var(--text-muted, #94a3b8); margin-top: 6px; line-height: 1.4; }

        .plant-card-arrow {
            width: 32px; height: 32px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.75rem; align-self: flex-end; transition: all .2s;
        }
        .plant-card:hover .plant-card-arrow { transform: translateX(3px); }

        .plant-section-label {
            padding: 8px 20px 0;
            font-size: 0.65rem; font-weight: 900; text-transform: uppercase;
            letter-spacing: 2px; color: var(--text-muted, #94a3b8);
        }
        .plant-empty {
            text-align: center; padding: 60px 20px;
            color: var(--text-muted, #94a3b8); font-size: 0.85rem; font-style: italic;
        }
    </style>

    <!-- Header -->
    <div class="plant-header">
        <button class="plant-back-btn" onclick="window.appNavigate('dashboard')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
        </button>
        <div>
            <h2 style="margin:0; font-size:1rem; font-weight:900; color:var(--text-primary);">Plantillas</h2>
            <p style="margin:0; font-size:0.65rem; color:var(--primary,#00f5d4); font-weight:700; text-transform:uppercase; letter-spacing:1px;">Documentos oficiales</p>
        </div>
    </div>

    <!-- Hero -->
    <div class="plant-hero">
        <div class="plant-hero-icon">📋</div>
        <h1>Plantillas</h1>
        <p>Selecciona el documento</p>
    </div>

    <!-- Category Filters -->
    <div class="plant-cats">
        <button class="plant-cat-btn active" data-cat="all">Todos</button>
        <button class="plant-cat-btn" data-cat="water">🌊 Water</button>
        <button class="plant-cat-btn" data-cat="solar">☀️ Solar</button>
        <button class="plant-cat-btn" data-cat="home">🏠 Home</button>
    </div>

    <!-- Cards Grid -->
    <div id="plant-grid" class="plant-grid"></div>
    `;

    // ── Data ────────────────────────────────────────────────────
    const templates = [
        {
            id:     'credit-app',
            title:  'Aplicación de Crédito',
            sub:    'Renew Water',
            desc:   'Formulario completo para solicitar financiamiento del cliente.',
            icon:   '💳',
            iconBg: 'rgba(59,130,246,.12)',
            iconColor: '#3b82f6',
            cat:    'water',
            navigate: 'credit-app'
        },
        {
            id:     'work-order',
            title:  'Orden de Trabajo',
            sub:    'Renew Water',
            desc:   'Registro de instalación y detalles técnicos del proyecto.',
            icon:   '🔧',
            iconBg: 'rgba(20,184,166,.12)',
            iconColor: '#14b8a6',
            cat:    'water',
            navigate: 'work-order'
        },
        {
            id:     'contract-app',
            title:  'Contrato',
            sub:    'Renew Water',
            desc:   'Contrato oficial de servicio con firma digital del cliente.',
            icon:   '✍️',
            iconBg: 'rgba(245,158,11,.12)',
            iconColor: '#f59e0b',
            cat:    'water',
            navigate: 'contract-app'
        },
        {
            id:     'confirmacion-instalacion',
            title:  'Confirmación de Instalación',
            sub:    'Renew Water',
            desc:   'Documento de cierre que confirma equipos instalados, observaciones y firma del cliente.',
            icon:   '✅',
            iconBg: 'rgba(14,165,233,.12)',
            iconColor: '#0ea5e9',
            cat:    'water',
            navigate: 'confirmacion-instalacion'
        },
    ];

    let activeFilter = 'all';

    function renderGrid() {
        const grid = document.getElementById('plant-grid');
        if (!grid) return;

        const filtered = activeFilter === 'all'
            ? templates
            : templates.filter(t => t.cat === activeFilter);

        if (!filtered.length) {
            grid.innerHTML = `<div class="plant-empty" style="grid-column:1/-1">
                <div style="font-size:2.5rem;margin-bottom:12px;">📂</div>
                <p>Próximamente plantillas para <strong>${activeFilter.charAt(0).toUpperCase()+activeFilter.slice(1)}</strong></p>
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(tpl => `
        <div class="plant-card" onclick="window.appNavigate('${tpl.navigate}')"
             style="--card-accent:${tpl.iconBg};">
            <div style="display:flex;align-items:flex-start;gap:14px;">
                <div class="plant-card-icon" style="background:${tpl.iconBg};">
                    ${tpl.icon}
                </div>
                <div class="plant-card-body">
                    <div class="plant-card-title">${tpl.title}</div>
                    <div class="plant-card-sub" style="color:${tpl.iconColor};">${tpl.sub}</div>
                    <div class="plant-card-desc">${tpl.desc}</div>
                </div>
            </div>
            <div style="display:flex;justify-content:flex-end;">
                <div class="plant-card-arrow" style="background:${tpl.iconBg};color:${tpl.iconColor};">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </div>
            </div>
        </div>`).join('');
    }

    // Category buttons
    document.querySelectorAll('.plant-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.plant-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.cat;
            renderGrid();
        });
    });

    renderGrid();
}
