-- PostgreSQL schema draft for the MVP.
-- Notes:
-- - Multi-tenant: most tables include organization_id.
-- - Overdue is derived (due_at < now() AND returned_at IS NULL), not persisted.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'librarian', 'teacher', 'student', 'guest');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('active', 'inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
    CREATE TYPE item_status AS ENUM ('available', 'checked_out', 'on_hold', 'lost', 'withdrawn', 'repair');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loan_status') THEN
    CREATE TYPE loan_status AS ENUM ('open', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hold_status') THEN
    CREATE TYPE hold_status AS ENUM ('queued', 'ready', 'cancelled', 'fulfilled', 'expired');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  area text NULL,
  shelf_code text NULL,
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  role user_role NOT NULL,
  org_unit text NULL,
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

CREATE INDEX IF NOT EXISTS users_org_name_trgm
  ON users USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS bibliographic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  creators text[] NULL,
  contributors text[] NULL,
  publisher text NULL,
  published_year int NULL,
  language text NULL,
  subjects text[] NULL,
  isbn text NULL,
  classification text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bibs_org_isbn
  ON bibliographic_records (organization_id, isbn);
CREATE INDEX IF NOT EXISTS bibs_org_classification
  ON bibliographic_records (organization_id, classification);
CREATE INDEX IF NOT EXISTS bibs_title_trgm
  ON bibliographic_records USING gin (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS item_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE RESTRICT,
  barcode text NOT NULL,
  call_number text NOT NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  status item_status NOT NULL DEFAULT 'available',
  acquired_at timestamptz NULL,
  last_inventory_at timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, barcode)
);

CREATE INDEX IF NOT EXISTS items_org_status
  ON item_copies (organization_id, status);
CREATE INDEX IF NOT EXISTS items_org_location
  ON item_copies (organization_id, location_id);

CREATE TABLE IF NOT EXISTS circulation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  audience_role user_role NOT NULL,
  loan_days int NOT NULL,
  max_loans int NOT NULL,
  max_renewals int NOT NULL,
  max_holds int NOT NULL,
  hold_pickup_days int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES item_copies(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  checked_out_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  returned_at timestamptz NULL,
  renewed_count int NOT NULL DEFAULT 0,
  status loan_status NOT NULL DEFAULT 'open'
);

-- At most one open loan per item.
CREATE UNIQUE INDEX IF NOT EXISTS loans_one_open_per_item
  ON loans (organization_id, item_id)
  WHERE returned_at IS NULL;

CREATE INDEX IF NOT EXISTS loans_org_user_open
  ON loans (organization_id, user_id)
  WHERE returned_at IS NULL;

CREATE INDEX IF NOT EXISTS loans_org_due_open
  ON loans (organization_id, due_at)
  WHERE returned_at IS NULL;

CREATE TABLE IF NOT EXISTS holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pickup_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  placed_at timestamptz NOT NULL DEFAULT now(),
  status hold_status NOT NULL DEFAULT 'queued',
  assigned_item_id uuid NULL REFERENCES item_copies(id) ON DELETE SET NULL,
  ready_at timestamptz NULL,
  ready_until timestamptz NULL,
  cancelled_at timestamptz NULL,
  fulfilled_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS holds_org_status
  ON holds (organization_id, status);
CREATE INDEX IF NOT EXISTS holds_org_bib_queue
  ON holds (organization_id, bibliographic_id, placed_at)
  WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_org_created_at
  ON audit_events (organization_id, created_at DESC);

