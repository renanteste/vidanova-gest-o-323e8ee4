import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ rotaIds: z.array(z.string().uuid()).max(200) });

/**
 * Retorna os dados das obras (rotas) vinculadas às viagens do motorista logado.
 * A autorização é verificada com o próprio token do usuário (RLS): só retorna
 * obras em que o usuário é o motorista do interesse ou o motorista designado,
 * e o interesse está aprovado (pelo Admin ou pela Frota).
 * Nenhuma policy, tabela ou coluna é alterada.
 */
export const getRotasDoMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.rotaIds.length) return { rotas: [] as any[] };

    const { data: ints, error } = await context.supabase
      .from("interesses_rotas")
      .select("rota_id, status, status_aprovacao_frota, motorista_id, motorista_designado_id")
      .in("rota_id", data.rotaIds);
    if (error) throw error;

    const allowed = (ints ?? [])
      .filter(
        (i: any) =>
          (i.motorista_id === context.userId || i.motorista_designado_id === context.userId) &&
          (i.status === "aprovado" || i.status_aprovacao_frota === "aprovado"),
      )
      .map((i: any) => i.rota_id as string);

    if (!allowed.length) return { rotas: [] as any[] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rotas, error: rErr } = await supabaseAdmin
      .from("rotas")
      .select(
        "id, obra, material, responsavel, construtora, preco_por_m3, distancia_km, status, origem_endereco, origem_complemento, destino_endereco, destino_complemento, horario_previsto",
      )
      .in("id", allowed);
    if (rErr) throw rErr;

    return { rotas: rotas ?? [] };
  });
