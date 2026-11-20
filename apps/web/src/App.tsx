import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { ProjectProvider } from '@/hooks/use-project';
import { useMe, useProjects } from '@/lib/queries';
import { ActivityPage } from '@/pages/activity';
import { BudgetPage } from '@/pages/budget';
import { ComponentDetailPage } from '@/pages/component-detail';
import { ComponentsPage } from '@/pages/components';
import { DashboardPage } from '@/pages/dashboard';
import { LoginPage } from '@/pages/login';
import { ManufacturingPage } from '@/pages/manufacturing';
import { MetricsPage } from '@/pages/metrics';
import { ProjectSettingsPage } from '@/pages/project-settings';
import { ProjectsPage } from '@/pages/projects';
import { PurchasesPage } from '@/pages/purchases';
import { ReportsPage } from '@/pages/reports';
import { SchedulePage } from '@/pages/schedule';
import { SystemDetailPage } from '@/pages/system-detail';
import { SystemsPage } from '@/pages/systems';
import { TestsPage } from '@/pages/tests';
import { UsersPage } from '@/pages/users';
import { WorkLogPage } from '@/pages/worklog';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation, useParams } from 'react-router';

const LAST_PROJECT_KEY = 'rdms:lastProject';
export const rememberProject = (id: string) => localStorage.setItem(LAST_PROJECT_KEY, id);

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  const qc = useQueryClient();

  React.useEffect(() => {
    const onUnauthorized = () => qc.setQueryData(['me'], null);
    window.addEventListener('rdms:unauthorized', onUnauthorized);
    return () => window.removeEventListener('rdms:unauthorized', onUnauthorized);
  }, [qc]);

  if (me.isLoading) return <FullPageLoader />;
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

function RequireAdmin() {
  const me = useMe();
  if (me.data?.role !== 'admin') return <Navigate to="/projects" replace />;
  return <Outlet />;
}

/** `/` → last visited project, or the first available, or the projects list. */
function Home() {
  const projects = useProjects();
  if (projects.isLoading) return <FullPageLoader />;
  const list = projects.data ?? [];
  const last = localStorage.getItem(LAST_PROJECT_KEY);
  const target = list.find((p) => p.id === last) ?? list.find((p) => p.status === 'active') ?? list[0];
  return <Navigate to={target ? `/p/${target.id}` : '/projects'} replace />;
}

function GlobalLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function ProjectLayout() {
  const { projectId = '' } = useParams();
  React.useEffect(() => {
    if (projectId) rememberProject(projectId);
  }, [projectId]);
  return (
    <ProjectProvider
      projectId={projectId}
      fallback={({ isLoading, error }) =>
        isLoading ? (
          <div className="flex min-h-screen">
            <aside className="hidden w-[232px] border-r p-3 lg:block">
              <Skeleton className="h-11 w-full" />
              <div className="mt-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            </aside>
            <div className="flex-1 p-8">
              <Skeleton className="h-8 w-64" />
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <AppShell>
            <div className="mx-auto mt-16 max-w-md text-center">
              <h1 className="text-lg font-semibold">No se pudo abrir el proyecto</h1>
              <p className="mt-1 text-sm text-muted-foreground">{error?.message ?? 'Proyecto no encontrado o sin acceso.'}</p>
              <Button className="mt-4" asChild>
                <a href="/projects">Ver mis proyectos</a>
              </Button>
            </div>
          </AppShell>
        )
      }
    >
      <AppShell>
        <Outlet />
      </AppShell>
    </ProjectProvider>
  );
}

function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="font-mono text-5xl font-semibold text-muted-foreground/40">404</p>
      <h1 className="mt-2 text-lg font-semibold">Página no encontrada</h1>
      <Button className="mt-4" asChild>
        <a href="/">Ir al inicio</a>
      </Button>
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <Home /> },
      {
        element: <GlobalLayout />,
        children: [
          { path: '/projects', element: <ProjectsPage /> },
          { element: <RequireAdmin />, children: [{ path: '/users', element: <UsersPage /> }] },
        ],
      },
      {
        path: '/p/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'components', element: <ComponentsPage /> },
          { path: 'components/:componentId', element: <ComponentDetailPage /> },
          { path: 'systems', element: <SystemsPage /> },
          { path: 'systems/:systemId', element: <SystemDetailPage /> },
          { path: 'schedule', element: <SchedulePage /> },
          { path: 'manufacturing', element: <ManufacturingPage /> },
          { path: 'purchases', element: <PurchasesPage /> },
          { path: 'budget', element: <BudgetPage /> },
          { path: 'tests', element: <TestsPage /> },
          { path: 'worklog', element: <WorkLogPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'metrics', element: <MetricsPage /> },
          { path: 'activity', element: <ActivityPage /> },
          { path: 'settings', element: <ProjectSettingsPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
      { path: '*', element: <GlobalLayout />, children: [{ path: '*', element: <NotFound /> }] },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
