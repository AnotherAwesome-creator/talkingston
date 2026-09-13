# Talkingston V1 — Games Specification & Rulebook

This document defines the authoritative, deterministic rules for games included in Talkingston V1.

> [!IMPORTANT]
> **Deterministic Rule Guarantee**:
> All game state transitions, move validations, turn sequences, defensive penalty stacks, scoring formulas, and winner determinations are implemented in **pure TypeScript** executing authoritatively on the server.
>
> **The AI must NEVER determine legal Whot moves, turns, scores, penalties, or winners.**
> The AI acts exclusively as an opponent heuristic, commentator, or referee voice explaining the engine's deterministic results.
>
> **Chess is strictly NOT part of V1.**

---

## 1. Talkingston V1 Whot Ruleset

Rather than relying on informal or conflicting regional variations, Talkingston V1 establishes an explicit, authoritative, and deterministic Whot ruleset. This ruleset **must be explicitly specified and tested in unit test suites before any implementation is considered complete**.

### 1.1 The Deck Composition (54 Cards)
A standard Talkingston V1 Whot deck consists of 54 cards across 5 suits plus wild Whot cards:

| Suit | Symbol | Card Values in Suit | Total Cards in Suit |
|---|---|---|---|
| **Circles** | `○` | 1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14 | 12 |
| **Triangles** | `△` | 1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14 | 12 |
| **Crosses** | `✕` | 1, 2, 3, 5, 7, 8, 10, 11, 13, 14 | 10 |
| **Squares** | `□` | 1, 2, 3, 5, 7, 10, 11, 13, 14 | 9 |
| **Stars** | `★` | 1, 2, 3, 4, 5, 7, 8 | 7 |
| **Whot (Wild)**| `W` | 20 (Four copies) | 4 |
| **Total Deck** | | | **54 Cards** |

### 1.2 Game Setup & Dealing
1. **Player Count**: 2 to 4 players (Single-player vs Talkingston AI or Multiplayer).
2. **Initial Deal**: Each player is dealt exactly **5 cards**.
3. **Market Pile**: The remaining cards form the face-down draw pile ("The Market").
4. **Discard Pile**: The top card of the Market is turned face-up to start the discard pile.
   - If the starting card is a special action card (1, 2, 5, 8, 14, or 20), its special effect is ignored on the initial opening turn, or another non-special card is flipped if preferred.

### 1.3 Legal Play Rules
A card played by the active player is legal if and only if:
1. It matches the **suit** of the active discard card; OR
2. It matches the **number** of the active discard card; OR
3. It is a **Whot card (Card 20)**, which can be played on top of any card; OR
4. If a suit was called by a previous Whot card (20), the played card matches the **called suit** (or is another Whot card 20).

If a player has no legal card to play, they must perform a **Market Draw** (draw 1 card from the draw pile). If the drawn card is legal, they may choose to play it immediately or end their turn.

---

### 1.4 Special Action Cards & Mechanics

Talkingston V1 defines the following authoritative effects for special action cards:

#### Card 1 — "Hold On"
- **Effect**: The active player retains the turn and must play another legal card.
- In a 2-player match: Player plays again immediately.
- In a 3-4 player match: Turn remains with the active player.
- If the player cannot play another card after a Hold On, they draw from the market and the turn passes to the next player.

#### Card 2 — "Pick Two"
- **Effect**: The next player in turn sequence must draw **2 cards** from the market, unless they play another **Card 2** to defend.
- **Defensive Stacking**: If Player B plays another Card 2 on top of Player A's Card 2, the penalty accumulates (+2) to a total of 4 cards, which passes to Player C. Player C may defend with yet another Card 2 (+2 $\to$ 6 cards).
- When a player cannot defend with a Card 2, they must draw the full accumulated penalty count and forfeit their play for that turn.

#### Card 5 — "Pick Three"
- **Effect**: The next player in turn sequence must draw **3 cards** from the market, unless they play another **Card 5** to defend.
- **Defensive Stacking**: Stacks in increments of +3 (e.g., $3 \to 6 \to 9$).
- When a player cannot defend with a Card 5, they must draw the accumulated penalty count and forfeit their play.
- *(Note: Card 2 cannot defend against Card 5, and Card 5 cannot defend against Card 2).*

#### Card 8 — "Suspension"
- **Effect**: The next player's turn is skipped entirely. Play passes to the following player.

#### Card 14 — "General Market"
- **Effect**: **Every other player** (all players except the active player who played Card 14) must immediately draw **1 card** from the market pile.
- The active player's turn then concludes, and normal turn rotation continues with the next player.

#### Card 20 — "Whot" (Wild Card)
- **Effect**: Can be played on any card at any time.
- The player who plays Card 20 **must call a suit** (`Circle`, `Triangle`, `Cross`, `Square`, or `Star`).
- The next player is obligated to play a card matching the called suit, or another Card 20.

---

### 1.5 Winning Conditions & Announcements

1. **"Last Card"**: When a player has only 1 card remaining in their hand, the system automatically registers the "Last Card" status.
2. **"Check" (Victory)**: The first player to play their final card legally has emptied their hand, called "Check", and wins the game immediately!

### 1.6 Market Exhaustion & Star Penalty Scoring
If the Market pile is completely exhausted and no player has checked out:
1. Each remaining player's hand is tallied deterministically.
2. **Card Scoring Values**:
   - Standard cards (Circle, Triangle, Cross, Square): Count as their face value (e.g. Card 7 = 7 points, Card 10 = 10 points, Card 1 = 1 point).
   - **Star Cards**: Count as **DOUBLE their face value** (e.g. Star 1 = 2 pts, Star 4 = 8 pts, Star 7 = 14 pts, Star 8 = 16 pts).
   - **Whot Card (20)**: Counts as **20 points**.
3. **Winner**: The player with the **lowest total hand score** wins the match!
4. **Tie-Breaker**: In the event of a tie in points, the player with the fewer total number of remaining cards wins.

---

### 1.7 AI Opponent & Commentary Specifications

- **AI Bot Opponent**:
  - Operates on a pure heuristic scoring function: evaluates legal moves, prioritizes shedding high-value star cards, reserves Card 20 for emergencies, and tactically applies Pick 2/5 when opponents reach "Last Card".
  - Strictly forbidden from modifying or bypassing engine rules.
- **AI Commentator & Referee**:
  - Listens to deterministic engine event emissions (`HOLD_ON`, `PICK_TWO_STACKED`, `GENERAL_MARKET`, `WHOT_CALLED`, `LAST_CARD`, `CHECK_WIN`).
  - Delivers dynamic, personality-tailored banter (e.g., Witty: *"A General Market? You really woke up and chose chaos today."*).

---

## 2. Deterministic Trivia Engine

### 2.1 Question Specification
Each trivia question consists of:
```typescript
interface TriviaQuestion {
  id: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: [string, string, string, string]; // Exactly 4 options
  correctOptionIndex: 0 | 1 | 2 | 3;
  explanation: string;
}
```

### 2.2 Scoring Formula
All scores are validated on the server using deterministic arithmetic:
$$\text{BasePoints} = \begin{cases} 100 & \text{easy} \\ 150 & \text{medium} \\ 200 & \text{hard} \end{cases}$$

$$\text{SpeedBonus} = \left\lfloor \frac{\text{TimeRemainingMs}}{\text{TotalTimeMs}} \times 50 \right\rfloor$$

$$\text{StreakBonus} = \min(\text{CurrentStreak} \times 10, 50)$$

$$\text{TotalQuestionScore} = (\text{BasePoints} + \text{SpeedBonus} + \text{StreakBonus})$$

If an incorrect option is submitted or the round times out:
- $\text{Score} = 0$
- $\text{CurrentStreak} = 0$

### 2.3 Quiz Room Round Lifecycle
1. **Lobby**: Players join via room code; host starts the game.
2. **Question Display**: Question and 4 options displayed with a synchronized 15-second timer.
3. **Lockout**: Upon selection or timeout, the server evaluates answers deterministically.
4. **Reveal**: Correct answer and Talkingston Quizmaster commentary displayed for 4 seconds.
5. **Leaderboard**: Real-time rank calculation broadcast via Supabase Realtime.
6. **Podium**: Final score tabulation and winner announcement.
