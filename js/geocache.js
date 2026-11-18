/* ============================================================
   RENEW OS – js/geocache.js
   Ubica direcciones en el mapa sin perder ninguna:
   - Las pide a Google de una en una (si se piden cientos a la vez, Google
     rechaza la mayoría con OVER_QUERY_LIMIT y esos pines no aparecían).
   - Reintenta cuando Google pide esperar.
   - Guarda cada resultado en el navegador para que el mapa cargue al instante
     la próxima vez.
   - Busca dentro de Estados Unidos ("Naples" → Naples, FL, no Italia).
   Uso igual que geocoder.geocode: geocodeCached(geocoder, { address }, (results, status) => {...})
   ============================================================ */
const CLAVE = 'rs_geo_v2';
const NO_HALLADO_DIAS = 7;
let cache = null;
let guardarPendiente = null;

function leerCache() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch (e) { cache = {}; }
  return cache;
}
function guardarCache() {
  clearTimeout(guardarPendiente);
  guardarPendiente = setTimeout(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(cache)); } catch (e) { /* almacenamiento lleno o bloqueado */ }
  }, 500);
}

// Direcciones con solo la ciudad: se les agrega el país para que Google no busque en otro lado
export function prepararDireccion(addr) {
  let a = String(addr || '').replace(/\s+/g, ' ').trim();
  if (!a || a.includes('@')) return '';
  if (!/\b(usa|us|united states|estados unidos|puerto rico|venezuela|colombia|m[eé]xico)\b/i.test(a)) a += ', USA';
  return a;
}

const cola = [];
let trabajando = false;
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

async function procesarCola() {
  if (trabajando) return;
  trabajando = true;
  while (cola.length) {
    const { geocoder, address, resolver } = cola.shift();
    let res = null;
    for (let intento = 0; intento < 6; intento++) {
      const { results, status } = await new Promise(ok => {
        try { geocoder.geocode({ address, region: 'us' }, (results, status) => ok({ results, status })); }
        catch (e) { ok({ results: null, status: 'ERROR' }); }
      });
      if (status === 'OVER_QUERY_LIMIT') { await esperar(1200 * (intento + 1)); continue; }
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        res = { lat: loc.lat(), lng: loc.lng() };
        leerCache()[address] = res;
      } else if (status === 'ZERO_RESULTS') {
        leerCache()[address] = { n: Date.now() };
      }
      break;
    }
    guardarCache();
    resolver(res);
    await esperar(80);
  }
  trabajando = false;
}

// Devuelve una promesa con { lat, lng } o null
export function ubicar(geocoder, direccion) {
  const address = prepararDireccion(direccion);
  if (!address) return Promise.resolve(null);
  const enCache = leerCache()[address];
  if (enCache && typeof enCache.lat === 'number') return Promise.resolve(enCache);
  if (enCache && enCache.n && Date.now() - enCache.n < NO_HALLADO_DIAS * 864e5) return Promise.resolve(null);
  return new Promise(resolver => { cola.push({ geocoder, address, resolver }); procesarCola(); });
}

// Igual que geocoder.geocode(request, callback), pero con cola, reintentos y caché
export function geocodeCached(geocoder, request, callback) {
  ubicar(geocoder, request && request.address).then(loc => {
    if (!loc) return callback(null, 'ZERO_RESULTS');
    callback([{ geometry: { location: new google.maps.LatLng(loc.lat, loc.lng) } }], 'OK');
  });
}
