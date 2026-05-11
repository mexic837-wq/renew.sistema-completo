const fs = require('fs');

const filepath = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js';

let content = fs.readFileSync(filepath, 'utf8');

// Find the anchor: the color radios line followed by the collaborators block
const anchor = `document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = false);\r\n\r\n    // `;
const anchorIdx = content.indexOf(anchor);

if (anchorIdx === -1) {
    // Try with \n only
    const anchor2 = `document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = false);\n\n    // `;
    const idx2 = content.indexOf(anchor2);
    console.log('Anchor2 index:', idx2);
    process.exit(1);
}

console.log('Found anchor at:', anchorIdx);

const insertAfter = `document.querySelectorAll('input[name="ev-color"]').forEach(r => r.disabled = false);\r\n`;
const insertIdx = anchorIdx + insertAfter.length;

const newCode = `
    // Google Places Autocomplete for address field
    const evDirInput = document.getElementById('ev-direccion');
    const evMapPreview = document.getElementById('ev-map-preview');
    const evMapCanvas = document.getElementById('ev-map-canvas');

    if (evDirInput && !evDirInput._placesInit && window.google && window.google.maps && window.google.maps.places) {
        evDirInput._placesInit = true;
        evDirInput._evMap = null;
        evDirInput._evMarker = null;

        const autocomplete = new google.maps.places.Autocomplete(evDirInput, {
            types: ['address'],
            fields: ['formatted_address', 'geometry', 'name']
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place || !place.geometry) return;

            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();

            if (evMapPreview) evMapPreview.classList.remove('hidden');

            if (!evDirInput._evMap) {
                evDirInput._evMap = new google.maps.Map(evMapCanvas, {
                    center: { lat, lng },
                    zoom: 15,
                    mapTypeId: 'roadmap',
                    disableDefaultUI: true,
                    gestureHandling: 'none',
                    styles: [
                        { elementType: 'geometry', stylers: [{ color: '#1a2035' }] },
                        { elementType: 'labels.text.fill', stylers: [{ color: '#00f5d4' }] },
                        { elementType: 'labels.text.stroke', stylers: [{ color: '#0a1628' }] },
                        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
                        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1f3c' }] },
                        { featureType: 'poi', stylers: [{ visibility: 'off' }] }
                    ]
                });
                evDirInput._evMarker = new google.maps.Marker({
                    position: { lat, lng },
                    map: evDirInput._evMap,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#00f5d4',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2
                    }
                });
            } else {
                evDirInput._evMap.setCenter({ lat, lng });
                evDirInput._evMarker.setPosition({ lat, lng });
            }

            evDirInput.value = place.formatted_address || place.name || evDirInput.value;
        });

        evDirInput.addEventListener('input', () => {
            if (!evDirInput.value.trim() && evMapPreview) {
                evMapPreview.classList.add('hidden');
            }
        });
    } else if (evMapPreview) {
        evMapPreview.classList.add('hidden');
    }

`;

const newContent = content.substring(0, insertIdx) + newCode + content.substring(insertIdx);
fs.writeFileSync(filepath, newContent);
console.log('Success: Places Autocomplete block inserted');
