---
description: Deep UI/UX, component, and page analysis for SSP React frontend
---

# Frontend Analysis Workflow

**ROLE**: Senior Frontend Engineer & React Expert. Mission-critical UI review. Every component must be polished and accessible.

**SCOPE**: `frontend/components/`, `frontend/pages/`, `frontend/styles/`

---

## Phase 1: Component Architecture

### For each component in `frontend/components/`:

**Code Quality**
- [ ] TypeScript types properly defined?
- [ ] Props interface documented?
- [ ] Default props where appropriate?
- [ ] Proper use of `useMemo` and `useCallback`?
- [ ] No unnecessary re-renders?

**React Patterns**
- [ ] Hooks follow rules of hooks?
- [ ] Dependencies arrays correct in useEffect?
- [ ] State lifted appropriately?
- [ ] Proper error boundaries?

---

## Phase 2: UI Component Library

### `frontend/components/ui/` (shadcn/ui)
- [ ] Components use consistent styling?
- [ ] Variants properly implemented?
- [ ] Accessible (keyboard/screen reader)?
- [ ] Dark mode support where needed?

### Custom Components
- [ ] Use design system tokens?
- [ ] No hardcoded colors or spacing?
- [ ] Responsive across breakpoints?

---

## Phase 3: Page Analysis

### For each page in `frontend/components/users/` and `frontend/components/admin/`:

**Layout**
- [ ] Consistent header/navigation?
- [ ] Proper loading states?
- [ ] Empty states handled?
- [ ] Error states user-friendly?

**User Experience**
- [ ] Clear visual hierarchy?
- [ ] Primary actions obvious?
- [ ] Confirmation for destructive actions?
- [ ] Form validation inline and helpful?

**Performance**
- [ ] Large lists virtualized?
- [ ] Images optimized?
- [ ] Code splitting where beneficial?

---

## Phase 4: Styling Audit

### `frontend/styles/` and inline styles
- [ ] CSS classes organized?
- [ ] No conflicting styles?
- [ ] Responsive design works?
- [ ] Animation performance (GPU-accelerated)?

---

## Phase 5: Accessibility (a11y)

- [ ] All interactive elements keyboard accessible?
- [ ] ARIA labels on icons and buttons?
- [ ] Color contrast meets WCAG AA?
- [ ] Focus indicators visible?
- [ ] Form inputs have labels?

---

## Phase 6: Pattern Searches

```
grep_search: console.log (remove for production)
grep_search: any (weak TypeScript typing)
grep_search: !important (CSS specificity issues)
grep_search: TODO|FIXME
grep_search: eslint-disable (disabled rules)
```

---

## Deliverable

### 🔴 Critical (Breaks Functionality)
Type errors, broken components, accessibility failures

### 🟡 High Priority (Visual Issues)
Styling inconsistencies, responsive breakage, dark mode issues

### 🟢 Recommendations (Polish)
Performance optimizations, code organization

### 🎨 Design Score
- Consistency: A-F
- Accessibility: A-F  
- Responsiveness: A-F
- Performance: A-F

### 📊 Files to Analyze
```
frontend/components/
├── ui/           (shadcn components)
├── users/        (user pages)
│   ├── OpportunitiesPage.tsx
│   ├── ClusteringPage.tsx
│   ├── DashboardPage.tsx
│   └── ...
├── admin/        (admin pages)
├── landing/      (public pages)
└── ...

frontend/styles/
├── globals.css
└── ...
```
