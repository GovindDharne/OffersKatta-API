import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './helpers/test-app';

describe('Public read endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/categories → 200 with seeded categories', async () => {
    const res = await request(app.getHttpServer()).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('slug');
  });

  it('GET /api/brands → 200 paginated', async () => {
    const res = await request(app.getHttpServer()).get('/api/brands?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta).toHaveProperty('totalPages');
  });

  it('GET /api/offers → 200 with seeded offers', async () => {
    const res = await request(app.getHttpServer()).get('/api/offers?limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/offers/nearby (Mumbai, 50km) returns at least one offer', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/offers/nearby?latitude=19.0760&longitude=72.8777&radiusKm=50',
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Every result should be within 50km and carry a distanceKm field
    for (const offer of res.body.data) {
      expect(offer.distanceKm).toBeLessThanOrEqual(50);
    }
  });

  it('GET /api/offers/nearby rejects radiusKm > 100', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/offers/nearby?latitude=19.0760&longitude=72.8777&radiusKm=200',
    );
    expect(res.status).toBe(400);
  });

  it('GET /api/subscriptions/plans → 200 with three plans', async () => {
    const res = await request(app.getHttpServer()).get('/api/subscriptions/plans');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { plan: string }) => p.plan).sort())
      .toEqual(['FEATURED', 'FREE', 'PREMIUM']);
  });
});
