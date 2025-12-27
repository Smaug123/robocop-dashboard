import { test, expect, describe } from 'bun:test';
import { findUnknownSchemaVersions } from '../src/schema.js';

describe('findUnknownSchemaVersions', () => {
    test('returns empty set when all versions are supported', () => {
        const batches = [
            { metadata: { metadata_schema: '1' } },
            { metadata: { metadata_schema: '1' } }
        ];

        const result = findUnknownSchemaVersions(batches, ['1']);
        expect(result.size).toBe(0);
    });

    test('returns unknown versions', () => {
        const batches = [
            { metadata: { metadata_schema: '1' } },
            { metadata: { metadata_schema: '2' } },
            { metadata: { metadata_schema: '3' } }
        ];

        const result = findUnknownSchemaVersions(batches, ['1']);
        expect(result.size).toBe(2);
        expect(result.has('2')).toBe(true);
        expect(result.has('3')).toBe(true);
    });

    test('deduplicates unknown versions', () => {
        const batches = [
            { metadata: { metadata_schema: '2' } },
            { metadata: { metadata_schema: '2' } },
            { metadata: { metadata_schema: '2' } }
        ];

        const result = findUnknownSchemaVersions(batches, ['1']);
        expect(result.size).toBe(1);
    });

    test('handles batches without metadata', () => {
        const batches = [
            { id: '1' },
            { metadata: {} },
            { metadata: { metadata_schema: '2' } }
        ];

        const result = findUnknownSchemaVersions(batches, ['1']);
        expect(result.size).toBe(1);
        expect(result.has('2')).toBe(true);
    });

    test('handles empty batches array', () => {
        const result = findUnknownSchemaVersions([], ['1']);
        expect(result.size).toBe(0);
    });

    test('handles multiple supported versions', () => {
        const batches = [
            { metadata: { metadata_schema: '1' } },
            { metadata: { metadata_schema: '2' } },
            { metadata: { metadata_schema: '3' } }
        ];

        const result = findUnknownSchemaVersions(batches, ['1', '2']);
        expect(result.size).toBe(1);
        expect(result.has('3')).toBe(true);
    });
});
