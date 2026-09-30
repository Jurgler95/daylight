import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { today, type DateString } from './index';

/**
 * Today's date for rendering. A bare `today()` in a component is cached by the React Compiler and
 * would stay on the day the screen first opened; this one moves on at midnight and whenever the
 * app comes back to the front.
 */
export function useToday(): DateString {
  const [value, setValue] = useState(today);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setValue(today());
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(24, 0, 1, 0);
    const timer = setTimeout(() => setValue(today()), midnight.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [value]);

  return value;
}
