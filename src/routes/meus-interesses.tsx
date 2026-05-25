import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/meus-interesses")({
  component: () => (
    <RequireAuth allow={["motorista_autonomo", "motorista_vinculado"]}>
      <MeusInteressesPage />
    </RequireAuth>
  ),
});

type Item = {
  id: string; rota_id: string; veiculo_id: string; status: "pendente" | "aprovado" | "rejeitado"; created_at: string;
  rota?: { obra: string; material: string; preco_por_m3: number; horario_previsto: string };
  veiculo?: { placa: string; modelo: string; capacidade_m3: number };
};

function MeusInteressesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("interesses_rotas")
      .select("id, rota_id, veiculo_id, status, created_at")
      .eq("motorista_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data ?? []) as Item[];
    if (!rows.length) { setItems([]); setLoading(false); return; }
    const [r, v] = await Promise.all([
      supabase.from("rotas").select("id, obra, material, preco_por_m3, horario_previsto").in("id", rows.map((x) => x.rota_id)),
      supabase.from("veiculos").select("id, placa, modelo, capacidade_m3").in("id", rows.map((x) => x.veiculo_id)),
    ]);
    const rm = new Map((r.data ?? []).map((x: any) => [x.id, x]));
    const vm = new Map((v.data ?? []).map((x: any) => [x.id, x]));
    setItems(rows.map((x) => ({ ...x, rota: rm.get(x.rota_id) as any, veiculo: vm.get(x.veiculo_id) as any })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const cancelar = async (it: Item) => {
    if (!confirm("Cancelar este interesse?")) return;
    const { error } = await supabase.from("interesses_rotas").delete().eq("id", it.id);
    if (error) toast.error(error.message);
    else { toast.success("Interesse cancelado"); load(); }
  };

  return (
    <AppShell title="Meus interesses">
      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Você ainda não demonstrou interesse em rotas.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const total = it.rota && it.veiculo ? Number(it.rota.preco_por_m3) * Number(it.veiculo.capacidade_m3) : null;
            return (
              <Card key={it.id}>
                <CardContent className="pt-5 grid sm:grid-cols-[1fr_auto] gap-4 items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold">{it.rota?.obra}</div>
                      <Badge variant={it.status === "aprovado" ? "default" : it.status === "rejeitado" ? "destructive" : "secondary"}>
                        {it.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{it.rota?.material}</div>
                    <div className="text-sm"><strong>Veículo:</strong> {it.veiculo?.placa} ({Number(it.veiculo?.capacidade_m3 ?? 0).toLocaleString("pt-BR")} m³)</div>
                    {total != null && <div className="text-sm"><strong>Frete:</strong> <span className="text-accent font-semibold">{formatBRL(total)}</span></div>}
                  </div>
                  {it.status === "pendente" && (
                    <Button size="sm" variant="outline" onClick={() => cancelar(it)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
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
