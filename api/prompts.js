// Modern API endpoint for Prompt Hero
// Optimized for performance and simplicity

import { sql } from '@vercel/postgres';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Helper function to send JSON responses
function sendJSON(res, status, data) {
  res.status(status).json(data);
}

// Validate and sanitize query parameters
function parseQuery(query) {
  const {
    page = '1',
    limit = DEFAULT_LIMIT.toString(),
    search = '',
    category = '',
    featured = '',
    sort = 'newest',
    difficulty = ''
  } = query;

  return {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT)),
    search: search.trim().toLowerCase(),
    category: category.toLowerCase(),
    featured: featured === 'true',
    sort: ['newest', 'popular', 'rating', 'alphabetical'].includes(sort) ? sort : 'newest',
    difficulty: ['beginner', 'intermediate', 'advanced'].includes(difficulty) ? difficulty : ''
  };
}

// Build WHERE clause and parameters for SQL query
function buildWhereClause(params) {
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  // Search across title, description, and content
  if (params.search) {
    values.push(`%${params.search}%`);
    conditions.push(`(
      LOWER(title) LIKE $${paramIndex} OR 
      LOWER(description) LIKE $${paramIndex} OR 
      LOWER(content) LIKE $${paramIndex}
    )`);
    paramIndex++;
  }

  // Category filter
  if (params.category && params.category !== 'all') {
    values.push(params.category);
    conditions.push(`LOWER(category) = $${paramIndex}`);
    paramIndex++;
  }

  // Difficulty filter
  if (params.difficulty) {
    values.push(params.difficulty);
    conditions.push(`LOWER(difficulty_level) = $${paramIndex}`);
    paramIndex++;
  }

  // Featured filter
  if (params.featured) {
    conditions.push(`is_featured = true`);
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
    paramIndex
  };
}

// Build ORDER BY clause
function buildOrderClause(sort) {
  switch (sort) {
    case 'popular':
      return 'ORDER BY total_likes DESC, created_at DESC';
    case 'rating':
      return 'ORDER BY average_rating DESC, total_ratings DESC, created_at DESC';
    case 'alphabetical':
      return 'ORDER BY title ASC';
    default: // 'newest'
      return 'ORDER BY created_at DESC';
  }
}

// Main API handler
export default async function handler(req, res) {
  const { method } = req;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await ensureTables();

    if (method === 'GET') {
      return await handleGetPrompts(req, res);
    }

    if (method === 'POST') {
      return await handleCreatePrompt(req, res);
    }

    return sendJSON(res, 405, { error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return sendJSON(res, 500, { 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
}

// Handle GET requests - fetch prompts with filtering and pagination
async function handleGetPrompts(req, res) {
  const params = parseQuery(req.query);
  const { whereClause, values, paramIndex } = buildWhereClause(params);
  const orderClause = buildOrderClause(params.sort);

  try {
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM prompts 
      ${whereClause}
    `;
    
    const countResult = await sql.unsafe(countQuery, values);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Calculate pagination
    const offset = (params.page - 1) * params.limit;
    const totalPages = Math.ceil(total / params.limit);

    // Get prompts with pagination
    const promptsQuery = `
      SELECT 
        id,
        title,
        description,
        content,
        category,
        tags,
        difficulty_level,
        is_featured,
        is_public,
        author,
        average_rating,
        total_ratings,
        total_likes,
        created_at,
        updated_at
      FROM prompts 
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const promptsResult = await sql.unsafe(promptsQuery, [
      ...values,
      params.limit,
      offset
    ]);

    // Transform prompts data
    const prompts = promptsResult.rows.map(prompt => ({
      ...prompt,
      tags: Array.isArray(prompt.tags) ? prompt.tags : [],
      average_rating: parseFloat(prompt.average_rating || 0),
      total_ratings: parseInt(prompt.total_ratings || 0, 10),
      total_likes: parseInt(prompt.total_likes || 0, 10),
      is_featured: Boolean(prompt.is_featured),
      is_public: Boolean(prompt.is_public)
    }));

    return sendJSON(res, 200, {
      prompts,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrev: params.page > 1
      },
      filters: {
        search: params.search,
        category: params.category,
        difficulty: params.difficulty,
        featured: params.featured,
        sort: params.sort
      }
    });

  } catch (error) {
    console.error('Database query error:', error);
    throw new Error('Failed to fetch prompts');
  }
}

// Handle POST requests - create new prompt
async function handleCreatePrompt(req, res) {
  const {
    title,
    description = '',
    content,
    category = 'general',
    tags = [],
    difficulty_level = 'intermediate',
    is_featured = false,
    is_public = true,
    author = 'anonymous'
  } = req.body;

  // Validation
  if (!title || !content) {
    return sendJSON(res, 400, { 
      error: 'Missing required fields',
      required: ['title', 'content']
    });
  }

  if (title.length > 255) {
    return sendJSON(res, 400, { error: 'Title too long (max 255 characters)' });
  }

  if (content.length > 10000) {
    return sendJSON(res, 400, { error: 'Content too long (max 10,000 characters)' });
  }

  if (description.length > 500) {
    return sendJSON(res, 400, { error: 'Description too long (max 500 characters)' });
  }

  const validCategories = ['development', 'creative', 'business', 'education', 'research', 'technical', 'general'];
  if (!validCategories.includes(category)) {
    return sendJSON(res, 400, { error: 'Invalid category' });
  }

  const validDifficulties = ['beginner', 'intermediate', 'advanced'];
  if (!validDifficulties.includes(difficulty_level)) {
    return sendJSON(res, 400, { error: 'Invalid difficulty level' });
  }

  try {
    const id = generateId();
    const now = new Date().toISOString();
    const sanitizedTags = Array.isArray(tags) ? tags.slice(0, 10) : []; // Limit to 10 tags

    const result = await sql`
      INSERT INTO prompts (
        id, title, description, content, category, tags, 
        difficulty_level, is_featured, is_public, author,
        average_rating, total_ratings, total_likes, 
        created_at, updated_at
      )
      VALUES (
        ${id}, ${title}, ${description}, ${content}, ${category}, ${sanitizedTags},
        ${difficulty_level}, ${is_featured}, ${is_public}, ${author},
        0, 0, 0, ${now}, ${now}
      )
      RETURNING id, title, category, created_at
    `;

    return sendJSON(res, 201, {
      message: 'Prompt created successfully',
      prompt: result.rows[0]
    });

  } catch (error) {
    console.error('Database insert error:', error);
    
    if (error.message.includes('duplicate key')) {
      return sendJSON(res, 409, { error: 'Prompt with this ID already exists' });
    }
    
    throw new Error('Failed to create prompt');
  }
}

// Ensure database tables exist
async function ensureTables() {
  try {
    // Create prompts table with optimized schema
    await sql`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        tags TEXT[] DEFAULT '{}',
        difficulty_level TEXT DEFAULT 'intermediate',
        is_featured BOOLEAN DEFAULT false,
        is_public BOOLEAN DEFAULT true,
        author TEXT DEFAULT 'anonymous',
        average_rating DECIMAL(3,2) DEFAULT 0,
        total_ratings INTEGER DEFAULT 0,
        total_likes INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create indexes for better query performance
    await sql`CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_prompts_featured ON prompts(is_featured)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_prompts_rating ON prompts(average_rating DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_prompts_likes ON prompts(total_likes DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_prompts_search ON prompts USING gin(to_tsvector('english', title || ' ' || description || ' ' || content))`;

    // Create supporting tables
    await sql`
      CREATE TABLE IF NOT EXISTS prompt_likes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
        user_ip TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(prompt_id, user_ip)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS prompt_ratings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review TEXT,
        user_ip TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(prompt_id, user_ip)
      )
    `;

    // Create indexes for supporting tables
    await sql`CREATE INDEX IF NOT EXISTS idx_likes_prompt_id ON prompt_likes(prompt_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ratings_prompt_id ON prompt_ratings(prompt_id)`;

  } catch (error) {
    console.error('Failed to ensure tables:', error);
    throw error;
  }
}

// Generate a simple, readable ID
function generateId() {
  return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
