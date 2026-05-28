import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { searchAddresses, type AddressSuggestion } from "@/lib/geo";
import { Loader2, MapPin } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string, coords?: { lat: number; lon: number }) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}

export function AddressAutocomplete({ value, onChange, placeholder, required, rows = 2 }: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipNextRef = useRef(false);

  useEffect(() => {
    if (skipNextRef.current) { skipNextRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.trim().length < 3) { setSuggestions([]); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchAddresses(value);
      setSuggestions(res);
      setOpen(res.length > 0);
      setLoading(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = (s: AddressSuggestion) => {
    skipNextRef.current = true;
    onChange(s.display_name, { lat: s.lat, lon: s.lon });
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
      />
      {loading && (
        <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex gap-2 items-start"
            >
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
              <span className="line-clamp-2">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
