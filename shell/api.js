/**
 * Imperative API functions - handles fetch calls to OpenAI.
 */

const API_BASE = 'https://api.openai.com/v1';

/**
 * Fetch batch output file content from OpenAI.
 * @param {string} fileId - OpenAI file ID
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} File content as text
 */
export async function fetchBatchOutput(fileId, apiKey) {
    const response = await fetch(`${API_BASE}/files/${fileId}/content`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });
    if (!response.ok) throw new Error(`Failed to fetch output file: ${response.statusText}`);
    return await response.text();
}

/**
 * Fetch batch error file content from OpenAI.
 * @param {string} fileId - OpenAI file ID
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} File content as text
 */
export async function fetchBatchError(fileId, apiKey) {
    const response = await fetch(`${API_BASE}/files/${fileId}/content`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });
    if (!response.ok) throw new Error(`Failed to fetch error file: ${response.statusText}`);
    return await response.text();
}

/**
 * Fetch a single page of batches from OpenAI.
 * @param {string} apiKey - OpenAI API key
 * @param {string|null} after - Cursor for pagination (batch ID to start after)
 * @param {number} limit - Number of batches per page (max 100)
 * @returns {Promise<{data: Array, has_more: boolean, last_id: string|null}>}
 */
export async function fetchBatchPage(apiKey, after = null, limit = 100) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (after) {
        params.set('after', after);
    }

    const response = await fetch(`${API_BASE}/batches?${params}`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
        data: result.data,
        has_more: result.has_more,
        last_id: result.last_id ?? null
    };
}

/**
 * Fetch all batches from OpenAI using cursor-based pagination.
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Array>} Array of all batch objects
 */
export async function fetchBatches(apiKey) {
    const allBatches = [];
    let cursor = null;

    do {
        const page = await fetchBatchPage(apiKey, cursor);
        allBatches.push(...page.data);

        if (page.has_more && page.last_id) {
            cursor = page.last_id;
        } else {
            break;
        }
    } while (true);

    return allBatches;
}
