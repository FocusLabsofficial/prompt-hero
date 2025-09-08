import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { securityHeaders, rateLimit, validateInput, requestLogger, errorHandler } from '../middleware/security.js';
import { loginSchema } from '../validation/schemas.js';

export default async function handler(req, res) {
  // Apply security middleware
  securityHeaders(req, res, () => {});
  requestLogger(req, res, () => {});
  
  if (req.method !== 'POST') {
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

    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { email, password } = value;

    // Find user by email
    const userResult = await sql`
      SELECT u.id, u.username, u.email, u.password_hash, u.created_at,
             up.display_name, up.bio, up.avatar_url
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.email = ${email}
    `;

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Update last login
    await sql`
      UPDATE users 
      SET last_login = NOW(), updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // Generate JWT token
    const token = generateSimpleToken(user.id);

    // Get user stats
    const statsResult = await sql`
      SELECT 
        (SELECT COUNT(*) FROM prompts WHERE author_id = ${user.id}) as prompts_count,
        (SELECT COUNT(*) FROM favorites WHERE user_id = ${user.id}) as favorites_count,
        (SELECT COUNT(*) FROM collections WHERE user_id = ${user.id}) as collections_count
    `;

    const stats = statsResult.rows[0];

    res.status(200).json({
      message: 'Login successful',
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
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    errorHandler(error, req, res, () => {});
  }
}

function generateSimpleToken(userId) {
  // Simplified token generation - in production, use proper JWT
  const payload = {
    userId,
    timestamp: Date.now(),
    expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
