// The tests assert German texts; without this, the device language would follow the machine's locale.
jest.mock('@/lib/i18n/language', () => ({ ...jest.requireActual('@/lib/i18n/language'), deviceLanguage: () => 'de' }));
