# Motos del Caribe · Panel de notificaciones (frontend)

Página web estática que consume el backend de notificaciones para **visualizar los mensajes de cobro** generados por el servicio y auditar el historial de notificaciones enviadas y fallidas.

**URL en producción:** https://fronted-2rrf.onrender.com

Stack: HTML + Tailwind CSS (CDN) + JavaScript vanilla. **Sin build, sin bundler, sin dependencias de runtime.**

## Estructura

```
.
├── index.html       # layout con header, modal de login y secciones
├── app.js           # lógica: fetch, render, localStorage, auth
├── styles.css       # tweaks menores sobre Tailwind
├── render.yaml      # blueprint para Render Static Site
├── .gitignore
└── README.md
```

## Funcionalidades

1. **Pantalla de login** — modal que pide la **API Key** al primer acceso. La key se guarda en `localStorage` y se envía como header `X-API-Key` en cada llamada al backend. Si el backend responde `401`, la key se borra automáticamente y vuelve a aparecer el modal. Hay un botón **🔒 Cerrar sesión** en el header.
2. **Indicador de estado del backend** — punto de color en el header (🟡 conectando / 🟢 OK / 🔴 error) con el host del backend.
3. **Contratos próximos a pagar** — llama `GET /contracts/next-to-pay` y muestra:
   - Contrato, cliente, teléfono, día de pago, cuota semanal, **mora arrastrada** y **deuda total**.
   - **Caso del mensaje** con badge de color: 🔴 *Mora · Cuota vencida* (deuda acumulada) / 🔵 *Recordatorio · Sin abono de la semana*.
   - El texto del mensaje que el backend armó y que n8n enviará por WhatsApp (una de las 3 plantillas aprobadas por Meta: `notificacion_mora` o `recordatorio_cuota`).
4. **Pagos registrados hoy** — llama `GET /contracts/paid-today` y lista los clientes con un pago semanal registrado en el día, con el mensaje `pago_recibido` ya formateado para confirmación.
5. **Historial completo** (paginado) con dos tabs:
   - ✉️ **Enviadas** — `GET /notifications/all?page=&size=` con paginación visual (← → + selector 10/20/50/100).
   - ⚠️ **Errores** — `GET /notifications/errors/all?page=&size=` con columna extra del `errorMessage`.
6. **Historial por contrato** — busca notificaciones por `numContract` usando `GET /get/notifications?id=` con validación cliente de dígitos.
7. **Configuración avanzada** (colapsada por defecto) — para apuntar a un backend distinto sin tocar código, con botón *↺ Restablecer* que vuelve a la URL de producción.

## Setup local (onboarding)

Si recién clonaste el repo y querés levantar el dashboard apuntando a un backend local:

```bash
git clone https://github.com/Sistema-de-Automatizacion/Fronted.git
cd Fronted
# Python 3 (usa py en Windows si python no está en PATH)
python -m http.server 5173
```

Abrir http://localhost:5173 en el navegador.

Pasos en el navegador:

1. Aparece el **modal de login** → pega la misma `app.api-key` que configuraste en el `.env` del backend local (por default el `.env.example` propone `local-dev-key-1234`).
2. Entrás al dashboard. El header arriba a la derecha debería mostrar 🟢 **Backend OK · localhost:8080** (si el backend está corriendo).
3. **Primera vez contra un backend local:** expandí **⚙️ Configuración avanzada del backend**, cambiá la URL a `http://localhost:8080` y **Guardar**. La URL queda guardada en `localStorage`, así que la próxima vez ya arranca apuntando al local.

### Backend local corriendo

Necesitás el backend en `http://localhost:8080`. Ver el [README del backend](https://github.com/Sistema-de-Automatizacion/Backend) — el setup es `cp .env.example .env`, completar credenciales y `./mvnw spring-boot:run`.

Default del `.env.example` del backend: `app.api-key=local-dev-key-1234`. Esa es la key que pegás en el modal de login del dashboard. CORS no necesita configuración extra para local (default `*` permite todo).

## Despliegue en Render (Static Site)

El frontend se despliega automáticamente cuando hay un push a `main`. El servicio está conectado a este repo y configurado como *Static Site* con:

- **Build Command:** vacío
- **Publish Directory:** `.`
- **Branch:** `main`

Si necesitas recrear el servicio, en https://dashboard.render.com → **New +** → **Static Site** → conectar este repo con esos parámetros, o usar el `render.yaml` incluido como Blueprint.

## Configuración y secretos

| Valor                                             | Dónde vive                          | Notas                                                                 |
|---------------------------------------------------|-------------------------------------|-----------------------------------------------------------------------|
| URL del backend                                   | Constante `DEFAULT_URL` en `app.js` | Hardcoded al Azure App Service; editable en UI via "Config avanzada"  |
| API Key (`X-API-Key`)                             | `localStorage["motos:apiKey"]`      | Se pide al usuario en el modal de login                               |
| Override de URL (opcional)                        | `localStorage["motos:backendUrl"]`  | Solo si el usuario la cambia desde Config avanzada                    |

**Nada se commitea al repo.** Todos los secretos viven solo en el navegador de cada usuario.

## Autenticación

El backend exige `X-API-Key` en **todas** las peticiones excepto `/actuator/health`, `/actuator/info` y los preflight CORS `OPTIONS`. El frontend:

- Almacena la key en `localStorage` (clave `motos:apiKey`).
- La inyecta en cada `fetch` a través de la función centralizada `apiFetch()`.
- Intercepta cualquier `401` global y fuerza un nuevo login.
- No valida la key del lado cliente — confía en el backend para rechazarla si no es válida.

Si el backend está en sleep (plan free de Render/Azure) y responde lento, verás el indicador amarillo "Verificando backend..." durante unos segundos.

## Endpoints consumidos

| Método | Endpoint                                    | Usado por                      |
|--------|---------------------------------------------|--------------------------------|
| GET    | `/actuator/health`                          | Indicador del header (público) |
| GET    | `/contracts/next-to-pay`                    | Sección "Contratos próximos"   |
| GET    | `/contracts/paid-today`                     | Sección "Pagos registrados hoy"|
| GET    | `/notifications/all?page=&size=`            | Tab "Enviadas"                 |
| GET    | `/notifications/errors/all?page=&size=`     | Tab "Errores"                  |
| GET    | `/get/notifications?id=`                    | Búsqueda por contrato          |

## Troubleshooting

**"API key inválida o expirada" al ingresar una key nueva.**
La key que pegaste no coincide con la configurada en el backend (`app.api-key`). Confirma con el admin; cuida los espacios al copiar.

**El header muestra punto rojo "Backend no disponible".**
- El Azure App Service puede estar detenido: portal → App Service → **Start**.
- O el dominio del frontend no está en `app.cors.allowed-origins` del backend.
- Para casos de emergencia, expande "Config avanzada" y apunta a un backend alternativo.

**El dashboard carga pero los datos vienen vacíos.**
- No hay contratos/notificaciones en MySQL. Verifica que las vistas `vw_sv_all_motos_semanal` y `vw_gd_recaudo_bruto` existen y están pobladas.
- O la paginación está en una página sin datos. Vuelve a la página 1.

**"Failed to fetch" en el console.**
- El backend rechazó el preflight CORS. Confirma que el origen del frontend de Render (`https://fronted-2rrf.onrender.com`) está en `app.cors.allowed-origins` en Azure.
- O el navegador bloqueó contenido mixto (https → http). La URL del backend **debe** ser `https`.

## Relacionado

- Backend: https://github.com/Sistema-de-Automatizacion/Backend
- Workflow de n8n: consume los mismos endpoints con la misma `X-API-Key`. Cualquier cambio en la auth del backend requiere actualizar la credencial Header Auth en n8n también.
