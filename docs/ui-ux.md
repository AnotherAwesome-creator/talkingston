# Talkingston V1 — UI/UX Design System & Experience Guidelines

This document establishes the UI/UX design specifications, component guidelines, responsive layouts, motion standards, and accessibility principles for Talkingston V1.

---

## 1. Design Philosophy

Talkingston’s aesthetic is **refined modern dark-mode with glassmorphic accents**, tactile feedback, and expressive personality.
- **Companion-Centric**: Talkingston's presence is always accessible, visible through an ambient status indicator or companion dock.
- **Immediate & Fluid**: Animations feel organic and physical (via Framer Motion), avoiding sluggish transitions.
- **Responsive by Design**: Clean, ergonomic layouts optimized for single-handed mobile navigation (375px+) and expansive desktop productivity (1280px+).

---

## 2. Color System & Design Tokens

Tailwind CSS v4 variables configured in `app/globals.css`:

```css
:root {
  --background: #090a0f;
  --foreground: #f3f4f6;

  --card: #11131a;
  --card-foreground: #f3f4f6;
  --card-border: rgba(255, 255, 255, 0.08);

  --primary: #6366f1;       /* Indigo 500 */
  --primary-glow: rgba(99, 102, 241, 0.25);
  --primary-foreground: #ffffff;

  --secondary: #1e2230;
  --secondary-foreground: #e2e8f0;

  --accent: #ec4899;        /* Pink 500 */
  --accent-glow: rgba(236, 72, 153, 0.25);

  --muted: #181c28;
  --muted-foreground: #94a3b8;

  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;

  --radius: 0.75rem;
}
```

---

## 3. Responsive Layout Architecture

### 3.1 Mobile Layout (< 768px)
- **Navigation**: Bottom navigation bar with 5 primary anchors:
  1. `Companion` (Chat & AI Hub)
  2. `Games` (Whot & Trivia)
  3. `Social` (Friends & DMs)
  4. `Projects` (Tasks & Notes)
  5. `Profile` (Settings & Privacy)
- **Top Header**: Compact title with active Talkingston status avatar, notification bell, and search button.
- **Card Hand in Whot**: Fan-shaped swipeable drawer at the bottom of the screen with haptic-feel lift interactions.

### 3.2 Desktop Layout (>= 1024px)
- **Navigation**: Collapsible left sidebar with full navigation tree, pinned conversations, and quick companion role switcher.
- **Main Stage**: Multi-pane layout:
  - Left pane: Conversation / Room / Channel lists.
  - Center pane: Main interaction canvas (Chat stream, Whot card table, Quiz arena).
  - Right drawer (collapsible): Active project context, Companion Inspector, or Game Leaderboard.

---

## 4. Component State Standards

Every feature view MUST handle all four standard states:
1. **Loading State**: Subtle skeleton placeholders matching the layout dimensions with shimmer animation. Avoid full-screen blocking spinners.
2. **Empty State**: Purposeful, friendly illustrations or icons paired with an encouraging prompt and primary call-to-action button (e.g. "No games played yet. Challenge Talkingston to Whot!").
3. **Error State**: Non-blocking toast alerts or inline cards with human-readable error descriptions and a "Try Again" action button.
4. **Success State**: Clear micro-interactions (checkmark animation, gentle toast, or companion celebration message).

---

## 5. Talkingston Companion Expression Matrix

Talkingston displays expressive visual indicators based on active personality and activity:

| Personality | Ambient Glow | Expression Avatar | Commentary Tone |
|---|---|---|---|
| **Quiet** | Soft cool slate | Serene, neutral | Minimalist, concise observations |
| **Balanced** | Indigo | Attentive, calm | Supportive, clear, constructive |
| **Friendly** | Warm amber | Smiling, encouraging | Enthusiastic, congratulatory, uplifting |
| **Witty** | Electric violet | Smirking, mischievous | Sarcastic quips, clever wordplay |
| **Very Playful** | Bright magenta | High energy, animated | Dramatic reactions, memes, energetic banter |

---

## 6. Whot Card Game UI Specifications

- **Deck Visuals**: Distinct geometric shapes for the 5 suits (Circle, Triangle, Cross, Square, Star) and the bold card 20 (Whot) with rich contrast colors.
- **Interactions**:
  - Drag-and-drop onto the discard pile (using `@dnd-kit/core`).
  - Click-to-play with smooth physics arc using Framer Motion.
  - Suit Picker Modal: Smooth radial popup when playing Card 20.
  - Stacking Badge: Clear red counter on the discard pile when Pick 2 or Pick 3 penalties are stacked.
- **Audio/Haptic Cues**: Subtle audio clicks for card play, draw, and victory chimes (with master mute toggle).

---

## 7. Accessibility (a11y) Standards

- **Semantic HTML**: Proper landmark elements (`<main>`, `<nav>`, `<aside>`, `<header>`).
- **Keyboard Navigation**:
  - Full tab index traversal across card hands, form controls, and message inputs.
  - Arrow keys (`Left`/`Right`) to navigate card hands in Whot.
  - `Escape` key closes all active modals and drawers.
- **Contrast**: Minimum contrast ratio of 4.5:1 for normal text and 3:1 for large headings against background surfaces.
- **Screen Reader Support**: Meaningful `aria-label` attributes on icon-only buttons and live game status regions with `aria-live="polite"`.
