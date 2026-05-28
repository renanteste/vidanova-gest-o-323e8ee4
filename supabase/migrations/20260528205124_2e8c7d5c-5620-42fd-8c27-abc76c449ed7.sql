
-- Helper functions (SECURITY DEFINER bypassa RLS e evita recursão)

CREATE OR REPLACE FUNCTION public.is_route_creator(_rota_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rotas
    WHERE id = _rota_id AND criada_por = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_motorista_of_frota(_motorista_id uuid, _frota_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _motorista_id AND fk_frota_id = _frota_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_route_assignment(_rota_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.interesses_rotas
    WHERE rota_id = _rota_id
      AND motorista_designado_id = _user_id
      AND status_aprovacao_frota = 'aprovado'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_vehicle_assignment(_veiculo_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.interesses_rotas
    WHERE veiculo_designado_id = _veiculo_id
      AND motorista_designado_id = _user_id
      AND status_aprovacao_frota = 'aprovado'
  )
$$;

-- =========================================================
-- ROTAS: substituir policy recursiva
-- =========================================================
DROP POLICY IF EXISTS "linked driver reads assigned route" ON public.rotas;

CREATE POLICY "linked driver reads assigned route"
ON public.rotas
FOR SELECT
TO authenticated
USING (public.has_route_assignment(id, auth.uid()));

-- =========================================================
-- INTERESSES_ROTAS: substituir policies recursivas
-- =========================================================
DROP POLICY IF EXISTS "route creator reads interests" ON public.interesses_rotas;
DROP POLICY IF EXISTS "route creator updates interests" ON public.interesses_rotas;
DROP POLICY IF EXISTS "fleet reads own drivers interests" ON public.interesses_rotas;
DROP POLICY IF EXISTS "fleet updates own drivers interests" ON public.interesses_rotas;

CREATE POLICY "route creator reads interests"
ON public.interesses_rotas
FOR SELECT
TO authenticated
USING (public.is_route_creator(rota_id, auth.uid()));

CREATE POLICY "route creator updates interests"
ON public.interesses_rotas
FOR UPDATE
TO authenticated
USING (public.is_route_creator(rota_id, auth.uid()))
WITH CHECK (public.is_route_creator(rota_id, auth.uid()));

CREATE POLICY "fleet reads own drivers interests"
ON public.interesses_rotas
FOR SELECT
TO authenticated
USING (
  motorista_id = auth.uid()
  OR public.is_motorista_of_frota(motorista_id, auth.uid())
);

CREATE POLICY "fleet updates own drivers interests"
ON public.interesses_rotas
FOR UPDATE
TO authenticated
USING (
  motorista_id = auth.uid()
  OR public.is_motorista_of_frota(motorista_id, auth.uid())
)
WITH CHECK (
  motorista_id = auth.uid()
  OR public.is_motorista_of_frota(motorista_id, auth.uid())
);

-- =========================================================
-- VEICULOS: substituir policy recursiva
-- =========================================================
DROP POLICY IF EXISTS "linked driver reads assigned vehicle" ON public.veiculos;

CREATE POLICY "linked driver reads assigned vehicle"
ON public.veiculos
FOR SELECT
TO authenticated
USING (public.has_vehicle_assignment(id, auth.uid()));
