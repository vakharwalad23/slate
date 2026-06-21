import * as Crypto from 'expo-crypto';
import type { StateCreator } from 'zustand';
import type { Deck, DeckButton, Page } from '@/schemas';
import type { RootState } from '@/stores/store';

const DEFAULT_COLUMNS = 4;
const DEFAULT_ROWS = 6;

function emptyDeck(): Deck {
  return {
    id: Crypto.randomUUID(),
    name: 'My Deck',
    pages: [{ id: Crypto.randomUUID(), columns: DEFAULT_COLUMNS, rows: DEFAULT_ROWS, buttons: [] }],
  };
}

const seed = emptyDeck();

export type DeckSlice = {
  decks: Deck[];
  currentDeckId: string | null;
  currentPageId: string | null;
  setCurrentDeck: (deckId: string) => void;
  setCurrentPage: (pageId: string) => void;
  addPage: (deckId: string) => void;
  addButton: (pageId: string, button: DeckButton) => void;
  editButton: (pageId: string, buttonId: string, patch: Partial<DeckButton>) => void;
  deleteButton: (pageId: string, buttonId: string) => void;
};

function mapPage(decks: Deck[], pageId: string, fn: (page: Page) => Page): Deck[] {
  return decks.map((deck) => ({
    ...deck,
    pages: deck.pages.map((page) => (page.id === pageId ? fn(page) : page)),
  }));
}

export const createDeckSlice: StateCreator<RootState, [], [], DeckSlice> = (set) => ({
  decks: [seed],
  currentDeckId: seed.id,
  currentPageId: seed.pages[0]?.id ?? null,

  setCurrentDeck: (deckId) => set({ currentDeckId: deckId }),
  setCurrentPage: (pageId) => set({ currentPageId: pageId }),

  addPage: (deckId) =>
    set((state) => ({
      decks: state.decks.map((deck) =>
        deck.id === deckId
          ? {
              ...deck,
              pages: [
                ...deck.pages,
                {
                  id: Crypto.randomUUID(),
                  columns: DEFAULT_COLUMNS,
                  rows: DEFAULT_ROWS,
                  buttons: [],
                },
              ],
            }
          : deck,
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
});
