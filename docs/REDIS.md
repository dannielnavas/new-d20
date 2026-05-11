# REDIS

## Proposito

Configurar Redis para adapter Socket.IO y cache de estado.

## Activacion

Definir:

```bash
REDIS_URL=redis://localhost:6379
REDIS_SESSION_TTL=86400
```

## Comportamiento

- Si `REDIS_URL` existe y conecta:
  - Activa `@socket.io/redis-adapter`.
  - Sincroniza cache de salas en Redis.
- Si falla:
  - Degrada a single-node sin tumbar backend.

## Claves usadas

- `room:{roomId}` -> snapshot serializado de sala (sin `sessionPasswordHash`).
- `room:{roomId}:version` -> version de sala.

## Orden de restauracion en join

1. Memoria proceso
2. Redis cache (si no requiere hash de sesion faltante)
3. Snapshot de disco
4. Sala por defecto

## Diagnostico

- Comprobar conectividad:

```bash
redis-cli -u "$REDIS_URL" PING
```

- Verificar cache:

```bash
redis-cli -u "$REDIS_URL" KEYS 'room:*'
```
