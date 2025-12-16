---
description: Deep backend architecture, services, and data layer analysis
---

# Deep Backend Analysis

**ROLE**: Senior Backend Architect & System Engineer (15+ years experience). Mission-critical code review. Treat every file as production code that handles sensitive user data.

**SCOPE**: `lib/services/`, `lib/models/`, `lib/utils/`, `lib/env.dart`, `lib/app/`

---

## Phase 1: Services Layer Deep Dive

Analyze EVERY file in `lib/services/` one by one:

### For each service file, check:

**Architecture Patterns**
- [ ] Singleton pattern implemented correctly?
- [ ] Proper dependency injection or service locator pattern?
- [ ] Clear separation of concerns?
- [ ] No circular dependencies?

**State Management**
- [ ] ValueNotifier/ChangeNotifier used correctly?
- [ ] State mutations are atomic and predictable?
- [ ] No race conditions in async code?
- [ ] Proper disposal of resources?

**Error Handling**
- [ ] All async operations wrapped in try-catch?
- [ ] Errors logged with AppLog (not print)?
- [ ] Graceful degradation on failure?
- [ ] User-friendly error messages?
- [ ] No swallowed exceptions (empty catch blocks)?

**Security**
- [ ] No hardcoded credentials or API keys?
- [ ] User input sanitized before database queries?
- [ ] Proper RLS (Row Level Security) enforcement?
- [ ] Sensitive data not logged in production?

---

## Phase 2: Data Layer Analysis

### Supabase Integration (`lib/services/*_repository.dart`)
- [ ] All queries use proper `.eq('user_id', userId)` for RLS?
- [ ] No N+1 query problems (unnecessary loops)?
- [ ] Proper use of `.select()` to limit columns?
- [ ] Transactions used for multi-table operations?
- [ ] Connection errors handled gracefully?
- [ ] Offline fallback with local cache?

### Caching Strategy
- [ ] Cache invalidation logic is correct?
- [ ] Memory limits on cached data?
- [ ] Stale data detection?

---

## Phase 3: Models Analysis

### For each model in `lib/models/`:
- [ ] Immutable (uses `final` fields)?
- [ ] Proper `fromJson` / `toJson` serialization?
- [ ] Null safety properly handled?
- [ ] `copyWith` method for mutations?
- [ ] Equatable or proper `==` override if needed?

---

## Phase 4: Utilities Analysis

### For each utility in `lib/utils/`:
- [ ] Pure functions where possible?
- [ ] No side effects in helper functions?
- [ ] Proper documentation on public APIs?
- [ ] Edge cases handled?

---

## Phase 5: Environment & Bootstrap

### `lib/env.dart`
- [ ] Supabase client configured correctly?
- [ ] Environment variables loaded securely?
- [ ] No secrets in source code?

### `lib/app/` (Bootstrap, Constants)
- [ ] Initialization order is correct?
- [ ] No blocking operations on main thread?
- [ ] Permission checks early in flow?

---

## Phase 6: Performance Audit

- [ ] No expensive operations on UI thread?
- [ ] Async operations properly awaited?
- [ ] Memory leaks (listeners not cleaned up)?
- [ ] Proper use of `compute()` for heavy work?

---

## Phase 7: Code Quality Patterns

Search for anti-patterns:
```
grep_search: print(
grep_search: TODO|FIXME|HACK
grep_search: catch (_) {}
grep_search: await Future.delayed (unnecessary delays?)
grep_search: setState(() {}) (empty setState)
```

---

## Deliverable

Create a comprehensive report with:

### 🔴 Critical (Must Fix Immediately)
Security vulnerabilities, data loss risks, crash bugs

### 🟡 High Priority (Fix Soon)
Performance issues, memory leaks, poor error handling

### 🟢 Recommendations (Improvements)
Code quality, refactoring opportunities, best practices

### 📊 Metrics
- Files analyzed
- Issues by severity
- Code health score (A-F)

---

## Files to Analyze

```
lib/services/
├── admin_service.dart
├── analytics_service.dart
├── auth_service.dart
├── connection_monitor.dart
├── export_queue.dart
├── notification_scheduler.dart
├── offline_cache_service.dart
├── offline_queue.dart
├── profile_cache.dart
├── reminders_repository.dart
├── scan_service.dart
├── schedule_repository.dart
├── schedule_service.dart
├── semester_service.dart
├── theme_controller.dart
├── user_scope.dart
└── user_settings_service.dart

lib/models/
lib/utils/
lib/app/
lib/env.dart
```

Read each file completely. Analyze line by line. Leave no stone unturned.
