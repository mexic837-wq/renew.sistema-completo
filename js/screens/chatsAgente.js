/* ============================================================
   RENEW OS – screens/chatsAgente.js
   Bandeja tipo WhatsApp con las conversaciones del agente de IA
   (número de Evolution API). Solo lectura.
   ============================================================ */

const REFRESCO_MS = 15000;

const estado = {
    chats: [],
    filtro: 'todos',
    busqueda: '',
    activo: null,      // clave del chat abierto
    mensajes: [],
    pagina: 1,
    hayMas: false,
    timer: null,
};

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
};

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
        if (estado.filtro !== 'todos' && c.tipo !== estado.filtro) return false;
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
                    <span class="font-bold text-sm text-gray-900 dark:text-white truncate">${esc(c.nombre)}</span>
                    <span class="text-[10px] text-gray-400 flex-shrink-0">${fechaCorta(c.ultimo?.ts)}</span>
                </div>
                <div class="flex items-center justify-between gap-2 mt-0.5">
                    <span class="text-xs text-gray-500 dark:text-gray-400 truncate">${vistaPrevia(c.ultimo)}</span>
                    <span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border flex-shrink-0 ${(TIPOS[c.tipo] || TIPOS.desconocido).clase}">${(TIPOS[c.tipo] || TIPOS.desconocido).label}</span>
                </div>
            </div>
        </button>`).join('');
    cont.querySelectorAll('.ca-chat').forEach(b => b.addEventListener('click', () => abrirChat(b.dataset.clave)));
}

function burbuja(m) {
    const ticks = m.fromMe
        ? `<i class="fa-solid ${m.estado === 'enviado' ? 'fa-check' : 'fa-check-double'} text-[10px] ${m.estado === 'leido' ? 'text-sky-500' : 'text-gray-400'}"></i>` : '';
    let contenido = '';
    if (m.tipo === 'imageMessage' || m.tipo === 'stickerMessage') {
        contenido = `<img src="/api/agente-chats/media/${encodeURIComponent(m.id)}" loading="lazy" class="rounded-lg max-w-[240px] max-h-[320px] object-cover cursor-pointer mb-1 bg-black/5"
                       onclick="window.open(this.src,'_blank')" onerror="this.outerHTML='<span class=&quot;text-xs text-gray-400&quot;>📷 Foto no disponible</span>'">`;
    } else if (m.archivo) {
        contenido = `<a href="/api/agente-chats/media/${encodeURIComponent(m.id)}" target="_blank" class="flex items-center gap-2 p-2 mb-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10">
                        <i class="fa-solid fa-file-pdf text-red-500 text-lg"></i><span class="text-xs font-semibold truncate max-w-[200px]">${esc(m.archivo)}</span></a>`;
    } else if (m.tipo === 'audioMessage') {
        contenido = `<audio controls preload="none" src="/api/agente-chats/media/${encodeURIComponent(m.id)}" class="max-w-[240px] mb-1"></audio>`;
    } else if (!m.texto) {
        contenido = `<span class="text-xs italic text-gray-400">Mensaje no compatible (${esc(m.tipo || 'desconocido')})</span>`;
    }
    const texto = m.texto && !(m.archivo && m.texto === m.archivo) ? `<div class="text-[13px] leading-snug break-words">${formatoWa(m.texto)}</div>` : '';
    // El agente envía por la API (origen "web"); lo escrito a mano desde el teléfono llega como android/ios/desktop
    const manual = m.fromMe && ['android', 'ios', 'desktop'].includes(m.origen)
        ? `<span class="mr-auto italic"><i class="fa-solid fa-${m.origen === 'desktop' ? 'desktop' : 'mobile-screen'} mr-0.5"></i>persona</span>` : '';
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
    const r = await fetch(`/api/agente-chats/mensajes?jids=${encodeURIComponent(chat.jids.join(','))}&page=${pagina}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error');
    return data;
}

async function abrirChat(clave) {
    const chat = estado.chats.find(c => c.clave === clave);
    if (!chat) return;
    estado.activo = clave;
    estado.mensajes = [];
    estado.pagina = 1;
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
            <div class="text-[11px] text-gray-500 truncate">${chat.telefono ? '+' + esc(chat.telefono) : 'Número oculto por WhatsApp'}${chat.detalle ? ' · ' + esc(chat.detalle) : ''}${chat.nombreWa && chat.nombreWa !== chat.nombre ? ' · WhatsApp: ' + esc(chat.nombreWa) : ''}</div>
        </div>
        <span class="text-[9px] font-black uppercase px-2 py-1 rounded border ${tipo.clase}">${tipo.label}</span>`;
    document.getElementById('ca-volver')?.addEventListener('click', () => {
        estado.activo = null;
        panel?.classList.add('hidden'); panel?.classList.remove('flex');
        form?.classList.add('hidden'); form?.classList.remove('flex');
        document.getElementById('ca-panel-lista')?.classList.remove('hidden');
        pintarLista();
    });
    const form = document.getElementById('ca-form');
    form?.classList.remove('hidden'); form?.classList.add('flex');
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
    let usuario = {};
    try { usuario = JSON.parse(localStorage.getItem('rs_user') || '{}'); } catch (e) { /* sesión ilegible */ }
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jid, texto, usuario_id: usuario.id }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'No se pudo enviar');
        caja.value = '';
        caja.style.height = '';
        const m = data.mensaje || { id: 'local-' + Date.now(), fromMe: true, ts: Math.floor(Date.now() / 1000), tipo: 'conversation', texto, estado: 'enviado', origen: 'web' };
        if (estado.activo === chat.clave && !estado.mensajes.some(x => x.id === m.id)) {
            estado.mensajes.push(m);
            pintarMensajes();
        }
        chat.ultimo = m;
        pintarLista();
    } catch (e) {
        if (window.Swal) window.Swal.fire({ icon: 'error', title: 'No se envió', text: e.message });
        else alert('No se envió: ' + e.message);
    } finally {
        boton.disabled = false;
        caja.focus();
    }
}

async function cargarChats() {
    const r = await fetch('/api/agente-chats');
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error');
    estado.chats = data.chats || [];
    const cuenta = (t) => estado.chats.filter(c => c.tipo === t).length;
    document.querySelectorAll('.ca-filtro').forEach(b => {
        const n = b.dataset.f === 'todos' ? estado.chats.length : cuenta(b.dataset.f);
        b.querySelector('.ca-n').textContent = n;
    });
}

// Refresco periódico: actualiza la lista y trae lo nuevo del chat abierto
async function refrescar() {
    if (!document.getElementById('ca-lista')) { clearInterval(estado.timer); estado.timer = null; return; }
    if (document.hidden) return;
    try {
        await cargarChats();
        pintarLista();
        const chat = estado.chats.find(c => c.clave === estado.activo);
        if (chat) {
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

    const filtros = [['todos', 'Todos'], ['equipo', 'Equipo'], ['cliente', 'Clientes'], ['desconocido', 'Otros']];
    canvas.innerHTML = `
        <div class="animate-fadeIn flex h-[calc(100vh-190px)] min-h-[480px] rounded-3xl overflow-hidden border border-gray-100 dark:border-white/5 bg-white dark:bg-darkCard shadow-sm">
            <!-- Lista de conversaciones -->
            <div id="ca-panel-lista" class="flex flex-col w-full md:w-[360px] md:flex-shrink-0 border-r border-gray-100 dark:border-white/5">
                <div class="p-3 space-y-2 border-b border-gray-100 dark:border-white/5">
                    <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5">
                        <i class="fa-solid fa-magnifying-glass text-xs text-gray-400"></i>
                        <input id="ca-buscar" type="text" placeholder="Buscar nombre, número o mensaje" class="bg-transparent border-none outline-none focus:ring-0 text-sm w-full p-0 text-gray-900 dark:text-white placeholder-gray-400">
                    </div>
                    <div class="flex gap-1 overflow-x-auto hide-scrollbar">
                        ${filtros.map(([f, l]) => `<button data-f="${f}" class="ca-filtro whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${f === estado.filtro ? 'bg-tealAccent text-black' : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-tealAccent'}">${l} <span class="ca-n opacity-70">…</span></button>`).join('')}
                    </div>
                </div>
                <div id="ca-lista" class="flex-1 overflow-y-auto">
                    <div class="p-8 text-center text-xs text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Cargando conversaciones…</div>
                </div>
            </div>

            <!-- Conversación -->
            <div id="ca-panel-chat" class="hidden md:flex flex-col flex-1 min-w-0">
                <div id="ca-cabecera" class="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#202c33] min-h-[60px]">
                    <span class="text-xs text-gray-400">Selecciona una conversación</span>
                </div>
                <div id="ca-mensajes" class="flex-1 overflow-y-auto bg-[#efeae2] dark:bg-[#0b141a]">
                    <div class="h-full flex flex-col items-center justify-center text-center gap-3 text-gray-400 px-6">
                        <i class="fa-solid fa-robot text-4xl text-tealAccent/60"></i>
                        <p class="text-sm font-bold text-gray-600 dark:text-gray-300">Conversaciones del Agente Renew</p>
                        <p class="text-xs max-w-sm">Aquí ves lo que se escribe y recibe por el WhatsApp del agente. Las burbujas verdes salen del número de Renew; las marcadas "persona" se escribieron a mano desde el teléfono.</p>
                    </div>
                </div>
                <form id="ca-form" class="hidden items-end gap-2 px-3 py-2 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#202c33]">
                    <textarea id="ca-texto" rows="1" maxlength="4000" placeholder="Escribe un mensaje"
                        class="flex-1 resize-none max-h-32 px-4 py-2.5 rounded-2xl bg-white dark:bg-[#2a3942] border-none outline-none focus:ring-0 text-sm text-gray-900 dark:text-white placeholder-gray-400"></textarea>
                    <button id="ca-enviar" type="submit" title="Enviar"
                        class="w-10 h-10 flex-shrink-0 rounded-full bg-tealAccent text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-40">
                        <i class="fa-solid fa-paper-plane text-sm"></i>
                    </button>
                </form>
            </div>
        </div>`;

    document.getElementById('ca-buscar').addEventListener('input', (e) => { estado.busqueda = e.target.value; pintarLista(); });
    const caja = document.getElementById('ca-texto');
    document.getElementById('ca-form').addEventListener('submit', (e) => { e.preventDefault(); enviarMensaje(); });
    // Enter envía, Shift+Enter hace salto de línea; la caja crece con el texto
    caja.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); } });
    caja.addEventListener('input', () => { caja.style.height = 'auto'; caja.style.height = Math.min(caja.scrollHeight, 128) + 'px'; });
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
        await cargarChats();
        pintarLista();
    } catch (e) {
        document.getElementById('ca-lista').innerHTML = `<div class="p-6 text-center text-xs text-red-400">No se pudo conectar con WhatsApp: ${esc(e.message)}</div>`;
    }
    estado.timer = setInterval(refrescar, REFRESCO_MS);
}
