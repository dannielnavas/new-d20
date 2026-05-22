# STREAM_DECK

## Proposito

Permitir que el Dungeon Master (DM) controle aspectos clave de la sesión de juego de mesa virtual (VTT) utilizando un dispositivo físico o emulado de Stream Deck u otra herramienta de automatización HTTP.

## Endpoint

`POST http://localhost:3000/automation/actions`

Headers:

- `x-automation-token: <AUTOMATION_TOKEN>`

Requisitos:

- `AUTOMATION_ENABLED=1` configurado en el backend
- `AUTOMATION_TOKEN` configurado con un valor secreto
- Si `AUTOMATION_LOCAL_ONLY=1`, solo se aceptan llamadas loopback (localhost)
- Requiere que el DM esté conectado a la sala para poder invocar cualquier acción

## Acciones soportadas

### Turnos e Iniciativa

- `initiative.rollAll`: Lanza iniciativa para todos los personajes de la sala de forma automática usando 1d20 + modificador guardado.
- `initiative.next`: Pasa el turno al siguiente token en el orden de iniciativa.
- `initiative.visibility` `{ visible: boolean }`: Cambia la visibilidad del panel de iniciativa para los jugadores.

### Dados

- `dice.resetLog`: Limpia todo el historial de tiradas de la sala.
- `dice.roll` `{ dieType, mode?, count?, secret?, roller? }`: Lanza dados.
  - `dieType`: `"d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100"` (Requerido)
  - `mode`: `"normal" | "advantage" | "disadvantage"` (Opcional, por defecto `"normal"`)
  - `count`: `number` (Opcional, entre 1 y 4)
  - `secret`: `boolean` (Opcional, si es `true` la tirada solo la verá el DM)
  - `roller`: `string` (Opcional, etiqueta para quién tira)

### Multimedia / Sonido

- `media.playPause` `{ enabled? }`: Pausa/despausa la música o sonido de fondo.
- `media.volume` `{ volume: number }`: Cambia el volumen del mapa (0-100).

### Tablero y Fichas (Tokens)

- `map.centerToken` `{ tokenId, x?, y? }`: Mueve/centra una ficha específica en unas coordenadas.
- `tokens.spawnNpc` `{ name?, imageUrl?, x?, y? }`: Crea un nuevo NPC en el tablero.
- `tokens.spawnPc` `{ names: string[], imageUrl? }`: Crea uno o más personajes (PC) en el tablero.
- `tokens.remove` `{ tokenId }`: Elimina una ficha del tablero (y de la iniciativa).
- `tokens.updateStats` `{ tokenId, hp?, maxHp?, ac?, frameColor?, size? }`: Actualiza estadísticas y apariencia de la ficha.
- `tokens.setConditions` `{ tokenId, conditions: string[] }`: Sobrescribe las condiciones/estados activos de la ficha.
- `tokens.toggleCondition` `{ tokenId, condition }`: Activa o desactiva un estado específico (ej. `"Envenenado"`, `"Derribado"`).

## Ejemplos cURL

Siguiente turno:

```bash
curl -X POST http://localhost:3000/automation/actions \
  -H 'content-type: application/json' \
  -H 'x-automation-token: local_token' \
  -d '{"action":"initiative.next","roomId":"demo","payload":{}}'
```

Lanzar iniciativa para todos:

```bash
curl -X POST http://localhost:3000/automation/actions \
  -H 'content-type: application/json' \
  -H 'x-automation-token: local_token' \
  -d '{"action":"initiative.rollAll","roomId":"demo","payload":{}}'
```

Tirar 2d6 secreto (solo DM):

```bash
curl -X POST http://localhost:3000/automation/actions \
  -H 'content-type: application/json' \
  -H 'x-automation-token: local_token' \
  -d '{"action":"dice.roll","roomId":"demo","payload":{"dieType":"d6","count":2,"secret":true,"roller":"StreamDeck DM"}}'
```

Crear un NPC:

```bash
curl -X POST http://localhost:3000/automation/actions \
  -H 'content-type: application/json' \
  -H 'x-automation-token: local_token' \
  -d '{"action":"tokens.spawnNpc","roomId":"demo","payload":{"name":"Orco de Stream Deck","x":800,"y":450}}'
```

Togglear estado Envenenado en una ficha:

```bash
curl -X POST http://localhost:3000/automation/actions \
  -H 'content-type: application/json' \
  -H 'x-automation-token: local_token' \
  -d '{"action":"tokens.toggleCondition","roomId":"demo","payload":{"tokenId":"<token-id>","condition":"Envenenado"}}'
```
