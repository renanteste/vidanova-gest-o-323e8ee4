import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/feedbacks")({
  head: () => ({
    meta: [
      { title: "Feedbacks | VidaNova Terraplenagem" },
      { name: "description", content: "Acompanhamento das sugestões, problemas e dúvidas enviados pelos usuários do sistema." },
      { property: "og:title", content: "Feedbacks | VidaNova Terraplenagem" },
      { property: "og:description", content: "Acompanhamento das sugestões, problemas e dúvidas enviados pelos usuários." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth allow={["admin"]}>
      <FeedbacksPage />
    </RequireAuth>
  ),
});

const STATUS = ["Novo", "Em análise", "Em desenvolvimento", "Concluído", "Não será implementado"];

interface Feedback {
  id: string;
  created_at: string;
  usuario_id: string;
  nome_usuario: string | null;
  email_usuario: string | null;
  perfil_usuario: string | null;
  pagina: string | null;
  tipo: string;
  titulo: string;
  descricao: string;
  status: string;
  resolucao: string | null;
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "Concluído": return "default";
    case "Não será implementado": return "destructive";
    case "Novo": return "secondary";
    default: return "outline";
  }
}

function FeedbacksPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [status, setStatus] = useState("");
  const [resolucao, setResolucao] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar feedbacks: " + error.message);
      return;
    }
    setItems((data ?? []) as Feedback[]);
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = (fb: Feedback) => {
    setSelected(fb);
    setStatus(fb.status);
    setResolucao(fb.resolucao ?? "");
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("feedbacks")
      .update({ status, resolucao: resolucao.trim() || null })
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Feedback atualizado.");
    setSelected(null);
    load();
  };

  return (
    <AppShell title="Feedbacks">
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum feedback recebido.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Página</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((fb) => (
                    <TableRow key={fb.id} className="cursor-pointer" onClick={() => openDetail(fb)}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(fb.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>{fb.nome_usuario ?? "—"}</TableCell>
                      <TableCell>{fb.perfil_usuario ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{fb.pagina ?? "—"}</TableCell>
                      <TableCell>{fb.tipo}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{fb.titulo}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(fb.status)}>{fb.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.titulo}</DialogTitle>
                <DialogDescription>
                  {selected.tipo} · {new Date(selected.created_at).toLocaleString("pt-BR")}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <Detail label="Usuário" value={selected.nome_usuario} />
                <Detail label="E-mail" value={selected.email_usuario} />
                <Detail label="Perfil" value={selected.perfil_usuario} />
                <Detail label="Página" value={selected.pagina} />
              </div>

              <div>
                <Label className="text-muted-foreground">Descrição</Label>
                <p className="mt-1 whitespace-pre-wrap text-sm">{selected.descricao}</p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolucao">Resolução</Label>
                <Textarea
                  id="resolucao"
                  rows={4}
                  maxLength={4000}
                  value={resolucao}
                  onChange={(e) => setResolucao(e.target.value)}
                  placeholder="Descreva o encaminhamento ou a solução aplicada."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span>{value || "—"}</span>
    </div>
  );
}
