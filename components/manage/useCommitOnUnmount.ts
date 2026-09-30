import { useEffect, useRef } from 'react';

/**
 * Closing a screen while a field still has focus unmounts it before its blur event arrives,
 * so a field that saves on blur has to save on the way out as well, or the typing is lost
 * (Zyklus 1.0.10).
 */
export function useCommitOnUnmount(commit: () => void): void {
  const latest = useRef(commit);
  useEffect(() => {
    latest.current = commit;
  });
  useEffect(() => () => latest.current(), []);
}
