
## Estado atual (análise)

- **`/dashboard/frota`**: apenas 2 KPIs (veículos + motoristas vinculados). Sem viagens, gráficos, rankings.
- **`/motoristas`**: criação OK (signUp + restauração de sessão da frota). Sem editar / desativar / bloquear / foto.
- **`/interesses`**: atualmente ADMIN e FROTA usam a mesma página. Hoje a frota vê interesses dos seus motoristas (RLS via `route creator reads interests` exige `rotas.criada_por = auth.uid()` — ou seja, a frota só vê interesses de rotas que ela mesma criou, o que não combina com o novo fluxo "admin cria, frota aprova internamente").
- **Fluxo atual divergente**: hoje motorista vinculado cria o interesse direto. O novo fluxo exige que a frota receba a rota aprovada e só então atribua motorista+veículo.
- **Bucket `motoristas`**: não existe (só `veiculos` e `viagens`).

## Mudanças propostas

### Migrations (uma só)
1. `interesses_rotas`: adicionar `status_aprovacao_frota TEXT DEFAULT 'pendente'`, `motorista_designado_id UUID`, `veiculo_designado_id UUID`, `aprovado_frota_em TIMESTAMPTZ`.
2. Criar bucket público `motoristas` + policies (frota lê/escreve em `motoristas/{frota_id}/...`, dono lê o próprio).
3. **RLS `interesses_rotas`**: adicionar policy para frota — `SELECT/UPDATE` quando `EXISTS (profile motorista com fk_frota_id = auth.uid())`. Não remove policies existentes.
4. **RLS `rotas-disponiveis` para motorista vinculado**: hoje só vê rotas com `status = 'disponivel'`. Precisamos que ele veja a rota quando há um `interesses_rotas` com `motorista_designado_id = auth.uid()` e `status_aprovacao_frota = 'aprovado'`. Adicionar policy SELECT em `rotas` para esse caso.
5. **RLS `profiles`**: permitir frota fazer `UPDATE` em motoristas com `fk_frota_id = auth.uid()` (edição/bloqueio); hoje só admin e o próprio user atualizam.

### Arquivos a alterar
- `src/routes/dashboard.frota.tsx` — reescrever com KPIs, gráfico Recharts (viagens 7d), top 3 motoristas/veículos, tabela 10 viagens recentes, veículos sem uso 7d, motoristas inativos. Escopo: `proprietario_id = user.id` (veículos) + `fk_frota_id = user.id` (motoristas) + `motorista_id IN (vinculados)` (viagens).
- `src/routes/motoristas.tsx` — adicionar editar (Dialog), upload foto (bucket `motoristas`), máscaras telefone/CNH, ações ativar/desativar (toggle `profiles.ativo`).
- `src/routes/interesses-frota.tsx` — **NOVA**. Lista rotas com interesse aprovado pelo admin onde o motorista pertence à frota. Permite frota escolher motorista vinculado + veículo da frota, gravar `motorista_designado_id`, `veiculo_designado_id`, `status_aprovacao_frota`, `aprovado_frota_em`. Ações: aprovar / cancelar / recusar (com AlertDialog).
- `src/components/AppShell.tsx` — adicionar item "Solicitações" → `/interesses-frota` (só perfil frota). Manter "Interesses" só para admin.
- `src/routes/rotas-disponiveis.tsx` — para `motorista_vinculado`, exibir aba/seção "Próximas" com rotas onde existe `interesses_rotas` com `motorista_designado_id = user.id` e `status_aprovacao_frota = 'aprovado'`. (Pequeno ajuste, sem mudar o fluxo do autônomo.)
- `src/routeTree.gen.ts` — auto-regen.

### Arquivos NÃO alterados
`/viagens`, `/rotas`, `/interesses` (admin), dashboards admin/autônomo/vinculado, `/veiculos`, fluxo do motorista autônomo.

## Impactos e riscos

1. **Página `/interesses` (admin)**: continua igual. Frota perde acesso a ela (removo do menu) — mas a policy RLS atual (`route creator reads`) já impede que a frota veja algo de outras frotas. Sem impacto operacional.
2. **`rotas-disponiveis` para motorista vinculado**: hoje vê rotas livres e cria interesse direto. No novo fluxo, isso não faz sentido (quem demonstra interesse é a frota). **Decisão necessária**: 
   - **(A)** manter aba "Disponíveis" + nova aba "Próximas" (motorista vinculado ainda pode pedir interesse → admin ainda aprova individualmente). Mantém compatibilidade total.
   - **(B)** para motorista vinculado, mostrar apenas "Próximas" (rotas já atribuídas pela frota). Mais alinhado ao fluxo descrito, mas é uma mudança de comportamento.
3. **Quem cria o interesse no novo fluxo?** Como a página `/interesses-frota` "não cria interesses novos", presumo que a **frota** demonstre interesse em outra tela (ou seja a própria distribuição que cria a linha). Precisa decisão: adiciono botão "Demonstrar interesse" para a frota em `/rotas` (lista de rotas do admin)? Ou o `interesses-frota` lista direto todas as rotas aprovadas para qualquer frota e a frota seleciona?
4. **Bucket `motoristas` público**: foto acessível por URL — padrão consistente com bucket `veiculos`.
5. **TypeScript**: `types.ts` será regenerado após a migration; nenhum código existente quebra (campos novos são opcionais).

## Decisões pendentes

Antes de implementar preciso confirmar:

1. **Fluxo de "interesse da frota"**: como a frota entra na fila de uma rota criada pelo admin? Opções:
   - (a) Frota navega em `/rotas` e clica "Demonstrar interesse" → cria linha em `interesses_rotas` com `motorista_id = user.id (frota)` e `veiculo_id` placeholder, aguarda admin aprovar.
   - (b) `/interesses-frota` lista TODAS as rotas disponíveis do admin e a frota aprova diretamente sem etapa do admin (contraria o texto "ADMIN aprova a FROTA").
   - (c) Admin já cria a rota direcionada a uma frota específica (novo campo `frota_id` em rotas).

2. **Motorista vinculado em `/rotas-disponiveis`**: manter aba "Disponíveis" ou mostrar só "Próximas"? (opções A/B acima)

Confirme essas duas decisões e implemento na sequência.
