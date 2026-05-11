# SOCKET_EVENTS

## Proposito

Referencia de eventos Socket.IO implementados actualmente.

## Cliente -> Servidor

- `joinRoom` `{ roomId, dmToken?, playerSessionId?, sessionPassword?, spectator? }`
- `chatMessage` `{ text }`
- `diceRoll` `{ dieType, mode? }`
- `diceLogReset` `void`
- `tokenMove` `{ tokenId, x, y }`
- `tokenMoveEnd` `{ tokenId, x, y }`
- `claimPc` `{ tokenId }`
- `tokenSetConditions` `{ tokenId, conditions }`
- `mapPing` `{ x, y }`
- `updateRoomSettings` `Partial<RoomSettings>`
- `setSessionPassword` `{ password: string | null }`
- `spawnNpc` `{ name?, x?, y? }`
- `spawnPc` `{ names: string[] }`
- `initiativeSetModifier` `{ tokenId, modifier }`
- `initiativeRollAll` `void`
- `initiativeNext` `void`
- `initiativeMove` `{ fromIndex, toIndex }`
- `initiativeSetCurrent` `{ index }`
- `initiativeToggleVisibility` `void`
- `discordActivityReady` `{ instanceId, channelId, guildId? }`
- `discordActivityLeave` `void`

## Servidor -> Cliente

- `sessionState` `{ role, claimedTokenId? }`
- `roomState` `RoomState` (sin `sessionPasswordHash`)
- `roomError` `{ code, message }`
- `tokenError` `{ code, message }`
- `claimError` `{ code, message }`
- `dmError` `{ code, message }`
- `diceRolled` `DiceEntry`
- `tokenMove` `{ tokenId, x, y }`
- `tokenMoveEnd` `{ tokenId, x, y }`
- `mapPing` `{ x, y, by, ts }`
- `discordActivityState` `{ instanceId?, channelId?, participants }`
- `discordActivityError` `{ code, message }`

## Notas

- `tokenMove`, `chatMessage` y `mapPing` tienen rate limiting.
- Eventos DM requieren rol `dm` en backend.
