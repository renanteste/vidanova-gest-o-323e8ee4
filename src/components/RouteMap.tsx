import { useEffect, useRef, useState } from "react";
import { geocode, routeGeometry, type LatLng } from "@/lib/geo";
import { Loader2, Map as MapIcon } from "lucide-react";

interface Props {
  origemEndereco: string;
  destinoEndereco: string;
  /** Coordenadas já conhecidas (autocomplete / banco). Reutilizadas quando disponíveis. */
  origemCoords?: LatLng | null;
  destinoCoords?: LatLng | null;
  className?: string;
}

/**
 * Mapa apenas de visualização (Leaflet + OpenStreetMap + OSRM).
 * Recurso complementar: nunca bloqueia o formulário nem altera dados da obra.
 */
export function RouteMap({ origemEndereco, destinoEndereco, origemCoords, destinoCoords, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const oKey = origemCoords ? `${origemCoords.lat},${origemCoords.lon}` : origemEndereco.trim();
  const dKey = destinoCoords ? `${destinoCoords.lat},${destinoCoords.lon}` : destinoEndereco.trim();

  useEffect(() => {
    if (!oKey || !dKey || oKey.length < 3 || dKey.length < 3) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");

    const timer = setTimeout(async () => {
      try {
        const [L, o, d] = await Promise.all([
          import("leaflet").then(async (m) => {
            await import("leaflet/dist/leaflet.css");
            return (m as any).default ?? m;
          }),
          origemCoords ? Promise.resolve(origemCoords) : geocode(origemEndereco),
          destinoCoords ? Promise.resolve(destinoCoords) : geocode(destinoEndereco),
        ]);
        if (cancelled) return;
        if (!o || !d || !containerRef.current) { setStatus("error"); return; }

        if (!mapRef.current) {
          mapRef.current = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap",
            maxZoom: 19,
          }).addTo(mapRef.current);
        }
        const map = mapRef.current;
        if (layerRef.current) map.removeLayer(layerRef.current);
        const group = L.layerGroup().addTo(map);
        layerRef.current = group;

        const pin = (color: string, label: string) =>
          L.divIcon({
            className: "",
            html: `<div style="background:${color};color:#fff;font-size:10px;font-weight:700;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${label}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });

        L.marker([o.lat, o.lon], { icon: pin("#1e3a8a", "A") }).addTo(group).bindPopup("Origem");
        L.marker([d.lat, d.lon], { icon: pin("#ea580c", "B") }).addTo(group).bindPopup("Destino");

        const geo = await routeGeometry(o, d);
        if (cancelled) return;
        const line = geo && geo.length > 1 ? geo : [[o.lat, o.lon], [d.lat, d.lon]] as [number, number][];
        const poly = L.polyline(line, { color: "#ea580c", weight: 4, opacity: 0.85, dashArray: geo ? undefined : "6 6" }).addTo(group);
        map.fitBounds(poly.getBounds().pad(0.2));
        setTimeout(() => map.invalidateSize(), 100);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }, 700); // debounce

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oKey, dKey]);

  useEffect(() => {
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  return (
    <div className={className}>
      <div className="relative h-56 w-full overflow-hidden rounded-md border bg-muted/40">
        <div ref={containerRef} className="absolute inset-0 z-0" style={{ display: status === "ready" || status === "loading" ? "block" : "none" }} />
        {status !== "ready" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/60 text-center px-4">
            {status === "loading" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Carregando trajeto…</span>
              </>
            ) : status === "error" ? (
              <span className="text-xs text-muted-foreground">Não foi possível localizar um dos endereços informados.</span>
            ) : (
              <>
                <MapIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Informe a origem e o destino para visualizar o trajeto.</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
