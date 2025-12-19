# Strategic Store Placement System - Technical Documentation

## 📋 Overview

**Project Title:** Strategic Store Placement: Optimizing Business Location Using K-Means Clustering in Sta. Cruz, Santa Maria, Bulacan

**Purpose:** A comprehensive web application for analyzing business landscapes, identifying strategic store locations, and making data-driven business placement decisions using K-Means clustering and AI-powered recommendations.

**Target Area:** Barangay Sta. Cruz, Santa Maria, Bulacan, Philippines

---

## ✨ Detailed System Features

### 1. K-Means Clustering Analysis

| Feature | Description |
|---------|-------------|
| **Automatic Optimal K Selection** | Uses the Elbow Method to automatically determine the optimal number of clusters (K = 2-6), eliminating guesswork |
| **K-Means++ Initialization** | Enhanced centroid initialization for faster convergence and better clustering results |
| **Real-time Visualization** | Interactive map displays cluster boundaries, centroids, and business distributions instantly |
| **Multi-factor Location Scoring** | Evaluates candidate locations based on road proximity, POI density, competitor pressure, and zone type |
| **Dynamic Confidence Calculation** | Provides 40-95% confidence scores based on cluster cohesion, competition, and location quality |
| **Geographic Validation** | Polygon-based validation ensures recommendations stay within Sta. Cruz barangay boundaries |

### 2. Interactive Map Display

| Feature | Description |
|---------|-------------|
| **Business Marker Clustering** | Automatically groups nearby business markers at low zoom levels for cleaner visualization |
| **Category Color Coding** | 6 distinct colors for different business categories (Retail, Services, Restaurant, Food & Beverages, Merchandising/Trading, Entertainment/Leisure) |
| **Zone Type Filtering** | Filter businesses by Commercial or Residential zones |
| **Business Directory Panel** | Scrollable list of all businesses with batch loading (10 per load) |
| **Click-to-View Details** | Interactive popups showing business name, category, street, and zone on marker click |
| **Map Reset Function** | One-click reset to default view and filters |
| **Boundary Constraints** | Map locked to Sta. Cruz area (14.8338-14.8413°N, 120.9518-120.9608°E) |

### 3. AI-Powered Features (Google Gemini Integration)

| Feature | Description |
|---------|-------------|
| **Business Idea Validation** | AI validates business ideas and detects prohibited/illegal activities |
| **Automatic Category Detection** | AI analyzes business ideas and suggests appropriate category |
| **Business Recommendations** | AI provides detailed business suggestions based on cluster analysis |
| **Location Insights** | AI-generated interpretations of competitor pressure and market conditions |
| **Report Generation** | AI-assisted generation of analysis reports in PDF and Excel formats |

### 4. User Dashboard Features

| Feature | Description |
|---------|-------------|
| **Real-time Statistics** | Total businesses, category distribution, and zone breakdown |
| **Activity Timeline** | Track recent user actions and analysis history |
| **Quick Actions** | One-click access to Map, Clustering, and Opportunities pages |
| **Category Distribution Charts** | Visual bar charts showing business category proportions |
| **Business Location Preview** | Mini-map showing business concentrations |

### 5. Clustering Analysis Page Features

| Feature | Description |
|---------|-------------|
| **Business Idea Input** | Text field for entering business concepts |
| **Category Selection Dropdown** | Manual override for business category selection |
| **Cluster Count Slider** | Option to manually set cluster count (auto-detected by default) |
| **Live Analytics Panel** | Real-time business presence and competitor pressure metrics at recommended location |
| **Competitor Analysis** | Shows competitors within 500m, 1km, and 2km radii |
| **Market Saturation Indicator** | Visual gauge showing market saturation level (Good/Moderate/Saturated) |
| **AI Recommendations Panel** | Displays AI-generated business suggestions with fit scores |
| **Export Options** | Download results as PDF, Excel, or CSV |
| **Session Persistence** | Clustering results persist across page navigation using Zustand |

### 6. Admin Panel Features

| Feature | Description |
|---------|-------------|
| **User Management** | Full CRUD operations for user accounts (view, edit, delete, suspend) |
| **Business Data Management** | Add, edit, delete, and toggle status of business records |
| **CSV Data Import** | Bulk upload business data via CSV file |
| **Data Export** | Download business data as JSON or CSV |
| **Model Training Trigger** | Manually retrain K-Means model after data updates |
| **Activity Logs Viewer** | Searchable, filterable logs of all user activities |
| **System Statistics** | Dashboard showing total users, businesses, and analyses |
| **Analytics Dashboard** | Charts showing user registrations, activity trends, and category distributions |

### 7. Data Analysis Features

| Feature | Description |
|---------|-------------|
| **Business Density Metrics** | Pre-computed density at 50m, 100m, and 200m radii |
| **Competitor Density Metrics** | Pre-computed competitor counts at 50m, 100m, and 200m radii |
| **Zone Encoding** | Numerical encoding of zone types for ML processing |
| **Street Popularity Scoring** | Business count per street used as traffic proxy |
| **Nearest Competitor Distance** | Haversine distance calculation to nearest competitor |
| **Cluster Cohesion Metrics** | Average distance of cluster members to centroid |

### 8. Export and Reporting Features

| Feature | Description |
|---------|-------------|
| **PDF Report Generation** | Professional reports with clustering results, maps, and recommendations |
| **Excel Export** | Detailed spreadsheets with all analysis data |
| **CSV Export** | Raw data export for external analysis |
| **Activity Log Export** | Admin export of user activity data |

### 9. Authentication & Security Features

| Feature | Description |
|---------|-------------|
| **JWT Authentication** | Secure token-based session management |
| **Role-Based Access Control** | Separate User and Admin permission levels |
| **Password Reset Flow** | Forgot password with email token verification |
| **Prohibited Content Detection** | Client-side and AI-based detection of illegal business ideas |
| **Row Level Security** | Supabase RLS policies for data protection |
| **Session Persistence** | "Remember Me" functionality for login |

### 10. Technical Features

| Feature | Description |
|---------|-------------|
| **Responsive Design** | Mobile-friendly interface using TailwindCSS |
| **Real-time Updates** | Supabase real-time subscriptions for live data |
| **Error Handling** | Graceful error messages and toast notifications |
| **Activity Logging** | Automatic tracking of user actions for analytics |
| **State Management** | Zustand stores for clustering session persistence |
| **API Rate Limiting** | Graceful handling of Gemini API quota limits |

---

## 📐 Scope and Delimitations

### Scope

This study aims to optimize strategic store placement in Sta. Cruz, Santa Maria, Bulacan, using K-Means clustering. Specifically, the system:

#### Geographic Scope
- **Primary Focus Area:** Barangay Sta. Cruz, Santa Maria, Bulacan, Philippines
- **Coordinate Boundaries:** 
  - Latitude: 14.8338°N to 14.8413°N
  - Longitude: 120.9518°E to 120.9608°E
- **Target Users:** Entrepreneurs, small business owners, and local business planners in the Santa Maria area

#### Functional Scope

| Area | Included Features |
|------|-------------------|
| **K-Means Clustering** | Automatic K selection (Elbow Method), K-Means++ initialization, cluster visualization, centroid calculation |
| **Business Analysis** | 6 business categories supported, competitor density analysis, market saturation calculation |
| **Map Visualization** | Interactive Leaflet maps, marker clustering, category filtering, zone filtering |
| **AI Integration** | Google Gemini for business validation, category detection, and recommendations |
| **User Management** | Registration, login, profile management, password reset |
| **Admin Functions** | User CRUD, business data CRUD, CSV import, activity logs, analytics |
| **Export Functions** | PDF, Excel, and CSV report generation |

#### Data Scope
- **Business Data Sources:** Publicly available registered business data from LGU Santa Maria and business registries
- **Categories Analyzed:** Retail, Services, Restaurant, Food & Beverages, Merchandising/Trading, Entertainment/Leisure
- **Zone Types:** Commercial and Residential zones

---

### Limitations

#### 1. Geographic Limitations

| Limitation | Impact |
|------------|--------|
| **Single Barangay Focus** | Results are specific to Sta. Cruz and may not generalize to other barangays or municipalities |
| **Boundary Constraints** | All recommendations are clamped to the defined barangay boundaries, which may exclude optimal locations just outside the area |
| **Static Boundaries** | The polygon boundaries are hardcoded and require code changes to update |

#### 2. Data Limitations

| Limitation | Impact |
|------------|--------|
| **Registered Businesses Only** | Analysis excludes informal, unregistered, or street vendors which may significantly affect market conditions |
| **Public Data Dependency** | Relies on publicly available data which may be incomplete, outdated, or inaccurate |
| **No Real-time Business Data** | Business data snapshot doesn't reflect daily closures, openings, or operational changes |
| **Limited Category Granularity** | Only 6 broad categories; sub-categories (e.g., "hardware store" vs "clothing store") are not distinguished |
| **Missing Demographic Data** | Population density, income levels, and foot traffic data are not directly incorporated |

#### 3. Algorithm Limitations

| Limitation | Impact |
|------------|--------|
| **K-Means Assumptions** | Assumes spherical clusters; may not capture complex cluster shapes |
| **K Range Restriction** | Optimal K is limited to 2-6 clusters; larger datasets may benefit from higher K values |
| **No Temporal Analysis** | Does not consider time-based factors (seasonal trends, time-of-day traffic) |
| **Euclidean Distance Proxy** | Haversine distance approximates walking/driving distance but ignores road networks and obstacles |
| **Random Initialization Variance** | Different runs may produce slightly different results due to K-Means++ randomization |

#### 4. Technical Limitations

| Limitation | Impact |
|------------|--------|
| **API Rate Limits** | Google Gemini API has quota limits; heavy usage may result in temporary service unavailability |
| **Browser Dependency** | Leaflet map requires modern browser with JavaScript enabled |
| **Internet Dependency** | Requires active internet connection for map tiles, AI features, and database access |
| **No Offline Mode** | All features require online connectivity |
| **Single Language** | Interface is English-only; no Filipino/Tagalog localization |

#### 5. Business Logic Limitations

| Limitation | Impact |
|------------|--------|
| **No Financial Analysis** | Does not consider rental costs, startup capital, or ROI calculations |
| **No Zoning Regulations** | Does not validate recommendations against actual municipal zoning laws or business permits |
| **Static Competitor Definition** | Competitors are defined by exact category match only; similar businesses (e.g., "Restaurant" vs "Food & Beverages") are not considered cross-competitors |
| **No Brand/Chain Analysis** | Treats all businesses equally regardless of brand strength or chain affiliation |
| **Simplified Traffic Model** | Uses business density as traffic proxy; actual pedestrian/vehicle traffic data is not available |

#### 6. User Experience Limitations

| Limitation | Impact |
|------------|--------|
| **Manual Data Entry** | Adding new businesses requires manual coordinate lookup |
| **No Mobile App** | Web-only interface; no native iOS/Android application |
| **Limited Customization** | Users cannot define custom categories or scoring weights |
| **English UI Only** | No multi-language support for Filipino-speaking users |

---

### Recommendations for Future Work

1. **Expand Geographic Coverage** - Include other barangays in Santa Maria or adjacent municipalities
2. **Integrate Real-time Data** - Connect to live business registry APIs for current data
3. **Add Demographic Layers** - Incorporate population density and income data from PSA
4. **Implement Road Network Analysis** - Use actual road distances instead of straight-line distance
5. **Add Financial Metrics** - Include rental cost estimates and startup budget calculations
6. **Mobile Application** - Develop native mobile apps for field use
7. **Multi-language Support** - Add Filipino/Tagalog interface option
8. **Advanced ML Models** - Explore DBSCAN or hierarchical clustering for complex cluster shapes

---



## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   User      │  │   Admin     │  │   Landing/Auth          │ │
│  │   Dashboard │  │   Portal    │  │   Pages                 │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                           │                                     │
│                    React + TypeScript + Vite                    │
│                    TailwindCSS + Shadcn/ui                      │
│                    Leaflet Maps                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP/REST
┌───────────────────────────▼─────────────────────────────────────┐
│                        API LAYER                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│  │  Auth   │ │Business │ │Clustering│ │   AI    │ │  Admin   │  │
│  │  APIs   │ │  APIs   │ │  APIs   │ │  APIs   │ │  APIs    │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └──────────┘  │
│                                                                 │
│                  Node.js + Express (Vercel Serverless)          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                       DATA LAYER                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Supabase                             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │   │
│  │  │businesses│ │  users   │ │clustering│ │activity_   │ │   │
│  │  │          │ │          │ │_results  │ │logs        │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │   │
│  │                   PostgreSQL + PostGIS                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               External Services                         │   │
│  │  ┌──────────────────┐  ┌────────────────────────────┐  │   │
│  │  │  Google Gemini   │  │  OpenStreetMap (Tiles)     │  │   │
│  │  │  AI API          │  │                            │  │   │
│  │  └──────────────────┘  └────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | UI Framework |
| | Vite | Build Tool |
| | TailwindCSS 4.x | Styling |
| | Shadcn/ui + Radix | UI Components |
| | Leaflet + React-Leaflet | Map Visualization |
| | Recharts | Data Charts |
| | Zustand | State Management |
| **Backend** | Node.js (ES Modules) | Runtime |
| | Express 5 | API Framework |
| | Python + scikit-learn | ML Training |
| **Database** | Supabase (PostgreSQL) | Primary Database |
| | PostGIS | Geospatial Queries |
| **AI** | Google Gemini API | Business Recommendations |
| **Auth** | JWT + Supabase Auth | Authentication |
| **Deploy** | Vercel (Serverless) | Hosting |

---

## 📊 Database Schema

### Core Tables

#### `businesses` - Enhanced Business Data
```sql
CREATE TABLE businesses (
  id SERIAL PRIMARY KEY,
  business_id INTEGER,
  business_name VARCHAR NOT NULL,
  general_category TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  street VARCHAR NOT NULL,
  zone_type VARCHAR NOT NULL,
  status TEXT DEFAULT 'active',
  zone_encoded INTEGER DEFAULT 0,
  business_density_50m INTEGER DEFAULT 0,
  business_density_100m INTEGER DEFAULT 0,
  business_density_200m INTEGER DEFAULT 0,
  competitor_density_50m INTEGER DEFAULT 0,
  competitor_density_100m INTEGER DEFAULT 0,
  competitor_density_200m INTEGER DEFAULT 0,
  cluster_id INTEGER,
  geom geometry(Point, 4326),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
```

#### `clustering_results` - User Analysis History
```sql
CREATE TABLE clustering_results (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(uid),
  business_category VARCHAR NOT NULL,
  num_clusters INTEGER NOT NULL,
  recommended_latitude DOUBLE PRECISION NOT NULL,
  recommended_longitude DOUBLE PRECISION NOT NULL,
  recommended_zone_type VARCHAR NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  opportunity_level VARCHAR NOT NULL,
  total_businesses INTEGER NOT NULL,
  competitor_count INTEGER NOT NULL,
  competitors_within_500m INTEGER NOT NULL,
  competitors_within_1km INTEGER NOT NULL,
  competitors_within_2km INTEGER NOT NULL,
  market_saturation DOUBLE PRECISION NOT NULL,
  clusters_data JSON NOT NULL,
  nearby_businesses JSON NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `users` - User Accounts
```sql
CREATE TABLE users (
  uid UUID PRIMARY KEY,
  email VARCHAR NOT NULL UNIQUE,
  hashed_password VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  username VARCHAR,
  phone_number VARCHAR,
  address VARCHAR,
  gender VARCHAR,
  date_of_birth DATE,
  age INTEGER,
  is_active BOOLEAN DEFAULT true,
  is_superuser BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `activity_logs` - User Activity Tracking
```sql
CREATE TABLE activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  user_email TEXT,
  details TEXT,
  status TEXT,
  context TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Business Categories

| Category | Description |
|----------|-------------|
| `Retail` | General retail stores |
| `Services` | Service-based businesses |
| `Restaurant` | Dining establishments |
| `Food & Beverages` | Cafes, milk tea shops, food stalls |
| `Merchandising / Trading` | Trading and wholesale |
| `Entertainment / Leisure` | Gaming, recreation |

---

## 🤖 K-Means Clustering Algorithm

### Algorithm Overview

The system implements a **smart K-Means clustering** algorithm optimized for business location analysis:

```
┌─────────────────────────────────────────────────────────────────┐
│                    K-MEANS PROCESS FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. LOAD DATA                                                   │
│     └─ Fetch all active businesses from Supabase                │
│                          ▼                                      │
│  2. OPTIMAL K SELECTION (Elbow Method)                          │
│     └─ Test K = 2, 3, 4, 5, 6                                   │
│     └─ Compute inertia for each K                               │
│     └─ Find elbow point (diminishing returns)                   │
│                          ▼                                      │
│  3. K-MEANS++ INITIALIZATION                                    │
│     └─ Select first centroid randomly                           │
│     └─ Select subsequent centroids with distance-weighted       │
│        probability (far points more likely)                     │
│                          ▼                                      │
│  4. CLUSTERING ITERATIONS (max 40)                              │
│     └─ Assign each business to nearest centroid                 │
│     └─ Recompute centroids as geographic mean                   │
│     └─ Repeat until convergence                                 │
│                          ▼                                      │
│  5. CLUSTER SCORING                                             │
│     └─ Traffic score = business density - competitor density    │
│     └─ Zone bonus for commercial areas                          │
│     └─ Street popularity factor                                 │
│                          ▼                                      │
│  6. CANDIDATE GENERATION                                        │
│     └─ Generate 6 candidate locations per cluster               │
│     └─ Add controlled jitter for variation                      │
│                          ▼                                      │
│  7. LOCATION SELECTION                                          │
│     └─ Score candidates by road proximity, POI density          │
│     └─ Penalize competitor proximity                            │
│     └─ Weighted random selection from top 3                     │
│                          ▼                                      │
│  8. CONFIDENCE CALCULATION                                      │
│     └─ Cluster cohesion (0-25%)                                 │
│     └─ Competitor distance (0-25%)                              │
│     └─ Road proximity (0-20%)                                   │
│     └─ POI density (0-15%)                                      │
│     └─ Random variance (±5%)                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Functions

#### Elbow Method (Optimal K Selection)
```typescript
function selectOptimalK(points: Business[]): number {
  const Ks = [2, 3, 4, 5, 6];
  const inertias = Ks.map((k) => computeInertia(points, k));
  
  // Find elbow point where improvement drops below 25% of first delta
  const deltas = [];
  for (let i = 1; i < inertias.length; i++) {
    deltas.push(inertias[i - 1] - inertias[i]);
  }
  
  const threshold = deltas[0] * 0.25;
  for (let i = 1; i < deltas.length; i++) {
    if (deltas[i] < threshold) return Ks[i];
  }
  return 6; // fallback
}
```

#### Traffic Score Calculation
```typescript
function computeTrafficScore(b: Business, streetStats: Record<string, number>): number {
  const streetPopularity = streetStats[b.street?.toLowerCase()] ?? 0;
  
  return (
    b.business_density_50m * 0.30 +
    b.business_density_100m * 0.20 +
    b.business_density_200m * 0.10 -
    b.competitor_density_50m * 0.25 -
    b.competitor_density_100m * 0.10 -
    b.competitor_density_200m * 0.05 +
    b.zone_encoded * 0.10 +
    streetPopularity * 0.15
  );
}
```

#### Market Saturation Interpretation
| Saturation | Status | Recommendation |
|------------|--------|----------------|
| 0-30% | 🟢 Good Opportunity | Low competition, suitable for entry |
| 31-60% | 🟡 Needs Planning | Moderate competition, differentiation needed |
| 61-100% | 🔴 Highly Saturated | High risk without competitive advantage |

### Geographic Constraints

The system constrains all analysis to Sta. Cruz, Santa Maria, Bulacan:

```typescript
const BRGY_BOUNDS = {
  minLat: 14.8338,   // South boundary
  maxLat: 14.8413,   // North boundary
  minLng: 120.9518,  // West boundary
  maxLng: 120.9608,  // East boundary
};
```

---

## 🔌 API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | User login (returns JWT) |
| `POST` | `/api/auth/forgot-password` | Request password reset |
| `POST` | `/api/auth/reset-password` | Reset password with token |
| `GET` | `/api/auth/verify` | Verify JWT token |

### Business Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/businesses` | Get all businesses |
| `GET` | `/api/businesses/:id` | Get business by ID |
| `POST` | `/api/businesses` | Create new business |
| `PUT` | `/api/businesses/:id` | Update business |
| `DELETE` | `/api/businesses/:id` | Delete business |

### Clustering Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/clustering?category=X` | Get businesses by category |

### AI Endpoints

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| `POST` | `/api/ai/categories` | AI category detection | `{ businessIdea: string }` |
| `POST` | `/api/ai/recommendations` | Location recommendations | `{ category: string, lat: number, lng: number }` |
| `POST` | `/api/ai/business-recommendations` | Detailed business analysis | `{ clusterId: number, category: string }` |
| `POST` | `/api/ai/validate-business` | Validate business idea | `{ businessIdea: string }` |
| `POST` | `/api/ai/generate-report` | Generate analysis report | `{ analysisData: object }` |
| `POST` | `/api/ai/generate-pdf` | Generate PDF report | `{ analysisData: object }` |
| `POST` | `/api/ai/generate-excel` | Generate Excel report | `{ analysisData: object }` |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/login` | Admin authentication |
| `GET` | `/api/admin/stats` | System statistics |
| `GET` | `/api/admin/users` | List all users |
| `PUT` | `/api/admin/users/:id` | Update user |
| `DELETE` | `/api/admin/users/:id` | Delete user |
| `GET` | `/api/admin/activity-logs` | Get activity logs |
| `GET` | `/api/admin/seed-data` | Get seed business data |
| `POST` | `/api/admin/upload-csv` | Upload business CSV |
| `GET` | `/api/admin/analytics/*` | Analytics endpoints |

---

## 🖥️ Frontend Components

### User Dashboard Components

| Component | Path | Description |
|-----------|------|-------------|
| `DashboardPage` | `/components/users/DashboardPage.tsx` | Main user dashboard with stats |
| `ClusteringPage` | `/components/users/ClusteringPage.tsx` | K-Means clustering analysis |
| `MapPage` | `/components/users/MapPage.tsx` | Interactive business map |
| `OpportunitiesPage` | `/components/users/OpportunitiesPage.tsx` | Business opportunities |
| `UserAnalyticsPage` | `/components/users/UserAnalyticsPage.tsx` | Personal analytics |
| `Profile` | `/components/users/Profile.tsx` | User profile management |

### Admin Components

| Component | Path | Description |
|-----------|------|-------------|
| `AdminPortal` | `/components/admin/AdminPortal.tsx` | Admin dashboard |
| `UserManagement` | `/components/admin/UserManagement.tsx` | User CRUD operations |
| `SeedDataManagement` | `/components/admin/SeedDataManagement.tsx` | Business data management |
| `ActivityLogsPage` | `/components/admin/ActivityLogsPage.tsx` | Activity log viewer |
| `AdminAnalyticsPage` | `/components/admin/AdminAnalyticsPage.tsx` | System analytics |

### Shared Components

| Component | Description |
|-----------|-------------|
| `ui/*` | Shadcn/ui primitives (Button, Card, Dialog, etc.) |
| `auth/*` | Authentication forms and guards |
| `landing/*` | Landing page components |

---

## 🗺️ Map Features

### Visualization Capabilities

1. **Marker Clustering** - Groups nearby markers at low zoom levels
2. **Category Color Coding** - Each category has distinct color
3. **Heatmaps** - Density visualization
4. **Boundary Constraints** - Map locked to Sta. Cruz area
5. **Interactive Popups** - Business details on click

### Category Colors

```typescript
const CATEGORY_COLORS = {
  "Food & Beverages": "#0ea5e9",     // Sky Blue
  "Retail": "#10b981",               // Green
  "Services": "#f59e0b",             // Amber
  "Merchandising / Trading": "#ef4444", // Red
  "Entertainment / Leisure": "#a78bfa", // Purple
  "Restaurant": "#475569",           // Slate
};
```

---

## 🔐 Security Features

### Authentication
- **JWT Tokens** - Secure session management
- **Supabase Auth** - OAuth and password authentication
- **Role-Based Access** - User vs Admin permissions
- **Password Hashing** - bcrypt encryption

### Data Protection
- **Row Level Security (RLS)** - Database-level access control
- **Input Validation** - Prohibited business idea detection
- **API Rate Limiting** - Gemini API quota management

### Prohibited Keywords Detection
```typescript
const PROHIBITED_KEYWORDS = [
  "spakol", "prostitution", "escort", "drugs", "narcotics",
  "gambling", "casino", "weapon", "firearm", "scam", "fraud"
];
```

---

## 📈 Analytics Features

### User Analytics
- Clustering analysis history
- Activity timeline
- Business category preferences

### Admin Analytics
- Total users and registrations
- Active clustering analyses
- Business category distribution
- Zone type breakdown
- Activity log statistics

### Export Formats
- **PDF** - Printable reports with jsPDF
- **Excel** - Data export with XLSX
- **CSV** - Raw data export

---

## 🚀 Deployment

### Environment Variables

**Backend (`backend/.env`):**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET=your_jwt_secret_min_32_chars
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
NODE_ENV=development
```

**Frontend (`frontend/.env`):**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:3000
```

### Development Commands

```bash
# Install all dependencies
npm run install:all

# Start development (frontend + backend)
npm run dev

# Run tests
npm test

# Build for production
cd frontend && npm run build
```

### Vercel Deployment

The system is configured for Vercel serverless deployment:
- Backend API routes in `backend/api/` directory
- Frontend static build from `frontend/dist/`
- Configuration in `vercel.json`

---

## 📚 SDG Alignment

This project supports the United Nations Sustainable Development Goals:

**SDG 8: Decent Work and Economic Growth**
- Promotes inclusive economic growth
- Supports small business development
- Enables data-driven entrepreneurship

**SDG 9: Industry, Innovation, and Infrastructure**
- Applies machine learning for local economic analysis
- Improves access to market insights for small enterprises
- Encourages technology adoption in business planning

---

## 📝 Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Nov 2024 | Initial release |

---

*Generated for SSP Thesis Project - Immaculate Conception I-College of Arts and Technology*
