// ---------------------------------------------------------------------------
// Domain constants shared by API and web. Adding a status/priority here is the
// single place to change (plus a DB migration if a CHECK constraint exists).
// ---------------------------------------------------------------------------

export const COMPONENT_STATUSES = [
  { key: 'idea', label: 'Idea', order: 0, progress: 0, phase: 'design' },
  { key: 'design', label: 'Diseño', order: 1, progress: 15, phase: 'design' },
  { key: 'design_approved', label: 'Diseño aprobado', order: 2, progress: 30, phase: 'design' },
  { key: 'pending_manufacturing', label: 'Pendiente de fabricación', order: 3, progress: 40, phase: 'manufacturing' },
  { key: 'in_manufacturing', label: 'En fabricación', order: 4, progress: 60, phase: 'manufacturing' },
  { key: 'inspection', label: 'Inspección', order: 5, progress: 85, phase: 'manufacturing' },
  { key: 'completed', label: 'Completado', order: 6, progress: 100, phase: 'done' },
  { key: 'integrated', label: 'Integrado', order: 7, progress: 100, phase: 'done' },
] as const;

export type ComponentStatus = (typeof COMPONENT_STATUSES)[number]['key'];
export const COMPONENT_STATUS_KEYS = COMPONENT_STATUSES.map((s) => s.key) as [ComponentStatus, ...ComponentStatus[]];

export const STATUS_BY_KEY = Object.fromEntries(COMPONENT_STATUSES.map((s) => [s.key, s])) as Record<
  ComponentStatus,
  (typeof COMPONENT_STATUSES)[number]
>;

/** Forward transitions allowed from each status. Backward moves are always allowed (rework). */
export const FORWARD_TRANSITIONS: Record<ComponentStatus, ComponentStatus[]> = {
  idea: ['design', 'design_approved'],
  design: ['design_approved'],
  // COTS / purchased parts may skip manufacturing entirely
  design_approved: ['pending_manufacturing', 'in_manufacturing', 'inspection', 'completed'],
  pending_manufacturing: ['in_manufacturing', 'inspection', 'completed'],
  in_manufacturing: ['inspection', 'completed'],
  inspection: ['completed'],
  completed: ['integrated'],
  integrated: [],
};

export function statusOrder(status: ComponentStatus): number {
  return STATUS_BY_KEY[status].order;
}

export function isDoneStatus(status: ComponentStatus): boolean {
  return STATUS_BY_KEY[status].phase === 'done';
}

export function canTransition(from: ComponentStatus, to: ComponentStatus): boolean {
  if (from === to) return true;
  if (statusOrder(to) < statusOrder(from)) return true;
  return FORWARD_TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: ComponentStatus): ComponentStatus[] {
  return COMPONENT_STATUSES.filter((s) => s.key !== from && canTransition(from, s.key)).map((s) => s.key);
}

// ---------------------------------------------------------------------------

export const PRIORITIES = [
  { key: 'critical', label: 'Crítica', order: 0 },
  { key: 'high', label: 'Alta', order: 1 },
  { key: 'medium', label: 'Media', order: 2 },
  { key: 'low', label: 'Baja', order: 3 },
] as const;
export type Priority = (typeof PRIORITIES)[number]['key'];
export const PRIORITY_KEYS = PRIORITIES.map((p) => p.key) as [Priority, ...Priority[]];
export const PRIORITY_BY_KEY = Object.fromEntries(PRIORITIES.map((p) => [p.key, p])) as Record<
  Priority,
  (typeof PRIORITIES)[number]
>;

// ---------------------------------------------------------------------------

export const USER_ROLES = ['admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const USER_ROLE_LABELS: Record<UserRole, string> = { admin: 'Administrador', member: 'Miembro' };

export const MEMBERSHIP_ROLES = ['lead', 'member'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const PROJECT_STATUSES = [
  { key: 'planning', label: 'Planificación' },
  { key: 'active', label: 'Activo' },
  { key: 'completed', label: 'Completado' },
  { key: 'archived', label: 'Archivado' },
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]['key'];
export const PROJECT_STATUS_KEYS = PROJECT_STATUSES.map((s) => s.key) as [ProjectStatus, ...ProjectStatus[]];

export const MATERIAL_STATUSES = [
  { key: 'to_buy', label: 'Por comprar' },
  { key: 'ordered', label: 'Pedido' },
  { key: 'available', label: 'Disponible' },
] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number]['key'];
export const MATERIAL_STATUS_KEYS = MATERIAL_STATUSES.map((s) => s.key) as [MaterialStatus, ...MaterialStatus[]];

export const MANUFACTURING_PROCESSES = [
  { key: 'cnc', label: 'CNC' },
  { key: 'lathe', label: 'Torno' },
  { key: 'milling', label: 'Fresadora' },
  { key: 'printing_3d', label: 'Impresión 3D' },
  { key: 'layup', label: 'Laminado' },
  { key: 'cutting', label: 'Corte' },
  { key: 'drilling', label: 'Taladrado' },
  { key: 'welding', label: 'Soldadura' },
  { key: 'assembly', label: 'Ensamblaje' },
  { key: 'manual', label: 'Manufactura manual' },
  { key: 'other', label: 'Otro' },
] as const;
export type ManufacturingProcess = (typeof MANUFACTURING_PROCESSES)[number]['key'];
export const MANUFACTURING_PROCESS_KEYS = MANUFACTURING_PROCESSES.map((p) => p.key) as [
  ManufacturingProcess,
  ...ManufacturingProcess[],
];

export const PURCHASE_STATUSES = [
  { key: 'to_buy', label: 'Por comprar' },
  { key: 'ordered', label: 'Pedido' },
  { key: 'in_transit', label: 'En tránsito' },
  { key: 'received', label: 'Recibido' },
  { key: 'cancelled', label: 'Cancelado' },
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]['key'];
export const PURCHASE_STATUS_KEYS = PURCHASE_STATUSES.map((s) => s.key) as [PurchaseStatus, ...PurchaseStatus[]];

export const INSPECTION_RESULTS = [
  { key: 'approved', label: 'Aprobado' },
  { key: 'approved_with_notes', label: 'Aprobado con observaciones' },
  { key: 'rejected', label: 'Rechazado' },
] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number]['key'];
export const INSPECTION_RESULT_KEYS = INSPECTION_RESULTS.map((r) => r.key) as [InspectionResult, ...InspectionResult[]];

export const TEST_STATUSES = [
  { key: 'planned', label: 'Planeada' },
  { key: 'ready', label: 'Preparada' },
  { key: 'executed', label: 'Ejecutada' },
  { key: 'passed', label: 'Aprobada' },
  { key: 'failed', label: 'Fallida' },
] as const;
export type TestStatus = (typeof TEST_STATUSES)[number]['key'];
export const TEST_STATUS_KEYS = TEST_STATUSES.map((s) => s.key) as [TestStatus, ...TestStatus[]];

// ---------------------------------------------------------------------------

export const ACTIVITY_ACTIONS = [
  'created',
  'updated',
  'status_changed',
  'deleted',
  'dependency_added',
  'dependency_removed',
  'collaborator_added',
  'collaborator_removed',
  'member_added',
  'member_removed',
  'file_added',
  'file_removed',
  'inspected',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ENTITY_TYPES = ['project', 'system', 'component', 'milestone', 'purchase', 'inspection', 'test', 'work_log'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Human-readable labels for component fields (used by the activity feed). */
export const COMPONENT_FIELD_LABELS: Record<string, string> = {
  name: 'nombre',
  code: 'código',
  description: 'descripción',
  systemId: 'sistema',
  subsystem: 'subsistema',
  quantity: 'cantidad',
  responsibleId: 'responsable',
  priority: 'prioridad',
  status: 'estado',
  startDate: 'fecha de inicio',
  dueDate: 'fecha límite',
  material: 'material',
  materialQty: 'cantidad de material',
  materialUnit: 'unidad de material',
  supplier: 'proveedor',
  materialStatus: 'disponibilidad de material',
  designerId: 'diseñador',
  designNotes: 'notas de diseño',
  estMaterialCost: 'costo estimado de material',
  estManufacturingCost: 'costo estimado de manufactura',
  estShippingCost: 'costo estimado de envío',
  estAdditionalCost: 'costos adicionales estimados',
  actualCost: 'costo real',
  // purchases
  unitCost: 'costo unitario',
  shippingCost: 'costo de envío',
  additionalCost: 'costos adicionales',
  leadTimeDays: 'tiempo de entrega (días)',
  orderedAt: 'fecha de pedido',
  expectedAt: 'fecha esperada',
  receivedAt: 'fecha de recepción',
  url: 'enlace',
  requestedById: 'solicitado por',
  componentIds: 'componentes asociados',
  // tests
  type: 'tipo',
  objective: 'objetivo',
  result: 'resultado',
  observations: 'observaciones',
  date: 'fecha',
  process: 'proceso',
  machine: 'máquina',
  workshop: 'taller',
  setupMinutes: 'tiempo de preparación',
  machineMinutes: 'tiempo de máquina',
  finishingMinutes: 'tiempo de acabado',
  inspectionMinutes: 'tiempo de inspección',
  scheduledDate: 'fecha programada',
  actualDate: 'fecha real',
  needsWorkshop: 'necesita taller',
  needsExternal: 'necesita proveedor externo',
  // work logs
  componentId: 'componente',
  minutes: 'tiempo trabajado',
  subject: 'documento o tarea',
  progress: 'avance',
  pending: 'pendiente',
};

/** Estimated cost categories of a component (order matters for display). */
export const COST_CATEGORIES = [
  { key: 'estMaterialCost', label: 'Material' },
  { key: 'estManufacturingCost', label: 'Manufactura' },
  { key: 'estShippingCost', label: 'Envío' },
  { key: 'estAdditionalCost', label: 'Adicionales' },
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number]['key'];

export const FILE_CATEGORIES = [
  { key: 'drawing', label: 'Plano' },
  { key: 'cad', label: 'CAD' },
  { key: 'datasheet', label: 'Datasheet' },
  { key: 'photo', label: 'Fotografía' },
  { key: 'manufacturing', label: 'Doc. de fabricación' },
  { key: 'test_result', label: 'Resultado de prueba' },
  { key: 'other', label: 'Otro' },
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number]['key'];
export const FILE_CATEGORY_KEYS = FILE_CATEGORIES.map((f) => f.key) as [FileCategory, ...FileCategory[]];

export const FILE_ENTITY_TYPES = ['component', 'test', 'inspection', 'project'] as const;
export type FileEntityType = (typeof FILE_ENTITY_TYPES)[number];

/** Suggested test types (free text is allowed). */
export const TEST_TYPE_SUGGESTIONS = ['Estructural', 'Funcional', 'Eléctrica', 'Software', 'Ambiental', 'Prueba estática', 'Prueba de eyección', 'Prueba de caída', 'Integración', 'Otro'];

export const DUE_SOON_DAYS = 7;
export const MAX_FILE_SIZE_MB = 50;
