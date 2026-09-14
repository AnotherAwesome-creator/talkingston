export const whotSuits = ["circle", "triangle", "cross", "square", "star"] as const;
export type WhotSuit = typeof whotSuits[number];
export type CardSuit = WhotSuit | "whot";
export type WhotCard = { id: string; suit: CardSuit; value: number };
export type WhotPlayer = { id: string; hand: WhotCard[] };
export type WhotStatus = "lobby" | "active" | "finished";
export type WhotState = {
  id: string;
  players: WhotPlayer[];
  drawPile: WhotCard[];
  discardPile: WhotCard[];
  currentPlayer: number;
  direction: 1 | -1;
  pendingDraw: number;
  calledSuit: WhotSuit | null;
  status: WhotStatus;
  winnerId: string | null;
  lastAction: string | null;
  version: number;
};

export type WhotActionError = Error & { code: string };

const suitValues: Record<WhotSuit, number[]> = {
  circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross: [1, 2, 3, 5, 7, 8, 10, 11, 13, 14],
  square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star: [1, 2, 3, 4, 5, 7, 8],
};

export function createDeck(): WhotCard[] {
  const cards: WhotCard[] = [];
  for (const suit of whotSuits) {
    for (const value of suitValues[suit]) cards.push({ id: `${suit}-${value}-${cards.length}`, suit, value });
  }
  for (let index = 0; index < 4; index += 1) cards.push({ id: `whot-20-${index}`, suit: "whot", value: 20 });
  return cards;
}

function shuffle(cards: WhotCard[], random: () => number) {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function nextIndex(state: WhotState, index = state.currentPlayer, steps = 1) {
  return (index + state.direction * steps + state.players.length * 10) % state.players.length;
}

function topCard(state: WhotState) {
  return state.discardPile[state.discardPile.length - 1];
}

function assertPlayer(state: WhotState, playerId: string) {
  const index = state.players.findIndex((player) => player.id === playerId);
  if (index < 0) throw actionError("PLAYER_NOT_IN_GAME", "Player is not in this game.");
  return index;
}

function actionError(code: string, message: string): WhotActionError {
  return Object.assign(new Error(message), { code });
}

export function createGame(id: string, playerIds: string[], random = Math.random): WhotState {
  if (playerIds.length < 2 || playerIds.length > 4 || new Set(playerIds).size !== playerIds.length) throw new Error("Whot games require 2 to 4 unique players.");
  const deck = shuffle(createDeck(), random);
  const players = playerIds.map((playerId) => ({ id: playerId, hand: deck.splice(0, 5) }));
  let opening = deck.pop() as WhotCard;
  while ([1, 2, 5, 8, 14, 20].includes(opening.value) && deck.length) {
    deck.unshift(opening);
    opening = deck.pop() as WhotCard;
  }

  return { id, players, drawPile: deck, discardPile: [opening], currentPlayer: 0, direction: 1, pendingDraw: 0, calledSuit: null, status: "active", winnerId: null, lastAction: "GAME_STARTED", version: 1 };
}

export function startGame(state: WhotState) {
  if (state.status !== "lobby") throw actionError("INVALID_STATUS", "This game has already started.");
  if (state.players.length < 2) throw actionError("NOT_ENOUGH_PLAYERS", "At least two players are required.");
  if (state.players.some((player) => player.id.startsWith("waiting:"))) throw actionError("NOT_ENOUGH_PLAYERS", "All seats must be joined before starting.");
  state.status = "active";
  state.lastAction = "GAME_STARTED";
  state.version += 1;
  return state;
}

export function rematchGame(state: WhotState, random = Math.random) {
  return createGame(state.id, state.players.map((player) => player.id), random);
}

export function getLegalMoves(state: WhotState, playerId: string) {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || state.status !== "active" || state.players[state.currentPlayer].id !== playerId) return [];
  if (state.pendingDraw) return player.hand.filter((card) => card.value === topCard(state).value);
  const top = topCard(state);
  return player.hand.filter((card) => card.suit === "whot" || (state.calledSuit ? card.suit === state.calledSuit : card.suit === top.suit || card.value === top.value));
}

function advance(state: WhotState, steps = 1) {
  state.currentPlayer = nextIndex(state, state.currentPlayer, steps);
}

export function drawCard(state: WhotState, playerId: string, count = 1) {
  if (state.status !== "active" || state.players[state.currentPlayer].id !== playerId) throw actionError("NOT_YOUR_TURN", "It is not this player's turn.");
  const drawCount = state.pendingDraw || count;
  if (!Number.isInteger(drawCount) || drawCount < 1) throw actionError("INVALID_DRAW_COUNT", "Draw count must be positive.");
  const player = state.players[state.currentPlayer];
  if (state.pendingDraw === 0 && getLegalMoves(state, playerId).length > 0) {
    throw actionError("LEGAL_MOVE_AVAILABLE", "Play a legal card before drawing.");
  }
  const cardsDrawn = Math.min(drawCount, state.drawPile.length);
  for (let index = 0; index < drawCount; index += 1) {
    if (!state.drawPile.length) break;
    player.hand.push(state.drawPile.pop() as WhotCard);
  }
  state.pendingDraw = 0;
  state.calledSuit = null;
  state.lastAction = `DRAW_${cardsDrawn}`;
  advance(state);
  if (!state.drawPile.length && state.players.every((entry) => entry.hand.length > 0)) state.status = "finished";
  if (state.status === "finished") state.winnerId = calculateWinner(state);
  state.version += 1;
  return player.hand.slice(-cardsDrawn);
}

export function playCard(state: WhotState, playerId: string, cardId: string, calledSuit?: WhotSuit) {
  const playerIndex = assertPlayer(state, playerId);
  if (playerIndex !== state.currentPlayer || state.status !== "active") throw actionError("NOT_YOUR_TURN", "It is not this player's turn.");
  const player = state.players[playerIndex];
  const cardIndex = player.hand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw actionError("CARD_NOT_IN_HAND", "Card is not in the player's hand.");
  const card = player.hand[cardIndex];
  if (!getLegalMoves(state, playerId).some((legal) => legal.id === card.id)) throw actionError("ILLEGAL_CARD", "That card is not legal.");
  if (card.suit === "whot" && !calledSuit) throw actionError("SUIT_REQUIRED", "A Whot suit must be called.");
  player.hand.splice(cardIndex, 1);
  state.discardPile.push(card);
  state.pendingDraw = card.value === 2 ? (state.pendingDraw || 0) + 2 : card.value === 5 ? (state.pendingDraw || 0) + 3 : 0;
  state.calledSuit = card.suit === "whot" ? calledSuit ?? null : null;
  state.lastAction = card.suit === "whot" ? `WHOT_CALLED_${calledSuit}` : `PLAY_${card.value}`;
  if (!player.hand.length) {
    state.status = "finished";
    state.winnerId = playerId;
    state.lastAction = "CHECK_WIN";
  } else {
    if (card.value === 1) {
      state.currentPlayer = playerIndex;
    } else if (card.value === 8) {
      advance(state, 2);
    } else if (card.value === 14) {
      for (const other of state.players.filter((_, index) => index !== playerIndex)) if (state.drawPile.length) other.hand.push(state.drawPile.pop() as WhotCard);
      advance(state);
    } else advance(state);
    if (player.hand.length === 1) state.lastAction = "LAST_CARD";
    if (!state.drawPile.length && state.players.every((entry) => entry.hand.length > 0)) {
      state.status = "finished";
      state.winnerId = calculateWinner(state);
    }
  }
  state.version += 1;
  return card;
}

export function announceCheck(state: WhotState, playerId: string) {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || player.hand.length !== 1) throw actionError("INVALID_CHECK", "Check is only valid with one card remaining.");
  state.lastAction = "CHECK";
  state.version += 1;
}

export function chooseWhotSuit(state: WhotState, playerId: string, suit: WhotSuit) {
  const lastAction = state.lastAction;
  assertPlayer(state, playerId);
  if (topCard(state).suit !== "whot" || state.calledSuit || (!lastAction?.startsWith("WHOT") && !lastAction?.startsWith("PLAY_20")) || !whotSuits.includes(suit)) throw actionError("INVALID_SUIT", "A suit can only be chosen after playing Whot.");
  state.calledSuit = suit;
  state.lastAction = `WHOT_CALLED_${suit}`;
  state.version += 1;
}

export function applyEffect(state: WhotState) {
  const card = topCard(state);
  if (card.value === 8) advance(state, 2);
  else if (card.value === 14) advance(state);
  else if (card.value !== 1 && !state.pendingDraw) advance(state);
  state.version += 1;
}

export function calculateScore(hand: WhotCard[]) {
  return hand.reduce((total, card) => total + (card.suit === "star" ? card.value * 2 : card.value), 0);
}

export function calculateWinner(state: WhotState) {
  return [...state.players].sort((left, right) => calculateScore(left.hand) - calculateScore(right.hand) || left.hand.length - right.hand.length)[0]?.id ?? null;
}
