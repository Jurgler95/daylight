import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { useToday } from '@/lib/dates/useToday';
import { formatCount } from '@/lib/insights';
import { useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { readEntryDays } from '@/lib/streak/celebrate';

import { cancelAll, dismissReminders, hasPermission, syncReminders } from './client';
import { doneReminderKeys, planReminders, planSignature, type PlannedReminder, type ReminderWording } from './plan';
import { createSerialQueue } from './serial';

const enqueueSync = createSerialQueue();

function minutesNow(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Keeps the device's scheduled reminders in sync with the settings and with the entries: the
 * evening one skips days with an entry, the morning one follows a missing yesterday, and both name
 * the streak in their next occurrence. Mounted once in the root layout. Never asks for permission
 * by itself.
 */
export function useReminderSync(): void {
  const { t, i18n } = useTranslation();
  const enabled = useSettingsStore((s) => s.settings?.reminder_enabled ?? false);
  const time = useSettingsStore((s) => s.settings?.reminder_time ?? '20:30');
  const yesterdayEnabled = useSettingsStore((s) => s.settings?.reminder_yesterday_enabled ?? true);
  const yesterdayTime = useSettingsStore((s) => s.settings?.reminder_yesterday_time ?? '10:00');
  const [tick, setTick] = useState(0);
  const today = useToday();
  const entryDays = useQuery(() => readEntryDays(), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);

  const wording = useMemo<ReminderWording>(
    () => ({
      title: t('notify.title'),
      daily: (n) => (n === null ? t('notify.body') : t('notify.bodyStreak', { value: formatCount(n) })),
      yesterday: (n) => (n === null ? t('notify.yesterday') : t('notify.yesterdayStreak', { count: n, value: formatCount(n) })),
    }),
    // The language too: a switch rewrites the reminders in the new language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const plan = useMemo<PlannedReminder[]>(
    () => planReminders({ today, nowMinutes: minutesNow(), enabled, time, yesterdayEnabled, yesterdayTime, entryDays, wording }),
    // `tick` re-plans after the app was in the background: the time of day may have passed.
    [today, enabled, time, yesterdayEnabled, yesterdayTime, entryDays, wording, tick],
  );
  const signature = planSignature(plan);
  const done = useMemo(() => doneReminderKeys(entryDays, today), [entryDays, today]);
  const doneSignature = done.join('|');

  useEffect(() => {
    let cancelled = false;
    // Queued behind any sync still running; skipped when a newer plan came in while it waited.
    void enqueueSync(async () => {
      if (cancelled) return;
      await dismissReminders(done);
      if (plan.length === 0) {
        await cancelAll();
        return;
      }
      if (!(await hasPermission()) || cancelled) return;
      await syncReminders(plan, t('notify.channel'));
    }).catch((error: unknown) => {
      // A device that refuses to schedule must not take the app down with it.
      console.warn('Erinnerungen konnten nicht gestellt werden', error);
    });
    return () => {
      cancelled = true;
    };
    // The signatures hold the texts, so a new language or a longer streak reschedules too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, doneSignature]);
}
