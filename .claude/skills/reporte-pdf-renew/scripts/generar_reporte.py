#!/usr/bin/env python3
"""Genera un PDF de reporte de cambios con la marca Renew.

Uso:
    python generar_reporte.py datos.json salida.pdf

datos.json (todos los campos son opcionales salvo "secciones"):
{
  "titulo": "Reporte de cambios del sistema",
  "subtitulo": "Octubre 2026",
  "periodo": "24 - 26 oct 2026",
  "preparado_para": "Miguel",
  "resumen": "Texto corto con lo más importante.",
  "secciones": [
    {"nombre": "Leads", "items": [
      {"tipo": "nuevo|mejora|correccion|seguridad|pendiente",
       "titulo": "...", "detalle": "...", "commit": "abc1234", "archivos": ["js/x.js"]}
    ]}
  ],
  "pendientes": ["..."],
  "notas": ["..."]
}

El PDF se imprime con Chrome/Edge en modo headless (ya viene en Windows y Mac),
así no hace falta instalar librerías de Python.
"""
import base64
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

AQUI = Path(__file__).resolve().parent
LOGO = AQUI.parent / "assets" / "logo-renew.png"

# Paleta Renew (sale de css/styles.css del sistema y del portal de formularios)
TIPOS = {
    "nuevo":      ("Nuevo",      "#00bfa3", "#e6fbf7"),
    "mejora":     ("Mejora",     "#0e7fab", "#e7f3f9"),
    "correccion": ("Corrección", "#f59e0b", "#fef6e4"),
    "seguridad":  ("Seguridad",  "#ef4444", "#fdeceb"),
    "pendiente":  ("Pendiente",  "#8b5cf6", "#f1ecfd"),
}

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def esc(v):
    return html.escape(str(v if v is not None else ""), quote=True)


def parrafos(texto):
    """Respeta saltos de línea del detalle."""
    partes = [p.strip() for p in str(texto or "").split("\n") if p.strip()]
    return "".join(f"<p>{esc(p)}</p>" for p in partes)


def logo_data_uri():
    if not LOGO.exists():
        return ""
    return "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode()


def construir_html(d):
    hoy = date.today()
    titulo = d.get("titulo") or "Reporte de cambios del sistema"
    subtitulo = d.get("subtitulo") or f"{MESES[hoy.month - 1].capitalize()} {hoy.year}"
    secciones = d.get("secciones") or []

    conteo = {k: 0 for k in TIPOS}
    total = 0
    for s in secciones:
        for it in s.get("items", []):
            t = it.get("tipo", "mejora")
            conteo[t if t in conteo else "mejora"] += 1
            total += 1

    meta = []
    if d.get("periodo"):
        meta.append(("Periodo", d["periodo"]))
    if d.get("preparado_para"):
        meta.append(("Preparado para", d["preparado_para"]))
    meta.append(("Fecha del reporte", f"{hoy.day} de {MESES[hoy.month - 1]} de {hoy.year}"))
    meta_html = "".join(f'<div><span>{esc(k)}</span><b>{esc(v)}</b></div>' for k, v in meta)

    nombres = {"nuevo": ("Nuevo", "Nuevos"), "mejora": ("Mejora", "Mejoras"),
               "correccion": ("Corrección", "Correcciones"), "seguridad": ("Seguridad", "Seguridad")}
    cards = "".join(
        f'<div class="card" style="border-top-color:{TIPOS[k][1]}"><b style="color:{TIPOS[k][1]}">{conteo[k]}</b>'
        f'<span>{nombres[k][0] if conteo[k] == 1 else nombres[k][1]}</span></div>'
        for k in ("nuevo", "mejora", "correccion", "seguridad") if conteo[k]
    )

    bloques = []
    for s in secciones:
        items_html = []
        for it in s.get("items", []):
            tipo = it.get("tipo", "mejora")
            if tipo not in TIPOS:
                tipo = "mejora"
            etiqueta, color, fondo = TIPOS[tipo]
            pie = []
            if it.get("commit"):
                pie.append(f'<span class="chip">commit {esc(it["commit"])}</span>')
            for a in it.get("archivos", []) or []:
                pie.append(f'<span class="chip">{esc(a)}</span>')
            items_html.append(f"""
            <div class="item" style="border-left-color:{color}">
              <div class="item-top">
                <span class="tag" style="color:{color};background:{fondo}">{etiqueta}</span>
                <h4>{esc(it.get("titulo"))}</h4>
              </div>
              {parrafos(it.get("detalle"))}
              {('<div class="chips">' + "".join(pie) + '</div>') if pie else ''}
            </div>""")
        bloques.append(f"""
        <section>
          <h3><i></i>{esc(s.get("nombre"))}<small>{len(s.get("items", []))} cambio{"s" if len(s.get("items", [])) != 1 else ""}</small></h3>
          {"".join(items_html)}
        </section>""")

    def lista(titulo_l, filas, clase):
        if not filas:
            return ""
        lis = "".join(f"<li>{esc(x)}</li>" for x in filas)
        return f'<section class="{clase}"><h3><i></i>{titulo_l}</h3><ul>{lis}</ul></section>'

    resumen = f'<div class="resumen">{parrafos(d.get("resumen"))}</div>' if d.get("resumen") else ""

    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>{esc(titulo)}</title>
<style>
  @page {{ size: A4; margin: 16mm 14mm 18mm;
           @bottom-left  {{ content: "Renew · {esc(titulo)}"; font: 600 8pt Inter, Arial, sans-serif; color: #94a3b8; }}
           @bottom-right {{ content: "Página " counter(page) " de " counter(pages); font: 600 8pt Inter, Arial, sans-serif; color: #94a3b8; }} }}
  @page :first {{ margin-top: 0; }}
  * {{ box-sizing: border-box; }}
  html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  body {{ margin: 0; font-family: Inter, 'Segoe UI', Arial, sans-serif; color: #0b1120; font-size: 10.5pt; line-height: 1.5; }}
  .portada {{ margin: 0 -14mm 0; padding: 14mm 14mm 11mm; color: #fff;
             background: linear-gradient(135deg, #0b1120 0%, #0a4a6e 55%, #00bfa3 130%); }}
  .marca {{ display: flex; align-items: center; gap: 14px; }}
  .marca img {{ height: 58px; width: auto; }}
  .marca b {{ font-size: 20pt; letter-spacing: 1px; font-weight: 800; }}
  .marca b em {{ font-style: normal; color: #00dfbf; }}
  .portada h1 {{ margin: 22px 0 2px; font-size: 24pt; line-height: 1.15; font-weight: 800; }}
  .portada .sub {{ margin: 0; font-size: 12pt; color: #7ff0de; font-weight: 600; }}
  .franja {{ height: 5px; margin: 0 -14mm 18px; background: linear-gradient(90deg, #00dfbf, #05d564 55%, #ffc400); }}
  .meta {{ display: flex; gap: 28px; margin-top: 18px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.18); }}
  .meta span {{ display: block; font-size: 7.5pt; letter-spacing: 1px; text-transform: uppercase; color: #a8c9d6; }}
  .meta b {{ font-size: 10.5pt; font-weight: 700; }}
  .cards {{ display: flex; gap: 10px; margin: 0 0 16px; }}
  .card {{ flex: 1; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: 3px solid; border-radius: 10px; }}
  .card b {{ display: block; font-size: 20pt; line-height: 1.1; }}
  .card span {{ font-size: 8pt; text-transform: uppercase; letter-spacing: .8px; color: #475569; font-weight: 700; }}
  .resumen {{ margin: 0 0 18px; padding: 12px 16px; background: #f1fbf9; border-left: 4px solid #00dfbf; border-radius: 0 10px 10px 0; }}
  .resumen p {{ margin: 0 0 6px; }} .resumen p:last-child {{ margin: 0; }}
  section {{ margin: 0 0 18px; }}
  h3 {{ display: flex; align-items: center; gap: 9px; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; font-size: 13pt; font-weight: 800; color: #0a4a6e; break-after: avoid; }}
  h3 i {{ width: 9px; height: 9px; border-radius: 50%; background: linear-gradient(135deg, #00dfbf, #05d564); flex-shrink: 0; }}
  h3 small {{ margin-left: auto; font-size: 8pt; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .8px; }}
  .item {{ margin: 0 0 9px; padding: 9px 13px; background: #fff; border: 1px solid #e2e8f0; border-left: 4px solid; border-radius: 10px; break-inside: avoid; }}
  .item-top {{ display: flex; align-items: center; gap: 9px; margin-bottom: 3px; }}
  .item h4 {{ margin: 0; font-size: 10.5pt; font-weight: 700; }}
  .item p {{ margin: 2px 0 0; color: #334155; font-size: 9.5pt; }}
  .tag {{ padding: 2px 8px; border-radius: 99px; font-size: 7pt; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; white-space: nowrap; }}
  .chips {{ display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }}
  .chip {{ padding: 1px 7px; border-radius: 6px; background: #f1f5f9; color: #475569; font: 600 7.5pt Consolas, 'Courier New', monospace; }}
  ul {{ margin: 0; padding-left: 18px; }} li {{ margin: 0 0 4px; }}
  .pend h3 {{ color: #7c3aed; }} .pend h3 i {{ background: #8b5cf6; }}
  .notas h3 {{ color: #475569; }} .notas h3 i {{ background: #94a3b8; }}
  .contenido {{ padding-top: 0; }}
</style></head>
<body>
  <header class="portada">
    <div class="marca"><img src="{logo_data_uri()}" alt="Renew"><b>RENEW <em>GROUP</em></b></div>
    <h1>{esc(titulo)}</h1>
    <p class="sub">{esc(subtitulo)}</p>
    <div class="meta">{meta_html}</div>
  </header>
  <div class="franja"></div>
  <div class="contenido">
    {('<div class="cards">' + cards + '</div>') if cards else ''}
    {resumen}
    {"".join(bloques)}
    {lista("Pendientes y próximos pasos", d.get("pendientes"), "pend")}
    {lista("Notas", d.get("notas"), "notas")}
  </div>
</body></html>"""


def buscar_navegador():
    candidatos = [
        os.environ.get("CHROME_PATH"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    for c in candidatos:
        if c and os.path.exists(c):
            return c
    for nombre in ("google-chrome", "chromium", "chromium-browser", "chrome", "msedge"):
        ruta = shutil.which(nombre)
        if ruta:
            return ruta
    return None


def main():
    if len(sys.argv) != 3:
        sys.exit("Uso: python generar_reporte.py datos.json salida.pdf")
    datos = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if not datos.get("secciones"):
        sys.exit('El JSON necesita al menos una "secciones" con "items".')
    salida = Path(sys.argv[2]).resolve()
    salida.parent.mkdir(parents=True, exist_ok=True)

    navegador = buscar_navegador()
    if not navegador:
        sys.exit("No encontré Chrome ni Edge. Instala uno o define CHROME_PATH con su ruta.")

    with tempfile.TemporaryDirectory() as tmp:
        pagina = Path(tmp) / "reporte.html"
        pagina.write_text(construir_html(datos), encoding="utf-8")
        cmd = [navegador, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
               f"--user-data-dir={Path(tmp) / 'perfil'}", f"--print-to-pdf={salida}",
               pagina.as_uri()]
        subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    if not salida.exists() or salida.stat().st_size == 0:
        sys.exit("El navegador no generó el PDF.")
    print(salida)


if __name__ == "__main__":
    main()
