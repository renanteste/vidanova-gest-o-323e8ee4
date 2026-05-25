import { Link, useRouter } from "@tanstack/react-router";
import { useAuth, perfilLabel, dashboardPathFor } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Truck, LayoutDashboard, User as UserIcon, Route as RouteIcon, ClipboardList, Inbox, Navigation } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  const perfil = profile?.perfil;
  const isMotorista = perfil === "motorista_autonomo" || perfil === "motorista_vinculado";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link
            to={profile ? dashboardPathFor(profile.perfil) : "/"}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Truck className="h-4 w-4" />
            </span>
            <span className="text-base">VidaNova <span className="text-accent">Terraplenagem</span></span>
          </Link>
          {profile && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right text-xs">
                <div className="font-medium">{profile.nome}</div>
                <div className="text-primary-foreground/70">{perfilLabel[profile.perfil]}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" /> Sair
              </Button>
            </div>
          )}
        </div>
        {profile && (
          <nav className="bg-sidebar-accent border-t border-sidebar-border">
            <div className="mx-auto max-w-6xl px-4 flex gap-1 text-sm overflow-x-auto">
              <NavLink to={dashboardPathFor(profile.perfil)} icon={<LayoutDashboard className="h-4 w-4" />}>Painel</NavLink>

              {perfil === "admin" && (
                <NavLink to="/veiculos" icon={<Truck className="h-4 w-4" />}>Todos veículos</NavLink>
              )}
              {perfil === "frota" && (
                <NavLink to="/veiculos" icon={<Truck className="h-4 w-4" />}>Meus veículos</NavLink>
              )}
              {perfil === "motorista_autonomo" && (
                <NavLink to="/veiculos" icon={<Truck className="h-4 w-4" />}>Meu veículo</NavLink>
              )}
              {perfil === "motorista_vinculado" && (
                <NavLink to="/veiculos" icon={<Truck className="h-4 w-4" />}>Veículos da frota</NavLink>
              )}

              {perfil === "frota" && (
                <NavLink to="/motoristas" icon={<UserIcon className="h-4 w-4" />}>Motoristas</NavLink>
              )}

              {(perfil === "admin" || perfil === "frota") && (
                <NavLink to="/rotas" icon={<RouteIcon className="h-4 w-4" />}>Rotas</NavLink>
              )}
              {isMotorista && (
                <NavLink to="/rotas-disponiveis" icon={<RouteIcon className="h-4 w-4" />}>Rotas disponíveis</NavLink>
              )}
              {isMotorista && (
                <NavLink to="/meus-interesses" icon={<ClipboardList className="h-4 w-4" />}>Meus interesses</NavLink>
              )}
              {(perfil === "admin" || perfil === "frota") && (
                <NavLink to="/interesses" icon={<Inbox className="h-4 w-4" />}>Interesses</NavLink>
              )}
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {title && <h1 className="text-2xl font-semibold mb-6">{title}</h1>}
        {children}
      </main>
    </div>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 hover:bg-sidebar-accent/60 flex items-center gap-1.5 whitespace-nowrap"
      activeProps={{ className: "border-b-2 border-accent" }}
    >
      {icon} {children}
    </Link>
  );
}
