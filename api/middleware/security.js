// Security middleware for Prompt Hero API
import { sql } from '@vercel/postgres';

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map();

// Security headers
export function securityHeaders(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdn.counter.dev; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://api.prompthero.com; " +
        "frame-ancestors 'none';"
    );

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    
    return false;
}

// Rate limiting middleware
export function rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    return (req, res, next) => {
        const clientId = getClientId(req);
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean up old entries
        if (rateLimitStore.has(clientId)) {
            const requests = rateLimitStore.get(clientId).filter(time => time > windowStart);
            rateLimitStore.set(clientId, requests);
        } else {
            rateLimitStore.set(clientId, []);
        }

        const requests = rateLimitStore.get(clientId);
        
        if (requests.length >= maxRequests) {
            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
            
            return res.status(429).json({
                error: 'Too many requests',
                message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }

        // Add current request
        requests.push(now);
        rateLimitStore.set(clientId, requests);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', maxRequests - requests.length);
        res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

        if (next) next();
    };
}

// Get client identifier for rate limiting
function getClientId(req) {
    // Use IP address as primary identifier
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               'unknown';
    
    // Include user agent for additional uniqueness
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    return `${ip}-${userAgent}`;
}

// Input validation middleware
export function validateInput(schema) {
    return (req, res, next) => {
        try {
            const { error, value } = schema.validate(req.body, { 
                abortEarly: false,
                stripUnknown: true 
            });

            if (error) {
                const errors = error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }));

                return res.status(400).json({
                    error: 'Validation failed',
                    message: 'Please check your input',
                    errors: errors
                });
            }

            req.body = value;
            if (next) next();
        } catch (err) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Request body is not valid JSON'
            });
        }
    };
}

// SQL injection protection
export function sanitizeInput(input) {
    if (typeof input === 'string') {
        // Remove potentially dangerous characters
        return input
            .replace(/[<>]/g, '') // Remove < and >
            .replace(/['"]/g, '') // Remove quotes
            .replace(/[;]/g, '') // Remove semicolons
            .trim();
    }
    
    if (Array.isArray(input)) {
        return input.map(item => sanitizeInput(item));
    }
    
    if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[sanitizeInput(key)] = sanitizeInput(value);
        }
        return sanitized;
    }
    
    return input;
}

// XSS protection
export function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Content length validation
export function validateContentLength(maxLength = 10000) {
    return (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length'] || '0');
        
        if (contentLength > maxLength) {
            return res.status(413).json({
                error: 'Payload too large',
                message: `Request body exceeds maximum size of ${maxLength} bytes`
            });
        }
        
        if (next) next();
    };
}

// Authentication middleware (placeholder for future implementation)
export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Valid authentication token required'
        });
    }
    
    const token = authHeader.substring(7);
    
    // TODO: Implement JWT token validation
    // For now, we'll use a simple user ID system
    try {
        // In production, validate JWT token here
        req.user = { id: token }; // Placeholder
        if (next) next();
    } catch (error) {
        return res.status(401).json({
            error: 'Invalid token',
            message: 'Authentication token is invalid or expired'
        });
    }
}

// Optional authentication (doesn't fail if no token)
export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            // In production, validate JWT token here
            req.user = { id: token }; // Placeholder
        } catch (error) {
            // Ignore invalid tokens for optional auth
        }
    }
    
    if (next) next();
}

// CSRF protection
export function csrfProtection(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        if (next) next();
        return;
    }
    
    const csrfToken = req.headers['x-csrf-token'];
    const sessionToken = req.session?.csrfToken;
    
    if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
        return res.status(403).json({
            error: 'CSRF token mismatch',
            message: 'Invalid or missing CSRF token'
        });
    }
    
    if (next) next();
}

// Request logging
export function requestLogger(req, res, next) {
    const start = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: getClientId(req),
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
        };
        
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.log(JSON.stringify(logData));
        }
        
        // In production, send to logging service
        if (process.env.NODE_ENV === 'production') {
            // TODO: Send to logging service (e.g., LogRocket, Sentry, etc.)
        }
        
        originalSend.call(this, data);
    };
    
    if (next) next();
}

// Error handling middleware
export function errorHandler(error, req, res, next) {
    console.error('API Error:', error);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            message: error.message,
            details: isDevelopment ? error.details : undefined
        });
    }
    
    if (error.name === 'UnauthorizedError') {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required'
        });
    }
    
    if (error.name === 'ForbiddenError') {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied'
        });
    }
    
    if (error.name === 'NotFoundError') {
        return res.status(404).json({
            error: 'Not found',
            message: 'Resource not found'
        });
    }
    
    // Default error response
    res.status(500).json({
        error: 'Internal server error',
        message: isDevelopment ? error.message : 'Something went wrong',
        ...(isDevelopment && { stack: error.stack })
    });
}

// Health check endpoint
export function healthCheck(req, res) {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
}

// Security audit logging
export function securityAudit(event, details = {}) {
    const auditLog = {
        event,
        details,
        timestamp: new Date().toISOString(),
        ip: details.ip || 'unknown',
        userAgent: details.userAgent || 'unknown'
    };
    
    // Log security events
    console.warn('Security Event:', JSON.stringify(auditLog));
    
    // In production, send to security monitoring service
    if (process.env.NODE_ENV === 'production') {
        // TODO: Send to security monitoring service
    }
}
