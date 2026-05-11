# FUNCIONALIDADES

## Proposito

Inventario de funcionalidades implementadas por modulo.

## Backend

- Gestion de salas con `RoomState` en memoria.
- Persistencia JSON con debounce.
- Cache y adapter Redis opcionales.
- Auth DM con JWT.
- OAuth2 Discord (`/auth/discord`).
- API de automatizacion (`/automation/actions`).
- Handlers Socket:
  - Join y presencia
  - Chat
  - Dados
  - Tokens (mover, reclamar, condiciones)
  - Ping de mapa
  - Ajustes DM y spawn NPC/PC
  - Iniciativa
  - Discord Activity state

## Frontend

- Routing Home y PlayRoom.
- Servicios base: socket, room-state, auth DM, theme, discord.
- Componentes principales:
  - Tablero
  - Lobby de personajes
  - Chat
  - Dados
  - Iniciativa
  - HUD DM
  - Presencia
  - Dock Discord
  - Reactions overlay

## Seguridad y permisos

- Roles `dm`, `player`, `spectator`.
- Restriccion de acciones por rol en backend.
- Contraseña de sesion hasheada y no expuesta.

## Estado actual

- Fases 1 a 9 implementadas.
- Fase 10 en curso con tests y docs base.
