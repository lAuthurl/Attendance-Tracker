import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

const ATTENDANCES_KEY = "@attendances";
const ATTENDANCE_HISTORY_KEY = "@attendance_history";

export async function getAttendances() {
  try {
    const data = await AsyncStorage.getItem(ATTENDANCES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting attendances:", error);
    return [];
  }
}

export async function addAttendance(attendance) {
  try {
    const attendances = await getAttendances();
    attendances.push(attendance);
    await AsyncStorage.setItem(ATTENDANCES_KEY, JSON.stringify(attendances));
  } catch (error) {
    console.error("Error adding attendance:", error);
    throw error;
  }
}

export async function updateAttendance(updatedAttendance) {
  try {
    const attendances = await getAttendances();
    const index = attendances.findIndex((a) => a.id === updatedAttendance.id);
    if (index !== -1) {
      attendances[index] = updatedAttendance;
      await AsyncStorage.setItem(ATTENDANCES_KEY, JSON.stringify(attendances));
    }
  } catch (error) {
    console.error("Error updating attendance:", error);
    throw error;
  }
}

export async function deleteAttendance(id) {
  try {
    const attendances = await getAttendances();
    const updatedAttendances = attendances.filter((a) => a.id !== id);
    await AsyncStorage.setItem(
      ATTENDANCES_KEY,
      JSON.stringify(updatedAttendances)
    );
  } catch (error) {
    console.error("Error deleting attendance:", error);
    throw error;
  }
}

export async function getAttendanceHistory() {
  try {
    const data = await AsyncStorage.getItem(ATTENDANCE_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting attendance history:", error);
    return [];
  }
}

export async function getTodaysAttendances() {
  try {
    const history = await getAttendanceHistory();
    const today = new Date().toDateString();
    return history.filter(
      (record) => new Date(record.timestamp).toDateString() === today
    );
  } catch (error) {
    console.error("Error getting today's attendance records:", error);
    return [];
  }
}

export async function recordAttendance(attendanceId, taken, timestamp) {
  try {
    const history = await getAttendanceHistory();
    const newDate = new Date(timestamp).toDateString();

    // Try to find an existing record for same attendanceId on the same date
    const existingIndex = history.findIndex(
      (r) =>
        r.attendanceId === attendanceId &&
        new Date(r.timestamp).toDateString() === newDate
    );

    let prevTaken = undefined;

    if (existingIndex !== -1) {
      prevTaken = history[existingIndex].taken;
      history[existingIndex] = {
        ...history[existingIndex],
        taken,
        timestamp,
      };
    } else {
      const newRecord = {
        id: Math.random().toString(36).substr(2, 9),
        attendanceId,
        timestamp,
        taken,
      };
      history.push(newRecord);
    }

    await AsyncStorage.setItem(ATTENDANCE_HISTORY_KEY, JSON.stringify(history));

    // Notify listeners (other screens) that attendance history changed.
    try {
      DeviceEventEmitter.emit("attendanceChanged", {
        attendanceId,
        taken,
        date: newDate,
        prevTaken,
      });
    } catch (e) {
      // non-fatal
    }

    // Update attendance capacity if toggled
    if (prevTaken !== taken) {
      const attendances = await getAttendances();
      const attendance = attendances.find((a) => a.id === attendanceId);
      if (attendance) {
        // If marking taken -> reduce capacity (if possible)
        if (taken) {
          if (attendance.currentCapacity > 0) {
            attendance.currentCapacity -= 1;
            await updateAttendance(attendance);
          }
        } else {
          // If un-taking (undo), increment capacity (do not exceed totalCapacity if set)
          attendance.currentCapacity = (attendance.currentCapacity || 0) + 1;
          if (
            attendance.totalCapacity &&
            attendance.currentCapacity > attendance.totalCapacity
          ) {
            attendance.currentCapacity = attendance.totalCapacity;
          }
          await updateAttendance(attendance);
        }
      }
    }
  } catch (error) {
    console.error("Error recording attendance:", error);
    throw error;
  }
}

export async function clearAllData() {
  try {
    await AsyncStorage.multiRemove([ATTENDANCES_KEY, ATTENDANCE_HISTORY_KEY]);
  } catch (error) {
    console.error("Error clearing data:", error);
    throw error;
  }
}
