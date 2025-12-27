/**
 * Pure time formatting functions.
 * All functions accept the current time as a parameter for testability.
 */

/**
 * Format a Unix timestamp as a relative time string.
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {number} nowMs - Current time in milliseconds (Date.now())
 * @returns {string} Relative time string like "5m ago", "2h ago"
 */
export function getRelativeTime(timestamp, nowMs) {
    const seconds = Math.floor((nowMs / 1000) - timestamp);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format a Unix timestamp as a UTC datetime string.
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} UTC datetime string like "2024-01-15 12:30:00 UTC"
 */
export function formatUtcTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Check if a Unix timestamp falls on a given date.
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {Date} today - Date object representing "today"
 * @returns {boolean} True if timestamp is on the same day as today
 */
export function isToday(timestamp, today) {
    const date = new Date(timestamp * 1000);
    return date.toDateString() === today.toDateString();
}
