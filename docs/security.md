# Talkingston V1 — Security & Privacy Architecture

Trivia answer rows enforce authenticated membership and actor identity. Active quiz responses omit correct answers and explanations. Document uploads are private, owner-prefixed, size-bounded, and limited to PDF, TXT, and Markdown; DOCX and arbitrary public file access are excluded. AI generation is invoked only after owner authorization and bounded extraction.

This document establishes the security policies, Row Level Security (RLS) matrix, threat model, input validation standards, and user privacy guarantees for Talkingston V1.

---

## 1. Security Principles & Threat Model

### 1.1 Core Principles
1. **Zero Client Trust**: All scores, game turns, card legality, group roles, friend authorizations, and memory queries are calculated or validated authoritatively on the server.
2. **AI Is Never Authoritative for Security or Rules**:
   - The AI must never determine permissions, access rights, ownership, or deterministic game outcomes.
3. **Defense in Depth**: Database Row Level Security (RLS), API-level Zod schemas, server-side authentication checks, and input sanitization operate in tandem.
4. **Zero Secret Leakage**: Private API keys (Supabase Service Role, OpenAI/Anthropic/Gemini keys) are strictly isolated to server runtimes and never exposed to the client bundle.

### 1.2 Threat Model & Mitigations

| Threat | Impact | Mitigation |
|---|---|---|
| **Forged Whot Card Plays / Spoofed Check Win** | Unauthorized win or corrupted game state | Pure TypeScript server-side state machine validates card ownership, discard match, and turn before applying state change. |
| **Tampered Trivia Scores / False Streaks** | Leaderboard corruption | Client submits only chosen option index and timestamp; server computes score from scratch. |
| **Unauthorized Data Access via Supabase Client** | Private messages or memories leaked | PostgreSQL RLS enabled on 100% of tables; default deny policy for unauthenticated operations. |
| **Prompt Injection into AI Context Engine** | Unintended companion behavior or system prompt leak | Context Engine sanitizes untrusted inputs; user-submitted text is cleanly encapsulated within user message blocks with strict boundary markers. |
| **Malicious Document Upload (PDF/TXT/MD)** | Server crashes or memory exhaustion | Strict file size limit ($\le 10\text{MB}$), MIME-type verification, and stream-based isolated parser execution. |

---

## 2. Row Level Security (RLS) Matrix

Every table in PostgreSQL enforces RLS with granular policy rules:

| Table Name | `SELECT` Policy | `INSERT` Policy | `UPDATE` Policy | `DELETE` Policy |
|---|---|---|---|---|
| `profiles` | `authenticated` (all users) | System trigger on `auth.users` | `auth.uid() = id` | Restricted (system trigger) |
| `companion_settings` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `user_memories` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `conversations` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `messages` | Exists in user conversation | Exists in user conversation | Disallowed | Exists in user conversation |
| `friendships` | User is participant | User is requester | User is participant | User is participant |
| `direct_messages` | User is sender or recipient | User is sender | `auth.uid() = recipient_id` (mark read) | Sender only |
| `groups` | User is member of group | Authenticated user | Group Owner or Admin | Group Owner only |
| `group_members` | User is member of group | Group Owner or Admin | Group Owner only | User self or Group Owner |
| `whot_sessions` | User is session participant | Authenticated user | Authoritative server role | Session creator |
| `quiz_rooms` | Public read or room member | Authenticated user | Room host | Room host |
| `projects` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `tasks` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `notifications` | `auth.uid() = user_id` | System / Server trigger | `auth.uid() = user_id` | `auth.uid() = user_id` |

---

## 3. Environment Variables & Secret Hygiene

Secrets are separated into public client variables and strictly protected server variables:

### Public Variables (`NEXT_PUBLIC_*`)
- `NEXT_PUBLIC_SUPABASE_URL`: Public Supabase Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anonymous Key (governed by RLS).
- `NEXT_PUBLIC_APP_URL`: Canonical web application URL.

### Private Server Variables (Never prefixed with `NEXT_PUBLIC_`)
- `SUPABASE_SERVICE_ROLE_KEY`: Elevated administrative key (used only in trusted server background workers).
- `AI_PROVIDER`: Default AI backend (`gemini`, `anthropic`, `openai`, `mock`).
- `GEMINI_API_KEY`: Google AI Studio API key.
- `ANTHROPIC_API_KEY`: Anthropic API key.
- `OPENAI_API_KEY`: OpenAI API key.

### 3.1 Implemented Credential Segregation (Stage 2A)
- **Browser Boundary**: `lib/supabase/client.ts` strictly references `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. It contains zero references to `SUPABASE_SERVICE_ROLE_KEY`.
- **Server Session Boundary**: `lib/supabase/server.ts` uses `createServerClient` with the public anon key and request cookies, representing the authenticated user without elevated permissions.
- **Admin Service Role Guard**: `lib/supabase/admin.ts` implements a runtime check throwing `SECURITY VIOLATION` if executed in a browser context (`typeof window !== 'undefined'`).
- **Zero Secrets in Repository**: Secrets are loaded locally via `.env.local` (which is confirmed ignored in `.gitignore`), and template placeholders only are in `.env.example`. Database migrations and tables remain uncreated until Stage 2B.

---

## 4. Input Validation Standards (Zod)

Every incoming API request, server action, and realtime payload is validated using Zod:
1. Strip unexpected fields (`.strict()`).
2. Enforce length limits on text fields (e.g. username 3-24 characters, message text $\le 4000$ characters).
3. Validate UUID formats on entity IDs.
4. Constrain enum values strictly (e.g., personality must strictly match the 5 allowed archetypes: `Quiet`, `Balanced`, `Friendly`, `Witty`, `Very Playful`).

---

## 5. User Privacy Controls

1. **Right to Inspect**: Users can view every piece of memory Talkingston has stored in `user_memories`.
2. **Right to Erase**: Immediate granular or complete memory deletion with instant database removal.
3. **Data Export**: Users can download a JSON export of their profile, conversation history, and project tasks.
4. **Profile Visibility**: Users can toggle visibility between `Public`, `Friends Only`, or `Private`.

## 6. Pass 2 AI and Memory Controls

- Provider adapters are server-only and read API keys from private environment variables. No provider SDK or key is imported by client components.
- Chat and memory routes call `auth.getUser()` and scope every conversation or memory query by the verified user ID.
- Chat input, conversation updates, memory query parameters, and provider structured output are validated with Zod.
- Context assembly caps recent history and memory count rather than sending the full database to a provider.
- Memory extraction is opt-in by signal: ordinary messages are not stored as long-term memory; only explicit preferences, goals, and useful facts are candidates.
- The tool registry is empty in Pass 2. No model output can execute external actions.

## 7. Pass 3 Routing and Project Controls

- Provider routing occurs only on the server. `AI_PROVIDER_ORDER` changes selection order but never exposes credentials.
- Retryable provider failures are the only failures eligible for fallback; process-local cooldowns limit repeated calls.
- Provider health is advisory and replaceable; authorization remains enforced by Supabase session checks and RLS.
- Project, conversation, and search routes derive ownership from `auth.getUser()` and apply owner filters to every query.
- Project context is fetched only by owned project ID and only attached to a conversation whose stored `project_id` matches.
- Search validates query length and applies bounded pagination; it does not return cross-user titles, messages, or snippets.

## 8. Pass 4 Social Controls

- User search requires an authenticated session, a minimum two-character query, bounded pagination, and returns only public profile fields.
- Friend requests reject self-targeting, duplicate pending/accepted relationships, and blocked targets. Accept/decline operations require the authenticated user to be the request recipient.
- Direct message reads require a valid participant pair and reject blocked or unavailable recipients. Sends derive `sender_id` from the verified session and never trust a client sender.
- Group metadata, members, and messages require membership. Only owners/admins manage membership or group metadata; only owners delete groups.
- Realtime subscriptions use the existing Supabase client and are removed during component cleanup. Realtime is not an authorization boundary; RLS and server route checks remain authoritative.
- Group invitations require an accepted friendship. No notification or game execution path is connected to invitations.
- `supabase/migrations/20260913210000_pass4_social.sql` repeats these boundaries in PostgreSQL RLS and adds check constraints for self relationships, friendship states, group roles, and message lengths. Realtime publication is limited to persisted social message tables; it is not treated as an authorization mechanism.
- Public discovery reads the `public_profiles` view, which exposes only `id`, `username`, `display_name`, `avatar_url`, and `bio`; the base `profiles` table allows row reads only for the profile owner. Database triggers prevent direct clients from changing DM participants/content or transferring group ownership.
- Whot room state is member-only through `whot_rooms`, `whot_players`, and `whot_events` RLS. API responses redact opponents' card identities. Card legality is enforced by the deterministic server engine; clients submit intent only. The Whot migration remains unapplied remotely until it is reviewed and run through the approved SQL workflow.
- Pass 7 owner surfaces enforce both application authorization (`owner_id`/`user_id` filters) and Supabase RLS. Privacy visibility is enforced by the `public_profiles` view; Realtime remains an update mechanism, not an authorization boundary.
