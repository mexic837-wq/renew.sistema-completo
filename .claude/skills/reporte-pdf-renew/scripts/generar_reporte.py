#!/usr/bin/env python3
"""Genera el PDF del REPORTE DIARIO DE AVANCES con la marca Renew.

Uso:
    python generar_reporte.py datos.json salida.pdf

datos.json:
{
  "fecha": "Miércoles, 04/11/2026",      # opcional: por defecto, hoy
  "nombre": "Miguel Durantt Paolini",
  "completadas": ["Tarea 1", "Tarea 2 - detalle o impacto"],
  "en_progreso": ["Tarea (70%)", "Actividad para mañana"],
  "bloqueos": []                         # vacío = "Ninguno"
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

DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

# (icono, título, clave del JSON, color, fondo)
SECCIONES = [
    ("✅", "1. Tareas completadas hoy:", "completadas", "#00bfa3", "#e6fbf7"),
    ("🔄", "2. En progreso / Pendientes:", "en_progreso", "#0e7fab", "#e7f3f9"),
    ("⚠️", "3. Bloqueos o impedimentos:", "bloqueos", "#f59e0b", "#fef6e4"),
]


def esc(v):
    return html.escape(str(v if v is not None else ""), quote=True)


def lista(valor):
    """Acepta una lista o un texto con saltos de línea; quita viñetas escritas a mano."""
    if isinstance(valor, str):
        valor = valor.split("\n")
    out = []
    for x in valor or []:
        t = str(x).strip().lstrip("*-• ").strip()
        if t:
            out.append(t)
    return out


def logo_data_uri():
    if not LOGO.exists():
        return ""
    return "data:image/png;base64," + base64.b64encode(LOGO.read_bytes()).decode()


def fecha_por_defecto():
    hoy = date.today()
    return f"{DIAS[hoy.weekday()]}, {hoy.day:02d}/{hoy.month:02d}/{hoy.year}"


def construir_html(d):
    fecha = d.get("fecha") or fecha_por_defecto()
    nombre = d.get("nombre") or ""

    bloques = []
    for icono, titulo, clave, color, fondo in SECCIONES:
        items = lista(d.get(clave))
        if clave == "bloqueos" and not items:
            items = ["Ninguno"]
        if not items:
            items = ["Sin elementos"]
        lis = "".join(f"<li>{esc(t)}</li>" for t in items)
        bloques.append(f"""
        <section style="border-left-color:{color}">
          <h3><span class="ico" style="background:{fondo}">{icono}</span>{esc(titulo)}</h3>
          <ul style="--c:{color}">{lis}</ul>
        </section>""")

    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Reporte diario de avances</title>
<style>
  @page {{ size: A4; margin: 0 0 16mm;
           @bottom-left  {{ content: "Renew · Reporte diario de avances"; font: 600 8pt Inter, Arial, sans-serif; color: #94a3b8; margin-left: 14mm; }}
           @bottom-right {{ content: "Página " counter(page) " de " counter(pages); font: 600 8pt Inter, Arial, sans-serif; color: #94a3b8; margin-right: 14mm; }} }}
  * {{ box-sizing: border-box; }}
  html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  body {{ margin: 0; font-family: Inter, 'Segoe UI', 'Segoe UI Emoji', Arial, sans-serif; color: #0b1120; font-size: 11pt; line-height: 1.5; }}
  .portada {{ padding: 12mm 14mm 9mm; color: #fff;
             background: linear-gradient(135deg, #0b1120 0%, #0a4a6e 55%, #00bfa3 130%); }}
  .marca {{ display: flex; align-items: center; gap: 14px; }}
  .marca img {{ height: 54px; width: auto; }}
  .marca b {{ font-size: 19pt; letter-spacing: 1px; font-weight: 800; }}
  .marca b em {{ font-style: normal; color: #00dfbf; }}
  .portada h1 {{ margin: 18px 0 0; font-size: 22pt; line-height: 1.15; font-weight: 800; letter-spacing: .5px; }}
  .franja {{ height: 5px; background: linear-gradient(90deg, #00dfbf, #05d564 55%, #ffc400); }}
  .contenido {{ padding: 8mm 14mm 0; }}
  .meta {{ display: flex; gap: 12px; margin: 0 0 16px; }}
  .meta div {{ flex: 1; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }}
  .meta span {{ display: block; font-size: 8pt; letter-spacing: .8px; text-transform: uppercase; color: #64748b; font-weight: 700; }}
  .meta b {{ font-size: 12pt; font-weight: 800; color: #0a4a6e; }}
  section {{ margin: 0 0 14px; padding: 12px 16px 10px; background: #fff; border: 1px solid #e2e8f0; border-left: 5px solid; border-radius: 12px; break-inside: avoid; }}
  h3 {{ display: flex; align-items: center; gap: 10px; margin: 0 0 8px; font-size: 13pt; font-weight: 800; color: #0a4a6e; }}
  .ico {{ width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 13pt; }}
  ul {{ margin: 0; padding: 0; list-style: none; }}
  li {{ position: relative; margin: 0 0 5px; padding-left: 18px; color: #1e293b; }}
  li::before {{ content: ""; position: absolute; left: 3px; top: .62em; width: 7px; height: 7px; border-radius: 50%; background: var(--c); }}
</style></head>
<body>
  <header class="portada">
    <div class="marca"><img src="{logo_data_uri()}" alt="Renew"><b>RENEW <em>GROUP</em></b></div>
    <h1>📋 REPORTE DIARIO DE AVANCES</h1>
  </header>
  <div class="franja"></div>
  <div class="contenido">
    <div class="meta">
      <div><span>📅 Fecha</span><b>{esc(fecha)}</b></div>
      <div><span>👤 Nombre</span><b>{esc(nombre)}</b></div>
    </div>
    {"".join(bloques)}
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
    if not lista(datos.get("completadas")) and not lista(datos.get("en_progreso")):
        sys.exit('El JSON necesita al menos "completadas" o "en_progreso" con elementos.')
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
