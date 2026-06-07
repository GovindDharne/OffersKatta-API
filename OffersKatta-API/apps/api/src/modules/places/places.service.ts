import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/// PlacesService — thin proxy over the Google Maps Platform (Places API).
///
/// Why proxy instead of hitting Google from the browser?
///   - Keeps the API key off the client (referrer restrictions are not
///     enough for our case — we want one key per environment, not per origin).
///   - Lets us swap providers later (Mapbox, HERE) without touching the UI.
///   - Single place to log / rate-limit / cache.
///
/// Auth: these endpoints are mounted under the global JwtAuthGuard so only
/// signed-in users can spend our quota. Inside, we also reject empty keys
/// with a 503 "places_disabled" so the admin UI can render a friendly hint.
@Injectable()
export class PlacesService {
  private readonly log = new Logger(PlacesService.name);
  private readonly key?: string;
  private readonly region: string;

  constructor(config: ConfigService) {
    this.key = config.get<string>('GOOGLE_PLACES_API_KEY') || undefined;
    this.region = (config.get<string>('GOOGLE_PLACES_REGION') ?? 'in').toLowerCase();
  }

  isEnabled(): boolean {
    return Boolean(this.key && this.key.length > 0);
  }

  config(): { enabled: boolean; region: string } {
    return { enabled: this.isEnabled(), region: this.region };
  }

  /// Autocomplete predictions for a free-text query. Returns a small payload
  /// (`placeId` + display strings) — full structured data only comes back from
  /// `details()` once the user picks a suggestion.
  async autocomplete(
    q: string,
    sessionToken?: string,
  ): Promise<{
    enabled: boolean;
    predictions: Array<{ placeId: string; primaryText: string; secondaryText: string }>;
  }> {
    if (!this.isEnabled()) return { enabled: false, predictions: [] };

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', q);
    url.searchParams.set('components', `country:${this.region}`);
    url.searchParams.set('key', this.key!);
    if (sessionToken) url.searchParams.set('sessiontoken', sessionToken);

    const data = await this.fetchGoogle<{
      status: string;
      error_message?: string;
      predictions: Array<{
        place_id: string;
        structured_formatting?: { main_text?: string; secondary_text?: string };
        description?: string;
      }>;
    }>(url);

    // Google returns ZERO_RESULTS as a success status with empty predictions —
    // don't treat that as an error.
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      this.log.warn(`Places autocomplete failed: ${data.status} ${data.error_message ?? ''}`);
      throw new BadGatewayException(`Places API: ${data.status}`);
    }

    return {
      enabled: true,
      predictions: (data.predictions ?? []).map((p) => ({
        placeId: p.place_id,
        primaryText: p.structured_formatting?.main_text ?? p.description ?? '',
        secondaryText: p.structured_formatting?.secondary_text ?? '',
      })),
    };
  }

  /// Full structured details for one place_id — what we autofill the branch
  /// form with. Returns address components plus coordinates already parsed
  /// into the shape the BranchesController expects (city/state/country/PIN).
  async details(
    placeId: string,
    sessionToken?: string,
  ): Promise<{
    enabled: boolean;
    placeId: string;
    name?: string;
    formattedAddress: string;
    addressLine1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  }> {
    if (!this.isEnabled()) throw new ServiceUnavailableException('Places API is not configured');

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    // Restrict the response to only the fields we actually use — Google bills
    // by field set so this keeps each lookup in the cheap "Basic Data" tier.
    url.searchParams.set(
      'fields',
      ['name', 'formatted_address', 'address_components', 'geometry/location'].join(','),
    );
    url.searchParams.set('key', this.key!);
    if (sessionToken) url.searchParams.set('sessiontoken', sessionToken);

    interface AddrComp {
      long_name: string;
      short_name: string;
      types: string[];
    }
    const data = await this.fetchGoogle<{
      status: string;
      error_message?: string;
      result?: {
        name?: string;
        formatted_address?: string;
        address_components?: AddrComp[];
        geometry?: { location?: { lat: number; lng: number } };
      };
    }>(url);

    if (data.status !== 'OK' || !data.result) {
      this.log.warn(`Places details failed: ${data.status} ${data.error_message ?? ''}`);
      throw new BadGatewayException(`Places API: ${data.status}`);
    }

    const r = data.result;
    const comps = r.address_components ?? [];
    // Helper to pluck a component by Google "type". `kinds` is an OR list —
    // first match wins. Example: city can be "locality" OR "postal_town".
    const pick = (kinds: string[], prefer: 'long' | 'short' = 'long'): string => {
      for (const k of kinds) {
        const c = comps.find((x) => x.types.includes(k));
        if (c) return prefer === 'short' ? c.short_name : c.long_name;
      }
      return '';
    };

    // Build a sensible "address line 1": street number + route, fall back to
    // the premise/neighbourhood. Pure formatted_address is too verbose
    // (includes city/state/pin which already populate their own fields).
    const streetNumber = pick(['street_number']);
    const route = pick(['route']);
    const premise = pick(['premise', 'subpremise', 'neighborhood', 'sublocality_level_1', 'sublocality']);
    const addressLine1Parts = [streetNumber, route].filter(Boolean);
    const addressLine1 = addressLine1Parts.length > 0
      ? addressLine1Parts.join(' ')
      : (premise || r.name || (r.formatted_address ?? '').split(',')[0] || '');

    return {
      enabled: true,
      placeId,
      name: r.name,
      formattedAddress: r.formatted_address ?? '',
      addressLine1,
      city: pick(['locality', 'postal_town', 'administrative_area_level_2']),
      state: pick(['administrative_area_level_1']),
      country: pick(['country']),
      postalCode: pick(['postal_code']),
      latitude: r.geometry?.location?.lat ?? 0,
      longitude: r.geometry?.location?.lng ?? 0,
    };
  }

  /// Single chokepoint for the Google HTTP call so we get consistent timeout
  /// + JSON handling. Node 20's global fetch is plenty for our needs.
  private async fetchGoogle<T>(url: URL): Promise<T> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) {
        throw new BadGatewayException(`Places upstream HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new BadGatewayException('Places upstream timed out');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
