import { zValidator } from '@hono/zod-validator';
import { fileMetaSchema, inspectionSchema, purchaseSchema, testSchema, updatePurchaseSchema, updateTestSchema, updateWorkLogSchema, workLogSchema } from '@rdms/shared';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { env } from '../env.js';
import { badRequest } from '../lib/errors.js';
import { uuidParam, type ProjectEnv } from '../lib/project-middleware.js';
import { deleteFile, getFileRowOrThrow, loadFiles, storage, uploadFile } from '../services/files.js';
import { deleteInspection, loadInspections, recordInspection } from '../services/inspections.js';
import { computeMetrics } from '../services/metrics.js';
import { createPurchase, deletePurchase, getPurchaseOrThrow, loadPurchases, updatePurchase } from '../services/purchases.js';
import { createTest, deleteTest, getTestOrThrow, loadTests, updateTest } from '../services/tests.js';
import { createWorkLog, deleteWorkLog, getWorkLogOrThrow, loadWorkLogs, updateWorkLog } from '../services/work-logs.js';

/** Phase 2/3 modules. Mounted under /api/projects/:projectId (project access already loaded). */
export const operationRoutes = new Hono<ProjectEnv>()
  // ------------------------------------------------------------ purchases
  .get('/purchases', async (c) => c.json({ purchases: await loadPurchases(c.var.projectId) }))
  .post('/purchases', zValidator('json', purchaseSchema), async (c) => {
    const purchase = await createPurchase(c.var.user, c.var.access, c.var.projectId, c.req.valid('json'));
    return c.json({ purchase }, 201);
  })
  .patch('/purchases/:purchaseId', zValidator('json', updatePurchaseSchema), async (c) => {
    const current = await getPurchaseOrThrow(c.var.projectId, uuidParam(c.req.param('purchaseId'), 'Compra'));
    const purchase = await updatePurchase(c.var.user, c.var.access, current, c.req.valid('json'));
    return c.json({ purchase });
  })
  .delete('/purchases/:purchaseId', async (c) => {
    const current = await getPurchaseOrThrow(c.var.projectId, uuidParam(c.req.param('purchaseId'), 'Compra'));
    await deletePurchase(c.var.user, c.var.access, current);
    return c.json({ ok: true });
  })

  // ---------------------------------------------------------------- tests
  .get('/tests', async (c) => c.json({ tests: await loadTests(c.var.projectId) }))
  .post('/tests', zValidator('json', testSchema), async (c) => {
    const test = await createTest(c.var.user, c.var.access, c.var.projectId, c.req.valid('json'));
    return c.json({ test }, 201);
  })
  .patch('/tests/:testId', zValidator('json', updateTestSchema), async (c) => {
    const current = await getTestOrThrow(c.var.projectId, uuidParam(c.req.param('testId'), 'Prueba'));
    const test = await updateTest(c.var.user, c.var.access, current, c.req.valid('json'));
    return c.json({ test });
  })
  .delete('/tests/:testId', async (c) => {
    const current = await getTestOrThrow(c.var.projectId, uuidParam(c.req.param('testId'), 'Prueba'));
    await deleteTest(c.var.user, c.var.access, current);
    return c.json({ ok: true });
  })

  // ------------------------------------------------------------ work logs
  .get('/work-logs', async (c) => c.json({ workLogs: await loadWorkLogs(c.var.projectId) }))
  .post('/work-logs', zValidator('json', workLogSchema), async (c) => {
    const workLog = await createWorkLog(c.var.user, c.var.access, c.var.projectId, c.req.valid('json'));
    return c.json({ workLog }, 201);
  })
  .patch('/work-logs/:workLogId', zValidator('json', updateWorkLogSchema), async (c) => {
    const current = await getWorkLogOrThrow(c.var.projectId, uuidParam(c.req.param('workLogId'), 'Registro'));
    const workLog = await updateWorkLog(c.var.user, c.var.access, current, c.req.valid('json'));
    return c.json({ workLog });
  })
  .delete('/work-logs/:workLogId', async (c) => {
    const current = await getWorkLogOrThrow(c.var.projectId, uuidParam(c.req.param('workLogId'), 'Registro'));
    await deleteWorkLog(c.var.user, c.var.access, current);
    return c.json({ ok: true });
  })

  // ---------------------------------------------------------- inspections
  .get('/inspections', async (c) => c.json({ inspections: await loadInspections(c.var.projectId) }))
  .post('/inspections', zValidator('json', inspectionSchema), async (c) => {
    const result = await recordInspection(c.var.user, c.var.access, c.var.projectId, c.req.valid('json'));
    return c.json(result, 201);
  })
  .delete('/inspections/:inspectionId', async (c) => {
    await deleteInspection(c.var.user, c.var.access, c.var.projectId, uuidParam(c.req.param('inspectionId'), 'Inspección'));
    return c.json({ ok: true });
  })

  // ---------------------------------------------------------------- files
  .get('/files', async (c) => c.json({ files: await loadFiles(c.var.projectId) }))
  .post(
    '/files',
    bodyLimit({
      maxSize: (env.MAX_FILE_SIZE_MB + 1) * 1024 * 1024,
      onError: (c) => c.json({ error: `El archivo supera el máximo de ${env.MAX_FILE_SIZE_MB} MB` }, 413),
    }),
    async (c) => {
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!(file instanceof File)) throw badRequest('Falta el archivo (campo "file")');
      const meta = fileMetaSchema.parse({ entityType: body['entityType'], entityId: body['entityId'], category: body['category'] || undefined });
      const item = await uploadFile(c.var.user, c.var.access, c.var.projectId, meta, file);
      return c.json({ file: item }, 201);
    },
  )
  .get('/files/:fileId/download', async (c) => {
    const row = await getFileRowOrThrow(c.var.projectId, uuidParam(c.req.param('fileId'), 'Archivo'));
    const { stream, size } = await storage.open(row.storageKey);
    const inline = c.req.query('inline') === '1';
    const encoded = encodeURIComponent(row.name).replace(/['()]/g, escape);
    return new Response(stream, {
      headers: {
        'Content-Type': row.mime ?? 'application/octet-stream',
        'Content-Length': String(size),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  })
  .delete('/files/:fileId', async (c) => {
    await deleteFile(c.var.user, c.var.access, c.var.projectId, uuidParam(c.req.param('fileId'), 'Archivo'));
    return c.json({ ok: true });
  })

  // -------------------------------------------------------------- metrics
  .get('/metrics', async (c) => c.json({ metrics: await computeMetrics(c.var.projectId) }));
