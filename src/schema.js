/**
 * Pure schema version validation functions.
 */

/**
 * Find schema versions in batches that are not in the supported list.
 * @param {Array} batches - Array of batch objects with metadata
 * @param {Array<string>} supportedVersions - Array of supported schema version strings
 * @returns {Set<string>} Set of unknown schema versions
 */
export function findUnknownSchemaVersions(batches, supportedVersions) {
    const unknownVersions = new Set();

    for (const batch of batches) {
        const version = batch.metadata?.metadata_schema;
        if (version && !supportedVersions.includes(version)) {
            unknownVersions.add(version);
        }
    }

    return unknownVersions;
}
