import type { IconName } from '@/lib/icons';

/** How the insight cards name and draw an activity; built from the catalog on the screen. */
export interface ActivityNames {
  label: (id: number) => string;
  icon: (id: number) => IconName;
}

export interface GroupActivities {
  id: number;
  name: string;
  /** In display order. */
  activityIds: number[];
}
