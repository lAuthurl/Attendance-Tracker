import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token = null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  try {
    const projectId = "class-attendance-tracker"; // This should match your expo.slug from app.json
    const response = await Notifications.getExpoPushTokenAsync({
      projectId,
      development: __DEV__, // Use development configuration when in development mode
    });
    token = response.data;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4CAF50",
      });
    }

    return token;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

export async function scheduleAttendanceReminder(attendance) {
  if (!attendance.reminderEnabled) return;

  try {
    // Get today's day of week (0-6)
    const today = new Date();
    const dayOfWeek = today.getDay();

    // Find schedule for today
    const todaySchedule = attendance.schedule.find(
      (s) => s.dayNumber === dayOfWeek
    );
    if (!todaySchedule) return;

    // Schedule notifications for each time today
    for (const time of todaySchedule.times) {
      const [hours, minutes] = time.split(":").map(Number);
      const scheduleTime = new Date();
      scheduleTime.setHours(hours, minutes, 0, 0);

      // If time has passed for today, skip it
      if (scheduleTime < new Date()) continue;

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Attendance Reminder",
          body: `Time to record ${attendance.name} (${attendance.category})`,
          data: { attendanceId: attendance.id },
        },
        trigger: {
          channelId: "default",
          date: scheduleTime,
        },
      });

      return identifier;
    }
  } catch (error) {
    console.error("Error scheduling attendance reminder:", error);
    return undefined;
  }
}

export async function scheduleCapacityReminder(attendance) {
  if (!attendance.capacityReminder) return;

  try {
    // Schedule a notification when capacity is low
    if (attendance.currentCapacity <= attendance.capacityAlertAt) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Capacity Alert",
          body: `${attendance.name} capacity is running low. Current capacity: ${attendance.currentCapacity}`,
          data: { attendanceId: attendance.id, type: "capacity" },
        },
        trigger: null, // Show immediately
      });

      return identifier;
    }
  } catch (error) {
    console.error("Error scheduling capacity reminder:", error);
    return undefined;
  }
}

export async function cancelAttendanceReminders(attendanceId) {
  try {
    const scheduledNotifications =
      await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of scheduledNotifications) {
      const data = notification.content.data || null;
      if (data?.attendanceId === attendanceId) {
        await Notifications.cancelScheduledNotificationAsync(
          notification.identifier
        );
      }
    }
  } catch (error) {
    console.error("Error canceling attendance reminders:", error);
  }
}

export async function updateAttendanceReminders(attendance) {
  try {
    // Cancel existing reminders
    await cancelAttendanceReminders(attendance.id);

    // Schedule new reminders
    await scheduleAttendanceReminder(attendance);
    await scheduleCapacityReminder(attendance);
  } catch (error) {
    console.error("Error updating attendance reminders:", error);
  }
}
