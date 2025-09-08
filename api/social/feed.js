import { sql } from '@vercel/postgres';
import { securityHeaders, rateLimit, requestLogger, errorHandler } from '../middleware/security.js';

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

    // Check authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const currentUser = await verifyToken(token);
    if (!currentUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get user's feed (prompts from followed users + trending prompts)
    const feedQuery = `
      WITH followed_users AS (
        SELECT following_id 
        FROM user_follows 
        WHERE follower_id = $1
      ),
      trending_prompts AS (
        SELECT p.*, 
               u.username as author_username,
               up.display_name as author_display_name,
               up.avatar_url as author_avatar_url,
               'trending' as feed_type
        FROM prompts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE p.is_public = true
          AND p.created_at >= NOW() - INTERVAL '7 days'
          AND p.usage_count > 0
        ORDER BY p.usage_count DESC, p.average_rating DESC
        LIMIT 10
      ),
      followed_prompts AS (
        SELECT p.*,
               u.username as author_username,
               up.display_name as author_display_name,
               up.avatar_url as author_avatar_url,
               'following' as feed_type
        FROM prompts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE p.is_public = true
          AND p.author_id IN (SELECT following_id FROM followed_users)
        ORDER BY p.created_at DESC
      )
      SELECT * FROM (
        SELECT * FROM followed_prompts
        UNION ALL
        SELECT * FROM trending_prompts
      ) combined_feed
      ORDER BY 
        CASE WHEN feed_type = 'following' THEN created_at END DESC,
        CASE WHEN feed_type = 'trending' THEN usage_count END DESC
      LIMIT $2 OFFSET $3
    `;

    const feedResult = await sql.unsafe(feedQuery, [currentUser.userId, limit, offset]);

    // Get total count for pagination
    const countQuery = `
      WITH followed_users AS (
        SELECT following_id 
        FROM user_follows 
        WHERE follower_id = $1
      )
      SELECT COUNT(*) as total
      FROM (
        SELECT p.id
        FROM prompts p
        WHERE p.is_public = true
          AND p.author_id IN (SELECT following_id FROM followed_users)
        UNION
        SELECT p.id
        FROM prompts p
        WHERE p.is_public = true
          AND p.created_at >= NOW() - INTERVAL '7 days'
          AND p.usage_count > 0
      ) combined_prompts
    `;

    const countResult = await sql.unsafe(countQuery, [currentUser.userId]);
    const total = parseInt(countResult.rows[0].total);

    // Get user's follow suggestions
    const suggestionsQuery = `
      SELECT 
        u.id,
        u.username,
        up.display_name,
        up.avatar_url,
        up.bio,
        (SELECT COUNT(*) FROM prompts WHERE author_id = u.id AND is_public = true) as prompts_count,
        (SELECT COUNT(*) FROM user_follows WHERE following_id = u.id) as followers_count
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.id != $1
        AND u.id NOT IN (
          SELECT following_id 
          FROM user_follows 
          WHERE follower_id = $1
        )
        AND EXISTS (
          SELECT 1 FROM prompts p 
          WHERE p.author_id = u.id AND p.is_public = true
        )
      ORDER BY 
        (SELECT COUNT(*) FROM prompts WHERE author_id = u.id AND is_public = true) DESC,
        (SELECT COUNT(*) FROM user_follows WHERE following_id = u.id) DESC
      LIMIT 5
    `;

    const suggestionsResult = await sql.unsafe(suggestionsQuery, [currentUser.userId]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      feed: feedResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      },
      suggestions: suggestionsResult.rows
    });

  } catch (error) {
    console.error('Feed error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function verifyToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check if token is expired
    if (Date.now() > decoded.expires) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
}
