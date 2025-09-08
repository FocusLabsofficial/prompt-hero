import { sql } from '@vercel/postgres';
import { securityHeaders, rateLimit, requestLogger, errorHandler } from '../middleware/security.js';

export default async function handler(req, res) {
  // Apply security middleware
  securityHeaders(req, res, () => {});
  requestLogger(req, res, () => {});
  
  if (req.method === 'POST') {
    return handleFollow(req, res);
  } else if (req.method === 'DELETE') {
    return handleUnfollow(req, res);
  } else if (req.method === 'GET') {
    return handleGetFollowStatus(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleFollow(req, res) {
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

    const { target_user_id } = req.body;
    
    if (!target_user_id) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    if (currentUser.userId === target_user_id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if user exists
    const userCheck = await sql`
      SELECT id FROM users WHERE id = ${target_user_id}
    `;

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    const existingFollow = await sql`
      SELECT id FROM user_follows 
      WHERE follower_id = ${currentUser.userId} AND following_id = ${target_user_id}
    `;

    if (existingFollow.rows.length > 0) {
      return res.status(409).json({ error: 'Already following this user' });
    }

    // Create follow relationship
    await sql`
      INSERT INTO user_follows (follower_id, following_id, created_at)
      VALUES (${currentUser.userId}, ${target_user_id}, NOW())
    `;

    // Update follower counts
    await sql`
      UPDATE user_profiles 
      SET followers_count = followers_count + 1
      WHERE user_id = ${target_user_id}
    `;

    await sql`
      UPDATE user_profiles 
      SET following_count = following_count + 1
      WHERE user_id = ${currentUser.userId}
    `;

    res.status(201).json({
      message: 'Successfully followed user',
      following: true
    });

  } catch (error) {
    console.error('Follow error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function handleUnfollow(req, res) {
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

    const { target_user_id } = req.body;
    
    if (!target_user_id) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    // Check if following
    const existingFollow = await sql`
      SELECT id FROM user_follows 
      WHERE follower_id = ${currentUser.userId} AND following_id = ${target_user_id}
    `;

    if (existingFollow.rows.length === 0) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    // Remove follow relationship
    await sql`
      DELETE FROM user_follows 
      WHERE follower_id = ${currentUser.userId} AND following_id = ${target_user_id}
    `;

    // Update follower counts
    await sql`
      UPDATE user_profiles 
      SET followers_count = GREATEST(followers_count - 1, 0)
      WHERE user_id = ${target_user_id}
    `;

    await sql`
      UPDATE user_profiles 
      SET following_count = GREATEST(following_count - 1, 0)
      WHERE user_id = ${currentUser.userId}
    `;

    res.status(200).json({
      message: 'Successfully unfollowed user',
      following: false
    });

  } catch (error) {
    console.error('Unfollow error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function handleGetFollowStatus(req, res) {
  try {
    // Rate limiting
    await new Promise((resolve, reject) => {
      rateLimit(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const { follower_id, following_id } = req.query;
    
    if (!follower_id || !following_id) {
      return res.status(400).json({ error: 'Both follower_id and following_id are required' });
    }

    // Check follow status
    const followStatus = await sql`
      SELECT id FROM user_follows 
      WHERE follower_id = ${follower_id} AND following_id = ${following_id}
    `;

    const isFollowing = followStatus.rows.length > 0;

    // Get follower counts
    const followerCounts = await sql`
      SELECT 
        (SELECT COUNT(*) FROM user_follows WHERE following_id = ${following_id}) as followers_count,
        (SELECT COUNT(*) FROM user_follows WHERE follower_id = ${following_id}) as following_count
    `;

    res.status(200).json({
      is_following: isFollowing,
      followers_count: parseInt(followerCounts.rows[0].followers_count),
      following_count: parseInt(followerCounts.rows[0].following_count)
    });

  } catch (error) {
    console.error('Get follow status error:', error);
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
