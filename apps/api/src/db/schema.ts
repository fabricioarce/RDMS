import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' });
const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

// ------------------------------------------------------------------ users/auth

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('member'), // admin | member
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // sha256(token)
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: createdAt(),
});

// -------------------------------------------------------------------- projects

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  competition: text('competition'),
  status: text('status').notNull().default('planning'),
  startDate: date('start_date', { mode: 'string' }),
  targetDate: date('target_date', { mode: 'string' }),
  budget: money('budget'),
  currency: text('currency').notNull().default('CRC'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // lead | member
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

// --------------------------------------------------------------------- systems

export const systems = pgTable(
  'systems',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    budget: money('budget'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('systems_project_code_idx').on(t.projectId, t.code)],
);

export const systemMembers = pgTable(
  'system_members',
  {
    systemId: uuid('system_id')
      .notNull()
      .references(() => systems.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // lead | member
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.systemId, t.userId] })],
);

// ------------------------------------------------------------------ components

export const components = pgTable(
  'components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    systemId: uuid('system_id')
      .notNull()
      .references(() => systems.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    subsystem: text('subsystem'),
    quantity: integer('quantity').notNull().default(1),
    responsibleId: uuid('responsible_id').references(() => users.id, { onDelete: 'set null' }),
    priority: text('priority').notNull().default('medium'),
    status: text('status').notNull().default('idea'),
    startDate: date('start_date', { mode: 'string' }),
    dueDate: date('due_date', { mode: 'string' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    // material
    material: text('material'),
    materialQty: numeric('material_qty', { precision: 12, scale: 3, mode: 'number' }),
    materialUnit: text('material_unit'),
    supplier: text('supplier'),
    materialStatus: text('material_status'), // to_buy | ordered | available
    // design
    designerId: uuid('designer_id').references(() => users.id, { onDelete: 'set null' }),
    designApprovedAt: timestamp('design_approved_at', { withTimezone: true, mode: 'date' }),
    designNotes: text('design_notes'),
    // costs
    estMaterialCost: money('est_material_cost').notNull().default(0),
    estManufacturingCost: money('est_manufacturing_cost').notNull().default(0),
    estShippingCost: money('est_shipping_cost').notNull().default(0),
    estAdditionalCost: money('est_additional_cost').notNull().default(0),
    actualCost: money('actual_cost'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('components_project_code_idx').on(t.projectId, t.code),
    index('components_system_idx').on(t.systemId),
    index('components_responsible_idx').on(t.responsibleId),
    index('components_status_idx').on(t.projectId, t.status),
  ],
);

export const componentMembers = pgTable(
  'component_members',
  {
    componentId: uuid('component_id')
      .notNull()
      .references(() => components.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.componentId, t.userId] })],
);

export const dependencies = pgTable(
  'dependencies',
  {
    componentId: uuid('component_id')
      .notNull()
      .references(() => components.id, { onDelete: 'cascade' }),
    dependsOnId: uuid('depends_on_id')
      .notNull()
      .references(() => components.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.componentId, t.dependsOnId] }),
    index('dependencies_depends_on_idx').on(t.dependsOnId),
    check('dependencies_no_self', sql`${t.componentId} <> ${t.dependsOnId}`),
  ],
);

export const manufacturing = pgTable('manufacturing', {
  componentId: uuid('component_id')
    .primaryKey()
    .references(() => components.id, { onDelete: 'cascade' }),
  process: text('process'),
  machine: text('machine'),
  workshop: text('workshop'),
  setupMinutes: integer('setup_minutes').notNull().default(0),
  machineMinutes: integer('machine_minutes').notNull().default(0),
  finishingMinutes: integer('finishing_minutes').notNull().default(0),
  inspectionMinutes: integer('inspection_minutes').notNull().default(0),
  responsibleId: uuid('responsible_id').references(() => users.id, { onDelete: 'set null' }),
  scheduledDate: date('scheduled_date', { mode: 'string' }),
  actualDate: date('actual_date', { mode: 'string' }),
  needsWorkshop: boolean('needs_workshop').notNull().default(false),
  needsExternal: boolean('needs_external').notNull().default(false),
  notes: text('notes'),
  updatedAt: updatedAt(),
});

// ------------------------------------------------------------------ milestones

export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    description: text('description'),
    completedAt: date('completed_at', { mode: 'string' }),
    createdAt: createdAt(),
  },
  (t) => [index('milestones_project_idx').on(t.projectId, t.date)],
);

// ---------------------------------------------------------------- activity log

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    entityLabel: text('entity_label'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    changes: jsonb('changes'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('activity_project_created_idx').on(t.projectId, t.createdAt),
    index('activity_entity_idx').on(t.entityType, t.entityId),
  ],
);

// ------------------------------------------------------- phase 2/3: purchases

export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    quantity: numeric('quantity', { precision: 12, scale: 3, mode: 'number' }).notNull().default(1),
    unitCost: money('unit_cost').notNull().default(0),
    shippingCost: money('shipping_cost').notNull().default(0),
    additionalCost: money('additional_cost').notNull().default(0),
    supplier: text('supplier'),
    url: text('url'),
    status: text('status').notNull().default('to_buy'),
    leadTimeDays: integer('lead_time_days'),
    orderedAt: date('ordered_at', { mode: 'string' }),
    expectedAt: date('expected_at', { mode: 'string' }),
    receivedAt: date('received_at', { mode: 'string' }),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('purchases_project_idx').on(t.projectId, t.status)],
);

export const purchaseComponents = pgTable(
  'purchase_components',
  {
    purchaseId: uuid('purchase_id')
      .notNull()
      .references(() => purchases.id, { onDelete: 'cascade' }),
    componentId: uuid('component_id')
      .notNull()
      .references(() => components.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.purchaseId, t.componentId] })],
);

// ------------------------------------------------- phase 3: inspections/tests

export const inspections = pgTable('inspections', {
  id: uuid('id').primaryKey().defaultRandom(),
  componentId: uuid('component_id')
    .notNull()
    .references(() => components.id, { onDelete: 'cascade' }),
  inspectorId: uuid('inspector_id').references(() => users.id, { onDelete: 'set null' }),
  date: date('date', { mode: 'string' }).notNull(),
  result: text('result').notNull(), // approved | approved_with_notes | rejected
  observations: text('observations'),
  createdAt: createdAt(),
});

export const tests = pgTable(
  'tests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    systemId: uuid('system_id').references(() => systems.id, { onDelete: 'set null' }),
    componentId: uuid('component_id').references(() => components.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    type: text('type'),
    date: date('date', { mode: 'string' }),
    responsibleId: uuid('responsible_id').references(() => users.id, { onDelete: 'set null' }),
    objective: text('objective'),
    result: text('result'),
    status: text('status').notNull().default('planned'),
    observations: text('observations'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('tests_project_idx').on(t.projectId)],
);

export const workLogs = pgTable(
  'work_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    componentId: uuid('component_id').references(() => components.id, { onDelete: 'set null' }),
    subject: text('subject'),
    date: date('date', { mode: 'string' }).notNull(),
    minutes: integer('minutes').notNull(),
    progress: text('progress'),
    pending: text('pending'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('work_logs_project_date_idx').on(t.projectId, t.date),
    index('work_logs_user_idx').on(t.userId),
    check('work_logs_minutes_positive', sql`${t.minutes} > 0`),
  ],
);

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    category: text('category').notNull().default('other'),
    name: text('name').notNull(),
    storageKey: text('storage_key').notNull(),
    url: text('url'),
    mime: text('mime'),
    size: integer('size'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('files_entity_idx').on(t.entityType, t.entityId)],
);
