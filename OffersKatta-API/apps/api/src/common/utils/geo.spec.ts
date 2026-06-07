import { boundingBox, haversineKm } from './geo';

describe('geo utils', () => {
  it('haversineKm: Mumbai → Pune is ~120km', () => {
    const d = haversineKm(19.0760, 72.8777, 18.5204, 73.8567);
    expect(d).toBeGreaterThan(115);
    expect(d).toBeLessThan(125);
  });

  it('haversineKm: identical points → 0', () => {
    expect(haversineKm(19, 72, 19, 72)).toBeCloseTo(0, 5);
  });

  it('boundingBox: 10km radius around equator spans ~0.09 deg lat', () => {
    const bb = boundingBox(0, 0, 10);
    expect(bb.maxLat - bb.minLat).toBeCloseTo(10 / 111 * 2, 3);
  });
});
