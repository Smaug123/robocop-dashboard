import { test, expect, describe } from 'bun:test';
import {
    isInProgress,
    categorizeBatches,
    computeSummary,
    annotateBatchErrors,
    filterByRobocopDescription,
    filterBySupportedSchemaVersions
} from '../src/batch.js';

describe('isInProgress', () => {
    test('returns true for in_progress status', () => {
        expect(isInProgress('in_progress')).toBe(true);
    });

    test('returns true for validating status', () => {
        expect(isInProgress('validating')).toBe(true);
    });

    test('returns true for finalizing status', () => {
        expect(isInProgress('finalizing')).toBe(true);
    });

    test('returns false for completed status', () => {
        expect(isInProgress('completed')).toBe(false);
    });

    test('returns false for failed status', () => {
        expect(isInProgress('failed')).toBe(false);
    });

    test('returns false for cancelled status', () => {
        expect(isInProgress('cancelled')).toBe(false);
    });

    test('returns false for expired status', () => {
        expect(isInProgress('expired')).toBe(false);
    });
});

describe('categorizeBatches', () => {
    test('categorizes batches by status', () => {
        const batches = [
            { id: '1', status: 'in_progress' },
            { id: '2', status: 'completed' },
            { id: '3', status: 'cancelled' },
            { id: '4', status: 'failed' },
            { id: '5', status: 'validating' },
            { id: '6', status: 'expired' }
        ];

        const result = categorizeBatches(batches);

        expect(result.inProgress).toHaveLength(2);
        expect(result.completed).toHaveLength(1);
        expect(result.cancelled).toHaveLength(1);
        expect(result.failed).toHaveLength(2); // failed + expired
    });

    test('returns empty arrays for empty input', () => {
        const result = categorizeBatches([]);

        expect(result.inProgress).toEqual([]);
        expect(result.completed).toEqual([]);
        expect(result.cancelled).toEqual([]);
        expect(result.failed).toEqual([]);
    });
});

describe('computeSummary', () => {
    // Note: These tests use local time constructors (not UTC strings with 'Z')
    // because isToday uses toDateString() which formats in local time.
    // This ensures tests are timezone-independent.

    test('counts in-flight batches', () => {
        const batches = [
            { status: 'in_progress' },
            { status: 'validating' },
            { status: 'completed', completed_at: 0 }
        ];

        const result = computeSummary(batches, new Date());
        expect(result.inFlight).toBe(2);
    });

    test('counts completed today using completed_at timestamp', () => {
        const today = new Date(2024, 0, 15, 12, 0, 0);
        const todayTimestamp = new Date(2024, 0, 15, 8, 0, 0).getTime() / 1000;
        const yesterdayTimestamp = new Date(2024, 0, 14, 8, 0, 0).getTime() / 1000;

        const batches = [
            { status: 'completed', completed_at: todayTimestamp },
            { status: 'completed', completed_at: todayTimestamp },
            { status: 'completed', completed_at: yesterdayTimestamp }
        ];

        const result = computeSummary(batches, today);
        expect(result.completedToday).toBe(2);
    });

    test('job created yesterday but completed today counts as completed today', () => {
        const today = new Date(2024, 0, 15, 12, 0, 0);
        const yesterdayCreated = new Date(2024, 0, 14, 23, 0, 0).getTime() / 1000;
        const todayCompleted = new Date(2024, 0, 15, 1, 0, 0).getTime() / 1000;

        const batches = [
            { status: 'completed', created_at: yesterdayCreated, completed_at: todayCompleted }
        ];

        const result = computeSummary(batches, today);
        expect(result.completedToday).toBe(1);
    });

    test('ignores completed batches without completed_at timestamp', () => {
        const today = new Date(2024, 0, 15, 12, 0, 0);
        const todayTimestamp = new Date(2024, 0, 15, 8, 0, 0).getTime() / 1000;

        const batches = [
            { status: 'completed', completed_at: todayTimestamp },
            { status: 'completed' } // no completed_at
        ];

        const result = computeSummary(batches, today);
        expect(result.completedToday).toBe(1);
    });

    test('counts issues found today', () => {
        const today = new Date(2024, 0, 15, 12, 0, 0);
        const todayTimestamp = new Date(2024, 0, 15, 8, 0, 0).getTime() / 1000;

        const batches = [
            { status: 'completed', completed_at: todayTimestamp, reviewData: { substantiveComments: true } },
            { status: 'completed', completed_at: todayTimestamp, reviewData: { substantiveComments: false } },
            { status: 'completed', completed_at: todayTimestamp, reviewData: null }
        ];

        const result = computeSummary(batches, today);
        expect(result.issuesFound).toBe(1);
    });

    test('counts HTTP errors as issues found today', () => {
        const today = new Date(2024, 0, 15, 12, 0, 0);
        const todayTimestamp = new Date(2024, 0, 15, 8, 0, 0).getTime() / 1000;

        const batches = [
            { status: 'completed', completed_at: todayTimestamp, reviewData: { isHttpError: true, statusCode: 503 } },
            { status: 'completed', completed_at: todayTimestamp, reviewData: { substantiveComments: false } },
            { status: 'completed', completed_at: todayTimestamp, reviewData: { isHttpError: true, statusCode: 429 } }
        ];

        const result = computeSummary(batches, today);
        expect(result.issuesFound).toBe(2);
    });

    test('counts both substantive comments and HTTP errors as issues', () => {
        const today = new Date(2024, 0, 15, 12, 0, 0);
        const todayTimestamp = new Date(2024, 0, 15, 8, 0, 0).getTime() / 1000;

        const batches = [
            { status: 'completed', completed_at: todayTimestamp, reviewData: { substantiveComments: true } },
            { status: 'completed', completed_at: todayTimestamp, reviewData: { isHttpError: true, statusCode: 503 } }
        ];

        const result = computeSummary(batches, today);
        expect(result.issuesFound).toBe(2);
    });
});

describe('annotateBatchErrors', () => {
    test('annotates batch with error info', () => {
        const batches = [
            { id: '1', request_counts: { failed: 2 }, error_file_id: 'file_123' }
        ];

        const result = annotateBatchErrors(batches);

        expect(result[0].hasErrors).toBe(true);
        expect(result[0].failedCount).toBe(2);
        expect(result[0].errorFileId).toBe('file_123');
    });

    test('marks batch as having errors if failed count > 0', () => {
        const batches = [
            { id: '1', request_counts: { failed: 1 } }
        ];

        const result = annotateBatchErrors(batches);
        expect(result[0].hasErrors).toBe(true);
    });

    test('marks batch as having errors if error_file_id exists', () => {
        const batches = [
            { id: '1', error_file_id: 'file_123' }
        ];

        const result = annotateBatchErrors(batches);
        expect(result[0].hasErrors).toBe(true);
    });

    test('marks batch as no errors when neither condition met', () => {
        const batches = [
            { id: '1', request_counts: { failed: 0 } }
        ];

        const result = annotateBatchErrors(batches);
        expect(result[0].hasErrors).toBe(false);
    });

    test('does not mutate original batch objects', () => {
        const original = { id: '1', request_counts: { failed: 1 } };
        const batches = [original];

        annotateBatchErrors(batches);

        expect(original.hasErrors).toBeUndefined();
    });
});

describe('filterByRobocopDescription', () => {
    test('filters for robocop batches by description only', () => {
        const batches = [
            { id: '1', metadata: { description: 'robocop code review tool', metadata_schema: '1' } },
            { id: '2', metadata: { description: 'other tool', metadata_schema: '1' } },
            { id: '3', metadata: { description: 'robocop code review tool', metadata_schema: '2' } },
            { id: '4', metadata: { description: 'robocop code review tool' } }, // no schema
            { id: '5' } // no metadata
        ];

        const result = filterByRobocopDescription(batches);

        expect(result).toHaveLength(3);
        expect(result.map(b => b.id)).toEqual(['1', '3', '4']);
    });

    test('returns empty array when no matches', () => {
        const batches = [
            { id: '1', metadata: { description: 'other tool' } }
        ];

        expect(filterByRobocopDescription(batches)).toEqual([]);
    });
});

describe('filterBySupportedSchemaVersions', () => {
    test('filters to only supported schema versions', () => {
        const batches = [
            { id: '1', metadata: { metadata_schema: '1' } },
            { id: '2', metadata: { metadata_schema: '2' } },
            { id: '3', metadata: { metadata_schema: '1' } },
            { id: '4', metadata: {} }, // no schema
            { id: '5' } // no metadata
        ];

        const result = filterBySupportedSchemaVersions(batches, ['1']);

        expect(result).toHaveLength(2);
        expect(result.map(b => b.id)).toEqual(['1', '3']);
    });

    test('supports multiple schema versions', () => {
        const batches = [
            { id: '1', metadata: { metadata_schema: '1' } },
            { id: '2', metadata: { metadata_schema: '2' } },
            { id: '3', metadata: { metadata_schema: '3' } }
        ];

        const result = filterBySupportedSchemaVersions(batches, ['1', '2']);

        expect(result).toHaveLength(2);
        expect(result.map(b => b.id)).toEqual(['1', '2']);
    });

    test('returns empty array when no matches', () => {
        const batches = [
            { id: '1', metadata: { metadata_schema: '2' } }
        ];

        expect(filterBySupportedSchemaVersions(batches, ['1'])).toEqual([]);
    });
});
