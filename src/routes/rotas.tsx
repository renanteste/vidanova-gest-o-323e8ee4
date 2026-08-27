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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { RouteMap } from "@/components/RouteMap";

import { toast } from "sonner";
import { Plus, MapPin, Calendar, Trash2, Route as RouteIcon, Loader2, Pencil, Building2, UserCog } from "lucide-react";
import { routeDistanceKm, formatBRL, geocode } from "@/lib/geo";

export const Route = createFileRoute("/rotas")({
  component: () => (
    <RequireAuth allow={["admin", "frota"]}>
      <RotasPage />
    </RequireAuth>
  ),
});

// Opções fixas de material (gravadas na coluna existente `material`)
const MATERIAIS = ["Solo", "Limpeza/Entulho"] as const;
// Opções de "Tipo de escavação" — reutiliza a coluna existente `responsavel`
const TIPOS_ESCAVACAO = ["Corte", "Hélice", "Limpeza/Entulho", "Blocos/Baldrames", "Outros"] as const;
// Destino padrão: Aterro Vida Nova
const ATERRO_ENDERECO = "Aterro Vida Nova - Avenida Chica Luiza, Jaraguá, São Paulo - SP, 05184-630";
const ATERRO_COORDS = { lat: -23.43723, lon: -46.761031 };

type Rota = {
  id: string;
  obra: string;
  material: string;
  construtora: string | null;
  responsavel: string | null;
  origem_endereco: string;
  origem_complemento: string | null;
  destino_endereco: string;
  destino_complemento: string | null;
  lat_origem: number | null;
  lng_origem: number | null;
  lat_destino: number | null;
  lng_destino: number | null;
  preco_por_m3: number;
  horario_previsto: string;
  distancia_km: number | null;
  status: "disponivel" | "finalizada";
  criada_por: string;
};

const rotaSchema = z.object({
  obra: z.string().trim().min(2, "Informe a obra").max(120),
  construtora: z.string().trim().min(2, "Informe a construtora").max(120),
  responsavel: z.string().trim().max(120).optional().or(z.literal("")),
  material: z.string().trim().min(2, "Informe o material").max(120),
  origem_endereco: z.string().trim().min(5, "Endereço de origem inválido").max(300),
  origem_complemento: z.string().max(120).optional().or(z.literal("")),
  destino_endereco: z.string().trim().max(300).optional().or(z.literal("")),
  destino_complemento: z.string().max(120).optional().or(z.literal("")),
  preco_por_m3: z.number().positive("Preço deve ser maior que 0"),
});


function RotasPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.perfil === "admin";
  const [list, setList] = useState<Rota[]>([]);
  const [viagens, setViagens] = useState<any[]>([]); // trips for status check
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rota | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: rotasData, error: rotasError } = await supabase.from("rotas").select("*").order("horario_previsto", { ascending: true });
    const { data: viagensData, error: viagensError } = await supabase.from("viagens").select("rota_id,inicio_em");
    if (rotasError) toast.error(rotasError.message);
    if (viagensError) toast.error(viagensError.message);
    setList((rotasData as unknown as Rota[]) ?? []);
    setViagens(viagensData ?? []);
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
    // Verifica registros relacionados antes de excluir (não remove dados de outras entidades)
    const [{ count: viagensCount }, { count: interessesCount }] = await Promise.all([
      supabase.from("viagens").select("id", { count: "exact", head: true }).eq("rota_id", r.id),
      supabase.from("interesses_rotas").select("id", { count: "exact", head: true }).eq("rota_id", r.id),
    ]);
    if ((viagensCount ?? 0) > 0 || (interessesCount ?? 0) > 0) {
      toast.error(
        `Não é possível excluir a obra "${r.obra}": existem ${viagensCount ?? 0} viagem(ns) e ${interessesCount ?? 0} interesse(s) vinculados.`,
      );
      return;
    }
    if (!confirm(`Excluir a obra "${r.obra}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("rotas").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Obra excluída"); load(); }
  };


  return (
    <AppShell title={isAdmin ? "Obras" : "Obras (visualização)"}>
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-1" /> Nova obra
              </Button>
            </DialogTrigger>
            <RotaFormDialog userId={user!.id} onClose={() => { setOpen(false); load(); }} />
          </Dialog>
        </div>
      )}

      {isAdmin && editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <RotaFormDialog
            userId={user!.id}
            initial={editing}
            onClose={() => { setEditing(null); load(); }}
          />
        </Dialog>
      )}

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : list.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <RouteIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nenhuma obra cadastrada.
        </CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {list.map((r) => {
            const started = viagens.some(v => v.rota_id === r.id && v.inicio_em);
            return (
              <Card key={r.id}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{r.material}</div>
                      <div className="text-lg font-semibold">{r.obra}</div>
                      {r.construtora && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3.5 w-3.5" /> {r.construtora}
                        </div>
                      )}
                    </div>
                  <Badge variant={r.status === "disponivel" ? "default" : "secondary"}>{r.status === "disponivel" ? "DISPONÍVEL" : "FINALIZADA"}</Badge>
                </div>
                <div className="text-sm space-y-1">
                  {r.responsavel && (
                    <div className="flex gap-2"><UserCog className="h-4 w-4 text-accent mt-0.5 shrink-0" /><div><strong>Tipo de escavação:</strong> {r.responsavel}</div></div>
                  )}
                  <div className="flex gap-2"><MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" /><div><strong>Origem:</strong> {r.origem_endereco}{r.origem_complemento && ` — ${r.origem_complemento}`}</div></div>
                  <div className="flex gap-2"><MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" /><div><strong>Destino:</strong> {r.destino_endereco || "—"}{r.destino_complemento && ` — ${r.destino_complemento}`}</div></div>
                  {/* Horário previsto removido da exibição (coluna mantida no banco). */}

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
                {isAdmin && (
                  <div className="flex gap-2 pt-1 flex-wrap">
                    {!started && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                        {r.status === "disponivel" && (
                          <Button size="sm" variant="outline" onClick={() => handleStatusToggle(r)}>Finalizar</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleDelete(r)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir</Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function RotaFormDialog({
  userId, initial, onClose,
}: { userId: string; initial?: Rota; onClose: () => void }) {
  const [form, setForm] = useState({
    obra: initial?.obra ?? "",
    construtora: initial?.construtora ?? "",
    responsavel: initial?.responsavel ?? "",
    material: initial?.material ?? "",
    origem_endereco: initial?.origem_endereco ?? "",
    origem_complemento: initial?.origem_complemento ?? "",
    destino_endereco: initial?.destino_endereco ?? ATERRO_ENDERECO,
    destino_complemento: initial?.destino_complemento ?? "",
    preco_por_m3: initial?.preco_por_m3?.toString() ?? "",
  });
  // Identifica se a obra existente já usa o aterro (sem alterar registros antigos)
  const [destinoTipo, setDestinoTipo] = useState<"aterro" | "outro">(
    !initial || (initial.destino_endereco ?? "") === ATERRO_ENDERECO ? "aterro" : "outro",
  );
  const [origemCoords, setOrigemCoords] = useState<{ lat: number; lon: number } | null>(
    initial?.lat_origem != null && initial?.lng_origem != null
      ? { lat: Number(initial.lat_origem), lon: Number(initial.lng_origem) } : null,
  );
  const [destinoCoords, setDestinoCoords] = useState<{ lat: number; lon: number } | null>(
    initial?.lat_destino != null && initial?.lng_destino != null
      ? { lat: Number(initial.lat_destino), lon: Number(initial.lng_destino) }
      : initial ? null : ATERRO_COORDS,
  );
  const [distancia, setDistancia] = useState<number | null>(initial?.distancia_km ?? null);
  const [calculando, setCalculando] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDestinoTipo = (v: "aterro" | "outro") => {
    setDestinoTipo(v);
    if (v === "aterro") {
      setForm((f) => ({ ...f, destino_endereco: ATERRO_ENDERECO }));
      setDestinoCoords(ATERRO_COORDS);
      setDistancia(null);
    }
  };

  // Recalcular distância automaticamente quando ambas coords forem conhecidas
  useEffect(() => {
    if (!origemCoords || !destinoCoords) return;
    let cancelled = false;
    setCalculando(true);
    routeDistanceKm(origemCoords, destinoCoords).then((km) => {
      if (cancelled) return;
      setCalculando(false);
      if (km != null) setDistancia(km);
    });
    return () => { cancelled = true; };
  }, [origemCoords, destinoCoords]);

  const preco = parseFloat(form.preco_por_m3.replace(",", "."));
  const valorKmM3 = distancia && preco > 0 ? preco / distancia : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = rotaSchema.safeParse({ ...form, preco_por_m3: preco });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    setBusy(true);

    // garante coords (geocode fallback se o usuário digitou sem clicar na sugestão)
    const destinoEndereco = parsed.data.destino_endereco ?? "";
    let oc = origemCoords;
    let dc = destinoCoords;
    if (!oc) oc = await geocode(parsed.data.origem_endereco);
    if (!dc && destinoEndereco) dc = await geocode(destinoEndereco);

    let km = distancia;
    if (oc && dc && km == null) km = await routeDistanceKm(oc, dc);

    const payload = {
      obra: parsed.data.obra,
      construtora: parsed.data.construtora,
      responsavel: parsed.data.responsavel || null,
      material: parsed.data.material,
      origem_endereco: parsed.data.origem_endereco,
      origem_complemento: parsed.data.origem_complemento || null,
      destino_endereco: destinoEndereco,
      destino_complemento: parsed.data.destino_complemento || null,
      lat_origem: oc?.lat ?? null,
      lng_origem: oc?.lon ?? null,
      lat_destino: dc?.lat ?? null,
      lng_destino: dc?.lon ?? null,
      preco_por_m3: parsed.data.preco_por_m3,
      // Campo "Horário previsto" removido do formulário; a coluna é mantida no banco
      // e preenchida com o valor já existente (edição) ou com a data atual (criação).
      horario_previsto: initial?.horario_previsto ?? new Date().toISOString(),
      distancia_km: km,
    } as any;

    const { error } = initial
      ? await supabase.from("rotas").update(payload).eq("id", initial.id)
      : await supabase.from("rotas").insert({ ...payload, criada_por: userId });

    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(initial ? "Obra atualizada" : "Obra criada"); onClose(); }
  };


  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Editar obra" : "Nova obra"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Obra *</Label>
            <Input value={form.obra} onChange={(e) => setForm({ ...form, obra: e.target.value })} placeholder="Ex: Portrait" required />
          </div>
          <div className="space-y-1">
            <Label>Construtora *</Label>
            <Input value={form.construtora} onChange={(e) => setForm({ ...form, construtora: e.target.value })} placeholder="Ex: Cyrela" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Material *</Label>
            <Select value={form.material} onValueChange={(v) => setForm((f) => ({ ...f, material: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {MATERIAIS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            {/* Reutiliza a coluna existente `responsavel` */}
            <Label>Tipo de escavação</Label>
            <Select value={form.responsavel} onValueChange={(v) => setForm((f) => ({ ...f, responsavel: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS_ESCAVACAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Endereço de origem *</Label>
          <AddressAutocomplete
            value={form.origem_endereco}
            onChange={(v, coords) => {
              setForm((f) => ({ ...f, origem_endereco: v }));
              if (coords) setOrigemCoords(coords); else setOrigemCoords(null);
            }}
            required
          />
          <Input className="mt-1" placeholder="Complemento (opcional)" value={form.origem_complemento}
            onChange={(e) => setForm({ ...form, origem_complemento: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Destino</Label>
          <Select value={destinoTipo} onValueChange={(v) => handleDestinoTipo(v as "aterro" | "outro")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aterro">Aterro Vida Nova</SelectItem>
              <SelectItem value="outro">Outro destino</SelectItem>
            </SelectContent>
          </Select>
          {destinoTipo === "aterro" ? (
            <p className="text-xs text-muted-foreground mt-1">{ATERRO_ENDERECO}</p>
          ) : (
            <AddressAutocomplete
              value={form.destino_endereco}
              onChange={(v, coords) => {
                setForm((f) => ({ ...f, destino_endereco: v }));
                if (coords) setDestinoCoords(coords); else setDestinoCoords(null);
              }}
            />
          )}
          <Input className="mt-1" placeholder="Complemento (opcional)" value={form.destino_complemento}
            onChange={(e) => setForm({ ...form, destino_complemento: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Preço por m³ (R$) *</Label>
            <Input type="number" step="0.01" min="0.01" value={form.preco_por_m3}
              onChange={(e) => setForm({ ...form, preco_por_m3: e.target.value })} required />
          </div>
        </div>

        {/* Mapa apenas de visualização — não altera dados nem bloqueia o salvamento */}
        <div className="space-y-1">
          <Label>Trajeto (visualização)</Label>
          <RouteMap
            origemEndereco={form.origem_endereco}
            destinoEndereco={form.destino_endereco}
            origemCoords={origemCoords}
            destinoCoords={destinoCoords}
          />
        </div>

        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm flex flex-wrap gap-x-4 gap-y-1">
          <div className="flex items-center gap-1">
            <strong>Distância:</strong>
            {calculando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
              distancia != null ? `${distancia.toLocaleString("pt-BR")} km` : "—"}
          </div>
          <div>
            <strong>R$/km/m³:</strong> {valorKmM3 != null ? valorKmM3.toFixed(2) : "—"}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={busy}>
            {busy ? "Salvando…" : initial ? "Salvar alterações" : "Criar obra"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
