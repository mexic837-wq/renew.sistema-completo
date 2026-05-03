/* ============================================================
   RENEW SOLAR – screens/mapa.js
   ============================================================ */
import { getCurrentUser, navigate } from '../app.js';
import { getDB } from '../api.js';

export async function renderMiMapa() {
  const user = getCurrentUser();
  const screen = document.getElementById('screen-mi-mapa');
  if (!screen) return;

  screen.innerHTML = `
    <div class="dash-header" style="padding-bottom: 0;">
      <div class="dash-header-top" style="display: flex; align-items: center; justify-content: center; position: relative; min-height: 60px;">
        <button id="btn-mapa-back" style="position: absolute; left: 0; background: none; border: none; color: var(--text); padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div class="dash-greeting" style="text-align: center;">
          <h1 style="margin: 0; font-size: 1.2rem;">Mi Mapa</h1>
          <p style="color:var(--text-muted); font-size:0.75rem; margin-top:2px;">Ubicación de tus clientes y leads asignados</p>
        </div>
      </div>
    </div>
    <div style="padding: 24px; padding-bottom: 100px;">
      <div id="mi-mapa-container" style="background: var(--surface); border-radius: 24px; padding: 16px; box-shadow: var(--shadow-sm); min-height: 500px; width: 100%; position: relative;">
          <div class="flex items-center justify-center w-full h-full text-gray-500">
              <i class="fa-solid fa-spinner fa-spin text-2xl"></i> <span class="ml-3">Cargando mapa...</span>
          </div>
      </div>
    </div>
  `;

  // Add event listener for back button
  setTimeout(() => {
    const btnBack = document.getElementById('btn-mapa-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => navigate('dashboard'));
    }
  }, 100);

  setTimeout(() => {
    const mapEl = document.getElementById('mi-mapa-container');
    if (mapEl && window.google && window.google.maps) {
      mapEl.innerHTML = ''; // clear loading

      const map = new google.maps.Map(mapEl, {
        center: { lat: 39.8283, lng: -98.5795 }, // USA center
        zoom: 4,
        mapTypeControl: false,
        streetViewControl: false,
        styles: [
          {
            "featureType": "poi",
            "stylers": [{ "visibility": "off" }]
          }
        ]
      });

      const geocoder = new google.maps.Geocoder();
      const bounds = new google.maps.LatLngBounds();
      let validMarkers = 0;

      const db = getDB();
      const allClients = db.Clientes_Maestro || [];
      const userProjects = (db.Proyectos_Dinamicos || []).filter(p => p.responsable_id === user.id);
      const userClientIds = new Set(userProjects.map(p => p.cliente_id));
      
      const myClients = allClients.filter(c => c.vendedor_asignado_id === user.id || userClientIds.has(c.id));

      if (myClients.length === 0) {
        mapEl.innerHTML = '<div class="flex flex-col items-center justify-center w-full h-full text-gray-400 text-center"><i class="fa-solid fa-map-location-dot text-4xl mb-3 opacity-50"></i><p>No tienes clientes con dirección registrada aún.</p></div>';
        return;
      }

      // Add a simple legend over the map
      const legend = document.createElement('div');
      legend.innerHTML = `
        <div style="background: white; color: #111827; padding: 10px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); font-size: 11px; font-weight: bold; margin: 10px;">
          <div style="display:flex; align-items:center; margin-bottom:4px;"><img src="http://maps.google.com/mapfiles/ms/icons/yellow-dot.png" style="width:16px; margin-right:4px;"> Renew Solar</div>
          <div style="display:flex; align-items:center; margin-bottom:4px;"><img src="http://maps.google.com/mapfiles/ms/icons/blue-dot.png" style="width:16px; margin-right:4px;"> Renew Water</div>
          <div style="display:flex; align-items:center; margin-bottom:4px;"><img src="http://maps.google.com/mapfiles/ms/icons/purple-dot.png" style="width:16px; margin-right:4px;"> Renew Home</div>
          <div style="display:flex; align-items:center;"><img src="http://maps.google.com/mapfiles/ms/icons/red-dot.png" style="width:16px; margin-right:4px;"> Otro</div>
        </div>
      `;
      map.controls[google.maps.ControlPosition.RIGHT_TOP].push(legend);

      myClients.forEach(c => {
        if (c.direccion) {
          geocoder.geocode({ address: c.direccion }, (results, status) => {
            if (status === 'OK' && results[0]) {
              
              let iconUrl = 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
              const dpto = (c.empresa || '').toLowerCase();
              if (dpto.includes('solar')) iconUrl = 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
              else if (dpto.includes('water')) iconUrl = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
              else if (dpto.includes('home')) iconUrl = 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png';

              const marker = new google.maps.Marker({
                map: map,
                position: results[0].geometry.location,
                title: c.nombre || 'Cliente',
                icon: iconUrl
              });
              
              const infoWindow = new google.maps.InfoWindow({
                content: `<div style="color:black; padding:5px; font-family: 'Inter', sans-serif;">
                            <strong style="font-size: 14px;">${c.nombre} ${c.apellido || ''}</strong><br>
                            <span style="font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">🏭 ${c.empresa || 'Global'}</span><br>
                            <span style="font-size: 12px; color: #666;">📞 ${c.telefono || 'Sin teléfono'}</span><br>
                            <span style="font-size: 12px; color: #666;">🆔 ${c.state_id || 'Sin State ID'}</span><br>
                            <div style="margin-top: 8px; font-size: 11px; padding: 4px 8px; background: #00f5d420; border: 1px solid #00f5d450; border-radius: 4px; display: inline-block; color: #0f8b78;">📍 ${c.direccion}</div>
                          </div>`
              });
              
              marker.addListener('click', () => {
                infoWindow.open(map, marker);
              });

              bounds.extend(results[0].geometry.location);
              validMarkers++;
              if (validMarkers > 0) {
                 map.fitBounds(bounds);
                 if (validMarkers === 1) {
                     map.setZoom(12);
                 }
              }
            }
          });
        }
      });
    } else {
        if (mapEl) mapEl.innerHTML = '<div class="p-6 text-center text-red-500">Error: Google Maps API no está cargada.</div>';
    }
  }, 400);
}
