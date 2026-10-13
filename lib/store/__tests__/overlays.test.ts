import { activeOverlay, overlayBlocked, useOverlayStore } from '../overlays';

describe('overlay slot', () => {
  beforeEach(() => useOverlayStore.setState({ waiting: [], celebration: null, chipPulse: null }));

  it('shows one overlay at a time: start sheet, then streak, then stars', () => {
    expect(activeOverlay([])).toBeNull();
    expect(activeOverlay(['stars', 'streak'])).toBe('streak');
    expect(activeOverlay(['stars', 'reminderPrompt', 'streak'])).toBe('reminderPrompt');
  });

  it('lets the next one in when the first gives the slot back', () => {
    const { request, release } = useOverlayStore.getState();
    request('stars');
    request('streak');
    request('streak');
    expect(useOverlayStore.getState().waiting).toEqual(['stars', 'streak']);
    expect(activeOverlay(useOverlayStore.getState().waiting)).toBe('streak');
    release('streak');
    expect(activeOverlay(useOverlayStore.getState().waiting)).toBe('stars');
  });

  it('keeps a banner or overlay for its turn and always pulses the chip once', () => {
    const { celebrate, takeChipPulse } = useOverlayStore.getState();
    celebrate({ milestone: 'small', rescued: false, days: 10 });
    expect(useOverlayStore.getState().celebration).toBeNull();
    expect(takeChipPulse()).toBe('tick');
    expect(takeChipPulse()).toBeNull();
    // The banner buzzes for a big one, so the chip pulses quietly.
    celebrate({ milestone: 'large', rescued: false, days: 50 });
    expect(useOverlayStore.getState().celebration).toEqual({ milestone: 'large', rescued: false, days: 50 });
    expect(takeChipPulse()).toBe('quiet');
  });

  it('waits while an entry, a photo or a new turning point is open', () => {
    expect(overlayBlocked('/entry/new')).toBe(true);
    expect(overlayBlocked('/photo/abc.jpg')).toBe(true);
    expect(overlayBlocked('/turning/new')).toBe(true);
    expect(overlayBlocked('/turning/3')).toBe(false);
    expect(overlayBlocked('/')).toBe(false);
  });
});
