# DEPLOYMENT

## Proposito

Describir despliegue local y ruta recomendada para produccion.

## Prerequisitos

- Node.js 20+
- npm 10+
- Redis opcional para multi-instancia

## Desarrollo local

1. Instalar dependencias raiz:

```bash
cd /Users/dannielnavas/Documents/siteprojects/new-d20
npm install
```

2. Instalar dependencias backend y frontend:

```bash
npm install --prefix backend
npm install --prefix frontend/d20
```

3. Configurar variables:

```bash
cp .env.example .env
```

4. Levantar todo:

```bash
npm run dev
```

5. Verificar salud backend:

```bash
curl http://localhost:3000/health
```

## Build

```bash
npm run build
```

## Produccion recomendada

- Frontend: Vercel o Netlify
- Backend: Railway/Fly/DigitalOcean App Platform
- Redis: Redis Cloud si hay mas de una instancia backend

## Checklist previa a deploy

- `npm run typecheck --prefix backend`
- `npm run build --prefix backend`
- `npm run build --prefix frontend/d20`
- `npm run test --prefix frontend/d20 -- --watch=false`

## Diagnostico rapido

- Si backend no inicia: revisar `DM_SECRET/JWT_SECRET` y logs en consola.
- Si frontend no conecta socket: validar `socketUrl` y CORS `CLIENT_ORIGIN`.
- Si hay inconsistencia entre replicas: validar `REDIS_URL` comun en todas las instancias.
