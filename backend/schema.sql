-- BidForge Database Schema
-- Run this against your PostgreSQL database to initialize
-- psql $DATABASE_URL -f schema.sql

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for text search

-- ─── Organizations (companies that buy BidForge) ────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,           -- url-safe name
  plan        TEXT NOT NULL DEFAULT 'trial',  -- trial | starter | pro | enterprise
  seats       INTEGER NOT NULL DEFAULT 3,
  api_calls_this_month  INTEGER NOT NULL DEFAULT 0,
  api_limit             INTEGER NOT NULL DEFAULT 50,    -- per month
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member', -- owner | admin | member
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  verify_token    TEXT,
  reset_token     TEXT,
  reset_expires   TIMESTAMPTZ,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);

-- ─── Projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  company_name    TEXT NOT NULL,
  rfp_name        TEXT,
  caps_name       TEXT,
  pp_name         TEXT,
  status          TEXT NOT NULL DEFAULT 'draft', -- draft | complete | archived
  solicitation_type TEXT NOT NULL DEFAULT 'rfp_federal',
  compliance_score INTEGER,                       -- 0-100
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- ─── Requirements (compliance matrix rows) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS requirements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  req_order         INTEGER NOT NULL,
  requirement       TEXT NOT NULL,
  category          TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'Medium',
  status            TEXT NOT NULL DEFAULT 'To Be Confirmed',
  response_strategy TEXT,
  owner             TEXT DEFAULT 'TBD',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements(project_id);

-- ─── Proposal sections ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposal_sections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,   -- exec_summary | win_themes | full_proposal
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_proposal_sections_project_id ON proposal_sections(project_id);

-- ─── Audit / usage log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,   -- analyze | export_csv | export_word | login
  tokens_used INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_log_org_id ON usage_log(org_id);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN FOR t IN VALUES ('organizations'),('users'),('projects'),('requirements'),('proposal_sections')
  LOOP EXECUTE format('
    DROP TRIGGER IF EXISTS trg_updated_at ON %I;
    CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();', t, t);
  END LOOP;
END $$;

-- ─── Seed: demo org + owner (password: "demo1234") ───────────────────────────
-- Remove this in production or replace with your own credentials
INSERT INTO organizations (id, name, slug, plan, seats, api_limit)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Company', 'demo-company', 'pro', 10, 500)
ON CONFLICT DO NOTHING;

INSERT INTO users (org_id, email, password_hash, full_name, role, is_verified)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@bidforge.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnbYLZuOi', -- "demo1234"
  'Demo User',
  'owner',
  TRUE
) ON CONFLICT DO NOTHING;
