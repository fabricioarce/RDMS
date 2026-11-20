import { GlobalSearch } from '@/components/layout/global-search';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/misc';
import { useProjectOptional } from '@/hooks/use-project';
import { useLogout, useMe, useProjects } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Activity, BarChart3, Box, Calendar, Check, ChevronsUpDown, FileText, FlaskConical, FolderKanban, Factory, KeyRound, Layers, LayoutDashboard, LogOut, Menu, NotebookPen, PiggyBank, Rocket, Search, Settings, ShoppingCart, Users } from 'lucide-react';
import * as React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { ChangePasswordDialog } from './change-password-dialog';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              isActive && 'bg-accent text-foreground',
            )
          }
        >
          <item.icon className="size-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function ProjectSwitcher({ compact }: { compact?: boolean }) {
  const project = useProjectOptional();
  const projects = useProjects();
  const navigate = useNavigate();
  const location = useLocation();
  const list = projects.data ?? [];

  // keep the same section (components, systems, …) when switching projects
  const section = location.pathname.replace(/^\/p\/[^/]+/, '').split('/')[1] ?? '';
  const keep = ['components', 'systems', 'schedule', 'activity'].includes(section) ? `/${section}` : '';
  const target = (id: string) => `/p/${id}${keep}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn('flex w-full items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-left shadow-xs transition-colors hover:bg-accent cursor-pointer', compact && 'border-0 shadow-none px-2 py-1.5')}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Rocket className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-tight">{project?.project.name ?? 'Seleccionar proyecto'}</span>
            <span className="block truncate text-[11px] text-muted-foreground leading-tight">{project?.project.competition ?? 'RDMS · CRATER'}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel>Proyectos</DropdownMenuLabel>
        {list.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => navigate(target(p.id))}>
            <span className="truncate flex-1">{p.name}</span>
            <span className="text-xs text-muted-foreground tabular">{p.progress.percent}%</span>
            {project?.project.id === p.id ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
        {list.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">No perteneces a ningún proyecto todavía.</p> : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/projects')}>
          <FolderKanban />
          Todos los proyectos
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = React.useState(false);
  const user = me.data;
  if (!user) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent cursor-pointer">
            <Avatar user={user} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-tight">{user.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground leading-tight">{user.role === 'admin' ? 'Administrador' : 'Miembro'}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" side="top">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
            <span className="block truncate text-xs">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPwOpen(true)}>
            <KeyRound />
            Cambiar contraseña
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              logout.mutate(undefined, {
                onSettled: () => navigate('/login', { replace: true }),
              })
            }
          >
            <LogOut />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const project = useProjectOptional();
  const me = useMe();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => setMobileOpen(false), [location.pathname]);

  const pid = project?.project.id;
  const projectNav: NavItem[] = pid
    ? [
        { to: `/p/${pid}`, label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: `/p/${pid}/components`, label: 'Componentes', icon: Box },
        { to: `/p/${pid}/systems`, label: 'Sistemas', icon: Layers },
        { to: `/p/${pid}/schedule`, label: 'Cronograma', icon: Calendar },
      ]
    : [];
  const operationsNav: NavItem[] = pid
    ? [
        { to: `/p/${pid}/manufacturing`, label: 'Manufactura', icon: Factory },
        { to: `/p/${pid}/purchases`, label: 'Compras', icon: ShoppingCart },
        { to: `/p/${pid}/tests`, label: 'Pruebas', icon: FlaskConical },
        { to: `/p/${pid}/worklog`, label: 'Bitácora', icon: NotebookPen },
        { to: `/p/${pid}/budget`, label: 'Presupuesto', icon: PiggyBank },
      ]
    : [];
  const analysisNav: NavItem[] = pid
    ? [
        { to: `/p/${pid}/reports`, label: 'Reportes', icon: FileText },
        { to: `/p/${pid}/metrics`, label: 'Métricas', icon: BarChart3 },
        { to: `/p/${pid}/activity`, label: 'Actividad', icon: Activity },
        ...(project?.canManageProject ? [{ to: `/p/${pid}/settings`, label: 'Configuración', icon: Settings }] : []),
      ]
    : [];
  const globalNav: NavItem[] = [
    { to: '/projects', label: 'Proyectos', icon: FolderKanban },
    ...(me.data?.role === 'admin' ? [{ to: '/users', label: 'Usuarios', icon: Users }] : []),
  ];

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-3">
      <ProjectSwitcher />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {projectNav.length ? <NavLinks items={projectNav} /> : null}
        {operationsNav.length ? (
          <div>
            <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Operación</p>
            <NavLinks items={operationsNav} />
          </div>
        ) : null}
        {analysisNav.length ? (
          <div>
            <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Análisis</p>
            <NavLinks items={analysisNav} />
          </div>
        ) : null}
        <div>
          <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">General</p>
          <NavLinks items={globalNav} />
        </div>
      </div>
      <Button variant="outline" size="sm" className="justify-between text-muted-foreground font-normal" onClick={() => setSearchOpen(true)}>
        <span className="inline-flex items-center gap-2">
          <Search className="size-3.5" /> Buscar
        </span>
        <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">Ctrl K</kbd>
      </Button>
      <UserMenu />
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 border-r bg-card/60 lg:block print:hidden">{sidebar}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:hidden print:hidden">
          <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Menu />
          </Button>
          <Link to={pid ? `/p/${pid}` : '/projects'} className="flex items-center gap-2 font-semibold text-sm">
            <Rocket className="size-4" />
            {project?.project.name ?? 'RDMS'}
          </Link>
          <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setSearchOpen(true)} aria-label="Buscar">
            <Search />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 lg:px-8 lg:py-6 print:max-w-none print:p-0">{children}</main>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="top-0 left-0 h-full max-h-screen w-[280px] max-w-[85vw] translate-x-0 translate-y-0 rounded-none p-0 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left">
          <DialogTitle className="sr-only">Menú</DialogTitle>
          <div className="h-full pt-8">{sidebar}</div>
        </DialogContent>
      </Dialog>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
