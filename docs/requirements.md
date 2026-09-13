# Talkingston V1 — Product Requirements Document (PRD)

## 1. Executive Summary

**Talkingston** is an AI digital companion platform designed to serve as an engaging, proactive, and versatile presence in the user's digital life. Talkingston is **not merely a chatbot**—it is a companion, commentator, referee, quizmaster, tutor, and gaming opponent.

Talkingston combines:
- Natural conversational interaction with long-term semantic memory.
- Multi-archetype personality and configurable proactivity.
- Authoritative, deterministic games (Talkingston V1 Whot card game, Trivia, and document-to-quiz generation).
- Social collaboration (user discovery, friends, direct messaging, private groups).
- Personal productivity (projects, tasks, schedules, and reminders).
- Strict user data privacy and granular permissions.

---

## 2. Core Personas & Roles

Talkingston can act in multiple distinct operational roles depending on user intent and active context:
1. **Digital Companion**: Engaging daily conversation, check-ins, advice, empathetic listening, and shared memories.
2. **Commentator**: Observant, reactive live commentary during Whot card matches or Trivia competitions without affecting game rules or state.
3. **Referee**: Impartial, rule-explaining presence explaining rule infractions or turn results based on deterministic engine calculations.
4. **Quizmaster**: Energetic, engaging host running timed trivia rounds and multiplayer quiz rooms.
5. **Tutor**: Educational guide helping users study uploaded documents, explaining incorrect answers, and reinforcing concepts.
6. **Gaming Opponent**: Competent, heuristic AI playing against the user in Whot using deterministic game rules.

---

## 3. Detailed Functional Requirements

### 3.1 Authentication & Onboarding
- **FR-AUTH-01**: Users must be able to sign up and sign in using Supabase Auth (email/password with magic link/OAuth support).
- **FR-AUTH-02**: Session tokens must be securely stored in HTTP-only cookies managed via `@supabase/ssr`.
- **FR-ONB-01**: First-time users must be guided through an onboarding flow collecting:
  - Display name and unique handle (`@username`).
  - Biography and profile avatar.
  - Personal interests and study/work domains (tags).
- **FR-ONB-02**: During onboarding, users must configure their initial Talkingston companion:
  - Companion Name (default: "Talkingston").
  - Companion Avatar.
  - **Personality Archetype** (strictly chosen from):
    - `Quiet`: Measured, calm, reserved, speaks only when addressed with concise insight.
    - `Balanced`: Thoughtful, adaptive, helpful, polite, and well-rounded.
    - `Friendly`: Warm, encouraging, empathetic, conversational, and uplifting.
    - `Witty`: Sharp, humorous, clever banter, playful irony, and quick wit.
    - `Very Playful`: Highly energetic, teasing, meme-literate, dramatic, and enthusiastic.
  - **Proactivity Level** (strictly chosen from):
    - `Off`: Never initiates; speaks only in direct response to user messages.
    - `Low`: Infrequent, high-importance check-ins or due-date reminders.
    - `Normal`: Regular daily greetings, contextual check-ins, and activity suggestions.
    - `High`: Frequent engagement, proactive conversation starters, timely task nudge prompts, and game challenges.

### 3.2 Conversational AI & Memory Engine
- **FR-CHAT-01**: Users can conduct multi-turn conversations with Talkingston supporting markdown formatting and code highlighting.
- **FR-CHAT-02**: The system must maintain conversation sessions with full CRUD operations (create, rename, delete, clear, pin).
- **FR-CHAT-03**: Users must be able to perform full-text search across all previous conversation sessions and messages.
- **FR-MEM-01**: The system must automatically extract relevant facts, preferences, relationships, and user goals from conversations.
- **FR-MEM-02**: Memories must be indexed using `pgvector` embeddings alongside semantic tags for retrieval.
- **FR-MEM-03**: Users must have full transparency to view, search, edit, and delete any stored memory.
- **FR-MEM-04**: Conversational generation must pass through a first-class **AI Context Engine** before invoking any LLM provider.

### 3.3 Authoritative Whot Card Game
- **FR-WHOT-01**: The game must implement the authoritative **Talkingston V1 Whot Ruleset** (defined in `docs/games.md`).
- **FR-WHOT-02**: The game engine must be written in pure TypeScript and execute authoritatively on the server.
- **FR-WHOT-03**: **The AI must NEVER determine legal moves, turns, scores, penalties, or winners.**
- **FR-WHOT-04**: Modes:
  - **Single-Player vs Talkingston AI**: Talkingston plays as an opponent using deterministic heuristic evaluation.
  - **Real-Time Multiplayer vs Friends**: 2 to 4 players interacting in real time via Supabase Realtime channels.
- **FR-WHOT-05**: Talkingston must be available as an AI commentator reacting to game moves and referee explaining rules.

### 3.4 Trivia, Document Upload & Quiz Rooms
- **FR-TRIV-01**: Deterministic Trivia engine with verified question banks covering diverse categories (General Knowledge, Science, Pop Culture, History, Technology, and African History & Culture).
- **FR-TRIV-02**: Deterministic scoring based strictly on correct answers, countdown timer speed bonuses, and consecutive streak multipliers.
- **FR-DOC-01**: Document upload parser supporting **PDF**, **TXT**, and **Markdown** formats for V1.
- **FR-DOC-02**: Automated quiz generation transforming document contents into structured, validated multiple-choice quizzes with explanations.
- **FR-ROOM-01**: Live Quiz Rooms supporting solo play, 1v1 challenges, and group multiplayer competitions with synchronized round timers and real-time leaderboards.

### 3.5 Social Collaboration & Networking
- **FR-SOC-01**: User directory with instant search by username or display name.
- **FR-SOC-02**: Friend management: Send friend requests, accept, decline, block, remove, and view friend online presence.
- **FR-SOC-03**: 1-on-1 Direct Messaging with real-time message delivery and delivery indicators.
- **FR-SOC-04**: Private Groups: Create groups, manage member roles (Owner, Admin, Member), and share group chat.
- **FR-SOC-05**: In-Chat Game Invites: Direct dispatch of Whot and Quiz Room invitations within DMs and group chats.

### 3.6 Projects & Productivity
- **FR-PROJ-01**: Workspace management for projects with title, description, color tag, and status.
- **FR-PROJ-02**: Project linking: Associate specific chat sessions, notes, tasks, and reference documents with a project.
- **FR-TASK-01**: Task management supporting priorities (Low, Medium, High), due dates, and statuses (Todo, In Progress, Done).
- **FR-SCHED-01**: Basic schedule and reminder management with calendar and timeline views.
- **FR-NOTIF-01**: Global in-app notification center for friend requests, game invitations, group mentions, and task alerts.

### 3.7 Privacy & Permissions
- **FR-PRIV-01**: Users can toggle profile visibility (Public, Friends Only, Private).
- **FR-PRIV-02**: Granular controls over game invitations and group additions.
- **FR-PRIV-03**: Complete memory audit: View, export, and delete memories recorded by Talkingston.
- **FR-PRIV-04**: Account deletion: Immediate, permanent removal of personal data upon user confirmation.

---

## 4. Non-Functional Requirements (NFRs)

- **NFR-SEC-01**: Zero browser exposure of private API keys or service role credentials.
- **NFR-SEC-02**: Every database table must be protected by PostgreSQL Row Level Security (RLS).
- **NFR-SEC-03**: All untrusted inputs must be validated with Zod schemas at API and Server Action boundaries.
- **NFR-PERF-01**: Realtime gameplay state sync latency must stay under 150ms on standard broadband.
- **NFR-PERF-02**: Companion first-token streaming latency must stay under 1.2s on standard network conditions.
- **NFR-RESP-01**: Fully responsive layout across mobile screens (375px+), tablets (768px+), and desktops (1280px+).
- **NFR-A11Y-01**: High-contrast color modes, accessible ARIA labels, and full keyboard navigation for interactive widgets.

### Pass 3 delivered scope

Pass 3 implements bounded conversation history, owner-scoped conversation search, ordered multi-provider routing with health-aware fallback, and owned projects linked to conversations for context. Social, games, quizzes, automation, notifications, and advanced settings remain deferred.

### Pass 4 delivered scope

Pass 4 implements authenticated user discovery, public profile cards, friend requests and state management, private one-to-one messaging, private groups, group membership management, persistent social messages, and client-side Supabase Realtime subscriptions. A typed Whot/Trivia invitation foundation exists without game logic or notification delivery.

---

## 5. Scope Boundaries & Explicit Non-Goals (V1)

- **CHESS IS STRICTLY NOT PART OF V1**: No chess game engines, chess boards, or chess logic shall be introduced in V1.
- **DOCX is deferred**: Document-to-quiz V1 strictly supports PDF, TXT, and Markdown.
- **Voice/Audio Realtime**: Live audio duplex streaming is out of scope for V1; text streaming and animated expressions are used.
- **Alternative In-Memory Databases**: Supabase PostgreSQL is the authoritative persistence engine; no duplicate in-memory DB will be built.
