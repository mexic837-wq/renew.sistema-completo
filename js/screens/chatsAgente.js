/* ============================================================
   RENEW OS – screens/chatsAgente.js
   Bandeja tipo WhatsApp con las conversaciones del agente de IA
   (número de Evolution API): leer, responder (texto, fotos, PDF y
   respuestas rápidas), ver pendientes, pausar al agente por contacto,
   consultar la ficha del cliente, recibir avisos de mensajes nuevos y
   organizar la bandeja (asignar, etiquetar, notas internas, archivar).
   ============================================================ */

import { authHeaders } from '../api.js';

const REFRESCO_MS = 15000;

// <img>/<audio> no mandan cabeceras, así que el pase de sesión va en la URL
const urlArchivo = (id) => `/api/agente-chats/media/${encodeURIComponent(id)}?instancia=${encodeURIComponent(estado.instancia || '')}&t=${encodeURIComponent(localStorage.getItem('rs_token') || '')}`;

// Número de WhatsApp (instancia de Evolution) que se está viendo; se recuerda entre visitas
const CLAVE_INSTANCIA = 'ca_instancia';
const leerInstanciaGuardada = () => { try { return localStorage.getItem(CLAVE_INSTANCIA) || ''; } catch (e) { return ''; } };
const qsInstancia = () => `instancia=${encodeURIComponent(estado.instancia || '')}`;

// Lee la respuesta; si la sesión no es válida lo dice claro (las sesiones viejas no tienen pase)
async function leer(r) {
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error('Tu sesión expiró. Cierra sesión y vuelve a entrar.');
    if (!r.ok) throw new Error(data.error || 'Error');
    return data;
}

const estado = {
    chats: [],
    filtro: 'todos',
    busqueda: '',
    activo: null,      // clave del chat abierto
    mensajes: [],
    pagina: 1,
    hayMas: false,
    timer: null,
    fichaAbierta: false,
    respuestas: null,  // respuestas rápidas (se cargan al usarlas por primera vez)
    abrirAlCargar: null, // clave del chat a abrir al entrar desde una notificación
    instancia: leerInstanciaGuardada(), // vacío = la del agente (la decide el servidor)
    esAgente: true,      // si el número que se ve es el del agente (solo ahí aplica la pausa)
    instancias: [],
};

// Tiempo transcurrido corto: "5 min", "3 h", "2 d"
function hace(ts) {
    const min = Math.max(0, Math.floor((Date.now() / 1000 - ts) / 60));
    if (min < 60) return `${min} min`;
    if (min < 60 * 24) return `${Math.floor(min / 60)} h`;
    return `${Math.floor(min / 1440)} d`;
}

const horaPausa = (iso) => new Date(iso).toLocaleString('es', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Formato de WhatsApp: *negrita*, _cursiva_, ~tachado~, saltos de línea y enlaces
function formatoWa(texto) {
    return esc(texto)
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" class="underline text-sky-600 dark:text-sky-400 break-all">$1</a>')
        .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
        .replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>')
        .replace(/~([^~\n]+)~/g, '<s>$1</s>')
        .replace(/\n/g, '<br>');
}

const hora = (ts) => new Date(ts * 1000).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

function fechaCorta(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000), hoy = new Date();
    const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return hora(ts);
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function separadorFecha(ts) {
    const d = new Date(ts * 1000), hoy = new Date();
    const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const TIPOS = {
    equipo: { label: 'Equipo', clase: 'bg-tealAccent/10 text-tealAccent border-tealAccent/20' },
    cliente: { label: 'Cliente', clase: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    desconocido: { label: 'Desconocido', clase: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
    grupo: { label: 'Grupo', clase: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
    lead: { label: 'Lead', clase: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
};

// Etiquetas sugeridas (se puede escribir cualquiera)
const ETIQUETAS_SUGERIDAS = ['Interesado', 'Pidió precio', 'Agendar visita', 'Seguimiento', 'Urgente', 'No interesado'];
const COLORES_ETIQUETA = ['bg-sky-500/15 text-sky-600 dark:text-sky-300', 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300', 'bg-violet-500/15 text-violet-600 dark:text-violet-300', 'bg-rose-500/15 text-rose-600 dark:text-rose-300', 'bg-amber-500/15 text-amber-700 dark:text-amber-300', 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'];
// Cada etiqueta siempre con el mismo color
const colorEtiqueta = (t) => COLORES_ETIQUETA[[...t].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORES_ETIQUETA.length];
const chipEtiqueta = (t, quitar) => `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${colorEtiqueta(t)}">${esc(t)}${quitar ? `<button type="button" class="ca-quitar-etiqueta opacity-60 hover:opacity-100" data-etiqueta="${esc(t)}">×</button>` : ''}</span>`;

const usuarioActualId = () => { try { return String(JSON.parse(localStorage.getItem('rs_user') || '{}').id || ''); } catch (e) { return ''; } };

function avatar(chat, tam = 'w-11 h-11') {
    const iniciales = (chat.nombre || '?').replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '#';
    const fondo = { equipo: 'bg-tealAccent/20 text-tealAccent', cliente: 'bg-blue-500/20 text-blue-500', grupo: 'bg-purple-500/20 text-purple-500' }[chat.tipo] || 'bg-gray-200 dark:bg-white/10 text-gray-500';
    if (chat.foto) {
        return `<img src="${esc(chat.foto)}" class="${tam} rounded-full object-cover flex-shrink-0" referrerpolicy="no-referrer"
                 onerror="this.outerHTML='<div class=&quot;${tam} rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${fondo}&quot;>${esc(iniciales)}</div>'">`;
    }
    return `<div class="${tam} rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${fondo}">${esc(iniciales)}</div>`;
}

function vistaPrevia(m) {
    if (!m) return '';
    const etiquetas = { imageMessage: '📷 Foto', documentMessage: '📄 Documento', documentWithCaptionMessage: '📄 Documento', audioMessage: '🎤 Audio', videoMessage: '🎥 Video', stickerMessage: 'Sticker', reactionMessage: 'Reacción', protocolMessage: 'Mensaje eliminado o editado' };
    const base = m.texto || m.archivo || etiquetas[m.tipo] || 'Mensaje';
    return (m.fromMe ? '<i class="fa-solid fa-check-double text-[10px] mr-1 text-gray-400"></i>' : '') + esc(base.replace(/\s+/g, ' ').slice(0, 80));
}

function chatsFiltrados() {
    const q = estado.busqueda.trim().toLowerCase();
    return estado.chats.filter(c => {
        if (estado.filtro === 'archivados') { if (!c.archivada) return false; }
        else if (c.archivada) return false;
        else if (estado.filtro === 'pendientes') { if (!c.pendiente) return false; }
        else if (estado.filtro === 'mios') { if (c.asignado?.id !== usuarioActualId()) return false; }
        else if (estado.filtro !== 'todos' && c.tipo !== estado.filtro) return false;
        if (q && (c.etiquetas || []).some(e => e.toLowerCase().includes(q))) return true;
        if (!q) return true;
        return (c.nombre || '').toLowerCase().includes(q) || (c.telefono || '').includes(q.replace(/\D/g, '') || '¬') || (c.ultimo?.texto || '').toLowerCase().includes(q);
    });
}

function pintarLista() {
    const cont = document.getElementById('ca-lista');
    if (!cont) return;
    const lista = chatsFiltrados();
    if (!lista.length) {
        cont.innerHTML = `<div class="p-8 text-center text-xs text-gray-400">No hay conversaciones${estado.busqueda ? ' que coincidan' : ''}.</div>`;
        return;
    }
    cont.innerHTML = lista.map(c => `
        <button data-clave="${esc(c.clave)}" class="ca-chat w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-100 dark:border-white/5 transition-colors ${estado.activo === c.clave ? 'bg-tealAccent/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}">
            ${avatar(c)}
            <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-sm text-gray-900 dark:text-white truncate">${c.pausa ? '<i class="fa-solid fa-circle-pause text-amber-500 mr-1" title="Agente en pausa"></i>' : ''}${esc(c.nombre)}</span>
                    <span class="text-[10px] flex-shrink-0 ${c.pendiente ? 'text-red-500 font-bold' : 'text-gray-400'}">${c.pendiente ? 'espera ' + hace(c.ultimo.ts) : fechaCorta(c.ultimo?.ts)}</span>
                </div>
                <div class="flex items-center justify-between gap-2 mt-0.5">
                    <span class="text-xs truncate ${c.pendiente ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400'}">${c.pendiente ? '<span class="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle"></span>' : ''}${vistaPrevia(c.ultimo)}</span>
                    <span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border flex-shrink-0 ${(TIPOS[c.tipo] || TIPOS.desconocido).clase}">${(TIPOS[c.tipo] || TIPOS.desconocido).label}</span>
                </div>
                ${(c.etiquetas || []).length || c.asignado || c.notas ? `<div class="flex items-center gap-1 mt-1 flex-wrap">
                    ${(c.etiquetas || []).slice(0, 3).map(t => chipEtiqueta(t)).join('')}
                    ${c.notas ? `<span class="text-[10px] text-gray-400" title="Notas internas"><i class="fa-regular fa-note-sticky"></i> ${c.notas}</span>` : ''}
                    ${c.asignado ? `<span class="ml-auto text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[45%]" title="Asignado a ${esc(c.asignado.nombre)}"><i class="fa-solid fa-user-check text-tealAccent"></i> ${esc(c.asignado.nombre.split(' ')[0])}</span>` : ''}
                </div>` : ''}
            </div>
        </button>`).join('');
    cont.querySelectorAll('.ca-chat').forEach(b => b.addEventListener('click', () => abrirChat(b.dataset.clave)));
}

function burbuja(m) {
    const ticks = m.fromMe
        ? `<i class="fa-solid ${m.estado === 'enviado' ? 'fa-check' : 'fa-check-double'} text-[10px] ${m.estado === 'leido' ? 'text-sky-500' : 'text-gray-400'}"></i>` : '';
    let contenido = '';
    if (m.tipo === 'imageMessage' || m.tipo === 'stickerMessage') {
        contenido = `<img src="${urlArchivo(m.id)}" loading="lazy" class="rounded-lg max-w-[240px] max-h-[320px] object-cover cursor-pointer mb-1 bg-black/5"
                       onclick="window.open(this.src,'_blank')" onerror="this.outerHTML='<span class=&quot;text-xs text-gray-400&quot;>📷 Foto no disponible</span>'">`;
    } else if (m.archivo) {
        contenido = `<a href="${urlArchivo(m.id)}" target="_blank" class="flex items-center gap-2 p-2 mb-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10">
                        <i class="fa-solid fa-file-pdf text-red-500 text-lg"></i><span class="text-xs font-semibold truncate max-w-[200px]">${esc(m.archivo)}</span></a>`;
    } else if (m.tipo === 'audioMessage') {
        contenido = `<audio controls preload="none" src="${urlArchivo(m.id)}" class="max-w-[240px] mb-1"></audio>`;
    } else if (!m.texto) {
        contenido = `<span class="text-xs italic text-gray-400">Mensaje no compatible (${esc(m.tipo || 'desconocido')})</span>`;
    }
    const texto = m.texto && !(m.archivo && m.texto === m.archivo) ? `<div class="text-[13px] leading-snug break-words">${formatoWa(m.texto)}</div>` : '';
    // Quién envió: alguien del equipo desde el panel (con nombre), una persona desde el teléfono,
    // o el agente (la API sale como "web", igual que WhatsApp Web)
    let manual = '';
    if (m.fromMe && m.enviadoPor) manual = `<span class="mr-auto italic font-semibold"><i class="fa-solid fa-user mr-0.5"></i>${esc(m.enviadoPor)}</span>`;
    else if (m.fromMe && ['android', 'ios', 'desktop'].includes(m.origen)) manual = `<span class="mr-auto italic"><i class="fa-solid fa-${m.origen === 'desktop' ? 'desktop' : 'mobile-screen'} mr-0.5"></i>persona</span>`;
    else if (m.fromMe && m.origen === 'web') manual = `<span class="mr-auto italic" title="Enviado por el agente (o desde WhatsApp Web)"><i class="fa-solid fa-robot mr-0.5"></i>agente</span>`;
    return `
        <div class="flex ${m.fromMe ? 'justify-end' : 'justify-start'} px-3 sm:px-8">
            <div class="max-w-[85%] sm:max-w-[65%] px-3 py-1.5 rounded-xl shadow-sm ${m.fromMe ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100 rounded-tr-none' : 'bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 rounded-tl-none'}">
                ${contenido}${texto}
                <div class="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">${manual}${hora(m.ts)} ${ticks}</div>
            </div>
        </div>`;
}

function pintarMensajes(mantenerScroll) {
    const cont = document.getElementById('ca-mensajes');
    if (!cont) return;
    const alFondo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 80;
    const altoAntes = cont.scrollHeight;
    let html = estado.hayMas ? `<div class="text-center py-2"><button id="ca-mas" class="text-[11px] font-bold px-3 py-1 rounded-full bg-white/80 dark:bg-black/30 text-gray-600 dark:text-gray-300 shadow-sm">Cargar mensajes anteriores</button></div>` : '';
    let dia = '';
    estado.mensajes.forEach(m => {
        const d = new Date(m.ts * 1000).toDateString();
        if (d !== dia) {
            dia = d;
            html += `<div class="flex justify-center my-2"><span class="text-[11px] px-3 py-1 rounded-lg bg-white/90 dark:bg-[#182229] text-gray-600 dark:text-gray-400 shadow-sm">${separadorFecha(m.ts)}</span></div>`;
        }
        html += burbuja(m);
    });
    if (!estado.mensajes.length) html = `<div class="h-full flex items-center justify-center text-xs text-gray-400">Sin mensajes en esta conversación.</div>`;
    cont.innerHTML = `<div class="py-3 space-y-1.5">${html}</div>`;
    document.getElementById('ca-mas')?.addEventListener('click', cargarAnteriores);
    if (mantenerScroll === 'arriba') cont.scrollTop = cont.scrollHeight - altoAntes;
    else if (mantenerScroll !== 'quieto' || alFondo) cont.scrollTop = cont.scrollHeight;
}

async function traerMensajes(chat, pagina) {
    const r = await fetch(`/api/agente-chats/mensajes?jids=${encodeURIComponent(chat.jids.join(','))}&page=${pagina}&${qsInstancia()}`, { headers: authHeaders() });
    return leer(r);
}

async function abrirChat(clave, soloCabecera = false) {
    const chat = estado.chats.find(c => c.clave === clave);
    if (!chat) return;
    if (!soloCabecera) {
        estado.activo = clave;
        estado.mensajes = [];
        estado.pagina = 1;
    }
    pintarLista();
    document.getElementById('ca-panel-lista')?.classList.add('hidden', 'md:flex');
    const panel = document.getElementById('ca-panel-chat');
    panel?.classList.remove('hidden');
    panel?.classList.add('flex');
    const tipo = TIPOS[chat.tipo] || TIPOS.desconocido;
    document.getElementById('ca-cabecera').innerHTML = `
        <button id="ca-volver" class="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"><i class="fa-solid fa-arrow-left text-gray-500"></i></button>
        ${avatar(chat, 'w-10 h-10')}
        <div class="min-w-0 flex-1">
            <div class="font-bold text-sm text-gray-900 dark:text-white truncate">${esc(chat.nombre)}</div>
            <div class="text-[11px] text-gray-500 truncate">${chat.telefono ? '+' + esc(chat.telefono) : chat.tipo === 'grupo' ? 'Grupo de WhatsApp' : 'Número oculto por WhatsApp'}${chat.detalle ? ' · ' + esc(chat.detalle) : ''}${chat.nombreWa && chat.nombreWa !== chat.nombre ? ' · WhatsApp: ' + esc(chat.nombreWa) : ''}</div>
        </div>
        <span class="hidden sm:inline text-[9px] font-black uppercase px-2 py-1 rounded border ${tipo.clase}">${tipo.label}</span>
        ${estado.esAgente && chat.telefono && chat.tipo !== 'grupo' ? `<button id="ca-btn-pausa" title="${chat.pausa ? 'Reanudar al agente' : 'Pausar al agente con este contacto'}"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${chat.pausa ? 'bg-amber-500 text-black border-amber-500' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-amber-500 hover:text-amber-500'}">
            <i class="fa-solid ${chat.pausa ? 'fa-play' : 'fa-pause'}"></i><span class="hidden lg:inline">${chat.pausa ? 'Reanudar agente' : 'Pausar agente'}</span></button>` : ''}
        <button id="ca-btn-archivar" title="${chat.archivada ? 'Sacar del archivo' : 'Archivar (vuelve si escribe de nuevo)'}" class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 ${chat.archivada ? 'text-amber-500' : 'text-gray-500 hover:text-tealAccent'}"><i class="fa-solid ${chat.archivada ? 'fa-box-open' : 'fa-box-archive'}"></i></button>
        <button id="ca-btn-ficha" title="Ficha" class="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${estado.fichaAbierta ? 'bg-tealAccent text-black border-tealAccent' : 'border-gray-200 dark:border-white/10 text-gray-500 hover:text-tealAccent'}"><i class="fa-solid fa-id-card"></i></button>`;
    document.getElementById('ca-btn-pausa')?.addEventListener('click', () => alternarPausa(chat));
    document.getElementById('ca-btn-archivar')?.addEventListener('click', () => archivar(chat));
    document.getElementById('ca-btn-ficha')?.addEventListener('click', () => { estado.fichaAbierta = !estado.fichaAbierta; abrirChat(clave, true); });
    pintarAvisoPausa(chat);
    pintarFicha(chat);
    document.getElementById('ca-volver')?.addEventListener('click', () => {
        estado.activo = null;
        panel?.classList.add('hidden'); panel?.classList.remove('flex');
        form?.classList.add('hidden'); form?.classList.remove('flex');
        document.getElementById('ca-panel-lista')?.classList.remove('hidden');
        pintarLista();
    });
    const form = document.getElementById('ca-form');
    form?.classList.remove('hidden'); form?.classList.add('flex');
    if (soloCabecera) return;
    const cont = document.getElementById('ca-mensajes');
    cont.innerHTML = `<div class="h-full flex items-center justify-center text-xs text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Cargando mensajes…</div>`;
    try {
        const data = await traerMensajes(chat, 1);
        if (estado.activo !== clave) return;
        estado.mensajes = data.mensajes;
        estado.hayMas = data.hayMas;
        pintarMensajes();
    } catch (e) {
        cont.innerHTML = `<div class="h-full flex items-center justify-center text-xs text-red-400">No se pudieron cargar los mensajes: ${esc(e.message)}</div>`;
    }
}

// ── Pausa del agente ─────────────────────────────────────────
function pintarAvisoPausa(chat) {
    const aviso = document.getElementById('ca-aviso-pausa');
    if (!aviso) return;
    if (!chat.pausa) { aviso.classList.add('hidden'); aviso.innerHTML = ''; return; }
    aviso.classList.remove('hidden');
    aviso.innerHTML = `<i class="fa-solid fa-circle-pause mr-1.5"></i>El agente está en pausa con este contacto
        ${chat.pausa.hasta ? 'hasta el ' + esc(horaPausa(chat.pausa.hasta)) : 'hasta que lo reanudes'}${chat.pausa.nombre ? ' · la puso ' + esc(chat.pausa.nombre) : ''}.
        Aquí respondes tú.`;
}

async function alternarPausa(chat) {
    try {
        if (chat.pausa) {
            await leer(await fetch(`/api/agente-chats/pausa?telefono=${encodeURIComponent(chat.telefono)}`, { method: 'DELETE', headers: authHeaders() }));
            chat.pausa = null;
        } else {
            // Map para respetar el orden (un objeto con claves numéricas se ordena solo)
            const opciones = new Map([['2', '2 horas'], ['24', '24 horas'], ['0', 'Hasta que lo reanude']]);
            let horas;
            if (window.Swal) {
                const r = await window.Swal.fire({
                    title: 'Pausar al agente', icon: 'question',
                    text: 'Mientras esté en pausa, el agente no le contesta ni le manda recordatorios a este contacto. Lo atiendes tú desde aquí.',
                    input: 'select', inputOptions: opciones, inputValue: '2',
                    showCancelButton: true, confirmButtonText: 'Pausar', cancelButtonText: 'Cancelar',
                });
                if (!r.isConfirmed) return;
                horas = Number(r.value);
            } else {
                if (!confirm('¿Pausar al agente con este contacto por 2 horas?')) return;
                horas = 2;
            }
            const data = await leer(await fetch('/api/agente-chats/pausa', {
                method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ telefono: chat.telefono, horas }),
            }));
            chat.pausa = data.pausa;
        }
        abrirChat(chat.clave, true);
    } catch (e) {
        if (window.Swal) window.Swal.fire({ icon: 'error', title: 'No se pudo', text: e.message });
        else alert(e.message);
    }
}

// ── Ficha del contacto (datos que el panel ya tiene cargados) ──────────
const csv = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
const nombreUsuario = (db, id) => {
    const u = (db.Usuarios || []).find(x => String(x.id) === String(id));
    return u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() : null;
};
const filaFicha = (etiqueta, valor) => valor ? `<div class="flex justify-between gap-3 py-1"><span class="text-gray-400">${etiqueta}</span><span class="text-right text-gray-800 dark:text-gray-200 font-semibold break-words min-w-0">${esc(valor)}</span></div>` : '';

function tarjetaProyecto(db, p, mostrarCliente) {
    const fase = (db.Admin_Fases || []).find(x => x.id === p.fase_id);
    const pip = (db.Admin_Pipelines || []).find(x => x.id === p.pipeline_id);
    const cli = mostrarCliente ? (db.Clientes_Maestro || []).find(x => x.id === p.cliente_id) : null;
    const resp = csv(p.responsable_id).map(id => nombreUsuario(db, id)).filter(Boolean).join(', ');
    return `<button data-proy="${esc(p.id)}" class="ca-proy w-full text-left p-3 rounded-xl border border-gray-100 dark:border-white/10 hover:border-tealAccent transition-colors">
        <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-black text-gray-900 dark:text-white truncate">${esc(cli ? cli.nombre : pip?.nombre || 'Proyecto')}</span>
            ${p.tiene_problema ? '<i class="fa-solid fa-triangle-exclamation text-red-500 text-xs" title="Tiene un problema"></i>' : ''}
        </div>
        <div class="text-[11px] mt-1"><span class="px-1.5 py-0.5 rounded bg-tealAccent/10 text-tealAccent font-bold">${esc(fase?.nombre || (p.fase_id === 'Completado' || !p.fase_id ? 'Completado' : p.fase_id))}</span></div>
        <div class="text-[11px] text-gray-400 mt-1 truncate">${esc([cli ? pip?.nombre : null, resp && 'En manos de ' + resp].filter(Boolean).join(' · '))}</div>
    </button>`;
}

// ── Gestión de la conversación: asignar, etiquetas, notas, archivar ──────────
async function guardarConversacion(chat, cambios) {
    const data = await leer(await fetch('/api/agente-chats/conversacion', {
        method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ clave: chat.clave, ...cambios }),
    }));
    const c = data.conversacion || {};
    const datos = { asignado: c.asignado_id ? { id: c.asignado_id, nombre: c.asignado_nombre } : null, etiquetas: c.etiquetas || [] };
    if ('archivar' in cambios) { datos.archivada = !!cambios.archivar; if (datos.archivada) datos.pendiente = false; }
    // El refresco periódico reemplaza los objetos de la lista: se actualiza también la copia vigente
    const vigente = estado.chats.find(x => x.clave === chat.clave);
    Object.assign(chat, datos);
    if (vigente && vigente !== chat) Object.assign(vigente, datos);
    return chat;
}

const avisoError = (e) => (window.Swal ? window.Swal.fire({ icon: 'error', title: 'No se pudo', text: e.message }) : alert(e.message));

async function archivar(chat) {
    try {
        await guardarConversacion(chat, { archivar: !chat.archivada });
        pintarLista();
        abrirChat(chat.clave, true);
    } catch (e) { avisoError(e); }
}

function htmlGestion(chat, db) {
    const usuarios = (db.Usuarios || []).filter(u => !u.is_suspended)
        .map(u => ({ id: String(u.id), nombre: `${u.nombre || ''} ${u.apellido || ''}`.trim() }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    const disponibles = ETIQUETAS_SUGERIDAS.filter(t => !(chat.etiquetas || []).includes(t));
    return `
        <div class="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 space-y-4">
            <div>
                <div class="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">Asignado a</div>
                <select id="ca-asignar" class="w-full text-xs rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white px-3 py-2">
                    <option value="">Sin asignar</option>
                    ${usuarios.map(u => `<option value="${esc(u.id)}" ${chat.asignado?.id === u.id ? 'selected' : ''}>${esc(u.nombre)}</option>`).join('')}
                </select>
            </div>
            <div>
                <div class="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">Etiquetas</div>
                <div class="flex flex-wrap gap-1 mb-2">${(chat.etiquetas || []).map(t => chipEtiqueta(t, true)).join('') || '<span class="text-[11px] text-gray-400">Sin etiquetas</span>'}</div>
                <div class="flex flex-wrap gap-1">
                    ${disponibles.map(t => `<button type="button" class="ca-sugerida text-[10px] px-1.5 py-0.5 rounded-md border border-dashed border-gray-300 dark:border-white/15 text-gray-500 hover:text-tealAccent hover:border-tealAccent" data-etiqueta="${esc(t)}">+ ${esc(t)}</button>`).join('')}
                    <button type="button" id="ca-etiqueta-otra" class="text-[10px] px-1.5 py-0.5 rounded-md border border-dashed border-gray-300 dark:border-white/15 text-gray-500 hover:text-tealAccent hover:border-tealAccent">+ Otra…</button>
                </div>
            </div>
            <div>
                <div class="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">Notas internas <span class="normal-case font-semibold">(el contacto no las ve)</span></div>
                <textarea id="ca-nota-texto" rows="2" maxlength="2000" placeholder="Escribe una nota para el equipo" class="w-full text-xs rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white px-3 py-2 resize-none"></textarea>
                <button type="button" id="ca-nota-guardar" class="mt-1.5 w-full py-1.5 rounded-xl bg-gray-900 dark:bg-white/10 text-white text-[11px] font-bold hover:bg-tealAccent hover:text-black">Agregar nota</button>
                <div id="ca-notas" class="mt-3 space-y-2"><div class="text-[11px] text-gray-400">Cargando notas…</div></div>
            </div>
        </div>`;
}

async function cargarNotas(chat) {
    const cont = document.getElementById('ca-notas');
    if (!cont) return;
    try {
        const { notas } = await leer(await fetch(`/api/agente-chats/notas?clave=${encodeURIComponent(chat.clave)}`, { headers: authHeaders() }));
        if (estado.activo !== chat.clave) return;
        chat.notas = notas.length;
        cont.innerHTML = notas.map(n => `
            <div class="group p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                <div class="text-[11px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">${esc(n.texto)}</div>
                <div class="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                    <span>${esc(n.nombre || '')} · ${new Date(n.creado).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <button type="button" class="ca-borrar-nota opacity-0 group-hover:opacity-100 hover:text-red-500" data-id="${n.id}" title="Borrar nota"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`).join('') || '<div class="text-[11px] text-gray-400">Sin notas todavía.</div>';
        cont.querySelectorAll('.ca-borrar-nota').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('¿Borrar esta nota?')) return;
            try {
                await leer(await fetch(`/api/agente-chats/notas/${encodeURIComponent(b.dataset.id)}`, { method: 'DELETE', headers: authHeaders() }));
                cargarNotas(chat);
                pintarLista();
            } catch (e) { avisoError(e); }
        }));
    } catch (e) {
        cont.innerHTML = `<div class="text-[11px] text-red-400">${esc(e.message)}</div>`;
    }
}

function activarGestion(chat, panel) {
    const repintar = () => { pintarLista(); pintarFicha(chat); };
    panel.querySelector('#ca-asignar')?.addEventListener('change', async (e) => {
        try { await guardarConversacion(chat, { asignado_id: e.target.value || null }); repintar(); }
        catch (err) { avisoError(err); e.target.value = chat.asignado?.id || ''; }
    });
    const ponerEtiquetas = async (lista) => {
        try { await guardarConversacion(chat, { etiquetas: lista }); repintar(); } catch (err) { avisoError(err); }
    };
    panel.querySelectorAll('.ca-sugerida').forEach(b => b.addEventListener('click', () => ponerEtiquetas([...(chat.etiquetas || []), b.dataset.etiqueta])));
    panel.querySelectorAll('.ca-quitar-etiqueta').forEach(b => b.addEventListener('click', () => ponerEtiquetas((chat.etiquetas || []).filter(t => t !== b.dataset.etiqueta))));
    panel.querySelector('#ca-etiqueta-otra')?.addEventListener('click', () => {
        const t = (prompt('Nombre de la etiqueta') || '').trim();
        if (t) ponerEtiquetas([...(chat.etiquetas || []), t.slice(0, 30)]);
    });
    panel.querySelector('#ca-nota-guardar')?.addEventListener('click', async () => {
        const caja = panel.querySelector('#ca-nota-texto');
        const texto = caja.value.trim();
        if (!texto) return;
        try {
            await leer(await fetch('/api/agente-chats/notas', {
                method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ clave: chat.clave, texto }),
            }));
            caja.value = '';
            await cargarNotas(chat);
            pintarLista();
        } catch (e) { avisoError(e); }
    });
    if (panel.querySelector('#ca-notas')) cargarNotas(chat);
}

async function crearLead(chat) {
    let nombre = chat.nombreWa || '';
    let nota = '';
    if (window.Swal) {
        const r = await window.Swal.fire({
            title: 'Crear lead en Call Center',
            html: `<input id="ca-lead-nombre" class="swal2-input" placeholder="Nombre del prospecto" value="${esc(nombre)}" maxlength="120">
                   <textarea id="ca-lead-nota" class="swal2-textarea" placeholder="Nota para el operador (opcional)" maxlength="1000"></textarea>`,
            showCancelButton: true, confirmButtonText: 'Crear lead', cancelButtonText: 'Cancelar',
            preConfirm: () => ({ n: document.getElementById('ca-lead-nombre').value.trim(), x: document.getElementById('ca-lead-nota').value.trim() }),
        });
        if (!r.isConfirmed) return;
        ({ n: nombre, x: nota } = r.value);
    } else {
        nombre = prompt('Nombre del prospecto', nombre);
        if (nombre === null) return;
    }
    try {
        const data = await leer(await fetch('/api/agente-chats/crear-lead', {
            method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ telefono: chat.telefono, nombre, nota }),
        }));
        const datos = { tipo: 'lead', nombre: nombre || chat.nombre, detalle: 'Lead · sin operador' };
        Object.assign(chat, datos);
        const vigente = estado.chats.find(x => x.clave === chat.clave);
        if (vigente) Object.assign(vigente, datos);
        pintarLista();
        abrirChat(chat.clave, true);
        if (window.Swal) window.Swal.fire({ icon: 'success', title: data.existia ? 'Ya era lead' : 'Lead creado', text: data.existia ? 'Ya tenía un lead activo; se le agregó la nota.' : 'Quedó en los leads del Call Center para que lo califiquen.', timer: 2500, showConfirmButton: false });
    } catch (e) { avisoError(e); }
}

function pintarFicha(chat) {
    const panel = document.getElementById('ca-ficha');
    if (!panel) return;
    panel.classList.toggle('hidden', !estado.fichaAbierta);
    panel.classList.toggle('flex', estado.fichaAbierta);
    if (!estado.fichaAbierta) return;
    const db = (typeof window.getDB === 'function' && window.getDB()) || {};
    let html = '';
    if (chat.tipo === 'cliente') {
        const c = (db.Clientes_Maestro || []).find(x => String(x.id) === String(chat.refId)) || {};
        const proys = (db.Proyectos_Dinamicos || []).filter(p => String(p.cliente_id) === String(chat.refId))
            .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
        html = `
            <div class="text-sm font-black text-gray-900 dark:text-white">${esc(c.nombre || chat.nombre)}</div>
            <div class="text-[11px] mb-3"><span class="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold">${esc(c.macro_estado || 'Cliente')}</span></div>
            <div class="text-[11px] divide-y divide-gray-100 dark:divide-white/5">
                ${filaFicha('Vendedor', nombreUsuario(db, c.vendedor_asignado_id))}
                ${filaFicha('Teléfono', c.telefono)}${filaFicha('Email', c.email)}
                ${filaFicha('Dirección', c.direccion)}
            </div>
            <button id="ca-ver-cliente" class="w-full mt-3 py-2 rounded-xl bg-tealAccent text-black text-[11px] font-black uppercase tracking-wider">Abrir ficha del cliente</button>
            <div class="text-[10px] font-black uppercase tracking-wider text-gray-400 mt-5 mb-2">Proyectos (${proys.length})</div>
            <div class="space-y-2">${proys.map(p => tarjetaProyecto(db, p, false)).join('') || '<div class="text-[11px] text-gray-400">Sin proyectos todavía.</div>'}</div>`;
    } else if (chat.tipo === 'equipo') {
        const u = (db.Usuarios || []).find(x => String(x.id) === String(chat.refId)) || {};
        const activos = (db.Proyectos_Dinamicos || []).filter(p => csv(p.responsable_id).includes(String(chat.refId)) && p.fase_id && p.fase_id !== 'Completado')
            .sort((a, b) => Number(!!b.tiene_problema) - Number(!!a.tiene_problema));
        html = `
            <div class="text-sm font-black text-gray-900 dark:text-white">${esc(chat.nombre)}</div>
            <div class="text-[11px] mb-3"><span class="px-1.5 py-0.5 rounded bg-tealAccent/10 text-tealAccent font-bold">${esc(chat.detalle || 'Equipo')}</span></div>
            <div class="text-[11px] divide-y divide-gray-100 dark:divide-white/5">
                ${filaFicha('Sede', u.sede)}${filaFicha('Email', u.email)}${filaFicha('Teléfono', u.telefono)}
            </div>
            <div class="text-[10px] font-black uppercase tracking-wider text-gray-400 mt-5 mb-2">Proyectos en sus manos (${activos.length})</div>
            <div class="space-y-2">${activos.slice(0, 15).map(p => tarjetaProyecto(db, p, true)).join('') || '<div class="text-[11px] text-gray-400">No tiene proyectos activos.</div>'}</div>
            ${activos.length > 15 ? `<div class="text-[11px] text-gray-400 mt-2">y ${activos.length - 15} más…</div>` : ''}`;
    } else if (chat.tipo === 'lead') {
        html = `<div class="text-sm font-black text-gray-900 dark:text-white">${esc(chat.nombre)}</div>
            <div class="text-[11px] mt-1"><span class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">${esc(chat.detalle || 'Lead')}</span></div>
            <p class="text-[11px] text-gray-400 mt-2">Está en los leads del Call Center.</p>`;
    } else {
        html = `<div class="text-sm font-black text-gray-900 dark:text-white">${esc(chat.nombre)}</div>
            <p class="text-[11px] text-gray-400 mt-2">${chat.tipo === 'grupo' ? 'Grupo de WhatsApp.' : 'Este número no está registrado en el sistema como cliente, lead ni parte del equipo.'}</p>
            ${chat.tipo !== 'grupo' && chat.telefono ? '<button id="ca-crear-lead" class="w-full mt-3 py-2 rounded-xl bg-amber-500 text-black text-[11px] font-black uppercase tracking-wider"><i class="fa-solid fa-user-plus mr-1"></i>Crear lead en Call Center</button>' : ''}`;
    }
    panel.querySelector('.ca-ficha-cuerpo').innerHTML = html + (chat.tipo === 'grupo' ? '' : htmlGestion(chat, db));
    panel.querySelector('#ca-crear-lead')?.addEventListener('click', () => crearLead(chat));
    activarGestion(chat, panel);
    panel.querySelector('#ca-ver-cliente')?.addEventListener('click', () => window.showClientDetail?.(chat.refId));
    panel.querySelectorAll('.ca-proy').forEach(b => b.addEventListener('click', () => window.openKanbanDrawer?.(b.dataset.proy)));
}

async function cargarAnteriores() {
    const chat = estado.chats.find(c => c.clave === estado.activo);
    if (!chat) return;
    try {
        const data = await traerMensajes(chat, estado.pagina + 1);
        estado.pagina += 1;
        const ids = new Set(estado.mensajes.map(m => m.id));
        estado.mensajes = [...data.mensajes.filter(m => !ids.has(m.id)), ...estado.mensajes].sort((a, b) => a.ts - b.ts);
        estado.hayMas = data.hayMas;
        pintarMensajes('arriba');
    } catch (e) { console.error('[ChatsAgente] cargar anteriores:', e); }
}

async function enviarMensaje() {
    const chat = estado.chats.find(c => c.clave === estado.activo);
    const caja = document.getElementById('ca-texto');
    const boton = document.getElementById('ca-enviar');
    const texto = caja.value.trim();
    if (!chat || !texto || boton.disabled) return;
    // Se prefiere el jid con número real; si WhatsApp solo dio el @lid, se usa ese
    const jid = chat.jids.find(j => j.endsWith('@s.whatsapp.net')) || chat.jids[0];
    // Escribir primero a quien nunca nos ha escrito es lo que más reportes (y baneos) genera
    if (!estado.hayMas && !estado.mensajes.some(m => !m.fromMe)) {
        const aviso = 'Esta persona nunca le ha escrito a este número. Si no espera tu mensaje y lo reporta como spam, WhatsApp puede bloquear el número. ¿Enviar de todas formas?';
        const ok = window.Swal
            ? (await window.Swal.fire({ icon: 'warning', title: 'Primer contacto', text: aviso, showCancelButton: true, confirmButtonText: 'Enviar', cancelButtonText: 'Cancelar' })).isConfirmed
            : confirm(aviso);
        if (!ok) return;
    }
    boton.disabled = true;
    try {
        const r = await fetch('/api/agente-chats/enviar', {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ jid, texto, instancia: estado.instancia }),
        });
        const data = await leer(r);
        caja.value = '';
        caja.style.height = '';
        const m = data.mensaje || { id: 'local-' + Date.now(), fromMe: true, ts: Math.floor(Date.now() / 1000), tipo: 'conversation', texto, estado: 'enviado', origen: 'web' };
        if (estado.activo === chat.clave && !estado.mensajes.some(x => x.id === m.id)) {
            estado.mensajes.push(m);
            pintarMensajes();
        }
        chat.ultimo = m;
        chat.pendiente = false;
        pintarLista();
    } catch (e) {
        if (window.Swal) window.Swal.fire({ icon: 'error', title: 'No se envió', text: e.message });
        else alert('No se envió: ' + e.message);
    } finally {
        boton.disabled = false;
        caja.focus();
    }
}

// ── Adjuntar foto o PDF ─────────────────────────────────────
const TIPOS_ARCHIVO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const leerComoBase64 = (archivo) => new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result));
    lector.onerror = () => mal(new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
});

async function enviarArchivo(archivo) {
    const chat = estado.chats.find(c => c.clave === estado.activo);
    if (!chat || !archivo) return;
    const avisar = (t) => (window.Swal ? window.Swal.fire({ icon: 'error', title: 'No se envió', text: t }) : alert(t));
    if (!TIPOS_ARCHIVO.includes(archivo.type)) return avisar('Solo se pueden enviar fotos (JPG, PNG, WEBP) o PDF.');
    if (archivo.size > 10 * 1024 * 1024) return avisar('El archivo pasa de 10 MB.');
    const dataUrl = await leerComoBase64(archivo);
    const esFoto = archivo.type.startsWith('image/');
    let caption = '';
    if (window.Swal) {
        const r = await window.Swal.fire({
            title: esFoto ? 'Enviar foto' : 'Enviar PDF',
            html: esFoto ? `<img src="${dataUrl}" style="max-height:260px;margin:0 auto;border-radius:12px">` : `<div style="font-size:13px"><i class="fa-solid fa-file-pdf" style="color:#ef4444"></i> ${esc(archivo.name)}</div>`,
            input: 'text', inputPlaceholder: 'Mensaje (opcional)',
            showCancelButton: true, confirmButtonText: 'Enviar', cancelButtonText: 'Cancelar',
        });
        if (!r.isConfirmed) return;
        caption = r.value || '';
    } else if (!confirm(`¿Enviar ${archivo.name}?`)) return;

    const jid = chat.jids.find(j => j.endsWith('@s.whatsapp.net')) || chat.jids[0];
    const boton = document.getElementById('ca-adjuntar');
    boton.disabled = true;
    boton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        const data = await leer(await fetch('/api/agente-chats/enviar-archivo', {
            method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ jid, base64: dataUrl, mimetype: archivo.type, nombre: archivo.name, caption, instancia: estado.instancia }),
        }));
        if (data.mensaje && estado.activo === chat.clave) {
            estado.mensajes.push(data.mensaje);
            pintarMensajes();
        }
        if (data.mensaje) chat.ultimo = data.mensaje;
        chat.pendiente = false;
        pintarLista();
    } catch (e) {
        avisar(e.message);
    } finally {
        boton.disabled = false;
        boton.innerHTML = '<i class="fa-solid fa-paperclip"></i>';
    }
}

// ── Respuestas rápidas ──────────────────────────────────────
// {nombre} se cambia por el primer nombre del contacto (si se conoce)
function primerNombre(chat) {
    const n = chat.tipo === 'desconocido' ? (chat.nombreWa || '') : (chat.nombre || '');
    return /^\+?\d/.test(n) ? '' : n.trim().split(/\s+/)[0] || '';
}

// Sin nombre conocido se quita {nombre}: "Hola {nombre}, …" → "Hola, …" y "{nombre}, ¿me…" → "¿me…"
const rellenarNombre = (texto, nombre) => (nombre
    ? texto.replace(/\{nombre\}/g, nombre)
    : texto.replace(/^\s*\{nombre\}\s*,?\s*/, '').replace(/\s*\{nombre\}/g, '').trim());

async function cargarRespuestas() {
    if (estado.respuestas) return estado.respuestas;
    const data = await leer(await fetch('/api/agente-chats/respuestas', { headers: authHeaders() }));
    estado.respuestas = data.respuestas || [];
    return estado.respuestas;
}

async function pintarRespuestas(filtro = '') {
    const caja = document.getElementById('ca-respuestas');
    if (!caja) return;
    caja.classList.remove('hidden');
    caja.innerHTML = '<div class="p-3 text-[11px] text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i>Cargando…</div>';
    let lista;
    try { lista = await cargarRespuestas(); } catch (e) {
        caja.innerHTML = `<div class="p-3 text-[11px] text-red-400">${esc(e.message)}</div>`;
        return;
    }
    const q = filtro.toLowerCase();
    const visibles = lista.filter(r => !q || r.titulo.toLowerCase().includes(q) || r.texto.toLowerCase().includes(q));
    caja.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-white/5">
            <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Respuestas rápidas</span>
            <button type="button" id="ca-resp-nueva" class="text-[11px] font-bold text-tealAccent hover:underline"><i class="fa-solid fa-plus mr-1"></i>Nueva</button>
        </div>
        <div class="max-h-60 overflow-y-auto">
            ${visibles.map(r => `
                <div class="group flex items-start gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer ca-resp" data-id="${r.id}">
                    <div class="min-w-0 flex-1">
                        <div class="text-xs font-bold text-gray-900 dark:text-white">${esc(r.titulo)}</div>
                        <div class="text-[11px] text-gray-500 truncate">${esc(r.texto)}</div>
                    </div>
                    <button type="button" class="ca-resp-borrar opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs" title="Borrar" data-id="${r.id}"><i class="fa-solid fa-trash"></i></button>
                </div>`).join('') || '<div class="p-3 text-[11px] text-gray-400">No hay respuestas que coincidan.</div>'}
        </div>`;
    caja.querySelectorAll('.ca-resp').forEach(el => el.addEventListener('click', (e) => {
        if (e.target.closest('.ca-resp-borrar')) return;
        const r = lista.find(x => String(x.id) === el.dataset.id);
        const chat = estado.chats.find(c => c.clave === estado.activo);
        const texto = document.getElementById('ca-texto');
        const nombre = chat ? primerNombre(chat) : '';
        texto.value = rellenarNombre(r.texto, nombre);
        texto.dispatchEvent(new Event('input'));
        cerrarRespuestas();
        texto.focus();
    }));
    caja.querySelectorAll('.ca-resp-borrar').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('¿Borrar esta respuesta rápida para todo el equipo?')) return;
        try {
            await leer(await fetch(`/api/agente-chats/respuestas/${encodeURIComponent(b.dataset.id)}`, { method: 'DELETE', headers: authHeaders() }));
            estado.respuestas = estado.respuestas.filter(x => String(x.id) !== b.dataset.id);
            pintarRespuestas(filtro);
        } catch (e) { alert(e.message); }
    }));
    caja.querySelector('#ca-resp-nueva').addEventListener('click', nuevaRespuesta);
}

function cerrarRespuestas() {
    document.getElementById('ca-respuestas')?.classList.add('hidden');
}

async function nuevaRespuesta() {
    let titulo, texto;
    if (window.Swal) {
        const r = await window.Swal.fire({
            title: 'Nueva respuesta rápida',
            html: `<input id="ca-nr-titulo" class="swal2-input" placeholder="Título (ej. Pedir dirección)" maxlength="60">
                   <textarea id="ca-nr-texto" class="swal2-textarea" placeholder="Texto. Usa {nombre} para el nombre del contacto" maxlength="2000"></textarea>`,
            showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const t = document.getElementById('ca-nr-titulo').value.trim();
                const x = document.getElementById('ca-nr-texto').value.trim();
                if (!t || !x) { window.Swal.showValidationMessage('Escribe el título y el texto'); return false; }
                return { t, x };
            },
        });
        if (!r.isConfirmed) return;
        ({ t: titulo, x: texto } = r.value);
    } else {
        titulo = prompt('Título de la respuesta rápida');
        texto = titulo && prompt('Texto (usa {nombre} para el nombre del contacto)');
        if (!titulo || !texto) return;
    }
    try {
        const data = await leer(await fetch('/api/agente-chats/respuestas', {
            method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ titulo, texto }),
        }));
        estado.respuestas = [...(estado.respuestas || []), data.respuesta].sort((a, b) => a.titulo.localeCompare(b.titulo));
        pintarRespuestas();
    } catch (e) { alert(e.message); }
}

// ── Avisos: contador en el menú y notificaciones del navegador ──────────
const AVISOS_MS = 60000;
const CLAVE_ULTIMO_AVISO = 'ca_ultimo_aviso';
let avisosIniciados = false;

function actualizarContadorMenu(n) {
    const enlace = document.querySelector('#admin-nav a[data-view="chats-agente"]');
    if (!enlace) return;
    let badge = enlace.querySelector('.ca-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ca-badge ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center';
        enlace.appendChild(badge);
    }
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.style.display = n > 0 ? '' : 'none';
    badge.title = `${n} conversaciones sin responder`;
}

function irAlChat(clave, instancia) {
    window.focus();
    estado.abrirAlCargar = clave;
    const enlace = document.querySelector('#admin-nav a[data-view="chats-agente"]');
    const otroNumero = instancia && instancia !== estado.instancia;
    if (otroNumero) guardarInstancia(instancia);
    if (!document.getElementById('ca-lista')) enlace?.click();
    else if (otroNumero) cambiarInstancia(instancia);
    else abrirChat(clave);
}

function guardarInstancia(id) {
    estado.instancia = id;
    try { localStorage.setItem(CLAVE_INSTANCIA, id); } catch (e) { /* sin almacenamiento */ }
}

// ── Selector de número ────────────────────────────────────────
function pintarInstancias() {
    const cont = document.getElementById('ca-instancias');
    if (!cont) return;
    if (estado.instancias.length < 2) { cont.classList.add('hidden'); return; }
    cont.classList.remove('hidden');
    cont.innerHTML = estado.instancias.map(i => {
        const activa = i.id === estado.instancia;
        const numero = i.numero ? '+' + i.numero : '';
        return `<button data-instancia="${esc(i.id)}" ${i.conectada ? '' : 'disabled'} title="${esc(numero)}${i.conectada ? '' : ' · desconectado'}"
            class="ca-instancia flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-colors
                   ${activa ? 'border-tealAccent bg-tealAccent/10' : 'border-gray-200 dark:border-white/10 hover:border-tealAccent/50'} ${i.conectada ? '' : 'opacity-50 cursor-not-allowed'}">
            <i class="fa-brands fa-whatsapp ${i.conectada ? 'text-green-500' : 'text-gray-400'}"></i>
            <span class="min-w-0 flex-1">
                <span class="block text-[11px] font-black truncate ${activa ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}">${esc(i.nombre)}${i.esAgente ? ' <span class="text-[9px] font-bold text-tealAccent">· agente</span>' : ''}</span>
                <span class="block text-[10px] text-gray-400 truncate">${i.conectada ? esc(numero) : 'Desconectado'}</span>
            </span>
            ${i.pendientes ? `<span class="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">${i.pendientes > 99 ? '99+' : i.pendientes}</span>` : ''}
        </button>`;
    }).join('');
    cont.querySelectorAll('.ca-instancia').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.instancia !== estado.instancia) cambiarInstancia(b.dataset.instancia);
    }));
}

async function cargarInstancias() {
    try {
        const { instancias } = await leer(await fetch('/api/agente-chats/instancias', { headers: authHeaders() }));
        estado.instancias = instancias || [];
        // Si el número guardado ya no está, se vuelve al del agente
        if (!estado.instancias.some(i => i.id === estado.instancia)) guardarInstancia((estado.instancias.find(i => i.esAgente) || estado.instancias[0] || {}).id || '');
        pintarInstancias();
    } catch (e) { console.warn('[ChatsAgente] instancias:', e.message); }
}

async function cambiarInstancia(id) {
    guardarInstancia(id);
    estado.activo = null;
    estado.mensajes = [];
    pintarInstancias();
    const lista = document.getElementById('ca-lista');
    if (lista) lista.innerHTML = '<div class="p-8 text-center text-xs text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Cargando conversaciones…</div>';
    document.getElementById('ca-cabecera').innerHTML = '<span class="text-xs text-gray-400">Selecciona una conversación</span>';
    document.getElementById('ca-mensajes').innerHTML = '';
    document.getElementById('ca-form')?.classList.add('hidden');
    document.getElementById('ca-aviso-pausa')?.classList.add('hidden');
    document.getElementById('ca-ficha')?.classList.add('hidden');
    try {
        await cargarChats();
        pintarLista();
        if (estado.abrirAlCargar) { abrirChat(estado.abrirAlCargar); estado.abrirAlCargar = null; }
    } catch (e) {
        if (lista) lista.innerHTML = `<div class="p-6 text-center text-xs text-red-400">No se pudieron cargar los chats: ${esc(e.message)}</div>`;
    }
}

async function revisarAvisos() {
    try {
        const r = await fetch('/api/agente-chats/resumen', { headers: authHeaders() });
        if (!r.ok) return;
        const { pendientes, recientes } = await r.json();
        actualizarContadorMenu(pendientes);
        let ultimo = 0;
        try { ultimo = Number(localStorage.getItem(CLAVE_ULTIMO_AVISO)) || 0; } catch (e) { /* sin almacenamiento */ }
        const nuevos = (recientes || []).filter(x => x.ts > ultimo);
        const maxTs = Math.max(ultimo, ...(recientes || []).map(x => x.ts));
        try { localStorage.setItem(CLAVE_ULTIMO_AVISO, String(maxTs)); } catch (e) { /* sin almacenamiento */ }
        // La primera vez solo se toma como referencia, para no avisar de mensajes viejos
        if (!ultimo || !nuevos.length || !('Notification' in window) || Notification.permission !== 'granted') return;
        nuevos.slice(0, 3).forEach(x => {
            const n = new Notification(`WhatsApp: ${x.nombre}`, { body: x.texto || 'Nuevo mensaje', tag: 'ca-' + x.clave, icon: '/assets/images/favicon_pc.png' });
            n.onclick = () => { irAlChat(x.clave, x.instancia); n.close(); };
        });
    } catch (e) { console.warn('[ChatsAgente] avisos:', e.message); }
}

// Se llama al cargar el panel admin; solo corre para Admin/CEO (las rutas son solo para ellos)
export function iniciarAvisosChats() {
    if (avisosIniciados) return;
    let usuario = {};
    try { usuario = JSON.parse(localStorage.getItem('rs_user') || '{}'); } catch (e) { /* sesión ilegible */ }
    const roles = (typeof window.getUserRoles === 'function' ? window.getUserRoles(usuario) : [usuario.rol]).join(' ').toLowerCase();
    if (!/\b(admin|administrador|ceo)\b/.test(roles)) return;
    avisosIniciados = true;
    revisarAvisos();
    setInterval(revisarAvisos, AVISOS_MS);
}

function botonActivarAvisos() {
    if (!('Notification' in window) || Notification.permission !== 'default') return '';
    return `<button id="ca-activar-avisos" class="w-full text-[11px] font-bold py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"><i class="fa-solid fa-bell mr-1"></i>Activar avisos de mensajes nuevos</button>`;
}

async function cargarChats() {
    const data = await leer(await fetch(`/api/agente-chats?${qsInstancia()}`, { headers: authHeaders() }));
    estado.chats = data.chats || [];
    estado.esAgente = data.esAgente !== false;
    if (data.instancia && !estado.instancia) guardarInstancia(data.instancia);
    // Contador del selector al día con la lista que se está viendo
    const actual = estado.instancias.find(i => i.id === data.instancia);
    if (actual) { actual.pendientes = estado.chats.filter(c => c.pendiente).length; pintarInstancias(); }
    const activos = estado.chats.filter(c => !c.archivada);
    const cuenta = (t) => activos.filter(c => c.tipo === t).length;
    const extra = { todos: activos.length, pendientes: activos.filter(c => c.pendiente).length, mios: activos.filter(c => c.asignado?.id === usuarioActualId()).length, archivados: estado.chats.length - activos.length };
    document.querySelectorAll('.ca-filtro').forEach(b => {
        const n = b.dataset.f in extra ? extra[b.dataset.f] : cuenta(b.dataset.f);
        b.querySelector('.ca-n').textContent = n;
    });
    // El menú suma todos los números (si aún no se conocen, cuenta solo el que se ve)
    actualizarContadorMenu(estado.instancias.length ? estado.instancias.reduce((t, i) => t + (i.pendientes || 0), 0) : estado.chats.filter(c => c.pendiente).length);
}

// Refresco periódico: actualiza la lista y trae lo nuevo del chat abierto
async function refrescar() {
    if (!document.getElementById('ca-lista')) { clearInterval(estado.timer); estado.timer = null; return; }
    if (document.hidden) return;
    try {
        cargarInstancias(); // contadores de los otros números (en paralelo)
        await cargarChats();
        pintarLista();
        const chat = estado.chats.find(c => c.clave === estado.activo);
        if (chat) {
            pintarAvisoPausa(chat);
            const data = await traerMensajes(chat, 1);
            const ids = new Set(estado.mensajes.map(m => m.id));
            const nuevos = data.mensajes.filter(m => !ids.has(m.id));
            if (nuevos.length) {
                estado.mensajes = [...estado.mensajes, ...nuevos].sort((a, b) => a.ts - b.ts);
                pintarMensajes('quieto');
            }
        }
    } catch (e) { console.warn('[ChatsAgente] refresco:', e.message); }
}

export async function renderChatsAgente() {
    const canvas = document.getElementById('main-canvas');
    if (!canvas) return;
    estado.activo = null;
    if (estado.timer) clearInterval(estado.timer);

    const filtros = [['todos', 'Todos'], ['pendientes', 'Sin responder'], ['mios', 'Míos'], ['equipo', 'Equipo'], ['cliente', 'Clientes'], ['lead', 'Leads'], ['desconocido', 'Otros'], ['archivados', 'Archivados']];
    canvas.innerHTML = `
        <div class="animate-fadeIn flex h-[calc(100vh-190px)] min-h-[480px] rounded-3xl overflow-hidden border border-gray-100 dark:border-white/5 bg-white dark:bg-darkCard shadow-sm">
            <!-- Lista de conversaciones -->
            <div id="ca-panel-lista" class="flex flex-col w-full md:w-[360px] md:flex-shrink-0 border-r border-gray-100 dark:border-white/5">
                <div class="p-3 space-y-2 border-b border-gray-100 dark:border-white/5">
                    <div id="ca-instancias" class="hidden flex gap-1.5"></div>
                    <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5">
                        <i class="fa-solid fa-magnifying-glass text-xs text-gray-400"></i>
                        <input id="ca-buscar" type="text" placeholder="Buscar nombre, número o mensaje" class="bg-transparent border-none outline-none focus:ring-0 text-sm w-full p-0 text-gray-900 dark:text-white placeholder-gray-400">
                    </div>
                    <div class="flex gap-1 overflow-x-auto hide-scrollbar">
                        ${filtros.map(([f, l]) => `<button data-f="${f}" class="ca-filtro whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${f === estado.filtro ? 'bg-tealAccent text-black' : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-tealAccent'}">${l} <span class="ca-n opacity-70">…</span></button>`).join('')}
                    </div>
                </div>
                ${botonActivarAvisos() ? `<div class="px-3 pt-2">${botonActivarAvisos()}</div>` : ''}
                <div id="ca-lista" class="flex-1 overflow-y-auto">
                    <div class="p-8 text-center text-xs text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Cargando conversaciones…</div>
                </div>
            </div>

            <!-- Conversación -->
            <div id="ca-panel-chat" class="hidden md:flex flex-col flex-1 min-w-0">
                <div id="ca-cabecera" class="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#202c33] min-h-[60px]">
                    <span class="text-xs text-gray-400">Selecciona una conversación</span>
                </div>
                <div id="ca-aviso-pausa" class="hidden px-4 py-2 text-[11px] font-semibold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-amber-500/20"></div>
                <div class="flex-1 flex min-h-0 relative">
                <div id="ca-mensajes" class="flex-1 overflow-y-auto bg-[#efeae2] dark:bg-[#0b141a]">
                    <div class="h-full flex flex-col items-center justify-center text-center gap-3 text-gray-400 px-6">
                        <i class="fa-solid fa-robot text-4xl text-tealAccent/60"></i>
                        <p class="text-sm font-bold text-gray-600 dark:text-gray-300">Conversaciones del Agente Renew</p>
                        <p class="text-xs max-w-sm">Aquí ves lo que se escribe y recibe por el WhatsApp del agente. Las burbujas verdes salen del número de Renew; las marcadas "persona" se escribieron a mano desde el teléfono.</p>
                    </div>
                </div>
                <aside id="ca-ficha" class="hidden flex-col absolute inset-y-0 right-0 w-full sm:w-80 shadow-2xl xl:shadow-none xl:static xl:flex-shrink-0 border-l border-gray-100 dark:border-white/5 bg-white dark:bg-darkCard overflow-y-auto z-10">
                    <div class="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-white/5">
                        <span class="text-[10px] font-black uppercase tracking-wider text-gray-400">Ficha</span>
                        <button id="ca-cerrar-ficha" class="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="ca-ficha-cuerpo p-4"></div>
                </aside>
                </div>
                <form id="ca-form" class="hidden relative items-end gap-2 px-3 py-2 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#202c33]">
                    <div id="ca-respuestas" class="hidden absolute bottom-full left-3 right-3 mb-2 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#233138] shadow-2xl overflow-hidden z-20"></div>
                    <input id="ca-archivo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="hidden">
                    <button id="ca-adjuntar" type="button" title="Enviar foto o PDF" class="w-10 h-10 flex-shrink-0 rounded-full text-gray-500 hover:text-tealAccent hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center disabled:opacity-40"><i class="fa-solid fa-paperclip"></i></button>
                    <button id="ca-btn-respuestas" type="button" title="Respuestas rápidas (o escribe / al inicio)" class="w-10 h-10 flex-shrink-0 rounded-full text-gray-500 hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"><i class="fa-solid fa-bolt"></i></button>
                    <textarea id="ca-texto" rows="1" maxlength="4000" placeholder="Escribe un mensaje"
                        class="flex-1 resize-none max-h-32 px-4 py-2.5 rounded-2xl bg-white dark:bg-[#2a3942] border-none outline-none focus:ring-0 text-sm text-gray-900 dark:text-white placeholder-gray-400"></textarea>
                    <button id="ca-enviar" type="submit" title="Enviar"
                        class="w-10 h-10 flex-shrink-0 rounded-full bg-tealAccent text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-40">
                        <i class="fa-solid fa-paper-plane text-sm"></i>
                    </button>
                </form>
            </div>
        </div>`;

    document.getElementById('ca-cerrar-ficha').addEventListener('click', () => { estado.fichaAbierta = false; if (estado.activo) abrirChat(estado.activo, true); });
    document.getElementById('ca-buscar').addEventListener('input', (e) => { estado.busqueda = e.target.value; pintarLista(); });
    const caja = document.getElementById('ca-texto');
    document.getElementById('ca-form').addEventListener('submit', (e) => { e.preventDefault(); enviarMensaje(); });
    // Enter envía, Shift+Enter hace salto de línea; la caja crece con el texto
    caja.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); } });
    caja.addEventListener('input', () => {
        caja.style.height = 'auto'; caja.style.height = Math.min(caja.scrollHeight, 128) + 'px';
        // "/" al inicio abre las respuestas rápidas filtradas por lo que se escribe después
        if (caja.value.startsWith('/')) pintarRespuestas(caja.value.slice(1));
        else cerrarRespuestas();
    });
    caja.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarRespuestas(); });
    document.getElementById('ca-btn-respuestas').addEventListener('click', () => {
        const panel = document.getElementById('ca-respuestas');
        if (panel.classList.contains('hidden')) pintarRespuestas(); else cerrarRespuestas();
    });
    const inputArchivo = document.getElementById('ca-archivo');
    document.getElementById('ca-adjuntar').addEventListener('click', () => inputArchivo.click());
    inputArchivo.addEventListener('change', () => { const a = inputArchivo.files[0]; inputArchivo.value = ''; enviarArchivo(a); });
    document.getElementById('ca-activar-avisos')?.addEventListener('click', async (e) => {
        const permiso = await Notification.requestPermission();
        e.target.closest('div')?.remove();
        if (permiso === 'granted') new Notification('Avisos activados', { body: 'Te avisaremos cuando alguien escriba al WhatsApp del agente.' });
    });
    document.querySelectorAll('.ca-filtro').forEach(b => b.addEventListener('click', () => {
        estado.filtro = b.dataset.f;
        document.querySelectorAll('.ca-filtro').forEach(x => {
            const on = x.dataset.f === estado.filtro;
            x.classList.toggle('bg-tealAccent', on); x.classList.toggle('text-black', on);
            x.classList.toggle('bg-gray-100', !on); x.classList.toggle('dark:bg-white/5', !on); x.classList.toggle('text-gray-500', !on);
        });
        pintarLista();
    }));

    try {
        await cargarInstancias();
        await cargarChats();
        pintarLista();
        if (estado.abrirAlCargar) { abrirChat(estado.abrirAlCargar); estado.abrirAlCargar = null; }
    } catch (e) {
        document.getElementById('ca-lista').innerHTML = `<div class="p-6 text-center text-xs text-red-400">No se pudieron cargar los chats: ${esc(e.message)}</div>`;
    }
    estado.timer = setInterval(refrescar, REFRESCO_MS);
}
