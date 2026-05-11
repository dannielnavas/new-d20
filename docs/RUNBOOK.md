# RUNBOOK

## Proposito

Guia operativa para iniciar, validar y recuperar servicio.

## Arranque

```bash
cd /Users/dannielnavas/Documents/siteprojects/new-d20
npm run dev
```

## Parada

- En terminal interactivo: `Ctrl + C`
- Backend persiste snapshot al recibir `SIGINT/SIGTERM`

## Comprobaciones de salud

1. API:

```bash
curl http://localhost:3000/health
```

2. Frontend:

- Abrir `http://localhost:4200`

3. Socket:

- Entrar en `/play/demo` y verificar `Conectado` en UI

## Comandos de diagnostico

```bash
npm run typecheck --prefix backend
npm run build --prefix backend
npm run build --prefix frontend/d20
npm run test --prefix frontend/d20 -- --watch=false
```

## Incidentes comunes

- Error CORS:
  - Revisar `CLIENT_ORIGIN` y URL real de frontend.
- Sala no persiste:
  - Revisar permisos sobre `backend/data/vtt-snapshot.json`.
- DM no puede entrar:
  - Validar `POST /auth/dm` y token en `sessionStorage`.
- Automation rechazada:
  - Verificar `AUTOMATION_ENABLED=1` y `x-automation-token`.
- Redis degradado:
  - Ver logs de arranque, backend sigue en single-node.
