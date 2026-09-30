import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

import { EntryRow, type HealthLabels } from '@/components/history/EntryRow';
import { FilterPanel } from '@/components/history/FilterPanel';
import { SearchBar } from '@/components/history/SearchBar';
import { AppText, EmptyState, Screen } from '@/components/ui';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { formatMonthYear, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { haptics } from '@/lib/haptics';
import { useHealthByDate } from '@/lib/health/useHealthDays';
import { EMPTY_QUERY, isEmptyQuery, type SearchQuery } from '@/lib/search/search';
import { useEntrySearch } from '@/lib/search/useEntrySearch';
import { useSelectedDayStore } from '@/lib/store/selectedDay';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

/** Every entry, newest first, by month. The search above narrows the same list instead of opening another. */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const today = useToday();
  const catalog = useCatalog();
  const [query, setQuery] = useState<SearchQuery>(EMPTY_QUERY);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { hits, sections, chipIds, total } = useEntrySearch(query, today);
  const health = useHealthByDate();
  const healthLabels: HealthLabels = useMemo(
    () => ({ sleep: t('health.day.sleep'), steps: t('health.day.steps'), exercise: t('health.day.exercise') }),
    [t],
  );
  const filterCount = query.levels.length + query.activityIds.length + (query.period === 'all' ? 0 : 1);
  const pick = useSelectedDayStore((s) => s.pick);
  // Like the calendar: the row opens its day on "Heute", editing is one tap further.
  const open = (date: DateString) => {
    pick(date === today ? null : date);
    router.navigate('/');
  };

  const pinned = (
    <>
      <AppText variant="title" accessibilityRole="header">
        {t('tabs.history')}
      </AppText>
      <View style={styles.searchRow}>
        <View style={styles.flex}>
          <SearchBar
            value={query.text}
            placeholder={t('history.placeholder')}
            label={t('history.search')}
            clearLabel={t('history.clear')}
            onChange={(text) => setQuery((current) => ({ ...current, text }))}
          />
        </View>
        <Pressable
          onPress={() => {
            haptics.tick();
            setFiltersOpen((value) => !value);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          accessibilityLabel={filterCount > 0 ? t('history.filtersActive', { count: filterCount }) : t('history.filters')}
          style={({ pressed }) => [
            styles.filterButton,
            { backgroundColor: filterCount > 0 ? colors.accent : colors.surfaceMuted, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="options-outline" size={20} color={filterCount > 0 ? colors.textOnAccent : colors.text} />
        </Pressable>
      </View>
      {filtersOpen ? <FilterPanel query={query} catalog={catalog} chipIds={chipIds} onChange={setQuery} /> : null}
      {!isEmptyQuery(query) ? (
        <View style={styles.resultRow}>
          <AppText variant="caption" muted style={styles.flex}>
            {t('history.results', { count: hits.length })}
          </AppText>
          {/* A caption is about 16 points high; the slop brings the target to 44. */}
          <Pressable onPress={() => setQuery(EMPTY_QUERY)} accessibilityRole="button" hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}>
            <AppText variant="caption" color={colors.accent}>
              {t('history.reset')}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </>
  );

  return (
    <Screen scroll={false} sticky={pinned}>
      {total === 0 ? (
        <EmptyState icon="list-outline" label={t('history.empty')} />
      ) : hits.length === 0 ? (
        <EmptyState icon="search-outline" label={t('history.noResults')} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(hit) => String(hit.entry.id)}
          renderItem={({ item }) => (
            <EntryRow hit={item} catalog={catalog} health={health.get(item.entry.date)} healthLabels={healthLabels} onPress={open} />
          )}
          renderSectionHeader={({ section }) => (
            // Opaque, because rows scroll underneath it while it is pinned.
            <View style={[styles.month, { backgroundColor: colors.background }]}>
              <AppText variant="headline">{formatMonthYear(section.month)}</AppText>
              <AppText variant="caption" muted>
                {t('history.count', { count: section.data.length })}
              </AppText>
            </View>
          )}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          windowSize={9}
          contentContainerStyle={styles.list}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterButton: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center' },
  month: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: spacing.md, paddingBottom: spacing.xs },
  list: { paddingBottom: spacing.xl },
});
