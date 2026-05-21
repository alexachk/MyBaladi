import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { buildMonthGrid, addMonths, monthLabel } from '../utils/calendarGrid';
import { todayIsoDate } from '../utils/formatDate';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_DOTS = 4;

export interface DayMarker {
  memberId: string;
  color: string;
  count: number;
}

interface MonthCalendarProps {
  year: number;
  month: number;
  selectedDate: string;
  markersByDate: Record<string, DayMarker[]>;
  holidaysByDate?: Record<string, string[]>;
  onSelectDate: (iso: string) => void;
  onMonthChange: (year: number, month: number) => void;
  embedded?: boolean;
}

function formatCount(count: number): string {
  return count > 9 ? '9+' : String(count);
}

export function MonthCalendar({
  year,
  month,
  selectedDate,
  markersByDate,
  holidaysByDate = {},
  onSelectDate,
  onMonthChange,
  embedded = false,
}: MonthCalendarProps) {
  const today = todayIsoDate();
  const cells = buildMonthGrid(year, month);

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      <View style={styles.nav}>
        <Pressable
          onPress={() => {
            const next = addMonths(year, month, -1);
            onMonthChange(next.year, next.month);
          }}
          hitSlop={10}
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.black} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel(year, month)}</Text>
        <Pressable
          onPress={() => {
            const next = addMonths(year, month, 1);
            onMonthChange(next.year, next.month);
          }}
          hitSlop={10}
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.black} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const markers = markersByDate[cell.iso] ?? [];
          const holidayLabels = holidaysByDate[cell.iso] ?? [];
          const isHoliday = holidayLabels.length > 0;
          const isSelected = cell.iso === selectedDate;
          const isToday = cell.iso === today;
          const visible = markers.slice(0, MAX_DOTS);
          const overflow = markers.length - MAX_DOTS;

          return (
            <Pressable
              key={cell.iso}
              onPress={() => onSelectDate(cell.iso)}
              style={({ pressed }) => [
                styles.cell,
                !cell.inMonth && styles.cellOutside,
                isHoliday && !isSelected && styles.cellHoliday,
                isSelected && styles.cellSelected,
                isToday && !isSelected && styles.cellToday,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  !cell.inMonth && styles.dayTextOutside,
                  isHoliday && !isSelected && styles.dayTextHoliday,
                  isSelected && styles.dayTextSelected,
                ]}
              >
                {cell.day}
              </Text>
              {isHoliday ? (
                <View style={[styles.holidayPip, isSelected && styles.holidayPipSelected]} />
              ) : null}
              {markers.length === 0 ? (
                <View style={styles.markerSpacer} />
              ) : markers.length === 1 ? (
                <View
                  style={[
                    styles.singleMarker,
                    { backgroundColor: markers[0].color },
                    isSelected && styles.singleMarkerSelected,
                  ]}
                >
                  <Text style={styles.singleMarkerText}>{formatCount(markers[0].count)}</Text>
                </View>
              ) : (
                <View style={styles.multiRow}>
                  {visible.map((m) => (
                    <View
                      key={m.memberId}
                      style={[styles.multiDot, { backgroundColor: m.color }]}
                    >
                      <Text style={styles.multiDotText}>{formatCount(m.count)}</Text>
                    </View>
                  ))}
                  {overflow > 0 ? (
                    <View style={styles.overflowDot}>
                      <Text style={styles.overflowText}>+{overflow}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.md,
    gap: spacing.sm,
  },
  wrapEmbedded: {
    borderWidth: 0,
    borderRadius: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.grey200,
    paddingTop: spacing.sm,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grey100,
  },
  monthLabel: { ...typography.subheading, color: colors.black },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingVertical: 2,
  },
  cellOutside: { opacity: 0.35 },
  cellHoliday: { backgroundColor: '#FFF8E8' },
  cellSelected: { backgroundColor: colors.black },
  cellToday: { borderWidth: 1, borderColor: colors.primary },
  dayText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  dayTextOutside: { color: colors.grey600 },
  dayTextHoliday: { color: colors.warning },
  dayTextSelected: { color: colors.white },
  holidayPip: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.error,
    marginTop: 1,
  },
  holidayPipSelected: { backgroundColor: colors.primary },
  markerSpacer: { height: 16, marginTop: 2 },
  singleMarker: {
    marginTop: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleMarkerSelected: { borderWidth: 1, borderColor: colors.white },
  singleMarkerText: { fontSize: 9, fontWeight: '700', color: colors.white },
  multiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    marginTop: 2,
    maxWidth: '100%',
    paddingHorizontal: 1,
  },
  multiDot: {
    minWidth: 13,
    height: 13,
    paddingHorizontal: 2,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiDotText: { fontSize: 7, fontWeight: '700', color: colors.white },
  overflowDot: {
    minWidth: 13,
    height: 13,
    paddingHorizontal: 2,
    borderRadius: 7,
    backgroundColor: colors.grey400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: { fontSize: 7, fontWeight: '700', color: colors.white },
  pressed: { opacity: 0.85 },
});
