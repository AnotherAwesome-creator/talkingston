# Talkingston V1 — Architecture Decision Records (ADRs)

This document records the foundational architectural decisions, rationale, alternatives considered, and trade-offs made for Talkingston V1.

---

## ADR-001: Pure TypeScript Deterministic Game Engines

### Status
Accepted

### Context
Talkingston incorporates games (Whot card game and Trivia) alongside an AI companion that can act as commentator, referee, or opponent. Generative AI models are non-deterministic, prone to hallucinations, and unsuitable for strict game rule arbitration, turn sequencing, card defense stacking, or scoring.

### Decision
All game logic (card legality, turn rotation, penalty stacking, exhaustion scores, tie-breakers, and trivia points) is implemented in **pure TypeScript** executing authoritatively on the server. The AI has **zero authority** to decide legal moves, turns, scores, penalties, or winners. The AI interacts with games solely by receiving deterministic event emissions (as commentator/referee) or selecting among engine-validated legal options (as heuristic bot).

### Consequences
- **Positive**: 100% bug-free rule compliance, cheat-proof multiplayer, instant deterministic testing, zero LLM token costs for basic gameplay.
- **Negative**: Requires rigorous upfront rule specification and unit testing before UI binding.

---

## ADR-002: First-Class AI Context Engine with 9 Context Vectors

### Status
Accepted

### Context
Talkingston is an AI digital companion that must recall facts, maintain an expressive personality, respect proactivity bounds, and understand user projects and games. Simply passing a raw user prompt to an LLM produces generic chatbot behavior without true companionship.

### Decision
Introduce a dedicated **AI Context Engine** as a first-class architectural layer. Before invoking any AI provider, the engine explicitly aggregates:
1. User Profile
2. User Preferences & Style
3. Talkingston Personality (`Quiet`, `Balanced`, `Friendly`, `Witty`, `Very Playful`)
4. Proactivity Level (`Off`, `Low`, `Normal`, `High`)
5. Relevant Memories (semantic `pgvector` + keyword search)
6. Conversation History
7. Project Context
8. Active Activity / Game Context
9. Permissions & Privacy Boundaries

### Consequences
- **Positive**: Contextually rich, consistent personality; zero hallucination of user preferences; strict adherence to proactivity and privacy limits.
- **Negative**: Adds a fast pre-processing step to query memories and format prompt templates.

---

## ADR-003: Common AI Provider Interface

### Status
Accepted

### Context
AI model APIs evolve rapidly. Relying on vendor-specific SDKs across application code creates tight coupling and vendor lock-in.

### Decision
Abstract all LLM interactions behind a unified `AiProvider` interface with interchangeable adapters: Google Gemini, Anthropic Claude, OpenAI, and a deterministic Test/Mock adapter.

### Consequences
- **Positive**: Seamless provider switching via a single environment variable (`AI_PROVIDER`); automated tests can run without real API keys or incurring costs.
- **Negative**: Features must conform to the lowest common denominator of supported capabilities.

---

## ADR-004: Supabase-First Persistence without Duplicate In-Memory DB

### Status
Accepted

### Context
Maintaining a parallel full in-memory database alongside Supabase creates state synchronization discrepancies, redundant code paths, and testing divergence.

### Decision
Use Supabase (PostgreSQL, pgvector, Auth, Realtime, Storage) as the real, authoritative persistence layer. No separate in-memory database architecture will be built. Minimal mocks/stubs exist strictly for isolated unit test fixtures.

### Consequences
- **Positive**: Single source of truth; identical behavior in development and production; clean architecture.
- **Negative**: Local developer testing requires either access to a Supabase project or focused unit tests mocking query results.

---

## ADR-005: Authoritative Talkingston V1 Whot Ruleset

### Status
Accepted

### Context
Whot has various regional and household variations across Nigeria and elsewhere (e.g., whether Card 2 and Card 5 stack, how Card 1 is handled in 2-player vs multiplayer, and whether Star penalties double).

### Decision
Establish an explicit, unambiguous **Talkingston V1 Whot Ruleset** documented in `docs/games.md` and verified by automated unit tests prior to implementation.

### Consequences
- **Positive**: Crystal-clear player expectations; no ambiguity in online multiplayer or AI bot logic.
- **Negative**: Players with different household rules must adapt to the documented ruleset.

---

## ADR-006: Document-to-Quiz Format Boundaries (PDF, TXT, Markdown)

### Status
Accepted

### Context
Users want to upload documents and study materials to generate quizzes. Supporting proprietary binary formats (DOCX, PPTX) adds heavy dependencies, binary parsing vulnerabilities, and edge cases.

### Decision
Limit V1 document-to-quiz support strictly to **PDF**, **TXT**, and **Markdown**. DOCX is explicitly deferred.

### Consequences
- **Positive**: Fast, lightweight, reliable parsing with minimal dependencies.
- **Negative**: Users with Word documents must export to PDF or copy-paste text for V1.

---

## ADR-007: Strict Exclusion of Chess from V1

### Status
Accepted

### Context
Chess is an intricate game requiring deep board logic, opening books, specialized AI evaluation engines, and large board assets.

### Decision
Chess is strictly excluded from Talkingston V1 to prioritize polish and depth on Whot, Trivia, and the AI Companion experience.

## ADR-008: Provider-Neutral Companion Boundary

### Status
Accepted

### Decision
All companion generation goes through `AiProvider`; application routes never call a vendor API directly. Gemini, Anthropic, OpenAI, and a deterministic mock adapter implement the boundary.

### Consequences
Provider credentials remain server-only and tests remain deterministic, while provider-specific streaming and structured-output differences are isolated to adapters.

## ADR-009: Explicit Memory Extraction

### Status
Accepted

### Decision
Short-term messages and long-term memories remain separate. Only explicit preference, goal, or useful-fact language becomes a memory candidate; ordinary messages are not stored as permanent memory.

## ADR-010: Ordered Provider Routing with Local Health

### Status
Accepted

### Decision
Each request selects one provider from configurable ordered candidates. Only retryable rate-limit or temporary-unavailable failures move to the next candidate. A small process-local health registry applies cooldowns and can be replaced by distributed infrastructure later.

## ADR-011: Projects as Context Ownership Boundaries

### Status
Accepted

### Decision
Projects are persisted in the documented `projects` table and linked with `conversations.project_id`. The context engine receives only the active owned project, never unrelated project records.

## ADR-012: Supabase-First Social Messaging

### Status
Accepted

### Decision
Friendships, direct messages, groups, members, and group messages use the documented Supabase tables. Server route handlers verify the authenticated user and relationship or group membership before every operation. Browser clients use Supabase Realtime Postgres changes only for delivery updates; they do not replace database authorization or persistence.

### Consequences
- **Positive**: The social system has one persistence and realtime architecture, while local tests can validate state transitions and duplicate-event handling without live credentials.
- **Negative**: Production requires deployment of the documented schema, RLS policies, indexes, and Realtime publication settings.
