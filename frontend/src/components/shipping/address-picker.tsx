'use client';

/**
 * AddressPicker — Google Maps interactive coordinate selection.
 *
 * Three entry paths (any can be used first, others sync to it):
 *   1. Places autocomplete: user types → picks a place → pin drops at place coords
 *   2. Drag the pin: pin moves → reverse-geocode fills address
 *   3. Type lat/lng numeric fields: pin jumps, reverse-geocode fills address
 *
 * Emits `onChange({ address, lat, lng, postalCode })` after any stable state change.
 * Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to be set.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MapPin, Search, Loader2, AlertCircle } from 'lucide-react';
import { fetchAutocomplete, newSessionToken, type PlaceSuggestion } from '@/lib/google-places';

export interface AddressPickerValue {
  address: string;
  lat: number | null;
  lng: number | null;
  postalCode?: string;
}

export interface AddressPickerProps {
  value: AddressPickerValue;
  onChange: (value: AddressPickerValue) => void;
  // Default map center when nothing is picked yet (Jakarta Monas).
  defaultCenter?: { lat: number; lng: number };
  // Country-restricted autocomplete. ISO Alpha-2.
  country?: string;
  // Optional custom Maps Map ID for styling.
  mapId?: string;
  className?: string;
}

const DEFAULT_CENTER = { lat: -6.2088, lng: 106.8456 }; // Jakarta — Monas

export function AddressPicker({
  value,
  onChange,
  defaultCenter = DEFAULT_CENTER,
  country = 'id',
  mapId,
  className,
}: AddressPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  if (!apiKey) {
    return (
      <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Map picker disabled — <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> is not set.
          Enter the address manually below.
        </span>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={['places', 'geocoding', 'marker']}>
      <AddressPickerInner
        value={value}
        onChange={onChange}
        defaultCenter={defaultCenter}
        country={country}
        mapId={mapId}
        className={className}
      />
    </APIProvider>
  );
}

function AddressPickerInner({
  value,
  onChange,
  defaultCenter,
  country,
  mapId,
  className,
}: Required<Pick<AddressPickerProps, 'defaultCenter' | 'country'>> & Omit<AddressPickerProps, 'defaultCenter' | 'country'>) {
  const geocodingLib = useMapsLibrary('geocoding');
  const geocoder = useMemo(() => (geocodingLib ? new geocodingLib.Geocoder() : null), [geocodingLib]);

  const center = value.lat != null && value.lng != null
    ? { lat: value.lat, lng: value.lng }
    : defaultCenter;

  // ─── Autocomplete state (Places API New via REST) ─────────────────
  const [query, setQuery] = useState(value.address);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const sessionTokenRef = useRef<string>(newSessionToken());
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    }
    if (searchOpen) document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [searchOpen]);

  useEffect(() => { setQuery(value.address); }, [value.address]);

  useEffect(() => {
    if (!query || query.trim().length < 3) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await fetchAutocomplete(query, {
          sessionToken: sessionTokenRef.current,
          country,
        });
        setSuggestions(results);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, country]);

  async function handlePickSuggestion(placeId: string, description: string) {
    setSuggestions([]);
    setSearchOpen(false);
    setQuery(description);
    if (!geocoder) return;
    geocoder.geocode({ placeId }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) return;
      const r = results[0];
      const loc = r.geometry.location;
      const postalFromComponents = r.address_components?.find((c) => c.types.includes('postal_code'))?.long_name;
      onChange({
        address: r.formatted_address ?? description,
        lat: loc.lat(),
        lng: loc.lng(),
        postalCode: postalFromComponents,
      });
    });
    // Rotate session token — Google bills autocomplete+details per session.
    sessionTokenRef.current = newSessionToken();
  }

  function handlePinDrag(lat: number, lng: number) {
    if (!geocoder) {
      onChange({ ...value, lat, lng });
      return;
    }
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const r = results[0];
        const postal = r.address_components?.find((c) => c.types.includes('postal_code'))?.long_name;
        onChange({
          address: r.formatted_address ?? value.address,
          lat,
          lng,
          postalCode: postal ?? value.postalCode,
        });
      } else {
        onChange({ ...value, lat, lng });
      }
    });
  }

  function handleLatLngInput(nextLat: number, nextLng: number) {
    if (Number.isNaN(nextLat) || Number.isNaN(nextLng)) return;
    if (nextLat < -90 || nextLat > 90 || nextLng < -180 || nextLng > 180) return;
    handlePinDrag(nextLat, nextLng);
  }

  return (
    <div className={className ?? 'space-y-3'}>
      {/* ─── Places Autocomplete ──────────────────────────────── */}
      <div className="relative" ref={searchRef}>
        <div className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
          {searching ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search address, district, or landmark…"
            className="w-full bg-transparent text-sm focus:outline-none"
            aria-label="Address search"
          />
        </div>
        {searchOpen && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-background shadow-lg"
          >
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onClick={() => handlePickSuggestion(s.placeId, s.fullText || s.mainText)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <div className="font-medium">{s.mainText}</div>
                  {s.secondaryText && (
                    <div className="text-xs text-muted-foreground">
                      {s.secondaryText}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── Map ──────────────────────────────────────────────── */}
      <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
        <Map
          defaultCenter={center}
          defaultZoom={value.lat != null ? 15 : 11}
          mapId={mapId ?? 'fulkruma-address-picker'}
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons={false}
          onClick={(e) => {
            if (e.detail.latLng) {
              handlePinDrag(e.detail.latLng.lat, e.detail.latLng.lng);
            }
          }}
        >
          <RecenterOnValue lat={value.lat} lng={value.lng} />
          {value.lat != null && value.lng != null && (
            <AdvancedMarker
              position={{ lat: value.lat, lng: value.lng }}
              draggable
              onDragEnd={(e) => {
                const p = e.latLng;
                if (p) handlePinDrag(p.lat(), p.lng());
              }}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <MapPin className="h-4 w-4" />
              </div>
            </AdvancedMarker>
          )}
        </Map>
      </div>

      {/* ─── Lat/Lng manual fields ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <LatLngInput
          label="Latitude"
          value={value.lat}
          onChange={(n) => handleLatLngInput(n, value.lng ?? defaultCenter.lng)}
          placeholder="-6.2088"
        />
        <LatLngInput
          label="Longitude"
          value={value.lng}
          onChange={(n) => handleLatLngInput(value.lat ?? defaultCenter.lat, n)}
          placeholder="106.8456"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: tap the map or drag the pin to fine-tune the drop-off point. Precise coordinates
        are required for instant couriers (Gojek, Grab).
      </p>
    </div>
  );
}

// ─── Side-component to recenter on value change (avoids re-mounting Map) ───
function RecenterOnValue({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || lat == null || lng == null) return;
    map.panTo({ lat, lng });
    // Only zoom in if zoomed out too far.
    if ((map.getZoom() ?? 10) < 13) map.setZoom(15);
  }, [map, lat, lng]);
  return null;
}

function LatLngInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value != null ? String(value) : '');
  useEffect(() => { setText(value != null ? String(value) : ''); }, [value]);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text);
          if (!Number.isNaN(n)) onChange(n);
        }}
        placeholder={placeholder}
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </label>
  );
}
