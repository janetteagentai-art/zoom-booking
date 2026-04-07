# ReservaZoom — Reserva Automática de Videoconferencias

Sistema de reservas automático de reuniones Zoom para docentes universitarios. Los profesores se registran, seleccionan un horario disponible y el sistema crea la reunión en Zoom automáticamente — sin intervención del administrador.

---

## ¿Qué hace?

- **Profesores:** se crean su propia cuenta, reservan un horario desde un calendario visual, y reciben el link + código de la reunión de Zoom al instante.
- **Administrador:** gestiona las cuentas Zoom disponibles, ve todas las reservas, y puede activar/desactivar profesores.
- **Sin intervención manual:** el sistema crea el meeting en Zoom vía API, genera el link de acceso y la contraseña, y los muestra en el dashboard del profesor.

---

## Stack Tecnológico

| Componente | Tecnología |
|------------|-------------|
| Backend | Node.js + Express + TypeScript |
| ORM | TypeORM |
| Base de datos | PostgreSQL 16 |
| Frontend | React + TypeScript + Vite |
| Proxy web | Nginx (Alpine) |
| Contenedores | Docker + Docker Compose |
| API Zoom | Server-to-Server OAuth |

---

## Arquitectura

```
┌─────────────────┐     ┌───────────────┐     ┌─────────────────┐
│   Navegador     │────▶│  Nginx :8080  │────▶│  API :4000      │
│  (React SPA)    │     │  (proxy)      │     │  (Express)      │
└─────────────────┘     └───────────────┘     └────────┬────────┘
                                                       │
                        ┌───────────────┐              │
                        │ PostgreSQL     │◀─────────────┤
                        │   :5432        │              │
                        └───────────────┘              │
                                                       │
                        ┌───────────────┐              │
                        │  Zoom API     │◀─────────────┘
                        │ (Server OAuth)│
                        └───────────────┘
```

---

## Modelos de Datos

### Professor
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| email | string | Email único (credencial) |
| name | string | Nombre completo |
| password | string | Hash bcrypt |
| role | enum | `professor` o `admin` |
| isActive | boolean | Cuenta activa/inactiva |

### ZoomAccount
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| label | string | Nombre para identificar la cuenta |
| email | string | Email asociado en Zoom (opcional) |
| zoomUserId | string | ID de usuario en Zoom (opcional) |
| isActive | boolean | Cuenta disponible para reservas |

### Booking
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| professorId | UUID | FK al profesor |
| zoomAccountId | UUID | FK a la cuenta Zoom usada |
| title | string | Nombre de la reunión |
| startTime | timestamptz | Fecha y hora (UTC-3) |
| durationMinutes | int | Duración en minutos |
| status | enum | `pending`, `confirmed`, `cancelled` |
| zoomMeetingId | string | ID del meeting en Zoom |
| zoomJoinUrl | string | Link para unirse |
| zoomPassword | string | Contraseña de la reunión |
| zoomEmbedUrl | string | URL para incrustar iframe |
| zoomStartUrl | string | Link del anfitrión (host) |

---

## API Endpoints

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro de profesor |
| POST | `/api/auth/login` | Login (devuelve JWT) |
| GET | `/api/auth/me` | Datos del usuario actual |

### Reservas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/bookings/availability?start=&end=` | Horarios disponibles (slots de 30 min) |
| GET | `/api/bookings` | Lista de reservas (propias o todas si es admin) |
| POST | `/api/bookings` | Crear una reserva (valida superposición, crea meeting en Zoom) |
| DELETE | `/api/bookings/:id` | Cancelar reserva (elimina el meeting de Zoom) |

### Cuentas Zoom (solo admin)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/zoom-accounts` | Listar todas las cuentas |
| POST | `/api/zoom-accounts` | Agregar una cuenta |
| PATCH | `/api/zoom-accounts/:id` | Editar (label, email, isActive) |
| DELETE | `/api/zoom-accounts/:id` | Eliminar cuenta |

### Administración (solo admin)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/professors` | Listar profesores |
| POST | `/api/admin/professors` | Crear profesor manualmente |
| PATCH | `/api/admin/professors/:id` | Editar profesor |
| DELETE | `/api/admin/professors/:id` | Eliminar profesor |

---

## Variables de Entorno

### Backend (`.env`)
```env
PORT=4000
NODE_ENV=development
TZ=America/Buenos_Aires

DB_HOST=postgres
DB_PORT=5432
DB_NAME=zoom_booking
DB_USER=janette
DB_PASSWORD=changeme

JWT_SECRET=tu_secret_aqui

# Credenciales Server-to-Server OAuth de Zoom
ZOOM_ACCOUNT_ID=tu_account_id
ZOOM_CLIENT_ID=tu_client_id
ZOOM_CLIENT_SECRET=tu_client_secret
```

### Docker Compose
```env
# En .env en la raíz del proyecto (fuente del docker-compose.yml)
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
JWT_SECRET=...
```

---

## Instalación y Puesta en Marcha

### Requisitos Previos
- Docker y Docker Compose instalados
- Credenciales de **Server-to-Server OAuth** de Zoom

### Paso 1 — Credenciales de Zoom

1. Ir a [Zoom Marketplace](https://marketplace.zoom.us/develop/create)
2. Seleccionar **Server-to-Server OAuth**
3. Completar los datos de la app
4. Activar estos scopes:
   - `meeting:write:admin`
   - `meeting:read:admin`
5. Copiar `Account ID`, `Client ID` y `Client Secret`

### Paso 2 — Configuración

```bash
cd zoom-booking
cp .env.example .env
# Editar .env con las credenciales de Zoom y JWT_SECRET
```

### Paso 3 — Primer Levantamiento

```bash
docker compose up -d --build
```

Esto crea:
- Base de datos PostgreSQL con las tablas
- API en `http://0.0.0.0:4000`
- Frontend en `http://0.0.0.0:8080`

### Paso 4 — Crear el Admin Inicial

1. Registrarse como profesor desde la web
2. Ejecutar en la terminal:

```bash
docker compose exec postgres psql -U janette -d zoom_booking \
  -c "UPDATE professors SET role='admin' WHERE email='tu@email.com';"
```

### Paso 5 — Agregar Cuenta Zoom

Desde el panel admin, agregar al menos una cuenta Zoom con un label (ej: "Cuenta 1 - Matemática").

---

## Uso del Sistema

### Flujo del Profesor

1. **Registrarte** con email y contraseña
2. **Seleccionar un día** en el calendario (mes actual)
3. **Elegir duración** (30, 45, 60, 90 o 120 minutos)
4. **Indicar el nombre** de la reunión
5. **Confirmar** → el sistema crea el meeting en Zoom automáticamente
6. **Recibir** el link de acceso, la contraseña y el código de reunión
7. **Cancelar** si necesitás, con un clic

### Flujo del Admin

1. **Gestionar cuentas Zoom** — agregar, activar, desactivar o eliminar
2. **Gestionar profesores** — crear, editar roles, activar/inactivar, eliminar
3. **Ver todas las reservas** — filtro por estado, fecha, profesor

---

## Puertos de Acceso

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Frontend web | `8080` | Aplicación React (Nginx) |
| API REST | `4000` | Backend Express |
| PostgreSQL | `5432` | Solo dentro de Docker (interno) |

> **Nota:** Los puertos se configuran en `docker-compose.yml`. Si el 8080 está ocupado, cambiar `8080:80` por otro puerto libre.

---

## Desarrollo Local (sin Docker)

### Backend
```bash
cd backend
npm install
npm run dev          # Levantará en http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # Levantará en http://localhost:5173 con proxy a :4000
```

### Base de datos
```bash
docker compose up -d postgres
```

---

## Producción

```bash
# Reconstruir y levantar
docker compose up -d --build

# Ver logs
docker compose logs -f
docker compose logs -f backend

# Reiniciar
docker compose restart

# Detener todo
docker compose down
```

> **Importante:** Para producción, cambiar `JWT_SECRET`, `DB_PASSWORD` y las credenciales de Zoom. Asegurarse de que `NODE_ENV=production` en el `docker-compose.yml` para deshabilitar `synchronize` de TypeORM.

---

## Estructura del Proyecto

```
zoom-booking/
├── docker-compose.yml          # Orquestación completa
├── .env                        # Variables sensibles (ignorado por git)
├── .env.example                # Plantilla de variables
├── .gitignore
├── README.md
│
├── backend/
│   ├── src/
│   │   ├── index.ts            # Entry point Express
│   │   ├── config/
│   │   │   └── data-source.ts  # Configuración TypeORM
│   │   ├── entities/           # Modelos de datos
│   │   │   ├── Professor.ts
│   │   │   ├── ZoomAccount.ts
│   │   │   └── Booking.ts
│   │   ├── middleware/
│   │   │   └── auth.ts         # JWT + auth
│   │   ├── routes/
│   │   │   ├── auth.ts         # Login / Register
│   │   │   ├── bookings.ts     # CRUD de reservas
│   │   │   ├── zoomAccounts.ts # Gestión de cuentas Zoom
│   │   │   └── admin.ts        # Gestión de profesores
│   │   └── services/
│   │       ├── zoomService.ts  # Integración Zoom API
│   │       └── bookingService.ts # Lógica de reservas
│   ├── Dockerfile
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── index.css
    │   ├── contexts/
    │   │   └── AuthContext.tsx  # Estado de autenticación
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── Register.tsx
    │   │   ├── ProfessorDashboard.tsx  # Calendario + reservas
    │   │   └── AdminDashboard.tsx      # Gestión completa
    │   └── utils/
    │       └── api.ts           # Cliente Axios + tipos
    ├── nginx.conf               # Config Nginx
    ├── Dockerfile
    └── package.json
```

---

## Lógica de Disponibilidad

1. El sistema genera **slots de 30 minutos** en el rango de fechas solicitado.
2. Cada slot se marca como **ocupado** si existe una reserva confirmada o pendiente que se superponga.
3. Al crear una reserva, el sistema busca la **primera cuenta Zoom libre** que no tenga superposición con otras reservas.
4. Si **todas** las cuentas están ocupadas en ese horario, se devuelve un error invitando a probar otro horario.
5. La zona horaria es **UTC-3 (Buenos Aires)** en toda la aplicación.

---

## Seguridad

- Contraseñas hasheadas con **bcrypt** (10 rounds)
- Autenticación por **JWT** con vencimiento en 7 días
- Rate limiting en rutas de autenticación (20 intentos / 15 minutos)
- Middleware de autenticación en todas las rutas protegidas
- Middleware de rol `admin` para rutas administrativas
- Contraseñas de Zoom nunca visibles al profesor (solo el link y password del meeting)
