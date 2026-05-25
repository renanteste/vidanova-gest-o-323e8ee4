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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, MapPin, Calendar, Trash2, Route as RouteIcon, Loader2 } from "lucide-react";
import { calcularDistanciaKm, formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/rotas")({
  component: () => (
    <RequireAuth allow={["admin", "frota"]}>
      <RotasPage />
    </RequireAuth>
  ),
});

type Rota = {
  id: string;
  obra: string;
  material: string;
  origem_endereco: string;
  origem_complemento: string | null;
  destino_endereco: string;
  destino_complemento: string | null;
  preco_por_m3: number;
  horario_previsto: string;
  distancia_km: number | null;
  status: "disponivel" | "finalizada";
  criada_por: string;
};

const rotaSchema = z.object({
  obra: z.string().trim().min(2, "Informe a obra").max(120),
  material: z.string().trim().min(2, "Informe o material").max(120),
  origem_endereco: z.string().trim().min(5, "Endereço de origem inválido").max(300),
  origem_complemento: z.string().max(120).optional().or(z.literal("")),
  destino_endereco: z.string().trim().min(5, "Endereço de destino inválido").max(300),
  destino_complemento: z.string().max(120).optional().or(z.literal("")),
  preco_por_m3: z.number().positive("Preço deve ser maior que 0"),
  horario_previsto: z.string().min(1, "Horário obrigatório"),
});

function RotasPage() {
  const { user, profile } = useAuth();
  const [list, setList] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("rotas").select("*").order("horario_previsto", { ascending: true });
    if (error) toast.error(error.message);
    setList((data as Rota[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user && profile) load(); }, [user, profile]);

  const handleStatusToggle = async (r: Rota) => {
    const novo = r.status === "disponivel" ? "finalizada" : "disponivel";
    const { error } = await supabase.from("rotas").update({ status: novo }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Status atualizado"); load(); }
  };

  const handleDelete = async (r: Rota) => {
    if (!confirm(`Excluir rota da obra "${r.obra}"?`)) return;
    const { error } = await supabase.from("rotas").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Rota excluída"); load(); }
  };

  return (
    <AppShell title="Rotas">
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-1" /> Nova rota
            </Button>
          </DialogTrigger>
          <RotaFormDialog userId={user!.id} onClose={() => { setOpen(false); load(); }} />
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : list.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <RouteIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nenhuma rota cadastrada.
        </CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {list.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{r.material}</div>
                    <div className="text-lg font-semibold">{r.obra}</div>
                  </div>
                  <Badge variant={r.status === "disponivel" ? "default" : "secondary"}>
                    {r.status === "disponivel" ? "Disponível" : "Finalizada"}
                  </Badge>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex gap-2"><MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" /><div><strong>Origem:</strong> {r.origem_endereco}{r.origem_complemento && ` — ${r.origem_complemento}`}</div></div>
                  <div className="flex gap-2"><MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" /><div><strong>Destino:</strong> {r.destino_endereco}{r.destino_complemento && ` — ${r.destino_complemento}`}</div></div>
                  <div className="flex gap-2"><Calendar className="h-4 w-4 text-accent mt-0.5 shrink-0" /><div>{new Date(r.horario_previsto).toLocaleString("pt-BR")}</div></div>
                </div>
                <div className="flex flex-wrap gap-3 text-sm border-t pt-3">
                  <div><span className="text-muted-foreground">Preço:</span> <strong>{formatBRL(Number(r.preco_por_m3))}/m³</strong></div>
                  {r.distancia_km != null && (
                    <>
                      <div><span className="text-muted-foreground">Distância:</span> <strong>{Number(r.distancia_km).toLocaleString("pt-BR")} km</strong></div>
                      <div><span className="text-muted-foreground">R$/km/m³:</span> <strong>{(Number(r.preco_por_m3) / Number(r.distancia_km)).toFixed(2)}</strong></div>
                    </>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => handleStatusToggle(r)}>
                    {r.status === "disponivel" ? "Finalizar" : "Reabrir"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(r)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function RotaFormDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [form, setForm] = useState({
    obra: "", material: "",
    origem_endereco: "", origem_complemento: "",
    destino_endereco: "", destino_complemento: "",
    preco_por_m3: "", horario_previsto: "",
  });
  const [distancia, setDistancia] = useState<number | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [busy, setBusy] = useState(false);

  const calcularDistancia = async () => {
    if (!form.origem_endereco || !form.destino_endereco) {
      toast.error("Preencha origem e destino antes");
      return;
    }
    setCalculando(true);
    const km = await calcularDistanciaKm(form.origem_endereco, form.destino_endereco);
    setCalculando(false);
    if (km == null) toast.error("Não foi possível calcular a distância. Verifique os endereços.");
    else { setDistancia(km); toast.success(`Distância: ${km} km`); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = rotaSchema.safeParse({
      ...form,
      preco_por_m3: parseFloat(form.preco_por_m3.replace(",", ".")),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    setBusy(true);
    let km = distancia;
    if (km == null) km = await calcularDistanciaKm(parsed.data.origem_endereco, parsed.data.destino_endereco);

    const { error } = await supabase.from("rotas").insert({
      obra: parsed.data.obra,
      material: parsed.data.material,
      origem_endereco: parsed.data.origem_endereco,
      origem_complemento: parsed.data.origem_complemento || null,
      destino_endereco: parsed.data.destino_endereco,
      destino_complemento: parsed.data.destino_complemento || null,
      preco_por_m3: parsed.data.preco_por_m3,
      horario_previsto: new Date(parsed.data.horario_previsto).toISOString(),
      distancia_km: km,
      criada_por: userId,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Rota criada"); onClose(); }
  };

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nova rota</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Obra</Label>
            <Input value={form.obra} onChange={(e) => setForm({ ...form, obra: e.target.value })} placeholder="Ex: Portrait" required />
          </div>
          <div className="space-y-1">
            <Label>Material</Label>
            <Input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="Ex: SOLO TIPO 2B" required />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Endereço de origem</Label>
          <Textarea rows={2} value={form.origem_endereco} onChange={(e) => setForm({ ...form, origem_endereco: e.target.value })} required />
          <Input className="mt-1" placeholder="Complemento (opcional)" value={form.origem_complemento} onChange={(e) => setForm({ ...form, origem_complemento: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Endereço de destino</Label>
          <Textarea rows={2} value={form.destino_endereco} onChange={(e) => setForm({ ...form, destino_endereco: e.target.value })} required />
          <Input className="mt-1" placeholder="Complemento (opcional)" value={form.destino_complemento} onChange={(e) => setForm({ ...form, destino_complemento: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={calcularDistancia} disabled={calculando}>
            {calculando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MapPin className="h-4 w-4 mr-1" />}
            Calcular distância
          </Button>
          {distancia != null && <span className="text-sm"><strong>{distancia} km</strong></span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Preço por m³ (R$)</Label>
            <Input type="number" step="0.01" min="0.01" value={form.preco_por_m3}
              onChange={(e) => setForm({ ...form, preco_por_m3: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Horário previsto</Label>
            <Input type="datetime-local" value={form.horario_previsto}
              onChange={(e) => setForm({ ...form, horario_previsto: e.target.value })} required />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={busy}>
            {busy ? "Salvando…" : "Criar rota"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
