# 🌊 RENEW WATER — Portal de Contratos

Portal digital de contratos y formularios para el equipo de ventas de Renew Water.  
Genera automáticamente PDFs firmados de **Aplicación de Crédito** y **Orden de Trabajo**.

---

## 🖥️ Despliegue en VPS (Producción)

### 1. Requisitos de la VPS
- Node.js **v18 o superior**
- PM2 (gestor de procesos): `npm install -g pm2`
- Nginx (como proxy inverso, recomendado)

### 2. Instalación

```bash
# 1. Clonar / subir la carpeta FORMULARIO-RENEW-WATER-main a la VPS
cd /var/www/renew-water

# 2. Instalar dependencias
npm install

# 3. Copiar y configurar variables de entorno
cp .env.example .env
nano .env   # Edita el puerto si es necesario
```

### 3. Arrancar con PM2

```bash
# Iniciar el servidor
pm2 start server.js --name renew-water

# Que arranque automáticamente al reiniciar la VPS
pm2 save
pm2 startup
```

### 4. Configurar Nginx (proxy inverso)

```nginx
server {
    listen 80;
    server_name formulario.tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        # Necesario para fotos/firmas grandes en base64
        client_max_body_size 25M;
    }
}
```

```bash
# Activar sitio y recargar Nginx
sudo ln -s /etc/nginx/sites-available/renew-water /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL con Let's Encrypt (HTTPS)

```bash
sudo certbot --nginx -d formulario.tudominio.com
```

---

## 💻 Desarrollo Local

```bash
npm install
npm run dev
# → Servidor en http://localhost:3000
```

---

## 🔌 Endpoints de la API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/`  | Sirve el portal de formularios |
| `POST` | `/api/generar-pdf`   | Genera PDF de Aplicación de Crédito |
| `POST` | `/api/generar-orden` | Genera PDF de Orden de Trabajo |

### Formato del body (ambos endpoints):
```json
{
  "campo_pdf_1": "valor",
  "campo_pdf_2": "valor",
  "firma_aplicante": "data:image/png;base64,..."
}
```

---

## 📁 Estructura

```
FORMULARIO-RENEW-WATER-main/
├── server.js              ← Servidor Express (VPS)
├── package.json
├── .env.example
├── index.html             ← Portal de formularios
├── css/styles.css
├── js/
│   ├── app.js             ← Lógica del portal
│   ├── creditForm.js      ← Formulario Aplicación de Crédito
│   └── workOrderForm.js   ← Formulario Orden de Trabajo
├── api/
│   ├── generar-pdf.js     ← Handler de crédito (referencia)
│   └── generar-orden.js   ← Handler de orden (referencia)
├── assets/
│   └── images/
├── molde_credito_v9.pdf   ← Molde PDF Crédito
└── molde_orden_v3.pdf     ← Molde PDF Orden de Trabajo
```
