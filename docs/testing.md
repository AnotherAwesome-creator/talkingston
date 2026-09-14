# Talkingston V1 — Testing Strategy & Protocol

Pass 6 tests cover question schema validation, malformed options, timer-aware deterministic scoring, duplicate submissions, rankings, room locking/progression, supported document MIME types, bounded extraction, and generated quiz rejection.

This document defines the automated testing architecture, test harnesses, coverage criteria, and execution commands for Talkingston V1.

---

## 1. Testing Philosophy

Quality assurance in Talkingston rests on three tiers:
1. **Authoritative Pure Engine Unit Tests**: The deterministic game engines (Whot ruleset, Trivia scoring, Document parser) and the AI Context Engine are pure TypeScript modules with **100% test coverage targets**.
2. **Component & Integration Tests**: React component rendering, form validation, and multi-step onboarding flows tested via `@testing-library/react` and `jsdom`.
3. **End-to-End & Boundary Verification**: API contracts, route validation, and critical user journeys.

---

## 2. Test Harness Configuration

We use **Vitest** for fast, native TypeScript testing with `jsdom` for DOM emulation.

### 2.1 Configuration (`vitest.config.ts`)
- Path alias resolution matching `tsconfig.json` (`@/*` $\to$ `./*`).
- Glob pattern: `tests/**/*.test.ts` and `tests/**/*.test.tsx`.
- Environment: `jsdom` for component testing, `node` for pure logic.
- Isolated test execution preventing state leakage.

---

## 3. Mandatory Test Suites

### 3.1 Talkingston V1 Whot Ruleset Suite (`tests/unit/whot-engine.test.ts`)
Must exhaustively test:
- **Deck Composition**: Total 54 cards, correct counts per suit (Circle 12, Triangle 12, Cross 10, Square 9, Star 7, Whot 5).
- **Normal Play**: Legality of suit match and number match.
- **Illegal Move Rejection**: Playing a mismatched suit/number throws or returns an invalid status.
- **Card 1 (Hold On)**: Active player plays again; turn does not advance.
- **Card 2 (Pick Two)**:
  - Penalty of 2 cards dealt to the next player.
  - Defensive stacking: Defending Card 2 with another Card 2 accumulates penalty to 4 cards.
- **Card 5 (Pick Three)**:
  - Penalty of 3 cards dealt to the next player.
  - Defensive stacking: Increments penalty by +3.
  - Verification that Card 2 cannot defend against Card 5 and vice versa.
- **Card 8 (Suspension)**: Skips the immediately following player.
- **Card 14 (General Market)**: Every other player draws exactly 1 card; turn passes cleanly.
- **Card 20 (Whot)**: Wild card acceptance on any active card; sets called suit; forces next player to match called suit or play another Card 20.
- **Victory Condition**: Empty hand triggers "Check" and crowns the winner.
- **Exhaustion Scoring**:
  - Star cards count as double face value.
  - Whot cards count as 20 points.
  - Lowest score wins; tie-breaker resolved by fewest cards.

### 3.2 Deterministic Trivia Engine Suite (`tests/unit/trivia-engine.test.ts`)
- Correct answer score calculation.
- Speed bonus calculation according to remaining time.
- Streak multiplier scaling and streak reset upon incorrect answer or timeout.

### 3.3 AI Context Engine Suite (`tests/unit/ai-context-engine.test.ts`)
- Verifies that all 9 context vectors are correctly aggregated before invoking the AI provider.
- Verifies strict personality constraints (`Quiet`, `Balanced`, `Friendly`, `Witty`, `Very Playful`).
- Verifies strict proactivity constraints (`Off`, `Low`, `Normal`, `High`).

### 3.4 Zod Validation Suite (`tests/unit/validators.test.ts`)
- Tests onboarding payload validation.
- Tests Whot action validation.
- Tests direct messaging and trivia room payload schemas.

---

## 4. Test Commands

```bash
# Run all unit and integration tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage reporting
npm run test:coverage

# Run TypeScript type check
npx tsc --noEmit

# Run Next.js and ESLint code quality checks
npm run lint
```

## 5. Pass 2 AI Companion Tests

`tests/ai-companion.test.ts` covers deterministic provider behavior, malformed structured-output boundaries through schema validation, completeness of all nine context vectors, bounded context assembly, personality/proactivity context, explicit memory extraction, and keyword fallback ranking. These tests use the mock provider and require no live AI credentials.

## 7. Pass 4 Social Tests

`tests/social.test.ts` covers valid and invalid friendship transitions, duplicate realtime message protection, and Whot/Trivia invitation metadata validation without live Supabase or Realtime credentials. Social route handlers additionally enforce authenticated ownership and membership checks at the API boundary.

The migration is reviewed statically for social table constraints, RLS policy coverage, and Realtime publication entries. Live two-account RLS/Realtime verification remains environment-dependent because this repository does not contain a linked Supabase project configuration or integration-test credentials.

## 6. Pass 3 Tests

The same focused suite also covers provider fallback on rate limits, non-retryable failure stopping, process-local health failure tracking, and active-project context isolation. Supabase-backed history, search, and project routes use authenticated owner filters and are verified through the existing type/lint/build gates without live credentials.

Whot unit tests cover the 54-card deck, five-card dealing, legal/illegal card selection, and exhaustion scoring. Room API and cross-account Realtime tests require the Whot migration and multiple authenticated identities in the live project.
