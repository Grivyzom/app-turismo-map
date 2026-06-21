--
-- PostgreSQL database dump (SCHEMA ONLY)
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.user_route_tracking DROP CONSTRAINT IF EXISTS user_route_tracking_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_route_tracking DROP CONSTRAINT IF EXISTS user_route_tracking_route_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_interactions DROP CONSTRAINT IF EXISTS user_interactions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.saved_locations DROP CONSTRAINT IF EXISTS saved_locations_collection_id_fkey;
ALTER TABLE IF EXISTS ONLY public.routes DROP CONSTRAINT IF EXISTS routes_creator_id_fkey;
ALTER TABLE IF EXISTS ONLY public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey;
ALTER TABLE IF EXISTS ONLY public.place_reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.place_reviews DROP CONSTRAINT IF EXISTS reviews_branch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.promotions DROP CONSTRAINT IF EXISTS promotions_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.promotions DROP CONSTRAINT IF EXISTS promotions_branch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_branch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.invitations DROP CONSTRAINT IF EXISTS invitations_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.event_attendees DROP CONSTRAINT IF EXISTS event_attendees_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.event_attendees DROP CONSTRAINT IF EXISTS event_attendees_event_id_fkey;
ALTER TABLE IF EXISTS ONLY public.company_roles DROP CONSTRAINT IF EXISTS company_roles_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.company_members DROP CONSTRAINT IF EXISTS company_members_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.company_members DROP CONSTRAINT IF EXISTS company_members_role_id_fkey;
ALTER TABLE IF EXISTS ONLY public.company_members DROP CONSTRAINT IF EXISTS company_members_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.company_members DROP CONSTRAINT IF EXISTS company_members_branch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.company_catalog_items DROP CONSTRAINT IF EXISTS company_catalog_items_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.company_catalog_items DROP CONSTRAINT IF EXISTS company_catalog_items_branch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.company_branches DROP CONSTRAINT IF EXISTS company_branches_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.collections DROP CONSTRAINT IF EXISTS collections_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.citizen_profiles DROP CONSTRAINT IF EXISTS citizen_profiles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_admin_id_fkey;
DROP INDEX IF EXISTS public.saved_locations_collection_id_idx;
DROP INDEX IF EXISTS public.promotions_is_active_idx;
DROP INDEX IF EXISTS public.promotions_branch_id_idx;
DROP INDEX IF EXISTS public.products_branch_id_idx;
DROP INDEX IF EXISTS public.map_reports_geom_idx;
DROP INDEX IF EXISTS public.idx_routes_geom;
DROP INDEX IF EXISTS public.idx_promotions_dates;
DROP INDEX IF EXISTS public.idx_promotions_branch;
DROP INDEX IF EXISTS public.idx_products_branch;
DROP INDEX IF EXISTS public.idx_map_reports_user;
DROP INDEX IF EXISTS public.idx_map_reports_geom;
DROP INDEX IF EXISTS public.idx_interactions_user;
DROP INDEX IF EXISTS public.idx_interactions_target;
DROP INDEX IF EXISTS public.idx_events_user_emitter;
DROP INDEX IF EXISTS public.idx_events_geom;
DROP INDEX IF EXISTS public.idx_events_branch_emitter;
DROP INDEX IF EXISTS public.idx_company_branches_company;
DROP INDEX IF EXISTS public.idx_citizen_prefs;
DROP INDEX IF EXISTS public.idx_branches_geom;
DROP INDEX IF EXISTS public.events_geom_idx;
DROP INDEX IF EXISTS public.company_branches_geom_idx;
DROP INDEX IF EXISTS public.collections_user_id_idx;
DROP INDEX IF EXISTS public.admin_audit_log_created_idx;
DROP INDEX IF EXISTS public.admin_audit_log_admin_idx;
DROP INDEX IF EXISTS public.admin_audit_log_action_idx;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.user_route_tracking DROP CONSTRAINT IF EXISTS user_route_tracking_pkey;
ALTER TABLE IF EXISTS ONLY public.user_interactions DROP CONSTRAINT IF EXISTS user_interactions_pkey;
ALTER TABLE IF EXISTS ONLY public.place_reviews DROP CONSTRAINT IF EXISTS unique_user_branch_review;
ALTER TABLE IF EXISTS ONLY public.user_interactions DROP CONSTRAINT IF EXISTS unique_interaction;
ALTER TABLE IF EXISTS ONLY public.company_roles DROP CONSTRAINT IF EXISTS unique_company_role_name;
ALTER TABLE IF EXISTS ONLY public.saved_locations DROP CONSTRAINT IF EXISTS saved_locations_pkey;
ALTER TABLE IF EXISTS ONLY public.routes DROP CONSTRAINT IF EXISTS routes_pkey;
ALTER TABLE IF EXISTS ONLY public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_pkey;
ALTER TABLE IF EXISTS ONLY public.place_reviews DROP CONSTRAINT IF EXISTS reviews_pkey;
ALTER TABLE IF EXISTS ONLY public.promotions DROP CONSTRAINT IF EXISTS promotions_pkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_pkey;
ALTER TABLE IF EXISTS ONLY public.map_reports DROP CONSTRAINT IF EXISTS map_reports_pkey;
ALTER TABLE IF EXISTS ONLY public.invitations DROP CONSTRAINT IF EXISTS invitations_pkey;
ALTER TABLE IF EXISTS ONLY public.events DROP CONSTRAINT IF EXISTS events_pkey;
ALTER TABLE IF EXISTS ONLY public.event_attendees DROP CONSTRAINT IF EXISTS event_attendees_pkey;
ALTER TABLE IF EXISTS ONLY public.company_roles DROP CONSTRAINT IF EXISTS company_roles_pkey;
ALTER TABLE IF EXISTS ONLY public.company_members DROP CONSTRAINT IF EXISTS company_members_pkey;
ALTER TABLE IF EXISTS ONLY public.company_catalog_items DROP CONSTRAINT IF EXISTS company_catalog_items_pkey;
ALTER TABLE IF EXISTS ONLY public.company_branches DROP CONSTRAINT IF EXISTS company_branches_pkey;
ALTER TABLE IF EXISTS ONLY public.companies DROP CONSTRAINT IF EXISTS companies_pkey;
ALTER TABLE IF EXISTS ONLY public.collections DROP CONSTRAINT IF EXISTS collections_pkey;
ALTER TABLE IF EXISTS ONLY public.citizen_profiles DROP CONSTRAINT IF EXISTS citizen_profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_users DROP CONSTRAINT IF EXISTS admin_users_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_users DROP CONSTRAINT IF EXISTS admin_users_email_key;
ALTER TABLE IF EXISTS ONLY public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.user_interactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.saved_locations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.routes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.promotions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.products ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.place_reviews ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.map_reports ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.company_roles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.company_catalog_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.company_branches ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.companies ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.collections ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.admin_users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.admin_audit_log ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.user_route_tracking;
DROP SEQUENCE IF EXISTS public.user_interactions_id_seq;
DROP TABLE IF EXISTS public.user_interactions;
DROP SEQUENCE IF EXISTS public.saved_locations_id_seq;
DROP TABLE IF EXISTS public.saved_locations;
DROP SEQUENCE IF EXISTS public.routes_id_seq;
DROP TABLE IF EXISTS public.routes;
DROP TABLE IF EXISTS public.role_permissions;
DROP SEQUENCE IF EXISTS public.reviews_id_seq;
DROP TABLE IF EXISTS public.promotions_id_seq;
DROP TABLE IF EXISTS public.promotions;
DROP SEQUENCE IF EXISTS public.products_id_seq;
DROP TABLE IF EXISTS public.products;
DROP SEQUENCE IF EXISTS public.place_reviews_id_seq;
DROP TABLE IF EXISTS public.place_reviews;
DROP SEQUENCE IF EXISTS public.map_reports_id_seq;
DROP TABLE IF EXISTS public.map_reports;
DROP TABLE IF EXISTS public.invitations;
DROP SEQUENCE IF EXISTS public.events_id_seq;
DROP TABLE IF EXISTS public.events;
DROP TABLE IF EXISTS public.event_attendees;
DROP SEQUENCE IF EXISTS public.company_roles_id_seq;
DROP TABLE IF EXISTS public.company_roles;
DROP TABLE IF EXISTS public.company_members;
DROP SEQUENCE IF EXISTS public.company_catalog_items_id_seq;
DROP TABLE IF EXISTS public.company_catalog_items;
DROP SEQUENCE IF EXISTS public.company_branches_id_seq;
DROP TABLE IF EXISTS public.company_branches;
DROP SEQUENCE IF EXISTS public.companies_id_seq;
DROP TABLE IF EXISTS public.companies;
DROP SEQUENCE IF EXISTS public.collections_id_seq;
DROP TABLE IF EXISTS public.collections;
DROP TABLE IF EXISTS public.citizen_profiles;
DROP SEQUENCE IF EXISTS public.admin_users_id_seq;
DROP TABLE IF EXISTS public.admin_users;
DROP SEQUENCE IF EXISTS public.admin_audit_log_id_seq;
DROP TABLE IF EXISTS public.admin_audit_log;
DROP EXTENSION IF EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

SET default_tablespace = '';
SET default_table_access_method = heap;

CREATE TABLE public.admin_audit_log (
    id integer NOT NULL,
    admin_id integer,
    action character varying(100) NOT NULL,
    ip_address character varying(45) NOT NULL,
    user_agent text,
    details text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.admin_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.admin_audit_log_id_seq OWNED BY public.admin_audit_log.id;

CREATE TABLE public.admin_users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'admin'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending_2fa'::character varying NOT NULL,
    totp_secret character varying(255),
    totp_ready boolean DEFAULT false,
    failed_attempts integer DEFAULT 0,
    locked_until timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.admin_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.admin_users_id_seq OWNED BY public.admin_users.id;

CREATE TABLE public.citizen_profiles (
    user_id integer NOT NULL,
    phone character varying(50),
    country character varying(100),
    preferences jsonb,
    profile_type VARCHAR(50) DEFAULT 'local' CHECK (profile_type IN ('local', 'tourist')),
    current_view_mode VARCHAR(50) DEFAULT 'local' CHECK (current_view_mode IN ('local', 'tourist'))
);

CREATE TABLE public.collections (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    visibility character varying(50) DEFAULT 'private'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.collections_id_seq OWNED BY public.collections.id;

CREATE TABLE public.companies (
    id integer NOT NULL,
    business_name character varying(255) NOT NULL,
    entity_type character varying(50) DEFAULT 'business'::character varying,
    category character varying(100),
    is_verified_badge boolean DEFAULT false,
    tax_id character varying(50),
    verification_status character varying(50) DEFAULT 'pending'::character varying,
    phone character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;

CREATE TABLE public.company_branches (
    id integer NOT NULL,
    company_id integer,
    branch_name character varying(255),
    description text,
    category character varying(100),
    address character varying(255),
    phone character varying(50),
    geom public.geography(Point,4326),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    image_url text,
    target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('local', 'tourist', 'all'))
);

CREATE SEQUENCE public.company_branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.company_branches_id_seq OWNED BY public.company_branches.id;

CREATE TABLE public.company_catalog_items (
    id integer NOT NULL,
    company_id integer,
    branch_id integer,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2),
    image_url text,
    is_available boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.company_catalog_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.company_catalog_items_id_seq OWNED BY public.company_catalog_items.id;

CREATE TABLE public.company_members (
    user_id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    role_id integer
);

CREATE TABLE public.company_roles (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.company_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.company_roles_id_seq OWNED BY public.company_roles.id;

CREATE TABLE public.event_attendees (
    event_id integer NOT NULL,
    user_id integer NOT NULL,
    attendance_status character varying DEFAULT 'registered'::character varying,
    registered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT event_attendees_attendance_status_check CHECK (((attendance_status)::text = ANY ((ARRAY['registered'::character varying, 'attended'::character varying, 'cancelled'::character varying])::text[])))
);

CREATE TABLE public.events (
    id integer NOT NULL,
    title character varying(255),
    description text,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    category character varying(100),
    geom public.geography(Point,4326),
    emitter_type character varying(50),
    user_emitter_id integer,
    branch_emitter_id integer,
    created_at timestamp without time zone,
    target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('local', 'tourist', 'all'))
);

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id integer,
    email character varying(255) NOT NULL,
    token_hash character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.map_reports (
    id integer NOT NULL,
    user_id integer,
    report_type character varying(50),
    description text,
    geom public.geography(Point,4326),
    upvotes integer,
    expires_at timestamp without time zone,
    created_at timestamp without time zone
);

CREATE SEQUENCE public.map_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.map_reports_id_seq OWNED BY public.map_reports.id;

CREATE TABLE public.place_reviews (
    id integer NOT NULL,
    user_id integer NOT NULL,
    branch_id integer NOT NULL,
    rating integer NOT NULL,
    review_text text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_review_text_only_high_ratings CHECK (((review_text IS NULL) OR (rating >= 4))),
    CONSTRAINT place_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

CREATE SEQUENCE public.place_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.place_reviews_id_seq OWNED BY public.place_reviews.id;

CREATE TABLE public.products (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2),
    image_url text,
    is_available boolean DEFAULT true,
    category character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;

CREATE TABLE public.promotions (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    product_id integer,
    title character varying(255) NOT NULL,
    description text,
    discount_text character varying(100),
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission character varying(100) NOT NULL
);

CREATE TABLE public.routes (
    id integer NOT NULL,
    creator_id integer,
    title character varying NOT NULL,
    description text,
    category character varying,
    geom public.geometry(LineString,4326) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('local', 'tourist', 'all'))
);

CREATE SEQUENCE public.routes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.routes_id_seq OWNED BY public.routes.id;

CREATE TABLE public.saved_locations (
    id integer NOT NULL,
    collection_id integer NOT NULL,
    location_type character varying(50) NOT NULL,
    ref_id character varying(100),
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    title character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.saved_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.saved_locations_id_seq OWNED BY public.saved_locations.id;

CREATE TABLE public.user_interactions (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    interaction_type character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_interactions_entity_type_check CHECK (((entity_type)::text = ANY ((ARRAY['branch'::character varying, 'event'::character varying, 'route'::character varying, 'report'::character varying])::text[]))),
    CONSTRAINT user_interactions_interaction_type_check CHECK (((interaction_type)::text = ANY ((ARRAY['like'::character varying, 'favorite'::character varying, 'save'::character varying, 'recommend'::character varying])::text[])))
);

CREATE SEQUENCE public.user_interactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_interactions_id_seq OWNED BY public.user_interactions.id;

CREATE TABLE public.user_route_tracking (
    user_id integer NOT NULL,
    route_id integer NOT NULL,
    status character varying DEFAULT 'planned'::character varying,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    CONSTRAINT user_route_tracking_status_check CHECK (((status)::text = ANY ((ARRAY['planned'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[])))
);

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    picture text,
    password_hash character varying(255),
    user_type character varying(50) DEFAULT 'citizen'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

ALTER TABLE ONLY public.admin_audit_log ALTER COLUMN id SET DEFAULT nextval('public.admin_audit_log_id_seq'::regclass);
ALTER TABLE ONLY public.admin_users ALTER COLUMN id SET DEFAULT nextval('public.admin_users_id_seq'::regclass);
ALTER TABLE ONLY public.collections ALTER COLUMN id SET DEFAULT nextval('public.collections_id_seq'::regclass);
ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);
ALTER TABLE ONLY public.company_branches ALTER COLUMN id SET DEFAULT nextval('public.company_branches_id_seq'::regclass);
ALTER TABLE ONLY public.company_catalog_items ALTER COLUMN id SET DEFAULT nextval('public.company_catalog_items_id_seq'::regclass);
ALTER TABLE ONLY public.company_roles ALTER COLUMN id SET DEFAULT nextval('public.company_roles_id_seq'::regclass);
ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);
ALTER TABLE ONLY public.map_reports ALTER COLUMN id SET DEFAULT nextval('public.map_reports_id_seq'::regclass);
ALTER TABLE ONLY public.place_reviews ALTER COLUMN id SET DEFAULT nextval('public.place_reviews_id_seq'::regclass);
ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);
ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);
ALTER TABLE ONLY public.routes ALTER COLUMN id SET DEFAULT nextval('public.routes_id_seq'::regclass);
ALTER TABLE ONLY public.saved_locations ALTER COLUMN id SET DEFAULT nextval('public.saved_locations_id_seq'::regclass);
ALTER TABLE ONLY public.user_interactions ALTER COLUMN id SET DEFAULT nextval('public.user_interactions_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.admin_audit_log ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_users ADD CONSTRAINT admin_users_email_key UNIQUE (email);
ALTER TABLE ONLY public.admin_users ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.citizen_profiles ADD CONSTRAINT citizen_profiles_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.collections ADD CONSTRAINT collections_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.company_branches ADD CONSTRAINT company_branches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.company_catalog_items ADD CONSTRAINT company_catalog_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.company_members ADD CONSTRAINT company_members_pkey PRIMARY KEY (user_id, company_id);
ALTER TABLE ONLY public.company_roles ADD CONSTRAINT company_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.event_attendees ADD CONSTRAINT event_attendees_pkey PRIMARY KEY (event_id, user_id);
ALTER TABLE ONLY public.events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.invitations ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.map_reports ADD CONSTRAINT map_reports_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.promotions ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.place_reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission);
ALTER TABLE ONLY public.routes ADD CONSTRAINT routes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.saved_locations ADD CONSTRAINT saved_locations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.company_roles ADD CONSTRAINT unique_company_role_name UNIQUE (company_id, name);
ALTER TABLE ONLY public.user_interactions ADD CONSTRAINT unique_interaction UNIQUE (user_id, interaction_type, entity_type, entity_id);
ALTER TABLE ONLY public.place_reviews ADD CONSTRAINT unique_user_branch_review UNIQUE (user_id, branch_id);
ALTER TABLE ONLY public.user_interactions ADD CONSTRAINT user_interactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_route_tracking ADD CONSTRAINT user_route_tracking_pkey PRIMARY KEY (user_id, route_id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX admin_audit_log_action_idx ON public.admin_audit_log USING btree (action);
CREATE INDEX admin_audit_log_admin_idx ON public.admin_audit_log USING btree (admin_id);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log USING btree (created_at DESC);
CREATE INDEX collections_user_id_idx ON public.collections USING btree (user_id);
CREATE INDEX company_branches_geom_idx ON public.company_branches USING gist (geom);
CREATE INDEX events_geom_idx ON public.events USING gist (geom);
CREATE INDEX idx_branches_geom ON public.company_branches USING gist (geom);
CREATE INDEX idx_citizen_prefs ON public.citizen_profiles USING gin (preferences);
CREATE INDEX idx_company_branches_company ON public.company_branches USING btree (company_id);
CREATE INDEX idx_events_branch_emitter ON public.events USING btree (branch_emitter_id);
CREATE INDEX idx_events_geom ON public.events USING gist (geom);
CREATE INDEX idx_events_user_emitter ON public.events USING btree (user_emitter_id);
CREATE INDEX idx_interactions_target ON public.user_interactions USING btree (entity_type, entity_id);
CREATE INDEX idx_interactions_user ON public.user_interactions USING btree (user_id);
CREATE INDEX idx_map_reports_geom ON public.map_reports USING gist (geom);
CREATE INDEX idx_map_reports_user ON public.map_reports USING btree (user_id);
CREATE INDEX idx_products_branch ON public.products USING btree (branch_id);
CREATE INDEX idx_promotions_branch ON public.promotions USING btree (branch_id);
CREATE INDEX idx_promotions_dates ON public.promotions USING btree (start_date, end_date);
CREATE INDEX idx_routes_geom ON public.routes USING gist (geom);
CREATE INDEX map_reports_geom_idx ON public.map_reports USING gist (geom);
CREATE INDEX products_branch_id_idx ON public.products USING btree (branch_id);
CREATE INDEX promotions_branch_id_idx ON public.promotions USING btree (branch_id);
CREATE INDEX promotions_is_active_idx ON public.promotions USING btree (is_active);
CREATE INDEX saved_locations_collection_id_idx ON public.saved_locations USING btree (collection_id);

-- New indexes from structure updates
CREATE INDEX idx_citizen_view_mode ON public.citizen_profiles(current_view_mode);
CREATE INDEX idx_events_audience ON public.events(target_audience);
CREATE INDEX idx_routes_audience ON public.routes(target_audience);
CREATE INDEX idx_branches_audience ON public.company_branches(target_audience);

ALTER TABLE ONLY public.admin_audit_log ADD CONSTRAINT admin_audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(id);
ALTER TABLE ONLY public.citizen_profiles ADD CONSTRAINT citizen_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.collections ADD CONSTRAINT collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.company_branches ADD CONSTRAINT company_branches_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE ONLY public.company_catalog_items ADD CONSTRAINT company_catalog_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.company_branches(id);
ALTER TABLE ONLY public.company_catalog_items ADD CONSTRAINT company_catalog_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE ONLY public.company_members ADD CONSTRAINT company_members_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.company_branches(id);
ALTER TABLE ONLY public.company_members ADD CONSTRAINT company_members_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE ONLY public.company_members ADD CONSTRAINT company_members_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.company_roles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.company_members ADD CONSTRAINT company_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.company_roles ADD CONSTRAINT company_roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.event_attendees ADD CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
ALTER TABLE ONLY public.event_attendees ADD CONSTRAINT event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.invitations ADD CONSTRAINT invitations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.company_branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.promotions ADD CONSTRAINT promotions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.company_branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.promotions ADD CONSTRAINT promotions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.place_reviews ADD CONSTRAINT reviews_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.company_branches(id);
ALTER TABLE ONLY public.place_reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.role_permissions ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.company_roles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.routes ADD CONSTRAINT routes_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.saved_locations ADD CONSTRAINT saved_locations_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_interactions ADD CONSTRAINT user_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_route_tracking ADD CONSTRAINT user_route_tracking_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);
ALTER TABLE ONLY public.user_route_tracking ADD CONSTRAINT user_route_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
