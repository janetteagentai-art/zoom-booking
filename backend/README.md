# Zoom Booking API — Backend

API REST para gestionar reservas de meetings Zoom. Corre en el puerto `4000` dentro del stack Docker.

---

## Autenticación

Todos los endpoints protegidos requieren un header:

```
Authorization: Bearer <token>
```

Se obtiene del login en `POST /auth/login`.

**Roles:** `professor` (usuario normal) | `admin`

---

## Endpoints

### `GET /health`

Salud del servidor. Útil para verificar que el servicio está arriba.

**Auth:** No

```json
{
  "ok": true,
  "zoomConfigured": false,
  "timezone": "America/Buenos_Aires",
  "timestamp": "2026-04-12T00:15:00.000Z"
}
```

---

### `POST /auth/register`

Registra un nuevo profesor. Devuelve token JWT.

**Auth:** No

```json
{
  "email": "profesor@unmail.com",
  "password": "123456",
  "name": "Juan Pérez"
}
```

**Respuesta `201`:**
```json
{
  "token": "<jwt>",
  "professor": { "id": "uuid", "email": "...", "name": "...", "role": "professor" }
}
```

**Errores:**
- `409` — El email ya está registrado
- `400` — Validación fallida

---

### `POST /auth/login`

Login. Devuelve token JWT.

**Auth:** No

```json
{
  "email": "profesor@unmail.com",
  "password": "123456"
}
```

**Respuesta `200`:**
```json
{
  "token": "<jwt>",
  "professor": { "id": "uuid", "email": "...", "name": "...", "role": "professor" }
}
```

**Errores:**
- `401` — Credenciales inválidas
- `400` — Validación fallida

---

### `GET /auth/me`

Devuelve los datos del usuario autenticado actual.

**Auth:** Sí (cualquier rol)

**Respuesta `200`:**
```json
{
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "professor" }
}
```

---

### `GET /bookings`

Lista reservas. Admin ve todas, professor ve solo las propias. Agregar `?all=true` fuerza vista completa.

**Auth:** Sí

**Query params:**
- `?all=true` — Admin: incluye todas las reservas (no solo propias)

**Respuesta `200`:** Array de bookings

---

### `POST /bookings`

Crea una nueva reserva.

**Auth:** Sí (professor o admin)

```json
{
  "title": "Clase de inglés",
  "startTime": "2026-04-15T10:00:00-03:00",
  "durationMinutes": 60,
  "zoomAccountId": "uuid-opcional"
}
```

**Notas:**
- `startTime` debe ser un string ISO con offset ART (`-03:00`)
- `durationMinutes` entre 15 y 480
- Si no se especifica `zoomAccountId`, se usa el primero disponible

**Respuesta `201`:**
```json
{
  "id": "uuid",
  "title": "Clase de inglés",
  "startTime": "2026-04-15T10:00:00-03:00",
  "durationMinutes": 60,
  "professorId": "uuid",
  "zoomAccountId": "uuid",
  "zoomMeetingId": null,
  "status": "upcoming",
  "joinUrl": null
}
```

**Errores:**
- `400` — Validación fallida / horario no disponible
- `401` — No autenticado

---

### `GET /bookings/availability`

Consulta disponibilidad de horarios.

**Auth:** Sí

**Query params (requeridos):**
- `start` — ISO datetime inicio del rango
- `end` — ISO datetime fin del rango
- `zoomAccountId` — (opcional) UUID de la cuenta Zoom a consultar

**Respuesta `200`:** Array de slots disponibles

---

### `DELETE /bookings/:id`

Cancela una reserva. Solo el profesor propietario o un admin puede cancelarla.

**Auth:** Sí

**Respuesta `200`:**
```json
{ "ok": true }
```

**Errores:**
- `400` — No autorizado o ya cancelada
- `404` — No encontrada

---

### `GET /zoom-accounts`

Lista todas las cuentas Zoom configuradas.

**Auth:** Sí (cualquier rol)

**Respuesta `200`:**
```json
[
  {
    "id": "uuid",
    "label": "Cuenta principal",
    "email": "zoom@unmail.com",
    "isActive": true,
    "color": "#3b82f6"
  }
]
```

---

### `POST /zoom-accounts`

Crea una cuenta Zoom. **Solo admins.**

**Auth:** Sí (admin)

```json
{
  "label": "Cuenta secundario",
  "email": "zoom2@unmail.com",
  "color": "#10b981",
  "zoomAccountId": "oauth-account-id",
  "zoomClientId": "client-id",
  "zoomClientSecret": "client-secret"
}
```

**Respuesta `201`:** La cuenta creada

**Errores:**
- `409` — Esa cuenta de email ya existe
- `400` — Validación fallida

---

### `PATCH /zoom-accounts/:id`

Actualiza una cuenta Zoom. **Solo admins.**

**Auth:** Sí (admin)

```json
{
  "label": "Nuevo nombre",
  "isActive": false
}
```

**Respuesta `200`:** La cuenta actualizada

---

### `DELETE /zoom-accounts/:id`

Elimina una cuenta Zoom. **Solo admins.**

**Auth:** Sí (admin)

**Respuesta `200`:**
```json
{ "ok": true }
```

---

### `GET /admin/professors`

Lista todos los profesores. **Solo admins.**

**Auth:** Sí (admin)

**Respuesta `200`:**
```json
[
  {
    "id": "uuid",
    "email": "prof@unmail.com",
    "name": "Juan Pérez",
    "role": "professor",
    "isActive": true,
    "createdAt": "2026-04-01T..."
  }
]
```

---

### `POST /admin/professors`

Crea un profesor manualmente. **Solo admins.**

**Auth:** Sí (admin)

```json
{
  "email": "nuevo@unmail.com",
  "password": "123456",
  "name": "María García",
  "role": "professor"
}
```

**Respuesta `201`:**
```json
{ "id": "uuid", "email": "...", "name": "...", "role": "professor" }
```

**Errores:**
- `409` — El email ya existe

---

### `PATCH /admin/professors/:id`

Actualiza un profesor (nombre, rol, estado). **Solo admins.**

**Auth:** Sí (admin)

```json
{
  "name": "Nuevo nombre",
  "role": "admin",
  "isActive": false
}
```

**Respuesta `200`:**
```json
{ "id": "...", "email": "...", "name": "...", "role": "admin", "isActive": false }
```

---

### `DELETE /admin/professors/:id`

Elimina un profesor. **Solo admins.** No se puede eliminar un admin.

**Auth:** Sí (admin)

**Respuesta `200`:**
```json
{ "ok": true }
```

**Errores:**
- `400` — No se puede eliminar un admin
- `404` — No encontrado

---

## Variables de Entorno

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto del servidor | `4000` |
| `DB_HOST` | Host de PostgreSQL | `postgres` |
| `DB_PORT` | Puerto de PostgreSQL | `5432` |
| `DB_NAME` | Nombre de la base | `zoom_booking` |
| `DB_USER` | Usuario de PostgreSQL | `janette` |
| `DB_PASSWORD` | Contraseña de PostgreSQL | `changeme` |
| `JWT_SECRET` | Secreto para firmar JWTs | `zoom_booking_change_me_in_production` |
| `ZOOM_ACCOUNT_ID` | OAuth Account ID de Zoom | — |
| `ZOOM_CLIENT_ID` | OAuth Client ID de Zoom | — |
| `ZOOM_CLIENT_SECRET` | OAuth Client Secret de Zoom | — |
| `TZ` | Timezone | `America/Buenos_Aires` |

---

## Rate Limiting

- `/auth/*`: máximo 20 requests cada 15 minutos por IP
