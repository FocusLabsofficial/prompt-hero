-- Migration 001: Initial Prompt Hero Schema
-- This migration creates the initial database schema for Prompt Hero

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    website VARCHAR(255),
    github_username VARCHAR(50),
    twitter_username VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompts table
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_ratings INTEGER DEFAULT 0,
    total_favorites INTEGER DEFAULT 0,
    difficulty_level VARCHAR(20) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_tokens INTEGER,
    language VARCHAR(10) DEFAULT 'en',
    version INTEGER DEFAULT 1
);

-- Ratings table
CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    is_helpful BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(prompt_id, user_id)
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_prompts INTEGER DEFAULT 0,
    total_followers INTEGER DEFAULT 0
);

-- Collection prompts junction table
CREATE TABLE IF NOT EXISTS collection_prompts (
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (collection_id, prompt_id)
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, prompt_id)
);

-- Follows table (user following collections)
CREATE TABLE IF NOT EXISTS collection_follows (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, collection_id)
);

-- User follows table (user following other users)
CREATE TABLE IF NOT EXISTS user_follows (
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'view', 'copy', 'rate', 'favorite', 'share'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
