-- Migration 002: Building Media & Indoor POIs
-- Tablas para medios multimedia de edificios y puntos de interés interiores.

CREATE TABLE IF NOT EXISTS building_media (
    id         SERIAL PRIMARY KEY,
    zone_id    INT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    floor      INT NOT NULL DEFAULT 0,
    type       VARCHAR(20) NOT NULL CHECK (type IN ('photo', 'video', 'video360', 'floorplan', 'audio')),
    url        TEXT NOT NULL,
    thumbnail  TEXT,
    title      VARCHAR(255) NOT NULL,
    caption    TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_building_media_zone_floor ON building_media (zone_id, floor);

CREATE TABLE IF NOT EXISTS indoor_pois (
    id          SERIAL PRIMARY KEY,
    zone_id     INT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    floor       INT NOT NULL DEFAULT 0,
    name        VARCHAR(255) NOT NULL,
    icon        VARCHAR(50) NOT NULL,
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    description TEXT,
    schedule    VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_indoor_pois_zone_floor ON indoor_pois (zone_id, floor);
