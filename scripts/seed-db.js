#!/usr/bin/env node

// Seed Vercel Postgres/Neon with dummy Prompt Hero data locally
// Requires env var POSTGRES_URL to be set

const { sql } = require('@vercel/postgres');

async function ensureTables() {
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

function uuidv4() {
  try {
    return require('crypto').randomUUID();
  } catch {
    const { randomBytes } = require('crypto');
    const b = randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
}

async function seedDummyPrompts() {
  const categories = ['development', 'creative', 'business', 'education', 'research', 'technical'];
  let inserted = 0;
  for (let i = 0; i < 24; i++) {
    const cat = categories[i % categories.length];
    const id = uuidv4();
    const title = `Sample ${cat} prompt ${i + 1}`;
    const description = `A high-quality ${cat} prompt example to demonstrate seeding.`;
    const content = `You are an expert in ${cat}. Provide a step-by-step, actionable response with examples.`;
    const tags = [cat, 'demo', 'seed'];
    await sql`
      INSERT INTO prompts (id, title, description, content, category, tags)
      VALUES (${id}, ${title}, ${description}, ${content}, ${cat}, ${tags})
      ON CONFLICT (id) DO NOTHING
    `;
    inserted++;
  }
  return inserted;
}

(async () => {
  if (!process.env.POSTGRES_URL) {
    console.error('Missing POSTGRES_URL env var. Set it to your Neon/Vercel Postgres connection string.');
    process.exit(1);
  }
  try {
    await ensureTables();
    const count = await seedDummyPrompts();
    console.log(`Seed complete. Inserted ${count} prompts.`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
})();


