import { ActivityFeed } from '@/components/domain/activity-feed';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { useProject } from '@/hooks/use-project';
import { useActivity } from '@/lib/queries';
import * as React from 'react';
import { useSearchParams } from 'react-router';

export function ActivityPage() {
  const { project, members } = useProject();
  const [params, setParams] = useSearchParams();
  const userId = params.get('user') ?? '';
  const entityType = params.get('type') ?? '';
  const activity = useActivity(project.id, { userId: userId || undefined, entityType: entityType || undefined, limit: 150 });

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Actividad"
        description="Historial automático de cambios del proyecto: estados, costos, asignaciones, dependencias."
        actions={
          <>
            <NativeSelect value={userId} onChange={(e) => set('user', e.target.value)} className="h-8 w-44 text-xs">
              <option value="">Todas las personas</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={entityType} onChange={(e) => set('type', e.target.value)} className="h-8 w-40 text-xs">
              <option value="">Todo</option>
              <option value="component">Componentes</option>
              <option value="system">Sistemas</option>
              <option value="project">Proyecto</option>
              <option value="milestone">Hitos</option>
              <option value="work_log">Bitácora</option>
            </NativeSelect>
          </>
        }
      />
      <Card>
        <CardContent className="pt-1 pb-1">
          {activity.isLoading ? (
            <div className="flex flex-col gap-3 py-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : (
            <ActivityFeed logs={activity.data?.activity ?? []} />
          )}
          {activity.data?.hasMore ? <p className="py-3 text-center text-xs text-muted-foreground">Mostrando los últimos 150 eventos. Filtra por persona o tipo para ver más atrás.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
