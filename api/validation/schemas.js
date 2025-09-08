// Validation schemas for Prompt Hero API
import Joi from 'joi';

// Common validation patterns
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Prompt validation schemas
export const createPromptSchema = Joi.object({
    title: Joi.string()
        .min(10)
        .max(255)
        .required()
        .messages({
            'string.min': 'Title must be at least 10 characters long',
            'string.max': 'Title must not exceed 255 characters',
            'any.required': 'Title is required'
        }),
    
    content: Joi.string()
        .min(50)
        .max(10000)
        .required()
        .messages({
            'string.min': 'Content must be at least 50 characters long',
            'string.max': 'Content must not exceed 10,000 characters',
            'any.required': 'Content is required'
        }),
    
    description: Joi.string()
        .max(500)
        .allow('')
        .optional()
        .messages({
            'string.max': 'Description must not exceed 500 characters'
        }),
    
    category: Joi.string()
        .valid('development', 'creative', 'business', 'education', 'research', 'technical')
        .required()
        .messages({
            'any.only': 'Category must be one of: development, creative, business, education, research, technical',
            'any.required': 'Category is required'
        }),
    
    tags: Joi.array()
        .items(Joi.string().min(2).max(50))
        .max(10)
        .optional()
        .messages({
            'array.max': 'Maximum 10 tags allowed',
            'string.min': 'Each tag must be at least 2 characters',
            'string.max': 'Each tag must not exceed 50 characters'
        }),
    
    difficulty_level: Joi.string()
        .valid('beginner', 'intermediate', 'advanced')
        .default('intermediate')
        .messages({
            'any.only': 'Difficulty level must be one of: beginner, intermediate, advanced'
        }),
    
    is_public: Joi.boolean()
        .default(true)
});

export const updatePromptSchema = Joi.object({
    title: Joi.string()
        .min(10)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Title must be at least 10 characters long',
            'string.max': 'Title must not exceed 255 characters'
        }),
    
    content: Joi.string()
        .min(50)
        .max(10000)
        .optional()
        .messages({
            'string.min': 'Content must be at least 50 characters long',
            'string.max': 'Content must not exceed 10,000 characters'
        }),
    
    description: Joi.string()
        .max(500)
        .allow('')
        .optional()
        .messages({
            'string.max': 'Description must not exceed 500 characters'
        }),
    
    category: Joi.string()
        .valid('development', 'creative', 'business', 'education', 'research', 'technical')
        .optional()
        .messages({
            'any.only': 'Category must be one of: development, creative, business, education, research, technical'
        }),
    
    tags: Joi.array()
        .items(Joi.string().min(2).max(50))
        .max(10)
        .optional()
        .messages({
            'array.max': 'Maximum 10 tags allowed',
            'string.min': 'Each tag must be at least 2 characters',
            'string.max': 'Each tag must not exceed 50 characters'
        }),
    
    difficulty_level: Joi.string()
        .valid('beginner', 'intermediate', 'advanced')
        .optional()
        .messages({
            'any.only': 'Difficulty level must be one of: beginner, intermediate, advanced'
        }),
    
    is_public: Joi.boolean()
        .optional()
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});

// Rating validation schemas
export const createRatingSchema = Joi.object({
    rating: Joi.number()
        .integer()
        .min(1)
        .max(5)
        .required()
        .messages({
            'number.min': 'Rating must be at least 1',
            'number.max': 'Rating must not exceed 5',
            'any.required': 'Rating is required'
        }),
    
    review: Joi.string()
        .max(1000)
        .allow('')
        .optional()
        .messages({
            'string.max': 'Review must not exceed 1,000 characters'
        }),
    
    user_id: Joi.string()
        .pattern(uuidPattern)
        .required()
        .messages({
            'string.pattern.base': 'User ID must be a valid UUID',
            'any.required': 'User ID is required'
        })
});

// Favorites validation schemas
export const addFavoriteSchema = Joi.object({
    user_id: Joi.string()
        .pattern(uuidPattern)
        .required()
        .messages({
            'string.pattern.base': 'User ID must be a valid UUID',
            'any.required': 'User ID is required'
        }),
    
    prompt_id: Joi.string()
        .pattern(uuidPattern)
        .required()
        .messages({
            'string.pattern.base': 'Prompt ID must be a valid UUID',
            'any.required': 'Prompt ID is required'
        })
});

// Collection validation schemas
export const createCollectionSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(255)
        .required()
        .messages({
            'string.min': 'Collection name must be at least 3 characters long',
            'string.max': 'Collection name must not exceed 255 characters',
            'any.required': 'Collection name is required'
        }),
    
    description: Joi.string()
        .max(1000)
        .allow('')
        .optional()
        .messages({
            'string.max': 'Description must not exceed 1,000 characters'
        }),
    
    is_public: Joi.boolean()
        .default(true),
    
    owner_id: Joi.string()
        .pattern(uuidPattern)
        .required()
        .messages({
            'string.pattern.base': 'Owner ID must be a valid UUID',
            'any.required': 'Owner ID is required'
        })
});

export const updateCollectionSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Collection name must be at least 3 characters long',
            'string.max': 'Collection name must not exceed 255 characters'
        }),
    
    description: Joi.string()
        .max(1000)
        .allow('')
        .optional()
        .messages({
            'string.max': 'Description must not exceed 1,000 characters'
        }),
    
    is_public: Joi.boolean()
        .optional()
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});

// Collection prompt validation schemas
export const addPromptToCollectionSchema = Joi.object({
    prompt_id: Joi.string()
        .pattern(uuidPattern)
        .required()
        .messages({
            'string.pattern.base': 'Prompt ID must be a valid UUID',
            'any.required': 'Prompt ID is required'
        })
});

// Query parameter validation schemas
export const paginationSchema = Joi.object({
    page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .messages({
            'number.min': 'Page must be at least 1'
        }),
    
    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(20)
        .messages({
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit must not exceed 100'
        })
});

export const promptQuerySchema = paginationSchema.keys({
    category: Joi.string()
        .valid('development', 'creative', 'business', 'education', 'research', 'technical', 'all')
        .optional(),
    
    search: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Search query must not exceed 100 characters'
        }),
    
    sort: Joi.string()
        .valid('created_at', 'updated_at', 'title', 'average_rating', 'usage_count', 'total_ratings')
        .default('created_at'),
    
    order: Joi.string()
        .valid('asc', 'desc')
        .default('desc'),
    
    featured: Joi.boolean()
        .optional(),
    
    difficulty: Joi.string()
        .valid('beginner', 'intermediate', 'advanced')
        .optional(),
    
    trending: Joi.boolean()
        .optional()
});

export const collectionQuerySchema = paginationSchema.keys({
    user_id: Joi.string()
        .pattern(uuidPattern)
        .optional()
        .messages({
            'string.pattern.base': 'User ID must be a valid UUID'
        }),
    
    public_only: Joi.boolean()
        .default(true),
    
    sort: Joi.string()
        .valid('created_at', 'name', 'total_prompts', 'total_followers')
        .default('created_at'),
    
    order: Joi.string()
        .valid('asc', 'desc')
        .default('desc')
});

export const favoritesQuerySchema = paginationSchema.keys({
    user_id: Joi.string()
        .pattern(uuidPattern)
        .required()
        .messages({
            'string.pattern.base': 'User ID must be a valid UUID',
            'any.required': 'User ID is required'
        })
});

// User validation schemas
export const registerSchema = Joi.object({
    username: Joi.string()
        .min(3)
        .max(50)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .required()
        .messages({
            'string.min': 'Username must be at least 3 characters long',
            'string.max': 'Username must not exceed 50 characters',
            'string.pattern.base': 'Username can only contain letters, numbers, underscores, and hyphens',
            'any.required': 'Username is required'
        }),
    
    email: Joi.string()
        .pattern(emailPattern)
        .required()
        .messages({
            'string.pattern.base': 'Email must be a valid email address',
            'any.required': 'Email is required'
        }),
    
    password: Joi.string()
        .min(8)
        .max(128)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password must not exceed 128 characters',
            'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
            'any.required': 'Password is required'
        })
});

export const createUserSchema = registerSchema;

// Login validation schema
export const loginSchema = Joi.object({
    email: Joi.string()
        .pattern(emailPattern)
        .required()
        .messages({
            'string.pattern.base': 'Email must be a valid email address',
            'any.required': 'Email is required'
        }),
    
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required'
        })
});

// Utility function to validate UUID
export function isValidUUID(uuid) {
    return uuidPattern.test(uuid);
}

// Utility function to sanitize search query
export function sanitizeSearchQuery(query) {
    if (typeof query !== 'string') return '';
    
    return query
        .trim()
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/['"]/g, '') // Remove quotes
        .replace(/[;]/g, '') // Remove semicolons
        .substring(0, 100); // Limit length
}

// Utility function to validate and sanitize tags
export function validateAndSanitizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    
    return tags
        .filter(tag => typeof tag === 'string' && tag.trim().length >= 2)
        .map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
        .filter(tag => tag.length > 0)
        .slice(0, 10); // Limit to 10 tags
}
