import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { createPrismaMock, type PrismaMock } from '../../test/prisma-mock';

const passwordHash = bcrypt.hashSync('Secret123!', 4);

function makeService(prisma: PrismaMock): AuthService {
  const jwt = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1' }),
  } as unknown as JwtService;
  const config = {
    get: (k: string) => {
      const map: Record<string, string> = {
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '30d',
      };
      return map[k];
    },
  } as unknown as ConfigService;
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as never;
  const mail = { sendPasswordReset: jest.fn(), sendOtp: jest.fn() } as unknown as never;
  const sms = { sendOtp: jest.fn(), send: jest.fn(), isEnabled: () => false } as unknown as never;
  const firebase = { isEnabled: () => false, verifyIdToken: jest.fn() } as unknown as never;
  const perms = { invalidate: jest.fn() } as unknown as never;
  return new AuthService(prisma as never, jwt, config, cache, mail, sms, firebase, perms);
}

describe('AuthService', () => {
  let prisma: PrismaMock;
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = makeService(prisma);
  });

  describe('register', () => {
    it('creates a customer when no conflicting user exists', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({
        id: 'u1', email: 'jane@example.com', phone: null, role: 'CUSTOMER',
        passwordHash: 'h', fullName: 'Jane', isActive: true,
      });
      prisma.role.findUnique.mockResolvedValueOnce({ id: 'r1', slug: 'CUSTOMER' });
      prisma.userRoleAssignment.findFirst.mockResolvedValueOnce(null);
      prisma.refreshToken.create.mockResolvedValueOnce({} as never);

      const out = await service.register({
        email: 'jane@example.com',
        password: 'Secret123!',
        fullName: 'Jane',
      });

      expect(out.accessToken).toBe('signed-token');
      expect(out.user.email).toBe('jane@example.com');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('rejects when email is already registered', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'u-existing' });
      await expect(
        service.register({ email: 'dup@example.com', password: 'Secret123!', fullName: 'D' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('issues tokens for a valid credential', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 'u1', email: 'jane@example.com', passwordHash, role: 'CUSTOMER', isActive: true,
      });
      prisma.user.update.mockResolvedValueOnce({} as never);
      prisma.refreshToken.create.mockResolvedValueOnce({} as never);

      const out = await service.login({ email: 'jane@example.com', password: 'Secret123!' });
      expect(out.accessToken).toBe('signed-token');
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 'u1', email: 'jane@example.com', passwordHash, role: 'CUSTOMER', isActive: true,
      });
      await expect(
        service.login({ email: 'jane@example.com', password: 'WRONG' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an unknown email', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.login({ email: 'ghost@example.com', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an inactive account', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 'u1', email: 'jane@example.com', passwordHash, role: 'CUSTOMER', isActive: false,
      });
      await expect(
        service.login({ email: 'jane@example.com', password: 'Secret123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
