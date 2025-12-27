import { test, expect, describe } from 'bun:test';
import { getRelativeTime, isToday, formatUtcTime } from '../src/time.js';

describe('getRelativeTime', () => {
    const nowMs = 1700000000000; // Fixed "now" for testing

    test('returns "just now" for timestamps less than 60 seconds ago', () => {
        const timestamp = (nowMs / 1000) - 30; // 30 seconds ago
        expect(getRelativeTime(timestamp, nowMs)).toBe('just now');
    });

    test('returns minutes for timestamps less than an hour ago', () => {
        const timestamp = (nowMs / 1000) - 300; // 5 minutes ago
        expect(getRelativeTime(timestamp, nowMs)).toBe('5m ago');
    });

    test('returns hours for timestamps less than a day ago', () => {
        const timestamp = (nowMs / 1000) - 7200; // 2 hours ago
        expect(getRelativeTime(timestamp, nowMs)).toBe('2h ago');
    });

    test('returns days for timestamps more than a day ago', () => {
        const timestamp = (nowMs / 1000) - 172800; // 2 days ago
        expect(getRelativeTime(timestamp, nowMs)).toBe('2d ago');
    });

    test('handles edge case at exactly 60 seconds', () => {
        const timestamp = (nowMs / 1000) - 60;
        expect(getRelativeTime(timestamp, nowMs)).toBe('1m ago');
    });

    test('handles edge case at exactly 1 hour', () => {
        const timestamp = (nowMs / 1000) - 3600;
        expect(getRelativeTime(timestamp, nowMs)).toBe('1h ago');
    });

    test('handles edge case at exactly 1 day', () => {
        const timestamp = (nowMs / 1000) - 86400;
        expect(getRelativeTime(timestamp, nowMs)).toBe('1d ago');
    });
});

describe('isToday', () => {
    // Note: These tests use local time constructors (not UTC strings with 'Z')
    // because isToday uses toDateString() which formats in local time.
    // This ensures tests are timezone-independent.

    test('returns true for timestamp on the same local day', () => {
        // Both dates are Jan 15, 2024 in local time
        const today = new Date(2024, 0, 15, 12, 0, 0);
        const timestamp = new Date(2024, 0, 15, 8, 30, 0).getTime() / 1000;
        expect(isToday(timestamp, today)).toBe(true);
    });

    test('returns false for timestamp on a different local day', () => {
        const today = new Date(2024, 0, 15, 12, 0, 0);
        const timestamp = new Date(2024, 0, 14, 23, 59, 59).getTime() / 1000;
        expect(isToday(timestamp, today)).toBe(false);
    });

    test('handles timestamps at midnight boundaries', () => {
        const today = new Date(2024, 0, 15, 0, 0, 0);
        const startOfDay = new Date(2024, 0, 15, 0, 0, 1).getTime() / 1000;
        const endOfPrevDay = new Date(2024, 0, 14, 23, 59, 59).getTime() / 1000;

        expect(isToday(startOfDay, today)).toBe(true);
        expect(isToday(endOfPrevDay, today)).toBe(false);
    });
});

describe('formatUtcTime', () => {
    test('formats timestamp as UTC datetime string', () => {
        // Unix timestamp for 2024-01-15 12:30:45 UTC
        const timestamp = Date.UTC(2024, 0, 15, 12, 30, 45) / 1000;
        expect(formatUtcTime(timestamp)).toBe('2024-01-15 12:30:45 UTC');
    });

    test('zero-pads single-digit values', () => {
        // Unix timestamp for 2024-03-05 09:05:03 UTC
        const timestamp = Date.UTC(2024, 2, 5, 9, 5, 3) / 1000;
        expect(formatUtcTime(timestamp)).toBe('2024-03-05 09:05:03 UTC');
    });

    test('handles midnight', () => {
        const timestamp = Date.UTC(2024, 0, 1, 0, 0, 0) / 1000;
        expect(formatUtcTime(timestamp)).toBe('2024-01-01 00:00:00 UTC');
    });

    test('handles end of day', () => {
        const timestamp = Date.UTC(2024, 11, 31, 23, 59, 59) / 1000;
        expect(formatUtcTime(timestamp)).toBe('2024-12-31 23:59:59 UTC');
    });
});
