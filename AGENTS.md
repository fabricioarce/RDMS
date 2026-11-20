# RDMS — notas para agentes/desarrolladores

- Monorepo pnpm: `apps/api` (Hono + Drizzle), `apps/web` (Vite + React), `packages/shared` (constantes, zod, tipos, reglas derivadas).
- `pnpm-workspace.yaml` fija `minimumReleaseAge: 10080` (7 días): si una versión es "demasiado nueva" baja el rango en el `package.json` en vez de desactivar la regla.
- Base de datos local: `pnpm db:up` (docker compose). Seed: `pnpm db:seed`. Reset total: `pnpm db:reset -- --yes`.
- Desarrollo: `pnpm dev` (API :3000, web :5173 con proxy `/api`). Variables en `.env` (copiar de `.env.example`).
- Verificación: `pnpm typecheck && pnpm build`. Prueba de producción local: `NODE_ENV=production PORT=3100 node apps/api/dist/index.js` (sirve `apps/web/dist`).
- Reglas de negocio (transiciones, bloqueo derivado, progreso, costos) viven SOLO en `packages/shared/src/{constants,derived}.ts`; API y web las reutilizan. No dupliques lógica.
- Toda mutación del API debe pasar por `services/` y llamar a `logActivity` (historial automático) y a las funciones `can*` de `lib/permissions.ts`.
- `src/db/migrate.ts` y `seed.ts` son librerías; los puntos de entrada CLI son `cli-migrate.ts` / `cli-seed.ts` (el API se bundlea con esbuild, así que no uses `import.meta.url === argv[1]` dentro de módulos compartidos).
- UI en español; identificadores en inglés. Formularios cortos: lo esencial primero, "Más campos" para el resto.
- Categorías de costo estimado: material, manufactura, envío, adicionales (`COST_CATEGORIES` en shared). Reglas de gastado/comprometido en `computeCosts`.
- Archivos: `services/files.ts` (StorageAdapter, disco local en `UPLOAD_DIR`). Subida multipart `POST /api/projects/:id/files` (campos `file`, `entityType`, `entityId`, `category`); descarga `GET .../files/:fileId/download`.
- Módulos de fase 2/3 (compras, pruebas, inspecciones, archivos, métricas) viven en `routes/operations.ts` + `services/*`; en la web, páginas `manufacturing`, `purchases`, `budget`, `tests`, `reports`, `metrics`.
- Bitácora de trabajo: tabla `work_logs`, `services/work-logs.ts`, rutas `/api/projects/:id/work-logs`, página `worklog`. No va en el bundle del proyecto (query propia `useWorkLogs`). Cada quien edita lo suyo; líder de proyecto/admin edita todo (`canEditWorkLog`).
- Migraciones nuevas: `pnpm exec drizzle-kit generate --name <nombre>` dentro de `apps/api`; se aplican solas al arrancar el API.
- Para evitar grafos HMR rotos: no exportes componentes desde páginas para usarlos en otras páginas; ponlos en `components/domain/`.
