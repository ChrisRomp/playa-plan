/**
 * Shared utility functions for shift-related formatting
 */

/**
 * Convert a day enum value to a friendly display name
 */
export const getFriendlyDayName = (day: string): string => {
  if (!day) return '';
  
  const dayMap: Record<string, string> = {
    // Standard days
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday',
    // Special event days from schema
    PRE_OPENING: 'Pre-Opening',
    OPENING_SUNDAY: 'Opening Sunday',
    CLOSING_SUNDAY: 'Closing Sunday',
    POST_EVENT: 'Post-Event',
    // Handle lowercase versions too
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    pre_opening: 'Pre-Opening',
    opening_sunday: 'Opening Sunday',
    closing_sunday: 'Closing Sunday',
    post_event: 'Post-Event'
  };
  return dayMap[day] || day; // Return mapped value or original if not found
};

/**
 * Format a time string for display
 */
export const formatTime = (timeString: string): string => {
  try {
    // Check if timeString is already a time string in HH:MM format
    if (/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }
    
    const date = new Date(timeString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return timeString;
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    // Return the original string if parsing fails
    return timeString;
  }
}; 