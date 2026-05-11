# d20 VTT — Instrucciones para GitHub Copilot

## Descripción del proyecto

**d20** es una plataforma VTT (Virtual Tabletop) ligera y en tiempo real para dirigir partidas de rol con tablero compartido, fichas, chat, dados, audio/vídeo y herramientas de conducción de mesa.

El proyecto es un monorepo con dos aplicaciones:

- `frontend/`: interfaz web construida con **Angular 21** + Tailwind CSS v4.
- `backend/`: servidor **Express 5** + **Socket.IO** que coordina estado, permisos, persistencia y comunicación en tiempo real.
- `docs/`: documentación técnica del proyecto (despliegue, entornos, arquitectura, eventos, runbook, etc.).

Las llamadas de voz y vídeo entre los participantes se delegan a **Discord** mediante el **Discord Embedded App SDK**. La aplicación puede ejecutarse como una **Discord Activity** dentro de un canal de voz, y también ofrece un botón para invitar a la mesa a un canal de Discord externo.

---

## Stack tecnológico

### Frontend (`frontend/`)

| Tecnología                | Versión | Uso                            |
| ------------------------- | ------- | ------------------------------ |
| Angular                   | ^21.x   | Framework principal            |
| Angular Router            | ^21.x   | Navegación y rutas             |
| Angular Signals           | ^21.x   | Gestión de estado reactivo     |
| Tailwind CSS              | ^4.x    | Estilos utilitarios            |
| socket.io-client          | ^4.x    | Comunicación en tiempo real    |
| @discord/embedded-app-sdk | ^2.x    | Discord Activity / voz y vídeo |
| TypeScript                | ~6.x    | Lenguaje base                  |
| Vitest                    | ^4.x    | Testing unitario               |
| ESLint                    | ^9.x    | Linting                        |

### Backend (`backend/`)

| Tecnología               | Versión | Uso                                |
| ------------------------ | ------- | ---------------------------------- |
| Node.js                  | >=20    | Runtime                            |
| Express                  | ^5.x    | Servidor HTTP                      |
| Socket.IO                | ^4.x    | WebSockets en tiempo real          |
| @socket.io/redis-adapter | ^8.x    | Escalado horizontal (opcional)     |
| Redis                    | ^5.x    | Adapter para múltiples instancias  |
| jose                     | ^6.x    | Firma y verificación JWT           |
| zod                      | ^4.x    | Validación de payloads             |
| undici / node-fetch      | —       | Llamadas HTTP a la API de Discord  |
| tsx                      | ^4.x    | Ejecución TypeScript en desarrollo |
| TypeScript               | ^6.x    | Lenguaje base                      |
| Vitest                   | ^4.x    | Testing unitario                   |

### Herramientas de monorepo (raíz)

- `concurrently` — levanta server y client en paralelo con `npm run dev`.
- `husky` + `lint-staged` — hooks de pre-commit.
- `commitlint` — mensajes de commit en formato conventional commits.
- `prettier` — formateo uniforme.

---

## Estructura de carpetas

```
d20/
├── frontend/                      # Frontend Angular 21
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.config.ts      # Bootstrap standalone
│   │   │   ├── app.routes.ts      # Rutas principales
│   │   │   ├── pages/
│   │   │   │   ├── home/          # Landing page
│   │   │   │   └── play-room/     # Sala de juego principal
│   │   │   ├── components/
│   │   │   │   ├── board/         # Tablero, tokens, cuadrícula, ping
│   │   │   │   ├── chat/          # Chat y log de actividad
│   │   │   │   ├── dice/          # Panel de dados
│   │   │   │   ├── dm/            # HUD del Narrador
│   │   │   │   ├── initiative/    # Panel de iniciativa
│   │   │   │   ├── lobby/         # Lobby de personajes
│   │   │   │   ├── media/         # Integración Discord Activity (voz/vídeo)
│   │   │   │   ├── player/        # Información de jugador
│   │   │   │   ├── poll/          # Encuestas grupales
│   │   │   │   ├── reactions/     # Reacciones de pantalla y token
│   │   │   │   ├── reveal/        # Revelado progresivo de imagen
│   │   │   │   ├── timer/         # Temporizador de turno
│   │   │   │   ├── loading-screen/
│   │   │   │   └── theme-toggle/
│   │   │   ├── services/
│   │   │   │   ├── socket.service.ts      # Conexión Socket.IO
│   │   │   │   ├── room-state.service.ts  # Estado de sala (Signals)
│   │   │   │   ├── dm-auth.service.ts     # Autenticación DM / JWT
│   │   │   │   ├── discord.service.ts     # Discord SDK + OAuth2
│   │   │   │   └── theme.service.ts       # Tema claro/oscuro
│   │   │   ├── config/
│   │   │   │   ├── token-conditions.ts
│   │   │   │   ├── token-frame-colors.ts
│   │   │   │   └── token-reactions.ts
│   │   │   └── types/             # Interfaces TypeScript (espejo de backend/src/types.ts)
│   │   ├── environments/
│   │   │   ├── environment.ts     # Desarrollo
│   │   │   └── environment.prod.ts # Producción
│   │   ├── assets/
│   │   ├── styles.css             # Tailwind + variables CSS personalizadas
│   │   └── main.ts
│   ├── angular.json
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                       # Backend Express + Socket.IO
│   ├── data/
│   │   └── vtt-snapshot.json      # Snapshot de salas (generado en runtime)
│   └── src/
│       ├── index.ts               # HTTP + Socket.IO + carga snapshot
│       ├── types.ts               # RoomState, Token, etc.
│       ├── rooms.ts               # Mapa en memoria de salas
│       ├── room-broadcast.ts      # Emisión roomState con roomVersion
│       ├── persistence.ts         # Guardado/carga JSON debounced
│       ├── redis-adapter.ts       # Adapter Redis opcional
│       ├── rate-limit.ts          # Rate limiting por socket/evento
│       ├── auth-dm.ts             # Endpoint POST /auth/dm
│       ├── discord-auth.ts        # OAuth2 Discord: intercambio de código por token
│       ├── automation.ts          # API Stream Deck / scripts
│       ├── cors-config.ts
│       ├── join-handlers.ts       # Lógica de unión DM/jugador/espectador
│       ├── on-disconnect.ts
│       ├── activity-log.ts
│       ├── initiative-sync.ts
│       ├── socket-chat.ts
│       ├── socket-dice.ts
│       ├── socket-dm.ts
│       ├── socket-tokens.ts
│       ├── socket-map-ping.ts
│       ├── socket-map-tools.ts
│       ├── socket-poll.ts
│       ├── socket-timer.ts
│       ├── socket-raise-hand.ts
│       ├── socket-roll-request.ts
│       ├── socket-screen-reaction.ts
│       ├── socket-token-reaction.ts
│       ├── socket-private-notes.ts
│       ├── socket-image-reveal.ts
│       ├── socket-media.ts        # Señalización Discord Activity (channel sync)
│       └── socket-guards.ts
│
├── docs/                          # Documentación técnica del proyecto
│   ├── ARCHITECTURE.md            # Diagrama de arquitectura y decisiones de diseño
│   ├── DEPLOYMENT.md              # Guía de despliegue (local, Docker, producción)
│   ├── ENVIRONMENTS.md            # Variables de entorno frontend y backend
│   ├── RUNBOOK.md                 # Operación: arranque, parada, incidentes
│   ├── SOCKET_EVENTS.md           # Referencia completa de eventos Socket.IO
│   ├── STREAM_DECK.md             # Integración Stream Deck / automatización
│   ├── DISCORD_ACTIVITY.md        # Configuración Discord Embedded App SDK
│   ├── REDIS.md                   # Configuración Redis y persistencia
│   ├── FUNCIONALIDADES.md         # Inventario de funcionalidades por módulo
│   └── CONTEXTO_PLATAFORMA.md     # Visión general del producto y roles
│
└── package.json                   # Scripts raíz del monorepo
```

---

## Convenciones Angular 21

### Estilo de componentes

- Usar **componentes standalone** (`standalone: true`) en todos los componentes.
- Usar **Angular Signals** (`signal()`, `computed()`, `effect()`) para estado reactivo en lugar de RxJS cuando sea posible.
- Usar `inject()` en lugar de inyección por constructor cuando convenga.
- Usar `input()` y `output()` signal-based en lugar de `@Input()` / `@Output()`.
- Usar `OnPush` como estrategia de detección de cambios por defecto.
- Los componentes de contenedor (páginas) suscriben los observables de Socket.IO; los componentes presentacionales solo reciben `input()`.

### Servicios

- Los servicios son `providedIn: 'root'` salvo que necesiten scope específico.
- El estado de sala se gestiona en `RoomStateService` con `signal<RoomState | null>`.
- `SocketService` expone observables tipados por evento (usando `fromEvent` de `socket.io-client`).

### Rutas

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: "", loadComponent: () => import("./pages/home/home.component") },
  {
    path: "play/:roomId",
    loadComponent: () => import("./pages/play-room/play-room.component"),
  },
  { path: "**", redirectTo: "" },
];
```

### Estructura de un componente tipo

```typescript
@Component({
  selector: "app-dice-panel",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./dice-panel.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DicePanelComponent {
  private socket = inject(SocketService);
  diceLog = input<DiceEntry[]>([]);
  selectedDie = signal<DieType>("d20");
  mode = signal<RollMode>("normal");

  roll() {
    this.socket.emit("diceRoll", { dieType: this.selectedDie(), mode: this.mode() });
  }
}
```

### Estilos

- Tailwind CSS v4 con clases utilitarias.
- Variables CSS personalizadas con prefijo `--vtt-` para tokens de diseño.
- Clases de componente base: `vtt-panel`, `vtt-panel-header`, `vtt-btn-primary`, `vtt-btn-secondary`, `vtt-btn-ghost`, `vtt-input`, `vtt-pill`, `vtt-status-dot`, `vtt-toast`.
- Layout principal: `vtt-page-shell`.

---

## Roles y permisos

| Rol         | Acceso                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------- |
| `dm`        | Control total: mapa, fichas, iniciativa, herramientas, configuración, elenco, encuestas, etc. |
| `player`    | Solo su ficha PC reclamada, chat, dados, reacciones, mano levantada.                          |
| `spectator` | Solo lectura: mapa, chat, iniciativa (si visible), log de dados.                              |

### Autenticación DM

- Query param `?role=dm&key=<dmKey>`.
- El frontend llama `POST /auth/dm` con `{ dmKey }` y guarda el JWT en `sessionStorage`.
- El JWT se envía en `joinRoom` como `dmToken`.

### Jugador

- `playerSessionId` generado en `localStorage` (UUID persistente).
- Se envía en `joinRoom`; el servidor reenlaza el socket al mismo PC si estaba reclamado.

### Espectador

- Query param `?spectator=1`.
- No mueve fichas, no escribe en chat, no puede hacer ping en el mapa.

---

## Modelo de datos principal (`RoomState`)

```typescript
interface RoomState {
  roomId: string;
  roomVersion: number;
  sessionPasswordConfigured: boolean;
  settings: {
    backgroundUrl: string;
    backgroundType: "image" | "video" | "youtube";
    gridSize: number;
    snapToGrid: boolean;
    playersCanPing: boolean;
    mapAudioEnabled: boolean;
    mapVolume: number; // 0–100
  };
  tokens: Token[]; // PCs y NPCs
  chatLog: ChatEntry[];
  activityLog: ActivityEntry[];
  diceLog: DiceEntry[];
  initiative: InitiativeState;
  // Además: presencia, reacciones, encuestas, notas privadas,
  // temporizador, solicitudes de tirada, reveal de imagen.
}

interface Token {
  id: string;
  type: "pc" | "npc";
  name: string;
  x: number;
  y: number;
  size: number;
  claimedBy?: string; // playerSessionId
  conditions: string[]; // máx. 6
  frameColor?: string;
  reaction?: string;
}
```

Los tipos completos viven en `backend/src/types.ts`; el cliente tiene un espejo en `frontend/src/app/types/room.ts`.

---

## Eventos Socket.IO

### Cliente → Servidor

| Evento                       | Payload                                                                        | Permisos                           |
| ---------------------------- | ------------------------------------------------------------------------------ | ---------------------------------- |
| `joinRoom`                   | `{ roomId, dmToken?, dmKey?, playerSessionId?, sessionPassword?, spectator? }` | Todos                              |
| `tokenMove`                  | `{ tokenId, x, y }`                                                            | DM / jugador (su PC)               |
| `tokenMoveEnd`               | `{ tokenId, x, y }`                                                            | DM / jugador (su PC)               |
| `claimPc`                    | `{ tokenId }`                                                                  | Jugador                            |
| `diceRoll`                   | `{ dieType, mode }`                                                            | DM / jugador con PC                |
| `diceLogReset`               | —                                                                              | Solo DM                            |
| `chatMessage`                | `{ text }`                                                                     | DM / jugador                       |
| `mapPing`                    | `{ x, y }`                                                                     | DM / jugador (si `playersCanPing`) |
| `updateRoomSettings`         | `Partial<RoomSettings>`                                                        | Solo DM                            |
| `setSessionPassword`         | `{ password: string \| null }`                                                 | Solo DM                            |
| `spawnNpc`                   | `{ name?, x, y }`                                                              | Solo DM                            |
| `spawnPc`                    | `{ names: string[] }` (máx. 12)                                                | Solo DM                            |
| `tokenSetConditions`         | `{ tokenId, conditions: string[] }`                                            | DM o jugador (su PC)               |
| `initiativeRollAll`          | —                                                                              | Solo DM                            |
| `initiativeSetModifier`      | `{ tokenId, modifier: number }`                                                | Solo DM                            |
| `initiativeNext`             | —                                                                              | Solo DM                            |
| `initiativeMove`             | `{ fromIndex, toIndex }`                                                       | Solo DM                            |
| `initiativeSetCurrent`       | `{ index: number }`                                                            | Solo DM                            |
| `initiativeToggleVisibility` | —                                                                              | Solo DM                            |
| `pollStart`                  | `{ question, options: string[] }`                                              | Solo DM                            |
| `pollVote`                   | `{ pollId, optionIndex }`                                                      | Jugador                            |
| `pollClose`                  | `{ pollId }`                                                                   | Solo DM                            |
| `raiseHandSet`               | `{ raised: boolean }`                                                          | Jugador                            |
| `rollRequestCreate`          | `{ targetSessionId, description }`                                             | Solo DM                            |
| `rollRequestResolve`         | `{ requestId, dieType, mode }`                                                 | Jugador                            |
| `timerStart`                 | `{ durationMs: number }`                                                       | Solo DM                            |
| `timerPause`                 | —                                                                              | Solo DM                            |
| `timerResume`                | —                                                                              | Solo DM                            |
| `timerStop`                  | —                                                                              | Solo DM                            |
| `screenReactionSend`         | `{ emoji: string }`                                                            | Todos                              |
| `tokenReactionSet`           | `{ tokenId, reaction: string \| null }`                                        | DM / jugador (su PC)               |
| `imageRevealStart`           | `{ imageUrl, mask? }`                                                          | Solo DM                            |
| `imageRevealUpdate`          | `{ progress: number }`                                                         | Solo DM                            |
| `imageRevealFinish`          | —                                                                              | Solo DM                            |
| `privateNoteSet`             | `{ targetId, text }`                                                           | DM / jugador                       |
| `privateNoteDelete`          | `{ targetId }`                                                                 | DM / jugador                       |
| `discordActivityReady`       | `{ instanceId, channelId, guildId }`                                           | Todos                              |
| `discordActivityLeave`       | —                                                                              | Todos                              |

### Servidor → Cliente

| Evento                 | Contenido                                                    |
| ---------------------- | ------------------------------------------------------------ |
| `roomState`            | `RoomState` público (sin `ownerSocket`)                      |
| `sessionState`         | `{ role: 'dm' \| 'player' \| 'spectator', claimedTokenId? }` |
| `roomError`            | `{ code, message }`                                          |
| `tokenError`           | `{ code, message }`                                          |
| `claimError`           | `{ code, message }`                                          |
| `dmError`              | `{ code, message }`                                          |
| `diceRolled`           | `DiceEntry`                                                  |
| `tokenMove`            | `{ tokenId, x, y }`                                          |
| `tokenMoveEnd`         | `{ tokenId, x, y }`                                          |
| `mapPing`              | `{ x, y, by, ts }`                                           |
| `discordActivityState` | `{ instanceId, channelId, participants: string[] }`          |
| `discordActivityError` | `{ code, message }`                                          |

---

## API HTTP (servidor)

| Método | Ruta                  | Descripción                                                          |
| ------ | --------------------- | -------------------------------------------------------------------- |
| GET    | `/`                   | Info del servicio (HTML o JSON según `Accept`)                       |
| GET    | `/health`             | `{ ok: true, service: 'd20-vtt' }`                                   |
| POST   | `/auth/dm`            | Body `{ dmKey }` → `{ token, expiresIn }` (JWT de DM)                |
| POST   | `/auth/discord`       | Body `{ code }` → `{ access_token, user }` (OAuth2 Discord)          |
| POST   | `/automation/actions` | Automatización Stream Deck (requiere `AUTOMATION_ENABLED=1` y token) |

### Acciones de automatización soportadas

Body base de todas las peticiones:

```json
{
  "action": "<nombre_acción>",
  "roomId": "demo",
  "payload": {}
}
```

Header requerido: `x-automation-token: <AUTOMATION_TOKEN>`

| Acción                  | Payload                                                                                                                     | Notas                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `initiative.next`       | `{}`                                                                                                                        | Avanza al siguiente turno de iniciativa     |
| `initiative.visibility` | `{ visible: boolean }`                                                                                                      | Muestra u oculta el orden de iniciativa     |
| `dice.roll`             | `{ dieType: 'd4'\|'d6'\|'d8'\|'d10'\|'d12'\|'d20'\|'d100', mode?: 'normal'\|'advantage'\|'disadvantage', roller?: string }` | `mode` solo aplica en d20                   |
| `media.playPause`       | `{ enabled?: boolean }`                                                                                                     | Si no se envía `enabled`, alterna el estado |
| `media.volume`          | `{ volume: number }` (0–100)                                                                                                | Ajusta volumen del audio del mapa           |
| `map.centerToken`       | `{ tokenId: string, x?: number, y?: number }`                                                                               | Si omites `x`/`y` usa centro (800, 450)     |

### Restricciones de seguridad

- `AUTOMATION_LOCAL_ONLY=1` restringe el endpoint a peticiones desde loopback (recomendado en producción).
- El servidor valida el header `x-automation-token` antes de ejecutar cualquier acción.
- Todas las acciones requieren que el **DM esté conectado** en la sala indicada.
- La API devuelve `{ ok: true }` al aplicar la acción, o un error HTTP con `{ code, message }`.

### Ejemplo cURL

```bash
curl -X POST "http://localhost:3000/automation/actions" \
  -H "content-type: application/json" \
  -H "x-automation-token: tu_token_largo" \
  -d '{"action":"initiative.next","roomId":"demo","payload":{}}'
```

### Botones recomendados para Stream Deck

| Botón                 | Acción                  | Payload                                     |
| --------------------- | ----------------------- | ------------------------------------------- |
| Siguiente turno       | `initiative.next`       | `{}`                                        |
| Mostrar iniciativa    | `initiative.visibility` | `{ "visible": true }`                       |
| Ocultar iniciativa    | `initiative.visibility` | `{ "visible": false }`                      |
| Tirar d20 normal      | `dice.roll`             | `{ "dieType": "d20", "mode": "normal" }`    |
| Tirar d20 con ventaja | `dice.roll`             | `{ "dieType": "d20", "mode": "advantage" }` |
| Toggle audio mapa     | `media.playPause`       | `{}`                                        |
| Volumen 50%           | `media.volume`          | `{ "volume": 50 }`                          |

---

## Variables de entorno

### Servidor

| Variable                | Descripción                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `PORT`                  | Puerto HTTP (por defecto `3000`)                                      |
| `DM_SECRET`             | Clave DM y firma JWT (si no hay `JWT_SECRET`)                         |
| `JWT_SECRET`            | Firma separada para JWT de DM (opcional)                              |
| `CLIENT_ORIGIN`         | Orígenes CORS del frontend (lista separada por comas)                 |
| `PERSISTENCE_PATH`      | Ruta del JSON de salas (default `backend/data/vtt-snapshot.json`)     |
| `REDIS_URL`             | Activa adapter Redis para Socket.IO multi-instancia y caché de estado |
| `REDIS_SESSION_TTL`     | TTL en segundos para snapshots de sala en Redis (default `86400`)     |
| `AUTOMATION_ENABLED`    | `1` para activar la API de automatización                             |
| `AUTOMATION_TOKEN`      | Token secreto para la API de automatización                           |
| `AUTOMATION_LOCAL_ONLY` | `1` para restringir la automatización a loopback                      |
| `DISCORD_CLIENT_ID`     | Client ID de la aplicación Discord                                    |
| `DISCORD_CLIENT_SECRET` | Client Secret para OAuth2 de Discord                                  |
| `DISCORD_BOT_TOKEN`     | Token del bot de Discord (opcional, para gestionar canales de voz)    |

### Cliente (Angular `environment.ts`)

| Variable                 | Descripción                                                   |
| ------------------------ | ------------------------------------------------------------- |
| `apiUrl`                 | URL base del servidor (`http://localhost:3000`)               |
| `socketUrl`              | URL del servidor Socket.IO                                    |
| `discordClientId`        | Client ID de la aplicación Discord (Discord Developer Portal) |
| `discordActivityEnabled` | `true` para activar el modo Discord Activity                  |

---

## Persistencia y Redis

### Capas de persistencia

El servidor mantiene dos capas de persistencia independientes:

| Capa           | Mecanismo                        | Cuándo se usa                                                                         |
| -------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| **Primaria**   | JSON en disco (`persistence.ts`) | Siempre; snapshot debounced y en apagado SIGINT/SIGTERM                               |
| **Secundaria** | Redis (`redis-adapter.ts`)       | Cuando `REDIS_URL` está definida; replica eventos entre nodos y cachea estado de sala |

### Persistencia JSON (disco)

- Archivo: `backend/data/vtt-snapshot.json` (ruta configurable con `PERSISTENCE_PATH`).
- Guardado **diferido**: `broadcastRoomState` programa una escritura con debounce para no saturar disco en eventos de alta frecuencia (`tokenMove`).
- Guardado **inmediato** al recibir `SIGINT` / `SIGTERM`.
- Al arrancar, `index.ts` carga el snapshot y reconstituye todas las salas en memoria.
- **No** incluye tokens de sesión, `ownerSocket` ni `sessionPasswordHash` en texto plano; las contraseñas se guardan como hash.

### Redis

Redis cumple dos roles cuando `REDIS_URL` está definida:

#### 1. Adapter de Socket.IO (eventos entre nodos)

```typescript
// backend/src/redis-adapter.ts
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

export async function applyRedisAdapter(io: Server): Promise<void> {
  const pub = createClient({ url: process.env.REDIS_URL });
  const sub = pub.duplicate();
  await Promise.all([pub.connect(), sub.connect()]);
  io.adapter(createAdapter(pub, sub));
}
```

- Replica los eventos de Socket.IO entre todas las instancias del servidor.
- El estado de sala sigue en memoria de cada proceso; Redis solo replica **eventos**, no estado.
- Si la conexión falla, el servidor arranca en modo **una sola instancia** y registra un aviso.

#### 2. Caché de estado de sala

- Clave: `room:{roomId}` — snapshot JSON del `RoomState` serializado.
- TTL configurable con `REDIS_SESSION_TTL` (default 86400 s = 24 h).
- Flujo de escritura: `broadcastRoomState` → debounce → `persistence.ts` guarda en disco **y** actualiza clave Redis.
- Flujo de lectura: al unirse a una sala, si no hay estado en memoria, se intenta restaurar desde Redis antes de leer el JSON de disco.
- Las claves expiran automáticamente; no se necesita limpieza manual.

#### Estructura de claves Redis

| Clave                   | Tipo   | Contenido                                                                | TTL                 |
| ----------------------- | ------ | ------------------------------------------------------------------------ | ------------------- |
| `room:{roomId}`         | string | `JSON.stringify(RoomState)` (sin `ownerSocket` ni `sessionPasswordHash`) | `REDIS_SESSION_TTL` |
| `room:{roomId}:version` | string | Número entero de `roomVersion`                                           | `REDIS_SESSION_TTL` |

### Operación multi-instancia

```
 Instancia A          Redis          Instancia B
     │                  │                  │
     │── emit evento ──▶│                  │
     │                  │── replica ──────▶│
     │                  │                  │
     │── SET room:X ───▶│◀── GET room:X ───│
```

- Todas las instancias deben compartir la misma `REDIS_URL`.
- El estado maestro es el proceso que gestiona la sala activa; Redis actúa como bus y caché.
- Si un nodo cae, el siguiente que reciba `joinRoom` restaura el estado desde Redis (o disco).

### Diagnóstico habitual

| Síntoma                                            | Comprobación                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| Salas vacías tras reinicio                         | Revisar permisos de escritura en `PERSISTENCE_PATH` y logs de `persistence`. |
| Jugadores en "salas distintas" con varias réplicas | Confirmar que todas las instancias usan la misma `REDIS_URL`.                |
| Estado obsoleto tras reconexión                    | Verificar TTL de `REDIS_SESSION_TTL` y que el adapter esté conectado.        |
| Redis no disponible en arranque                    | El servidor degrada a una sola instancia; revisa logs al inicio.             |

---

## Funcionalidades por módulo (frontend Angular)

### Página Home (`/`)

- Landing con enlace a sala demo (jugador y DM).
- `ThemeToggle` (claro/oscuro).
- Información sobre `DM_SECRET` y contraseña de sesión.

### Página PlayRoom (`/play/:roomId`)

- Orquesta todos los módulos de la sala.
- Gestiona conexión Socket.IO vía `SocketService`.
- En desarrollo: panel colapsable con JSON del `RoomState`.

### Lobby de personajes (`CharacterLobbyComponent`)

- Lista de PCs con estado disponible/ocupado.
- Evento `claimPc` al seleccionar un personaje libre.

### Tablero (`MapBoardComponent`)

- Zoom y paneo (implementar con CSS transforms o librería equivalente compatible con Angular).
- Fondo: imagen, vídeo (URL directa en loop) o YouTube (embed + API).
- Cuadrícula visual alineada con `gridSize`.
- Capa de tokens (`TokensLayerComponent`): arrastre con mouse + teclado (flechas; Shift para paso mayor).
- Emite `tokenMove` durante el arrastre y `tokenMoveEnd` al soltar.
- Snap al grid al soltar si `snapToGrid` está activo.
- Ping en mapa: Shift+clic → `mapPing`.
- `MapPingLayerComponent`: muestra pings efímeros.
- Accesibilidad: skip link, `aria-*`, instrucciones para lectores de pantalla.

### HUD del Narrador (DM HUD)

- Navegación por pestañas: **Mesa / Mapa / Elenco** (`DmScreenNavComponent`).
- Vista Mapa: formulario de configuración de fondo, cuadrícula, snap, audio, ping, contraseña.
- Vista Elenco: spawn de PNJ/PC, roster de tokens, condiciones.
- Paneles plegables (`DmCollapsibleCardComponent`).
- `RollRequestInboxComponent`: solicitudes de tirada.
- `DmTurnTimerBarComponent` / `TurnTimerHudComponent`: temporizador.
- `GroupPollPanelComponent` + `PollStartModalComponent`: encuestas en vivo.
- `ImageRevealToolComponent` + `ImageRevealModalComponent`: revelado de imagen.
- `MapDmVideoAudioCardComponent`: control rápido de media del mapa.

### Panel de dados (`DicePanelComponent`)

- Selección de dado: d4, d6, d8, d10, d12, d20, d100.
- Modos en d20: normal, ventaja, desventaja.
- Historial reciente de `roomState.diceLog`.
- Overlay de tirada (`RollFxOverlayComponent`): animación para crítico 20 / pifia 1.

### Chat y actividad (`ChatPanelComponent`)

- Muestra `activityLog` + `chatLog` unificados.
- Espectadores en modo solo lectura.
- Menciones con notificación contextual (`ChatMentionNotifyService`).

### Notas privadas (`PrivateNotesPanelComponent`)

- Notas por token/objetivo visibles solo para su autor (DM o jugador).

### Iniciativa (`InitiativePanelComponent`)

- Solo visible para jugadores si el DM la activa.
- DM puede reordenar, avanzar turno, tirar orden (d20 + modificadores).
- Notificación de cambio de turno (`InitiativeTurnNotifyService`).

### Presencia y reacciones

- `PresenceStripComponent`: participantes activos en sala.
- `ScreenReactionPaletteComponent` + `ScreenReactionOverlayComponent`: reacciones visuales efímeras.
- Reacciones de token sobre fichas en el mapa.
- Mano levantada (`RaiseHandComponent`): señal no verbal.

### Audio/vídeo con Discord (`DiscordActivityDockComponent`)

Las llamadas de voz y vídeo se delegan completamente a Discord. No se usa WebRTC propio.

#### Modo Discord Activity (embed)

- La sala d20 puede abrirse como una **Discord Activity** dentro de un canal de voz de Discord.
- Usar `@discord/embedded-app-sdk` para inicializar el contexto: `DiscordSDK.ready()`, suscribirse a `VOICE_STATE_UPDATE`, `SPEAKING_START`, `SPEAKING_STOP`.
- Al iniciar la Activity, el SDK proporciona `instanceId`, `channelId` y `guildId`; estos se envían al servidor vía `discordActivityReady`.
- El servidor emite `discordActivityState` con la lista de participantes activos en el canal.

#### Modo externo (enlace a Discord)

- Si la sala no está ejecutándose como Activity, el `DiscordActivityDockComponent` muestra un botón **"Unirse a Discord"** que abre la URL `discord://discord.com/channels/{guildId}/{channelId}` (o la URL web equivalente).
- El DM puede configurar el `discordInviteUrl` en `updateRoomSettings`.

#### Servicio Angular (`DiscordService`)

```typescript
@Injectable({ providedIn: "root" })
export class DiscordService {
  private sdk: DiscordSDK | null = null;
  isActivity = signal(false);
  participants = signal<string[]>([]);

  async init(clientId: string): Promise<void> {
    this.sdk = new DiscordSDK(clientId);
    await this.sdk.ready();
    this.isActivity.set(true);
    // Suscribirse a eventos de voz del canal...
  }
}
```

#### OAuth2 Discord (servidor)

- `POST /auth/discord` — recibe el `code` del flujo OAuth2 y lo intercambia por un token de acceso de Discord. Devuelve `{ access_token, user }` al cliente.
- El cliente usa el `access_token` con el SDK para autenticar la Activity.
- Las variables `DISCORD_CLIENT_ID` y `DISCORD_CLIENT_SECRET` son obligatorias cuando `DISCORD_ACTIVITY_ENABLED=1`.

#### Flujo de integración

```
1. Usuario abre d20 desde un canal de voz Discord (Activity)
2. DiscordSDK.ready() → obtiene instanceId / channelId / guildId
3. Cliente emite discordActivityReady → servidor sincroniza participantes
4. Servidor emite discordActivityState a la sala
5. DiscordActivityDockComponent muestra participantes en canal de voz
```

#### Archivos clave

| Archivo                                                                | Rol                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `frontend/src/app/services/discord.service.ts`                         | Inicialización SDK, señales de estado, OAuth2           |
| `frontend/src/app/components/media/discord-activity-dock.component.ts` | UI de llamada Discord                                   |
| `backend/src/discord-auth.ts`                                          | Endpoint `POST /auth/discord` (intercambio OAuth2)      |
| `backend/src/socket-media.ts`                                          | Eventos `discordActivityReady` / `discordActivityLeave` |

### Tema (`ThemeService`)

- Señal `theme: signal<'light' | 'dark'>`.
- Persiste en `localStorage`.
- `ThemeToggleComponent` para cambiar manualmente.

---

## Diseño y accesibilidad

### Tokens de diseño (variables CSS)

```css
--vtt-motion-fast: 120ms;
--vtt-motion-base: 200ms;
```

### Clases de componente base

| Clase               | Uso                                       |
| ------------------- | ----------------------------------------- |
| `vtt-page-shell`    | Contenedor principal de página            |
| `vtt-panel`         | Superficie de panel/tarjeta               |
| `vtt-panel-header`  | Cabecera de panel                         |
| `vtt-btn-primary`   | Botón acción principal                    |
| `vtt-btn-secondary` | Botón acción secundaria                   |
| `vtt-btn-ghost`     | Botón neutral/tooling                     |
| `vtt-input`         | Input, select, textarea                   |
| `vtt-pill`          | Estado compacto (condición, badge)        |
| `vtt-status-dot`    | Indicador de estado pequeño               |
| `vtt-toast`         | Notificación flotante                     |
| `vtt-safe-bottom`   | Safe area para docks inferiores en mobile |

### Reglas de accesibilidad

- Foco visible en todos los elementos interactivos.
- Objetivos táctiles mínimos de 44×44 px en controles clave.
- Controles icon-only deben tener `aria-label`.
- Colapsables con `aria-expanded` y `aria-controls`.
- Mensajes de error con `role="alert"`.
- Respetar `prefers-reduced-motion` en animaciones.

### Responsive (Mobile First)

- Breakpoints de verificación: 360 px, 390 px, 768 px, 1280 px.
- Paneles de chat/dados/llamada deben poder colapsar.
- Sin desbordamientos horizontales.

---

## Comandos principales

```bash
# Desarrollo (levanta backend en :3000 y frontend Angular en :4200)
npm run dev

# Build completo
npm run build

# Build solo frontend
npm run build --prefix frontend

# Build solo backend
npm run build --prefix backend

# Tests
npm run test

# Type checking
npm run typecheck

# Formateo
npm run format
```

## Documentación técnica (`docs/`)

Toda la documentación técnica del proyecto vive en la carpeta `docs/`. Cada archivo cubre un área específica:

| Archivo                  | Contenido                                                             |
| ------------------------ | --------------------------------------------------------------------- |
| `ARCHITECTURE.md`        | Diagrama de arquitectura, flujo de datos y decisiones de diseño       |
| `DEPLOYMENT.md`          | Guía paso a paso para despliegue local, Docker y producción           |
| `ENVIRONMENTS.md`        | Todas las variables de entorno de frontend y backend con ejemplos     |
| `RUNBOOK.md`             | Arranque, parada, salud, logs e incidentes operativos                 |
| `SOCKET_EVENTS.md`       | Referencia completa de eventos Socket.IO (cliente↔servidor)           |
| `STREAM_DECK.md`         | Configuración de la API de automatización para Stream Deck            |
| `DISCORD_ACTIVITY.md`    | Configuración del Discord Embedded App SDK y flujo OAuth2             |
| `REDIS.md`               | Configuración Redis, estructura de claves y operación multi-instancia |
| `FUNCIONALIDADES.md`     | Inventario de funcionalidades por módulo (frontend y backend)         |
| `CONTEXTO_PLATAFORMA.md` | Visión general del producto, roles y flujo de uso                     |

### Convención para nuevos documentos en `docs/`

- Nombre en `MAYUSCULAS_CON_GUIONES.md`.
- Incluir siempre: propósito, prerequisitos, pasos y sección de diagnóstico si aplica.
- Los ejemplos de comandos deben ser ejecutables tal cual (sin `<placeholder>` sin resolver).
- Referenciar variables de entorno siempre en `ENVIRONMENTS.md`; no duplicarlas en otros docs.

---

## Reglas para Copilot al generar código

1. **Siempre usar componentes Angular standalone** (`standalone: true`). No usar módulos NgModule.
2. **Preferir Signals** sobre RxJS para estado local y derivado. Usar RxJS solo para flujos de eventos Socket.IO.
3. **ChangeDetection.OnPush** en todos los componentes.
4. **No usar `any`** en TypeScript. Tipar siempre con las interfaces de `types.ts`.
5. **Validar en servidor con Zod** antes de mutar el estado de sala.
6. **No exponer `ownerSocket`** ni `sessionPasswordHash` al cliente en ningún evento.
7. **Rate limiting** obligatorio en `tokenMove`, `tokenMoveEnd`, `chatMessage`, `mapPing`.
8. **Permisos**: verificar rol (`dm`, `player`, `spectator`) en cada handler de socket antes de mutar estado.
9. **Persistencia diferida**: usar debounce en `broadcastRoomState` para no escribir a disco ni a Redis en cada evento de movimiento.
   9a. **Redis como caché**: al restaurar una sala, intentar primero desde Redis (`room:{roomId}`); solo caer al JSON de disco si la clave no existe o expiró.
   9b. **Nunca guardar en Redis**: `ownerSocket`, `sessionPasswordHash` ni tokens de acceso de Discord.
10. **Tailwind primero**: usar clases utilitarias de Tailwind; crear clases CSS personalizadas solo para tokens de diseño o patrones muy repetidos.
11. **Tests unitarios** para handlers de socket del servidor y para servicios Angular con lógica de negocio.
12. Al crear un componente nuevo, seguir el patrón: archivo `.component.ts` + `.component.html` + `.component.spec.ts`.
13. **Integración Discord**: usar siempre `@discord/embedded-app-sdk` para interactuar con el cliente Discord. No implementar WebRTC propio. El servidor nunca almacena tokens de acceso de Discord; solo los intercambia y devuelve al cliente.
14. **OAuth2 Discord**: el endpoint `/auth/discord` valida `code` con `DISCORD_CLIENT_SECRET` antes de reenviar a la API de Discord. Nunca exponer `DISCORD_CLIENT_SECRET` al cliente.
15. **Discord Activity**: el `instanceId` recibido del SDK debe enviarse al servidor en `discordActivityReady` para sincronizar presencia. El servidor no gestiona audio/vídeo directamente; eso lo hace Discord.
