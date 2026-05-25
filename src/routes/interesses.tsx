import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Inbox, Check, X } from "lucide-react";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/interesses")({
  component: () => (
    <RequireAuth allow={["admin", "frota"]}>
      <InteressesPage />
    </RequireAuth>
  ),
});

type Item = {
  id: string;
  rota_id: string;
  motorista_id: string;
  veiculo_id: string;
  status: "pendente" | "aprovado" | "rejeitado";
  created_at: string;
  rota?: { obra: string; material: string; preco_por_m3: number; horario_previsto: string };
  veiculo?: { placa: string; modelo: string; capacidade_m3: number };
  motorista?: { nome: string };
};

function InteressesPage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("interesses_rotas")
      .select("id, rota_id, motorista_id, veiculo_id, status, created_at")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }

    const rows = (data ?? []) as Item[];
    if (rows.length === 0) { setItems([]); setLoading(false); return; }

    const rotaIds = [...new Set(rows.map((r) => r.rota_id))];
    const vehIds = [...new Set(rows.map((r) => r.veiculo_id))];
    const motIds = [...new Set(rows.map((r) => r.motorista_id))];

    const [rotasRes, vehRes, motRes] = await Promise.all([
      supabase.from("rotas").select("id, obra, material, preco_por_m3, horario_previsto").in("id", rotaIds),
      supabase.from("veiculos").select("id, placa, modelo, capacidade_m3").in("id", vehIds),
      supabase.from("profiles").select("user_id, nome").in("user_id", motIds),
    ]);

    const rotaMap = new Map((rotasRes.data ?? []).map((x: any) => [x.id, x]));
    const vehMap = new Map((vehRes.data ?? []).map((x: any) => [x.id, x]));
    const motMap = new Map((motRes.data ?? []).map((x: any) => [x.user_id, x]));

    setItems(rows.map((r) => ({
      ...r,
      rota: rotaMap.get(r.rota_id) as any,
      veiculo: vehMap.get(r.veiculo_id) as any,
      motorista: motMap.get(r.motorista_id) as any,
    })));
    setLoading(false);
  };

  useEffect(() => { if (user && profile) load(); }, [user, profile]);

  const handleAction = async (it: Item, novo: "aprovado" | "rejeitado") => {
    const { error } = await supabase.from("interesses_rotas").update({ status: novo }).eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    if (novo === "aprovado" && it.rota) {
      await supabase.from("rotas").update({ status: "finalizada" }).eq("id", it.rota_id);
    }
    toast.success(novo === "aprovado" ? "Interesse aprovado e rota atribuída" : "Interesse rejeitado");
    load();
  };

  return (
    <AppShell title="Interesses em rotas">
      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nenhum interesse registrado.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const valorTotal = it.rota && it.veiculo ? Number(it.rota.preco_por_m3) * Number(it.veiculo.capacidade_m3) : null;
            return (
              <Card key={it.id}>
                <CardContent className="pt-5 grid sm:grid-cols-[1fr_auto] gap-4 items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold">{it.rota?.obra ?? "—"}</div>
                      <Badge variant={
                        it.status === "aprovado" ? "default" :
                        it.status === "rejeitado" ? "destructive" : "secondary"
                      }>
                        {it.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{it.rota?.material}</div>
                    <div className="text-sm">
                      <strong>Motorista:</strong> {it.motorista?.nome ?? it.motorista_id.slice(0, 8)}
                    </div>
                    <div className="text-sm">
                      <strong>Veículo:</strong> {it.veiculo?.placa} — {it.veiculo?.modelo} ({Number(it.veiculo?.capacidade_m3 ?? 0).toLocaleString("pt-BR")} m³)
                    </div>
                    {valorTotal != null && (
                      <div className="text-sm"><strong>Frete total:</strong> <span className="text-accent font-semibold">{formatBRL(valorTotal)}</span></div>
                    )}
                  </div>
                  {it.status === "pendente" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAction(it, "aprovado")} className="bg-accent text-accent-foreground hover:bg-accent/90">
                        <Check className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAction(it, "rejeitado")}>
                        <X className="h-4 w-4 mr-1" /> Rejeitar
                      </Button>
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
