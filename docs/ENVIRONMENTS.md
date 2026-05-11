# ENVIRONMENTS

## Proposito

Centralizar variables de entorno de backend y configuracion de frontend.

## Backend

```bash
PORT=3000
DM_SECRET=change_me_with_a_long_secret
JWT_SECRET=change_me_with_a_long_secret
CLIENT_ORIGIN=http://localhost:4200
PERSISTENCE_PATH=backend/data/vtt-snapshot.json
REDIS_URL=
REDIS_SESSION_TTL=86400
AUTOMATION_ENABLED=0
AUTOMATION_TOKEN=
AUTOMATION_LOCAL_ONLY=1
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_REDIRECT_URI=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=d20-vtt/tokens
```

## Frontend

Las variables de frontend se definen en:

- `frontend/d20/src/environments/environment.ts`
- `frontend/d20/src/environments/environment.prod.ts`

Valores actuales base:

- `apiUrl`: `http://localhost:3000`
- `socketUrl`: `http://localhost:3000`
- `discordClientId`: vacio por defecto
- `discordActivityEnabled`: `false` por defecto

## Recomendaciones

- Usar secretos distintos para `DM_SECRET` y `JWT_SECRET`.
- En produccion usar `AUTOMATION_LOCAL_ONLY=1` salvo necesidad explicita.
- No exponer `DISCORD_CLIENT_SECRET` al frontend.
- No exponer `CLOUDINARY_API_SECRET` al frontend.
