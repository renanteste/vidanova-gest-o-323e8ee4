
-- 1. Create enum for trip status
DO $$ BEGIN
  CREATE TYPE public.viagem_status AS ENUM (
    'pendente',
    'indo_origem',
    'no_carregamento',
    'carregando',
    'carregado',
    'indo_destino',
    'descarregando',
    'finalizada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add new columns
ALTER TABLE public.viagens
  ADD COLUMN IF NOT EXISTS status public.viagem_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS chegou_origem_em timestamptz,
  ADD COLUMN IF NOT EXISTS carregamento_iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS carregado_em timestamptz,
  ADD COLUMN IF NOT EXISTS indo_destino_em timestamptz,
  ADD COLUMN IF NOT EXISTS descarregando_em timestamptz,
  ADD COLUMN IF NOT EXISTS foto_carregamento_url text,
  ADD COLUMN IF NOT EXISTS lat_carregamento numeric,
  ADD COLUMN IF NOT EXISTS lng_carregamento numeric;

-- 3. Make legacy required columns optional for the new staged flow
ALTER TABLE public.viagens
  ALTER COLUMN foto_inicio_url DROP NOT NULL,
  ALTER COLUMN lat_inicio DROP NOT NULL,
  ALTER COLUMN lng_inicio DROP NOT NULL;

-- 4. Backfill: trips already finished -> 'finalizada', trips in progress -> 'indo_destino'
UPDATE public.viagens SET status = 'finalizada' WHERE fim_em IS NOT NULL AND status = 'pendente';
UPDATE public.viagens SET status = 'indo_destino' WHERE fim_em IS NULL AND inicio_em IS NOT NULL AND status = 'pendente';
