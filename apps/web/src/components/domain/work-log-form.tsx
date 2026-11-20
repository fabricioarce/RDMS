import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useProject } from '@/hooks/use-project';
import { useWorkLogMutation } from '@/lib/queries';
import { strOrNull } from '@/lib/utils';
import type { WorkLog, WorkLogInput } from '@rdms/shared';
import { Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

interface State {
  date: string;
  hours: string;
  mins: string;
  componentId: string;
  subject: string;
  progress: string;
  pending: string;
}

const fromLog = (l: WorkLog | null, d: { today: string; componentId?: string }): State => ({
  date: l?.date ?? d.today,
  hours: l ? String(Math.floor(l.minutes / 60)) : '',
  mins: l ? String(l.minutes % 60) : '',
  componentId: l?.componentId ?? d.componentId ?? '',
  subject: l?.subject ?? '',
  progress: l?.progress ?? '',
  pending: l?.pending ?? '',
});

export function WorkLogDialog({ open, onOpenChange, log = null, defaultComponentId }: { open: boolean; onOpenChange: (o: boolean) => void; log?: WorkLog | null; defaultComponentId?: string }) {
  const { project, systems, components, usersById, user, today, canManageProject } = useProject();
  const mutation = useWorkLogMutation(project.id);
  const canDelete = !!log && (canManageProject || log.userId === user.id);
  const author = log?.userId && log.userId !== user.id ? usersById.get(log.userId) : null;
  const [form, setForm] = React.useState<State>(() => fromLog(log, { today, componentId: defaultComponentId }));
  const set = <K extends keyof State>(k: K, v: State[K]) => setForm((f) => ({ ...f, [k]: v }));

  React.useEffect(() => {
    if (open) setForm(fromLog(log, { today, componentId: defaultComponentId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, log?.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = Math.round((Number(form.hours) || 0) * 60 + (Number(form.mins) || 0));
    if (!form.date) return toast.error('Indica el día en que trabajaste');
    if (minutes <= 0) return toast.error('Indica cuánto tiempo trabajaste');
    if (minutes > 24 * 60) return toast.error('Un registro no puede superar las 24 horas');
    if (!form.componentId && !form.subject.trim()) return toast.error('Indica la pieza o el documento en el que trabajaste');
    const input: WorkLogInput = {
      date: form.date,
      minutes,
      componentId: form.componentId || null,
      subject: strOrNull(form.subject),
      progress: strOrNull(form.progress),
      pending: strOrNull(form.pending),
    };
    mutation.mutate(
      { id: log?.id, input },
      {
        onSuccess: () => {
          toast.success(log ? 'Registro actualizado' : 'Trabajo registrado');
          onOpenChange(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{log ? 'Editar registro' : 'Registrar trabajo'}</DialogTitle>
            <DialogDescription>{author ? `Registro de ${author.name}.` : 'Qué día trabajaste, cuánto tiempo, en qué y cómo quedó.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Día" className="sm:col-span-2">
              <Input type="date" value={form.date} max={today} onChange={(e) => set('date', e.target.value)} required />
            </Field>
            <Field label="Horas">
              <Input type="number" min={0} max={24} step={1} inputMode="numeric" value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="0" autoFocus={!log} />
            </Field>
            <Field label="Minutos">
              <Input type="number" min={0} max={59} step={5} inputMode="numeric" value={form.mins} onChange={(e) => set('mins', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Pieza" className="sm:col-span-2">
              <NativeSelect value={form.componentId} onChange={(e) => set('componentId', e.target.value)}>
                <option value="">— Ninguna —</option>
                {systems.map((s) => (
                  <optgroup key={s.id} label={`${s.code} · ${s.name}`}>
                    {components
                      .filter((c) => c.systemId === s.id)
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Documento o tarea" className="sm:col-span-2">
              <Input value={form.subject} onChange={(e) => set('subject', e.target.value)} maxLength={200} placeholder="Ej: Reporte técnico, plano de aletas…" />
            </Field>
            <Field label="Avance y observaciones" className="sm:col-span-4">
              <Textarea value={form.progress} onChange={(e) => set('progress', e.target.value)} rows={3} placeholder="Qué se hizo y cómo va" />
            </Field>
            <Field label="Pendiente" className="sm:col-span-4">
              <Textarea value={form.pending} onChange={(e) => set('pending', e.target.value)} rows={2} placeholder="Qué falta por hacer" />
            </Field>
          </div>
          <DialogFooter className="sm:justify-between">
            {canDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm('¿Eliminar este registro de la bitácora?')) {
                    mutation.mutate({ id: log!.id, remove: true }, { onSuccess: () => { toast.success('Registro eliminado'); onOpenChange(false); }, onError: (e) => toast.error(e.message) });
                  }
                }}
              >
                <Trash2 /> Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={mutation.isPending}>
                {log ? 'Guardar' : 'Registrar'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
