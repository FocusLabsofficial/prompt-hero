import { sql } from '@vercel/postgres';
import { securityHeaders, rateLimit, requestLogger, errorHandler } from '../middleware/security.js';
import { promptQuerySchema } from '../validation/schemas.js';

export default async function handler(req, res) {
  // Apply security middleware
  securityHeaders(req, res, () => {});
  requestLogger(req, res, () => {});
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Rate limiting
    await new Promise((resolve, reject) => {
      rateLimit(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Validate query parameters
    const { error, value } = promptQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({ 
        error: 'Invalid query parameters', 
        details: error.details[0].message 
      });
    }

    const {
      search,
      category,
      tags,
      difficulty,
      featured,
      trending,
      sort = 'created_at',
      order = 'desc',
      page = 1,
      limit = 20
    } = value;

    // Build search query
    const searchResults = await performAdvancedSearch({
      search,
      category,
      tags,
      difficulty,
      featured,
      trending,
      sort,
      order,
      page,
      limit
    });

    res.status(200).json(searchResults);

  } catch (error) {
    console.error('Search error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function performAdvancedSearch({
  search,
  category,
  tags,
  difficulty,
  featured,
  trending,
  sort,
  order,
  page,
  limit
}) {
  try {
    // Build the base query
    let whereConditions = ['p.is_public = true'];
    let queryParams = [];
    let paramIndex = 1;

    // Text search using PostgreSQL full-text search
    if (search) {
      const searchTerms = search.trim().split(/\s+/);
      const searchQuery = searchTerms.map(term => `'${term}'`).join(' & ');
      
      whereConditions.push(`
        (to_tsvector('english', p.title || ' ' || p.description || ' ' || p.content) 
         @@ to_tsquery('english', $${paramIndex}))
      `);
      queryParams.push(searchQuery);
      paramIndex++;
    }

    // Category filter
    if (category && category !== 'all') {
      whereConditions.push(`p.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    // Tags filter
    if (tags && tags.length > 0) {
      const tagConditions = tags.map(tag => {
        whereConditions.push(`$${paramIndex} = ANY(p.tags)`);
        queryParams.push(tag);
        paramIndex++;
        return `$${paramIndex - 1} = ANY(p.tags)`;
      });
    }

    // Difficulty filter
    if (difficulty) {
      whereConditions.push(`p.difficulty_level = $${paramIndex}`);
      queryParams.push(difficulty);
      paramIndex++;
    }

    // Featured filter
    if (featured !== undefined) {
      whereConditions.push(`p.is_featured = $${paramIndex}`);
      queryParams.push(featured);
      paramIndex++;
    }

    // Trending filter (prompts with high usage in last 30 days)
    if (trending) {
      whereConditions.push(`
        p.created_at >= NOW() - INTERVAL '30 days' 
        AND p.usage_count > 0
      `);
    }

    // Build the main query
    const whereClause = whereConditions.join(' AND ');
    
    // Determine sort column and direction
    const sortColumn = getSortColumn(sort);
    const sortDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM prompts p
      WHERE ${whereClause}
    `;

    const countResult = await sql.unsafe(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const offset = (page - 1) * limit;
    const mainQuery = `
      SELECT 
        p.id,
        p.title,
        p.description,
        p.content,
        p.category,
        p.tags,
        p.difficulty_level,
        p.is_featured,
        p.average_rating,
        p.total_ratings,
        p.usage_count,
        p.created_at,
        p.updated_at,
        u.username as author_username,
        up.display_name as author_display_name,
        up.avatar_url as author_avatar_url,
        ${search ? `
          ts_rank(
            to_tsvector('english', p.title || ' ' || p.description || ' ' || p.content),
            to_tsquery('english', $${paramIndex})
          ) as search_rank
        ` : '0 as search_rank'}
      FROM prompts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE ${whereClause}
      ORDER BY ${search ? 'search_rank DESC, ' : ''}${sortColumn} ${sortDirection}
      LIMIT $${paramIndex + (search ? 1 : 0)} OFFSET $${paramIndex + (search ? 2 : 1)}
    `;

    // Add search parameter if present
    if (search) {
      const searchTerms = search.trim().split(/\s+/);
      const searchQuery = searchTerms.map(term => `'${term}'`).join(' & ');
      queryParams.push(searchQuery);
    }

    // Add pagination parameters
    queryParams.push(limit, offset);

    const result = await sql.unsafe(mainQuery, queryParams);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Get related tags for suggestions
    const relatedTags = await getRelatedTags(search, category, tags);

    // Get search suggestions
    const suggestions = await getSearchSuggestions(search);

    return {
      prompts: result.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      },
      search_metadata: {
        query: search,
        category,
        tags,
        difficulty,
        featured,
        trending,
        sort,
        order
      },
      suggestions: {
        related_tags: relatedTags,
        search_suggestions: suggestions
      }
    };

  } catch (error) {
    console.error('Advanced search error:', error);
    throw error;
  }
}

function getSortColumn(sort) {
  const sortColumns = {
    'created_at': 'p.created_at',
    'updated_at': 'p.updated_at',
    'title': 'p.title',
    'average_rating': 'p.average_rating',
    'usage_count': 'p.usage_count',
    'total_ratings': 'p.total_ratings',
    'popular': 'p.usage_count',
    'rating': 'p.average_rating',
    'newest': 'p.created_at',
    'oldest': 'p.created_at'
  };
  
  return sortColumns[sort] || 'p.created_at';
}

async function getRelatedTags(search, category, currentTags) {
  try {
    let whereConditions = ['p.is_public = true'];
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      const searchTerms = search.trim().split(/\s+/);
      const searchQuery = searchTerms.map(term => `'${term}'`).join(' & ');
      
      whereConditions.push(`
        (to_tsvector('english', p.title || ' ' || p.description || ' ' || p.content) 
         @@ to_tsquery('english', $${paramIndex}))
      `);
      queryParams.push(searchQuery);
      paramIndex++;
    }

    if (category && category !== 'all') {
      whereConditions.push(`p.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT 
        unnest(p.tags) as tag,
        COUNT(*) as frequency
      FROM prompts p
      WHERE ${whereClause}
      GROUP BY unnest(p.tags)
      ORDER BY frequency DESC
      LIMIT 10
    `;

    const result = await sql.unsafe(query, queryParams);
    
    // Filter out current tags and return top suggestions
    return result.rows
      .filter(row => !currentTags || !currentTags.includes(row.tag))
      .map(row => ({
        tag: row.tag,
        frequency: parseInt(row.frequency)
      }));

  } catch (error) {
    console.error('Error getting related tags:', error);
    return [];
  }
}

async function getSearchSuggestions(search) {
  if (!search || search.length < 2) {
    return [];
  }

  try {
    const searchTerm = search.toLowerCase();
    
    // Get suggestions from prompt titles and descriptions
    const query = `
      SELECT DISTINCT
        CASE 
          WHEN LOWER(p.title) LIKE $1 THEN p.title
          WHEN LOWER(p.description) LIKE $1 THEN p.description
          ELSE NULL
        END as suggestion,
        'prompt' as type
      FROM prompts p
      WHERE p.is_public = true
        AND (LOWER(p.title) LIKE $1 OR LOWER(p.description) LIKE $1)
      LIMIT 5
      
      UNION
      
      SELECT DISTINCT
        p.category as suggestion,
        'category' as type
      FROM prompts p
      WHERE p.is_public = true
        AND LOWER(p.category) LIKE $1
      LIMIT 3
      
      UNION
      
      SELECT DISTINCT
        unnest(p.tags) as suggestion,
        'tag' as type
      FROM prompts p
      WHERE p.is_public = true
        AND EXISTS (
          SELECT 1 FROM unnest(p.tags) as tag 
          WHERE LOWER(tag) LIKE $1
        )
      LIMIT 5
      
      ORDER BY type, suggestion
      LIMIT 10
    `;

    const result = await sql.unsafe(query, [`%${searchTerm}%`]);
    
    return result.rows.map(row => ({
      suggestion: row.suggestion,
      type: row.type
    }));

  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}
