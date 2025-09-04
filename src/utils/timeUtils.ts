/**
 * Time utility functions for HandwerkOS
 */

/**
 * Formats minutes to HH:MM format
 * @param minutes Total minutes
 * @returns Formatted time string (e.g., "02:30")
 */
export const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Formats duration in minutes to human readable format
 * @param minutes Total minutes
 * @returns Human readable format (e.g., "2h 30m")
 */
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours === 0) {
    return `${mins}m`
  } else if (mins === 0) {
    return `${hours}h`
  } else {
    return `${hours}h ${mins}m`
  }
}

/**
 * Formats duration for live display with seconds
 * @param seconds Total seconds
 * @returns Formatted time string (e.g., "01:23:45")
 */
export const formatLiveDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calculate duration between two dates in minutes
 * @param start Start date
 * @param end End date
 * @returns Duration in minutes
 */
export const calculateDuration = (start: Date, end: Date): number => {
  const diff = end.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60))
}

/**
 * Parse time string (HH:MM) to minutes
 * @param timeString Time in HH:MM format
 * @returns Total minutes
 */
export const parseTimeToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

/**
 * Get current time as formatted string
 * @returns Current time in HH:MM format
 */
export const getCurrentTime = (): string => {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

/**
 * Check if a time is within business hours
 * @param time Time in HH:MM format
 * @param startHour Business start hour (default: 8)
 * @param endHour Business end hour (default: 18)
 * @returns True if within business hours
 */
export const isWithinBusinessHours = (time: string, startHour: number = 8, endHour: number = 18): boolean => {
  const minutes = parseTimeToMinutes(time)
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60
  
  return minutes >= startMinutes && minutes <= endMinutes
}