import { formatDuration, type UpdateWorkLogInput, type WorkLog, type WorkLogInput } from '@rdms/shared';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema, type DbOrTx } from '../db/index.js';
import { diffRecords, labelChanges, logActivity } from '../lib/activity.js';
import type { AuthUser } from '../lib/auth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { canEditWorkLog, canLogWork, type ProjectAccess } from '../lib/permissions.js';
import { serializeWorkLog } from '../lib/serialize.js';

type WorkLogRow = typeof schema.workLogs.$inferSelect;

const TARGET_REQUIRED = 'Indica la pieza o el documento en el que trabajaste';

export async function loadWorkLogs(projectId: string, tx: DbOrTx = db): Promise<WorkLog[]> {
  const rows = await tx.select().from(schema.workLogs).where(eq(schema.workLogs.projectId, projectId)).orderBy(desc(schema.workLogs.date), desc(schema.workLogs.createdAt));
  return rows.map(serializeWorkLog);
}

export async function getWorkLogOrThrow(projectId: string, id: string, tx: DbOrTx = db): Promise<WorkLog> {
  const [row] = await tx
    .select()
    .from(schema.workLogs)
    .where(and(eq(schema.workLogs.id, id), eq(schema.workLogs.projectId, projectId)))
    .limit(1);
  if (!row) throw notFound('Registro de bitácora no encontrado');
  return serializeWorkLog(row);
}

const clean = <T extends Record<string, unknown>>(input: T): T => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = typeof v === 'string' && v.trim() === '' ? null : v;
  return out as T;
};

/** Activity label ("1 h 30 min en ALE-01 Aleta"); also validates the component belongs to the project. */
async function describeLog(tx: DbOrTx, projectId: string, log: Pick<WorkLog, 'minutes' | 'componentId' | 'subject'>) {
  let target = log.subject;
  if (log.componentId) {
    const [c] = await tx
      .select({ code: schema.components.code, name: schema.components.name })
      .from(schema.components)
      .where(and(eq(schema.components.id, log.componentId), eq(schema.components.projectId, projectId)))
      .limit(1);
    if (!c) throw badRequest('El componente no pertenece a este proyecto');
    target = `${c.code} ${c.name}`;
  }
  return target ? `${formatDuration(log.minutes)} en ${target}` : formatDuration(log.minutes);
}

export async function createWorkLog(user: AuthUser, access: ProjectAccess, projectId: string, raw: WorkLogInput): Promise<WorkLog> {
  if (!canLogWork(access)) throw forbidden('No perteneces a este proyecto');
  const input = clean(raw);
  if (!input.componentId && !input.subject) throw badRequest(TARGET_REQUIRED);
  return db.transaction(async (tx) => {
    const values = { componentId: input.componentId ?? null, subject: input.subject ?? null, minutes: input.minutes };
    const label = await describeLog(tx, projectId, values);
    const [row] = await tx
      .insert(schema.workLogs)
      .values({ ...values, projectId, userId: user.id, date: input.date, progress: input.progress ?? null, pending: input.pending ?? null })
      .returning();
    await logActivity({ projectId, entityType: 'work_log', entityId: row.id, entityLabel: label, userId: user.id, action: 'created' }, tx);
    return serializeWorkLog(row);
  });
}

const UPDATABLE: (keyof UpdateWorkLogInput)[] = ['date', 'minutes', 'componentId', 'subject', 'progress', 'pending'];

export async function updateWorkLog(user: AuthUser, access: ProjectAccess, current: WorkLog, raw: UpdateWorkLogInput): Promise<WorkLog> {
  if (!canEditWorkLog(access, user.id, current)) throw forbidden('Solo puedes editar tus propios registros');
  const input = clean(raw);
  return db.transaction(async (tx) => {
    const patch: Partial<WorkLogRow> = {};
    for (const f of UPDATABLE) if (f in input) (patch as Record<string, unknown>)[f] = input[f] ?? null;
    if (patch.date == null) delete patch.date;
    if (patch.minutes == null) delete patch.minutes;
    const next = { ...current, ...patch };
    if (('componentId' in patch || 'subject' in patch) && !next.componentId && !next.subject) throw badRequest(TARGET_REQUIRED);
    const changes = diffRecords(current as unknown as Record<string, unknown>, patch as Record<string, unknown>);
    if (changes.length === 0) return current;
    const label = await describeLog(tx, current.projectId, next);
    await tx.update(schema.workLogs).set(patch).where(eq(schema.workLogs.id, current.id));
    await logActivity({ projectId: current.projectId, entityType: 'work_log', entityId: current.id, entityLabel: label, userId: user.id, action: 'updated', changes: await labelChanges(changes, tx) }, tx);
    return getWorkLogOrThrow(current.projectId, current.id, tx);
  });
}

export async function deleteWorkLog(user: AuthUser, access: ProjectAccess, current: WorkLog) {
  if (!canEditWorkLog(access, user.id, current)) throw forbidden('Solo puedes eliminar tus propios registros');
  await db.transaction(async (tx) => {
    const label = await describeLog(tx, current.projectId, current);
    await tx.delete(schema.workLogs).where(eq(schema.workLogs.id, current.id));
    await logActivity({ projectId: current.projectId, entityType: 'work_log', entityId: current.id, entityLabel: label, userId: user.id, action: 'deleted' }, tx);
  });
}
