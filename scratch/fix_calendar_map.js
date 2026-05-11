const fs = require('fs');

const filepath = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js';

let content = fs.readFileSync(filepath, 'utf8');

// Match the entire block we inserted before
const regex = /\/\/ Google Places Autocomplete for address field[\s\S]*?else if \(evMapPreview\) \{[\s\S]*?evMapPreview\.classList\.add\('hidden'\);[\s\S]*?\}/;

const newLogic = `// Google Places Autocomplete for address field
    const evDirInput = document.getElementById('ev-direccion');
    const evMapPreview = document.getElementById('ev-map-preview');
    const evMapCanvas = document.getElementById('ev-map-canvas');

    if (evDirInput && window.google && window.google.maps) {
        // Function to update or create the map
        const updateMiniMap = (lat, lng) => {
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
                        scale: 8,
                        fillColor: '#00f5d4',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2
                    }
                });
            } else {
                evDirInput._evMap.setCenter({ lat, lng });
                evDirInput._evMarker.setPosition({ lat, lng });
                // Trigger a resize to ensure it renders correctly in a modal
                google.maps.event.trigger(evDirInput._evMap, 'resize');
            }
        };

        if (!evDirInput._placesInit && window.google.maps.places) {
            evDirInput._placesInit = true;
            const autocomplete = new google.maps.places.Autocomplete(evDirInput, {
                types: ['address'],
                fields: ['formatted_address', 'geometry', 'name']
            });

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place && place.geometry) {
                    const loc = place.geometry.location;
                    updateMiniMap(loc.lat(), loc.lng());
                    evDirInput.value = place.formatted_address || place.name || evDirInput.value;
                }
            });

            evDirInput.addEventListener('input', () => {
                if (!evDirInput.value.trim() && evMapPreview) {
                    evMapPreview.classList.add('hidden');
                }
            });
        }

        // If we are opening a modal with an existing address, try to show the map
        if (evDirInput.value.trim()) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: evDirInput.value }, (results, status) => {
                if (status === 'OK' && results[0].geometry) {
                    const loc = results[0].geometry.location;
                    updateMiniMap(loc.lat(), loc.lng());
                }
            });
        } else if (evMapPreview) {
            evMapPreview.classList.add('hidden');
        }
    }`;

if (regex.test(content)) {
    const newContent = content.replace(regex, newLogic);
    fs.writeFileSync(filepath, newContent);
    console.log('Success: Robust Map logic updated');
} else {
    console.log('Regex did not match exactly, checking block existence...');
    if (content.indexOf('// Google Places Autocomplete for address field') !== -1) {
        console.log('Block exists but format differs. Manual intervention needed.');
    } else {
        console.log('Block not found at all.');
    }
}
