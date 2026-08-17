/**
 * Sanitizes values before logging to prevent log injection attacks.
 * Removes newlines, carriage returns, tabs, and ANSI control characters.
 */
const sanitizeForLog = (value) => {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') {
    return value.replace(/[\r\n\t]/g, ' ').replace(/[^\x20-\x7E]/g, '').substring(0, 500);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value).replace(/[\r\n\t]/g, ' ').substring(0, 500);
  }
  return String(value);
};

module.exports = { sanitizeForLog };
