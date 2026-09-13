# Talkingston V1 — Deployment Guide & Operational Runbook

This document details the deployment architecture, configuration steps, database migrations, and operations protocol for hosting Talkingston on Vercel and Supabase.

---

## 1. Hosting Architecture

```mermaid
flowchart LR
    User[Web & Mobile Browser] --> Cloudflare[Vercel Edge Network]
    Cloudflare --> NextServer[Next.js 16 App Server - Vercel]
    NextServer --> SupabaseDB[(Supabase PostgreSQL + pgvector)]
    NextServer --> SupabaseAuth[Supabase Auth Engine]
    NextServer --> AIAPI[AI Provider: Gemini / Claude / OpenAI]
    User -.->|WebSockets| SupabaseRT[Supabase Realtime Engine]
```

---

## 2. Environment Variables Configuration

### 2.1 Vercel Production Environment Settings
Set the following environment variables in the Vercel Project Dashboard:

```env
# App URL
NEXT_PUBLIC_APP_URL=https://talkingston.vercel.app

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1...

# AI Provider Configuration
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

---

## 3. Database Migration Runbook

### 3.1 Initial Setup on Supabase
1. Create a new Supabase project.
2. In the Supabase SQL Editor, verify extensions:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "vector";
   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
   ```
3. Run the migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_social_and_groups.sql`
   - `supabase/migrations/003_games_whot_trivia.sql`
   - `supabase/migrations/004_projects_tasks_notifications.sql`
   - `supabase/migrations/005_rls_policies.sql`

### 3.2 Realtime Publication Setup
Enable Realtime replication on the following tables in Supabase:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.whot_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

---

## 4. Verification & Health Check

1. Verify Next.js health endpoint: `GET /api/health` returns `200 OK`.
2. Check Supabase connection and vector extension availability.
3. Test Realtime WebSocket connection from the browser console.
4. Verify that non-authenticated requests to private tables are blocked by RLS.
