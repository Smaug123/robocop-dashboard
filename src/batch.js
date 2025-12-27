/**
 * Pure batch status and categorization functions.
 */

/**
 * Check if a batch status indicates the batch is still in progress.
 * @param {string} status - Batch status string
 * @returns {boolean} True if batch is in progress
 */
export function isInProgress(status) {
    return ['in_progress', 'validating', 'finalizing', 'cancelling'].includes(status);
}

/**
 * Categorize batches by their status.
 * @param {Array} batches - Array of batch objects
 * @returns {{inProgress: Array, completed: Array, cancelled: Array, failed: Array}}
 */
export function categorizeBatches(batches) {
    const inProgress = [];
    const completed = [];
    const cancelled = [];
    const failed = [];

    for (const batch of batches) {
        if (isInProgress(batch.status)) {
            inProgress.push(batch);
        } else if (batch.status === 'completed') {
            completed.push(batch);
        } else if (batch.status === 'cancelled') {
            cancelled.push(batch);
        } else if (batch.status === 'failed' || batch.status === 'expired') {
            failed.push(batch);
        }
    }

    return { inProgress, completed, cancelled, failed };
}

/**
 * Compute summary statistics for batches.
 * @param {Array} batches - Array of batch objects
 * @param {Date} today - Date object representing "today"
 * @returns {{inFlight: number, completedToday: number, issuesFound: number}}
 */
export function computeSummary(batches, today) {
    let inFlight = 0;
    let completedToday = 0;
    let issuesFound = 0;

    for (const batch of batches) {
        if (isInProgress(batch.status)) {
            inFlight++;
        }

        if (batch.status === 'completed' && batch.completed_at) {
            const completedDate = new Date(batch.completed_at * 1000);
            if (completedDate.toDateString() === today.toDateString()) {
                completedToday++;
                if (batch.reviewData?.substantiveComments || batch.reviewData?.isHttpError) {
                    issuesFound++;
                }
            }
        }
    }

    return { inFlight, completedToday, issuesFound };
}

/**
 * Annotate batches with error information.
 * This is a pure transformation - returns new batch objects.
 * @param {Array} batches - Array of batch objects
 * @returns {Array} New array with annotated batch objects
 */
export function annotateBatchErrors(batches) {
    return batches.map(batch => {
        const failedCount = batch.request_counts?.failed || 0;
        const hasErrors = failedCount > 0 || !!batch.error_file_id;
        return {
            ...batch,
            hasErrors,
            failedCount,
            errorFileId: batch.error_file_id
        };
    });
}

/**
 * Filter batches for robocop by description only.
 * Use this before schema version checks to ensure we can warn about unknown versions.
 * @param {Array} batches - Array of batch objects from OpenAI API
 * @returns {Array} Filtered array of robocop batches (any schema version)
 */
export function filterByRobocopDescription(batches) {
    return batches.filter(batch =>
        batch.metadata?.description === 'robocop code review tool'
    );
}

/**
 * Filter batches to only those with supported schema versions.
 * @param {Array} batches - Array of batch objects
 * @param {Array<string>} supportedVersions - Array of supported schema version strings
 * @returns {Array} Filtered array with only supported schema versions
 */
export function filterBySupportedSchemaVersions(batches, supportedVersions) {
    return batches.filter(batch =>
        supportedVersions.includes(batch.metadata?.metadata_schema)
    );
}

