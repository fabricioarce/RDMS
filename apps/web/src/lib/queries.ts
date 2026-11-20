import { api } from '@/lib/api';
import type {
  ActivityLog,
  ChangeStatusInput,
  Component,
  CreateComponentInput,
  CreateProjectInput,
  CreateSystemInput,
  CreateUserInput,
  FileCategory,
  FileEntityType,
  FileItem,
  Inspection,
  InspectionInput,
  ManufacturingInput,
  MembershipInput,
  Milestone,
  MilestoneInput,
  Project,
  ProjectBundle,
  ProjectMember,
  ProjectMetrics,
  ProgressSummary,
  Purchase,
  PurchaseInput,
  SearchResult,
  SessionUser,
  System,
  Test,
  TestInput,
  UpdateComponentInput,
  UpdateProjectInput,
  UpdatePurchaseInput,
  UpdateSystemInput,
  UpdateTestInput,
  UpdateUserInput,
  UpdateWorkLogInput,
  User,
  WorkLog,
  WorkLogInput,
} from '@rdms/shared';
import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';

export const keys = {
  me: ['me'] as const,
  users: ['users'] as const,
  projects: ['projects'] as const,
  bundle: (projectId: string) => ['bundle', projectId] as const,
  activity: (projectId: string, filters?: Record<string, string | undefined>) => ['activity', projectId, filters ?? {}] as const,
  componentActivity: (projectId: string, componentId: string) => ['component-activity', projectId, componentId] as const,
  search: (q: string, projectId?: string) => ['search', q, projectId ?? ''] as const,
  metrics: (projectId: string) => ['metrics', projectId] as const,
  workLogs: (projectId: string) => ['work-logs', projectId] as const,
};

export type ProjectListItem = Project & { progress: ProgressSummary; memberCount: number };

// ----------------------------------------------------------------- queries

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => (await api.get<{ user: SessionUser }>('/auth/me')).user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: keys.users,
    queryFn: async () => (await api.get<{ users: User[] }>('/users')).users,
    staleTime: 60 * 1000,
    enabled,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: async () => (await api.get<{ projects: ProjectListItem[] }>('/projects')).projects,
  });
}

export function useBundle(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.bundle(projectId ?? ''),
    queryFn: () => api.get<ProjectBundle>(`/projects/${projectId}/bundle`),
    enabled: !!projectId,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useActivity(projectId: string, filters: { entityType?: string; entityId?: string; userId?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityId) params.set('entityId', filters.entityId);
  if (filters.userId) params.set('userId', filters.userId);
  params.set('limit', String(filters.limit ?? 100));
  return useQuery({
    queryKey: keys.activity(projectId, { ...filters, limit: String(filters.limit ?? 100) }),
    queryFn: () => api.get<{ activity: ActivityLog[]; hasMore: boolean }>(`/projects/${projectId}/activity?${params}`),
  });
}

export function useComponentActivity(projectId: string, componentId: string) {
  return useQuery({
    queryKey: keys.componentActivity(projectId, componentId),
    queryFn: async () => (await api.get<{ activity: ActivityLog[] }>(`/projects/${projectId}/components/${componentId}/activity`)).activity,
  });
}

export function useSearch(q: string, projectId?: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: keys.search(trimmed, projectId),
    queryFn: async () => (await api.get<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(trimmed)}${projectId ? `&projectId=${projectId}` : ''}`)).results,
    enabled: trimmed.length >= 2,
    staleTime: 10 * 1000,
  });
}

// --------------------------------------------------------------- mutations

function useInvalidate() {
  const qc = useQueryClient();
  return {
    bundle: (projectId: string) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.bundle(projectId) }),
        qc.invalidateQueries({ queryKey: ['activity', projectId] }),
        qc.invalidateQueries({ queryKey: ['component-activity', projectId] }),
        qc.invalidateQueries({ queryKey: keys.metrics(projectId) }),
      ]),
    projects: () => qc.invalidateQueries({ queryKey: keys.projects }),
    users: () => qc.invalidateQueries({ queryKey: keys.users }),
    me: () => qc.invalidateQueries({ queryKey: keys.me }),
  };
}

type Opts<TData, TVars> = Omit<UseMutationOptions<TData, Error, TVars>, 'mutationFn'>;

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => (await api.post<{ user: SessionUser }>('/auth/login', input)).user,
    onSuccess: (user) => qc.setQueryData(keys.me, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      qc.clear();
    },
  });
}

// components
export function useCreateComponent(projectId: string, opts?: Opts<Component, CreateComponentInput>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: async (input) => (await api.post<{ component: Component }>(`/projects/${projectId}/components`, input)).component,
    onSuccess: async (data, vars, ctx, mutation) => {
      await inv.bundle(projectId);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useUpdateComponent(projectId: string, opts?: Opts<Component, { id: string; input: UpdateComponentInput }>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: async ({ id, input }) => (await api.patch<{ component: Component }>(`/projects/${projectId}/components/${id}`, input)).component,
    onSuccess: async (data, vars, ctx, mutation) => {
      await inv.bundle(projectId);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export type StatusChangeResult = { component: Component; unblocked: Pick<Component, 'id' | 'code' | 'name'>[] };

export function useChangeStatus(projectId: string, opts?: Opts<StatusChangeResult, { id: string; input: ChangeStatusInput }>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: ({ id, input }) => api.post<StatusChangeResult>(`/projects/${projectId}/components/${id}/status`, input),
    onSuccess: async (data, vars, ctx, mutation) => {
      await inv.bundle(projectId);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useDeleteComponent(projectId: string, opts?: Opts<unknown, string>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: (id) => api.delete(`/projects/${projectId}/components/${id}`),
    onSuccess: async (data, vars, ctx, mutation) => {
      await inv.bundle(projectId);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useDependencyMutation(projectId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, dependsOnId, add }: { id: string; dependsOnId: string; add: boolean }) =>
      add
        ? (await api.post<{ component: Component }>(`/projects/${projectId}/components/${id}/dependencies`, { dependsOnId })).component
        : (await api.delete<{ component: Component }>(`/projects/${projectId}/components/${id}/dependencies/${dependsOnId}`)).component,
    onSuccess: () => inv.bundle(projectId),
  });
}

export function useCollaboratorMutation(projectId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, userId, add }: { id: string; userId: string; add: boolean }) =>
      add
        ? (await api.post<{ component: Component }>(`/projects/${projectId}/components/${id}/collaborators`, { userId })).component
        : (await api.delete<{ component: Component }>(`/projects/${projectId}/components/${id}/collaborators/${userId}`)).component,
    onSuccess: () => inv.bundle(projectId),
  });
}

export function useUpsertManufacturing(projectId: string, opts?: Opts<Component, { id: string; input: ManufacturingInput }>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: async ({ id, input }) => (await api.put<{ component: Component }>(`/projects/${projectId}/components/${id}/manufacturing`, input)).component,
    onSuccess: async (data, vars, ctx, mutation) => {
      await inv.bundle(projectId);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

// projects
export function useCreateProject(opts?: Opts<Project, CreateProjectInput>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: async (input) => (await api.post<{ project: Project }>('/projects', input)).project,
    onSuccess: async (data, vars, ctx, mutation) => {
      await Promise.all([inv.projects(), inv.me()]);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useUpdateProject(projectId: string, opts?: Opts<Project, UpdateProjectInput>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: async (input) => (await api.patch<{ project: Project }>(`/projects/${projectId}`, input)).project,
    onSuccess: async (data, vars, ctx, mutation) => {
      await Promise.all([inv.bundle(projectId), inv.projects()]);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useDeleteProject(opts?: Opts<unknown, string>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: (projectId) => api.delete(`/projects/${projectId}`),
    onSuccess: async (data, vars, ctx, mutation) => {
      await Promise.all([inv.projects(), inv.me()]);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useProjectMemberMutation(projectId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (vars: { userId: string; role?: MembershipInput['role']; remove?: boolean }) =>
      vars.remove
        ? (await api.delete<{ members: ProjectMember[] }>(`/projects/${projectId}/members/${vars.userId}`)).members
        : (await api.put<{ members: ProjectMember[] }>(`/projects/${projectId}/members`, { userId: vars.userId, role: vars.role ?? 'member' })).members,
    onSuccess: () => Promise.all([inv.bundle(projectId), inv.projects(), inv.me()]),
  });
}

// systems
export function useCreateSystem(projectId: string, opts?: Opts<System, CreateSystemInput>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: async (input) => (await api.post<{ system: System }>(`/projects/${projectId}/systems`, input)).system,
    onSuccess: async (data, vars, ctx, mutation) => {
      await Promise.all([inv.bundle(projectId), inv.me()]);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useUpdateSystem(projectId: string, opts?: Opts<System, { id: string; input: UpdateSystemInput }>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: async ({ id, input }) => (await api.patch<{ system: System }>(`/projects/${projectId}/systems/${id}`, input)).system,
    onSuccess: async (data, vars, ctx, mutation) => {
      await Promise.all([inv.bundle(projectId), inv.me()]);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useDeleteSystem(projectId: string, opts?: Opts<unknown, string>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: (id) => api.delete(`/projects/${projectId}/systems/${id}`),
    onSuccess: async (data, vars, ctx, mutation) => {
      await inv.bundle(projectId);
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useSystemMemberMutation(projectId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (vars: { systemId: string; userId: string; role?: MembershipInput['role']; remove?: boolean }) =>
      vars.remove
        ? (await api.delete<{ system: System }>(`/projects/${projectId}/systems/${vars.systemId}/members/${vars.userId}`)).system
        : (await api.put<{ system: System }>(`/projects/${projectId}/systems/${vars.systemId}/members`, { userId: vars.userId, role: vars.role ?? 'member' })).system,
    onSuccess: () => Promise.all([inv.bundle(projectId), inv.me()]),
  });
}

// milestones
export function useMilestoneMutation(projectId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (vars: { id?: string; input?: Partial<MilestoneInput>; remove?: boolean }) => {
      if (vars.remove && vars.id) return api.delete(`/projects/${projectId}/milestones/${vars.id}`);
      if (vars.id) return (await api.patch<{ milestone: Milestone }>(`/projects/${projectId}/milestones/${vars.id}`, vars.input)).milestone;
      return (await api.post<{ milestone: Milestone }>(`/projects/${projectId}/milestones`, vars.input)).milestone;
    },
    onSuccess: () => inv.bundle(projectId),
  });
}

// users
export function useCreateUser(opts?: Opts<User, CreateUserInput>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: async (input) => (await api.post<{ user: User }>('/users', input)).user,
    onSuccess: async (data, vars, ctx, mutation) => {
      await inv.users();
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useUpdateUser(opts?: Opts<User, { id: string; input: UpdateUserInput }>) {
  const inv = useInvalidate();
  return useMutation({
    ...opts,
    mutationFn: async ({ id, input }) => (await api.patch<{ user: User }>(`/users/${id}`, input)).user,
    onSuccess: async (data, vars, ctx, mutation) => {
      await inv.users();
      await opts?.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => api.post('/auth/change-password', input),
  });
}

// ------------------------------------------------------- phase 2/3 modules

export function useMetrics(projectId: string) {
  return useQuery({
    queryKey: keys.metrics(projectId),
    queryFn: async () => (await api.get<{ metrics: ProjectMetrics }>(`/projects/${projectId}/metrics`)).metrics,
    staleTime: 60 * 1000,
  });
}

export function usePurchaseMutation(projectId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (vars: { id?: string; input?: PurchaseInput | UpdatePurchaseInput; remove?: boolean }) => {
      if (vars.remove && vars.id) return api.delete(`/projects/${projectId}/purchases/${vars.id}`);
      if (vars.id) return (await api.patch<{ purchase: Purchase }>(`/projects/${projectId}/purchases/${vars.id}`, vars.input)).purchase;
      return (await api.post<{ purchase: Purchase }>(`/projects/${projectId}/purchases`, vars.input)).purchase;
    },
    onSuccess: () => inv.bundle(projectId),
  });
}

export function useTestMutation(projectId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (vars: { id?: string; input?: TestInput | UpdateTestInput; remove?: boolean }) => {
      if (vars.remove && vars.id) return api.delete(`/projects/${projectId}/tests/${vars.id}`);
      if (vars.id) return (await api.patch<{ test: Test }>(`/projects/${projectId}/tests/${vars.id}`, vars.input)).test;
      return (await api.post<{ test: Test }>(`/projects/${projectId}/tests`, vars.input)).test;
    },
    onSuccess: () => inv.bundle(projectId),
  });
}

export function useWorkLogs(projectId: string) {
  return useQuery({
    queryKey: keys.workLogs(projectId),
    queryFn: async () => (await api.get<{ workLogs: WorkLog[] }>(`/projects/${projectId}/work-logs`)).workLogs,
    staleTime: 15 * 1000,
  });
}

export function useWorkLogMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id?: string; input?: WorkLogInput | UpdateWorkLogInput; remove?: boolean }) => {
      if (vars.remove && vars.id) return api.delete(`/projects/${projectId}/work-logs/${vars.id}`);
      if (vars.id) return (await api.patch<{ workLog: WorkLog }>(`/projects/${projectId}/work-logs/${vars.id}`, vars.input)).workLog;
      return (await api.post<{ workLog: WorkLog }>(`/projects/${projectId}/work-logs`, vars.input)).workLog;
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: keys.workLogs(projectId) }), qc.invalidateQueries({ queryKey: ['activity', projectId] })]),
  });
}

export type InspectionResultPayload = { inspection: Inspection; statusChange: StatusChangeResult | null };

export function useInspectionMutation(projectId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (vars: { input?: InspectionInput; removeId?: string }) => {
      if (vars.removeId) return (await api.delete<{ ok: true }>(`/projects/${projectId}/inspections/${vars.removeId}`)) as unknown as InspectionResultPayload | { ok: true };
      return api.post<InspectionResultPayload>(`/projects/${projectId}/inspections`, vars.input);
    },
    onSuccess: () => inv.bundle(projectId),
  });
}

export async function uploadFileRequest(projectId: string, file: File, meta: { entityType: FileEntityType; entityId: string; category: FileCategory }): Promise<FileItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('entityType', meta.entityType);
  form.append('entityId', meta.entityId);
  form.append('category', meta.category);
  const res = await fetch(`/api/projects/${projectId}/files`, { method: 'POST', body: form, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  return (data as { file: FileItem }).file;
}

export function useUploadFile(projectId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (vars: { file: File; entityType: FileEntityType; entityId: string; category: FileCategory }) => uploadFileRequest(projectId, vars.file, vars),
    onSuccess: () => inv.bundle(projectId),
  });
}

export function useDeleteFile(projectId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (fileId: string) => api.delete(`/projects/${projectId}/files/${fileId}`),
    onSuccess: () => inv.bundle(projectId),
  });
}

export const fileDownloadUrl = (projectId: string, fileId: string, inline = false) => `/api/projects/${projectId}/files/${fileId}/download${inline ? '?inline=1' : ''}`;
