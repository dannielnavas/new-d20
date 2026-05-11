# STREAM_DECK

## Proposito

## Endpoint

Headers:

- `x-automation-token: <AUTOMATION_TOKEN>`

- Requiere `AUTOMATION_ENABLED=1`
- Requiere `AUTOMATION_TOKEN`

- Si `AUTOMATION_LOCAL_ONLY=1`, solo loopback
- Requiere DM conectado en la sala

## Acciones soportadas

- `initiative.next`
- `initiative.visibility` `{ visible: boolean }`
- `dice.roll` `{ dieType, mode?, roller? }`

- `media.playPause` `{ enabled? }`

- `map.centerToken` `{ tokenId, x?, y? }`

## Ejemplos cURL

Siguiente turno:

```bash

curl -X POST http://localhost:3000/automation/actions \
  -H 'content-type: application/json' \
  -H 'x-automation-token: local_token' \
  -d '{"action":"initiative.next","roomId":"demo","payload":{}}'
```

Tirar d20 con ventaja:

```bash
curl -X POST http://localhost:3000/automation/actions \
  -H 'content-type: application/json' \
  -H 'x-automation-token: local_token' \
  -d '{"action":"dice.roll","roomId":"demo","payload":{"dieType":"d20","mode":"advantage","roller":"streamdeck"}}'
```
