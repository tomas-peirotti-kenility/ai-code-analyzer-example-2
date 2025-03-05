import { Injectable, Logger } from '@nestjs/common';
import * as NodeCache from 'node-cache';

@Injectable()
export class CacheService {
  private readonly cache: NodeCache;
  private readonly logger = new Logger(CacheService.name);

  constructor() {
    this.cache = new NodeCache({ stdTTL: 3600 }); // 1 hour default TTL
  }

  /**
   * Get data from cache
   * @param key
   * @returns
   */
  get<T>(key: string): T | undefined {
    try {
      return this.cache.get<T>(key);
    } catch (error) {
      this.logger.error(
        `Error getting data from cache for key ${key}: ${error.message}`,
      );
      return undefined;
    }
  }

  /**
   * Set data to cache
   * @param key
   * @param value
   * @param ttl
   */
  set<T>(key: string, value: T, ttl?: number): void {
    try {
      this.cache.set(key, value, ttl);
    } catch (error) {
      this.logger.error(
        `Error setting data to cache for key ${key}: ${error.message}`,
      );
    }
  }

  /**
   * Generate cache key
   * @param repoUrl
   * @param codePath
   * @param type
   * @returns
   */
  generateKey(
    repoUrl: string,
    codePath: string,
    type: 'sequence-diagram' | 'class-diagram' | 'questions',
  ): string {
    return `${repoUrl}-${codePath}-${type}`;
  }
}
