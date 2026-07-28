import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, dashboardPathFor } from "@/lib/auth";
import { ProfileMenu } from "@/components/ProfileMenu";
import { recordLastPath } from "@/lib/last-path";
import { Truck, LayoutDashboard, User as UserIcon, Route as RouteIcon, ClipboardList, Inbox, Navigation, MessageSquarePlus, MessagesSquare } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    recordLastPath(pathname);
  }, [pathname]);

  const perfil = profile?.perfil;
  const isMotorista = perfil === "motorista_autonomo" || perfil === "motorista_vinculado";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to={profile ? dashboardPathFor(profile.perfil) : "/"}
            className="flex items-center gap-2 font-semibold tracking-tight min-w-0"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground shrink-0">
              <Truck className="h-4 w-4" />
            </span>
            <span className="text-base truncate">VidaNova <span className="text-accent">Terraplenagem</span></span>
          </Link>
          {profile && <ProfileMenu />}
        </div>
        {profile && (
          <nav className="bg-sidebar-accent border-t border-sidebar-border">
            <div className="mx-auto max-w-6xl px-4 flex gap-1 text-sm overflow-x-auto">
              <NavLink to={dashboardPathFor(profile.perfil)} icon={<LayoutDashboard className="h-4 w-4" />}>Painel</NavLink>

              {/* {perfil === "admin" && (
                <NavLink to="/veiculos" icon={<Truck className="h-4 w-4" />}>Todos veículos</NavLink>
              )} */}
              {perfil === "frota" && (
                <NavLink to="/veiculos" icon={<Truck className="h-4 w-4" />}>Veículos</NavLink>
              )}
              {perfil === "motorista_autonomo" && (
                <NavLink to="/veiculos" icon={<Truck className="h-4 w-4" />}>Meu veículo</NavLink>
              )}
              {/* {perfil === "motorista_vinculado" && (
                <NavLink to="/veiculos" icon={<Truck className="h-4 w-4" />}>Veículos da frota</NavLink>
              )} */}

              {perfil === "frota" && (
                <NavLink to="/motoristas" icon={<UserIcon className="h-4 w-4" />}>Motoristas</NavLink>
              )}

              {(perfil === "admin") && (
                <NavLink to="/rotas" icon={<RouteIcon className="h-4 w-4" />}>Rotas</NavLink>
              )}
                {perfil === "motorista_autonomo" && (
                  <NavLink to="/rotas-disponiveis" icon={<RouteIcon className="h-4 w-4" />}>Rotas</NavLink>
                )}
              {/* {isMotorista && (
                <NavLink to="/meus-interesses" icon={<ClipboardList className="h-4 w-4" />}>Meus interesses</NavLink>
              )} */}
              {isMotorista && (
                <NavLink to="/viagens" icon={<Navigation className="h-4 w-4" />}>Viagens</NavLink>
              )}
              {perfil === "admin" && (
                <NavLink to="/interesses" icon={<Inbox className="h-4 w-4" />}>Interesses</NavLink>
              )}
              {perfil === "frota" && (
                <NavLink to="/interesses-frota" icon={<Inbox className="h-4 w-4" />}>Rotas</NavLink>
              )}
              {perfil === "admin" && (
                <NavLink to="/feedbacks" icon={<MessagesSquare className="h-4 w-4" />}>Feedbacks</NavLink>
              )}
              <NavLink to="/enviar-sugestao" icon={<MessageSquarePlus className="h-4 w-4" />}>Enviar sugestão</NavLink>
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
