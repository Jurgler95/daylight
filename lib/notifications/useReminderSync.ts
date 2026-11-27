import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { getDb } from '@/db';
import { listTomorrowSnapshots } from '@/db/repositories/tomorrowHints';
import { addDaysToDateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { formatCount } from '@/lib/insights';
import { useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { readEntryDays, readEntryTimes, readEntryWritten } from '@/lib/streak/celebrate';

import { cancelAll, dismissReminders, hasPermission, syncReminders } from './client';
import { dailyKeysOfTimes, doneReminderKeys, planReminders, planSignature, timeZoneKey, type PlannedReminder, type ReminderWording } from './plan';
import { createSerialQueue } from './serial';
import { DEFAULT_REMINDER_TIME, reminderTimesOr } from './times';

const enqueueSync = createSerialQueue();

function minutesNow(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Keeps the device's scheduled reminders in sync with the settings and with the entries: the
 * daily ones stay away once their part of the day has an entry unless they should always come, the morning one follows a missing yesterday, and both name
 * the streak in their next occurrence. Mounted once in the root layout. Never asks for permission
 * by itself.
 */
export function useReminderSync(): void {
  const { t, i18n } = useTranslation();
  const enabled = useSettingsStore((s) => s.settings?.reminder_enabled ?? false);
  const storedTimes = useSettingsStore((s) => s.settings?.reminder_times);
  const latestTime = useSettingsStore((s) => s.settings?.reminder_time ?? DEFAULT_REMINDER_TIME);
  const times = useMemo(() => reminderTimesOr(storedTimes, latestTime), [storedTimes, latestTime]);
  const always = useSettingsStore((s) => s.settings?.reminder_always ?? false);
  const yesterdayEnabled = useSettingsStore((s) => s.settings?.reminder_yesterday_enabled ?? true);
  const yesterdayTime = useSettingsStore((s) => s.settings?.reminder_yesterday_time ?? '10:00');
  const outlookOn = useSettingsStore((s) => (s.settings?.outlook_enabled ?? true) && (s.settings?.outlook_notify_enabled ?? false));
  const outlookTime = useSettingsStore((s) => s.settings?.outlook_notify_time ?? '08:00');
  const [tick, setTick] = useState(0);
  const today = useToday();
  const entryDays = useQuery(() => readEntryDays(), []);
  const entryTimes = useQuery(() => readEntryTimes(), []);
  const written = useQuery(() => readEntryWritten(), []);
  // Yesterday's and today's hint are all the plan looks at, and only while still stored: a hint
  // that went away again that evening sends nothing the morning after.
  const stored = useQuery(() => listTomorrowSnapshots(getDb(), addDaysToDateString(today, -1)), [today]);
  const outlook = useMemo(() => (outlookOn ? { time: outlookTime, hintDays: new Set(stored.keys()) } : null), [outlookOn, outlookTime, stored]);

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
      moment: (n) => (n === null ? t('notify.moment') : t('notify.momentStreak', { value: formatCount(n) })),
      yesterday: (n) => (n === null ? t('notify.yesterday') : t('notify.yesterdayStreak', { count: n, value: formatCount(n) })),
      outlook: t('notify.outlook'),
    }),
    // The language too: a switch rewrites the reminders in the new language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const plan = useMemo<PlannedReminder[]>(
    () => planReminders({ today, nowMinutes: minutesNow(), enabled, times, always, yesterdayEnabled, yesterdayTime, outlook, entryDays, entryTimes, wording }),
    // `tick` re-plans after the app was in the background: the time of day may have passed.
    [today, enabled, times, always, yesterdayEnabled, yesterdayTime, outlook, entryDays, entryTimes, wording, tick],
  );
  // Read on every render: a return to the app after a change of time zone sets the times again.
  const signature = planSignature(plan, timeZoneKey());
  const done = useMemo(() => doneReminderKeys(entryDays, today, { times, entryTimes, written }), [entryDays, today, times, entryTimes, written]);
  const doneSignature = done.join('|');

  // A time that left the list (removed, or moved to another minute) takes what it still shows along:
  // `done` only knows the list as it is now. Not before the settings are read, the list is a stand-in until then.
  const known = useRef<readonly string[] | null>(null);
  useEffect(() => {
    if (storedTimes === undefined) return;
    const gone = (known.current ?? []).filter((time) => !times.includes(time));
    known.current = times;
    if (gone.length > 0) void dismissReminders(dailyKeysOfTimes(gone, today)).catch(() => undefined);
    // `today` is only read; a new day alone removes nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times, storedTimes]);

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
