import { getCached, setCached } from '../cache/index.js';

// Cache middleware for API endpoints
export function withCache(ttl = 300000, keyGenerator = null) { // 5 minutes default
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(req, res, ...args) {
      // Generate cache key
      let cacheKey;
      if (keyGenerator) {
        cacheKey = keyGenerator(req);
      } else {
        cacheKey = generateDefaultCacheKey(req);
      }

      // Try to get from cache
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cached);
      }

      // Store original res.json to intercept response
      const originalJson = res.json;
      let responseData = null;

      res.json = function(data) {
        responseData = data;
        return originalJson.call(this, data);
      };

      // Call original method
      const result = await originalMethod.call(this, req, res, ...args);

      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300 && responseData) {
        setCached(cacheKey, responseData, ttl);
        res.setHeader('X-Cache', 'MISS');
      }

      return result;
    };

    return descriptor;
  };
}

// Cache middleware for Express-style handlers
export function cacheMiddleware(ttl = 300000, keyGenerator = null) {
  return async (req, res, next) => {
    // Generate cache key
    let cacheKey;
    if (keyGenerator) {
      cacheKey = keyGenerator(req);
    } else {
      cacheKey = generateDefaultCacheKey(req);
    }

    // Try to get from cache
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    // Store original res.json to intercept response
    const originalJson = res.json;
    let responseData = null;

    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };

    // Call next middleware
    await next();

    // Cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300 && responseData) {
      setCached(cacheKey, responseData, ttl);
      res.setHeader('X-Cache', 'MISS');
    }
  };
}

// Generate cache key from request
function generateDefaultCacheKey(req) {
  const { method, url, query } = req;
  const queryString = new URLSearchParams(query).toString();
  return `${method}:${url}${queryString ? '?' + queryString : ''}`;
}

// Cache key generators for specific endpoints
export const cacheKeyGenerators = {
  // Prompts list with filters
  promptsList: (req) => {
    const { category, featured, difficulty, sort, page, limit } = req.query;
    return `prompts:list:${category || 'all'}:${featured || 'false'}:${difficulty || 'all'}:${sort || 'newest'}:${page || 1}:${limit || 20}`;
  },

  // Single prompt
  prompt: (req) => {
    const { id } = req.query;
    return `prompt:${id}`;
  },

  // User profile
  userProfile: (req) => {
    const { id } = req.query;
    return `user:profile:${id}`;
  },

  // Collections list
  collectionsList: (req) => {
    const { user_id, public_only, sort, page, limit } = req.query;
    return `collections:list:${user_id || 'all'}:${public_only || 'true'}:${sort || 'newest'}:${page || 1}:${limit || 20}`;
  },

  // Search results
  search: (req) => {
    const { search, category, tags, difficulty, featured, trending, sort, page, limit } = req.query;
    return `search:${search || ''}:${category || 'all'}:${tags || ''}:${difficulty || 'all'}:${featured || 'false'}:${trending || 'false'}:${sort || 'newest'}:${page || 1}:${limit || 20}`;
  },

  // Analytics data
  analytics: (req) => {
    const { start_date, end_date, event_type, content_type, group_by } = req.query;
    return `analytics:${start_date || ''}:${end_date || ''}:${event_type || 'all'}:${content_type || 'all'}:${group_by || 'day'}`;
  }
};

// Cache invalidation helpers
export function invalidatePromptCache(promptId) {
  // Invalidate prompt-specific cache
  deleteCached(`prompt:${promptId}`);
  
  // Invalidate lists that might contain this prompt
  // Note: In a real implementation, you'd want more sophisticated cache invalidation
  clearCache();
}

export function invalidateUserCache(userId) {
  // Invalidate user-specific cache
  deleteCached(`user:profile:${userId}`);
  
  // Invalidate user's collections and prompts
  clearCache();
}

export function invalidateCollectionCache(collectionId) {
  // Invalidate collection-specific cache
  deleteCached(`collection:${collectionId}`);
  
  // Invalidate collections list
  clearCache();
}

// Performance monitoring
export function withPerformanceMonitoring(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function(req, res, ...args) {
    const startTime = Date.now();
    
    try {
      const result = await originalMethod.call(this, req, res, ...args);
      const duration = Date.now() - startTime;
      
      // Log performance metrics
      console.log(`Performance: ${propertyKey} took ${duration}ms`);
      
      // Track performance in analytics if available
      if (window.analytics) {
        window.analytics.trackPerformance(propertyKey, duration, {
          endpoint: req.url,
          method: req.method
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Performance: ${propertyKey} failed after ${duration}ms`, error);
      throw error;
    }
  };

  return descriptor;
}

// Database query optimization helpers
export function optimizeQuery(query, params = []) {
  // Add query optimization hints
  const optimizedQuery = query
    .replace(/SELECT \*/g, 'SELECT') // Avoid SELECT *
    .replace(/ORDER BY\s+(\w+)\s+DESC/g, 'ORDER BY $1 DESC NULLS LAST') // Handle NULL values
    .replace(/LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/g, 'LIMIT $1 OFFSET $2'); // Ensure proper pagination

  return { query: optimizedQuery, params };
}

// Response compression helper
export function compressResponse(data) {
  // Simple compression for large responses
  if (JSON.stringify(data).length > 10000) {
    // In a real implementation, you'd use gzip compression
    return {
      compressed: true,
      data: JSON.stringify(data),
      original_size: JSON.stringify(data).length
    };
  }
  
  return data;
}

// Batch processing helper
export function batchProcess(items, batchSize = 100, processor) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  return Promise.all(
    batches.map(batch => processor(batch))
  );
}

// Memory usage monitoring
export function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    };
  }
  
  return null;
}
