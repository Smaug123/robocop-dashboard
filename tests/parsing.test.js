import { test, expect, describe } from 'bun:test';
import { parseReviewFromOutput, parseErrorFromOutput, parseJsonContent } from '../src/parsing.js';

describe('parseJsonContent', () => {
    test('parses valid JSON', () => {
        expect(parseJsonContent('{"foo": "bar"}')).toEqual({ foo: 'bar' });
    });

    test('returns null for invalid JSON', () => {
        expect(parseJsonContent('not json')).toBeNull();
    });

    test('returns null for empty string', () => {
        expect(parseJsonContent('')).toBeNull();
    });
});

describe('parseReviewFromOutput', () => {
    test('parses responses API format', () => {
        const input = JSON.stringify({
            custom_id: 'robocop-review-1',
            response: {
                status_code: 200,
                body: {
                    output: [
                        {
                            type: 'message',
                            content: [
                                {
                                    type: 'output_text',
                                    text: '{"summary": "All good", "substantiveComments": false}'
                                }
                            ]
                        }
                    ]
                }
            }
        });

        const result = parseReviewFromOutput(input);
        expect(result).toEqual({ summary: 'All good', substantiveComments: false });
    });

    test('parses legacy chat completions format', () => {
        const input = JSON.stringify({
            custom_id: 'robocop-review-1',
            response: {
                status_code: 200,
                body: {
                    choices: [
                        {
                            message: {
                                content: '{"summary": "Legacy format", "substantiveComments": true}'
                            }
                        }
                    ]
                }
            }
        });

        const result = parseReviewFromOutput(input);
        expect(result).toEqual({ summary: 'Legacy format', substantiveComments: true });
    });

    test('returns HTTP error info for non-200 status', () => {
        const input = JSON.stringify({
            custom_id: 'robocop-review-1',
            response: {
                status_code: 503,
                request_id: 'req_123'
            }
        });

        const result = parseReviewFromOutput(input);
        expect(result).toEqual({
            isHttpError: true,
            statusCode: 503,
            requestId: 'req_123'
        });
    });

    test('returns null for non-robocop entries', () => {
        const input = JSON.stringify({
            custom_id: 'some-other-id',
            response: { status_code: 200 }
        });

        expect(parseReviewFromOutput(input)).toBeNull();
    });

    test('handles multiline JSONL with robocop entry not first', () => {
        const input = [
            JSON.stringify({ custom_id: 'other-1', response: {} }),
            JSON.stringify({
                custom_id: 'robocop-review-1',
                response: {
                    status_code: 200,
                    body: {
                        choices: [{ message: { content: '{"summary": "Found it"}' } }]
                    }
                }
            })
        ].join('\n');

        const result = parseReviewFromOutput(input);
        expect(result).toEqual({ summary: 'Found it' });
    });

    test('skips malformed JSON lines', () => {
        const input = [
            'not valid json',
            JSON.stringify({
                custom_id: 'robocop-review-1',
                response: {
                    status_code: 200,
                    body: {
                        choices: [{ message: { content: '{"summary": "Works"}' } }]
                    }
                }
            })
        ].join('\n');

        const result = parseReviewFromOutput(input);
        expect(result).toEqual({ summary: 'Works' });
    });

    test('returns null for empty input', () => {
        expect(parseReviewFromOutput('')).toBeNull();
        expect(parseReviewFromOutput('   \n   ')).toBeNull();
    });
});

describe('parseErrorFromOutput', () => {
    test('parses HTTP error format', () => {
        const input = JSON.stringify({
            custom_id: 'robocop-review-1',
            response: {
                status_code: 503,
                request_id: 'req_abc'
            },
            error: null
        });

        const result = parseErrorFromOutput(input);
        expect(result).toEqual([{
            customId: 'robocop-review-1',
            message: 'HTTP 503 error',
            code: 'http_503',
            statusCode: 503,
            requestId: 'req_abc'
        }]);
    });

    test('parses traditional error format', () => {
        const input = JSON.stringify({
            custom_id: 'robocop-review-1',
            error: {
                message: 'Rate limit exceeded',
                code: 'rate_limit_exceeded'
            }
        });

        const result = parseErrorFromOutput(input);
        expect(result).toEqual([{
            customId: 'robocop-review-1',
            message: 'Rate limit exceeded',
            code: 'rate_limit_exceeded'
        }]);
    });

    test('parses multiple errors', () => {
        const input = [
            JSON.stringify({ custom_id: 'req-1', error: { message: 'Error 1', code: 'err1' } }),
            JSON.stringify({ custom_id: 'req-2', error: { message: 'Error 2', code: 'err2' } })
        ].join('\n');

        const result = parseErrorFromOutput(input);
        expect(result).toHaveLength(2);
        expect(result[0].customId).toBe('req-1');
        expect(result[1].customId).toBe('req-2');
    });

    test('returns null for no errors', () => {
        const input = JSON.stringify({
            custom_id: 'robocop-review-1',
            response: { status_code: 200 }
        });

        expect(parseErrorFromOutput(input)).toBeNull();
    });

    test('handles missing error fields gracefully', () => {
        const input = JSON.stringify({
            custom_id: 'robocop-review-1',
            error: {}
        });

        const result = parseErrorFromOutput(input);
        expect(result).toEqual([{
            customId: 'robocop-review-1',
            message: 'Unknown error',
            code: 'unknown'
        }]);
    });
});
