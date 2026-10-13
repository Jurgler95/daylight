import { shouldOfferReminder, type PromptInput } from '../prompt';

const input = (overrides: Partial<PromptInput> = {}): PromptInput => ({
  available: true,
  reminderEnabled: false,
  promptDone: false,
  pathname: '/',
  ...overrides,
});

describe('shouldOfferReminder', () => {
  it('offers the reminder on "Heute" to whoever has not answered yet', () => {
    expect(shouldOfferReminder(input())).toBe(true);
  });

  it('never asks again once answered', () => {
    expect(shouldOfferReminder(input({ promptDone: true }))).toBe(false);
  });

  it('never asks whoever has the reminder on already', () => {
    expect(shouldOfferReminder(input({ reminderEnabled: true }))).toBe(false);
  });

  it('waits for "Heute": not over the editor, an import or a settings page', () => {
    for (const pathname of ['/entry/new', '/more/import', '/more/reminders', '/calendar']) {
      expect(shouldOfferReminder(input({ pathname }))).toBe(false);
    }
  });

  it('stays away where reminders cannot be set', () => {
    expect(shouldOfferReminder(input({ available: false }))).toBe(false);
  });
});
