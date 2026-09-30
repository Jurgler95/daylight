/**
 * Runs async tasks one after the other. Every sync replaces the device's whole schedule (cancel all,
 * then schedule), so two syncs must never interleave: an older one still scheduling after a newer
 * one cancelled would leave stale reminders behind, today's included after an entry was saved.
 */
export function createSerialQueue(): (task: () => Promise<void>) => Promise<void> {
  let tail: Promise<void> = Promise.resolve();
  return (task) => {
    const run = tail.then(task);
    // A failed task must not block the ones after it; the caller sees its error through `run`.
    tail = run.catch(() => undefined);
    return run;
  };
}
