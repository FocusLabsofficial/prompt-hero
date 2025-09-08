import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { securityHeaders, rateLimit, validateInput, requestLogger, errorHandler } from '../middleware/security.js';
import { registerSchema } from '../validation/schemas.js';

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
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { username, email, password } = value;

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users 
      WHERE email = ${email} OR username = ${username}
    `;

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        error: 'User already exists with this email or username' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = uuidv4();
    const newUser = await sql`
      INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
      VALUES (${userId}, ${username}, ${email}, ${hashedPassword}, NOW(), NOW())
      RETURNING id, username, email, created_at
    `;

    // Create user profile
    await sql`
      INSERT INTO user_profiles (user_id, display_name, bio, avatar_url, created_at, updated_at)
      VALUES (${userId}, ${username}, '', '', NOW(), NOW())
    `;

    const user = newUser.rows[0];

    // Generate JWT token (simplified - in production, use proper JWT library)
    const token = generateSimpleToken(userId);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
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
