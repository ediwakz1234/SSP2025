-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.activity_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  action text NOT NULL CHECK (action ~ '^[a-z0-9_]+$'::text),
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text,
  user_email text,
  details text,
  context text,
  searchable tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((COALESCE(action, ''::text) || ' '::text) || COALESCE(user_email, ''::text)) || ' '::text) || COALESCE(details, ''::text)))) STORED,
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.activity_logs_backup (
  id bigint,
  user_id uuid,
  action text,
  metadata jsonb,
  created_at timestamp with time zone,
  status text,
  user_email text,
  details text,
  context jsonb
);
CREATE TABLE public.admin_profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  role text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  last_login timestamp without time zone,
  analyses_count integer DEFAULT 0,
  CONSTRAINT admin_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT admin_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.analytics_cache (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT analytics_cache_pkey PRIMARY KEY (key)
);
CREATE TABLE public.business_raw (
  business_id bigint NOT NULL,
  business_name text,
  general_category text,
  latitude double precision,
  longitude double precision,
  street text,
  zone_type text,
  status text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT business_raw_pkey PRIMARY KEY (business_id)
);
CREATE TABLE public.businesses (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  business_id integer,
  business_name character varying NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  street character varying NOT NULL,
  zone_type character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  zone_encoded integer DEFAULT 0,
  status text DEFAULT 'active'::text,
  business_density_50m integer DEFAULT 0,
  business_density_100m integer DEFAULT 0,
  business_density_200m integer DEFAULT 0,
  competitor_density_50m integer DEFAULT 0,
  competitor_density_100m integer DEFAULT 0,
  competitor_density_200m integer DEFAULT 0,
  geom geometry(Point, 4326),
  general_category text,
  cluster_id integer,
  CONSTRAINT businesses_pkey PRIMARY KEY (id)
);
CREATE TABLE public.businesses_raw (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  business_id integer,
  business_name text NOT NULL,
  general_category text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  street text,
  zone_type text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT businesses_raw_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clustering_opportunities (
  id bigint NOT NULL DEFAULT nextval('clustering_opportunities_id_seq'::regclass),
  created_at timestamp without time zone DEFAULT now(),
  business_category text,
  recommended_lat double precision,
  recommended_lng double precision,
  zone_type text,
  opportunity text,
  confidence numeric,
  competitor_count integer,
  competitors_500m integer,
  competitors_1km integer,
  competitors_2km integer,
  nearest_competitor jsonb,
  top_clusters jsonb,
  nearby_businesses jsonb,
  opportunity_score double precision,
  num_clusters integer,
  locations jsonb,
  CONSTRAINT clustering_opportunities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clustering_results (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  business_category character varying NOT NULL,
  num_clusters integer NOT NULL,
  recommended_latitude double precision NOT NULL,
  recommended_longitude double precision NOT NULL,
  recommended_zone_type character varying NOT NULL,
  confidence double precision NOT NULL,
  opportunity_level character varying NOT NULL,
  total_businesses integer NOT NULL,
  competitor_count integer NOT NULL,
  competitors_within_500m integer NOT NULL,
  competitors_within_1km integer NOT NULL,
  competitors_within_2km integer NOT NULL,
  market_saturation double precision NOT NULL,
  nearest_competitor_distance double precision,
  clusters_data json NOT NULL,
  nearby_businesses json NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clustering_results_pkey PRIMARY KEY (id),
  CONSTRAINT clustering_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(uid)
);
CREATE TABLE public.enhanced_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid,
  business_name text,
  category text,
  street text,
  latitude double precision,
  longitude double precision,
  zone_type text,
  zone_encoded integer,
  business_density_50m integer,
  business_density_100m integer,
  business_density_200m integer,
  competitor_density_50m integer,
  competitor_density_100m integer,
  competitor_density_200m integer,
  CONSTRAINT enhanced_data_pkey PRIMARY KEY (id)
);
CREATE TABLE public.error_logs (
  id integer NOT NULL DEFAULT nextval('error_logs_id_seq'::regclass),
  function_name text,
  error_message text,
  error_detail text,
  error_hint text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT error_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.kv_store_c9aabe87 (
  key text NOT NULL,
  value jsonb NOT NULL,
  CONSTRAINT kv_store_c9aabe87_pkey PRIMARY KEY (key)
);
CREATE TABLE public.model_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  optimal_k integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT model_metadata_pkey PRIMARY KEY (id)
);
CREATE TABLE public.optimal_k (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  k_value integer NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT optimal_k_pkey PRIMARY KEY (id)
);
CREATE TABLE public.password_reset_tokens (
  id integer NOT NULL DEFAULT nextval('password_reset_tokens_id_seq'::regclass),
  user_id uuid,
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(uid)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  first_name text,
  last_name text,
  full_name text,
  email text,
  contact_number text,
  address text,
  age integer,
  gender text,
  date_of_birth date,
  role text DEFAULT 'user'::text,
  created_at timestamp with time zone DEFAULT now(),
  last_login timestamp with time zone,
  analyses_count integer DEFAULT 0,
  avatar_url text,
  website text,
  updated_at timestamp with time zone DEFAULT now(),
  approval_status text DEFAULT 'pending'::text CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'flagged'::text])),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.seed_businesses (
  business_id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_name text,
  general_category text,
  street text,
  latitude double precision,
  longitude double precision,
  zone_type text,
  status text DEFAULT 'active'::text,
  CONSTRAINT seed_businesses_pkey PRIMARY KEY (business_id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.users (
  uid uuid NOT NULL,
  email character varying NOT NULL UNIQUE,
  hashed_password character varying,
  is_active boolean DEFAULT true,
  is_superuser boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  username character varying,
  phone_number character varying,
  gender character varying,
  date_of_birth date,
  first_name character varying,
  last_name character varying,
  address character varying,
  age integer,
  CONSTRAINT users_pkey PRIMARY KEY (uid)
);