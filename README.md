# Motos del Caribe · Panel de notificaciones (frontend)

Página web estática que consume el backend de notificaciones para **visualizar los mensajes de cobro** generados por el servicio y las notificaciones registradas por contrato.

Stack: HTML + Tailwind CSS (CDN) + JavaScript vanilla. **Sin build, sin bundler, sin dependencias de runtime.**

## Estructura

```
Backend-frontend/
├── index.html       # layout de la página
├── app.js           # lógica (fetch, render, localStorage)
├── styles.css       # tweaks menores sobre Tailwind
├── render.yaml      # blueprint para Render Static Site
├── .gitignore
└── README.md
```

## Funcionalidades

1. **Configuración del backend** — input para definir la URL del backend (`http://localhost:8080` por defecto). Se guarda en `localStorage` y hay un botón para probar `/actuator/health`.
2. **Contratos próximos a pagar** — llama `GET /contracts/next-to-pay` y muestra una tabla con:
   - Contrato, cliente, teléfono, día de pago
   - Cuota, abono recibido, saldo pendiente
   - **Caso del mensaje** (C · Sin abono / D · Abono parcial), según el árbol de decisión del backend
   - El texto del mensaje que el backend generó y que n8n enviará por WhatsApp
3. **Historial de notificaciones por contrato** — llama `GET /get/notifications?id=`, con validación cliente de que sólo se acepten dígitos.

## Ejecución local

### Opción A — Abrir el archivo directamente

Doble clic en `index.html`. Funciona para probar la UI, pero el browser bloqueará las llamadas al backend por `file://` → `http://` (CORS + mixed-origin). Solo útil para ver el layout.

### Opción B — Servidor estático simple

```bash
# Python 3 (ya instalado en Windows via python.org)
cd C:\Users\LeNoVo\Backend-frontend
python -m http.server 5500
```

Luego abrir http://localhost:5500.

```bash
# Node.js (si lo tienes)
npx serve -l 5500 .
```

### Paso crítico — habilitar CORS en el backend

Por defecto, el backend rechaza las llamadas del frontend porque son de otro origen (`http://localhost:5500` → `http://localhost:8080`). Hay dos opciones:

**Opción 1: agregar un `@Configuration` de CORS en el backend** (recomendada, 10 líneas)

Crear `src/main/java/com/automatization/comunications/config/CorsConfig.java`:

```java
package com.automatization.comunications.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(
                    "http://localhost:5500",
                    "https://<tu-frontend>.onrender.com"
                )
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*");
    }
}
```

Después recompilar y reiniciar el backend.

**Opción 2: extensión del browser** — "CORS Unblock" o similar. Solo para desarrollo. **No usar en producción.**

## Despliegue en Render (Static Site)

### Prerrequisitos

1. Crear un repositorio en GitHub con esta carpeta (puede ser nuevo, p. ej. `motos-frontend`). Ver "Subir a GitHub" abajo.
2. Tener cuenta en https://render.com (gratis con GitHub OAuth).
3. **Haber desplegado el backend primero** y tener su URL pública (ej. `https://motos-backend.onrender.com` o la URL del Azure App Service).
4. **Haber habilitado CORS** en el backend con el origen del frontend de Render (`https://<tu-frontend>.onrender.com`).

### Subir a GitHub

```bash
cd C:\Users\LeNoVo\Backend-frontend
git init
git add .
git commit -m "chore: frontend inicial para visualizar notificaciones"
git branch -M main
# Crear el repo en github.com primero, luego:
git remote add origin https://github.com/<tu-usuario>/motos-frontend.git
git push -u origin main
```

### Deploy en Render

1. Entrar a https://dashboard.render.com.
2. **New +** → **Static Site**.
3. Conectar el repo de GitHub.
4. Configurar:
   - **Name:** `motos-frontend` (o el que quieras).
   - **Branch:** `main`.
   - **Build Command:** (vacío)
   - **Publish Directory:** `.`
5. **Create Static Site**.
6. Render asigna una URL `https://motos-frontend.onrender.com` en ~30 segundos.

### Primera visita al sitio publicado

1. Abrir `https://motos-frontend.onrender.com`.
2. En la sección "Configuración del backend", cambiar la URL al endpoint público del backend (ej. `https://motos-backend.onrender.com`).
3. Clic en **Guardar**.
4. Clic en **Probar /actuator/health** — debe responder `UP`.
5. Clic en **Actualizar** en la sección de contratos.

Si ves un error tipo `Failed to fetch` o `CORS policy`, confirma:
- Que el backend esté corriendo (no en sleep si está en el plan free de Render).
- Que el backend permita explícitamente el origen del frontend en su configuración de CORS.
- Que la URL del backend esté con `https://` (no `http://`).

## Variables y configuración

La URL del backend **no está hardcodeada en el código**. Se edita desde la UI y se persiste en `localStorage`. Esto permite:
- Tener una sola build del frontend para dev, staging y prod.
- Cambiar de backend sin redesplegar.

Si prefieres fijarla por entorno, modifica la constante `DEFAULT_URL` en `app.js`.

## Notas

- **Sin autenticación:** el frontend llama los endpoints públicos del backend. Si más adelante se agrega API key al backend (riesgo #2 del architecture.md), habrá que agregar un input para la key y enviarla como header `X-API-Key` en los `fetch`.
- **Sin paginación:** el endpoint `/contracts/next-to-pay` devuelve todos los contratos de una vez. Si el volumen crece, habrá que agregar `?page=&size=` en backend y paginador visual aquí.
- **El historial global no existe hoy:** `GET /get/notifications` sólo soporta filtrar por un `id` específico. Si quieres ver *todos* los mensajes enviados, hay que agregar un endpoint `GET /notifications/all` al backend y una nueva sección a este frontend.
