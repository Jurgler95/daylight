import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { getDb } from '@/db';
import { hasEntryOn } from '@/db/repositories/entries';
import { useToday } from '@/lib/dates/useToday';
import { useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { cancelAll, hasPermission, syncReminders } from './client';
import { planReminders, planSignature, type PlannedReminder } from './plan';
import { createSerialQueue } from './serial';

const enqueueSync = createSerialQueue();

function minutesNow(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Keeps the device's scheduled reminders in sync with the settings and with today's entries.
 * Mounted once in the root layout. Never asks for permission by itself.
 */
export function useReminderSync(): void {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.settings?.reminder_enabled ?? false);
  const time = useSettingsStore((s) => s.settings?.reminder_time ?? '20:30');
  const [tick, setTick] = useState(0);
  const today = useToday();
  const hasEntryToday = useQuery(() => hasEntryOn(getDb(), today), [today]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);

  const plan = useMemo<PlannedReminder[]>(
    () => planReminders({ today, nowMinutes: minutesNow(), enabled, time, hasEntryToday }),
    // `tick` re-plans after the app was in the background: the time of day may have passed.
    [today, enabled, time, hasEntryToday, tick],
  );
  const signature = planSignature(plan);

  useEffect(() => {
    let cancelled = false;
    // Queued behind any sync still running; skipped when a newer plan came in while it waited.
    void enqueueSync(async () => {
      if (cancelled) return;
      if (plan.length === 0) {
        await cancelAll();
        return;
      }
      if (!(await hasPermission()) || cancelled) return;
      await syncReminders(plan, { channelName: t('notify.channel'), title: t('notify.title'), body: t('notify.body') });
    }).catch((error: unknown) => {
      // A device that refuses to schedule must not take the app down with it.
      console.warn('Erinnerungen konnten nicht gestellt werden', error);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
