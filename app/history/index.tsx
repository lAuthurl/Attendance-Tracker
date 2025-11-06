import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  DeviceEventEmitter,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import {
  getAttendanceHistory,
  getAttendances,
  AttendanceRecord,
  Attendance,
  clearAllData,
} from "../../utils/storage";

type EnrichedAttendanceHistory = AttendanceRecord & { attendance?: Attendance };

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<EnrichedAttendanceHistory[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "taken" | "missed"
  >("all");

  const loadHistory = useCallback(async () => {
    try {
      const [recordHistory, attendances] = await Promise.all([
        getAttendanceHistory(),
        getAttendances(),
      ]);

      // Combine history with attendance details
      const enrichedHistory = recordHistory.map((record) => ({
        ...record,
        attendance: attendances.find((a) => a.id === record.attendanceId),
      }));

      setHistory(enrichedHistory);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  // Listen for changes to attendance history and reload
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("attendanceChanged", () => {
      loadHistory();
    });
    return () => sub.remove();
  }, [loadHistory]);

  const filteredHistory = history.filter((record) => {
    switch (selectedFilter) {
      case "taken":
        return record.taken;
      case "missed":
        return !record.taken;
      case "all":
      default:
        return true;
    }
  });

  const groupHistoryByDate = (records: EnrichedAttendanceHistory[]) => {
    const grouped = records.reduce((acc, record) => {
      const date = new Date(record.timestamp).toDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(record);
      return acc;
    }, {} as Record<string, EnrichedAttendanceHistory[]>);

    // Only return dates that have records after filtering
    const nonEmptyGroups = Object.entries(grouped).filter(
      ([_, records]) => records.length > 0
    );

    return nonEmptyGroups.sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  };

  // Calculate attendance statistics and failure likelihood for a specific attendance
  const calculateAttendanceStatistics = (attendanceId: string) => {
    const attendanceRecords = history.filter(
      (record) => record.attendanceId === attendanceId
    );
    const stats = attendanceRecords.reduce(
      (acc, record) => {
        if (record.taken) {
          acc.attended++;
        } else {
          acc.missed++;
        }
        acc.total++;
        return acc;
      },
      { attended: 0, missed: 0, total: 0 }
    );

    const attendanceRate =
      stats.total > 0 ? (stats.attended / stats.total) * 100 : 100;
    const failureLikelihood =
      attendanceRate < 75 ? "High" : attendanceRate < 85 ? "Medium" : "Low";
    const failureColor =
      failureLikelihood === "High"
        ? "#F44336"
        : failureLikelihood === "Medium"
        ? "#FFA726"
        : "#4CAF50";

    return {
      ...stats,
      attendanceRate: attendanceRate.toFixed(1),
      failureLikelihood,
      failureColor,
    };
  };

  const groupedHistory = groupHistoryByDate(filteredHistory);

  const handleClearAllData = () => {
    Alert.alert(
      "Clear All Data",
      "Are you sure you want to clear all attendance data? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllData();
              await loadHistory();
              Alert.alert("Success", "All data has been cleared successfully");
            } catch (error) {
              console.error("Error clearing data:", error);
              Alert.alert("Error", "Failed to clear data. Please try again.");
            }
          },
        },
      ]
    );
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
          <Text style={styles.headerTitle}>History Log</Text>
        </View>

        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
          >
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedFilter === "all" && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter("all")}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === "all" && styles.filterTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedFilter === "taken" && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter("taken")}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === "taken" && styles.filterTextActive,
                ]}
              >
                Recorded
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedFilter === "missed" && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter("missed")}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === "missed" && styles.filterTextActive,
                ]}
              >
                Missed
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <ScrollView
          style={styles.historyContainer}
          showsVerticalScrollIndicator={false}
        >
          {groupedHistory.map(([date, records]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>
                {new Date(date).toLocaleDateString("default", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              {records.map((record) => {
                const stats = calculateAttendanceStatistics(
                  record.attendanceId
                );
                return (
                  <View key={record.id} style={styles.historyCard}>
                    <View
                      style={[
                        styles.attendanceColor,
                        { backgroundColor: record.attendance?.color || "#ccc" },
                      ]}
                    />
                    <View style={styles.attendanceInfo}>
                      <View style={styles.attendanceHeader}>
                        <Text style={styles.attendanceName}>
                          {record.attendance?.name || "Unknown Attendance"}
                        </Text>
                        <View
                          style={[
                            styles.failureBadge,
                            { backgroundColor: `${stats.failureColor}15` },
                          ]}
                        >
                          <Text
                            style={[
                              styles.failureLikelihoodValue,
                              { color: stats.failureColor },
                            ]}
                          >
                            {stats.failureLikelihood} Risk
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.categoryInfo}>
                        {record.attendance?.category} • {stats.attendanceRate}%
                        Attendance
                      </Text>
                      <Text style={styles.timeText}>
                        {new Date(record.timestamp).toLocaleTimeString(
                          "default",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </Text>
                    </View>
                    <View style={styles.statusContainer}>
                      {record.taken ? (
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: "#E8F5E9" },
                          ]}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color="#4CAF50"
                          />
                          <Text
                            style={[styles.statusText, { color: "#4CAF50" }]}
                          >
                            Recorded
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: "#FFEBEE" },
                          ]}
                        >
                          <Ionicons
                            name="close-circle"
                            size={16}
                            color="#F44336"
                          />
                          <Text
                            style={[styles.statusText, { color: "#F44336" }]}
                          >
                            Missed
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          <View style={styles.clearDataContainer}>
            <TouchableOpacity
              style={styles.clearDataButton}
              onPress={handleClearAllData}
            >
              <Ionicons name="trash-outline" size={20} color="#FF5252" />
              <Text style={styles.clearDataText}>Clear All Data</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  statsCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  borderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: "#e0e0e0",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  failureLikelihoodContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  failureLikelihoodLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  failureBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  failureLikelihoodValue: {
    fontSize: 14,
    fontWeight: "600",
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
  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#f8f9fa",
    paddingTop: 10,
  },
  filtersScroll: {
    paddingRight: 20,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "white",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  filterButtonActive: {
    backgroundColor: "#1a8e2d",
    borderColor: "#1a8e2d",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  filterTextActive: {
    color: "white",
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: "#f8f9fa",
  },
  dateGroup: {
    marginBottom: 25,
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
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
    marginRight: 16,
  },
  attendanceInfo: {
    flex: 1,
  },
  attendanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
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
  },
  statusContainer: {
    alignItems: "flex-end",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "600",
  },
  clearDataContainer: {
    padding: 20,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  clearDataButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  clearDataText: {
    color: "#FF5252",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
