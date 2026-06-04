import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  /** When set with activePickerKey, only one picker open per form group. */
  pickerKey?: string;
  activePickerKey?: string | null;
  onActivePickerChange?: (key: string | null) => void;
}

type PickerStep = 'date' | 'time';

export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'date',
  optional,
  minimumDate,
  icon,
  placeholder,
  pickerKey,
  activePickerKey = null,
  onActivePickerChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const [localOpen, setLocalOpen] = useState(false);
  const [iosStep, setIosStep] = useState<PickerStep>('date');
  const [iosDraft, setIosDraft] = useState<Date>(value ?? new Date());
  const androidBusy = useRef(false);

  const controlled = pickerKey != null && onActivePickerChange != null;
  const isOpen = controlled ? activePickerKey === pickerKey : localOpen;

  useEffect(() => {
    if (!isOpen) setIosDraft(value ?? new Date());
  }, [value, isOpen]);

  const setOpen = (open: boolean) => {
    if (controlled) {
      onActivePickerChange!(open ? pickerKey! : null);
    } else {
      setLocalOpen(open);
    }
  };

  const closePicker = () => {
    setOpen(false);
    setIosStep('date');
  };

  const openPicker = () => {
    setIosDraft(value ?? new Date());
    setIosStep(mode === 'time' ? 'time' : 'date');
    setOpen(true);
  };

  const confirmIos = () => {
    if (mode === 'datetime' && iosStep === 'date') {
      setIosStep('time');
      return;
    }
    onChange(iosDraft);
    closePicker();
  };

  const iosPickerMode = (): 'date' | 'time' | 'datetime' => {
    if (mode === 'datetime') return iosStep;
    return mode;
  };

  const iosDisplay = (): 'inline' | 'spinner' => {
    if (iosPickerMode() === 'date') return 'inline';
    return 'spinner';
  };

  const runAndroidPicker = useCallback(
    (step: PickerStep, valueOverride?: Date) => {
      if (androidBusy.current) return;
      androidBusy.current = true;

      const base = valueOverride ?? value ?? new Date();

      DateTimePickerAndroid.open({
        value: base,
        mode: step,
        display: step === 'date' ? 'calendar' : 'clock',
        minimumDate: step === 'date' ? minimumDate : undefined,
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          androidBusy.current = false;

          if (event.type === 'dismissed') return;

          if (event.type !== 'set' || !selected) return;

          if (mode === 'datetime' && step === 'date') {
            const merged = new Date(selected);
            merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
            onChange(merged);
            setTimeout(() => runAndroidPicker('time', merged), 0);
            return;
          }

          if (mode === 'datetime' && step === 'time') {
            const merged = new Date(base);
            merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            onChange(merged);
            return;
          }

          onChange(selected);
        },
      });
    },
    [minimumDate, mode, onChange, value],
  );

  const handleFieldPress = () => {
    if (Platform.OS === 'android') {
      runAndroidPicker(mode === 'time' ? 'time' : 'date');
      return;
    }
    openPicker();
  };

  const formatted = value ? formatValue(value, mode) : placeholder ?? 'Tap to select';
  const fieldIcon = icon ?? (mode === 'time' ? 'time-outline' : 'calendar-outline');
  const iosDoneLabel = mode === 'datetime' && iosStep === 'date' ? 'Next' : 'Done';
  const showIosModal = Platform.OS === 'ios' && isOpen;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>Optional</Text> : null}
      </View>

      <Pressable
        onPress={handleFieldPress}
        style={({ pressed }) => [
          styles.field,
          isOpen && styles.fieldOpen,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatted}`}
      >
        <Ionicons name={fieldIcon} size={18} color={colors.black} />
        <Text style={[styles.value, !value && styles.placeholder]}>{formatted}</Text>
        {value && optional ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onChange(null);
            }}
            hitSlop={10}
            accessibilityLabel={`Clear ${label}`}
          >
            <Ionicons name="close-circle" size={16} color={colors.grey400} />
          </Pressable>
        ) : null}
      </Pressable>

      {showIosModal ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={closePicker}
        >
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalBackdrop} onPress={closePicker} accessibilityLabel="Close" />
            <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
              <View style={styles.modalBar}>
                <Pressable onPress={closePicker} hitSlop={8}>
                  <Text style={styles.modalAction}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {mode === 'datetime'
                    ? iosStep === 'date'
                      ? `${label} · Date`
                      : `${label} · Time`
                    : label}
                </Text>
                <Pressable onPress={confirmIos} hitSlop={8}>
                  <Text style={[styles.modalAction, styles.modalDone]}>{iosDoneLabel}</Text>
                </Pressable>
              </View>
              <View style={styles.pickerHost}>
                <DateTimePicker
                  value={iosDraft}
                  mode={iosPickerMode()}
                  display={iosDisplay()}
                  minimumDate={minimumDate}
                  onChange={(_event, selected) => {
                    if (!selected) return;
                    setIosDraft(selected);
                    if (mode !== 'datetime') onChange(selected);
                  }}
                  style={
                    iosPickerMode() === 'date' ? styles.iosInlineCalendar : styles.iosSpinner
                  }
                  themeVariant="light"
                />
              </View>
            </View>
          </View>
        </Modal>
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
  container: { marginBottom: spacing.md, alignSelf: 'stretch' },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
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
  fieldOpen: {
    borderColor: colors.info,
    backgroundColor: colors.infoLight,
  },
  value: { flex: 1, ...typography.body, color: colors.black, fontSize: 15, textAlign: 'left' },
  placeholder: { color: colors.grey400 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    width: '100%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  modalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey200,
  },
  modalTitle: {
    ...typography.subheading,
    flex: 1,
    textAlign: 'center',
    color: colors.black,
    fontSize: 16,
    marginHorizontal: spacing.sm,
  },
  modalAction: { ...typography.body, color: colors.grey600, fontWeight: '600', minWidth: 56 },
  modalDone: { color: colors.info, fontWeight: '700', textAlign: 'right' },
  pickerHost: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  iosInlineCalendar: { width: '100%', height: 360 },
  iosSpinner: { width: '100%', height: 216 },
  pressed: { opacity: 0.85 },
});
