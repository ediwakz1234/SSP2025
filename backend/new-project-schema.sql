-- Clean schema for new Supabase project
-- Run this in the SQL Editor at https://supabase.com/dashboard/project/etwafztuxctqzpmeqsds/sql

-- Businesses table
CREATE TABLE IF NOT EXISTS public.businesses (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id integer,
  business_name varchar NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  street varchar NOT NULL,
  zone_type varchar NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  zone_encoded integer DEFAULT 0,
  status text DEFAULT 'active',
  business_density_50m integer DEFAULT 0,
  business_density_100m integer DEFAULT 0,
  business_density_200m integer DEFAULT 0,
  competitor_density_50m integer DEFAULT 0,
  competitor_density_100m integer DEFAULT 0,
  competitor_density_200m integer DEFAULT 0,
  general_category text,
  cluster_id integer
);

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  first_name text,
  last_name text,
  full_name text,
  email text,
  contact_number text,
  address text,
  age integer,
  gender text,
  date_of_birth date,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  last_login timestamptz,
  analyses_count integer DEFAULT 0,
  avatar_url text,
  website text,
  updated_at timestamptz DEFAULT now(),
  approval_status text DEFAULT 'pending'
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text,
  user_email text,
  details text,
  context text
);

-- Admin profiles
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL,
  full_name text,
  role text NOT NULL,
  created_at timestamp DEFAULT now(),
  last_login timestamp,
  analyses_count integer DEFAULT 0
);

-- Business raw
CREATE TABLE IF NOT EXISTS public.business_raw (
  business_id bigint PRIMARY KEY,
  business_name text,
  general_category text,
  latitude double precision,
  longitude double precision,
  street text,
  zone_type text,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Businesses raw
CREATE TABLE IF NOT EXISTS public.businesses_raw (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id integer,
  business_name text NOT NULL,
  general_category text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  street text,
  zone_type text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Clustering opportunities
CREATE TABLE IF NOT EXISTS public.clustering_opportunities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamp DEFAULT now(),
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
  locations jsonb
);

-- Clustering results
CREATE TABLE IF NOT EXISTS public.clustering_results (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  business_category varchar NOT NULL,
  num_clusters integer NOT NULL,
  recommended_latitude double precision NOT NULL,
  recommended_longitude double precision NOT NULL,
  recommended_zone_type varchar NOT NULL,
  confidence double precision NOT NULL,
  opportunity_level varchar NOT NULL,
  total_businesses integer NOT NULL,
  competitor_count integer NOT NULL,
  competitors_within_500m integer NOT NULL,
  competitors_within_1km integer NOT NULL,
  competitors_within_2km integer NOT NULL,
  market_saturation double precision NOT NULL,
  nearest_competitor_distance double precision,
  clusters_data json NOT NULL,
  nearby_businesses json NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  uid uuid PRIMARY KEY,
  email varchar NOT NULL UNIQUE,
  hashed_password varchar,
  is_active boolean DEFAULT true,
  is_superuser boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  username varchar,
  phone_number varchar,
  gender varchar,
  date_of_birth date,
  first_name varchar,
  last_name varchar,
  address varchar,
  age integer
);
