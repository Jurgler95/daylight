import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

type Icon = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; key: string; icon: Icon; active: Icon }[] = [
  { name: 'index', key: 'today', icon: 'sunny-outline', active: 'sunny' },
  { name: 'calendar', key: 'calendar', icon: 'calendar-outline', active: 'calendar' },
  { name: 'insights', key: 'insights', icon: 'analytics-outline', active: 'analytics' },
  { name: 'history', key: 'history', icon: 'list-outline', active: 'list' },
  { name: 'settings', key: 'settings', icon: 'ellipsis-horizontal-circle-outline', active: 'ellipsis-horizontal-circle' },
];

/**
 * Android back walks through the tabs in the order they were visited, like the browser back button.
 * When that history runs out on any tab other than "Heute", back lands on "Heute" first, so the app
 * only closes from the home tab.
 */
const backToHomeRouter: ComponentProps<typeof Tabs>['UNSTABLE_router'] = (original) => ({
  getStateForAction(state, action, options) {
    const result = original.getStateForAction(state, action, options);
    if (result !== null || action.type !== 'GO_BACK') return result;
    const home = state.routes.findIndex((route) => route.name === 'index');
    const homeRoute = state.routes[home];
    if (!homeRoute || home === state.index) return null;
    return { ...state, index: home, history: [{ type: 'route', key: homeRoute.key }] };
  },
});

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      backBehavior="history"
      UNSTABLE_router={backToHomeRouter}
      screenOptions={{
        headerShown: false,
        // Tabs out of sight skip the re-render every write triggers and catch up when shown again.
        freezeOnBlur: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        // The system navigation bar (Android three-button or gesture pill) sits inside the bottom inset,
        // so the tab bar grows by that inset instead of being covered by it.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          elevation: 12,
          shadowColor: colors.accent,
          shadowOpacity: 0.15,
          shadowRadius: 12,
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(`tabs.${tab.key}`),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? tab.active : tab.icon} color={color} focused={focused} pill={colors.accentSoft} />
            ),
          }}
          listeners={{ tabPress: () => haptics.tick() }}
        />
      ))}
    </Tabs>
  );
}

/** Sits on a blue pill and gives a bouncy hop when its tab becomes the active one. */
function TabIcon({ name, color, focused, pill }: { name: Icon; color: ColorValue; focused: boolean; pill: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) scale.value = withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, { damping: 6, stiffness: 260 }));
  }, [focused, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={[styles.pill, focused && { backgroundColor: pill }]}>
      <Animated.View style={animated}>
        <Ionicons name={name} size={24} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
