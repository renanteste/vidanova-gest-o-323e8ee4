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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";

export const Route = createFileRoute("/veiculos")({
  component: () => (
    <RequireAuth>
      <VeiculosPage />
    </RequireAuth>
  ),
});

type Veiculo = {
  id: string;
  proprietario_id: string;
  placa: string;
  modelo: string;
  capacidade_m3: number;
  tipo_cacamba: string;
  foto_url: string | null;
  ativa: boolean;
};

const TIPOS_CACAMBA = ["Basculante", "Caçamba 4m³", "Caçamba 6m³", "Caçamba 10m³", "Caçamba 12m³", "Roll-on", "Outro"];

// Brazilian plate format: ABC-1234 or ABC1D23 (Mercosul)
function maskPlaca(value: string): string {
  const v = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (v.length <= 3) return v;
  return `${v.slice(0, 3)}-${v.slice(3)}`;
}

const placaRegex = /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/;

const veiculoSchema = z.object({
  placa: z.string().trim().toUpperCase().regex(placaRegex, "Placa inválida (ex: ABC-1234)"),
  modelo: z.string().trim().min(2, "Modelo obrigatório").max(80),
  capacidade_m3: z.number().positive("Capacidade deve ser maior que 0").max(1000),
  tipo_cacamba: z.string().min(1, "Selecione o tipo"),
  foto_url: z.string().url().optional().or(z.literal("")).nullable(),
});

function VeiculosPage() {
  const { user, profile } = useAuth();
  const [list, setList] = useState<Veiculo[]>([]);
  const [proprietarios, setProprietarios] = useState<Record<string, { nome: string; perfil: string }>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Veiculo | null>(null);
  const [open, setOpen] = useState(false);

  const canCreate = profile && (
    profile.perfil === "frota" ||
    (profile.perfil === "motorista_autonomo" && list.length === 0)
  );
  const canEdit = profile && (profile.perfil === "frota" || profile.perfil === "motorista_autonomo");
  const readOnly = profile?.perfil === "motorista_vinculado" || profile?.perfil === "admin";
  const isAdmin = profile?.perfil === "admin";

  const load = async () => {
    if (!user || !profile) return;
    setLoading(true);
    const { data, error } = await supabase.from("veiculos").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const veh = (data as Veiculo[]) ?? [];
    setList(veh);

    if (isAdmin && veh.length > 0) {
      const ownerIds = [...new Set(veh.map((v) => v.proprietario_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome, perfil")
        .in("user_id", ownerIds);
      const map: Record<string, { nome: string; perfil: string }> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = { nome: p.nome, perfil: p.perfil }; });
      setProprietarios(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, profile]);

  const handleDelete = async (v: Veiculo) => {
    if (!confirm(`Excluir veículo ${v.placa}?`)) return;
    const { error } = await supabase.from("veiculos").delete().eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("Veículo excluído"); load(); }
  };

  const title = profile?.perfil === "admin" ? "Todos os veículos"
    : profile?.perfil === "motorista_vinculado" ? "Veículos da frota"
    : "Meus veículos";

  const renderCard = (v: Veiculo) => (
    <Card key={v.id} className="overflow-hidden">
      <div className="aspect-video bg-muted relative">
        {v.foto_url ? (
          <img src={v.foto_url} alt={v.placa} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground">
            <Truck className="h-12 w-12 opacity-30" />
          </div>
        )}
        <Badge className="absolute top-2 right-2" variant={v.ativa ? "default" : "secondary"}>
          {v.ativa ? "Ativa" : "Inativa"}
        </Badge>
      </div>
      <CardContent className="pt-4 space-y-1">
        <div className="font-mono text-lg font-semibold tracking-wider">{v.placa}</div>
        <div className="font-medium">{v.modelo}</div>
        <div className="text-sm text-muted-foreground">{v.tipo_cacamba} · {Number(v.capacidade_m3).toLocaleString("pt-BR")} m³</div>
        {isAdmin && proprietarios[v.proprietario_id] && (
          <div className="text-xs text-muted-foreground pt-1 border-t mt-2">
            <strong>Proprietário:</strong> {proprietarios[v.proprietario_id].nome}
          </div>
        )}
        {!readOnly && canEdit && v.proprietario_id === user?.id && (
          <div className="flex gap-2 pt-3">
            <Button size="sm" variant="outline" onClick={() => setEditing(v)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleDelete(v)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Admin: agrupar por perfil do proprietário
  const frotaVehs = isAdmin ? list.filter((v) => proprietarios[v.proprietario_id]?.perfil === "frota") : [];
  const autonomoVehs = isAdmin ? list.filter((v) => proprietarios[v.proprietario_id]?.perfil === "motorista_autonomo") : [];
  const outrosVehs = isAdmin ? list.filter((v) => {
    const p = proprietarios[v.proprietario_id]?.perfil;
    return p !== "frota" && p !== "motorista_autonomo";
  }) : [];

  return (
    <AppShell title={title}>
      {canCreate && !editing && (
        <div className="mb-4 flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-1" /> Novo veículo
              </Button>
            </DialogTrigger>
            <VeiculoFormDialog
              onClose={() => { setOpen(false); load(); }}
              userId={user!.id}
            />
          </Dialog>
        </div>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <VeiculoFormDialog
            onClose={() => { setEditing(null); load(); }}
            userId={user!.id}
            initial={editing}
          />
        </Dialog>
      )}

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : list.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nenhum veículo cadastrado.
        </CardContent></Card>
      ) : isAdmin ? (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Truck className="h-5 w-5 text-accent" /> Frotas
              <Badge variant="secondary" className="ml-1">{frotaVehs.length}</Badge>
            </h2>
            {frotaVehs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum veículo de frota.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{frotaVehs.map(renderCard)}</div>
            )}
          </section>
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Truck className="h-5 w-5 text-accent" /> Autônomos
              <Badge variant="secondary" className="ml-1">{autonomoVehs.length}</Badge>
            </h2>
            {autonomoVehs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum veículo de autônomo.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{autonomoVehs.map(renderCard)}</div>
            )}
          </section>
          {outrosVehs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Outros</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{outrosVehs.map(renderCard)}</div>
            </section>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(renderCard)}
        </div>
      )}
    </AppShell>
  );
}


function VeiculoFormDialog({
  onClose, userId, initial,
}: { onClose: () => void; userId: string; initial?: Veiculo }) {
  const [form, setForm] = useState({
    placa: initial?.placa ?? "",
    modelo: initial?.modelo ?? "",
    capacidade_m3: initial?.capacidade_m3?.toString() ?? "",
    tipo_cacamba: initial?.tipo_cacamba ?? "",
    ativa: initial?.ativa ?? true,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = veiculoSchema.safeParse({
      placa: form.placa,
      modelo: form.modelo,
      capacidade_m3: parseFloat(form.capacidade_m3.replace(",", ".")),
      tipo_cacamba: form.tipo_cacamba,
      foto_url: initial?.foto_url ?? "",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);

    let foto_url = initial?.foto_url ?? null;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("veiculos").upload(path, photoFile, { upsert: false });
      if (upErr) { toast.error(upErr.message); setBusy(false); return; }
      foto_url = supabase.storage.from("veiculos").getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      proprietario_id: userId,
      placa: parsed.data.placa,
      modelo: parsed.data.modelo,
      capacidade_m3: parsed.data.capacidade_m3,
      tipo_cacamba: parsed.data.tipo_cacamba,
      foto_url,
      ativa: form.ativa,
    };

    const { error } = initial
      ? await supabase.from("veiculos").update(payload).eq("id", initial.id)
      : await supabase.from("veiculos").insert(payload);

    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(initial ? "Veículo atualizado" : "Veículo cadastrado"); onClose(); }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{initial ? "Editar veículo" : "Novo veículo"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label>Placa</Label>
          <Input value={form.placa} onChange={(e) => setForm({ ...form, placa: maskPlaca(e.target.value) })}
            placeholder="ABC-1234" maxLength={8} required />
        </div>
        <div className="space-y-1">
          <Label>Modelo</Label>
          <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })}
            placeholder="Ex: Mercedes-Benz Atego 2426" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Capacidade (m³)</Label>
            <Input type="number" step="0.1" min="0.1" value={form.capacidade_m3}
              onChange={(e) => setForm({ ...form, capacidade_m3: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Tipo de caçamba</Label>
            <Select value={form.tipo_cacamba} onValueChange={(v) => setForm({ ...form, tipo_cacamba: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS_CACAMBA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Foto do veículo</Label>
          <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
