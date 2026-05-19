import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';

interface Props {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  mode?: 'date' | 'time' | 'datetime';
  optional?: boolean;
  minimumDate?: Date;
  icon?: keyof typeof Ionicons.glyphMap;
  placeholder?: string;
}

export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'date',
  optional,
  minimumDate,
  icon,
  placeholder,
}: Props) {
  const [showPicker, setShowPicker] = useState(false);
  // On Android, picker is shown sequentially: date then time when mode='datetime'.
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>('date');

  const handleAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type !== 'set' || !selected) {
      setShowPicker(false);
      setAndroidStep('date');
      return;
    }

    if (mode === 'datetime' && androidStep === 'date') {
      const base = value ?? new Date();
      const merged = new Date(selected);
      merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
      onChange(merged);
      setAndroidStep('time');
      // Re-open picker for time selection
      setTimeout(() => setShowPicker(true), 0);
      return;
    }

    if (mode === 'datetime' && androidStep === 'time') {
      const base = value ?? new Date();
      const merged = new Date(base);
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      onChange(merged);
      setShowPicker(false);
      setAndroidStep('date');
      return;
    }

    onChange(selected);
    setShowPicker(false);
  };

  const handleIosChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'set' && selected) onChange(selected);
  };

  const formatted = value ? formatValue(value, mode) : placeholder ?? 'Tap to select';

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>Optional</Text> : null}
      </View>

      <Pressable
        onPress={() => {
          setAndroidStep('date');
          setShowPicker(true);
        }}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Ionicons
          name={icon ?? (mode === 'time' ? 'time-outline' : 'calendar-outline')}
          size={18}
          color={colors.black}
        />
        <Text style={[styles.value, !value && styles.placeholder]}>{formatted}</Text>
        {value && optional ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onChange(null);
            }}
            hitSlop={10}
          >
            <Ionicons name="close-circle" size={16} color={colors.grey400} />
          </Pressable>
        ) : null}
      </Pressable>

      {showPicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode === 'datetime' ? androidStep : mode}
          display="default"
          minimumDate={minimumDate}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' && showPicker ? (
        <View style={styles.iosWrap}>
          <DateTimePicker
            value={value ?? new Date()}
            mode={mode}
            display="inline"
            minimumDate={minimumDate}
            onChange={handleIosChange}
          />
          <View style={styles.iosActions}>
            <Pressable onPress={() => setShowPicker(false)} style={styles.iosBtn}>
              <Text style={styles.iosBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatValue(value: Date, mode: 'date' | 'time' | 'datetime') {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const timeStr = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  if (mode === 'date') return dateStr;
  if (mode === 'time') return timeStr;
  return `${dateStr} · ${timeStr}`;
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  label: { ...typography.label, color: colors.grey600 },
  optional: { ...typography.caption, color: colors.grey400, fontSize: 11 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  value: { flex: 1, ...typography.body, color: colors.black, fontSize: 15, textAlign: 'left' },
  placeholder: { color: colors.grey400 },
  iosWrap: {
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.sm,
  },
  iosActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  iosBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iosBtnText: { ...typography.subheading, color: colors.info, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
