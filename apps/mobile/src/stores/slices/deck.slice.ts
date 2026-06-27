import * as Crypto from 'expo-crypto';
import type { StateCreator } from 'zustand';
import type { Deck, DeckButton, Page } from '@/schemas';
import type { RootState } from '@/stores/store';

const DEFAULT_COLUMNS = 4;
const DEFAULT_ROWS = 6;

function emptyDeck(): Deck {
  return { id: Crypto.randomUUID(), name: 'My Deck', pages: [newPage()] };
}

const seed = emptyDeck();

export type DeckSlice = {
  decks: Deck[];
  currentDeckId: string | null;
  currentPageId: string | null;
  setCurrentDeck: (deckId: string) => void;
  setCurrentPage: (pageId: string) => void;
  addDeck: () => void;
  renameDeck: (deckId: string, name: string) => void;
  addPage: (deckId: string) => void;
  deletePage: (pageId: string) => void;
  reorderPage: (deckId: string, from: number, to: number) => void;
  addButton: (pageId: string, button: DeckButton) => void;
  editButton: (pageId: string, buttonId: string, patch: Partial<DeckButton>) => void;
  deleteButton: (pageId: string, buttonId: string) => void;
  reorderButton: (pageId: string, from: number, to: number) => void;
};

function mapPage(decks: Deck[], pageId: string, fn: (page: Page) => Page): Deck[] {
  return decks.map((deck) => ({
    ...deck,
    pages: deck.pages.map((page) => (page.id === pageId ? fn(page) : page)),
  }));
}

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined) return list;
  next.splice(to, 0, item);
  return next;
}

function newPage(): Page {
  return { id: Crypto.randomUUID(), columns: DEFAULT_COLUMNS, rows: DEFAULT_ROWS, buttons: [] };
}

export const createDeckSlice: StateCreator<RootState, [], [], DeckSlice> = (set) => ({
  decks: [seed],
  currentDeckId: seed.id,
  currentPageId: seed.pages[0]?.id ?? null,

  setCurrentDeck: (deckId) =>
    set((state) => {
      const deck = state.decks.find((d) => d.id === deckId);
      return { currentDeckId: deckId, currentPageId: deck?.pages[0]?.id ?? state.currentPageId };
    }),
  setCurrentPage: (pageId) => set({ currentPageId: pageId }),

  addDeck: () =>
    set((state) => {
      const deck = emptyDeck();
      return {
        decks: [...state.decks, deck],
        currentDeckId: deck.id,
        currentPageId: deck.pages[0]?.id ?? null,
      };
    }),

  renameDeck: (deckId, name) =>
    set((state) => ({
      decks: state.decks.map((deck) => (deck.id === deckId ? { ...deck, name } : deck)),
    })),

  addPage: (deckId) =>
    set((state) => {
      const page = newPage();
      return {
        decks: state.decks.map((deck) =>
          deck.id === deckId ? { ...deck, pages: [...deck.pages, page] } : deck,
        ),
        currentPageId: page.id,
      };
    }),

  // Never delete a deck's last page; reselect a sibling when the deleted page was current.
  deletePage: (pageId) =>
    set((state) => {
      let currentPageId = state.currentPageId;
      const decks = state.decks.map((deck) => {
        if (deck.pages.length <= 1 || !deck.pages.some((p) => p.id === pageId)) return deck;
        const pages = deck.pages.filter((p) => p.id !== pageId);
        if (pageId === state.currentPageId) currentPageId = pages[0]?.id ?? null;
        return { ...deck, pages };
      });
      return { decks, currentPageId };
    }),

  reorderPage: (deckId, from, to) =>
    set((state) => ({
      decks: state.decks.map((deck) =>
        deck.id === deckId ? { ...deck, pages: arrayMove(deck.pages, from, to) } : deck,
      ),
    })),

  addButton: (pageId, button) =>
    set((state) => ({
      decks: mapPage(state.decks, pageId, (page) => ({
        ...page,
        buttons: [...page.buttons, button],
      })),
    })),

  editButton: (pageId, buttonId, patch) =>
    set((state) => ({
      decks: mapPage(state.decks, pageId, (page) => ({
        ...page,
        buttons: page.buttons.map((button) =>
          button.id === buttonId ? { ...button, ...patch } : button,
        ),
      })),
    })),

  deleteButton: (pageId, buttonId) =>
    set((state) => ({
      decks: mapPage(state.decks, pageId, (page) => ({
        ...page,
        buttons: page.buttons.filter((button) => button.id !== buttonId),
      })),
    })),

  reorderButton: (pageId, from, to) =>
    set((state) => ({
      decks: mapPage(state.decks, pageId, (page) => ({
        ...page,
        buttons: arrayMove(page.buttons, from, to),
      })),
    })),
});
