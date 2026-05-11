# ARCHITECTURE

## Proposito

Definir la arquitectura tecnica de d20 VTT y el flujo principal de datos entre frontend y backend.

## Vista general

- Frontend Angular 21 en `frontend/d20`
- Backend Express 5 + Socket.IO en `backend`
- Persistencia primaria en JSON de disco
- Persistencia secundaria y bus de eventos en Redis (opcional)
- Voz y video delegados a Discord Activity

## Diagrama de alto nivel

```text
Angular Client <--> Socket.IO <--> Express API
      |                              |
      |                              +--> JSON snapshot (disk)
      |                              +--> Redis adapter/cache (optional)
      |
      +--> Discord Embedded SDK <--> Discord Voice Channel
```

## Flujo de sala

1. Cliente abre `/play/:roomId`.
2. Cliente emite `joinRoom` con rol y sesion.
3. Backend restaura sala (Redis -> disco -> default).
4. Backend emite `sessionState` y `roomState`.
5. Eventos de juego mutan `RoomState` y se emite snapshot nuevo.
6. Persistencia diferida guarda en JSON y, si aplica, cache Redis.

## Seguridad

- DM autenticado con JWT (`/auth/dm`).
- Permisos por rol en cada handler de socket.
- Contraseña de sesion hasheada (`sessionPasswordHash`) y nunca expuesta al cliente.
- Rate limiting en eventos sensibles (`tokenMove`, `chatMessage`, `mapPing`).

## Decisiones clave

- `RoomState` como estado canonico de sala.
- Broadcast con versionado (`roomVersion`) para sincronizacion consistente.
- Discord solo como capa de media; backend no almacena tokens Discord.
