import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  Alert,
  AppState,
  DeviceEventEmitter,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import {
  getAttendances,
  getTodaysAttendances,
  recordAttendance,
} from "../utils/storage.js";
import { useFocusEffect } from "@react-navigation/native";
import {
  registerForPushNotificationsAsync,
  scheduleAttendanceReminder,
} from "../utils/notifications.js";

const { width } = Dimensions.get("window");

// Create animated circle component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const QUICK_ACTIONS = [
  {
    icon: "add-circle-outline",
    label: "Add\nAttendance",
    route: "/attendance/add",
    color: "#2E7D32",
    gradient: ["#4CAF50", "#2E7D32"],
  },
  {
    icon: "calendar-outline",
    label: "Calendar\nView",
    route: "/calendar",
    color: "#1976D2",
    gradient: ["#2196F3", "#1976D2"],
  },
  {
    icon: "time-outline",
    label: "History\nLog",
    route: "/history",
    color: "#C2185B",
    gradient: ["#E91E63", "#C2185B"],
  },
  {
    icon: "people-outline",
    label: "Records\nTracker",
    route: "/records",
    color: "#E64A19",
    gradient: ["#FF5722", "#E64A19"],
  },
];

function CircularProgress({ progress, totalRecords, completedRecords }) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const size = width * 0.55;
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: progress,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTextContainer}>
        <Text style={styles.progressPercentage}>
          {Math.round(progress * 100)}%
        </Text>
        <Text style={styles.progressDetails}>
          {completedRecords} of {totalRecords} records
        </Text>
      </View>
      <Svg width={size} height={size} style={styles.progressRing}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="white"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [attendances, setAttendances] = useState([]);
  const [todaysAttendances, setTodaysAttendances] = useState([]);
  const [completedRecords, setCompletedRecords] = useState(0);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  const loadAttendances = useCallback(async () => {
    try {
      const [allAttendances, todaysRecords] = await Promise.all([
        getAttendances(),
        getTodaysAttendances(),
      ]);
      setAttendanceHistory(todaysRecords);
      setAttendances(allAttendances);

      // Filter attendances for today
      const today = new Date();
      const todayAttendances = allAttendances.filter((attendance) => {
        const startDate = new Date(attendance.startDate);
        const durationDays = parseInt(attendance.duration.split(" ")[0]);

        // For ongoing attendances or if within duration
        if (
          durationDays === -1 ||
          (today >= startDate &&
            today <=
              new Date(
                startDate.getTime() + durationDays * 24 * 60 * 60 * 1000
              ))
        ) {
          // Check if attendance is scheduled for today's day of week
          const dayOfWeek = today.getDay(); // 0-6 for Sunday-Saturday
          return attendance.schedule.some((day) => day.dayNumber === dayOfWeek);
        }
        return false;
      });

      setTodaysAttendances(todayAttendances);

      // Calculate completed records
      const completed = todaysRecords.filter((record) => record.taken).length;
      setCompletedRecords(completed);
    } catch (error) {
      console.error("Error loading attendances:", error);
    }
  }, []);

  const setupNotifications = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        console.log("Failed to get push notification token");
        return;
      }

      // Schedule reminders for all attendances
      const attendances = await getAttendances();
      for (const attendance of attendances) {
        if (attendance.reminderEnabled) {
          await scheduleAttendanceReminder(attendance);
        }
      }
    } catch (error) {
      console.error("Error setting up notifications:", error);
    }
  };

  // Use useEffect for initial load
  useEffect(() => {
    loadAttendances();
    setupNotifications();

    // Handle app state changes for notifications
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        loadAttendances();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Listen for attendance changes from storage and reload
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("attendanceChanged", () => {
      loadAttendances();
    });
    return () => sub.remove();
  }, [loadAttendances]);

  // Use useFocusEffect for subsequent updates
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = () => {
        // Cleanup if needed
      };

      loadAttendances();
      return () => unsubscribe();
    }, [loadAttendances])
  );

  const handleRecordAttendance = async (attendance) => {
    try {
      await recordAttendance(attendance.id, true, new Date().toISOString());
      await loadAttendances(); // Reload data after recording
    } catch (error) {
      console.error("Error recording attendance:", error);
      Alert.alert("Error", "Failed to record. Please try again.");
    }
  };

  const isAttendanceRecorded = (attendanceId) => {
    return attendanceHistory.some(
      (record) => record.attendanceId === attendanceId && record.taken
    );
  };

  const progress =
    todaysAttendances.length > 0
      ? completedRecords / (todaysAttendances.length * 2)
      : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#1a8e2d", "#146922"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.flex1}>
              <Text style={styles.greeting}>Daily Progress</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => setShowNotifications(true)}
            >
              <Ionicons name="notifications-outline" size={24} color="white" />
              {todaysAttendances.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationCount}>
                    {todaysAttendances.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <CircularProgress
            progress={progress}
            totalRecords={todaysAttendances.length * 2}
            completedRecords={completedRecords}
          />
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Link href={action.route} key={action.label} asChild>
                <TouchableOpacity style={styles.actionButton}>
                  <LinearGradient
                    colors={action.gradient}
                    style={styles.actionGradient}
                  >
                    <View style={styles.actionContent}>
                      <View style={styles.actionIcon}>
                        <Ionicons name={action.icon} size={28} color="white" />
                      </View>
                      <Text style={styles.actionLabel}>{action.label}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <Link href="/calendar" asChild>
              <TouchableOpacity>
                <Text style={styles.seeAllButton}>See All</Text>
              </TouchableOpacity>
            </Link>
          </View>
          {todaysAttendances.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>
                No attendance scheduled for today
              </Text>
              <Link href="/attendance/add" asChild>
                <TouchableOpacity style={styles.addAttendanceButton}>
                  <Text style={styles.addAttendanceButtonText}>
                    Add Attendance
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            todaysAttendances.map((attendance) => {
              const taken = isAttendanceRecorded(attendance.id);
              return (
                <View key={attendance.id} style={styles.recordCard}>
                  <View
                    style={[
                      styles.recordBadge,
                      { backgroundColor: `${attendance.color}15` },
                    ]}
                  >
                    <Ionicons
                      name="people"
                      size={24}
                      color={attendance.color}
                    />
                  </View>
                  <View style={styles.recordInfo}>
                    <View>
                      <Text style={styles.attendanceName}>
                        {attendance.name}
                      </Text>
                      <Text style={styles.categoryInfo}>
                        {attendance.category}
                      </Text>
                    </View>
                    <View style={styles.recordTime}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.timeText}>
                        {(() => {
                          const dayOfWeek = new Date().getDay();
                          const daySchedule = attendance.schedule.find(
                            (d) => d.dayNumber === dayOfWeek
                          );
                          return daySchedule?.times[0] || "No times set";
                        })()}
                      </Text>
                    </View>
                  </View>
                  {taken ? (
                    <View style={[styles.takenBadge]}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#4CAF50"
                      />
                      <Text style={styles.takenText}>Recorded</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.recordButton,
                        { backgroundColor: attendance.color },
                      ]}
                      onPress={() => handleRecordAttendance(attendance)}
                    >
                      <Text style={styles.recordButtonText}>Record</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>

      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <TouchableOpacity
                onPress={() => setShowNotifications(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {todaysAttendances.map((attendance) => (
              <View key={attendance.id} style={styles.notificationItem}>
                <View style={styles.notificationIcon}>
                  <Ionicons name="people" size={24} color={attendance.color} />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>
                    {attendance.name}
                  </Text>
                  <Text style={styles.notificationMessage}>
                    {attendance.category}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {(() => {
                      const dayOfWeek = new Date().getDay();
                      const daySchedule = attendance.schedule.find(
                        (d) => d.dayNumber === dayOfWeek
                      );
                      return daySchedule?.times[0] || "No times set";
                    })()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 15,
  },
  actionButton: {
    width: (width - 52) / 2,
    height: 110,
    borderRadius: 16,
    overflow: "hidden",
  },
  actionGradient: {
    flex: 1,
    padding: 15,
  },
  actionContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 5,
  },
  seeAllButton: {
    color: "#2E7D32",
    fontWeight: "600",
  },
  recordCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  recordBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  recordInfo: {
    flex: 1,
    justifyContent: "space-between",
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
    marginBottom: 4,
  },
  recordTime: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    marginLeft: 5,
    color: "#666",
    fontSize: 14,
  },
  recordButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
    marginLeft: 10,
  },
  recordButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  progressContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  progressTextContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  progressPercentage: {
    fontSize: 36,
    fontWeight: "bold",
    color: "white",
  },
  progressLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 4,
  },
  progressRing: {
    transform: [{ rotate: "-90deg" }],
  },
  flex1: {
    flex: 1,
  },
  notificationButton: {
    position: "relative",
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    marginLeft: 8,
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF5252",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#146922",
    paddingHorizontal: 4,
  },
  notificationCount: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  progressDetails: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 5,
  },
  notificationItem: {
    flexDirection: "row",
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    marginBottom: 10,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: "#999",
  },
  emptyState: {
    alignItems: "center",
    padding: 30,
    backgroundColor: "white",
    borderRadius: 16,
    marginTop: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
    marginBottom: 20,
  },
  addAttendanceButton: {
    backgroundColor: "#1a8e2d",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addAttendanceButtonText: {
    color: "white",
    fontWeight: "600",
  },
  takenBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 10,
  },
  takenText: {
    color: "#4CAF50",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
});
