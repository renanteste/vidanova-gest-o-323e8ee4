ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS responsavel TEXT;
ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS construtora TEXT;
ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS lat_origem NUMERIC;
ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS lng_origem NUMERIC;
ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS lat_destino NUMERIC;
ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS lng_destino NUMERIC;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Remover capacidade de criação de rotas pelo dono de frota
DROP POLICY IF EXISTS "frota creates own routes" ON public.rotas;