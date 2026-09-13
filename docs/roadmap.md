# Talkingston V1 — Engineering Roadmap & Milestones

This document outlines the delivery plan, milestone dependencies, stage gating criteria, and acceptance checklists for Talkingston V1.

---

## Milestone Summary

| Milestone | Stage | Focus Area | Status | Gate Requirement |
|---|---|---|---|---|
| **M1** | Stage 1 | Master Documentation & Project Foundation | **In Progress** | 11 docs complete, dependencies installed, test harness active |
| **M2** | Stage 2 | Database Schema, Migrations & Supabase Client | Pending | SQL migrations applied, typed client verified, RLS in place |
| **M3** | Stage 3 | Auth, User Onboarding & Companion Personalization | Pending | Auth flow, multi-step onboarding, personality settings working |
| **M4** | Stage 4 | AI Context Engine, Provider Abstraction & Chat | Pending | 9 context vectors, memory extraction/retrieval, chat streaming |
| **M5** | Stage 5 | Pure TypeScript Authoritative Whot Engine | Pending | Deterministic Whot rules, AI bot, realtime multiplayer, tests |
| **M6** | Stage 6 | Deterministic Trivia, Doc-to-Quiz & Quiz Rooms | Pending | Trivia engine, PDF/TXT/MD parsing, multiplayer rooms |
| **M7** | Stage 7 | Social Hub (Users, Friends, DMs, Groups) | Pending | User search, friendships, real-time DMs, private groups |
| **M8** | Stage 8 | Projects, Productivity & Privacy Controls | Pending | Project workspaces, task boards, reminders, privacy center |
| **M9** | Stage 9 | Full Verification, Cross-Device Testing & Launch | Pending | All unit/integration tests pass, zero lint errors, build clean |

---

## Detailed Stage Gating Criteria

### Stage 1: Master Documentation & Project Foundation
- [x] All 11 master documentation files populated with complete technical specifications.
- [ ] Explicit Talkingston V1 Whot ruleset documented in `docs/games.md`.
- [ ] AI Context Engine (9 context vectors) fully specified in `docs/architecture.md`.
- [ ] Foundation packages (`@supabase/supabase-js`, `@supabase/ssr`, `zod`, `lucide-react`, `framer-motion`, `@dnd-kit/core`, `@dnd-kit/utilities`, `clsx`, `tailwind-merge`) installed.
- [ ] Testing framework (`vitest`, `@testing-library/react`, `@testing-library/dom`, `jsdom`, `@vitejs/plugin-react`) configured.
- [ ] Environment schema (`lib/env.ts`, `.env.example`) configured and verified.
- [ ] Typecheck (`tsc --noEmit`), lint (`next lint` / `eslint`), and test runner succeed.

### Stage 2: Database Schema, Migrations & Supabase Client
- [ ] SQL migration files created under `supabase/migrations/`.
- [ ] `pgvector` extension enabled and memory embeddings table created.
- [ ] Profiles, companion settings, conversations, messages, friendships, groups, whot games, trivia rooms, projects, tasks, and notifications schemas finalized.
- [ ] Authoritative Row Level Security (RLS) policies written and documented.
- [ ] Browser and SSR Supabase client wrappers implemented with cookie handling.

### Stage 3: Auth, User Onboarding & Companion Personalization
- [ ] Authentication pages (Sign In, Sign Up, Forgot Password).
- [ ] Onboarding wizard with handle uniqueness validation, interests selection, and avatar setup.
- [ ] Companion customization interface:
  - Exact personality choices: `Quiet`, `Balanced`, `Friendly`, `Witty`, `Very Playful`.
  - Exact proactivity choices: `Off`, `Low`, `Normal`, `High`.
- [ ] Companion preview card with reactive tone examples.

### Stage 4: AI Context Engine, Provider Abstraction & Companion Chat
- [ ] Pluggable `AiProvider` interface with adapters:
  - Gemini Adapter
  - Anthropic Adapter
  - OpenAI Adapter
  - Deterministic Test/Mock Adapter (zero-API-key local execution)
- [ ] First-Class **AI Context Engine** aggregating:
  1. Profile
  2. Preferences
  3. Personality
  4. Proactivity
  5. Relevant memories (pgvector + keyword)
  6. Conversation history
  7. Project context
  8. Active activity / game context
  9. Permissions
- [ ] Conversational streaming chat UI with session management and full-text search.

### Stage 5: Pure TypeScript Authoritative Whot Engine & Multiplayer
- [ ] Complete deterministic implementation of Talkingston V1 Whot Ruleset in pure TypeScript:
  - Deck generation (54 cards), dealing (5 cards/player), market pile, discard pile.
  - Card validation (suit or number match, or Whot 20).
  - Special cards: 1 (Hold On), 2 (Pick Two - stackable), 5 (Pick Three - stackable), 8 (Suspension), 14 (General Market), 20 (Whot - suit change).
  - Exhaustion scoring (Star cards count double).
- [ ] AI bot opponent with heuristic strategy.
- [ ] Live AI commentary and referee voice lines.
- [ ] Supabase Realtime channel integration for 2-4 player matches.
- [ ] Exhaustive Vitest test suite for all rules and edge cases.

### Stage 6: Deterministic Trivia, Document-to-Quiz & Quiz Rooms
- [ ] Deterministic Trivia engine with category question banks and streak multipliers.
- [ ] Document parser for PDF, TXT, and Markdown files.
- [ ] AI quiz generator producing structured multiple-choice questions with answer keys.
- [ ] Multiplayer Quiz Rooms with synchronized countdown timers and real-time leaderboards.

### Stage 7: Social Hub (Users, Friends, DMs, Private Groups)
- [ ] Debounced user directory search.
- [ ] Friend requests and status tracking.
- [ ] Direct messaging with optimistic updates and delivery receipts.
- [ ] Private group spaces with role management.
- [ ] In-chat game invitation cards.

### Stage 8: Projects, Productivity & Privacy Controls
- [ ] Project workspaces with attached chats, tasks, and notes.
- [ ] Kanban and list task board with priorities and due dates.
- [ ] Calendar schedule and reminder notifications.
- [ ] Comprehensive privacy dashboard (view/delete memories, profile visibility).

### Stage 9: Full Verification & Launch Readiness
- [ ] Full automated test suite passes (`npm run test`).
- [ ] Zero TypeScript errors (`tsc --noEmit`).
- [ ] Zero ESLint errors (`npm run lint`).
- [ ] Production build succeeds (`npm run build`).
- [ ] Responsive UI verified on mobile (375px), tablet (768px), and desktop (1280px+).
