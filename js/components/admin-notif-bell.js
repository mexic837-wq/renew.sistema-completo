/**
 * admin-notif-bell.js
 * ─────────────────────────────────────────────────────────────────
 * Campana de notificaciones administrativas.
 * Recopila: eventos de calendario, asignaciones de colaborador,
 * asignaciones de técnico, y proyectos donde eres responsable.
 *
 * Las notificaciones se marcan como leídas automáticamente.
 * Ahora se permite "archivar" para ocultarlas permanentemente del panel.
 * ─────────────────────────────────────────────────────────────────
 */

import { getDB, getCurrentUser } from '../api.js';

const STORAGE_KEY = 'rs_admin_notifs_read';
const ARCHIVED_KEY = 'rs_admin_notifs_archived';

/** Devuelve el set de IDs ya leídos */
function getReadIds() {
    try {
        return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch {
        return new Set();
    }
}

/** Marca una lista de IDs como leídos */
function markAsRead(ids) {
    const current = getReadIds();
    ids.forEach(id => current.add(id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
}

/** Devuelve el set de IDs archivados (borrados visualmente) */
function getArchivedIds() {
    try {
        return new Set(JSON.parse(localStorage.getItem(ARCHIVED_KEY) || '[]'));
    } catch {
        return new Set();
    }
}

/** Archiva un ID para que no vuelva a aparecer */
function markAsArchived(id) {
    const current = getArchivedIds();
    current.add(id);
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...current]));
}

/** Recopila todas las notificaciones admin para el usuario actual */
export function gatherAdminNotifications(db, user) {
    if (!db || !user) return [];
    const notifs = [];
    const readIds = getReadIds();
    const archivedIds = getArchivedIds();
    const isAdminUser = ['admin', 'administrador', 'ceo'].includes((user.rol || '').toLowerCase());

    // ── 1. Eventos de Calendario ──────────────────────────────────
    const eventos = db.calendario_eventos || [];
    eventos.forEach(ev => {
        const attendees = Array.isArray(ev.attendees) ? ev.attendees : [];
        const colaboradores = Array.isArray(ev.colaboradores) ? ev.colaboradores : [];
        const allParticipants = [...attendees, ...colaboradores];
        const isInvited = allParticipants.some(a => String(a.id) === String(user.id));
        if (!isInvited && !isAdminUser) return;

        const notifId = `ev_${ev.id}`;
        if (archivedIds.has(notifId)) return;

        const fecha = ev.fecha_inicio ? new Date(ev.fecha_inicio).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
        notifs.push({
            id: notifId,
            type: 'evento',
            icon: 'fa-calendar-check',
            color: '#10b981',
            bg: 'rgba(16,185,129,0.12)',
            title: isAdminUser && !isInvited ? `Evento: ${ev.nombre || 'Evento'} (Global)` : `Invitado a: ${ev.nombre || 'Evento'}`,
            message: isAdminUser && !isInvited ? `Evento global programado el ${fecha}.` : `Tienes un evento programado el ${fecha}.`,
            date: new Date(ev.created_at || ev.fecha_inicio || Date.now()),
            isRead: readIds.has(notifId),
            link: {
                label: 'Ver Calendario',
                action: 'calendario',
                data: { eventId: ev.id }
            }
        });
    });

    // ── 2. colaborador en Proyectos ────────────────────────────────
    const proyectos = db.Proyectos_Dinamicos || [];
    const clientes = db.Clientes_Maestro || [];

    proyectos.forEach(p => {
        const colaboradores = Array.isArray(p.colaboradores) ? p.colaboradores : [];
        const obsEntry = colaboradores.find(o => String(o.id) === String(user.id));
        if (!obsEntry && !isAdminUser) return;

        // Si es admin y no hay colaboradores, evitamos spammear si no es relevante?
        // El usuario pidió: "absolutamnete todas estas notifiaciones porfavor, de cualqueir cosa que se haga para llevar un control".
        // Entonces si alguien es añadido como colaborador, le notificamos al admin.
        // Pero para no crear una notificacion duplicada de "colaborador" y "Responsable" y "Tecnico" para el mismo proyecto al mismo tiempo,
        // Quizás solo mostremos "colaborador" si hay colaboradores nuevos.
        // Asumamos que si colaboradores.length > 0, es un evento de colaborador.
        if (isAdminUser && !obsEntry && colaboradores.length === 0) return;

        const notifId = isAdminUser && !obsEntry ? `obs_adm_${p.id}` : `obs_${p.id}`;
        if (archivedIds.has(notifId)) return;

        const cli = clientes.find(c => c.id === p.cliente_id);
        const clienteName = cli ? `${cli.nombre || ''}` : 'un cliente';
        notifs.push({
            id: notifId,
            type: 'colaborador',
            icon: 'fa-eye',
            color: '#8b5cf6',
            bg: 'rgba(139,92,246,0.12)',
            title: isAdminUser && !obsEntry ? `colaboradores asignados` : `colaborador en proyecto`,
            message: isAdminUser && !obsEntry ? `Se asignaron colaboradores al proyecto de ${clienteName}.` : `Te añadieron como colaborador en el proyecto de ${clienteName}.`,
            date: new Date(obsEntry ? (obsEntry.added_at || p.created_at) : (p.created_at || Date.now())),
            isRead: readIds.has(notifId),
            link: {
                label: 'Ver Proyecto',
                action: 'proyecto',
                data: { projectId: p.id, clienteId: p.cliente_id }
            }
        });
    });

    // ── 3. Asignaciones de Técnico ────────────────────────────────
    proyectos.forEach(p => {
        const isTecnico = String(p.tecnico_id) === String(user.id);
        if (!isTecnico && !isAdminUser) return;
        if (isAdminUser && !isTecnico && !p.tecnico_id) return; // Solo si hay técnico asignado

        const notifId = isAdminUser && !isTecnico ? `tec_adm_${p.id}` : `tec_${p.id}`;
        if (archivedIds.has(notifId)) return;

        const cli = clientes.find(c => c.id === p.cliente_id);
        const clienteName = cli ? `${cli.nombre || ''}` : 'un cliente';
        notifs.push({
            id: notifId,
            type: 'asignacion',
            icon: 'fa-clipboard-user',
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.12)',
            title: isAdminUser && !isTecnico ? `Técnico Asignado` : `Asignado como Técnico`,
            message: isAdminUser && !isTecnico ? `Se asignó un técnico para ${clienteName}.` : `Tienes una nueva asignación técnica para ${clienteName}.`,
            date: new Date(p.fecha || p.created_at || Date.now()),
            isRead: readIds.has(notifId),
            link: {
                label: 'Ver Proyecto',
                action: 'proyecto',
                data: { projectId: p.id, clienteId: p.cliente_id }
            }
        });
    });

    // ── 4. Responsable en Proyectos ───────────────────────────────
    proyectos.forEach(p => {
        const responsables = (p.responsable_id || '').split(',').map(id => id.trim());
        const isResponsable = responsables.includes(String(user.id)) || p.asignado_a === user.id || (Array.isArray(p.colaboradores) && p.colaboradores.some(c => c.id === user.id));
        if (!isResponsable && !isAdminUser) return;
        if (isAdminUser && !isResponsable && responsables.length === 0) return;

        // Evitar duplicado para el mismo usuario si ya es técnico
        if (String(p.tecnico_id) === String(user.id)) return; 

        const notifId = isAdminUser && !isResponsable ? `resp_adm_${p.id}` : `resp_${p.id}`;
        if (archivedIds.has(notifId)) return;

        const cli = clientes.find(c => c.id === p.cliente_id);
        const clienteName = cli ? `${cli.nombre || ''}` : 'un cliente';
        notifs.push({
            id: notifId,
            type: 'proyecto',
            icon: 'fa-user-tie',
            color: '#00f5d4',
            bg: 'rgba(0,245,212,0.12)',
            title: isAdminUser && !isResponsable ? `Responsable Asignado` : `Responsable de Proyecto`,
            message: isAdminUser && !isResponsable ? `Hay responsables en el proyecto de ${clienteName}.` : `Eres responsable del proyecto de ${clienteName}.`,
            date: new Date(p.fecha || p.created_at || Date.now()),
            isRead: readIds.has(notifId),
            link: {
                label: 'Ver Proyecto',
                action: 'proyecto',
                data: { projectId: p.id, clienteId: p.cliente_id }
            }
        });
    });

    // ── 5. Nuevos Adelantos (Para Admins/CEO) ───────────────────────────────
    if (isAdminUser) {
        const adelantos = db.rrhh_adelantos || [];
        adelantos.forEach(ad => {
            const notifId = `adel_${ad.id}`;
            if (archivedIds.has(notifId)) return;
            
            notifs.push({
                id: notifId,
                type: 'adelanto',
                icon: 'fa-hand-holding-dollar',
                color: '#14b8a6',
                bg: 'rgba(20, 184, 166, 0.12)',
                title: `Adelanto: ${ad.trabajador_nombre || 'Colaborador'}`,
                message: `Monto $${ad.monto} (${ad.estado || 'Pendiente'}).`,
                date: new Date(ad.created_at || Date.now()),
                isRead: readIds.has(notifId),
                link: {
                    label: 'Ver Adelantos',
                    action: 'hrhub_adelantos',
                    data: {}
                }
            });
        });
    }

    // ── 6. Mis Adelantos (Para el Trabajador) ───────────────────────────────
    const misAdelantos = (db.rrhh_adelantos || []).filter(ad => String(ad.trabajador_id) === String(user.id));
    misAdelantos.forEach(ad => {
        const notifId = `mi_adel_${ad.id}`;
        if (archivedIds.has(notifId)) return;
        
        notifs.push({
            id: notifId,
            type: 'adelanto_propio',
            icon: 'fa-hand-holding-dollar',
            color: '#0ea5e9',
            bg: 'rgba(14, 165, 233, 0.12)',
            title: `Adelanto Registrado`,
            message: `Monto $${Number(ad.monto).toLocaleString('en-US', {minimumFractionDigits:2})} (${ad.motivo || 'Sin motivo'}).`,
            date: new Date(ad.created_at || Date.now()),
            isRead: readIds.has(notifId),
            link: {
                label: 'Ver mis adelantos',
                action: 'mis_adelantos',
                data: {}
            }
        });
    });

    // ── 7. Menciones y Mensajes en Chat ────────────────────────────────
    proyectos.forEach(p => {
        let discusionArray = [];
        try { discusionArray = typeof p.discusion === 'string' ? JSON.parse(p.discusion || '[]') : (p.discusion || []); } catch(e) {}
        if (discusionArray.length === 0) return;

        const cli = clientes.find(c => c.id === p.cliente_id);
        const clienteName = cli ? `${cli.nombre || ''}` : 'un cliente';
        
        const isManager = ['manager', 'project manager', 'oficina'].some(r => (user.rol||'').toLowerCase().includes(r));
        const isAssigned = p.asignado_a === user.id || p.responsable_id === user.id;

        const relevantMessages = discusionArray.filter(msg => {
            if (String(msg.user_id) === String(user.id)) return false; 
            
            if (isAdminUser) return true; 
            if (isManager && isAssigned) return true; 
            if ((msg.mentions || []).includes(String(user.id))) return true; 
            
            return false;
        });

        if (relevantMessages.length > 0) {
            const lastMessage = relevantMessages[relevantMessages.length - 1];
            const msgDate = new Date(lastMessage.date);
            const isMention = (lastMessage.mentions || []).includes(String(user.id));
            const notifId = `chat_${p.id}_${msgDate.getTime()}`; 
            if (archivedIds.has(notifId)) return;

            notifs.push({
                id: notifId,
                type: 'chat',
                icon: 'fa-comments',
                color: isMention ? '#a855f7' : '#3b82f6',
                bg: isMention ? 'rgba(168,85,247,0.12)' : 'rgba(59,130,246,0.12)',
                title: isMention ? `Mención en Chat` : `Mensaje en Proyecto`,
                message: `${lastMessage.user || 'Alguien'} dice: "${lastMessage.text}" en ${clienteName}`,
                date: msgDate,
                isRead: readIds.has(notifId),
                link: {
                    label: 'Ver Chat',
                    action: 'proyecto', 
                    data: { projectId: p.id, clienteId: p.cliente_id }
                }
            });
        }
    });

    // Ordenar por fecha desc (más reciente primero)
    notifs.sort((a, b) => b.date - a.date);
    return notifs;
}

/** Actualiza el badge de la campana en ambas versiones (admin + app) */
export function updateAdminBellBadge() {
    const db = getDB();
    const user = getCurrentUser();
    if (!db || !user) return;

    const notifs = gatherAdminNotifications(db, user);
    const unread = notifs.filter(n => !n.isRead).length;

    // Admin (admin.html)
    const adminBadge = document.getElementById('admin-bell-badge');
    if (adminBadge) {
        if (unread > 0) {
            adminBadge.textContent = unread > 9 ? '9+' : String(unread);
            adminBadge.classList.remove('hidden');
        } else {
            adminBadge.classList.add('hidden');
        }
    }

    // App (index.html)
    const appBadge = document.getElementById('app-bell-badge');
    if (appBadge) {
        if (unread > 0) {
            appBadge.textContent = unread > 9 ? '9+' : String(unread);
            appBadge.classList.remove('hidden');
        } else {
            appBadge.classList.add('hidden');
        }
    }
}

/** Renderiza y abre el panel de campana */
export function openAdminBellPanel() {
    const db = getDB();
    const user = getCurrentUser();
    if (!db || !user) return;

    const notifs = gatherAdminNotifications(db, user);

    // Marcar todas como leídas al abrir
    markAsRead(notifs.map(n => n.id));

    // Quitar badge
    ['admin-bell-badge', 'app-bell-badge'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Crear/actualizar panel
    let panel = document.getElementById('admin-bell-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'admin-bell-panel';
        document.body.appendChild(panel);
    }

    const isAdmin = typeof window._isAdminPage !== 'undefined' ? window._isAdminPage : window.location.pathname.includes('admin');

    panel.innerHTML = `
    <style>
        #admin-bell-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px); z-index: 99998;
            animation: fadeIn 0.2s ease;
        }
        #admin-bell-drawer {
            position: fixed; top: 0; right: 0; height: 100vh;
            width: 380px; max-width: 95vw;
            background: ${isAdmin ? '#0f172a' : 'var(--surface, #111)'};
            border-left: 1px solid rgba(255,255,255,0.07);
            z-index: 99999; display: flex; flex-direction: column;
            box-shadow: -20px 0 60px rgba(0,0,0,0.5);
            animation: slideInRight 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .bell-notif-item {
            display: flex; align-items: flex-start; gap: 14px;
            padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);
            cursor: default; transition: background 0.2s;
            position: relative;
        }
        .bell-notif-item.unread {
            background: rgba(255,255,255,0.02);
        }
        .bell-notif-item.unread::before {
            content: ''; position: absolute; left: 0; top: 0; bottom: 0;
            width: 3px; border-radius: 0 4px 4px 0;
            background: var(--primary, #00f5d4);
        }
        .bell-notif-icon {
            width: 42px; height: 42px; border-radius: 13px;
            display: flex; align-items: center; justify-content: center;
            font-size: 1rem; flex-shrink: 0;
        }
        .bell-notif-body { flex: 1; min-width: 0; }
        .bell-notif-title {
            font-size: 0.82rem; font-weight: 800; color: #e2e8f0;
            margin-bottom: 3px; line-height: 1.3; padding-right: 18px;
        }
        .bell-notif-msg {
            font-size: 0.75rem; color: #94a3b8; line-height: 1.4;
            margin-bottom: 8px;
        }
        .bell-notif-date {
            font-size: 0.65rem; color: #475569; font-weight: 600;
        }
        .bell-link-btn {
            display: inline-flex; align-items: center; gap: 5px;
            font-size: 0.7rem; font-weight: 800;
            padding: 5px 10px; border-radius: 8px; border: none;
            cursor: pointer; transition: all 0.2s; margin-top: 4px;
        }
        .bell-notif-archive-btn {
            position: absolute; top: 12px; right: 12px;
            background: transparent; border: none;
            color: #64748b; cursor: pointer; transition: color 0.2s;
            font-size: 0.8rem; padding: 4px; border-radius: 4px;
        }
        .bell-notif-archive-btn:hover {
            color: #ef4444; background: rgba(239, 68, 68, 0.1);
        }
    </style>

    <div id="admin-bell-overlay"></div>
    <div id="admin-bell-drawer">
        <!-- Header -->
        <div style="padding: 24px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 38px; height: 38px; border-radius: 12px; background: rgba(0,245,212,0.1); display: flex; align-items: center; justify-content: center; color: #00f5d4;">
                    <i class="fa-solid fa-bell"></i>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 0.9rem; font-weight: 900; color: white; letter-spacing: -0.3px;">Notificaciones</h3>
                    <p style="margin: 0; font-size: 0.65rem; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Administrativas</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                ${notifs.length > 0 ? `
                <button id="admin-bell-clear-all-btn" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: all 0.2s;" title="Vaciar todas las notificaciones">
                    <i class="fa-solid fa-trash-can" style="margin-right: 4px;"></i> Vaciar todo
                </button>
                ` : ''}
                <button id="admin-bell-close-btn" style="width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.05); border: none; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem; transition: all 0.2s;"
                    onmouseover="this.style.color='white'; this.style.background='rgba(255,255,255,0.1)'"
                    onmouseout="this.style.color='#64748b'; this.style.background='rgba(255,255,255,0.05)'">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>

        <!-- List -->
        <div style="flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;">
            ${notifs.length === 0 ? `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 16px; color: #475569;">
                    <i class="fa-regular fa-bell-slash" style="font-size: 2.5rem; opacity: 0.4;"></i>
                    <p style="font-size: 0.85rem; font-weight: 700; margin: 0;">Sin notificaciones pendientes</p>
                    <p style="font-size: 0.75rem; margin: 0; color: #334155;">Todo está al día <i class="fa-solid fa-champagne-glasses"></i></p>
                </div>
            ` : notifs.map(n => `
                <div class="bell-notif-item ${n.isRead ? '' : 'unread'}">
                    <button class="bell-notif-archive-btn" data-notif-id="${n.id}" title="Archivar notificación">
                        <i class="fa-solid fa-times"></i>
                    </button>
                    <div class="bell-notif-icon" style="background: ${n.bg}; color: ${n.color};">
                        <i class="fa-solid ${n.icon}"></i>
                    </div>
                    <div class="bell-notif-body">
                        <div class="bell-notif-title">${n.title}</div>
                        <div class="bell-notif-msg">${n.message}</div>
                        <div class="bell-notif-date">
                            <i class="fa-regular fa-clock" style="margin-right: 4px;"></i>
                            ${n.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        ${n.link ? `
                            <button class="bell-link-btn"
                                data-action="${n.link.action}"
                                data-project-id="${n.link.data?.projectId || ''}"
                                data-cliente-id="${n.link.data?.clienteId || ''}"
                                style="background: ${n.bg}; color: ${n.color}; margin-top: 8px;">
                                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.6rem;"></i>
                                ${n.link.label}
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Footer -->
        <div style="padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;">
            <p style="margin: 0; font-size: 0.65rem; color: #334155; font-weight: 600; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                <i class="fa-solid fa-circle-info" style="margin-right: 4px;"></i>
                Las notificaciones archivadas no volverán a aparecer
            </p>
        </div>
    </div>
    `;

    // Cerrar
    const overlay = panel.querySelector('#admin-bell-overlay');
    const closeBtn = panel.querySelector('#admin-bell-close-btn');
    const close = () => {
        panel.innerHTML = '';
        updateAdminBellBadge(); // re-check after reading
    };
    overlay.addEventListener('click', close);
    closeBtn.addEventListener('click', close);

    // Botones de archivar
    panel.querySelectorAll('.bell-notif-archive-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const notifId = btn.dataset.notifId;
            markAsArchived(notifId);
            const item = btn.closest('.bell-notif-item');
            if (item) {
                item.style.transition = 'opacity 0.2s, height 0.2s';
                item.style.opacity = '0';
                item.style.height = item.offsetHeight + 'px';
                setTimeout(() => {
                    item.style.height = '0px';
                    item.style.padding = '0px';
                    item.style.border = 'none';
                    item.style.overflow = 'hidden';
                }, 200);
                setTimeout(() => {
                    item.remove();
                    updateAdminBellBadge();
                    
                    // Si ya no hay items, volver a renderizar para mostrar empty state
                    const remainingItems = panel.querySelectorAll('.bell-notif-item');
                    if (remainingItems.length === 0) {
                        openAdminBellPanel();
                    }
                }, 400);
            }
        });
    });

    // Botón de vaciar todo
    const clearAllBtn = panel.querySelector('#admin-bell-clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('¿Vaciar todas las notificaciones?')) {
                const items = panel.querySelectorAll('.bell-notif-item');
                items.forEach(item => {
                    const btn = item.querySelector('.bell-notif-archive-btn');
                    if (btn) {
                        markAsArchived(btn.dataset.notifId);
                    }
                    item.style.transition = 'opacity 0.2s, height 0.2s';
                    item.style.opacity = '0';
                    item.style.height = item.offsetHeight + 'px';
                    setTimeout(() => {
                        item.style.height = '0px';
                        item.style.padding = '0px';
                        item.style.border = 'none';
                        item.style.overflow = 'hidden';
                    }, 200);
                });
                
                setTimeout(() => {
                    items.forEach(item => item.remove());
                    updateAdminBellBadge();
                    openAdminBellPanel();
                }, 400);
            }
        });
    }

    // Botones de enlace directo
    panel.querySelectorAll('.bell-link-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const projectId = btn.dataset.projectId;
            const clienteId = btn.dataset.clienteId;

            if (action === 'calendario') {
                close();
                // Admin: navegar a calendario
                if (window.navigateTo) window.navigateTo('calendario');
                else if (window.appNavigate) window.appNavigate('mi-calendario');
                else {
                    const calBtn = document.querySelector('[data-view="calendario"]');
                    if (calBtn) calBtn.click();
                }
            } else if (action === 'proyecto') {
                close();
                // Admin: abrir el drawer del proyecto
                if (window.openKanbanDrawer && projectId) {
                    window.openKanbanDrawer(projectId);
                } else if (window.appNavigate && clienteId) {
                    const notifItem = btn.closest('.bell-notif-item');
                    if (notifItem && notifItem.querySelector('.fa-clipboard-user')) {
                        window.appNavigate('notificaciones');
                    } else {
                        localStorage.setItem('scroll_to_chat', projectId);
                        window.appNavigate('detail', projectId);
                    }
                }
            } else if (action === 'hrhub_adelantos') {
                close();
                const hrBtn = document.querySelector('[data-view="hrhub"]');
                if (hrBtn) hrBtn.click();
                setTimeout(() => {
                    const adBtn = document.querySelector('.hr-view-btn[data-target="adelantos"]');
                    if (adBtn) adBtn.click();
                }, 300);
            } else if (action === 'mis_adelantos') {
                close();
                if (window.appNavigate) window.appNavigate('mis-adelantos');
                else {
                    const viewBtn = document.querySelector('[data-view="mis-adelantos"]');
                    if (viewBtn) viewBtn.click();
                }
            }
        });
    });
}

/** Inicializa la campana: agrega listeners y actualiza badge */
export function initAdminBell() {
    // Marcar que estamos en admin
    window._isAdminPage = window.location.pathname.includes('admin');

    // Botón en admin.html
    const adminBellBtn = document.getElementById('btn-notifications');
    if (adminBellBtn) {
        adminBellBtn.onclick = (e) => {
            e.preventDefault();
            openAdminBellPanel();
        };
    }

    // Botón en index.html (app)
    const appBellBtn = document.getElementById('btn-app-bell');
    if (appBellBtn) {
        appBellBtn.onclick = (e) => {
            e.preventDefault();
            openAdminBellPanel();
        };
    }

    // Actualizar badge inmediatamente
    updateAdminBellBadge();

    // Actualizar badge cuando la DB se sincroniza
    window.addEventListener('db_synced', updateAdminBellBadge);
}

