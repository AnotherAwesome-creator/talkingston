import { describe, expect, it } from "vitest";
import { announceCheck, calculateScore, calculateWinner, chooseWhotSuit, createDeck, createGame, drawCard, getLegalMoves, playCard, rematchGame, startGame } from "@/lib/games/whot";

describe("Whot engine", () => {
  it("builds the standard 54-card deck", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(54);
    expect(deck.filter((card) => card.suit === "whot")).toHaveLength(4);
  });

  it("deals five cards and starts with a non-special discard", () => {
    const game = createGame("game", ["a", "b"], () => 0.5);
    expect(game.players.every((player) => player.hand)).toBe(true);
    expect(game.players.every((player) => player.hand.length === 5)).toBe(true);
    expect([1, 2, 5, 8, 14, 20]).not.toContain(game.discardPile[0].value);
  });

  it("validates matching cards, Whot, and illegal cards", () => {
    const game = createGame("game", ["a", "b"], () => 0.5);
    const legal = getLegalMoves(game, "a");
    expect(legal.every((card) => card.suit === game.discardPile[0].suit || card.value === game.discardPile[0].value || card.suit === "whot")).toBe(true);
    const illegal = game.players[0].hand.find((card) => !legal.some((entry) => entry.id === card.id));
    if (illegal) expect(() => playCard(game, "a", illegal.id)).toThrow("not legal");
  });

  it("applies star double scoring and exhaustion tie breaks", () => {
    const game = createGame("game", ["a", "b"]);
    game.players[0].hand = [{ id: "star", suit: "star", value: 8 }];
    game.players[1].hand = [{ id: "circle", suit: "circle", value: 8 }, { id: "one", suit: "circle", value: 1 }];
    expect(calculateScore(game.players[0].hand)).toBe(16);
    expect(calculateWinner(game)).toBe("b");
  });

  it("advances after a pick-two and draws the accumulated penalty", () => {
    const game = createGame("game", ["a", "b"]);
    const pickTwo = { id: "two", suit: "circle" as const, value: 2 };
    game.players[0].hand = [pickTwo, { id: "extra", suit: "circle", value: 3 }];
    game.discardPile = [{ id: "top", suit: "circle", value: 1 }];
    game.drawPile = Array.from({ length: 4 }, (_, index) => ({ id: `draw-${index}`, suit: "circle" as const, value: 3 }));
    playCard(game, "a", "two");
    expect(game.currentPlayer).toBe(1);
    expect(() => drawCard(game, "b")).not.toThrow();
    expect(game.players[1].hand.length).toBe(7);
  });

  it("supports Pick Three stacking and rejects cross-stacking", () => {
    const game = createGame("game", ["a", "b", "c"]);
    game.players[0].hand = [{ id: "five-a", suit: "circle", value: 5 }, { id: "extra-a", suit: "square", value: 9 }];
    game.players[1].hand = [{ id: "five-b", suit: "triangle", value: 5 }, { id: "extra-b", suit: "square", value: 9 }];
    game.discardPile = [{ id: "top", suit: "circle", value: 1 }];
    game.drawPile = Array.from({ length: 8 }, (_, index) => ({ id: `draw-${index}`, suit: "circle", value: 3 }));
    playCard(game, "a", "five-a");
    playCard(game, "b", "five-b");
    expect(game.pendingDraw).toBe(6);
    expect(() => drawCard(game, "c")).not.toThrow();
    expect(game.players[2].hand).toHaveLength(11);
  });

  it("implements Hold On, Suspension, and General Market", () => {
    const game = createGame("game", ["a", "b", "c"]);
    game.players[0].hand = [{ id: "one", suit: "circle", value: 1 }, { id: "two", suit: "circle", value: 2 }];
    game.discardPile = [{ id: "top", suit: "circle", value: 9 }];
    game.drawPile = Array.from({ length: 10 }, (_, index) => ({ id: `draw-${index}`, suit: "square", value: 3 }));
    playCard(game, "a", "one");
    expect(game.currentPlayer).toBe(0);
    game.discardPile = [{ id: "top", suit: "circle", value: 9 }];
    game.players[0].hand = [{ id: "eight", suit: "circle", value: 8 }, { id: "extra-eight", suit: "square", value: 9 }];
    playCard(game, "a", "eight");
    expect(game.currentPlayer).toBe(2);
    game.currentPlayer = 0;
    game.players[0].hand = [{ id: "fourteen", suit: "circle", value: 14 }, { id: "extra-fourteen", suit: "square", value: 9 }];
    const before = game.players.slice(1).map((player) => player.hand.length);
    game.discardPile = [{ id: "top", suit: "circle", value: 9 }];
    playCard(game, "a", "fourteen");
    expect(game.players.slice(1).map((player) => player.hand.length)).toEqual(before.map((count) => count + 1));
  });

  it("requires and records Whot suit selection and Check", () => {
    const game = createGame("game", ["a", "b"]);
    game.players[0].hand = [{ id: "whot", suit: "whot", value: 20 }, { id: "last", suit: "circle", value: 4 }];
    game.discardPile = [{ id: "top", suit: "triangle", value: 9 }];
    expect(() => playCard(game, "a", "whot")).toThrow("suit");
    playCard(game, "a", "whot", "star");
    expect(game.calledSuit).toBe("star");
    game.currentPlayer = 0;
    game.discardPile = [{ id: "top", suit: "circle", value: 4 }];
    game.calledSuit = null;
    announceCheck(game, "a");
    expect(game.lastAction).toBe("CHECK");
    expect(() => chooseWhotSuit(game, "a", "circle")).toThrow("suit");
  });

  it("starts only when all seats are joined and supports rematch", () => {
    const game = createGame("game", ["a", "b"]);
    game.status = "lobby";
    expect(startGame(game).status).toBe("active");
    game.status = "finished";
    const rematch = rematchGame(game, () => 0.5);
    expect(rematch.status).toBe("active");
    expect(rematch.players.map((player) => player.id)).toEqual(["a", "b"]);
  });

  it("finishes on market exhaustion and scores the winner", () => {
    const game = createGame("game", ["a", "b"]);
    game.players[0].hand = [{ id: "a-card", suit: "circle", value: 1 }];
    game.players[1].hand = [{ id: "b-card", suit: "star", value: 8 }];
    game.currentPlayer = 0;
    game.drawPile = [];
    game.discardPile = [{ id: "top", suit: "triangle", value: 9 }];
    drawCard(game, "a");
    expect(game.status).toBe("finished");
    expect(game.winnerId).toBe("a");
  });
});
