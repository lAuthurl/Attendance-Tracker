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
  getAttendances,
  Attendance,
  getAttendanceHistory,
  AttendanceRecord,
} from "../../utils/storage";

export default function RecordsScreen() {
  const router = useRouter();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<
    AttendanceRecord[]
  >([]);

  const loadAttendances = useCallback(async () => {
    try {
      const [allAttendances, history] = await Promise.all([
        getAttendances(),
        getAttendanceHistory(),
      ]);
      setAttendances(allAttendances);
      setAttendanceHistory(history);
    } catch (error) {
      console.error("Error loading attendances:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAttendances();
    }, [loadAttendances])
  );

  // Listen for attendance changes and reload
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("attendanceChanged", () => {
      loadAttendances();
    });
    return () => sub.remove();
  }, [loadAttendances]);

  const calculateFailureLikelihood = (attendanceId: string) => {
    const records = attendanceHistory.filter(
      (record) => record.attendanceId === attendanceId
    );
    if (records.length === 0) {
      return {
        status: "No Data",
        color: "#757575",
        backgroundColor: "#F5F5F5",
        rate: 0,
      };
    }

    const attended = records.filter((record) => record.taken).length;
    const total = records.length;
    const attendanceRate = (attended / total) * 100;

    if (attendanceRate < 75) {
      return {
        status: "High Risk",
        color: "#F44336",
        backgroundColor: "#FFEBEE",
        rate: attendanceRate,
      };
    } else if (attendanceRate < 85) {
      return {
        status: "Medium Risk",
        color: "#FF9800",
        backgroundColor: "#FFF3E0",
        rate: attendanceRate,
      };
    } else {
      return {
        status: "Low Risk",
        color: "#4CAF50",
        backgroundColor: "#E8F5E9",
        rate: attendanceRate,
      };
    }
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
          <Text style={styles.headerTitle}>Records</Text>
        </View>

        <ScrollView
          style={styles.attendancesContainer}
          showsVerticalScrollIndicator={false}
        >
          {attendances.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No records to track</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push("/attendance/add")}
              >
                <Text style={styles.addButtonText}>Add Attendance</Text>
              </TouchableOpacity>
            </View>
          ) : (
            attendances.map((attendance) => {
              const failureStatus = calculateFailureLikelihood(attendance.id);

              return (
                <View key={attendance.id} style={styles.attendanceCard}>
                  <View style={styles.attendanceHeader}>
                    <View
                      style={[
                        styles.attendanceColor,
                        { backgroundColor: attendance.color },
                      ]}
                    />
                    <View style={styles.attendanceInfo}>
                      <Text style={styles.attendanceName}>
                        {attendance.name}
                      </Text>
                      <Text style={styles.attendanceCategory}>
                        {attendance.category}
                      </Text>
                      <Text
                        style={[
                          styles.attendanceRate,
                          { color: failureStatus.color },
                        ]}
                      >
                        Attendance Rate: {failureStatus.rate.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.statusContainer}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: failureStatus.backgroundColor },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: failureStatus.color },
                          ]}
                        >
                          {failureStatus.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
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
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 140 : 120,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 140 : 120,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
    justifyContent: "center",
    height: Platform.OS === "ios" ? 140 : 120,
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: "50%",
    transform: [{ translateY: -20 }], // Half the height of the button
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
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
  },
  attendancesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  attendanceCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  attendanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
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
  attendanceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  attendanceCategory: {
    fontSize: 14,
    color: "#666",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  capacityContainer: {
    marginTop: 15,
  },
  capacityInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  capacityLabel: {
    fontSize: 14,
    color: "#666",
  },
  capacityValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: "right",
  },
  capacityAlertInfo: {
    marginTop: 8,
  },
  statusContainer: {
    alignItems: "flex-end",
  },
  alertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  capacityAlertLabel: {
    fontSize: 12,
    color: "#666",
  },
  lastCapacityUpdate: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  capacityButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  refillButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: 30,
    backgroundColor: "white",
    borderRadius: 16,
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: "#1a8e2d",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: {
    color: "white",
    fontWeight: "600",
  },
  attendanceRate: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },
});
