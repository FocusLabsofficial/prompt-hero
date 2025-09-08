import { sql } from '@vercel/postgres';
import { securityHeaders, rateLimit, requestLogger, errorHandler } from '../middleware/security.js';

// Simple in-memory cache for development
// In production, use Redis or similar
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  // Apply security middleware
  securityHeaders(req, res, () => {});
  requestLogger(req, res, () => {});
  
  if (req.method === 'GET') {
    return handleGetCache(req, res);
  } else if (req.method === 'POST') {
    return handleSetCache(req, res);
  } else if (req.method === 'DELETE') {
    return handleDeleteCache(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetCache(req, res) {
  try {
    const { key } = req.query;
    
    if (!key) {
      return res.status(400).json({ error: 'Cache key is required' });
    }

    const cached = cache.get(key);
    
    if (!cached) {
      return res.status(404).json({ error: 'Cache key not found' });
    }

    // Check if cache entry is expired
    if (Date.now() > cached.expires) {
      cache.delete(key);
      return res.status(404).json({ error: 'Cache key expired' });
    }

    res.status(200).json({
      key,
      value: cached.value,
      expires_at: new Date(cached.expires).toISOString(),
      created_at: new Date(cached.created).toISOString()
    });

  } catch (error) {
    console.error('Get cache error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function handleSetCache(req, res) {
  try {
    // Rate limiting
    await new Promise((resolve, reject) => {
      rateLimit(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const { key, value, ttl = CACHE_TTL } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    const now = Date.now();
    const expires = now + ttl;

    cache.set(key, {
      value,
      created: now,
      expires
    });

    // Clean up expired entries periodically
    if (cache.size > 1000) {
      cleanupExpiredEntries();
    }

    res.status(201).json({
      message: 'Cache entry created successfully',
      key,
      expires_at: new Date(expires).toISOString()
    });

  } catch (error) {
    console.error('Set cache error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function handleDeleteCache(req, res) {
  try {
    const { key } = req.query;
    
    if (!key) {
      return res.status(400).json({ error: 'Cache key is required' });
    }

    const deleted = cache.delete(key);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Cache key not found' });
    }

    res.status(200).json({
      message: 'Cache entry deleted successfully',
      key
    });

  } catch (error) {
    console.error('Delete cache error:', error);
    errorHandler(error, req, res, () => {});
  }
}

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expires) {
      cache.delete(key);
    }
  }
}

// Cache utility functions
export function getCached(key) {
  const cached = cache.get(key);
  if (!cached || Date.now() > cached.expires) {
    if (cached) cache.delete(key);
    return null;
  }
  return cached.value;
}

export function setCached(key, value, ttl = CACHE_TTL) {
  const now = Date.now();
  const expires = now + ttl;
  
  cache.set(key, {
    value,
    created: now,
    expires
  });
}

export function deleteCached(key) {
  return cache.delete(key);
}

export function clearCache() {
  cache.clear();
}

export function getCacheStats() {
  const now = Date.now();
  let expired = 0;
  let active = 0;
  
  for (const entry of cache.values()) {
    if (now > entry.expires) {
      expired++;
    } else {
      active++;
    }
  }
  
  return {
    total: cache.size,
    active,
    expired,
    memory_usage: JSON.stringify(cache).length
  };
}
