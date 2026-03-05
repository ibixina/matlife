/**
 * Utility Functions for Mat Life: Wrestling Simulator
 * Step 1.1 of Implementation Plan
 */

/**
 * Generates a v4 UUID string
 * @returns {string} A v4 UUID
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Clamps a value between min and max
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} The clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Returns a random integer between min and max (inclusive)
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random float
 */
export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Returns a weighted random pick from an array of items
 * @param {Array<{value: any, weight: number}>} items - Array of items with weights
 * @returns {any} The selected value
 */
export function weightedRandom(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, item.weight || 0), 0);
  if (totalWeight <= 0) {
    return items[0].value;
  }

  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= Math.max(0, item.weight || 0);
    if (random <= 0) {
      return item.value;
    }
  }
  
  return items[items.length - 1].value;
}

/**
 * Rolls a D20 die
 * @returns {number} Random integer between 1 and 20
 */
export function rollD20() {
  return randomInt(1, 20);
}

/**
 * Creates a deep clone of an object using structured clone
 * @param {any} obj - Object to clone
 * @returns {any} Deep cloned object
 */
export function deepClone(obj) {
  return structuredClone(obj);
}

/**
 * Calculates the number of days between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} Number of days difference
 */
export function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1 - date2) / oneDay));
}

/**
 * Formats a number as currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Capitalizes the first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts camelCase to Title Case
 * @param {string} str - camelCase string
 * @returns {string} Title Case string
 */
export function camelToTitle(str) {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}
