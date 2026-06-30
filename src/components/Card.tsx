import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  StyleProp,
  ViewStyle,
  Pressable,
} from 'react-native';
import { theme } from '../theme';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ children, style, padded = true }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        padded && { padding: theme.spacing.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
}

export function StatCard({ label, value, unit, accent = theme.colors.primary }: StatCardProps) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  statItem: {
    flex: 1,
    minWidth: '44%',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  statLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeights.medium,
    marginBottom: theme.spacing.xs,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.semibold,
  },
  statUnit: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.xs,
  },
});
