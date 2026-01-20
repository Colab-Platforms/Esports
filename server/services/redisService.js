const { Redis } = require('@upstash/redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      console.log('🔄 Initializing Redis connection...');
      console.log('📍 Redis URL:', process.env.UPSTASH_REDIS_REST_URL || 'not set');
      console.log('📍 Redis Token:', process.env.UPSTASH_REDIS_REST_TOKEN ? '***set***' : 'not set');
      
      // Create Upstash Redis client using REST API
      this.client = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL || 'https://modest-shrew-17133.upstash.io',
        token: process.env.UPSTASH_REDIS_REST_TOKEN || 'AULtAAIncDE4ZWE1ZGI4NDI4NDg0NDg4OGNkNzVlZjc4MTVlM2RhZHAxMTcxMzM'
      });

      // Test connection
      const pong = await this.client.ping();
      console.log('✅ Redis connected successfully');
      console.log('✅ Redis ping successful:', pong);
      console.log('🎯 Redis is ready for caching!');
      console.log('🚀 Redis caching is ACTIVE and working!');
      this.isConnected = true;
      
    } catch (error) {
      console.error('❌ Redis initialization error:', error.message);
      console.warn('⚠️ Caching will be disabled');
      console.warn('💡 Make sure your Upstash credentials are correct in .env');
      this.isConnected = false;
    }
  }

  // Get value from cache
  async get(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const data = await this.client.get(key);
      if (data) {
        console.log(`✅ Cache hit for key: ${key}`);
        // Upstash returns data as string, so parse it
        // If it's already an object, return as-is
        if (typeof data === 'string') {
          return JSON.parse(data);
        }
        return data;
      }
      return null;
    } catch (error) {
      console.error('❌ Redis get error:', error.message);
      return null;
    }
  }

  // Set value in cache with TTL
  async set(key, value, ttl = 300) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      // Upstash SDK handles serialization, but we need to stringify for consistency
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.set(key, stringValue, { ex: ttl });
      console.log(`✅ Cache set for key: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      console.error('❌ Redis set error:', error.message);
      return false;
    }
  }

  // Delete cache key
  async delete(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      console.log(`✅ Cache deleted for key: ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Redis delete error:', error.message);
      return false;
    }
  }

  // Clear all cache
  async flushAll() {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.flushAll();
      console.log('✅ All cache cleared');
      return true;
    } catch (error) {
      console.error('❌ Redis flush error:', error.message);
      return false;
    }
  }

  // Check if Redis is connected
  isReady() {
    return this.isConnected && this.client;
  }
}

module.exports = new RedisService();
