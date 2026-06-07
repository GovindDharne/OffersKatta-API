import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp, uniqueEmail } from './helpers/test-app';

describe('Customer redemption flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('end-to-end: register → fetch a published offer → issue a redemption QR', async () => {
    // 1. Register a fresh customer
    const email = uniqueEmail('redeem');
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Secret123!', fullName: 'Redeem Tester', role: 'CUSTOMER' });
    expect(reg.status).toBe(201);
    const token = reg.body.data.accessToken;

    // 2. Pick the first PUBLISHED offer that exists
    const list = await request(app.getHttpServer()).get('/api/offers?status=PUBLISHED&limit=1');
    expect(list.body.data.length).toBeGreaterThan(0);
    const offerId = list.body.data[0].id;

    // 3. Issue a redemption (returns QR + base64 data URL)
    const issued = await request(app.getHttpServer())
      .post(`/api/redemptions/offer/${offerId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(issued.status).toBe(201);
    expect(issued.body.success).toBe(true);
    expect(issued.body.data.redemption.qrCode).toMatch(/^[A-Z0-9]+$/);
    expect(issued.body.data.qrDataUrl).toMatch(/^data:image/);
    expect(issued.body.data.redemption.status).toBe('PENDING');

    // 4. The customer should see it in /redemptions/me
    const mine = await request(app.getHttpServer())
      .get('/api/redemptions/me')
      .set('Authorization', `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.find((r: { id: string }) => r.id === issued.body.data.redemption.id))
      .toBeDefined();

    // 5. The same customer can cancel a pending redemption
    const cancelled = await request(app.getHttpServer())
      .post(`/api/redemptions/${issued.body.data.redemption.qrCode}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
  });

  it('issue requires authentication', async () => {
    const list = await request(app.getHttpServer()).get('/api/offers?status=PUBLISHED&limit=1');
    const offerId = list.body.data[0].id;
    const res = await request(app.getHttpServer()).post(`/api/redemptions/offer/${offerId}`);
    expect(res.status).toBe(401);
  });
});
