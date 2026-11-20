import { DUE_SOON_DAYS, isDoneStatus, MANUFACTURING_PROCESSES, STATUS_BY_KEY, statusOrder, type ComponentStatus } from './constants.js';
import type { Component, Manufacturing, Purchase } from './types.js';

// ---------------------------------------------------------------------------
// Pure helpers. Everything here is DERIVED from stored data and never persisted.
// ---------------------------------------------------------------------------

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISO}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

type Lifecycle = Pick<Component, 'status' | 'dueDate'>;

export function isDone(c: Pick<Component, 'status'>): boolean {
  return isDoneStatus(c.status);
}

export function isOverdue(c: Lifecycle, today: string = todayISO()): boolean {
  return !isDone(c) && !!c.dueDate && c.dueDate < today;
}

export function isDueSoon(c: Lifecycle, today: string = todayISO(), days: number = DUE_SOON_DAYS): boolean {
  if (isDone(c) || !c.dueDate) return false;
  return c.dueDate >= today && c.dueDate <= addDaysISO(today, days);
}

export function statusProgress(status: ComponentStatus): number {
  return STATUS_BY_KEY[status].progress;
}

export interface ProgressSummary {
  total: number;
  completed: number;
  /** Weighted by status progress (0-100). */
  percent: number;
}

export function computeProgress(components: Pick<Component, 'status'>[]): ProgressSummary {
  const total = components.length;
  if (total === 0) return { total: 0, completed: 0, percent: 0 };
  const completed = components.filter(isDone).length;
  const sum = components.reduce((acc, c) => acc + statusProgress(c.status), 0);
  return { total, completed, percent: Math.round(sum / total) };
}

// ---------------------------------------------------------------------------
// Dependencies / blocking
//
// Rule: X is BLOCKED by Y when X is not done, Y is not done, and Y is at an
// earlier stage than X (Y is lagging behind X). X is merely WAITING on Y when
// Y is simply not done yet (soft, informational).
// ---------------------------------------------------------------------------

export interface BlockInfo {
  /** components blocking this one (lagging behind) */
  blockedBy: string[];
  /** unfinished dependencies that are not (yet) lagging */
  waitingOn: string[];
  /** unfinished components that depend on this one */
  blocking: string[];
}

type DepComponent = Pick<Component, 'id' | 'status' | 'dependsOn'>;

export function computeBlocking(components: DepComponent[]): Map<string, BlockInfo> {
  const byId = new Map(components.map((c) => [c.id, c]));
  const info = new Map<string, BlockInfo>();
  for (const c of components) info.set(c.id, { blockedBy: [], waitingOn: [], blocking: [] });

  for (const c of components) {
    if (isDone(c)) continue;
    const me = info.get(c.id)!;
    for (const depId of c.dependsOn) {
      const dep = byId.get(depId);
      if (!dep || isDone(dep)) continue;
      if (statusOrder(dep.status) < statusOrder(c.status)) {
        me.blockedBy.push(depId);
        info.get(depId)!.blocking.push(c.id);
      } else {
        me.waitingOn.push(depId);
      }
    }
  }
  return info;
}

export function isBlocked(c: DepComponent, blocking: Map<string, BlockInfo>): boolean {
  return (blocking.get(c.id)?.blockedBy.length ?? 0) > 0;
}

/** Returns true if adding edge (componentId depends on dependsOnId) would create a cycle. */
export function wouldCreateCycle(
  components: Pick<Component, 'id' | 'dependsOn'>[],
  componentId: string,
  dependsOnId: string,
): boolean {
  if (componentId === dependsOnId) return true;
  const byId = new Map(components.map((c) => [c.id, c]));
  // Walk from dependsOnId through its own dependencies; if we reach componentId, it's a cycle.
  const stack = [dependsOnId];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === componentId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const node = byId.get(cur);
    if (node) stack.push(...node.dependsOn);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Costs
//
//  estimated  = Σ component estimates (material + manufactura + envío + adicionales)
//  committed  = Σ purchases ordered / in transit (money promised, not yet spent)
//  planned    = Σ purchases still "to buy"
//  spent      = Σ component real cost  +  Σ received purchases not linked to any component
//  component real cost = actualCost if typed, otherwise the sum of its received purchases
// ---------------------------------------------------------------------------

export function estimatedCost(c: Pick<Component, 'estMaterialCost' | 'estManufacturingCost' | 'estShippingCost' | 'estAdditionalCost'>): number {
  return (c.estMaterialCost ?? 0) + (c.estManufacturingCost ?? 0) + (c.estShippingCost ?? 0) + (c.estAdditionalCost ?? 0);
}

export function purchaseTotal(p: Pick<Purchase, 'quantity' | 'unitCost' | 'shippingCost' | 'additionalCost'>): number {
  return (p.quantity ?? 0) * (p.unitCost ?? 0) + (p.shippingCost ?? 0) + (p.additionalCost ?? 0);
}

export const PURCHASE_OPEN_STATUSES = ['to_buy', 'ordered', 'in_transit'] as const;

/** Received purchases linked to a component, summed. */
export function linkedReceivedPurchases(componentId: string, purchases: Purchase[]): number {
  let sum = 0;
  for (const p of purchases) if (p.status === 'received' && p.componentIds.includes(componentId)) sum += purchaseTotal(p);
  return sum;
}

/** Real cost of a component: typed value, or its received purchases, or null when unknown. */
export function componentRealCost(c: Pick<Component, 'id' | 'actualCost'>, purchases: Purchase[]): number | null {
  if (c.actualCost != null) return c.actualCost;
  const linked = linkedReceivedPurchases(c.id, purchases);
  return linked > 0 ? linked : null;
}

export interface CostSummary {
  estimated: number;
  /** money actually spent (see rules above) */
  actual: number;
  /** purchases ordered or in transit */
  committed: number;
  /** purchases still to buy */
  planned: number;
  /** estimated cost of components whose real cost is still unknown */
  remainingEstimate: number;
}

/**
 * @param includeUnlinked count purchases that are not linked to any component
 *        (true for the whole project, false when summarizing a single system)
 */
export function computeCosts(components: Component[], purchases: Purchase[] = [], includeUnlinked = true): CostSummary {
  let estimated = 0;
  let actual = 0;
  let remainingEstimate = 0;
  const ids = new Set(components.map((c) => c.id));
  for (const c of components) {
    const est = estimatedCost(c);
    estimated += est;
    const real = componentRealCost(c, purchases);
    if (real != null) actual += real;
    else remainingEstimate += est;
  }
  let committed = 0;
  let planned = 0;
  for (const p of purchases) {
    const relevant = p.componentIds.length === 0 ? includeUnlinked : p.componentIds.some((id) => ids.has(id));
    if (!relevant) continue;
    const total = purchaseTotal(p);
    if (p.status === 'ordered' || p.status === 'in_transit') committed += total;
    else if (p.status === 'to_buy') planned += total;
    else if (p.status === 'received' && p.componentIds.length === 0) actual += total;
  }
  return { estimated, actual, committed, planned, remainingEstimate };
}

/** Purchases relevant to a subset of components (linked to at least one of them). */
export function purchasesForComponents(componentIds: Set<string>, purchases: Purchase[]): Purchase[] {
  return purchases.filter((p) => p.componentIds.some((id) => componentIds.has(id)));
}

// ---------------------------------------------------------------------------
// Purchases: expected arrival and criticality
// ---------------------------------------------------------------------------

/** Best-known arrival date for a purchase, or null when it cannot be estimated. */
export function purchaseArrival(p: Purchase, today: string = todayISO()): string | null {
  if (p.status === 'received') return p.receivedAt;
  if (p.status === 'cancelled') return null;
  if (p.expectedAt) return p.expectedAt;
  if (p.leadTimeDays != null) return addDaysISO(p.orderedAt ?? today, p.leadTimeDays);
  return null;
}

export interface PurchaseRisk {
  purchase: Purchase;
  component: Component;
  arrival: string | null;
  /** days the arrival lands after the component due date (positive = late) */
  daysLate: number | null;
  reason: 'late' | 'not_ordered_needed' ;
}

/**
 * A purchase is critical when its arrival lands after the due date of a linked
 * component, or when it is still "to buy" while a linked component already waits for it
 * (pending manufacturing or later).
 */
export function purchaseRisks(purchases: Purchase[], componentsById: Map<string, Component>, today: string = todayISO()): PurchaseRisk[] {
  const risks: PurchaseRisk[] = [];
  for (const p of purchases) {
    if (p.status === 'received' || p.status === 'cancelled') continue;
    const arrival = purchaseArrival(p, today);
    for (const id of p.componentIds) {
      const c = componentsById.get(id);
      if (!c || isDone(c)) continue;
      if (arrival && c.dueDate && arrival > c.dueDate) {
        risks.push({ purchase: p, component: c, arrival, daysLate: daysBetween(c.dueDate, arrival), reason: 'late' });
      } else if (p.status === 'to_buy' && statusOrder(c.status) >= statusOrder('pending_manufacturing')) {
        risks.push({ purchase: p, component: c, arrival, daysLate: null, reason: 'not_ordered_needed' });
      }
    }
  }
  return risks.sort((a, b) => (b.daysLate ?? 0) - (a.daysLate ?? 0));
}

// ---------------------------------------------------------------------------
// Summary (dashboard / system cards / reports)
// ---------------------------------------------------------------------------

export interface ComponentsSummary extends ProgressSummary {
  overdue: number;
  dueSoon: number;
  blocked: number;
  /** components that are blocking at least one other */
  bottlenecks: number;
  inManufacturing: number;
  pendingManufacturing: number;
  pendingDesign: number;
  inspection: number;
  unassigned: number;
  critical: number;
  costs: CostSummary;
  workshopHours: number;
  pendingWorkshopHours: number;
}

export function summarizeComponents(components: Component[], blocking: Map<string, BlockInfo>, today: string = todayISO(), purchases: Purchase[] = [], includeUnlinkedPurchases = true): ComponentsSummary {
  const progress = computeProgress(components);
  let overdue = 0,
    dueSoon = 0,
    blocked = 0,
    bottlenecks = 0,
    inManufacturing = 0,
    pendingManufacturing = 0,
    pendingDesign = 0,
    inspection = 0,
    unassigned = 0,
    critical = 0;
  for (const c of components) {
    const done = isDone(c);
    if (isOverdue(c, today)) overdue++;
    if (isDueSoon(c, today)) dueSoon++;
    const b = blocking.get(c.id);
    if ((b?.blockedBy.length ?? 0) > 0) blocked++;
    if ((b?.blocking.length ?? 0) > 0) bottlenecks++;
    if (c.status === 'in_manufacturing') inManufacturing++;
    if (c.status === 'pending_manufacturing') pendingManufacturing++;
    if (c.status === 'idea' || c.status === 'design') pendingDesign++;
    if (c.status === 'inspection') inspection++;
    if (!done && !c.responsibleId) unassigned++;
    if (!done && c.priority === 'critical') critical++;
  }
  return {
    ...progress,
    overdue,
    dueSoon,
    blocked,
    bottlenecks,
    inManufacturing,
    pendingManufacturing,
    pendingDesign,
    inspection,
    unassigned,
    critical,
    costs: computeCosts(components, purchases, includeUnlinkedPurchases),
    workshopHours: manufacturingHours(components),
    pendingWorkshopHours: manufacturingHours(components, true),
  };
}

/** `90` → `1 h 30 min` */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// ---------------------------------------------------------------------------
// Manufacturing
// ---------------------------------------------------------------------------

export function manufacturingMinutes(m: Manufacturing | null | undefined): number {
  if (!m) return 0;
  return (m.setupMinutes ?? 0) + (m.machineMinutes ?? 0) + (m.finishingMinutes ?? 0) + (m.inspectionMinutes ?? 0);
}

export function manufacturingHours(components: Pick<Component, 'manufacturing' | 'quantity' | 'status'>[], onlyPending = false): number {
  let minutes = 0;
  for (const c of components) {
    if (onlyPending && isDone(c)) continue;
    minutes += manufacturingMinutes(c.manufacturing) * Math.max(1, c.quantity ?? 1);
  }
  return Math.round((minutes / 60) * 10) / 10;
}

export interface WorkshopGroup {
  key: string;
  label: string;
  workshop: string | null;
  components: Component[];
  /** total minutes for open components (× quantity) */
  pendingMinutes: number;
  /** total minutes for all components (× quantity) */
  totalMinutes: number;
}

/** Groups fabricable components by machine (fallback: process) for the workshop view. */
export function groupByMachine(components: Component[]): WorkshopGroup[] {
  const groups = new Map<string, WorkshopGroup>();
  for (const c of components) {
    const m = c.manufacturing;
    if (!m) continue;
    const processLabel = m.process ? (MANUFACTURING_PROCESSES.find((p) => p.key === m.process)?.label ?? m.process) : null;
    const label = m.machine?.trim() || processLabel || 'Sin máquina asignada';
    const key = label.toLowerCase();
    const g = groups.get(key) ?? { key, label, workshop: m.workshop, components: [], pendingMinutes: 0, totalMinutes: 0 };
    const minutes = manufacturingMinutes(m) * Math.max(1, c.quantity ?? 1);
    g.components.push(c);
    g.totalMinutes += minutes;
    if (!isDone(c)) g.pendingMinutes += minutes;
    if (!g.workshop && m.workshop) g.workshop = m.workshop;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.pendingMinutes - a.pendingMinutes);
}

/** Components that are (or will be) fabricated: have manufacturing data or are in a manufacturing stage. */
export function isFabricable(c: Component): boolean {
  return !!c.manufacturing || c.status === 'pending_manufacturing' || c.status === 'in_manufacturing';
}
