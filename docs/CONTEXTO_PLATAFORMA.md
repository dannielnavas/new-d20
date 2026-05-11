# CONTEXTO_PLATAFORMA

## Vision

d20 VTT es una mesa virtual ligera para partidas de rol en tiempo real, con foco en flujo rapido para DM y jugadores.

## Roles

- DM: control total de sala, mapa, spawn, iniciativa y configuracion.
- Player: chat, dados, control de su PC reclamada.
- Spectator: lectura de estado sin mutaciones.

## Objetivos del producto

- Latencia baja en interacciones de tablero.
- Reconexion y continuidad de sesiones.
- Seguridad por rol para evitar mutaciones indebidas.
- Integracion media con Discord sin WebRTC propio.

## Experiencia de uso

1. Entrar a Home.
2. Abrir sala `/play/:roomId`.
3. DM autentica y configura mesa.
4. Jugadores reclaman PC y juegan en tiempo real.
5. DM usa automatizacion opcional (Stream Deck) para agilizar combate.

## Alcance tecnico

- Monorepo con frontend Angular y backend Express+Socket.IO.
- Persistencia local por snapshot y opcion de escalado con Redis.
