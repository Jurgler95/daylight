import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoodPicker } from '@/components/mood/MoodPicker';
import { AppText, Button, Card, CardMotion, EmptyState, LogoBackdrop, TextField } from '@/components/ui';
import { getDb } from '@/db';
import { createActivity } from '@/db/repositories/activities';
import type { Activity } from '@/db/schema';
import { editorGroups } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { useToday } from '@/lib/dates/useToday';
import { useCollapsedGroups } from '@/lib/entry/collapsedGroups';
import { setScale, toggleId } from '@/lib/entry/draft';
import { useEntryEditor, type EditorTarget } from '@/lib/entry/useEntryEditor';
import { useManageWrite } from '@/lib/manage/useManageWrite';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

import { ActivityGroupCard } from './ActivityGroupCard';
import { DateTimeRows } from './DateTimeRows';
import { PhotoField } from './PhotoField';
import { ScaleInput } from './ScaleInput';

/**
 * New and existing entries alike. Writes only on "Speichern"; leaving with changes (close button,
 * Android back, swipe) asks whether to save, discard or keep editing, so nothing typed is lost
 * without a decision.
 */
export function EntryEditor({ target }: { target: EditorTarget }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const today = useToday();
  const catalog = useCatalog();
  const editor = useEntryEditor(target);
  const write = useManageWrite();
  const collapsed = useCollapsedGroups((s) => s.collapsed);
  const toggleCollapsed = useCollapsedGroups((s) => s.toggle);
  // Set right before a deliberate exit (saved or deleted), so the guard below lets it through.
  const leaving = useRef(false);

  usePreventRemove(editor.dirty, ({ data }) => {
    if (leaving.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert(t('entry.unsavedTitle'), undefined, [
      { text: t('entry.keepEditing'), style: 'cancel' },
      { text: t('entry.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ...(editor.canSave
        ? [
            {
              text: t('entry.save'),
              onPress: () =>
                confirmTurningLoss(() => {
                  editor.save();
                  navigation.dispatch(data.action);
                }),
            },
          ]
        : []),
    ]);
  });

  /** Moving the last entry of a turning point's day away takes the turning point with it: ask first. */
  const confirmTurningLoss = (then: () => void) => {
    const lost = editor.turningPointLostOnSave;
    if (!lost) return then();
    Alert.alert(t('entry.turningMoveTitle'), t('entry.turningLost', { title: lost.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('entry.turningMoveConfirm'), style: 'destructive', onPress: then },
    ]);
  };

  const leave = () => {
    leaving.current = true;
    router.back();
  };
  const save = () =>
    confirmTurningLoss(() => {
      if (editor.save()) leave();
    });
  const lostOnDelete = editor.turningPointLostOnDelete;
  const remove = () =>
    Alert.alert(t('entry.deleteTitle'), lostOnDelete ? `${t('entry.deleteBody')} ${t('entry.turningLost', { title: lostOnDelete.title })}` : t('entry.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('entry.delete'),
        style: 'destructive',
        onPress: () => {
          editor.remove();
          leave();
        },
      },
    ]);

  const { draft } = editor;
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        style={({ pressed }) => [styles.close, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="close" size={22} color={colors.text} />
      </Pressable>
      <AppText variant="headline" accessibilityRole="header" style={styles.flex} numberOfLines={1}>
        {editor.isNew ? t('entry.newTitle') : t('entry.editTitle')}
      </AppText>
      {draft ? <Button label={t('entry.save')} disabled={!editor.canSave} onPress={save} /> : null}
    </View>
  );

  if (!draft) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <LogoBackdrop />
        {header}
        <EmptyState icon="trash-outline" label={t('entry.gone')} />
      </View>
    );
  }

  const groups = editorGroups(catalog, draft.activity_ids);
  // Created right away (it belongs to the catalog, not to this entry) and picked for this entry.
  // A name the group already has picks that activity instead of making a second one.
  const addActivity = (groupId: number, name: string) => {
    let created: Activity | undefined;
    if (!write(() => (created = createActivity(getDb(), { group_id: groupId, name })))) return false;
    const id = created?.id;
    if (id !== undefined && !draft.activity_ids.includes(id)) editor.update({ activity_ids: [...draft.activity_ids, id] });
    return true;
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <LogoBackdrop />
      {header}
      {/* Scrolls the focused field, and the caret of a growing note, above the keyboard. */}
      <KeyboardAwareScrollView
        bottomOffset={spacing.xxxl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
      >
        <CardMotion value>
          <Card>
            <MoodPicker moods={catalog.moods} selected={draft.mood_id} onPick={(mood_id) => editor.update({ mood_id })} size={48} />
          </Card>

          {groups.length > 0 ? (
            groups.map((item) => (
              <ActivityGroupCard
                key={item.group.id}
                item={item}
                selected={draft.activity_ids}
                collapsed={collapsed.includes(item.group.id)}
                selectedLabel={(count) => t('entry.selected', { count })}
                onToggleCollapsed={() => toggleCollapsed(item.group.id)}
                onToggle={(id) => editor.update({ activity_ids: toggleId(draft.activity_ids, id) })}
                addLabel={t('entry.addActivity', { group: item.group.name })}
                onAdd={(name) => addActivity(item.group.id, name)}
              />
            ))
          ) : (
            <Card tone="muted">
              <AppText muted>{t('entry.noActivities')}</AppText>
              <Button label={t('manage.activities')} variant="secondary" onPress={() => router.push('/more/activities')} />
            </Card>
          )}

          {catalog.scales.length > 0 ? (
            <Card>
              {catalog.scales.map((scale) => (
                <ScaleInput
                  key={scale.id}
                  label={scale.name}
                  min={scale.min}
                  max={scale.max}
                  value={draft.scales[scale.id] ?? null}
                  valueLabel={(value) => t('entry.scaleValue', { value, max: scale.max })}
                  emptyLabel={t('entry.scaleEmpty')}
                  onChange={(value) => editor.update({ scales: setScale(draft.scales, scale.id, value) })}
                />
              ))}
            </Card>
          ) : null}

          <Card>
            <TextField label={t('entry.note')} value={draft.note} multiline onChangeText={(note) => editor.update({ note })} />
          </Card>

          <PhotoField photos={draft.photos} onChange={(photos) => editor.update({ photos })} />

          <Card>
            <DateTimeRows
              date={draft.date}
              time={draft.time}
              maxDate={today}
              dateLabel={t('entry.date')}
              timeLabel={t('entry.time')}
              onChange={(patch) => editor.update(patch)}
            />
            {editor.dayTaken ? (
              <AppText variant="caption" color={colors.danger}>
                {t('entry.dayTaken')}
              </AppText>
            ) : null}
          </Card>

          {!editor.isNew ? <Button label={t('entry.delete')} variant="ghost" onPress={remove} /> : null}
        </CardMotion>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: TOUCH_TARGET / 2, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.lg },
});
