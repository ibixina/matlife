/**
 * GameCalendar for Mat Life: Wrestling Simulator
 * Step 1.5 of Implementation Plan
 * Time tracking and tick logic
 */

import { gameStateManager } from './GameStateManager.js';

/**
 * GameCalendar - Manages the in-game time system
 */
export class GameCalendar {
  constructor() {
    this.DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    this.MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    this.onYearEnd = null;
  }

  /**
   * Advances time by one day
   * @returns {object} The new calendar state
   */
  tick() {
    const state = gameStateManager.getStateRef();
    const calendar = state.calendar;

    // Increment day
    calendar.day++;

    // Check if we need to advance week
    if (calendar.day >= this.DAYS.length) {
      calendar.day = 0;
      calendar.week++;

      // Check if we need to advance month
      if (calendar.week > 4) {
        calendar.week = 1;
        calendar.month++;

        // Check if we need to advance year
        if (calendar.month > 12) {
          calendar.month = 1;
          calendar.year++;
          
          // Trigger year end callback
          if (this.onYearEnd) {
            this.onYearEnd(calendar.year);
          }
        }
      }
    }

    // Increment absolute week counter
    if (calendar.day === 0) {
      calendar.absoluteWeek++;
    }

    return { ...calendar };
  }

  /**
   * Gets a formatted date string
   * @returns {string} Formatted date
   */
  getCurrentDate() {
    const state = gameStateManager.getStateRef();
    const calendar = state.calendar;
    
    return `${this.DAYS[calendar.day]} - Week ${calendar.week}, ${this.MONTHS[calendar.month - 1]}, Year ${calendar.year}`;
  }

  /**
   * Gets the absolute week number since game start
   * @returns {number} Absolute week number
   */
  getWeekNumber() {
    const state = gameStateManager.getStateRef();
    return state.calendar.absoluteWeek;
  }

  /**
   * Checks if current day+time matches a promotion's show schedule
   * @param {object} promotion - Promotion object with shows array
   * @returns {boolean} True if it's a show day
   */
  isShowDay(promotion) {
    const state = gameStateManager.getStateRef();
    const calendar = state.calendar;
    
    if (!promotion.shows) return false;

    return promotion.shows.some(show => show.day === calendar.day);
  }

  /**
   * Checks if current week matches a PLE in the promotion's calendar
   * @param {object} promotion - Promotion object with PLE schedule
   * @returns {object|null} The matching PLE event or null
   */
  isPLEWeek(promotion) {
    const state = gameStateManager.getStateRef();
    const calendar = state.calendar;
    
    if (!promotion.pleSchedule) return null;

    return promotion.pleSchedule.find(ple => 
      ple.month === calendar.month && 
      ple.week === calendar.week
    ) || null;
  }

  /**
   * Gets the current day name
   * @returns {string} Day name
   */
  getCurrentDayName() {
    const state = gameStateManager.getStateRef();
    return this.DAYS[state.calendar.day];
  }



  /**
   * Serializes the calendar state
   * @returns {object} Serialized calendar
   */
  serialize() {
    const state = gameStateManager.getStateRef();
    return { ...state.calendar };
  }

  /**
   * Deserializes calendar data into state
   * @param {object} data - Serialized calendar data
   */
  static deserialize(data) {
    const state = gameStateManager.getStateRef();
    state.calendar = { ...data };
  }
}

// Export singleton instance
export const gameCalendar = new GameCalendar();
export default gameCalendar;
