import type { ReactNode, RefObject } from 'react';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';

const SWIPE = 48;

// ponytail: 1-finger horizontal swipe = page; 2-finger = deck. Two fingers (not long-press-drag)
// because long-press-drag fights the 1-finger long-press-to-edit; the chip bar / rail stay explicit.
// navRef is exposed so a button owning a swipe can block this page-nav (blocksExternalGesture).
export function DeckGestures({
  enabled,
  onPage,
  onDeck,
  navRef,
  children,
}: {
  enabled: boolean;
  onPage: (direction: 1 | -1) => void;
  onDeck: (direction: 1 | -1) => void;
  navRef?: RefObject<GestureType | undefined> | undefined;
  children: ReactNode;
}) {
  let page = Gesture.Pan()
    .enabled(enabled)
    .minPointers(1)
    .maxPointers(1)
    .activeOffsetX([-30, 30])
    .failOffsetY([-24, 24])
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX <= -SWIPE) onPage(1);
      else if (e.translationX >= SWIPE) onPage(-1);
    });
  if (navRef !== undefined) page = page.withRef(navRef);

  const deck = Gesture.Pan()
    .enabled(enabled)
    .minPointers(2)
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX <= -SWIPE) onDeck(1);
      else if (e.translationX >= SWIPE) onDeck(-1);
    });

  return <GestureDetector gesture={Gesture.Race(deck, page)}>{children}</GestureDetector>;
}
