import type {
  ActivityAction,
  ComponentStatus,
  EntityType,
  FileCategory,
  FileEntityType,
  InspectionResult,
  ManufacturingProcess,
  MaterialStatus,
  MembershipRole,
  Priority,
  ProjectStatus,
  PurchaseStatus,
  TestStatus,
  UserRole,
} from './constants.js';

// Dates are ISO `YYYY-MM-DD` strings; timestamps are ISO 8601 strings.

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
}

export interface User extends UserSummary {
  role: UserRole;
  createdAt: string;
}

export interface SessionUser extends User {
  /** Projects where the user is a member, with role. Admins get all projects. */
  memberships: { projectId: string; role: MembershipRole }[];
  systemLeadIds: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  competition: string | null;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  budget: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember extends UserSummary {
  role: MembershipRole;
}

export interface SystemMember extends UserSummary {
  role: MembershipRole;
}

export interface System {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description: string | null;
  budget: number | null;
  sortOrder: number;
  members: SystemMember[];
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  date: string;
  description: string | null;
  completedAt: string | null;
}

export interface Manufacturing {
  process: ManufacturingProcess | null;
  machine: string | null;
  workshop: string | null;
  setupMinutes: number;
  machineMinutes: number;
  finishingMinutes: number;
  inspectionMinutes: number;
  responsibleId: string | null;
  scheduledDate: string | null;
  actualDate: string | null;
  needsWorkshop: boolean;
  needsExternal: boolean;
  notes: string | null;
}

export interface Component {
  id: string;
  projectId: string;
  systemId: string;
  code: string;
  name: string;
  description: string | null;
  subsystem: string | null;
  quantity: number;
  responsibleId: string | null;
  priority: Priority;
  status: ComponentStatus;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  material: string | null;
  materialQty: number | null;
  materialUnit: string | null;
  supplier: string | null;
  materialStatus: MaterialStatus | null;
  designerId: string | null;
  designApprovedAt: string | null;
  designNotes: string | null;
  estMaterialCost: number;
  estManufacturingCost: number;
  estShippingCost: number;
  estAdditionalCost: number;
  actualCost: number | null;
  createdAt: string;
  updatedAt: string;
  collaboratorIds: string[];
  /** ids of components this one depends on */
  dependsOn: string[];
  /** ids of components depending on this one */
  dependents: string[];
  manufacturing: Manufacturing | null;
}

export interface Dependency {
  componentId: string;
  dependsOnId: string;
}

export interface ActivityChange {
  field: string;
  from: unknown;
  to: unknown;
  fromLabel?: string | null;
  toLabel?: string | null;
}

export interface ActivityLog {
  id: string;
  projectId: string;
  entityType: EntityType;
  entityId: string;
  entityLabel: string | null;
  userId: string | null;
  userName: string | null;
  action: ActivityAction;
  changes: ActivityChange[] | null;
  note: string | null;
  createdAt: string;
}

export interface Purchase {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  quantity: number;
  unitCost: number;
  shippingCost: number;
  additionalCost: number;
  supplier: string | null;
  url: string | null;
  status: PurchaseStatus;
  leadTimeDays: number | null;
  orderedAt: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  requestedById: string | null;
  notes: string | null;
  componentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Inspection {
  id: string;
  componentId: string;
  inspectorId: string | null;
  date: string;
  result: InspectionResult;
  observations: string | null;
  createdAt: string;
}

export interface Test {
  id: string;
  projectId: string;
  systemId: string | null;
  componentId: string | null;
  name: string;
  type: string | null;
  date: string | null;
  responsibleId: string | null;
  objective: string | null;
  result: string | null;
  status: TestStatus;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLog {
  id: string;
  projectId: string;
  userId: string | null;
  componentId: string | null;
  /** document or task worked on, when it is not (only) a component */
  subject: string | null;
  date: string;
  minutes: number;
  progress: string | null;
  pending: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileItem {
  id: string;
  projectId: string;
  entityType: FileEntityType;
  entityId: string;
  category: FileCategory;
  name: string;
  mime: string | null;
  size: number | null;
  uploadedById: string | null;
  createdAt: string;
}

export interface ProjectBundle {
  project: Project;
  members: ProjectMember[];
  systems: System[];
  components: Component[];
  milestones: Milestone[];
  purchases: Purchase[];
  tests: Test[];
  inspections: Inspection[];
  files: FileItem[];
}

/** Historical metrics computed server-side from the activity log and current data. */
export interface ProjectMetrics {
  /** components that went backwards in the workflow at least once (rework) */
  reworkedComponents: { id: string; code: string; name: string; count: number }[];
  /** days from entering manufacturing to completion, per completed component */
  manufacturingDurations: { id: string; code: string; name: string; days: number }[];
  avgManufacturingDays: number | null;
  /** purchases with ordered and received dates */
  acquisitionTimes: { id: string; name: string; days: number }[];
  avgAcquisitionDays: number | null;
  /** schedule: due date vs completed date for completed components */
  scheduleVariance: { id: string; code: string; name: string; days: number }[];
  avgScheduleVarianceDays: number | null;
  onTimeRate: number | null;
  /** cost: estimated vs real for components with a known real cost */
  costVariance: { id: string; code: string; name: string; estimated: number; actual: number }[];
  totalEstimatedKnown: number;
  totalActualKnown: number;
  testsFailed: number;
  testsPassed: number;
  inspectionsRejected: number;
  inspectionsTotal: number;
  statusChangesLast30Days: number;
  activeContributorsLast30Days: number;
}

export interface SearchResult {
  type: 'component' | 'system' | 'user' | 'project' | 'milestone' | 'purchase' | 'file';
  id: string;
  title: string;
  subtitle: string | null;
  projectId: string | null;
  /** for files: the entity they belong to */
  entityType?: string;
  entityId?: string;
}
