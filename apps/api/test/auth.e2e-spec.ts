import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp, uniqueEmail } from './helpers/test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health → 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('POST /api/auth/register → 201 with tokens', async () => {
    const email = uniqueEmail('register');
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Secret123!', fullName: 'E2E Tester', role: 'CUSTOMER' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.role).toBe('CUSTOMER');
  });

  it('POST /api/auth/login with seeded admin → 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@offerhub.local', password: 'Admin@12345' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('SUPER_ADMIN');
  });

  it('POST /api/auth/login with wrong password → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@offerhub.local', password: 'WRONG' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/users/me without token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/users/me with token → 200', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@offerhub.local', password: 'Admin@12345' });
    const token = login.body.data.accessToken;

    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@offerhub.local');
  });

  it('POST /api/auth/refresh rotates the token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@offerhub.local', password: 'Admin@12345' });
    const refresh = login.body.data.refreshToken;

    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refresh });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // Rotation: the new refresh token should differ from the old one
    expect(res.body.data.refreshToken).not.toBe(refresh);
  });
});
