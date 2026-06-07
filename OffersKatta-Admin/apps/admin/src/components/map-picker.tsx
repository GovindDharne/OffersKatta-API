'use client';

import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Loader2, MapPin, Navigation, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon URLs are computed from the bundler's runtime, which breaks under
// Next.js + webpack. Point them at the CDN copy instead — same exact assets.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface Coords {
  latitude: number;
  longitude: number;
}

interface MapPickerProps {
  value: Coords | null;
  onChange: (coords: Coords) => void;
  /** Fallback center when no value has been picked yet (defaults to Mumbai). */
  defaultCenter?: [number, number];
  defaultZoom?: number;
  /** Tailwind class for the map container height. */
  heightClassName?: string;
}

const MUMBAI: [number, number] = [19.0760, 72.8777];

export default function MapPicker({
  value,
  onChange,
  defaultCenter = MUMBAI,
  defaultZoom = 12,
  heightClassName = 'h-72',
}: MapPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  // Trigger a search after the user presses Enter or clicks the icon.
  async function geocode() {
    const q = searchTerm.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { 'Accept': 'application/json' } },
      );
      const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (data.length === 0) {
        toast.error('No location found for that search.');
        return;
      }
      const { lat, lon, display_name } = data[0];
      onChange({ latitude: parseFloat(lat), longitude: parseFloat(lon) });
      toast.success(`Pinned: ${display_name.slice(0, 60)}${display_name.length > 60 ? '…' : ''}`);
    } catch (err) {
      toast.error(`Search failed: ${(err as Error).message}`);
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not available on this device.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
        toast.success('Pinned to your current location.');
      },
      (err) => {
        setLocating(false);
        toast.error(`Could not get location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const center: [number, number] = value ? [value.latitude, value.longitude] : defaultCenter;

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                geocode();
              }
            }}
            placeholder="Search an address, area, or landmark"
            className="pl-9"
          />
        </div>
        <Button type="button" variant="secondary" onClick={geocode} disabled={searching}>
          {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Search
        </Button>
        <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
          {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
          My location
        </Button>
      </div>

      <div className={`overflow-hidden rounded-md border ${heightClassName}`}>
        <MapContainer
          center={center}
          zoom={value ? 16 : defaultZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {value ? (
            <Marker
              position={[value.latitude, value.longitude]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  onChange({ latitude: ll.lat, longitude: ll.lng });
                },
              }}
            />
          ) : null}
          <RecenterOnValue value={value} />
          <ClickToPick onPick={(c) => onChange(c)} />
        </MapContainer>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {value
          ? `Pinned at ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)} — drag the pin or click anywhere to adjust.`
          : 'Click anywhere on the map to drop a pin, or use "My location" / search above.'}
      </p>
    </div>
  );
}

function ClickToPick({ onPick }: { onPick: (c: Coords) => void }) {
  useMapEvents({
    click(e) {
      onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

function RecenterOnValue({ value }: { value: Coords | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.flyTo([value.latitude, value.longitude], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [value, map]);
  return null;
}
