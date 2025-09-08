import { sql } from '@vercel/postgres';
import { securityHeaders, requestLogger, errorHandler } from '../middleware/security.js';

export default async function handler(req, res) {
  // Apply security middleware
  securityHeaders(req, res, () => {});
  requestLogger(req, res, () => {});
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const decoded = verifySimpleToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user data
    const userResult = await sql`
      SELECT u.id, u.username, u.email, u.created_at,
             up.display_name, up.bio, up.avatar_url
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.id = ${decoded.userId}
    `;

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user stats
    const statsResult = await sql`
      SELECT 
        (SELECT COUNT(*) FROM prompts WHERE author_id = ${user.id}) as prompts_count,
        (SELECT COUNT(*) FROM favorites WHERE user_id = ${user.id}) as favorites_count,
        (SELECT COUNT(*) FROM collections WHERE user_id = ${user.id}) as collections_count
    `;

    const stats = statsResult.rows[0];

    res.status(200).json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        stats: {
          prompts_count: parseInt(stats.prompts_count),
          favorites_count: parseInt(stats.favorites_count),
          collections_count: parseInt(stats.collections_count)
        }
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    errorHandler(error, req, res, () => {});
  }
}

function verifySimpleToken(token) {
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
