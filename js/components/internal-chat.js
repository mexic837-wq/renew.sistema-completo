import { 
    getInternalMessages, sendInternalMessage, getAdminWorkers, 
    uploadFile, getCurrentUser, markMessageAsRead, updateChatBadges,
    updateInternalMessage, deleteInternalMessage 
} from '../api.js';
import { showToast } from './toast.js';

let chatModal = null;
let mentionList = [];
let selectedMentions = [];
let editingMessageId = null;

export async function initChat() {
    if (chatModal) return;
    
    // Create Modal HTML
    const html = `
    <div id="modal-internal-chat" class="fixed inset-0 bg-black/60 backdrop-blur-sm hidden flex items-center justify-center z-[1000] p-4 sm:p-6">
        <div class="bg-white dark:bg-[#0f172a] border border-gray-100 dark:border-white/5 w-full max-w-2xl h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-scaleIn relative">
            <!-- Header -->
            <div class="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#0f172a]">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-tealAccent/10 rounded-2xl flex items-center justify-center text-tealAccent">
                        <i class="fa-solid fa-comment-dots text-xl"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Mensajes Internos</h3>
                        <p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold tracking-widest uppercase mt-1">Colaboración en Tiempo Real</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button id="chat-refresh-btn" class="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 hover:text-tealAccent transition-all" title="Refrescar">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                    <button id="chat-close-btn" class="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>

            <!-- Messages Area -->
            <div id="chat-messages-container" class="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50 dark:bg-black/20 hide-scrollbar">
                <!-- Messages will be rendered here -->
            </div>

            <!-- Mentions Autocomplete -->
            <div id="chat-mentions-box" class="hidden absolute bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-64 bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl max-h-48 overflow-y-auto z-[1010] p-2">
                <!-- Mention items -->
            </div>

            <!-- Input Area -->
            <div class="p-6 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#0f172a]">
                <div class="flex flex-col gap-3">
                    <!-- Preview Image -->
                    <div id="chat-image-preview" class="hidden relative w-20 h-20 rounded-xl overflow-hidden border-2 border-tealAccent">
                        <img src="" class="w-full h-full object-cover">
                        <button id="chat-remove-image" class="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">
                            <i class="fa-solid fa-x"></i>
                        </button>
                    </div>

                    <div class="flex items-end gap-3">
                        <div class="relative flex-1">
                            <textarea id="chat-input" placeholder="Escribe un mensaje... Usa @ para mencionar" rows="1" class="w-full bg-gray-100 dark:bg-white/10 border-none rounded-2xl p-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-tealAccent/50 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 resize-none max-h-32"></textarea>
                            
                            <label for="chat-file-input" class="absolute right-3 bottom-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-tealAccent cursor-pointer transition-colors">
                                <i class="fa-solid fa-paperclip"></i>
                            </label>
                            <input type="file" id="chat-file-input" class="hidden" accept="image/*">
                        </div>
                        
                        <button id="chat-send-btn" class="w-12 h-12 bg-tealAccent text-black rounded-2xl flex items-center justify-center shadow-lg shadow-tealAccent/20 hover:scale-105 active:scale-95 transition-all">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    chatModal = document.getElementById('modal-internal-chat');
    
    // Event Listeners
    document.getElementById('chat-close-btn').addEventListener('click', closeChat);
    document.getElementById('chat-refresh-btn').addEventListener('click', () => {
        const icon = document.querySelector('#chat-refresh-btn i');
        icon.classList.add('fa-spin');
        renderMessages().finally(() => setTimeout(() => icon.classList.remove('fa-spin'), 1000));
    });
    document.getElementById('chat-send-btn').addEventListener('click', handleSendMessage);
    document.getElementById('chat-remove-image').addEventListener('click', () => {
        const preview = document.getElementById('chat-image-preview');
        preview.classList.add('hidden');
        preview.querySelector('img').src = '';
        document.getElementById('chat-file-input').value = '';
    });

    document.getElementById('chat-file-input').addEventListener('change', handleFileSelect);
    
    const input = document.getElementById('chat-input');
    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
        if (e.key === 'Escape' && editingMessageId) {
            cancelEdit();
        }
    });

    // Global actions
    window.editInternalMessage = startEdit;
    window.deleteInternalMessage = handleDeleteMessage;

    // Load users for mentions
    mentionList = await getAdminWorkers();

    // Listener para sincronización de fondo
    window.addEventListener('db_synced', () => {
        if (chatModal && !chatModal.classList.contains('hidden')) {
            renderMessages();
        }
    });
}

export async function openChat() {
    if (!chatModal) await initChat();
    chatModal.classList.remove('hidden');
    chatModal.classList.add('flex');
    renderMessages();
    
    // Auto-refresh every 10 seconds while open
    // window._chatRefreshInterval = setInterval(renderMessages, 10000);
}

export function closeChat() {
    if (chatModal) {
        chatModal.classList.add('hidden');
        chatModal.classList.remove('flex');
        if (window._chatRefreshInterval) clearInterval(window._chatRefreshInterval);
    }
}

async function renderMessages() {
    const container = document.getElementById('chat-messages-container');
    
    // Show loading state while fetching
    if (!container.querySelector('.chat-msg-item')) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400">
                <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-3 opacity-40"></i>
                <p class="text-xs font-bold uppercase tracking-widest opacity-40">Cargando...</p>
            </div>
        `;
    }
    
    let messages = await getInternalMessages();
    const currentUser = getCurrentUser();
    
    // Filter messages: if it has mentions, only show to sender and mentioned users
    messages = messages.filter(msg => {
        if (msg.mentions && msg.mentions.length > 0) {
            return msg.sender_id === currentUser?.id || msg.mentions.includes(currentUser?.id);
        }
        return true;
    });
    
    console.log('[CHAT] Rendering messages:', messages.length, messages);
    
    if (!messages.length) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400">
                <i class="fa-solid fa-message text-4xl mb-4 opacity-20"></i>
                <p class="text-sm font-bold uppercase tracking-widest opacity-50">No hay mensajes aún</p>
            </div>
        `;
        return;
    }

    const origin = window.location.origin;
    
    // Normalize image URL for the current environment (handles old server URLs)
    const normalizeImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('/api/storage-proxy/') || url.startsWith('/uploads/') || url.startsWith('blob:') || url.startsWith('data:')) return url;
        // Convert Supabase internal URLs to the storage proxy
        return url
            .replace(/https?:\/\/(31\.97\.\d+\.\d+:\d+|gateway\.renewgroup\.site|supabase\.renewgroup\.site)\/storage\/v1\/object\/public\//g, '/api/storage-proxy/')
            .replace(/https?:\/\/(api-renew|files-renew)\.0f2zfh\.easypanel\.host(\/storage\/v1)?(\/object\/public)?\//g, '/api/storage-proxy/');
    };

    const html = messages.map(msg => {
        const isMe = msg.sender_id === currentUser?.id;
        const date = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const readBy = Array.isArray(msg.read_by) ? msg.read_by : [];
        const imageUrl = normalizeImageUrl(msg.image_url);
        
        // Mark as read if I'm mentioned and haven't read it
        if (msg.mentions && msg.mentions.includes(currentUser?.id) && !readBy.includes(currentUser?.id)) {
            markMessageAsRead(msg.id);
        }

        return `
            <div class="flex ${isMe ? 'justify-end' : 'justify-start'} animate-fadeIn chat-msg-item">
                <div class="max-w-[80%] ${isMe ? 'bg-tealAccent text-black' : 'bg-white dark:bg-white/5 text-gray-800 dark:text-white'} rounded-[1.5rem] p-4 shadow-sm relative group">
                    ${isMe ? `
                        <div class="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-1">
                            <button onclick="window.editInternalMessage('${msg.id}')" class="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-[10px] transition-colors" title="Editar">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="window.deleteInternalMessage('${msg.id}')" class="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-red-500 hover:text-white flex items-center justify-center text-[10px] transition-colors" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    ` : ''}

                    ${!isMe ? `<p class="text-[10px] font-black uppercase tracking-widest text-tealAccent mb-1">${msg.sender_name || ''}</p>` : ''}
                    
                    ${imageUrl ? `<img src="${imageUrl}" class="w-full max-h-60 object-cover rounded-xl mb-2 cursor-pointer" onclick="window.open('${imageUrl}')" onerror="this.style.display='none'">` : ''}
                    
                    <p class="text-sm font-medium leading-relaxed">${formatContent(msg.content || '')}</p>
                    
                    <div class="flex items-center justify-end gap-2 mt-1">
                        ${msg.updated_at ? `<span class="text-[8px] opacity-40 font-bold italic mr-auto">editado</span>` : ''}
                        <span class="text-[9px] opacity-50 font-bold">${date}</span>
                        ${isMe ? `<i class="fa-solid fa-check-double text-[9px] ${readBy.length > 1 ? 'text-blue-600' : 'opacity-30'}"></i>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    container.innerHTML = html;
    if (isAtBottom) container.scrollTop = container.scrollHeight;

    // Refresh badges after rendering messages (in case we marked some as read)
    updateChatBadges();
}

function formatContent(content) {
    // Highlight mentions
    return content.replace(/@(\w+ \w+|\w+)/g, (match) => {
        return `<span class="text-blue-600 dark:text-tealAccent font-black">${match}</span>`;
    });
}

function handleInput(e) {
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    const lastAt = text.lastIndexOf('@', cursor - 1);
    
    if (lastAt !== -1 && !text.substring(lastAt, cursor).includes(' ')) {
        const query = text.substring(lastAt + 1, cursor).toLowerCase();
        showMentions(query, lastAt);
    } else {
        hideMentions();
    }
}

function showMentions(query, atIndex) {
    const box = document.getElementById('chat-mentions-box');
    const filtered = mentionList.filter(u => 
        (u.nombre + ' ' + (u.apellido || '')).toLowerCase().includes(query)
    );

    if (!filtered.length) {
        hideMentions();
        return;
    }

    box.innerHTML = filtered.map(u => `
        <div class="mention-item flex items-center gap-3 p-3 hover:bg-tealAccent/10 rounded-xl cursor-pointer transition-all" data-id="${u.id}" data-name="${u.nombre} ${u.apellido || ''}">
            <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-[10px] font-black">
                ${u.nombre[0]}${u.apellido ? u.apellido[0] : ''}
            </div>
            <div>
                <p class="text-xs font-black dark:text-white">${u.nombre} ${u.apellido || ''}</p>
                <p class="text-[9px] text-gray-400 uppercase font-bold">${u.rol || 'Miembro'}</p>
            </div>
        </div>
    `).join('');

    box.classList.remove('hidden');
    
    // Add click events to items
    box.querySelectorAll('.mention-item').forEach(item => {
        item.onclick = () => {
            const id = item.dataset.id;
            const name = item.dataset.name;
            insertMention(name, id, atIndex);
        };
    });
}

function hideMentions() {
    const box = document.getElementById('chat-mentions-box');
    if (box) box.classList.add('hidden');
}

function insertMention(name, id, atIndex) {
    const input = document.getElementById('chat-input');
    const text = input.value;
    const cursor = input.selectionStart;
    
    const before = text.substring(0, atIndex);
    const after = text.substring(cursor);
    
    input.value = before + '@' + name + ' ' + after;
    if (!selectedMentions.includes(id)) selectedMentions.push(id);
    
    hideMentions();
    input.focus();
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const preview = document.getElementById('chat-image-preview');
    const reader = new FileReader();
    reader.onload = (ev) => {
        preview.querySelector('img').src = ev.target.result;
        preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

async function handleSendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    const fileInput = document.getElementById('chat-file-input');
    const file = fileInput.files[0];

    if (!content && !file) return;

    if (editingMessageId) {
        try {
            await updateInternalMessage(editingMessageId, content);
            cancelEdit();
            renderMessages();
        } catch (error) {
            console.error('Error updating message:', error);
            showToast('Error al actualizar mensaje', 'error');
        }
        return;
    }

    try {
        let image_url = null;
        if (file) {
            showToast('Subiendo imagen...', 'info');
            image_url = await uploadFile(file, 'mensajes_internos');
        }

        await sendInternalMessage({
            content,
            mentions: selectedMentions,
            image_url
        });

        // Clear
        input.value = '';
        fileInput.value = '';
        document.getElementById('chat-image-preview').classList.add('hidden');
        selectedMentions = [];
        
        renderMessages();
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Error al enviar mensaje', 'error');
    }
}

function startEdit(id) {
    const messages = JSON.parse(JSON.stringify(getInternalMessagesSync())); // Helper to get messages from cache
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    editingMessageId = id;
    const input = document.getElementById('chat-input');
    input.value = msg.content;
    input.focus();
    input.classList.add('ring-2', 'ring-orange-500');
    
    // Cambiar icono de enviar a guardar
    const sendBtn = document.getElementById('chat-send-btn');
    sendBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    sendBtn.classList.remove('bg-tealAccent');
    sendBtn.classList.add('bg-orange-500');

    showToast('Editando mensaje...', 'info');
}

function cancelEdit() {
    editingMessageId = null;
    const input = document.getElementById('chat-input');
    input.value = '';
    input.classList.remove('ring-2', 'ring-orange-500');

    const sendBtn = document.getElementById('chat-send-btn');
    sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    sendBtn.classList.add('bg-tealAccent');
    sendBtn.classList.remove('bg-orange-500');
}

async function handleDeleteMessage(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este mensaje?')) return;

    try {
        await deleteInternalMessage(id);
        showToast('Mensaje eliminado', 'success');
        renderMessages();
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Error al eliminar mensaje', 'error');
    }
}

// Helper para obtener mensajes sincronizados sin await
function getInternalMessagesSync() {
    const raw = localStorage.getItem('rs_admin_db');
    if (!raw) return [];
    const db = JSON.parse(raw);
    return db.mensajes_internos || [];
}
