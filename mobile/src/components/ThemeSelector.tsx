import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, ThemeMode } from '../theme/ThemeContext';
import { Sun, Moon, Smartphone } from 'lucide-react-native';

export function ThemeSelector() {
  const { theme, setTheme, colors } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: any }[] = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'dark', label: 'Dark', icon: Moon },
    { mode: 'system', label: 'System', icon: Smartphone },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.mode;
        return (
          <TouchableOpacity
            key={opt.mode}
            onPress={() => setTheme(opt.mode)}
            style={[
              styles.optionButton,
              isActive && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
            ]}
          >
            <Icon size={16} color={isActive ? colors.brand : colors.textMuted} />
            <Text
              style={[
                styles.optionText,
                { color: isActive ? colors.textPrimary : colors.textMuted },
                isActive && { fontWeight: '700' },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
