import { WorkLogDialog } from '@/components/domain/work-log-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { EmptyState, PageHeader, Progress, Skeleton, Stat, UserChip } from '@/components/ui/misc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProject } from '@/hooks/use-project';
import { formatDate } from '@/lib/format';
import { useWorkLogs } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { addDaysISO, formatDuration, type WorkLog } from '@rdms/shared';
import { NotebookPen, Pencil, Plus } from 'lucide-react';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router';

const PERIODS = [
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'all', label: 'Todo' },
] as const;
type Period = (typeof PERIODS)[number]['key'];

const sumMinutes = (logs: WorkLog[]) => logs.reduce((acc, l) => acc + l.minutes, 0);

function Breakdown({ title, rows, onSelect, selected }: { title: string; rows: { key: string; label: React.ReactNode; minutes: number }[]; onSelect?: (key: string) => void; selected?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {rows.length === 0 ? <p className="text-xs text-muted-foreground">Sin registros en este periodo.</p> : null}
        {rows.map((r) => {
          const Row = onSelect ? 'button' : 'div';
          return (
            <Row key={r.key} onClick={onSelect ? () => onSelect(r.key) : undefined} className={cn('flex flex-col gap-1 rounded-md text-left', onSelect && 'cursor-pointer hover:opacity-80', selected === r.key && 'font-semibold')}>
              <span className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="shrink-0 tabular text-muted-foreground">{formatDuration(r.minutes)}</span>
              </span>
              <Progress value={(r.minutes / max) * 100} tone="primary" size="sm" />
            </Row>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function WorkLogPage() {
  const { project, members, componentsById, usersById, canManageProject, user, today } = useProject();
  const [params, setParams] = useSearchParams();
  const userFilter = params.get('user') ?? '';
  const period = PERIODS.find((p) => p.key === params.get('period'))?.key ?? ('30d' satisfies Period);
  const [editing, setEditing] = React.useState<WorkLog | null | 'new'>(null);
  const query = useWorkLogs(project.id);
  const logs = query.data ?? [];

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const weekStart = addDaysISO(today, -((new Date(`${today}T00:00:00`).getDay() + 6) % 7));
  const from = period === 'week' ? weekStart : period === 'month' ? `${today.slice(0, 8)}01` : period === '30d' ? addDaysISO(today, -29) : '';
  const inPeriod = logs.filter((l) => !from || l.date >= from);
  const filtered = inPeriod.filter((l) => !userFilter || l.userId === userFilter);
  const canEditLog = (l: WorkLog) => canManageProject || l.userId === user.id;

  const targetLabel = (l: WorkLog) => {
    const comp = l.componentId ? componentsById.get(l.componentId) : null;
    return comp ? `${comp.code} · ${comp.name}` : (l.subject ?? 'Sin especificar');
  };

  const byUser = new Map<string, number>();
  for (const l of inPeriod) byUser.set(l.userId ?? '', (byUser.get(l.userId ?? '') ?? 0) + l.minutes);
  const userRows = [...byUser].sort((a, b) => b[1] - a[1]).map(([id, minutes]) => ({ key: id, label: usersById.get(id)?.name ?? 'Usuario eliminado', minutes }));

  const byTarget = new Map<string, number>();
  for (const l of filtered) byTarget.set(targetLabel(l), (byTarget.get(targetLabel(l)) ?? 0) + l.minutes);
  const targetRows = [...byTarget].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, minutes]) => ({ key: label, label, minutes }));

  const personOptions = [...members];
  for (const id of byUser.keys()) {
    const u = usersById.get(id);
    if (u && !personOptions.some((m) => m.id === id)) personOptions.push({ ...u, role: 'member' });
  }

  const newButton = (
    <Button onClick={() => setEditing('new')}>
      <Plus /> Registrar trabajo
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bitácora"
        description="Registro de trabajo del equipo: quién trabajó, qué día, cuánto tiempo, en qué pieza o documento, el avance y lo que queda pendiente."
        actions={
          <>
            <NativeSelect value={userFilter} onChange={(e) => update('user', e.target.value || null)} className="h-8 w-44 text-xs">
              <option value="">Todas las personas</option>
              {personOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={period} onChange={(e) => update('period', e.target.value)} className="h-8 w-40 text-xs">
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
            {newButton}
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tiempo registrado" value={formatDuration(sumMinutes(filtered))} hint={PERIODS.find((p) => p.key === period)?.label} />
        <Stat label="Registros" value={filtered.length} />
        <Stat label="Personas" value={new Set(filtered.map((l) => l.userId)).size} />
        <Stat label="Mi tiempo esta semana" value={formatDuration(sumMinutes(logs.filter((l) => l.userId === user.id && l.date >= weekStart)))} tone="info" />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {query.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : query.error ? (
            <EmptyState icon={NotebookPen} title="No se pudo cargar la bitácora" description={query.error.message} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={NotebookPen} title={logs.length ? 'Sin registros con estos filtros' : 'Todavía no hay registros'} description="Anota cada sesión de trabajo: día, duración, pieza o documento, avance y pendientes." action={newButton} />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Día</TableHead>
                    <TableHead>Trabajó en</TableHead>
                    <TableHead>Tiempo</TableHead>
                    <TableHead className="hidden md:table-cell">Avance y pendientes</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const comp = l.componentId ? componentsById.get(l.componentId) : null;
                    const notes = (
                      <div className="flex flex-col gap-1 whitespace-pre-wrap text-xs">
                        {l.progress ? <p>{l.progress}</p> : null}
                        {l.pending ? (
                          <p>
                            <span className="font-medium text-amber-700">Pendiente: </span>
                            {l.pending}
                          </p>
                        ) : null}
                        {!l.progress && !l.pending ? <span className="text-muted-foreground">—</span> : null}
                      </div>
                    );
                    return (
                      <TableRow key={l.id} className="align-top">
                        <TableCell className="whitespace-nowrap text-xs">
                          <div className="font-medium">{formatDate(l.date, 'EEE d MMM')}</div>
                          <UserChip user={l.userId ? usersById.get(l.userId) : null} size="xs" className="mt-1 text-[11px]" muted />
                        </TableCell>
                        <TableCell className="text-xs">
                          {comp ? (
                            <Link to={`/p/${project.id}/components/${comp.id}`} className="hover:underline">
                              <span className="font-mono text-muted-foreground">{comp.code}</span> {comp.name}
                            </Link>
                          ) : null}
                          {l.subject ? <div className={cn(comp && 'text-muted-foreground')}>{l.subject}</div> : null}
                          {!comp && !l.subject ? <span className="text-muted-foreground">Sin especificar</span> : null}
                          <div className="mt-1.5 md:hidden">{notes}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs font-medium tabular">{formatDuration(l.minutes)}</TableCell>
                        <TableCell className="hidden md:table-cell">{notes}</TableCell>
                        <TableCell>
                          {canEditLog(l) ? (
                            <Button variant="ghost" size="icon-xs" aria-label="Editar registro" onClick={() => setEditing(l)}>
                              <Pencil />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Breakdown title="Tiempo por persona" rows={userRows} selected={userFilter} onSelect={(id) => update('user', userFilter === id || !id ? null : id)} />
          <Breakdown title="Tiempo por pieza o documento" rows={targetRows} />
        </div>
      </div>

      <WorkLogDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} log={editing === 'new' ? null : editing} />
    </div>
  );
}
