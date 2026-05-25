import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Calendar, Route as RouteIcon, HandHeart } from "lucide-react";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/rotas-disponiveis")({
  component: () => (
    <RequireAuth allow={["motorista_autonomo", "motorista_vinculado"]}>
      <RotasDisponiveisPage />
    </RequireAuth>
  ),
});

type Rota = {
  id: string;
  obra: string;
  material: string;
  origem_endereco: string;
  destino_endereco: string;
  preco_por_m3: number;
  horario_previsto: string;
  distancia_km: number | null;
  status: string;
};

type Veiculo = {
  id: string; placa: string; modelo: string; capacidade_m3: number; proprietario_id: string;
};

function RotasDisponiveisPage() {
  const { user, profile } = useAuth();
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [interesseRotaIds, setInteresseRotaIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Rota | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [r, v, i] = await Promise.all([
      supabase.from("rotas").select("*").eq("status", "disponivel").order("horario_previsto"),
      supabase.from("veiculos").select("id, placa, modelo, capacidade_m3, proprietario_id").eq("ativa", true),
      supabase.from("interesses_rotas").select("rota_id").eq("motorista_id", user.id),
    ]);
    setRotas((r.data as Rota[]) ?? []);
    setVeiculos((v.data as Veiculo[]) ?? []);
    setInteresseRotaIds(new Set((i.data ?? []).map((x: any) => x.rota_id)));
    setLoading(false);
  };

  useEffect(() => { if (user && profile) load(); }, [user, profile]);

  const meuVeiculoAutonomo = veiculos.find((v) => v.proprietario_id === user?.id);

  return (
    <AppShell title="Rotas disponíveis">
      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : rotas.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <RouteIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nenhuma rota disponível no momento.
        </CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {rotas.map((r) => {
            const capRef = profile?.perfil === "motorista_autonomo" ? meuVeiculoAutonomo?.capacidade_m3 : null;
            const valorTotal = capRef ? Number(r.preco_por_m3) * Number(capRef) : null;
            const jaInteressado = interesseRotaIds.has(r.id);
            return (
              <Card key={r.id} className="overflow-hidden">
                <div className="bg-accent/10 px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{r.material}</div>
                    <div className="text-lg font-semibold">{r.obra}</div>
                  </div>
                  <Badge className="bg-accent text-accent-foreground">{formatBRL(Number(r.preco_por_m3))}/m³</Badge>
                </div>
                <CardContent className="pt-4 space-y-2 text-sm">
                  <div className="flex gap-2"><MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" /><div className="line-clamp-1"><strong>De:</strong> {r.origem_endereco}</div></div>
                  <div className="flex gap-2"><MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" /><div className="line-clamp-1"><strong>Para:</strong> {r.destino_endereco}</div></div>
                  <div className="flex gap-2"><Calendar className="h-4 w-4 text-accent mt-0.5 shrink-0" /><div>{new Date(r.horario_previsto).toLocaleString("pt-BR")}</div></div>
                  {r.distancia_km != null && (
                    <div className="text-muted-foreground">Distância estimada: <strong className="text-foreground">{Number(r.distancia_km).toLocaleString("pt-BR")} km</strong></div>
                  )}
                  {valorTotal != null && (
                    <div className="border-t pt-2 mt-2">
                      <div className="text-xs text-muted-foreground">Valor estimado (com seu veículo de {Number(capRef).toLocaleString("pt-BR")} m³)</div>
                      <div className="text-xl font-bold text-accent">{formatBRL(valorTotal)}</div>
                    </div>
                  )}
                  <div className="pt-2">
                    {jaInteressado ? (
                      <Button size="sm" variant="outline" disabled className="w-full">Interesse já registrado</Button>
                    ) : (
                      <Button size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setTarget(r)}>
                        <HandHeart className="h-4 w-4 mr-1" /> Tenho interesse
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {target && (
        <InteresseDialog
          rota={target}
          veiculos={veiculos}
          userId={user!.id}
          perfil={profile!.perfil}
          onClose={(reload) => { setTarget(null); if (reload) load(); }}
        />
      )}
    </AppShell>
  );
}

function InteresseDialog({
  rota, veiculos, userId, perfil, onClose,
}: {
  rota: Rota; veiculos: Veiculo[]; userId: string;
  perfil: "motorista_autonomo" | "motorista_vinculado" | "admin" | "frota";
  onClose: (reload?: boolean) => void;
}) {
  const meusVeiculos = perfil === "motorista_autonomo"
    ? veiculos.filter((v) => v.proprietario_id === userId)
    : veiculos;
  const [veiculoId, setVeiculoId] = useState<string>(meusVeiculos[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!veiculoId) { toast.error("Selecione um veículo"); return; }
    setBusy(true);
    const { error } = await supabase.from("interesses_rotas").insert({
      rota_id: rota.id, motorista_id: userId, veiculo_id: veiculoId,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Interesse registrado"); onClose(true); }
  };

  const veiculoEscolhido = meusVeiculos.find((v) => v.id === veiculoId);
  const valorTotal = veiculoEscolhido ? Number(rota.preco_por_m3) * Number(veiculoEscolhido.capacidade_m3) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar interesse — {rota.obra}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {meusVeiculos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum veículo disponível.</p>
          ) : (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {perfil === "motorista_autonomo" ? "Seu veículo" : "Escolha o veículo da frota"}
              </label>
              <Select value={veiculoId} onValueChange={setVeiculoId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meusVeiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} — {v.modelo} ({Number(v.capacidade_m3).toLocaleString("pt-BR")} m³)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {valorTotal != null && (
            <div className="rounded-md bg-accent/10 p-3">
              <div className="text-xs text-muted-foreground">Valor total estimado do frete</div>
              <div className="text-2xl font-bold text-accent">{formatBRL(valorTotal)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {Number(veiculoEscolhido!.capacidade_m3).toLocaleString("pt-BR")} m³ × {formatBRL(Number(rota.preco_por_m3))}/m³
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={submit} disabled={busy || meusVeiculos.length === 0}>
            {busy ? "Enviando…" : "Confirmar interesse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
