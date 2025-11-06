import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { addAttendance } from "../../utils/storage.js";
import {
  scheduleAttendanceReminder,
  scheduleCapacityReminder,
} from "../../utils/notifications.js";

const { width } = Dimensions.get("window");

// Define available time slots that can be used for each day
const DEFAULT_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DURATIONS = [
  { id: "1", label: "7 days", value: 7, icon: "calendar" },
  { id: "2", label: "14 days", value: 14, icon: "calendar" },
  { id: "3", label: "30 days", value: 30, icon: "calendar" },
  { id: "4", label: "90 days", value: 90, icon: "calendar" },
  { id: "5", label: "Ongoing", value: -1, icon: "infinite" },
  { id: "6", label: "Custom", value: 0, icon: "create" },
];

export default function AddAttendanceScreen() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    category: "",
    duration: "",
    startDate: new Date(),
    notes: "",
    reminderEnabled: true,
    capacityReminder: false,
    currentCapacity: "",
    capacityAlertAt: "",
    customDurationDays: "",
    schedule: WEEKDAYS.map((_, index) => ({
      day: index,
      times: [],
    })),
  });

  const [errors, setErrors] = useState({});
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!form.name.trim()) {
      newErrors.name = "Attendance name is required";
    }

    if (!form.category.trim()) {
      newErrors.category = "Category is required";
    }

    // Ensure at least one day has times scheduled
    const hasScheduledTimes = form.schedule.some((day) => day.times.length > 0);
    if (!hasScheduledTimes) {
      newErrors.schedule = "Please schedule at least one time";
    }

    if (!form.duration) {
      newErrors.duration = "Duration is required";
    }

    // If user picked Custom duration, ensure a numeric value was entered
    if (selectedDuration === "Custom") {
      if (!form.customDurationDays || Number(form.customDurationDays) <= 0) {
        newErrors.duration =
          "Please enter a valid number of days for custom duration";
      }
    }

    if (form.capacityReminder) {
      if (!form.currentCapacity) {
        newErrors.currentCapacity =
          "Current capacity is required for capacity tracking";
      }
      if (!form.capacityAlertAt) {
        newErrors.capacityAlertAt = "Capacity alert threshold is required";
      }
      if (Number(form.capacityAlertAt) >= Number(form.currentCapacity)) {
        newErrors.capacityAlertAt =
          "Capacity alert must be less than current capacity";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    try {
      if (!validateForm()) {
        Alert.alert("Error", "Please fill in all required fields correctly");
        return;
      }

      if (isSubmitting) return;
      setIsSubmitting(true);

      // Generate a random color
      const colors = ["#4CAF50", "#2196F3", "#FF9800", "#E91E63", "#9C27B0"];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const durationForSave =
        selectedDuration === "Custom"
          ? form.customDurationDays
            ? `${form.customDurationDays} days`
            : ""
          : form.duration;

      // Convert schedule to simpler format for storage
      const scheduledDays = form.schedule
        .map((day, index) => ({
          dayNumber: index,
          times: day.times,
        }))
        .filter((day) => day.times.length > 0);

      const attendanceData = {
        id: Math.random().toString(36).substr(2, 9),
        ...form,
        schedule: scheduledDays,
        duration: durationForSave,
        currentCapacity: form.currentCapacity
          ? Number(form.currentCapacity)
          : 0,
        totalCapacity: form.currentCapacity ? Number(form.currentCapacity) : 0,
        capacityAlertAt: form.capacityAlertAt
          ? Number(form.capacityAlertAt)
          : 0,
        startDate: form.startDate.toISOString(),
        color: randomColor,
      };

      await addAttendance(attendanceData);

      // Schedule reminders if enabled
      if (attendanceData.reminderEnabled) {
        await scheduleAttendanceReminder(attendanceData);
      }
      if (attendanceData.capacityReminder) {
        await scheduleCapacityReminder(attendanceData);
      }

      Alert.alert(
        "Success",
        "Attendance added successfully",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert(
        "Error",
        "Failed to save attendance. Please try again.",
        [{ text: "OK" }],
        { cancelable: false }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDayScheduleChange = (dayIndex, times) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((daySchedule, index) =>
        index === dayIndex ? { ...daySchedule, times } : daySchedule
      ),
    }));
  };

  const handleDurationSelect = (dur) => {
    setSelectedDuration(dur);
    setForm((prev) => ({ ...prev, duration: dur }));
    if (errors.duration) {
      setErrors((prev) => ({ ...prev, duration: "" }));
    }
  };

  const renderScheduleOptions = () => {
    return (
      <View style={styles.scheduleContainer}>
        {WEEKDAYS.map((day, index) => (
          <View key={day} style={styles.daySchedule}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{day}</Text>
              <TouchableOpacity
                style={styles.addTimeButton}
                onPress={() => {
                  const daySchedule = form.schedule[index];
                  handleDayScheduleChange(index, [
                    ...daySchedule.times,
                    DEFAULT_TIMES[0],
                  ]);
                }}
              >
                <Ionicons name="add-circle-outline" size={24} color="#1a8e2d" />
              </TouchableOpacity>
            </View>
            {form.schedule[index].times.map((time, timeIndex) => (
              <TouchableOpacity
                key={`${day}-${timeIndex}`}
                style={styles.timeButton}
                onPress={() => {
                  setForm((prev) => ({
                    ...prev,
                    selectedDayIndex: index,
                    selectedTimeIndex: timeIndex,
                  }));
                  setShowTimePicker(true);
                }}
              >
                <View style={styles.timeIconContainer}>
                  <Ionicons name="time-outline" size={20} color="#1a8e2d" />
                </View>
                <Text style={styles.timeButtonText}>{time}</Text>
                <TouchableOpacity
                  onPress={() => {
                    const daySchedule = form.schedule[index];
                    handleDayScheduleChange(
                      index,
                      daySchedule.times.filter((_, i) => i !== timeIndex)
                    );
                  }}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderDurationOptions = () => {
    return (
      <View style={styles.optionsGrid}>
        {DURATIONS.map((dur) => (
          <TouchableOpacity
            key={dur.id}
            style={[
              styles.optionCard,
              selectedDuration === dur.label && styles.selectedOptionCard,
            ]}
            onPress={() => {
              setSelectedDuration(dur.label);
              setForm((prev) => ({ ...prev, duration: dur.label }));
            }}
          >
            <View style={styles.optionIcon}>
              <Ionicons
                name={dur.icon}
                size={26}
                color={selectedDuration === dur.label ? "white" : "#1a8e2d"}
              />
            </View>
            <Text
              style={[
                styles.durationNumber,
                selectedDuration === dur.label && styles.selectedDurationNumber,
              ]}
            >
              {dur.value > 0 ? dur.value : dur.label === "Ongoing" ? "∞" : "-"}
            </Text>
            <Text
              style={[
                styles.optionLabel,
                selectedDuration === dur.label && styles.selectedOptionLabel,
              ]}
            >
              {dur.label}
            </Text>
          </TouchableOpacity>
        ))}
        {selectedDuration === "Custom" && (
          <View style={{ width: "100%", marginTop: 12 }}>
            <Text style={{ marginBottom: 8, fontWeight: "600" }}>
              Enter duration (days)
            </Text>
            <View style={[styles.inputContainer, { padding: 0 }]}>
              <TextInput
                style={[styles.input, { padding: 12 }]}
                placeholder="e.g. 14"
                placeholderTextColor="#999"
                value={form.customDurationDays}
                onChangeText={(text) =>
                  setForm((prev) => ({ ...prev, customDurationDays: text }))
                }
                keyboardType="numeric"
              />
            </View>
          </View>
        )}
      </View>
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
          <Text style={styles.headerTitle}>New Attendance</Text>
        </View>

        <ScrollView
          style={styles.formContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.formContentContainer}
        >
          {/* Basic Information */}
          <View style={styles.section}>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.mainInput, errors.name && styles.inputError]}
                placeholder="Name"
                placeholderTextColor="#999"
                value={form.name}
                onChangeText={(text) => {
                  setForm({ ...form, name: text });
                  if (errors.name) {
                    setErrors({ ...errors, name: "" });
                  }
                }}
              />
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.mainInput, errors.category && styles.inputError]}
                placeholder="Details"
                placeholderTextColor="#999"
                value={form.category}
                onChangeText={(text) => {
                  setForm({ ...form, category: text });
                  if (errors.category) {
                    setErrors({ ...errors, category: "" });
                  }
                }}
              />
              {errors.category && (
                <Text style={styles.errorText}>{errors.category}</Text>
              )}
            </View>
          </View>

          {/* Schedule */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How often?</Text>
            {renderScheduleOptions()}

            <Text style={styles.sectionTitle}>For how long?</Text>
            {errors.duration && (
              <Text style={styles.errorText}>{errors.duration}</Text>
            )}
            {renderDurationOptions()}

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.dateIconContainer}>
                <Ionicons name="calendar" size={20} color="#1a8e2d" />
              </View>
              <Text style={styles.dateButtonText}>
                Starts {form.startDate.toLocaleDateString()}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={form.startDate}
                mode="date"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setForm({ ...form, startDate: date });
                }}
              />
            )}

            {errors.schedule && (
              <Text style={styles.errorText}>{errors.schedule}</Text>
            )}

            {showTimePicker && (
              <DateTimePicker
                value={() => {
                  const dayIndex = form.selectedDayIndex ?? 0;
                  const timeIndex = form.selectedTimeIndex ?? 0;
                  const [hours, minutes] = (
                    form.schedule[dayIndex]?.times[timeIndex] || "09:00"
                  )
                    .split(":")
                    .map(Number);
                  const date = new Date();
                  date.setHours(hours, minutes, 0, 0);
                  return date;
                }}
                mode="time"
                onChange={(event, date) => {
                  setShowTimePicker(false);
                  if (date && typeof form.selectedDayIndex === "number") {
                    const newTime = date.toLocaleTimeString("default", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    });

                    const daySchedule = form.schedule[form.selectedDayIndex];
                    if (daySchedule) {
                      const newTimes = [...daySchedule.times];
                      if (typeof form.selectedTimeIndex === "number") {
                        newTimes[form.selectedTimeIndex] = newTime;
                      }
                      handleDayScheduleChange(form.selectedDayIndex, newTimes);
                    }
                  }
                }}
              />
            )}
          </View>

          {/* Reminders */}
          <View style={styles.section}>
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="notifications" size={20} color="#1a8e2d" />
                  </View>
                  <View>
                    <Text style={styles.switchLabel}>Reminders</Text>
                    <Text style={styles.switchSubLabel}>
                      Get notified when it's time to record attendance
                    </Text>
                  </View>
                </View>
                <Switch
                  value={form.reminderEnabled}
                  onValueChange={(value) =>
                    setForm({ ...form, reminderEnabled: value })
                  }
                  trackColor={{ false: "#ddd", true: "#1a8e2d" }}
                  thumbColor="white"
                />
              </View>
            </View>
          </View>

          {/* Capacity Tracking */}
          <View style={styles.section}>
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="reload" size={20} color="#1a8e2d" />
                  </View>
                  <View>
                    <Text style={styles.switchLabel}>Capacity Tracking</Text>
                    <Text style={styles.switchSubLabel}>
                      Get notified when capacity is low
                    </Text>
                  </View>
                </View>
                <Switch
                  value={form.capacityReminder}
                  onValueChange={(value) => {
                    setForm({ ...form, capacityReminder: value });
                    if (!value) {
                      setErrors({
                        ...errors,
                        currentCapacity: "",
                        capacityAlertAt: "",
                      });
                    }
                  }}
                  trackColor={{ false: "#ddd", true: "#1a8e2d" }}
                  thumbColor="white"
                />
              </View>
              {form.capacityReminder && (
                <View style={styles.capacityInputs}>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputContainer, styles.flex1]}>
                      <TextInput
                        style={[
                          styles.input,
                          errors.currentCapacity && styles.inputError,
                        ]}
                        placeholder="Current Capacity"
                        placeholderTextColor="#999"
                        value={form.currentCapacity}
                        onChangeText={(text) => {
                          setForm({ ...form, currentCapacity: text });
                          if (errors.currentCapacity) {
                            setErrors({ ...errors, currentCapacity: "" });
                          }
                        }}
                        keyboardType="numeric"
                      />
                      {errors.currentCapacity && (
                        <Text style={styles.errorText}>
                          {errors.currentCapacity}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.inputContainer, styles.flex1]}>
                      <TextInput
                        style={[
                          styles.input,
                          errors.capacityAlertAt && styles.inputError,
                        ]}
                        placeholder="Alert at"
                        placeholderTextColor="#999"
                        value={form.capacityAlertAt}
                        onChangeText={(text) => {
                          setForm({ ...form, capacityAlertAt: text });
                          if (errors.capacityAlertAt) {
                            setErrors({ ...errors, capacityAlertAt: "" });
                          }
                        }}
                        keyboardType="numeric"
                      />
                      {errors.capacityAlertAt && (
                        <Text style={styles.errorText}>
                          {errors.capacityAlertAt}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                placeholder="Add notes or special instructions..."
                placeholderTextColor="#999"
                value={form.notes}
                onChangeText={(text) => setForm({ ...form, notes: text })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              isSubmitting && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSubmitting}
          >
            <LinearGradient
              colors={["#1a8e2d", "#146922"]}
              style={styles.saveButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.saveButtonText}>
                {isSubmitting ? "Adding..." : "Add Attendance"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scheduleContainer: {
    marginTop: 10,
  },
  daySchedule: {
    marginBottom: 20,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dayName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  addTimeButton: {
    padding: 8,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  dayButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    margin: 6,
  },
  selectedDayButton: {
    backgroundColor: "#1a8e2d",
    borderColor: "#1a8e2d",
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
    transform: [{ translateY: -20 }],
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
  formContainer: {
    flex: 1,
  },
  formContentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 15,
    marginTop: 10,
  },
  mainInput: {
    fontSize: 20,
    color: "#333",
    padding: 15,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  optionCard: {
    width: (width - 60) / 2,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    margin: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectedOptionCard: {
    backgroundColor: "#1a8e2d",
    borderColor: "#1a8e2d",
  },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  selectedOptionIcon: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  selectedOptionLabel: {
    color: "white",
  },
  durationNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a8e2d",
    marginBottom: 5,
  },
  selectedDurationNumber: {
    color: "white",
  },
  inputContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  switchSubLabel: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  inputRow: {
    flexDirection: "row",
    marginTop: 15,
    gap: 10,
  },
  flex1: {
    flex: 1,
  },
  input: {
    padding: 15,
    fontSize: 16,
    color: "#333",
  },
  textAreaContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  textArea: {
    height: 100,
    padding: 15,
    fontSize: 16,
    color: "#333",
  },
  footer: {
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  saveButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  saveButtonGradient: {
    paddingVertical: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  inputError: {
    borderColor: "#FF5252",
  },
  errorText: {
    color: "#FF5252",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 12,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  capacityInputs: {
    marginTop: 15,
  },
  timesContainer: {
    marginTop: 20,
  },
  timesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  timeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  timeButtonText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
});
