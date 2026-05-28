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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Users, Pencil, Lock, Unlock, Camera } from "lucide-react";

export const Route = createFileRoute("/motoristas")({
  component: () => (
    <RequireAuth allow={["frota"]}>
      <MotoristasPage />
    </RequireAuth>
  ),
});

type Driver = {
  user_id: string; nome: string; telefone: string | null; cnh: string | null;
  foto_url: string | null; ativo: boolean;
};

const maskTelefone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};
const maskCNH = (v: string) => v.replace(/\D/g, "").slice(0, 11);

const newSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  cnh: z.string().trim().max(20).optional().or(z.literal("")),
  password: z.string().min(8).max(72),
});

const editSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  cnh: z.string().trim().max(20).optional().or(z.literal("")),
});

function MotoristasPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from("profiles")
      .select("user_id, nome, telefone, cnh, foto_url, ativo")
      .eq("fk_frota_id", user.id)
      .order("nome");
    if (error) toast.error(error.message);
    setDrivers((data as Driver[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const toggleAtivo = async (d: Driver) => {
    const { error } = await supabase.from("profiles").update({ ativo: !d.ativo }).eq("user_id", d.user_id);
    if (error) toast.error(error.message);
    else { toast.success(d.ativo ? "Motorista bloqueado" : "Motorista reativado"); load(); }
  };

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

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : drivers.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nenhum motorista vinculado ainda.
        </CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((d) => {
            const initials = d.nome.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
            return (
              <Card key={d.user_id} className={d.ativo ? "" : "opacity-60"}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-14 w-14">
                      {d.foto_url && <AvatarImage src={d.foto_url} alt={d.nome} />}
                      <AvatarFallback>{initials || "—"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium truncate">{d.nome}</div>
                        {!d.ativo && <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">{d.telefone ?? "—"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">CNH: {d.cnh ?? "—"}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => setEditing(d)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <ConfirmToggle driver={d} onConfirm={() => toggleAtivo(d)} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <EditDriverDialog driver={editing} onClose={(reload) => { setEditing(null); if (reload) load(); }} />
      )}
    </AppShell>
  );
}

function ConfirmToggle({ driver, onConfirm }: { driver: Driver; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={driver.ativo ? "outline" : "default"}>
          {driver.ativo ? <><Lock className="h-3.5 w-3.5 mr-1" /> Bloquear</> : <><Unlock className="h-3.5 w-3.5 mr-1" /> Reativar</>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{driver.ativo ? "Bloquear motorista?" : "Reativar motorista?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {driver.ativo
              ? "O motorista será desconectado e não poderá fazer login até ser reativado."
              : "O motorista voltará a poder usar o sistema."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EditDriverDialog({ driver, onClose }: { driver: Driver; onClose: (reload?: boolean) => void }) {
  const [form, setForm] = useState({
    nome: driver.nome,
    telefone: driver.telefone ?? "",
    cnh: driver.cnh ?? "",
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(driver.foto_url);
  const [busy, setBusy] = useState(false);

  const onFile = (f: File | null) => {
    setFoto(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = editSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);

    let foto_url = driver.foto_url;
    if (foto) {
      const ext = foto.name.split(".").pop() || "jpg";
      const path = `${driver.user_id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("motoristas").upload(path, foto, { upsert: true });
      if (upErr) { setBusy(false); toast.error(upErr.message); return; }
      foto_url = supabase.storage.from("motoristas").getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from("profiles").update({
      nome: parsed.data.nome,
      telefone: parsed.data.telefone || null,
      cnh: parsed.data.cnh || null,
      foto_url,
    }).eq("user_id", driver.user_id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Motorista atualizado"); onClose(true); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar motorista</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-16 w-16">
              {preview && <AvatarImage src={preview} />}
              <AvatarFallback>{driver.nome[0]}</AvatarFallback>
            </Avatar>
            <label className="text-sm cursor-pointer">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border hover:bg-muted">
                <Camera className="h-4 w-4" /> Alterar foto
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })} placeholder="(00) 0 0000-0000" />
            </div>
            <div className="space-y-1">
              <Label>CNH</Label>
              <Input value={form.cnh} onChange={(e) => setForm({ ...form, cnh: maskCNH(e.target.value) })} placeholder="00000000000" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose()}>Cancelar</Button>
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewDriverDialog({ onClose }: { onClose: () => void }) {
  const { user, session } = useAuth();
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", cnh: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = newSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user) return;
    setBusy(true);

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
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })} placeholder="(00) 0 0000-0000" />
          </div>
          <div className="space-y-1">
            <Label>CNH</Label>
            <Input value={form.cnh} onChange={(e) => setForm({ ...form, cnh: maskCNH(e.target.value) })} placeholder="00000000000" />
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
