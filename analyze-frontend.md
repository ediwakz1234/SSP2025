---
description: Deep UI/UX design, component, and screen analysis
---

# Deep Frontend UI/UX Analysis

**ROLE**: Senior UI/UX Designer & Flutter Expert (15+ years experience). Mission-critical design review. Every pixel matters. Every interaction must be seamless.

**SCOPE**: `lib/screens/`, `lib/ui/`, `lib/widgets/`

---

## Phase 1: Design System Audit

### `lib/ui/theme/tokens.dart`
- [ ] Color palette is cohesive and accessible?
- [ ] Typography scale is consistent (caption → display)?
- [ ] Spacing tokens follow 4px/8px grid system?
- [ ] Border radius tokens are uniform?
- [ ] Component sizes are well-defined?
- [ ] Dark mode colors have proper contrast?

### Design Token Usage
- [ ] ALL components use `AppTokens` (no hardcoded values)?
- [ ] Responsive scaling with `ResponsiveProvider`?
- [ ] No magic numbers for sizes/spacing?

---

## Phase 2: Component Library Analysis

### For EVERY file in `lib/ui/kit/`:

**Visual Consistency**
- [ ] Uses `AppTokens.spacing` for all padding/margins?
- [ ] Uses `AppTokens.typography` for all text styles?
- [ ] Uses `AppTokens.radius` for border radius?
- [ ] Uses `AppTokens.colors` or theme colors?
- [ ] Consistent icon sizes via `AppTokens.iconSize`?

**Responsive Design**
- [ ] Uses `ResponsiveProvider.scale(context)` for sizing?
- [ ] Uses `ResponsiveProvider.spacing(context)` for gaps?
- [ ] Layouts adapt to different screen sizes?
- [ ] Text doesn't overflow on small screens?

**Accessibility**
- [ ] Touch targets are at least 44x44 logical pixels?
- [ ] Color contrast meets WCAG AA (4.5:1 for text)?
- [ ] Interactive elements have proper feedback?
- [ ] Semantic labels for screen readers?

**Animation & Motion**
- [ ] Transitions use `AppMotionSystem` curves?
- [ ] Durations are consistent (200-300ms typical)?
- [ ] No jarring or abrupt animations?
- [ ] Loading states have smooth skeletons?

**Component Patterns**
- [ ] Stateless where possible?
- [ ] Proper use of `const` constructors?
- [ ] Clean separation of logic and presentation?
- [ ] Reusable and composable?

---

## Phase 3: Screen-by-Screen Analysis

### For EVERY screen in `lib/screens/`:

**Layout Structure**
- [ ] Uses `ScreenShell` or appropriate scaffold?
- [ ] Consistent header/navigation pattern?
- [ ] Proper safe area handling?
- [ ] Keyboard aware layouts?

**User Experience**
- [ ] Clear visual hierarchy?
- [ ] Obvious primary action?
- [ ] Logical information grouping?
- [ ] Appropriate empty states?
- [ ] Error states are helpful?
- [ ] Loading states are informative?

**Interaction Design**
- [ ] Buttons are clearly tappable?
- [ ] Form validation is inline and helpful?
- [ ] Confirmation for destructive actions?
- [ ] Undo/back options available?

**Performance**
- [ ] BuildContext scope is minimal?
- [ ] No unnecessary rebuilds?
- [ ] Large lists use `ListView.builder`?
- [ ] Images are properly cached?

---

## Phase 4: Navigation Flow Analysis

- [ ] Navigation is intuitive and predictable?
- [ ] Back button behavior is correct?
- [ ] Deep linking works properly?
- [ ] Modal sheets dismiss correctly?
- [ ] No orphan screens (unreachable)?

---

## Phase 5: Dark Mode & Theming

- [ ] All colors adapt to dark/light mode?
- [ ] No hardcoded Colors.white/black?
- [ ] Proper use of `colors.surface`, `colors.onSurface`?
- [ ] Images/icons have dark mode variants if needed?
- [ ] Accent color applies consistently?

---

## Phase 6: Typography Audit

- [ ] Heading hierarchy is clear (h1 > h2 > h3)?
- [ ] Body text is readable (14-16sp minimum)?
- [ ] Line height is comfortable (1.4-1.6)?
- [ ] Font weights create visual hierarchy?
- [ ] No more than 2-3 font weights per screen?

---

## Phase 7: Spacing & Layout Grid

- [ ] Consistent margins on containers?
- [ ] Vertical rhythm is maintained?
- [ ] Proper breathing room between elements?
- [ ] Cards/tiles have uniform padding?
- [ ] List items are evenly spaced?

---

## Phase 8: Micro-Interactions

- [ ] Button press states (hover, tap feedback)?
- [ ] Checkbox/switch animations are smooth?
- [ ] Pull-to-refresh feels natural?
- [ ] Skeleton loading is polished?
- [ ] Success/error feedback is clear?

---

## Pattern Searches

```
grep_search: hardcoded color (Colors.blue, Color(0xFF...))
grep_search: EdgeInsets.all(16) (should use spacing tokens)
grep_search: TextStyle( without AppTokens
grep_search: SizedBox(height: 8) (should use spacing)
grep_search: fontSize: (should use typography tokens)
```

---

## Deliverable

Create a comprehensive UI/UX report:

### 🔴 Critical (Breaks Design System)
Hardcoded values, inconsistent patterns, accessibility failures

### 🟡 High Priority (Visual Issues)
Spacing inconsistencies, typography problems, dark mode issues

### 🟢 Recommendations (Polish)
Animation improvements, micro-interaction enhancements

### 🎨 Design Score
- Consistency: A-F
- Accessibility: A-F
- Responsiveness: A-F
- Polish: A-F

---

## Files to Analyze

```
lib/ui/
├── theme/
│   └── tokens.dart
├── kit/
│   ├── auth_shell.dart
│   ├── brand_header.dart
│   ├── buttons.dart
│   ├── class_details_sheet.dart
│   ├── containers.dart
│   ├── entity_tile.dart
│   ├── instructor_finder_sheet.dart
│   ├── modal_shell.dart
│   ├── screen_shell.dart
│   ├── skeletons.dart
│   ├── snack_bars.dart
│   └── ... (all kit files)
└── widgets/

lib/screens/
├── auth/
├── dashboard/
├── schedules/
├── reminders/
├── settings/
├── scan/
├── account/
├── onboarding/
└── admin/
```

Read each file completely. Analyze every widget. Every `Text()`, every `Container()`, every `Padding()`. Leave no design decision unchecked.
