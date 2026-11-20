import { and, eq, inArray } from 'drizzle-orm';
import { db, schema, type DbOrTx } from '../db/index.js';
import type { AuthUser } from './auth.js';
import { forbidden, notFound } from './errors.js';

/**
 * Permission model
 * ----------------
 *  admin (users.role)            -> everything, every project
 *  project lead (project_members) -> everything inside the project
 *  system lead (system_members)   -> everything inside that system
 *  project member                 -> read whole project; create components in systems they
 *                                    belong to; edit components they own or collaborate on
 */

export interface ProjectAccess {
  projectId: string;
  isAdmin: boolean;
  projectRole: 'lead' | 'member' | null;
  systemLeadIds: Set<string>;
  systemMemberIds: Set<string>;
}

export async function loadProjectAccess(user: AuthUser, projectId: string, tx: DbOrTx = db): Promise<ProjectAccess> {
  const [pm] = await tx
    .select({ role: schema.projectMembers.role })
    .from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, user.id)))
    .limit(1);

  const sm = await tx
    .select({ systemId: schema.systemMembers.systemId, role: schema.systemMembers.role })
    .from(schema.systemMembers)
    .innerJoin(schema.systems, eq(schema.systems.id, schema.systemMembers.systemId))
    .where(and(eq(schema.systems.projectId, projectId), eq(schema.systemMembers.userId, user.id)));

  return {
    projectId,
    isAdmin: user.role === 'admin',
    projectRole: (pm?.role as 'lead' | 'member' | undefined) ?? null,
    systemLeadIds: new Set(sm.filter((s) => s.role === 'lead').map((s) => s.systemId)),
    systemMemberIds: new Set(sm.map((s) => s.systemId)),
  };
}

export const canViewProject = (a: ProjectAccess) => a.isAdmin || a.projectRole !== null;
export const canManageProject = (a: ProjectAccess) => a.isAdmin || a.projectRole === 'lead';
export const canManageSystem = (a: ProjectAccess, systemId: string) => canManageProject(a) || a.systemLeadIds.has(systemId);
export const canCreateComponent = (a: ProjectAccess, systemId: string) =>
  canManageSystem(a, systemId) || (a.projectRole !== null && a.systemMemberIds.has(systemId));

export interface ComponentOwnership {
  systemId: string;
  responsibleId: string | null;
  collaboratorIds: string[];
}

export const canEditComponent = (a: ProjectAccess, userId: string, c: ComponentOwnership) =>
  canManageSystem(a, c.systemId) || c.responsibleId === userId || c.collaboratorIds.includes(userId);

/** Anyone in the project logs their own work; only the author or a project lead can change an entry. */
export const canLogWork = (a: ProjectAccess) => canViewProject(a);
export const canEditWorkLog = (a: ProjectAccess, userId: string, log: { userId: string | null }) => canManageProject(a) || log.userId === userId;

/** Loads access and asserts the user can at least view the project. */
export async function requireProjectAccess(user: AuthUser, projectId: string, tx: DbOrTx = db): Promise<ProjectAccess> {
  const [project] = await tx.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  if (!project) throw notFound('Proyecto no encontrado');
  const access = await loadProjectAccess(user, projectId, tx);
  if (!canViewProject(access)) throw forbidden('No perteneces a este proyecto');
  return access;
}

export function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) throw forbidden(message);
}

/** Project ids the user can see (all for admins). */
export async function visibleProjectIds(user: AuthUser): Promise<string[] | 'all'> {
  if (user.role === 'admin') return 'all';
  const rows = await db
    .select({ projectId: schema.projectMembers.projectId })
    .from(schema.projectMembers)
    .where(eq(schema.projectMembers.userId, user.id));
  return rows.map((r) => r.projectId);
}

/** Ensures all given user ids are active users (for assignments). */
export async function assertActiveUsers(ids: string[], tx: DbOrTx = db) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  const rows = await tx
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(inArray(schema.users.id, unique), eq(schema.users.isActive, true)));
  if (rows.length !== unique.length) throw notFound('Uno de los usuarios indicados no existe o está inactivo');
}
