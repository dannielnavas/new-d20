# DEPLOYMENT

## Proposito

Describir despliegue local y ruta recomendada para produccion.

## Prerequisitos

- Node.js 20+
- pnpm 10+ (recomendado: `corepack enable` para activar la version indicada en `packageManager` del `package.json` de la raiz)
- Redis opcional para multi-instancia

## Desarrollo local

1. Instalar dependencias del monorepo (una sola vez, desde la raiz):

```bash
cd /Users/dannielnavas/Documents/siteprojects/new-d20
pnpm install
```

2. Configurar variables:

```bash
cp .env.example .env
```

3. Levantar todo:

```bash
pnpm run dev
```

4. Verificar salud backend:

```bash
curl http://localhost:3000/health
```

## Build

```bash
pnpm run build
```

## Produccion recomendada

- Frontend: Vercel o Netlify
- Backend: Railway/Fly/DigitalOcean App Platform
- Redis: Redis Cloud si hay mas de una instancia backend

## Checklist previa a deploy

- `pnpm run typecheck`
- `pnpm --filter backend build`
- `pnpm --filter d20 build`
- `pnpm --filter d20 test -- --watch=false`

## Diagnostico rapido

- Si backend no inicia: revisar `DM_SECRET/JWT_SECRET` y logs en consola.
- Si frontend no conecta socket: validar `socketUrl` y CORS `CLIENT_ORIGIN`.
- Si hay inconsistencia entre replicas: validar `REDIS_URL` comun en todas las instancias.
