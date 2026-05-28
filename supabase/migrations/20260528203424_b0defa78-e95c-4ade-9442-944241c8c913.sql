
-- 1) interesses_rotas: campos de distribuição da frota
ALTER TABLE public.interesses_rotas
  ADD COLUMN IF NOT EXISTS status_aprovacao_frota TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS motorista_designado_id UUID,
  ADD COLUMN IF NOT EXISTS veiculo_designado_id UUID,
  ADD COLUMN IF NOT EXISTS aprovado_frota_em TIMESTAMPTZ;

-- 2) bucket motoristas (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('motoristas', 'motoristas', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "motoristas public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'motoristas');

CREATE POLICY "frota uploads driver photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'motoristas' AND auth.uid() IS NOT NULL);

CREATE POLICY "frota updates driver photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'motoristas' AND auth.uid() IS NOT NULL);

CREATE POLICY "frota deletes driver photo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'motoristas' AND auth.uid() IS NOT NULL);

-- 3) profiles: frota pode atualizar motoristas vinculados
CREATE POLICY "fleet updates linked drivers"
ON public.profiles FOR UPDATE
TO authenticated
USING (fk_frota_id = auth.uid())
WITH CHECK (fk_frota_id = auth.uid());

-- 4) interesses_rotas: frota lê e atualiza interesses dos seus motoristas
CREATE POLICY "fleet reads own drivers interests"
ON public.interesses_rotas FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = interesses_rotas.motorista_id
      AND p.fk_frota_id = auth.uid()
  )
  OR motorista_id = auth.uid()
);

CREATE POLICY "fleet updates own drivers interests"
ON public.interesses_rotas FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = interesses_rotas.motorista_id
      AND p.fk_frota_id = auth.uid()
  )
  OR motorista_id = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = interesses_rotas.motorista_id
      AND p.fk_frota_id = auth.uid()
  )
  OR motorista_id = auth.uid()
);

-- 5) interesses_rotas: frota cria interesse como solicitante (motorista_id = frota.user_id)
CREATE POLICY "fleet creates own interest"
ON public.interesses_rotas FOR INSERT
TO authenticated
WITH CHECK (
  motorista_id = auth.uid()
  AND public.has_role(auth.uid(), 'frota')
);

-- 6) rotas: motorista vinculado vê rota quando foi designado pela frota
CREATE POLICY "linked driver reads assigned route"
ON public.rotas FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.interesses_rotas ir
    WHERE ir.rota_id = rotas.id
      AND ir.motorista_designado_id = auth.uid()
      AND ir.status_aprovacao_frota = 'aprovado'
  )
);

-- 7) veiculos: motorista vinculado vê o veículo designado a ele
CREATE POLICY "linked driver reads assigned vehicle"
ON public.veiculos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.interesses_rotas ir
    WHERE ir.veiculo_designado_id = veiculos.id
      AND ir.motorista_designado_id = auth.uid()
      AND ir.status_aprovacao_frota = 'aprovado'
  )
);
