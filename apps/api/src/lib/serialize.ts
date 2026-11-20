import type {
  ActivityLog,
  Component,
  ComponentStatus,
  FileItem,
  Inspection,
  Manufacturing,
  ManufacturingProcess,
  MaterialStatus,
  Milestone,
  Priority,
  Project,
  ProjectStatus,
  Purchase,
  Test,
  User,
  UserSummary,
  WorkLog,
} from '@rdms/shared';
import type { schema } from '../db/index.js';

type UserRow = typeof schema.users.$inferSelect;
type ProjectRow = typeof schema.projects.$inferSelect;
type ComponentRow = typeof schema.components.$inferSelect;
type ManufacturingRow = typeof schema.manufacturing.$inferSelect;
type MilestoneRow = typeof schema.milestones.$inferSelect;
type ActivityRow = typeof schema.activityLogs.$inferSelect;
type PurchaseRow = typeof schema.purchases.$inferSelect;
type InspectionRow = typeof schema.inspections.$inferSelect;
type TestRow = typeof schema.tests.$inferSelect;
type FileRow = typeof schema.files.$inferSelect;

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function serializeUserSummary(u: Pick<UserRow, 'id' | 'name' | 'email' | 'avatarUrl' | 'isActive'>): UserSummary {
  return { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl, isActive: u.isActive };
}

export function serializeUser(u: Omit<UserRow, 'passwordHash'> | UserRow): User {
  return { ...serializeUserSummary(u), role: u.role as User['role'], createdAt: u.createdAt.toISOString() };
}

export function serializeProject(p: ProjectRow): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    competition: p.competition,
    status: p.status as ProjectStatus,
    startDate: p.startDate,
    targetDate: p.targetDate,
    budget: p.budget,
    currency: p.currency,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeManufacturing(m: ManufacturingRow | null | undefined): Manufacturing | null {
  if (!m) return null;
  return {
    process: m.process as ManufacturingProcess | null,
    machine: m.machine,
    workshop: m.workshop,
    setupMinutes: m.setupMinutes,
    machineMinutes: m.machineMinutes,
    finishingMinutes: m.finishingMinutes,
    inspectionMinutes: m.inspectionMinutes,
    responsibleId: m.responsibleId,
    scheduledDate: m.scheduledDate,
    actualDate: m.actualDate,
    needsWorkshop: m.needsWorkshop,
    needsExternal: m.needsExternal,
    notes: m.notes,
  };
}

export interface ComponentExtras {
  collaboratorIds: string[];
  dependsOn: string[];
  dependents: string[];
  manufacturing: ManufacturingRow | null;
}

export function serializeComponent(c: ComponentRow, extras: ComponentExtras): Component {
  return {
    id: c.id,
    projectId: c.projectId,
    systemId: c.systemId,
    code: c.code,
    name: c.name,
    description: c.description,
    subsystem: c.subsystem,
    quantity: c.quantity,
    responsibleId: c.responsibleId,
    priority: c.priority as Priority,
    status: c.status as ComponentStatus,
    startDate: c.startDate,
    dueDate: c.dueDate,
    completedAt: iso(c.completedAt),
    material: c.material,
    materialQty: c.materialQty,
    materialUnit: c.materialUnit,
    supplier: c.supplier,
    materialStatus: c.materialStatus as MaterialStatus | null,
    designerId: c.designerId,
    designApprovedAt: iso(c.designApprovedAt),
    designNotes: c.designNotes,
    estMaterialCost: c.estMaterialCost,
    estManufacturingCost: c.estManufacturingCost,
    estShippingCost: c.estShippingCost,
    estAdditionalCost: c.estAdditionalCost,
    actualCost: c.actualCost,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    collaboratorIds: extras.collaboratorIds,
    dependsOn: extras.dependsOn,
    dependents: extras.dependents,
    manufacturing: serializeManufacturing(extras.manufacturing),
  };
}

export function serializeMilestone(m: MilestoneRow): Milestone {
  return { id: m.id, projectId: m.projectId, name: m.name, date: m.date, description: m.description, completedAt: m.completedAt };
}

export function serializeActivity(a: ActivityRow, userName: string | null): ActivityLog {
  return {
    id: a.id,
    projectId: a.projectId ?? '',
    entityType: a.entityType as ActivityLog['entityType'],
    entityId: a.entityId,
    entityLabel: a.entityLabel,
    userId: a.userId,
    userName,
    action: a.action as ActivityLog['action'],
    changes: (a.changes as ActivityLog['changes']) ?? null,
    note: a.note,
    createdAt: a.createdAt.toISOString(),
  };
}

export function serializePurchase(p: PurchaseRow, componentIds: string[]): Purchase {
  return {
    id: p.id,
    projectId: p.projectId,
    name: p.name,
    description: p.description,
    quantity: p.quantity,
    unitCost: p.unitCost,
    shippingCost: p.shippingCost,
    additionalCost: p.additionalCost,
    supplier: p.supplier,
    url: p.url,
    status: p.status as Purchase['status'],
    leadTimeDays: p.leadTimeDays,
    orderedAt: p.orderedAt,
    expectedAt: p.expectedAt,
    receivedAt: p.receivedAt,
    requestedById: p.requestedBy,
    notes: p.notes,
    componentIds,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeInspection(i: InspectionRow): Inspection {
  return {
    id: i.id,
    componentId: i.componentId,
    inspectorId: i.inspectorId,
    date: i.date,
    result: i.result as Inspection['result'],
    observations: i.observations,
    createdAt: i.createdAt.toISOString(),
  };
}

export function serializeTest(t: TestRow): Test {
  return {
    id: t.id,
    projectId: t.projectId,
    systemId: t.systemId,
    componentId: t.componentId,
    name: t.name,
    type: t.type,
    date: t.date,
    responsibleId: t.responsibleId,
    objective: t.objective,
    result: t.result,
    status: t.status as Test['status'],
    observations: t.observations,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializeWorkLog(w: typeof schema.workLogs.$inferSelect): WorkLog {
  return {
    id: w.id,
    projectId: w.projectId,
    userId: w.userId,
    componentId: w.componentId,
    subject: w.subject,
    date: w.date,
    minutes: w.minutes,
    progress: w.progress,
    pending: w.pending,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export function serializeFile(f: FileRow): FileItem {
  return {
    id: f.id,
    projectId: f.projectId,
    entityType: f.entityType as FileItem['entityType'],
    entityId: f.entityId,
    category: f.category as FileItem['category'],
    name: f.name,
    mime: f.mime,
    size: f.size,
    uploadedById: f.uploadedBy,
    createdAt: f.createdAt.toISOString(),
  };
}
