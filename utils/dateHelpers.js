export function hasTimePassed(timeStr, date) {
  try {
    // Get hours and minutes from the time string (format: "HH:mm")
    const [hours, minutes] = timeStr.split(":").map(Number);

    // Create a new date object with the given date and time
    const dateWithTime = new Date(date);
    dateWithTime.setHours(hours, minutes, 0, 0);
    // A time is considered missed if the current time is later than scheduled + 30 minutes
    const graceEnd = new Date(dateWithTime);
    graceEnd.setMinutes(graceEnd.getMinutes() + 30);
    const now = new Date();
    return now > graceEnd;
  } catch (e) {
    console.error("Error checking if time has passed:", e);
    return false;
  }
}

export function formatTime(date) {
  return date.toLocaleTimeString("default", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function getGracePeriodRemaining(timeStr, date) {
  try {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const dateWithTime = new Date(date);
    dateWithTime.setHours(hours, minutes, 0, 0);
    // New behavior:
    // - If now is between scheduled time and scheduled+30min, return remaining minutes until miss
    // - Otherwise return null
    const graceEndTime = new Date(dateWithTime);
    graceEndTime.setMinutes(graceEndTime.getMinutes() + 30);
    const now = new Date();

    if (now < dateWithTime) return null; // not started yet
    if (now > graceEndTime) return null; // already missed

    return Math.ceil((graceEndTime.getTime() - now.getTime()) / (1000 * 60));
  } catch (e) {
    console.error("Error calculating grace period:", e);
    return null;
  }
}

// Additional helpers per new rules
export function isTooEarly(timeStr, date) {
  try {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const scheduled = new Date(date);
    scheduled.setHours(hours, minutes, 0, 0);
    const now = new Date();
    // Too early if scheduled is more than 3 hours ahead of now
    return scheduled.getTime() - now.getTime() > 3 * 60 * 60 * 1000;
  } catch (e) {
    console.error("Error checking too early:", e);
    return false;
  }
}

export function isMissed(timeStr, date) {
  // Missed if now > scheduled + 30 minutes
  return hasTimePassed(timeStr, date);
}
