"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, MapPin, Loader2, X } from "lucide-react";

interface MapPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

// Colombia center as default
const DEFAULT_CENTER: [number, number] = [4.5709, -74.2973];
const DEFAULT_ZOOM = 6;

export function MapPicker({ lat, lng, onChange }: MapPickerProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastCoord = useRef({ lat: 0, lng: 0 });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dynamic import of Leaflet (client-only)
  useEffect(() => {
    if (!containerRef.current) return;

    async function initMap() {
      const L = (await import("leaflet")).default;
      // @ts-ignore - leaflet CSS is loaded at runtime by Next.js
      await import("leaflet/dist/leaflet.css");

      const container = containerRef.current!;

      // Guard against React StrictMode double-invocation:
      // Leaflet marks the container with _leaflet_id once initialized.
      // We must clear it and remove any existing instance before re-creating.
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      // Also clear the Leaflet internal marker on the DOM node
      if ((container as any)._leaflet_id) {
        (container as any)._leaflet_id = null;
      }

      // Fix default marker icon path issue with bundlers
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initialCenter: [number, number] =
        lat && lng ? [lat, lng] : DEFAULT_CENTER;
      const initialZoom = lat && lng ? 14 : DEFAULT_ZOOM;

      const map = L.map(container, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
        scrollWheelZoom: false, // prevent page-scroll from zooming the map
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // If we have initial coords, place marker
      if (lat && lng) {
        lastCoord.current = { lat, lng };
        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          const newLat = parseFloat(pos.lat.toFixed(6));
          const newLng = parseFloat(pos.lng.toFixed(6));
          lastCoord.current = { lat: newLat, lng: newLng };
          onChange(newLat, newLng);
        });
        markerRef.current = marker;
      }

      // Click to place/move marker — no zoom/pan on click
      map.on("click", (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        const roundedLat = parseFloat(clickLat.toFixed(6));
        const roundedLng = parseFloat(clickLng.toFixed(6));

        lastCoord.current = { lat: roundedLat, lng: roundedLng };

        if (markerRef.current) {
          markerRef.current.setLatLng([roundedLat, roundedLng]);
        } else {
          const marker = L.marker([roundedLat, roundedLng], {
            draggable: true,
          }).addTo(map);
          marker.on("dragend", () => {
            const pos = marker.getLatLng();
            const newLat = parseFloat(pos.lat.toFixed(6));
            const newLng = parseFloat(pos.lng.toFixed(6));
            lastCoord.current = { lat: newLat, lng: newLng };
            onChange(newLat, newLng);
          });
          markerRef.current = marker;
        }

        // Update coords without changing zoom or panning
        onChange(roundedLat, roundedLng);
      });

      mapRef.current = map;
      setIsLoaded(true);
    }

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker in sync when lat/lng change externally (e.g. from number inputs or API load)
  useEffect(() => {
    // If map isn't ready or we don't have coords, wait
    if (!isLoaded || !mapRef.current || !lat || !lng) return;

    // Notice we skip this whole block if the prop update matches our last internal action
    // (meaning you clicked or dragged the marker => no zoom required)
    if (lat === lastCoord.current.lat && lng === lastCoord.current.lng) {
      return;
    }

    lastCoord.current = { lat, lng };

    import("leaflet").then(({ default: L }) => {
      const pos: [number, number] = [lat, lng];
      if (markerRef.current) {
        markerRef.current.setLatLng(pos);
      } else {
        const marker = L.marker(pos, { draggable: true }).addTo(mapRef.current);
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          const newLat = parseFloat(p.lat.toFixed(6));
          const newLng = parseFloat(p.lng.toFixed(6));
          lastCoord.current = { lat: newLat, lng: newLng };
          onChange(newLat, newLng);
        });
        markerRef.current = marker;
      }
      mapRef.current.setView(pos, Math.max(mapRef.current.getZoom(), 13));
    });
  }, [lat, lng, onChange, isLoaded]); // isLoaded makes sure async props are caught when map finishes loading

  // Nominatim autocomplete search — pans map to the best result as you type
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim() || q.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=8&countrycodes=co`,
          { headers: { "Accept-Language": "es" } },
        );
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  const handleSelectResult = (result: NominatimResult) => {
    const newLat = parseFloat(parseFloat(result.lat).toFixed(6));
    const newLng = parseFloat(parseFloat(result.lon).toFixed(6));
    setSearchQuery(result.display_name);
    setShowResults(false);

    // Auto-pan to the selected result and adjust zoom
    if (mapRef.current) {
      mapRef.current.flyTo([newLat, newLng], 15, {
        animate: true,
        duration: 1.5,
      });
    }

    // Explicitly update marker and coords
    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
    } else if (mapRef.current) {
      import("leaflet").then(({ default: L }) => {
        const marker = L.marker([newLat, newLng], { draggable: true }).addTo(
          mapRef.current,
        );
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          const draggedLat = parseFloat(p.lat.toFixed(6));
          const draggedLng = parseFloat(p.lng.toFixed(6));
          lastCoord.current = { lat: draggedLat, lng: draggedLng };
          onChange(draggedLat, draggedLng);
        });
        markerRef.current = marker;
      });
    }

    lastCoord.current = { lat: newLat, lng: newLng };
    onChange(newLat, newLng);
  };

  return (
    <div className="space-y-3 relative z-30">
      {/* Search */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                showResults &&
                searchResults.length > 0
              ) {
                e.preventDefault();
                handleSelectResult(searchResults[0]);
              }
            }}
            placeholder="Buscar ciudad, barrio, lugar..."
            className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-10 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/40 transition-all duration-200 shadow-sm"
          />
          {isSearching && (
            <Loader2 className="absolute right-4 w-4 h-4 animate-spin text-indigo-500" />
          )}
          {searchQuery && !isSearching && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowResults(false);
              }}
              className="absolute right-4 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Autocomplete dropdown — z-index below sticky save button (z-20) */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full mt-2 left-0 right-0 z-99999 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
            {searchResults.map((result, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-b-0"
              >
                <MapPin className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                <span className="text-sm text-gray-700 leading-snug line-clamp-2">
                  {result.display_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map container */}
      <div className="relative rounded-3xl overflow-hidden border border-gray-200 shadow-inner">
        {!isLoaded && (
          <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10 rounded-3xl">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Cargando mapa...
              </span>
            </div>
          </div>
        )}
        <div ref={containerRef} style={{ height: "380px", width: "100%" }} />

        {/* Helper hint — z-index below sticky save button */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-15 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-gray-100 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-bold text-gray-600">
              Haz clic en el mapa para marcar la ubicación
            </span>
          </div>
        </div>
      </div>

      {/* Coordinate display */}
      {lat !== 0 && lng !== 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 rounded-2xl border border-indigo-100">
          <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="text-xs font-black text-indigo-700 tracking-tight">
            Lat: <span className="font-mono">{lat}</span>
            {"  ·  "}
            Lng: <span className="font-mono">{lng}</span>
          </span>
        </div>
      )}
    </div>
  );
}
