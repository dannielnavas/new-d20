# DISCORD_ACTIVITY

## Proposito

Documentar la integracion de Discord Embedded App SDK y flujo Activity.

## Prerequisitos

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- Frontend con `discordClientId` y `discordActivityEnabled=true`

## Flujo implementado

1. Frontend inicializa SDK en `DiscordService.init`.
2. Se resuelve contexto `{ instanceId, channelId, guildId }`.
3. Cliente emite `discordActivityReady` por socket.
4. Backend registra participante y emite `discordActivityState`.
5. Al salir de sala, cliente emite `discordActivityLeave`.

## Archivos clave

- `frontend/d20/src/app/services/discord.service.ts`
- `frontend/d20/src/app/components/media/discord-activity-dock.component.ts`
- `backend/src/socket-media.ts`
- `backend/src/discord-auth.ts`

## Endpoint OAuth2

`POST /auth/discord` con body `{ code }`.

## Diagnostico

- Si no entra en Activity:
  - Revisar `discordClientId` en entorno frontend.
- Si no hay participantes:
  - Verificar evento `discordActivityReady` en cliente.
- Si aparece `discordActivityError`:
  - Revisar `roomId/sessionId` y payload enviado.
