# Talkingston V1 — API Specifications

This document defines the RESTful endpoints, Server Action contracts, Supabase Realtime channels, and Zod payload schemas for Talkingston V1.

---

## 1. Authentication & Onboarding Endpoints

### 1.1 `POST /api/auth/onboarding`
Finalizes user profile and initial companion configuration.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body (Zod: `OnboardingSchema`)**:
```typescript
{
  username: string; // 3-24 alphanumeric + underscores
  displayName: string; // 1-50 chars
  bio?: string;
  interests: string[];
  companion: {
    name: string;
    personality: 'Quiet' | 'Balanced' | 'Friendly' | 'Witty' | 'Very Playful';
    proactivity: 'Off' | 'Low' | 'Normal' | 'High';
    customInstructions?: string;
  }
}
```
- **Response `200 OK`**:
```typescript
{
  success: true,
  profile: Profile,
  companion: CompanionSettings
}
```

---

## 2. AI Companion & Memory API

### 2.1 `POST /api/chat/completions`
Streams a companion response through the **AI Context Engine**.
- **Request Body (Zod: `ChatCompletionSchema`)**:
```typescript
{
  conversationId: string; // UUID
  message: string;
  roleMode?: 'Companion' | 'Commentator' | 'Referee' | 'Quizmaster' | 'Tutor';
  projectId?: string; // Optional context
}
```
- **Response**: Server-Sent Events (SSE) stream of token chunks.
- **Processing Steps**:
  1. Authenticate user.
  2. Assemble 9 context vectors via `AiContextEngine.buildContext()`.
  3. Dispatch to configured `AiProvider`.
  4. Stream response to client.
  5. Async task: Extract facts/preferences and upsert into `user_memories`.

### 2.2 `GET /api/memories`
Fetches user memories with optional semantic filtering.
- **Query Params**: `query` (optional string), `category` (optional string), `limit` (default: 20).
- **Response `200 OK`**: Array of `UserMemory` objects.

### 2.3 `DELETE /api/memories/:id`
Permanently deletes a specific memory.
- **Response `200 OK`**: `{ success: true }`.

### 2.4 Implemented Pass 2 Conversation Routes

- `GET /api/conversations`: Lists conversations owned by the authenticated user.
- `POST /api/conversations`: Creates a companion conversation.
- `GET /api/conversations/:id`: Loads an owned conversation and its messages.
- `PATCH /api/conversations/:id`: Renames or pins an owned conversation.
- `DELETE /api/conversations/:id`: Deletes an owned conversation.
- `POST /api/chat/completions`: Validates the conversation and message, assembles the nine context vectors, invokes the configured provider, streams SSE chunks, persists the assistant response, and extracts explicit memories.

All routes derive ownership from the authenticated Supabase session rather than request payloads.

### 2.5 Pass 3 Routing and History

- `GET /api/conversations?page=&limit=` lists recent non-archived conversations with project IDs and message counts.
- `PATCH /api/conversations/:id` supports rename, pin, archive, and project association.
- `GET /api/conversations/search?q=&page=&limit=` searches owned conversation titles and message snippets with validation and bounded result ranges.
- `POST /api/chat/completions` accepts an optional validated `projectId`; the server verifies it matches the owned conversation before adding project context.

The chat route uses the provider router and task category `companion_chat`; provider names and keys are not returned to the client.

---

## 3. Authoritative Whot Game API

> **Rule**: All game moves, card checks, turn progression, and penalties are validated authoritatively in pure TypeScript on the server. The AI never determines legal moves, turns, penalties, or winners.

### 3.1 `POST /api/games/whot/create`
Initializes a new Whot session.
- **Request Body**:
```typescript
{
  mode: 'single_ai' | 'multiplayer';
  opponentId?: string; // Required for 1v1 invite
}
```
- **Response `201 Created`**: Initial `WhotSession` state with player hand and active discard card.

### 3.2 `POST /api/games/whot/:sessionId/action`
Dispatches a player move.
- **Request Body (Zod: `WhotActionSchema`)**:
```typescript
{
  actionType: 'PLAY_CARD' | 'DRAW_CARD' | 'CALL_SUIT';
  cardIndex?: number; // Index in player's hand
  calledSuit?: 'Circle' | 'Triangle' | 'Cross' | 'Square' | 'Star'; // When playing card 20
}
```
- **Engine Processing**:
  1. Validates player turn.
  2. Validates card legality against discard card or called suit.
  3. Executes special card effects (1, 2, 5, 8, 14, 20).
  4. Updates turn state or calculates win conditions.
  5. Broadcasts state to Supabase Realtime channel `whot:<sessionId>`.
  6. If single-player AI mode, invokes deterministic AI heuristic bot.
- **Response `200 OK`**: Updated `WhotSession` state.

---

## 4. Trivia & Quiz API

### 4.1 `POST /api/trivia/quizzes/generate`
Generates a quiz from an uploaded document (PDF, TXT, or Markdown).
- **Request Body**: `multipart/form-data` with `file: File`, `numQuestions?: number`.
- **Validation**: File extension must be `.pdf`, `.txt`, or `.md`. Max size: 10MB.
- **Response `201 Created`**: Generated `TriviaQuiz` with structured questions.

### 4.2 `POST /api/trivia/rooms/create`
Creates a multiplayer quiz room.
- **Request Body**: `{ quizId: string, isPrivate?: boolean }`
- **Response `201 Created`**: `{ roomId: string, roomCode: string }`

### 4.3 `POST /api/trivia/rooms/:roomId/answer`
Submits a round answer for deterministic server scoring.
- **Request Body**:
```typescript
{
  questionId: string;
  selectedOptionIndex: number;
  timeRemainingMs: number;
}
```
- **Engine Processing**:
  - Compares selected option with authoritative question answer.
  - Applies formula: $\text{Base} + \text{SpeedBonus} \times \text{StreakMultiplier}$.
  - Broadcasts updated leaderboard via Supabase Realtime channel `quiz:<roomId>`.
- **Response `200 OK`**: `{ isCorrect: boolean, pointsAwarded: number, currentStreak: number }`

---

## 5. Social & Direct Messaging API

### 5.1 `GET /api/users/search?q=<query>`
Searches profiles by username or display name with debouncing.

### 5.2 `POST /api/friends/request`
Sends a friend request.
- **Request Body**: `{ targetUserId: string }`

### 5.3 `POST /api/friends/respond`
Accepts or declines a request.
- **Request Body**: `{ requestId: string, action: 'accept' | 'decline' }`

### 5.4 `POST /api/messages/direct`
Sends a direct message.
- **Request Body**: `{ recipientId: string, content: string }`
- **Realtime Channel**: `dm:<userA>:<userB>`

### 5.5 Implemented Pass 4 Social Routes

- `GET /api/users/search?q=&page=&limit=`: bounded authenticated search by public username or display name.
- `GET /api/users/:id`: returns public profile fields only.
- `GET /api/friends?status=`: lists the authenticated user's pending, accepted, or blocked relationships.
- `POST /api/friends`: sends a non-self friend request.
- `POST /api/friends/respond`: accepts or declines a pending request addressed to the authenticated user.
- `PATCH /api/friends/:id`: cancels, removes, blocks, or unblocks a relationship with server-side ownership checks.
- `GET|POST /api/messages/direct`: loads paginated messages for an authenticated participant pair or sends a message to an available recipient.
- `PATCH /api/messages/direct/:id`: marks a received message read.
- `GET|POST /api/groups`: lists the authenticated user's groups or creates a private group.
- `GET|PATCH|DELETE /api/groups/:id`: loads, edits, or deletes a group for authorized members/managers.
- `POST|DELETE /api/groups/:id/members`: invites an accepted friend or removes a member/leaves a group.
- `GET|POST /api/groups/:id/messages`: loads paginated group messages or sends a member message.

The browser subscribes to Supabase Realtime `postgres_changes` events for direct and group message inserts. The social invitation foundation validates Whot/Trivia invitation metadata in `lib/social/invitations.ts`; no game rooms or invitation notifications are implemented.

---

## 6. Projects & Productivity API

### 6.1 `GET /api/projects` / `POST /api/projects`
CRUD endpoints for projects.

### 6.1.1 Implemented Pass 3 project routes

- `GET /api/projects`: Lists the authenticated user's projects.
- `POST /api/projects`: Creates an owned project with validated name, description, and color.
- `GET /api/projects/:id`: Opens an owned project and its owned conversations.
- `PATCH /api/projects/:id`: Renames, edits description/color, or archives/restores.
- `DELETE /api/projects/:id`: Deletes an owned project.

### 6.2 `GET /api/tasks` / `POST /api/tasks` / `PATCH /api/tasks/:id`
CRUD endpoints for tasks (status, priority, due date).

### 6.3 `GET /api/notifications` / `PATCH /api/notifications/:id/read`
Lists and updates user notification statuses.

---

## 7. Realtime Channels Schema

| Channel Name | Purpose | Events |
|---|---|---|
| `whot:<sessionId>` | Live card moves, turns, commentary | `STATE_UPDATE`, `MOVE_PLAYED`, `COMMENTARY` |
| `quiz:<roomId>` | Quiz room countdown, answers, leaderboard | `ROUND_START`, `ANSWER_SUBMITTED`, `ROUND_END` |
| `dm:<chatId>` | 1-on-1 private messaging | `NEW_MESSAGE`, `TYPING`, `READ_RECEIPT` |
| `group:<groupId>` | Group collaboration and messages | `GROUP_MESSAGE`, `MEMBER_JOINED` |
| `user:<userId>` | Personal notifications and presence | `NOTIFICATION`, `FRIEND_STATUS` |
