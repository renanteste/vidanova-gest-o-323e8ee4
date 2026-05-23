import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";

export const Route = createFileRoute("/motoristas")({
  component: () => (
    <RequireAuth allow={["frota"]}>
      <MotoristasPage />
    </RequireAuth>
  ),
});

type Driver = { user_id: string; nome: string; telefone: string | null; cnh: string | null };

const schema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  cnh: z.string().trim().max(20).optional().or(z.literal("")),
  password: z.string().min(8).max(72),
});

function MotoristasPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("profiles")
      .select("user_id, nome, telefone, cnh")
      .eq("fk_frota_id", user.id);
    if (error) toast.error(error.message);
    setDrivers((data as Driver[]) ?? []);
  };

  useEffect(() => { load(); }, [user]);

  return (
    <AppShell title="Motoristas da minha frota">
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-1" /> Novo motorista
            </Button>
          </DialogTrigger>
          <NewDriverDialog onClose={() => { setOpen(false); load(); }} />
        </Dialog>
      </div>
      {drivers.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nenhum motorista vinculado ainda.
        </CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((d) => (
            <Card key={d.user_id}>
              <CardContent className="pt-6">
                <div className="font-medium">{d.nome}</div>
                <div className="text-sm text-muted-foreground">{d.telefone ?? "—"}</div>
                <div className="text-xs text-muted-foreground mt-1">CNH: {d.cnh ?? "—"}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function NewDriverDialog({ onClose }: { onClose: () => void }) {
  const { user, session } = useAuth();
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", cnh: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user) return;
    setBusy(true);

    // Save current session so we can restore it (signUp logs in as the new user)
    const currentSession = session;

    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          nome: parsed.data.nome,
          telefone: parsed.data.telefone || null,
          cnh: parsed.data.cnh || null,
          perfil: "motorista_vinculado",
          fk_frota_id: user.id,
        },
      },
    });

    // Restore fleet owner's session
    if (currentSession) {
      await supabase.auth.setSession({
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      });
    }

    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Motorista criado e vinculado à sua frota"); onClose(); }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Novo motorista vinculado</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label>Nome</Label>
          <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label>E-mail</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>CNH</Label>
            <Input value={form.cnh} onChange={(e) => setForm({ ...form, cnh: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Senha inicial</Label>
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <p className="text-xs text-muted-foreground">O motorista poderá alterar depois.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={busy}>
            {busy ? "Criando…" : "Criar motorista"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
