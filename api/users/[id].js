import { sql } from '@vercel/postgres';
import { securityHeaders, rateLimit, requestLogger, errorHandler } from '../middleware/security.js';

export default async function handler(req, res) {
  // Apply security middleware
  securityHeaders(req, res, () => {});
  requestLogger(req, res, () => {});
  
  const { id } = req.query;

  if (req.method === 'GET') {
    return handleGet(req, res, id);
  } else if (req.method === 'PUT') {
    return handlePut(req, res, id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req, res, userId) {
  try {
    // Rate limiting
    await new Promise((resolve, reject) => {
      rateLimit(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Get user profile with stats
    const userResult = await sql`
      SELECT 
        u.id, u.username, u.email, u.created_at, u.last_login,
        up.display_name, up.bio, up.avatar_url, up.website_url, up.location,
        (SELECT COUNT(*) FROM prompts WHERE author_id = u.id) as prompts_count,
        (SELECT COUNT(*) FROM favorites WHERE user_id = u.id) as favorites_count,
        (SELECT COUNT(*) FROM collections WHERE user_id = u.id) as collections_count,
        (SELECT AVG(rating) FROM ratings r 
         JOIN prompts p ON r.prompt_id = p.id 
         WHERE p.author_id = u.id) as average_rating,
        (SELECT COUNT(*) FROM ratings r 
         JOIN prompts p ON r.prompt_id = p.id 
         WHERE p.author_id = u.id) as total_ratings_received
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.id = ${userId}
    `;

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user's recent prompts
    const promptsResult = await sql`
      SELECT 
        id, title, description, category, created_at, updated_at,
        average_rating, total_ratings, usage_count, is_featured
      FROM prompts 
      WHERE author_id = ${userId} AND is_public = true
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Get user's collections
    const collectionsResult = await sql`
      SELECT 
        id, name, description, is_public, created_at, updated_at,
        (SELECT COUNT(*) FROM collection_prompts WHERE collection_id = c.id) as prompt_count
      FROM collections c
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 5
    `;

    // Get user's favorite prompts
    const favoritesResult = await sql`
      SELECT 
        p.id, p.title, p.description, p.category, p.created_at,
        p.average_rating, p.total_ratings, p.author_id,
        u.username as author_username
      FROM favorites f
      JOIN prompts p ON f.prompt_id = p.id
      JOIN users u ON p.author_id = u.id
      WHERE f.user_id = ${userId}
      ORDER BY f.created_at DESC
      LIMIT 10
    `;

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        website_url: user.website_url,
        location: user.location,
        created_at: user.created_at,
        last_login: user.last_login,
        stats: {
          prompts_count: parseInt(user.prompts_count),
          favorites_count: parseInt(user.favorites_count),
          collections_count: parseInt(user.collections_count),
          average_rating: parseFloat(user.average_rating) || 0,
          total_ratings_received: parseInt(user.total_ratings_received)
        }
      },
      recent_prompts: promptsResult.rows,
      collections: collectionsResult.rows,
      favorite_prompts: favoritesResult.rows
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function handlePut(req, res, userId) {
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

    // Verify token and get current user
    const currentUser = await verifyToken(token);
    if (!currentUser || currentUser.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { display_name, bio, avatar_url, website_url, location } = req.body;

    // Update user profile
    const updateResult = await sql`
      UPDATE user_profiles 
      SET 
        display_name = COALESCE(${display_name}, display_name),
        bio = COALESCE(${bio}, bio),
        avatar_url = COALESCE(${avatar_url}, avatar_url),
        website_url = COALESCE(${website_url}, website_url),
        location = COALESCE(${location}, location),
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `;

    if (updateResult.rows.length === 0) {
      // Create profile if it doesn't exist
      await sql`
        INSERT INTO user_profiles (user_id, display_name, bio, avatar_url, website_url, location, created_at, updated_at)
        VALUES (${userId}, ${display_name}, ${bio}, ${avatar_url}, ${website_url}, ${location}, NOW(), NOW())
      `;
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      profile: {
        display_name,
        bio,
        avatar_url,
        website_url,
        location
      }
    });

  } catch (error) {
    console.error('Update user profile error:', error);
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
