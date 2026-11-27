import { fireEvent, render, screen } from '@testing-library/react-native';

import { applyLanguage } from '@/lib/i18n';

import { NumberInput } from '../NumberInput';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

async function setup(value: number | null = null) {
  const onChange = jest.fn();
  await render(<NumberInput label="Gewicht" unit="kg" decimals={1} invalidLabel="Bitte eine Zahl eingeben" tooPreciseLabel="Höchstens 1 Nachkommastelle" onChange={onChange} value={value} />);
  return { onChange };
}

describe('NumberInput', () => {
  beforeAll(() => applyLanguage('de'));

  it('shows the value with its decimals and unit', async () => {
    await setup(72);
    expect(screen.getByDisplayValue('72,0')).toBeTruthy();
    expect(screen.getByText('kg')).toBeTruthy();
  });

  it('passes typed numbers on and clears on empty', async () => {
    const { onChange } = await setup(72);
    const field = screen.getByLabelText('Gewicht, kg');
    await fireEvent.changeText(field, '72,4');
    expect(onChange).toHaveBeenLastCalledWith(72.4);
    await fireEvent.changeText(field, '72,45');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Höchstens 1 Nachkommastelle')).toBeTruthy();
    await fireEvent.changeText(field, '');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('keeps the last good value and says so while the text is no number', async () => {
    const { onChange } = await setup(72);
    await fireEvent.changeText(screen.getByLabelText('Gewicht, kg'), '72,4,');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Bitte eine Zahl eingeben')).toBeTruthy();
  });
});
