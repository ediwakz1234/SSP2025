# SSPTHESIS - Business Location Analytics Platform

A comprehensive web application for analyzing business landscapes, identifying opportunities, and making data-driven decisions using K-Means clustering and AI-powered recommendations.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.3.1-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.9-blue.svg)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

## ✨ Features

### User Features
- **Interactive Business Map** - Visualize business locations with clustering and heatmaps
- **K-Means Clustering Analysis** - Identify optimal business locations using machine learning
- **Opportunity Detection** - Find low-competition areas for new businesses
- **AI-Powered Recommendations** - Get intelligent business category suggestions
- **Analytics Dashboard** - Comprehensive data visualization and insights

### Admin Features
- **User Management** - Full CRUD operations for user accounts
- **Business Data Management** - Import, edit, and manage business records
- **Activity Monitoring** - Track user activities and system usage
- **Statistics Dashboard** - System-wide analytics and metrics

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS 4.x
- **UI Components**: Radix UI primitives
- **State Management**: Zustand
- **Charts**: Recharts
- **Maps**: Leaflet with React-Leaflet
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express 5
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT + Supabase Auth
- **AI Integration**: Google Gemini API

### DevOps
- **Deployment**: Vercel (Serverless)
- **CI/CD**: GitHub Actions
- **Containerization**: Docker

## 📁 Project Structure

```
SSPTHESIS/
├── backend/                    # Backend API server
│   ├── api/                    # API route handlers
│   │   ├── admin/              # Admin endpoints
│   │   ├── ai/                 # AI/ML endpoints
│   │   ├── analytics/          # Analytics endpoints
│   │   ├── auth/               # Authentication endpoints
│   │   ├── businesses/         # Business CRUD endpoints
│   │   ├── clustering/         # K-Means clustering endpoints
│   │   ├── map/                # Map data endpoints
│   │   ├── opportunities/      # Opportunity analysis endpoints
│   │   └── users/              # User management endpoints
│   ├── db/                     # Database scripts and migrations
│   ├── lib/                    # Shared utilities (JWT, bcrypt, supabase)
│   ├── ml/                     # Machine learning scripts (Python)
│   ├── services/               # Business logic services
│   ├── __tests__/              # Backend tests
│   ├── server.js               # Development server entry point
│   └── vercel.json             # Vercel deployment config
│
├── frontend/                   # React frontend application
│   ├── components/             # React components
│   │   ├── admin/              # Admin panel components
│   │   ├── auth/               # Authentication components
│   │   ├── landing/            # Landing page components
│   │   ├── shared/             # Shared/common components
│   │   ├── ui/                 # UI primitives (shadcn/ui style)
│   │   └── users/              # User dashboard components
│   ├── lib/                    # Frontend utilities
│   ├── types/                  # TypeScript type definitions
│   ├── utils/                  # Helper functions
│   ├── styles/                 # Global styles
│   ├── App.tsx                 # Main application component
│   └── main.tsx                # Application entry point
│
├── .github/                    # GitHub Actions workflows
├── docker/                     # Docker configuration
├── package.json                # Root package.json (monorepo orchestration)
└── README.md                   # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git**
- **Supabase Account** (for database)
- **Google AI API Key** (for Gemini integration)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ediwakz123/SSP2025.git
   cd SSPTHESIS
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```
   This installs dependencies for root, backend, and frontend.

3. **Set up environment variables**
   
   Copy the samples to locals and fill them (see [Environment Variables](#-environment-variables)):
   - `backend/.env.example` → `backend/.env.local`
   - `frontend/.env.example` → `frontend/.env.local`

4. **Start development servers**
   ```bash
   npm run dev
   ```
   This starts both frontend (http://localhost:5173) and backend (http://localhost:3000) concurrently.

> ⚠️ **Note**: Running `npm run dev` from `frontend/` or `backend/` folders directly is disabled. Always run from the project root.

## 🔐 Environment Variables

### Backend (`backend/.env`)

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Authentication
JWT_SECRET=your_jwt_secret_key_min_32_chars

# AI Integration
GEMINI_API_KEY=your_google_gemini_api_key

# Server Configuration (optional)
PORT=3000
NODE_ENV=development
```

For local npm runs, create `backend/.env.local` from `backend/.env.example` and add your real values (especially `GEMINI_API_KEY`, Supabase keys, and `JWT_SECRET`). The backend dev server and the Vercel-style API handlers now load both `.env` and `.env.local`, so the Gemini key is available without Vercel.

### Frontend (`frontend/.env`)

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# API Configuration (optional - defaults to proxy)
VITE_API_URL=http://localhost:3000
```

Frontend dev can use `frontend/.env.local` copied from `frontend/.env.example` to keep local overrides out of version control.

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### Business Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/businesses` | Get all businesses |
| GET | `/api/businesses/:id` | Get business by ID |
| POST | `/api/businesses` | Create new business |
| PUT | `/api/businesses/:id` | Update business |
| DELETE | `/api/businesses/:id` | Delete business |

### AI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/categories` | Get AI-suggested categories |
| POST | `/api/ai/recommendations` | Get location recommendations |
| POST | `/api/ai/business-recommendations` | Get detailed business analysis |
| POST | `/api/ai/validate_business` | Validate business idea |

### Clustering Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/clustering` | Run K-Means clustering analysis |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin authentication |
| GET | `/api/admin/stats` | Get system statistics |
| GET | `/api/users` | List all users |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Backend Tests Only
```bash
npm run test:backend
```

### Frontend Tests Only
```bash
npm run test:frontend
```

### Test Coverage
```bash
cd backend && npm run test:coverage
cd frontend && npm run test:coverage
```

## 🐳 Docker Deployment

### Build and Run with Docker Compose
```bash
docker-compose up --build
```

### Build Individual Images
```bash
# Backend
docker build -f docker/Dockerfile.backend -t sspthesis-backend .

# Frontend
docker build -f docker/Dockerfile.frontend -t sspthesis-frontend .
```

## ☁️ Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to `main` branch

### Manual Deployment

```bash
# Build frontend
cd frontend && npm run build

# The backend is serverless-ready with vercel.json
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Ediwakz123** - *Initial work* - [GitHub Profile](https://github.com/Ediwakz123)

---

<p align="center">
  Made with ❤️ for SSP Thesis Project
</p>
