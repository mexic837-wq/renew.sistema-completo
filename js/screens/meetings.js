/* ============================================================
   RENEW SOLAR – screens/meetings.js
   ============================================================ */
import { getDB, saveGranular, getCurrentUser } from '../api.js';
import { showToast } from '../components/toast.js';
// Removed import from ../app.js to break circular dependency

export function renderMeetings() {
  const screen = document.getElementById('screen-meetings');
  if (!screen) return;

  const db = getDB();
  const user = getCurrentUser();
  const reads = db.admin_meetings_reads || [];

  const rawMeetings = [...(db.admin_meetings || [])].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Filter by audience
  const meetings = rawMeetings.filter(mt => {
      if (!mt.audiencia_tags || mt.audiencia_tags.length === 0 || mt.audiencia_tags.includes('todos')) return true;
      const userRole = (user.rol || '').toLowerCase();
      const userPipes = (user.unidades || []).map(p => p.toLowerCase());
      
      return mt.audiencia_tags.some(tag => {
          const t = tag.toLowerCase();
          return userRole === t || userPipes.includes(t);
      });
  });

  const meetingsHtml = meetings.map(mt => {
    const isRead = reads.some(r => String(r.meeting_id) === String(mt.id) && String(r.user_id) === String(user.id));
    
    return `
      <div class="meeting-card ${isRead ? 'read' : 'unread'}" data-id="${mt.id}">
        ${!isRead ? `<div class="unread-dot"></div>` : ''}
        
        <div class="meeting-card-inner">
          ${mt.imagen_url ? `
            <div class="meeting-image-wrapper">
              <img src="${mt.imagen_url}" alt="Meeting">
            </div>
          ` : ''}
          
          <div class="meeting-content">
            <div class="meeting-header-info">
              <div class="meeting-icon">
                <i class="fa-solid fa-video"></i>
              </div>
              <div class="meeting-titles">
                <h3>${mt.titulo || 'Reunión Equipo'}</h3>
                <p>${new Date(mt.created_at).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>

            <p class="meeting-text">${mt.texto}</p>
            
            <div class="meeting-actions">
              ${mt.enlace ? `
                <a href="${mt.enlace}" target="_blank" class="btn-join">
                  <i class="fa-solid fa-link"></i> UNIRSE
                </a>
              ` : ''}
              <button class="btn-confirm-mt" data-id="${mt.id}" style="background:${isRead ? 'rgba(0,245,212,0.1)' : 'var(--surface)'}; color:${isRead ? 'var(--tealAccent)' : 'var(--text-muted)'}; border:1px solid ${isRead ? 'var(--tealAccent)' : 'var(--border)'};">
                <i class="fa-solid ${isRead ? 'fa-check-double' : 'fa-check'}"></i> ${isRead ? 'CONFIRMADO' : 'ASISTIR'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  screen.innerHTML = `
    <div class="dash-header" style="background:var(--bg); border-bottom:1px solid var(--border);">
      <div class="dash-header-top" style="display:flex; align-items:center; justify-content:center; position:relative; padding: 25px 20px;">
        <button id="btn-meetings-back" style="position:absolute; left:15px; background:none; border:none; color:var(--text); width:40px; height:40px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:0.2s;">
          <i class="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div class="dash-greeting" style="text-align:center;">
          <h1 style="margin:0; font-size:1.5rem; font-weight:900; color:var(--text-primary);">Meetings 📹</h1>
          <p style="color:var(--text-muted); font-size:0.75rem; font-weight:600; margin-top:2px; text-transform:uppercase; letter-spacing:0.5px;">Reuniones y Coordinación</p>
        </div>
      </div>
    </div>
    
    <div class="meetings-grid-container">
        ${meetingsHtml || `
            <div class="empty-meetings">
                <i class="fa-solid fa-video-slash"></i>
                <p>No hay reuniones programadas</p>
            </div>
        `}
    </div>

    <style>
      .meetings-grid-container {
        max-width: 1000px;
        margin: 0 auto;
        padding: 40px 24px 120px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .meeting-card {
        background: var(--surface-alt);
        border: 1px solid var(--border);
        border-radius: 28px;
        position: relative;
        overflow: hidden;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      }
      .meeting-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 15px 40px rgba(0,0,0,0.25);
      }
      .unread-dot {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 12px;
        height: 12px;
        background: var(--tealAccent);
        border-radius: 50%;
        box-shadow: 0 0 20px var(--tealAccent);
        z-index: 10;
      }
      .meeting-card-inner {
        display: flex;
        flex-direction: column;
      }
      .meeting-image-wrapper {
        width: 100%;
        aspect-ratio: 16/9;
        overflow: hidden;
        background: var(--surface);
      }
      .meeting-image-wrapper img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .meeting-content {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        flex: 1;
      }
      .meeting-header-info {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .meeting-icon {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        background: rgba(96,165,250,0.1);
        display: flex;
        align-items: center;
        justify-content:center;
        color: #60a5fa;
        font-size: 1.2rem;
        flex-shrink: 0;
      }
      .meeting-titles h3 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 900;
        color: var(--text-primary);
        letter-spacing: -0.5px;
      }
      .meeting-titles p {
        margin: 4px 0 0;
        font-size: 0.8rem;
        color: var(--text-muted);
        font-weight: 600;
        text-transform: capitalize;
      }
      .meeting-text {
        font-size: 0.95rem;
        color: var(--text-secondary);
        line-height: 1.6;
        margin: 0;
        font-weight: 500;
      }
      .meeting-actions {
        display: flex;
        gap: 12px;
        margin-top: auto;
      }
      .btn-join {
        flex: 1.5;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font-size: 0.9rem;
        padding: 14px;
        border-radius: 14px;
        text-decoration: none;
        font-weight: 900;
        color: #0f172a;
        background: var(--primary);
        transition: 0.2s;
        box-shadow: 0 4px 15px rgba(0, 245, 212, 0.2);
      }
      .btn-join:hover {
        transform: scale(1.02);
        box-shadow: 0 6px 20px rgba(0, 245, 212, 0.3);
      }
      .btn-confirm-mt {
        flex: 1;
        font-size: 0.85rem;
        padding: 14px;
        border-radius: 14px;
        font-weight: 800;
        cursor: pointer;
        transition: 0.2s;
      }
      .empty-meetings {
        text-align: center;
        padding: 120px 20px;
        color: var(--text-muted);
      }
      .empty-meetings i {
        font-size: 5rem;
        margin-bottom: 24px;
        opacity: 0.1;
      }
      .empty-meetings p {
        font-weight: 700;
        font-size: 1.4rem;
      }

      @media (min-width: 800px) {
        .meeting-card-inner {
          flex-direction: row;
          min-height: 280px;
        }
        .meeting-image-wrapper {
          width: 40%;
          aspect-ratio: auto;
          border-right: 1px solid var(--border);
        }
        .meeting-content {
          padding: 32px;
        }
      }

      @media (max-width: 600px) {
        .meetings-grid-container {
          padding: 16px 16px 100px !important;
        }
        .meeting-content {
          padding: 20px !important;
        }
      }
    </style>
  `;

  document.getElementById('btn-meetings-back').onclick = () => window.appNavigate('dashboard');
  document.getElementById('btn-meetings-back').onmouseover = (e) => { e.currentTarget.style.transform = 'translateX(-5px)'; };
  document.getElementById('btn-meetings-back').onmouseout = (e) => { e.currentTarget.style.transform = 'translateX(0)'; };


  screen.querySelectorAll('.btn-confirm-mt').forEach(btn => {
    btn.onclick = async () => {
        const mtId = btn.dataset.id;
        const isAlreadyRead = reads.some(r => String(r.meeting_id) === String(mtId) && String(r.user_id) === String(user.id));
        if (isAlreadyRead) return;

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        
        try {
            // Use a deterministic ID (meeting_id + user_id) to avoid duplicates in Supabase
            const readId = `rd_${String(mtId)}_${String(user.id)}`;
            const readRecord = { id: readId, meeting_id: String(mtId), user_id: String(user.id), read_at: new Date().toISOString() };
            await saveGranular('admin_meetings_reads', [readRecord]);
            showToast('Asistencia confirmada', 'success');
            // Optimistic update
            const dbLoc = getDB();
            if(!dbLoc.admin_meetings_reads) dbLoc.admin_meetings_reads = [];
            const alreadyIn = dbLoc.admin_meetings_reads.findIndex(r => String(r.meeting_id) === String(mtId) && String(r.user_id) === String(user.id));
            if (alreadyIn === -1) {
                dbLoc.admin_meetings_reads.push(readRecord);
            }
            renderMeetings();
        } catch (err) {
            console.error(err);
            showToast('Error al confirmar', 'error');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> CONFIRMAR';
        }
    };
  });
}
