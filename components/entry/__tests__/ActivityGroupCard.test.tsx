import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { GroupWithActivities } from '@/lib/catalog/catalog';

import { ActivityGroupCard } from '../ActivityGroupCard';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/db/client', () => ({ getDb: () => require('@/db/testDb').createTestDb(), DATABASE_NAME: 'test.db' }));

const item = {
  group: { id: 1, name: 'Freizeit' },
  activities: [{ id: 7, name: 'Lesen', icon: 'book-outline' }],
} as unknown as GroupWithActivities;

async function setup() {
  const onAdd = jest.fn(() => true);
  const onArchive = jest.fn();
  await render(
    <ActivityGroupCard
      item={item}
      selected={[]}
      collapsed={false}
      selectedLabel={(count) => `${count} gewählt`}
      onToggleCollapsed={() => {}}
      onToggle={() => {}}
      addLabel="Neue Aktivität in Freizeit"
      onAdd={onAdd}
      onArchive={onArchive}
    />,
  );
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Neue Aktivität in Freizeit' })));
  return { onAdd, onArchive, field: () => screen.getByLabelText('Neue Aktivität in Freizeit') };
}

describe('ActivityGroupCard', () => {
  it('adds the typed name when the field loses focus, e.g. by tapping beside the keyboard', async () => {
    const { onAdd, field } = await setup();
    await act(async () => fireEvent.changeText(field(), ' Kino '));
    await act(async () => fireEvent(field(), 'blur'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('Kino');
    expect(screen.queryByDisplayValue('Kino')).toBeNull();
  });

  it('adds once when "Fertig" is followed by the blur', async () => {
    const { onAdd, field } = await setup();
    await act(async () => fireEvent.changeText(field(), 'Kino'));
    const input = field();
    await act(async () => {
      fireEvent(input, 'submitEditing');
      fireEvent(input, 'blur');
    });
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('closes an empty field on blur without adding', async () => {
    const { onAdd, field } = await setup();
    await act(async () => fireEvent(field(), 'blur'));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Neue Aktivität in Freizeit' })).toBeTruthy();
  });

  it('asks to archive a chip that is held', async () => {
    const { onArchive } = await setup();
    await act(async () => fireEvent(screen.getByRole('button', { name: 'Lesen' }), 'longPress'));
    expect(onArchive).toHaveBeenCalledWith(7);
  });
});
