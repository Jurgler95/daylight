import { useCallback, useRef, useState } from 'react';
import type { GestureResponderEvent, ViewProps } from 'react-native';

type ResponderProps = Pick<
  ViewProps,
  'onStartShouldSetResponder' | 'onResponderGrant' | 'onResponderMove' | 'onResponderRelease' | 'onResponderTerminationRequest'
>;

/**
 * Tap or drag across a chart to pick the item under the finger. `pick` turns the x (and y) of the
 * touch, relative to the touched view, into an item index or null. Tapping the picked item again
 * lets it go. A vertical swipe still scrolls the page: the scroll view takes over and the pick stays.
 * Children of the view should be `pointerEvents="none"`, so the touch is always relative to the view itself.
 */
export function useInspector(pick: (x: number, y: number) => number | null) {
  const [selected, setSelected] = useState<number | null>(null);
  const toggleOff = useRef(false);
  const current = useRef<number | null>(null);
  current.current = selected;

  const at = useCallback((event: GestureResponderEvent) => pick(event.nativeEvent.locationX, event.nativeEvent.locationY), [pick]);

  const responder: ResponderProps = {
    onStartShouldSetResponder: () => true,
    onResponderGrant: (event) => {
      const index = at(event);
      toggleOff.current = index !== null && index === current.current;
      setSelected(index);
    },
    onResponderMove: (event) => {
      const index = at(event);
      if (index === null) return;
      if (index !== current.current) toggleOff.current = false;
      setSelected(index);
    },
    onResponderRelease: () => {
      if (toggleOff.current) setSelected(null);
      toggleOff.current = false;
    },
    onResponderTerminationRequest: () => true,
  };

  return { selected, setSelected, responder };
}

/** Index of the x nearest to `target` in an ascending list, or null for an empty list. */
export function nearestIndex(xs: readonly number[], target: number): number | null {
  if (xs.length === 0) return null;
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((xs[mid] ?? 0) < target) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs((xs[lo - 1] ?? 0) - target) <= Math.abs((xs[lo] ?? 0) - target)) return lo - 1;
  return lo;
}
