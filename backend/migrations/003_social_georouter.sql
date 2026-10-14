-- Migration 003: Social Geo-Router
-- Ampliar routes con control de privacidad, enlace de compartición, geometría PostGIS y soporte para usuarios ciudadanos.

ALTER TABLE routes 
  ALTER COLUMN business_id DROP NOT NULL;

ALTER TABLE routes 
  ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public', -- 'private', 'unlisted', 'public'
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_system_route BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS original_route_id INT REFERENCES routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(20) DEFAULT 'foot', -- 'foot', 'bike'
  ADD COLUMN IF NOT EXISTS geom geometry(LineString, 4326);

CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_share_token ON routes(share_token);
CREATE INDEX IF NOT EXISTS idx_routes_visibility ON routes(visibility);
CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes(user_id);
CREATE INDEX IF NOT EXISTS idx_routes_geom ON routes USING GIST(geom);

-- 2. Tabla para compartir específicamente 1 a 1 con usuarios registrados
CREATE TABLE IF NOT EXISTS route_shares (
  id SERIAL PRIMARY KEY,
  route_id INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  shared_with_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(10) DEFAULT 'view', -- 'view', 'edit'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(route_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS idx_route_shares_user ON route_shares(shared_with_user_id);

-- 3. Tabla para guardar / marcar favoritas (para hacerlas después)
CREATE TABLE IF NOT EXISTS user_saved_routes (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'planned', -- 'planned', 'completed'
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_routes_user ON user_saved_routes(user_id);
