export function hasTimePassed(timeStr: string, date: Date): boolean {
  try {
    // Get hours and minutes from the time string (format: "HH:mm")
    const [hours, minutes] = timeStr.split(":").map(Number);

    // Create a new date object with the given date and time
    const dateWithTime = new Date(date);
    dateWithTime.setHours(hours, minutes, 0, 0);

    // Add 30 minutes grace period
    dateWithTime.setMinutes(dateWithTime.getMinutes() + 30);

    // Get current date/time
    const now = new Date();

    return dateWithTime < now;
  } catch (e) {
    console.error("Error checking if time has passed:", e);
    return false;
  }
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("default", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function getGracePeriodRemaining(
  timeStr: string,
  date: Date
): number | null {
  try {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const dateWithTime = new Date(date);
    dateWithTime.setHours(hours, minutes, 0, 0);

    // Add 30 minutes grace period
    const graceEndTime = new Date(dateWithTime);
    graceEndTime.setMinutes(graceEndTime.getMinutes() + 30);

    const now = new Date();

    // If we're past the grace period or it's a future date, return null
    if (now > graceEndTime || date.toDateString() > now.toDateString()) {
      return null;
    }

    // If we're before the scheduled time, return null
    if (now < dateWithTime) {
      return null;
    }

    // Return remaining minutes in grace period
    return Math.ceil((graceEndTime.getTime() - now.getTime()) / (1000 * 60));
  } catch (e) {
    console.error("Error calculating grace period:", e);
    return null;
  }
}
