import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      return ((await this.cache.get<T>(key)) ?? null) as T | null;
    } catch (err) {
      this.logger.warn(`cache.get(${key}) failed: ${(err as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttlSeconds ? ttlSeconds * 1000 : undefined);
    } catch (err) {
      this.logger.warn(`cache.set(${key}) failed: ${(err as Error).message}`);
    }
  }

  async del(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    await Promise.all(keys.map((k) => this.cache.del(k).catch(() => undefined)));
  }

  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Atomically increment a counter, returning the new value. If the key
   * didn't exist, sets the TTL on the first increment. Used for the push
   * frequency cap (max N per customer per day). Falls back to a non-atomic
   * read+set when the underlying store doesn't expose `incr` — slight race
   * is acceptable for marketing pushes.
   */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    try {
      const store = (this.cache as unknown as { store?: { client?: { incr?: (k: string) => Promise<number>; expire?: (k: string, s: number) => Promise<number> } } }).store;
      const client = store?.client;
      if (client?.incr && client?.expire) {
        const v = await client.incr(key);
        if (v === 1) await client.expire(key, ttlSeconds);
        return v;
      }
    } catch (err) {
      this.logger.warn(`incrWithTtl(${key}) raw-path failed: ${(err as Error).message}`);
    }
    // Fallback: not atomic, slightly under-counts on concurrent calls.
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    await this.set(key, next, ttlSeconds);
    return next;
  }

  /** Best-effort pattern invalidation; works against ioredis-backed store. */
  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      const store = (this.cache as unknown as { store?: { client?: { keys: (p: string) => Promise<string[]>; del: (...k: string[]) => Promise<number> } } }).store;
      const client = store?.client;
      if (!client?.keys) return;
      const keys = await client.keys(`${prefix}*`);
      if (keys.length) await client.del(...keys);
    } catch (err) {
      this.logger.warn(`invalidatePrefix(${prefix}) failed: ${(err as Error).message}`);
    }
  }
}
