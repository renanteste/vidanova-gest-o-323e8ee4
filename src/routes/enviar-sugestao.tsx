import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, perfilLabel } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { getLastPath } from "@/lib/last-path";

export const Route = createFileRoute("/enviar-sugestao")({
  head: () => ({
    meta: [
      { title: "Enviar sugestão | VidaNova Terraplenagem" },
      { name: "description", content: "Envie sugestões de melhoria, reporte problemas ou tire dúvidas sobre o sistema VidaNova Terraplenagem." },
      { property: "og:title", content: "Enviar sugestão | VidaNova Terraplenagem" },
      { property: "og:description", content: "Envie sugestões de melhoria, reporte problemas ou tire dúvidas sobre o sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <EnviarSugestaoPage />
    </RequireAuth>
  ),
});

const TIPOS = ["Sugestão", "Problema", "Dúvida"];

function EnviarSugestaoPage() {
  const { user, profile } = useAuth();
  const [pagina] = useState(() => getLastPath());


  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo) return toast.error("Selecione o tipo.");
    if (!titulo.trim()) return toast.error("Informe o título.");
    if (!descricao.trim()) return toast.error("Descreva com o máximo de detalhes possível.");
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.from("feedbacks").insert({
      usuario_id: user.id,
      nome_usuario: profile?.nome ?? null,
      email_usuario: user.email ?? null,
      perfil_usuario: profile ? perfilLabel[profile.perfil] : null,
      pagina,
      tipo,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
    });
    setSaving(false);

    if (error) {
      toast.error("Não foi possível enviar: " + error.message);
      return;
    }
    toast.success("Sugestão enviada com sucesso. Obrigado pelo seu feedback!");
    setTipo("");
    setTitulo("");
    setDescricao("");
  };

  return (
    <AppShell title="Enviar sugestão">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Sugestão, problema ou dúvida</CardTitle>
          <CardDescription>
            Descreva com o máximo de detalhes possível para que possamos entender e acompanhar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={titulo}
                maxLength={150}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Resumo em uma frase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Textarea
                id="descricao"
                value={descricao}
                maxLength={4000}
                rows={7}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva com o máximo de detalhes possível: o que aconteceu, o que você esperava e como reproduzir."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pagina">Página</Label>
              <Input id="pagina" value={pagina} readOnly className="bg-muted" />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar sugestão
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
