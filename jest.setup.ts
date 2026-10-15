// The tests assert German texts; without this, the device language would follow the machine's locale.
jest.mock('@/lib/i18n/language', () => ({ ...jest.requireActual('@/lib/i18n/language'), deviceLanguage: () => 'de' }));
// `Screen` scrolls in the keyboard aware view, whose native module is missing under Jest.
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
