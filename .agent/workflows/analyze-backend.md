---
description: Deep backend API, services, and data layer analysis for SSP
---

# Backend Analysis Workflow

**ROLE**: Senior Backend Engineer & API Architect. Mission-critical code review for production systems handling sensitive business data.

**SCOPE**: `api/`, `schema.sql`, `frontend/lib/` (stores, supabase client)

---

## Phase 1: API Routes Analysis

### For each file in `api/ai/`:
- [ ] Error responses are consistent (JSON format)?
- [ ] All async operations wrapped in try-catch?
- [ ] Proper HTTP status codes returned?
- [ ] Request validation before processing?
- [ ] No sensitive data in error messages?
- [ ] CORS headers properly configured?

### AI Integration
- [ ] OpenAI/Gemini API keys from environment only?
- [ ] Rate limiting considerations?
- [ ] Proper prompt validation?
- [ ] Response parsing handles edge cases?

---

## Phase 2: Database Layer

### `schema.sql` Review
- [ ] All tables have proper primary keys?
- [ ] Foreign key constraints defined?
- [ ] Indexes on frequently queried columns?
- [ ] RLS policies for user data?
- [ ] No redundant columns across tables?

### Supabase Integration (`frontend/lib/supabase.ts`)
- [ ] Client initialized correctly?
- [ ] Auth session handling?
- [ ] No hardcoded credentials?

---

## Phase 3: State Management

### Zustand Stores (`frontend/lib/stores/`)
- [ ] Stores are properly typed?
- [ ] State updates are immutable?
- [ ] No unnecessary re-renders?
- [ ] Persistence where needed?
- [ ] Clean separation of concerns?

---

## Phase 4: Security Audit

Search for security issues:
```
grep_search: console.log (should use logger)
grep_search: TODO|FIXME|HACK
grep_search: password|secret|key (hardcoded?)
grep_search: catch { } (empty catch blocks)
```

---

## Phase 5: Performance

- [ ] No N+1 query patterns?
- [ ] Large data sets paginated?
- [ ] Expensive computations memoized?
- [ ] API responses cached where appropriate?

---

## Deliverable

### 🔴 Critical (Security/Data Loss)
API vulnerabilities, auth bypass, data exposure

### 🟡 High Priority (Fix Soon)  
Performance issues, error handling gaps

### 🟢 Recommendations
Code quality, refactoring opportunities

### 📊 Files to Analyze
```
api/
├── ai/
│   ├── business-recommendations.js
│   ├── categories.js
│   ├── detect-category.js
│   └── ...

frontend/lib/
├── supabase.ts
├── stores/
│   ├── kmeansStore.ts
│   └── ...

schema.sql
```
