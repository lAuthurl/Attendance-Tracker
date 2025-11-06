import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Attendance } from "./storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  let token: string | null = null;

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

export async function scheduleAttendanceReminder(
  attendance: Attendance
): Promise<string | undefined> {
  if (!attendance.reminderEnabled) return;

  try {
    // Schedule notifications for each time
    for (const time of attendance.times) {
      const [hours, minutes] = time.split(":").map(Number);
      const today = new Date();
      today.setHours(hours, minutes, 0, 0);

      // If time has passed for today, schedule for tomorrow
      if (today < new Date()) {
        today.setDate(today.getDate() + 1);
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Attendance Reminder",
          body: `Time to record ${attendance.name} (${attendance.category})`,
          data: { attendanceId: attendance.id },
        },
        trigger: {
          channelId: "default",
          date: today,
        },
      });

      return identifier;
    }
  } catch (error) {
    console.error("Error scheduling attendance reminder:", error);
    return undefined;
  }
}

export async function scheduleCapacityReminder(
  attendance: Attendance
): Promise<string | undefined> {
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

export async function cancelAttendanceReminders(
  attendanceId: string
): Promise<void> {
  try {
    const scheduledNotifications =
      await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of scheduledNotifications) {
      const data = notification.content.data as {
        attendanceId?: string;
      } | null;
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

export async function updateAttendanceReminders(
  attendance: Attendance
): Promise<void> {
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
