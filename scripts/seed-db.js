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
      content TEXT,
      category TEXT,
      tags TEXT[] DEFAULT '{}',
      average_rating NUMERIC DEFAULT 0,
      total_ratings INTEGER DEFAULT 0,
      total_likes INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  // Backfill missing columns if table pre-existed with an older shape
  await sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS description TEXT`;
  await sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS content TEXT`;
  await sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS category TEXT`;
  await sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`;
  await sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS average_rating NUMERIC DEFAULT 0`;
  await sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0`;
  await sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS total_likes INTEGER DEFAULT 0`;
  await sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
  await sql`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
  // Ensure id is TEXT (some older tables may have INTEGER/serial ids)
  try {
    await sql`ALTER TABLE prompts ALTER COLUMN id TYPE TEXT USING id::text`;
  } catch (e) {
    // ignore if already TEXT
  }
}

async function isIdText() {
  const res = await sql`SELECT data_type FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'id'`;
  const t = (res.rows[0]?.data_type || '').toLowerCase();
  return t !== 'integer' && t !== 'bigint' && t !== 'smallint';
}

async function tableHasColumn(columnName) {
  const res = await sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = ${columnName} LIMIT 1`;
  return res.rowCount > 0;
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
  const useTextId = await isIdText();
  const hasPromptText = await tableHasColumn('prompt_text');
  const hasContent = await tableHasColumn('content');
  const hasTags = await tableHasColumn('tags');
  for (let i = 0; i < 24; i++) {
    const cat = categories[i % categories.length];
    const id = uuidv4();
    const title = `Sample ${cat} prompt ${i + 1}`;
    const description = `A high-quality ${cat} prompt example to demonstrate seeding.`;
    const content = `You are an expert in ${cat}. Provide a step-by-step, actionable response with examples.`;
    const tags = [cat, 'demo', 'seed'];
    // Insert according to available columns (no `unsafe` usage)
    if (useTextId) {
      if (hasPromptText && hasContent && hasTags) {
        await sql`INSERT INTO prompts (id, title, description, prompt_text, content, category, tags) VALUES (${id}, ${title}, ${description}, ${content}, ${content}, ${cat}, ${tags}) ON CONFLICT (id) DO NOTHING`;
      } else if (hasPromptText && hasContent && !hasTags) {
        await sql`INSERT INTO prompts (id, title, description, prompt_text, content, category) VALUES (${id}, ${title}, ${description}, ${content}, ${content}, ${cat}) ON CONFLICT (id) DO NOTHING`;
      } else if (hasPromptText && !hasContent && hasTags) {
        await sql`INSERT INTO prompts (id, title, description, prompt_text, category, tags) VALUES (${id}, ${title}, ${description}, ${content}, ${cat}, ${tags}) ON CONFLICT (id) DO NOTHING`;
      } else if (!hasPromptText && hasContent && hasTags) {
        await sql`INSERT INTO prompts (id, title, description, content, category, tags) VALUES (${id}, ${title}, ${description}, ${content}, ${cat}, ${tags}) ON CONFLICT (id) DO NOTHING`;
      } else if (!hasPromptText && hasContent && !hasTags) {
        await sql`INSERT INTO prompts (id, title, description, content, category) VALUES (${id}, ${title}, ${description}, ${content}, ${cat}) ON CONFLICT (id) DO NOTHING`;
      } else if (hasPromptText && !hasContent && !hasTags) {
        await sql`INSERT INTO prompts (id, title, description, prompt_text, category) VALUES (${id}, ${title}, ${description}, ${content}, ${cat}) ON CONFLICT (id) DO NOTHING`;
      } else {
        await sql`INSERT INTO prompts (id, title, description, category) VALUES (${id}, ${title}, ${description}, ${cat}) ON CONFLICT (id) DO NOTHING`;
      }
    } else {
      // id is serial
      if (hasPromptText && hasContent && hasTags) {
        await sql`INSERT INTO prompts (title, description, prompt_text, content, category, tags) VALUES (${title}, ${description}, ${content}, ${content}, ${cat}, ${tags})`;
      } else if (hasPromptText && hasContent && !hasTags) {
        await sql`INSERT INTO prompts (title, description, prompt_text, content, category) VALUES (${title}, ${description}, ${content}, ${content}, ${cat})`;
      } else if (hasPromptText && !hasContent && hasTags) {
        await sql`INSERT INTO prompts (title, description, prompt_text, category, tags) VALUES (${title}, ${description}, ${content}, ${cat}, ${tags})`;
      } else if (!hasPromptText && hasContent && hasTags) {
        await sql`INSERT INTO prompts (title, description, content, category, tags) VALUES (${title}, ${description}, ${content}, ${cat}, ${tags})`;
      } else if (!hasPromptText && hasContent && !hasTags) {
        await sql`INSERT INTO prompts (title, description, content, category) VALUES (${title}, ${description}, ${cat}, ${content})`;
      } else if (hasPromptText && !hasContent && !hasTags) {
        await sql`INSERT INTO prompts (title, description, prompt_text, category) VALUES (${title}, ${description}, ${content}, ${cat})`;
      } else {
        await sql`INSERT INTO prompts (title, description, category) VALUES (${title}, ${description}, ${cat})`;
      }
    }
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


