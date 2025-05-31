/**
 * Shared utility functions for day-related formatting
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
    // Special event days
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