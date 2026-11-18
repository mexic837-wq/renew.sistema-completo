#!/usr/bin/env python3
"""
Recupera documentos que se subieron al almacenamiento pero no quedaron en la ficha del cliente:
Orden de Trabajo, Aplicación de Crédito y foto del ID.

Cómo encuentra al cliente:
  - Orden de Trabajo y Aplicación de Crédito: lee el nombre, correo y teléfono dentro del PDF.
  - Foto del ID: se sube menos de 5 segundos después del PDF de su aplicación de crédito.
Solo llena lo que falta; nunca reemplaza un documento que el cliente ya tenga.

Uso:
  SUPABASE_KEY=... python3 scripts/recuperar_documentos.py            # solo muestra qué haría
  SUPABASE_KEY=... python3 scripts/recuperar_documentos.py --aplicar  # guarda los cambios
Necesita pdftotext (paquete poppler-utils).
"""
import json, os, re, subprocess, sys, tempfile, unicodedata, urllib.parse, urllib.request

G = 'https://gateway.renewgroup.site'
K = os.environ.get('SUPABASE_KEY') or sys.exit('Falta la variable SUPABASE_KEY')
H = {'apikey': K, 'Authorization': 'Bearer ' + K, 'Content-Type': 'application/json', 'Prefer': 'return=representation'}
APLICAR = '--aplicar' in sys.argv
CACHE = tempfile.mkdtemp(prefix='renew_pdfs_')


def req(url, data=None, method=None):
    r = urllib.request.Request(G + url, data=json.dumps(data).encode() if data is not None else None, headers=H, method=method)
    return json.load(urllib.request.urlopen(r))


def listar(prefix):
    out, off = [], 0
    while True:
        b = req('/storage/v1/object/list/archivos_renew', {"prefix": prefix, "limit": 1000, "offset": off, "sortBy": {"column": "name", "order": "asc"}})
        out += b
        if len(b) < 1000:
            return [o['name'] for o in out if o.get('id')]
        off += 1000


def clientes():
    out, off = [], 0
    while True:
        b = req(f'/rest/v1/clientes_maestro?select=id,nombre,telefono,email,adjuntos_oficina,credit_app_url,id_photo,adjunto_id_url&offset={off}&limit=1000')
        out += b
        if len(b) < 1000:
            return out
        off += 1000


def norm(s):
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z ]', ' ', s)).strip()


def digitos(s):
    d = re.sub(r'\D', '', str(s or ''))
    return d[-10:] if len(d) >= 10 else None


def adj(c):
    a = c.get('adjuntos_oficina')
    return a if isinstance(a, dict) else {}


def marca(n):
    m = re.search(r'_(\d{13})_', n)
    return int(m.group(1)) if m else 0


def texto_pdf(carpeta, nombre):
    p = os.path.join(CACHE, nombre)
    if not os.path.exists(p):
        urllib.request.urlretrieve(f"{G}/storage/v1/object/public/archivos_renew/{carpeta}/{urllib.parse.quote(nombre)}", p)
    return subprocess.run(['pdftotext', '-layout', p, '-'], capture_output=True, text=True).stdout


def buscar(cl, nombre, telefonos, correo):
    hits = []
    if correo:
        hits = [c for c in cl if (c.get('email') or '').strip().lower() == correo.lower()]
    for t in telefonos:
        if hits:
            break
        hits = [c for c in cl if t and digitos(c.get('telefono')) == t]
    if not hits and nombre:
        hits = [c for c in cl if norm(c.get('nombre')) == norm(nombre)]
    if len(hits) > 1 and nombre:
        h2 = [c for c in hits if norm(c.get('nombre')) == norm(nombre)]
        hits = h2 or hits
    return hits[0] if len(hits) == 1 else None


def datos_orden(t):
    nm = re.search(r'Purchaser/ Comprador:\s+(.+?)\s{2,}e-mail:\s*(\S*)', t)
    ph = re.search(r'Phone/ Telefono:\s+(.+)', t)
    nombre, correo = (nm.group(1).strip(), nm.group(2).strip()) if nm else ('', '')
    tel = digitos(ph.group(1)) if ph else None
    if not nm and not ph:  # formato viejo: sin etiquetas
        ls = [l.strip() for l in t.splitlines() if l.strip()]
        if len(ls) >= 2:
            a, b = re.split(r'\s{2,}', ls[0]), re.split(r'\s{2,}', ls[1])
            tel = digitos(a[-1]) if len(a) > 1 else None
            nombre = b[0]
            correo = b[1] if len(b) > 1 and '@' in b[1] else ''
    return nombre, [tel], correo


def datos_credito(t):
    ls = [l.strip() for l in t.splitlines() if l.strip()]
    nombre = next((l for l in ls if re.fullmatch(r"[A-Za-zÀ-ÿñÑ'.\- ]{4,}", l)), '')
    em = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', t)
    tels = [digitos(x) for x in re.findall(r'\(?\d{3}\)?[ -]?\d{3}-\d{4}', t)]
    return nombre, tels, em.group(0) if em else ''


def main():
    cl = clientes()
    por_id = {c['id']: c for c in cl}
    cambios = {}  # cliente_id -> {campo: valor}

    def poner(c, campo, valor):
        cambios.setdefault(c['id'], {})[campo] = valor

    # 1. Órdenes de Trabajo
    ultima = {}
    for f in [x for x in listar('ordenes/') if x.startswith('orden_trabajo_')]:
        try:
            c = buscar(cl, *datos_orden(texto_pdf('ordenes', f)))
        except Exception:
            continue
        if c and not adj(c).get('orden_trabajo_url') and marca(f) > ultima.get(c['id'], 0):
            ultima[c['id']] = marca(f)
            poner(c, 'orden_trabajo_url', f"{G}/storage/v1/object/public/archivos_renew/ordenes/{f}")

    # 2. Aplicaciones de crédito que no están en ninguna ficha
    pdfs = [x for x in listar('creditos/') if x.startswith('app_credito_')]
    ids = listar('creditos_ids/')
    pdf_cliente = {}
    for c in cl:
        for u in [c.get('credit_app_url'), adj(c).get('app_url')]:
            m = re.search(r'(app_credito_\d{13}_\d+\.pdf)', str(u or ''))
            if m:
                pdf_cliente[m.group(1)] = c
    ultima = {}
    for f in pdfs:
        if f in pdf_cliente:
            continue
        try:
            c = buscar(cl, *datos_credito(texto_pdf('creditos', f)))
        except Exception:
            continue
        if not c or marca(f) < ultima.get(c['id'], 0):
            continue
        ultima[c['id']] = marca(f)
        pdf_cliente[f] = c
        if not (c.get('credit_app_url') or adj(c).get('app_url')):
            poner(c, 'app_url', f"/api/storage-proxy/archivos_renew/creditos/{f}")

    # 3. Fotos del ID: se suben justo después del PDF de crédito
    pdf_ts = sorted((marca(p), p) for p in pdfs)
    for i in ids:
        t = marca(i)
        prev = [p for p in pdf_ts if p[0] <= t and t - p[0] < 5000]
        c = pdf_cliente.get(prev[-1][1]) if prev else None
        if c and not (c.get('id_photo') or c.get('adjunto_id_url') or adj(c).get('id_photo_url')):
            poner(c, 'id_photo_url', f"{G}/storage/v1/object/public/archivos_renew/creditos_ids/{i}")

    for cid, ch in cambios.items():
        print(('GUARDAR ' if APLICAR else 'FALTA   ') + por_id[cid]['nombre'] + ': ' + ', '.join(ch))
        if not APLICAR:
            continue
        cur = req(f'/rest/v1/clientes_maestro?select=id,adjuntos_oficina,credit_app_url,id_photo&id=eq.{urllib.parse.quote(cid)}')[0]
        a, upd = adj(cur), {}
        for campo, valor in ch.items():
            if a.get(campo):
                continue
            a[campo] = valor
            if campo == 'app_url' and not cur.get('credit_app_url'):
                upd['credit_app_url'] = valor
            if campo == 'id_photo_url' and not cur.get('id_photo'):
                upd['id_photo'] = upd['adjunto_id_url'] = valor
        upd['adjuntos_oficina'] = a
        req(f'/rest/v1/clientes_maestro?id=eq.{urllib.parse.quote(cid)}', upd, 'PATCH')
    print(f"{len(cambios)} cliente(s) con documentos por recuperar" + ('' if APLICAR else ' (usa --aplicar para guardarlos)'))


if __name__ == '__main__':
    main()
