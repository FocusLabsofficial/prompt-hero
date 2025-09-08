import fs from 'fs';
import path from 'path';
import { sql } from '@vercel/postgres';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readPromptsJson() {
  try {
    const filePath = path.join(process.cwd(), 'docs', 'prompts.json');
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? { prompts: parsed } : parsed;
  } catch (err) {
    return { prompts: [] };
  }
}

function parseIdFromUrl(url, base) {
  const withoutBase = url.replace(base, '');
  const parts = withoutBase.split('/').filter(Boolean);
  return parts[0] || null;
}

export default async function handler(req, res) {
  try {
    const url = req.url || '';
    const method = req.method || 'GET';

    // Health check
    if (url === '/api/health') {
      return send(res, 200, { ok: true });
    }

    // Seed dummy data (POST /api/seed)
    if (url === '/api/seed' && method === 'POST') {
      await ensureTables();
      const inserted = await seedDummyPrompts();
      return send(res, 201, { message: 'Seeded prompts', inserted });
    }

    // Prompts list and create
    if (url.startsWith('/api/prompts') && (url === '/api/prompts' || url.startsWith('/api/prompts?'))) {
      await ensureTables();

      if (method === 'GET') {
        // Basic filtering (query param: q, category)
        const u = new URL('http://localhost' + url);
        const q = (u.searchParams.get('q') || u.searchParams.get('search') || '').toLowerCase();
        const category = (u.searchParams.get('category') || '').toLowerCase();
        const page = Math.max(parseInt(u.searchParams.get('page') || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(u.searchParams.get('limit') || '20', 10), 1), 100);
        const offset = (page - 1) * limit;

        const where = [];
        const params = [];
        if (q) {
          params.push(`%${q}%`);
          where.push(`(LOWER(title) LIKE $${params.length} OR LOWER(description) LIKE $${params.length} OR LOWER(content) LIKE $${params.length})`);
        }
        if (category && category !== 'all') {
          params.push(category);
          where.push(`LOWER(category) = $${params.length}`);
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const totalRes = await sql.unsafe(`SELECT COUNT(*) AS c FROM prompts ${whereSql}`, params);
        const total = parseInt(totalRes.rows[0]?.c || '0', 10);

        params.push(limit, offset);
        const rowsRes = await sql.unsafe(
          `SELECT id, title, description, content, category, tags, average_rating, total_ratings, total_likes, created_at, updated_at
           FROM prompts ${whereSql}
           ORDER BY created_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params
        );

        return send(res, 200, { prompts: rowsRes.rows, pagination: { page, limit, total } });
      }

      if (method === 'POST') {
        const body = await readJson(req);
        const id = body.id || cryptoRandomUUID();
        const now = new Date().toISOString();
        const tags = Array.isArray(body.tags) ? body.tags : [];
        await sql`
          INSERT INTO prompts (id, title, description, content, category, tags, average_rating, total_ratings, total_likes, created_at, updated_at)
          VALUES (${id}, ${body.title || ''}, ${body.description || ''}, ${body.content || ''}, ${body.category || 'general'}, ${tags}, 0, 0, 0, ${now}, ${now})
        `;
        return send(res, 201, { message: 'Created', id });
      }

      return send(res, 405, { error: 'Method not allowed' });
    }

    // Prompt by id
    if (url.startsWith('/api/prompts/')) {
      const id = parseIdFromUrl(url, '/api/prompts/');
      await ensureTables();
      const found = await sql`SELECT id, title, description, content, category, tags, average_rating, total_ratings, total_likes, created_at, updated_at FROM prompts WHERE id = ${id}`;
      const prompt = found.rows[0];
      if (!prompt && method === 'GET') return send(res, 404, { error: 'Prompt not found' });

      if (method === 'GET') return send(res, 200, { prompt });
      if (method === 'PUT') {
        const body = await readJson(req);
        const now = new Date().toISOString();
        await sql`
          UPDATE prompts SET
            title = COALESCE(${body.title}, title),
            description = COALESCE(${body.description}, description),
            content = COALESCE(${body.content}, content),
            category = COALESCE(${body.category}, category),
            tags = COALESCE(${Array.isArray(body.tags) ? body.tags : null}, tags),
            updated_at = ${now}
          WHERE id = ${id}
        `;
        return send(res, 200, { message: 'Updated' });
      }
      if (method === 'DELETE') {
        await sql`DELETE FROM prompts WHERE id = ${id}`;
        return send(res, 200, { message: 'Deleted' });
      }
      return send(res, 405, { error: 'Method not allowed' });
    }

    // Fallback for other routes during consolidation
    if (url.startsWith('/api/')) {
      return send(res, 501, { error: 'Endpoint consolidated for Vercel Hobby limit. To enable, extend router in api/[...route].js.' });
    }

    // Non-API
    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    return send(res, 500, { error: 'Internal error', details: e?.message });
  }
}

// Helpers
async function ensureTables() {
  // Create minimal prompts table if it does not exist
  await sql`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      category TEXT,
      tags TEXT[] DEFAULT '{}',
      average_rating NUMERIC DEFAULT 0,
      total_ratings INTEGER DEFAULT 0,
      total_likes INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
}

async function seedDummyPrompts() {
  const categories = ['development', 'creative', 'business', 'education', 'research', 'technical'];
  const rows = [];
  for (let i = 0; i < 18; i++) {
    const cat = categories[i % categories.length];
    const id = cryptoRandomUUID();
    const title = `Sample ${cat} prompt ${i + 1}`;
    const description = `A high-quality ${cat} prompt example to demonstrate seeding.`;
    const content = `You are an expert in ${cat}. Help the user with a step-by-step, actionable response.`;
    const tags = [cat, 'demo', 'seed'];
    await sql`
      INSERT INTO prompts (id, title, description, content, category, tags)
      VALUES (${id}, ${title}, ${description}, ${content}, ${cat}, ${tags})
      ON CONFLICT (id) DO NOTHING
    `;
    rows.push({ id, title, category: cat });
  }
  return rows.length;
}

function cryptoRandomUUID() {
  // Use Node 18+ crypto if available
  try {
    // eslint-disable-next-line no-undef
    return globalThis.crypto?.randomUUID() || require('crypto').randomUUID();
  } catch {
    const { randomBytes } = require('crypto');
    const b = randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}
