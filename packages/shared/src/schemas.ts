import { z } from 'zod';
import {
  COMPONENT_STATUS_KEYS,
  FILE_CATEGORY_KEYS,
  FILE_ENTITY_TYPES,
  INSPECTION_RESULT_KEYS,
  MANUFACTURING_PROCESS_KEYS,
  MATERIAL_STATUS_KEYS,
  MEMBERSHIP_ROLES,
  PRIORITY_KEYS,
  PROJECT_STATUS_KEYS,
  PURCHASE_STATUS_KEYS,
  TEST_STATUS_KEYS,
  USER_ROLES,
} from './constants.js';

// API contract. Numbers are numbers and null is null: the web client is
// responsible for converting form strings before calling the API.

const text = (max = 200) => z.string().trim().min(1, 'Requerido').max(max);
const nullableText = (max = 5000) => z.string().trim().max(max).nullable();
const isoDate = z.iso.date();
const money = z.number().min(0).max(1e12);
const minutes = z.number().int().min(0).max(1_000_000);
const uuid = z.uuid();

// ---------------------------------------------------------------- auth / users

export const loginSchema = z.object({
  email: z.email('Correo inválido'),
  password: z.string().min(1, 'Requerido'),
});

export const createUserSchema = z.object({
  name: text(120),
  email: z.email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(200),
  role: z.enum(USER_ROLES).default('member'),
  avatarUrl: nullableText(500).optional(),
});

export const updateUserSchema = z
  .object({
    name: text(120),
    email: z.email('Correo inválido'),
    role: z.enum(USER_ROLES),
    isActive: z.boolean(),
    password: z.string().min(8, 'Mínimo 8 caracteres').max(200),
    avatarUrl: nullableText(500),
  })
  .partial();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres').max(200),
});

// ------------------------------------------------------------------- projects

export const createProjectSchema = z.object({
  name: text(150),
  description: nullableText().optional(),
  competition: nullableText(150).optional(),
  status: z.enum(PROJECT_STATUS_KEYS).default('planning'),
  startDate: isoDate.nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  budget: money.nullable().optional(),
  currency: z.string().trim().min(1).max(5).default('CRC'),
});
export const updateProjectSchema = createProjectSchema.partial();

export const membershipSchema = z.object({
  userId: uuid,
  role: z.enum(MEMBERSHIP_ROLES).default('member'),
});

// -------------------------------------------------------------------- systems

export const createSystemSchema = z.object({
  name: text(120),
  code: z
    .string()
    .trim()
    .min(1, 'Requerido')
    .max(8)
    .regex(/^[A-Za-z0-9]+$/, 'Solo letras y números')
    .transform((s) => s.toUpperCase()),
  description: nullableText().optional(),
  budget: money.nullable().optional(),
  leadId: uuid.nullable().optional(),
});
export const updateSystemSchema = createSystemSchema.partial();

// ----------------------------------------------------------------- components

export const componentFieldsSchema = z.object({
  systemId: uuid,
  name: text(150),
  code: z.string().trim().min(1).max(30).nullable().optional(),
  description: nullableText().optional(),
  subsystem: nullableText(120).optional(),
  quantity: z.number().int().min(1).max(100_000).default(1),
  responsibleId: uuid.nullable().optional(),
  priority: z.enum(PRIORITY_KEYS).default('medium'),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  material: nullableText(200).optional(),
  materialQty: z.number().min(0).nullable().optional(),
  materialUnit: nullableText(30).optional(),
  supplier: nullableText(150).optional(),
  materialStatus: z.enum(MATERIAL_STATUS_KEYS).nullable().optional(),
  designerId: uuid.nullable().optional(),
  designNotes: nullableText().optional(),
  estMaterialCost: money.default(0),
  estManufacturingCost: money.default(0),
  estShippingCost: money.default(0),
  estAdditionalCost: money.default(0),
  actualCost: money.nullable().optional(),
});

export const createComponentSchema = componentFieldsSchema.extend({
  status: z.enum(COMPONENT_STATUS_KEYS).default('idea'),
  collaboratorIds: z.array(uuid).max(50).default([]),
  dependsOn: z.array(uuid).max(100).default([]),
});

export const updateComponentSchema = componentFieldsSchema.partial();

export const changeStatusSchema = z.object({
  status: z.enum(COMPONENT_STATUS_KEYS),
  note: nullableText(1000).optional(),
});

export const dependencySchema = z.object({ dependsOnId: uuid });
export const collaboratorSchema = z.object({ userId: uuid });

export const manufacturingSchema = z.object({
  process: z.enum(MANUFACTURING_PROCESS_KEYS).nullable().optional(),
  machine: nullableText(120).optional(),
  workshop: nullableText(120).optional(),
  setupMinutes: minutes.default(0),
  machineMinutes: minutes.default(0),
  finishingMinutes: minutes.default(0),
  inspectionMinutes: minutes.default(0),
  responsibleId: uuid.nullable().optional(),
  scheduledDate: isoDate.nullable().optional(),
  actualDate: isoDate.nullable().optional(),
  needsWorkshop: z.boolean().default(false),
  needsExternal: z.boolean().default(false),
  notes: nullableText().optional(),
});

// ------------------------------------------------------------------ purchases

export const purchaseSchema = z.object({
  name: text(150),
  description: nullableText().optional(),
  quantity: z.number().min(0).max(1_000_000).default(1),
  unitCost: money.default(0),
  shippingCost: money.default(0),
  additionalCost: money.default(0),
  supplier: nullableText(150).optional(),
  url: nullableText(1000).optional(),
  status: z.enum(PURCHASE_STATUS_KEYS).default('to_buy'),
  leadTimeDays: z.number().int().min(0).max(1000).nullable().optional(),
  orderedAt: isoDate.nullable().optional(),
  expectedAt: isoDate.nullable().optional(),
  receivedAt: isoDate.nullable().optional(),
  notes: nullableText().optional(),
  componentIds: z.array(uuid).max(100).default([]),
});
export const updatePurchaseSchema = purchaseSchema.partial();

// ---------------------------------------------------------------- inspections

export const inspectionSchema = z.object({
  componentId: uuid,
  date: isoDate,
  result: z.enum(INSPECTION_RESULT_KEYS),
  observations: nullableText().optional(),
});

// ---------------------------------------------------------------------- tests

export const testSchema = z.object({
  name: text(150),
  type: nullableText(80).optional(),
  systemId: uuid.nullable().optional(),
  componentId: uuid.nullable().optional(),
  date: isoDate.nullable().optional(),
  responsibleId: uuid.nullable().optional(),
  objective: nullableText().optional(),
  result: nullableText().optional(),
  status: z.enum(TEST_STATUS_KEYS).default('planned'),
  observations: nullableText().optional(),
});
export const updateTestSchema = testSchema.partial();

// ------------------------------------------------------------------ work logs

export const workLogSchema = z.object({
  date: isoDate,
  minutes: z.number().int().min(1, 'Indica cuánto tiempo trabajaste').max(24 * 60, 'Máximo 24 horas por registro'),
  componentId: uuid.nullable().optional(),
  subject: nullableText(200).optional(),
  progress: nullableText().optional(),
  pending: nullableText().optional(),
});
export const updateWorkLogSchema = workLogSchema.partial();

// ---------------------------------------------------------------------- files

export const fileMetaSchema = z.object({
  entityType: z.enum(FILE_ENTITY_TYPES),
  entityId: uuid,
  category: z.enum(FILE_CATEGORY_KEYS).default('other'),
});

// ----------------------------------------------------------------- milestones

export const milestoneSchema = z.object({
  name: text(120),
  date: isoDate,
  description: nullableText().optional(),
  completedAt: isoDate.nullable().optional(),
});
export const updateMilestoneSchema = milestoneSchema.partial();

// ---------------------------------------------------------------------- types

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type MembershipInput = z.infer<typeof membershipSchema>;
export type CreateSystemInput = z.infer<typeof createSystemSchema>;
export type UpdateSystemInput = z.infer<typeof updateSystemSchema>;
export type CreateComponentInput = z.infer<typeof createComponentSchema>;
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type ManufacturingInput = z.infer<typeof manufacturingSchema>;
export type MilestoneInput = z.infer<typeof milestoneSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type InspectionInput = z.infer<typeof inspectionSchema>;
export type TestInput = z.infer<typeof testSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export type FileMetaInput = z.infer<typeof fileMetaSchema>;
export type WorkLogInput = z.infer<typeof workLogSchema>;
export type UpdateWorkLogInput = z.infer<typeof updateWorkLogSchema>;
