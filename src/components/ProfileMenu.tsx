import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useAuth, perfilLabel } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogOut, User as UserIcon } from "lucide-react";

function initials(nome?: string | null) {
  if (!nome) return "?";
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function ProfileMenu() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!profile) return null;

  const handleLogout = async () => {
    setConfirmOpen(false);
    await signOut();
    router.navigate({ to: "/login" });
  };

  const foto = (profile as any).foto_url as string | undefined;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full hover:bg-primary-foreground/10 px-1.5 py-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <div className="hidden sm:block text-right text-xs leading-tight">
            <div className="font-medium">{profile.nome}</div>
            <div className="text-primary-foreground/70">{perfilLabel[profile.perfil]}</div>
          </div>
          <Avatar className="h-9 w-9 border border-primary-foreground/20">
            {foto ? <AvatarImage src={foto} alt={profile.nome} /> : null}
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
              {initials(profile.nome)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">{profile.nome}</span>
            <span className="text-xs text-muted-foreground">{perfilLabel[profile.perfil]}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/perfil" className="cursor-pointer">
              <UserIcon className="h-4 w-4 mr-2" /> Meu perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja realmente sair?</AlertDialogTitle>
            <AlertDialogDescription>
              Você será desconectado da sua conta e voltará para a tela de login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
