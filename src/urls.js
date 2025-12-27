/**
 * Pure URL validation and transformation functions.
 * No side effects, no external dependencies.
 */

/**
 * Truncate a commit hash to 7 characters.
 * @param {string|null|undefined} hash - Full commit hash
 * @returns {string} Truncated hash or 'N/A'
 */
export function formatCommitHash(hash) {
    if (!hash) return 'N/A';
    return hash.substring(0, 7);
}

const ALLOWED_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org'];

/**
 * Check if a hostname is in the allowlist.
 * @param {string} host - Hostname to check
 * @returns {boolean} True if allowed
 */
function isAllowedHost(host) {
    return ALLOWED_HOSTS.includes(host.toLowerCase());
}

/**
 * Validate and transform a git remote URL to an HTTPS URL.
 * Only allows known safe hosts (github.com, gitlab.com, bitbucket.org).
 * @param {string|null|undefined} remoteUrl - Git remote URL (SSH or HTTPS)
 * @returns {string|null} HTTPS URL or null if invalid/unsafe
 */
export function getSafeRepoUrl(remoteUrl) {
    if (!remoteUrl) return null;

    // Handle HTTP/HTTPS URLs - validate host and upgrade to HTTPS
    const httpMatch = remoteUrl.match(/^https?:\/\/([^\/]+)(\/.*)?$/i);
    if (httpMatch) {
        const [, host, path = ''] = httpMatch;
        if (isAllowedHost(host)) {
            return `https://${host.toLowerCase()}${path}`;
        }
        return null;
    }

    // Handle git@host:path SSH format
    const sshMatch = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (sshMatch) {
        const [, host, path] = sshMatch;
        if (isAllowedHost(host)) {
            return `https://${host.toLowerCase()}/${path}`;
        }
        return null;
    }

    // Handle ssh://[git@]host/path format
    const sshProtocolMatch = remoteUrl.match(/^ssh:\/\/(?:git@)?([^\/]+)\/(.+?)(?:\.git)?$/);
    if (sshProtocolMatch) {
        const [, host, path] = sshProtocolMatch;
        if (isAllowedHost(host)) {
            return `https://${host.toLowerCase()}/${path}`;
        }
        return null;
    }

    return null;
}

/**
 * Get the PR or repo URL from batch metadata.
 * Prefers pull_request_url, falls back to remote_url.
 * @param {object} batch - Batch object with metadata
 * @returns {string|null} Safe URL or null
 */
export function getPrUrl(batch) {
    if (batch.metadata?.pull_request_url) {
        return getSafeRepoUrl(batch.metadata.pull_request_url);
    }
    return getSafeRepoUrl(batch.metadata?.remote_url);
}

/**
 * Parse a GitHub PR URL into its components.
 * Normalizes HTTP to HTTPS before parsing.
 * @param {string|null|undefined} url - GitHub PR URL (e.g., "https://github.com/owner/repo/pull/123")
 * @returns {{owner: string, repo: string, number: number}|null} Parsed components or null if not a valid GitHub PR URL
 */
export function parseGitHubPrUrl(url) {
    if (!url) return null;

    // Normalize the URL first (handles http -> https conversion)
    const normalizedUrl = getSafeRepoUrl(url);
    if (!normalizedUrl) return null;

    const match = normalizedUrl.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i);
    if (!match) return null;

    const [, owner, repo, numberStr] = match;
    const number = parseInt(numberStr, 10);

    if (!owner || !repo || isNaN(number)) return null;

    return { owner, repo, number };
}

/**
 * Normalize an ID for use as a DOM element ID.
 * Uses base64 encoding with URL-safe characters.
 * @param {string} id - Original ID
 * @returns {string} Normalized ID safe for DOM use
 */
export function normalizeId(id) {
    try {
        const base64 = btoa(id)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        return 'id_' + base64;
    } catch (e) {
        return 'id_' + id.replace(/[^a-zA-Z0-9\-_]/g, '_');
    }
}
