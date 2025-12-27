/**
 * Pure parsing functions for OpenAI batch output/error files.
 * No side effects, no external dependencies.
 */

/**
 * Parse JSON content, returning null on failure.
 * @param {string} content - JSON string to parse
 * @returns {object|null} Parsed object or null
 */
export function parseJsonContent(content) {
    try {
        return JSON.parse(content);
    } catch (e) {
        return null;
    }
}

/**
 * Parse review data from OpenAI batch output JSONL.
 * Handles both responses API format and legacy chat completions format.
 * @param {string} outputText - JSONL text from batch output file
 * @returns {object|null} Parsed review data, HTTP error info, or null
 */
export function parseReviewFromOutput(outputText) {
    const lines = outputText.trim().split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;

        const result = parseJsonContent(line.trim());
        if (!result) continue;

        if (result.custom_id === 'robocop-review-1') {
            // Check for HTTP error status codes in the response
            if (result.response && typeof result.response.status_code === 'number' && result.response.status_code !== 200) {
                return {
                    isHttpError: true,
                    statusCode: result.response.status_code,
                    requestId: result.response.request_id || 'N/A'
                };
            }

            // Check for successful response - responses API format
            // Find the message output (there may be other outputs like reasoning)
            if (result.response?.body?.output) {
                const messageOutput = result.response.body.output.find(o => o.type === 'message');
                if (messageOutput?.content) {
                    const textContent = messageOutput.content.find(c => c.type === 'output_text');
                    if (textContent?.text) {
                        return parseJsonContent(textContent.text);
                    }
                }
            }

            // Fallback: legacy chat completions format (for backwards compatibility)
            if (result.response?.body?.choices?.[0]?.message?.content) {
                const content = result.response.body.choices[0].message.content;
                return parseJsonContent(content);
            }
        }
    }

    return null;
}

/**
 * Parse errors from OpenAI batch error file JSONL.
 * @param {string} errorText - JSONL text from batch error file
 * @returns {Array|null} Array of error objects, or null if no errors
 */
export function parseErrorFromOutput(errorText) {
    const lines = errorText.trim().split('\n');
    const errors = [];

    for (const line of lines) {
        if (!line.trim()) continue;

        const errorEntry = parseJsonContent(line.trim());
        if (!errorEntry) continue;

        // Handle HTTP error status codes (e.g., {"response": {"status_code": 503, ...}, "error": null})
        if (errorEntry.response && typeof errorEntry.response.status_code === 'number' && errorEntry.response.status_code !== 200) {
            errors.push({
                customId: errorEntry.custom_id,
                message: `HTTP ${errorEntry.response.status_code} error`,
                code: `http_${errorEntry.response.status_code}`,
                statusCode: errorEntry.response.status_code,
                requestId: errorEntry.response.request_id
            });
        }
        // Handle traditional error format: { "custom_id": "...", "error": { "message": "...", "code": "..." } }
        else if (errorEntry.error) {
            errors.push({
                customId: errorEntry.custom_id,
                message: errorEntry.error.message || 'Unknown error',
                code: errorEntry.error.code || 'unknown'
            });
        }
    }

    return errors.length > 0 ? errors : null;
}
