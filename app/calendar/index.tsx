import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getAttendances,
  getAttendanceHistory,
  recordAttendance,
  Attendance,
  AttendanceRecord,
} from "../../utils/storage";
import {
  hasTimePassed,
  formatTime,
  getGracePeriodRemaining,
} from "../../utils/dateHelpers";
import { useFocusEffect } from "@react-navigation/native";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<
    AttendanceRecord[]
  >([]);

  const loadData = useCallback(async () => {
    try {
      const [attList, history] = await Promise.all([
        getAttendances(),
        getAttendanceHistory(),
      ]);
      setAttendances(attList);
      setAttendanceHistory(history);
    } catch (error) {
      console.error("Error loading calendar data:", error);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  // Determine if an attendance should appear on a particular date.
  // Uses startDate, duration, frequency and days (for "As needed").
  const isAttendanceOnDate = (attendance: Attendance, date: Date) => {
    try {
      const start = new Date(attendance.startDate);
      // Normalize to midnight for comparisons
      const normalize = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const nd = normalize(date);
      const ns = normalize(start);

      // Parse duration like "7 days" or "Ongoing". If missing, assume 1 day.
      let durationDays = 1;
      if (attendance.duration) {
        const dur = attendance.duration.toString();
        if (/ongoing/i.test(dur)) {
          durationDays = Infinity;
        } else {
          const m = dur.match(/(\d+)/);
          durationDays = m ? Number(m[0]) : 1;
        }
      }

      // Compute end date (inclusive)
      const end =
        durationDays === Infinity
          ? null
          : new Date(ns.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000);

      // If date is before start or after end (when end exists), it's not scheduled
      if (nd < ns) return false;
      if (end && nd > normalize(end)) return false;

      const freq = (attendance.frequency || "").toString();

      // As-needed scheduling uses explicit weekdays stored in attendance.days (e.g. ["Mon","Wed"]).
      if (freq === "As needed" || attendance.days?.length) {
        const days: string[] = attendance.days || [];
        if (days.length === 0) {
          // If no specific days, treat as available every day in the date range
          return true;
        }
        // Map JS getDay() to Mon/Tue... used in add screen. getDay(): 0=Sun,1=Mon...
        const weekdayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const wd = weekdayMap[nd.getDay()];
        return days.includes(wd);
      }

      // Weekly frequencies: show on the same weekday as the start date.
      if (/weekly/i.test(freq)) {
        return nd.getDay() === ns.getDay();
      }

      // Daily frequencies (once/twice daily) — show on any date within the range.
      if (
        /daily/i.test(freq) ||
        /twice daily/i.test(freq) ||
        /once daily/i.test(freq)
      ) {
        return true;
      }

      // Default: if within date range, show it.
      return true;
    } catch (e) {
      console.error("isAttendanceOnDate error", e);
      return false;
    }
  };

  const { days, firstDay } = getDaysInMonth(selectedDate);

  const renderCalendar = () => {
    const calendar: JSX.Element[] = [];
    let week: JSX.Element[] = [];
    let totalCells = 0;

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      week.push(<View key={`empty-start-${i}`} style={styles.calendarDay} />);
      totalCells++;
    }

    // Add days of the month
    for (let day = 1; day <= days; day++) {
      const date = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        day
      );
      const isToday = new Date().toDateString() === date.toDateString();
      const hasRecords = attendanceHistory.some(
        (record) =>
          new Date(record.timestamp).toDateString() === date.toDateString()
      );

      week.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isToday && styles.today,
            hasRecords && styles.hasEvents,
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <Text style={[styles.dayText, isToday && styles.todayText]}>
            {day}
          </Text>
          {hasRecords && <View style={styles.eventDot} />}
        </TouchableOpacity>
      );

      totalCells++;

      if (totalCells % 7 === 0 || day === days) {
        // Fill the remaining cells of the last week with empty cells
        if (day === days) {
          const remainingCells = 7 - (totalCells % 7);
          if (remainingCells !== 7) {
            for (let i = 0; i < remainingCells; i++) {
              week.push(
                <View key={`empty-end-${i}`} style={styles.calendarDay} />
              );
            }
          }
        }

        calendar.push(
          <View key={day} style={styles.calendarWeek}>
            {week}
          </View>
        );
        week = [];
      }
    }
    return calendar;
  };

  const renderAttendancesForDate = () => {
    const dateStr = selectedDate.toDateString();
    const dayRecords = attendanceHistory.filter(
      (record) => new Date(record.timestamp).toDateString() === dateStr
    );

    // Only show attendances that are scheduled for the selected date
    const scheduled = attendances.filter((attendance) =>
      isAttendanceOnDate(attendance, selectedDate)
    );

    return scheduled.map((attendance) => {
      const taken = dayRecords.some(
        (record) => record.attendanceId === attendance.id && record.taken
      );

      const isTimePassedForAll = attendance.times.every((time) =>
        hasTimePassed(time, selectedDate)
      );

      // Don't automatically mark as missed if it's a future date
      const now = new Date();
      const isFutureDate = selectedDate.toDateString() > now.toDateString();

      // If all times have passed for today and not taken, automatically mark as missed
      if (isTimePassedForAll && !taken && !isFutureDate) {
        // Auto-record as missed
        setTimeout(() => {
          recordAttendance(attendance.id, false, selectedDate.toISOString());
          loadData();
        }, 0);
      }

      return (
        <View key={attendance.id} style={styles.attendanceCard}>
          <View
            style={[
              styles.attendanceColor,
              { backgroundColor: attendance.color },
            ]}
          />
          <View style={styles.attendanceInfo}>
            <Text style={styles.attendanceName}>{attendance.name}</Text>
            <Text style={styles.categoryInfo}>{attendance.category}</Text>
            <Text style={styles.timeText}>
              {attendance.times.map((time, index) => (
                <Text key={time}>
                  {time}
                  {index < attendance.times.length - 1 ? ", " : ""}
                </Text>
              ))}
            </Text>
          </View>
          {taken ? (
            // When already recorded show the badge (pressable to undo)
            <View style={{ alignItems: "flex-end" }}>
              <TouchableOpacity
                style={styles.takenBadge}
                onPress={async () => {
                  await recordAttendance(
                    attendance.id,
                    false,
                    selectedDate.toISOString()
                  );
                  loadData();
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.takenText}>Recorded</Text>
              </TouchableOpacity>
            </View>
          ) : (
            (() => {
              // Check grace period for each time
              const graceMinutes = attendance.times
                .map((time) => getGracePeriodRemaining(time, selectedDate))
                .filter((mins) => mins !== null)
                .sort((a, b) => b! - a!)[0]; // Get the longest remaining grace period

              if (graceMinutes !== null) {
                // Still in grace period
                return (
                  <View style={{ alignItems: "flex-end" }}>
                    <TouchableOpacity
                      style={[
                        styles.recordButton,
                        { backgroundColor: attendance.color },
                      ]}
                      onPress={async () => {
                        await recordAttendance(
                          attendance.id,
                          true,
                          selectedDate.toISOString()
                        );
                        loadData();
                      }}
                    >
                      <Text style={styles.recordButtonText}>
                        Record ({graceMinutes}m left)
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              } else if (isTimePassedForAll && !isFutureDate) {
                return (
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={styles.missedBadge}>
                      <Ionicons name="close-circle" size={20} color="#F44336" />
                      <Text style={styles.missedText}>Missed</Text>
                    </View>
                  </View>
                );
              } else {
                return (
                  <View style={{ alignItems: "flex-end" }}>
                    <TouchableOpacity
                      style={[
                        styles.recordButton,
                        { backgroundColor: attendance.color },
                      ]}
                      onPress={async () => {
                        await recordAttendance(
                          attendance.id,
                          true,
                          selectedDate.toISOString()
                        );
                        loadData();
                      }}
                    >
                      <Text style={styles.recordButtonText}>Record</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
            })()
          )}
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1a8e2d", "#146922"]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="#1a8e2d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Calendar</Text>
        </View>

        <View style={styles.calendarContainer}>
          <View style={styles.monthHeader}>
            <TouchableOpacity
              onPress={() =>
                setSelectedDate(
                  new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth() - 1,
                    1
                  )
                )
              }
            >
              <Ionicons name="chevron-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {selectedDate.toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <TouchableOpacity
              onPress={() =>
                setSelectedDate(
                  new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth() + 1,
                    1
                  )
                )
              }
            >
              <Ionicons name="chevron-forward" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayHeader}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekdayText}>
                {day}
              </Text>
            ))}
          </View>

          {renderCalendar()}
        </View>

        <View style={styles.scheduleContainer}>
          <Text style={styles.scheduleTitle}>
            {selectedDate.toLocaleDateString("default", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderAttendancesForDate()}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 140 : 120,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginLeft: 15,
  },
  calendarContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    margin: 20,
    padding: 15,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 380, // Ensure consistent height for calendar
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  monthText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  weekdayHeader: {
    flexDirection: "row",
    marginBottom: 10,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    color: "#666",
    fontWeight: "500",
  },
  calendarWeek: {
    flexDirection: "row",
    height: 45, // Fixed height for each week
    marginBottom: 2,
  },
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  dayText: {
    fontSize: 16,
    color: "#333",
  },
  today: {
    backgroundColor: "#1a8e2d15",
  },
  todayText: {
    color: "#1a8e2d",
    fontWeight: "600",
  },
  hasEvents: {
    position: "relative",
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1a8e2d",
    position: "absolute",
    bottom: "15%",
  },
  scheduleContainer: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scheduleTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 15,
  },
  attendanceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  attendanceColor: {
    width: 12,
    height: 40,
    borderRadius: 6,
    marginRight: 15,
  },
  attendanceInfo: {
    flex: 1,
  },
  attendanceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  categoryInfo: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  timeText: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  recordButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 12,
  },
  recordButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  takenBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  takenText: {
    color: "#4CAF50",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
  undoButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "white",
  },
  undoButtonText: {
    color: "#1a8e2d",
    fontWeight: "600",
    fontSize: 13,
  },
  missedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  missedText: {
    color: "#F44336",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
});
