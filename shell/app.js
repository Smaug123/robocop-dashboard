/**
 * Main application - orchestration, state, and event handlers.
 */

import { parseReviewFromOutput, parseErrorFromOutput } from '../src/parsing.js';
import { findUnknownSchemaVersions } from '../src/schema.js';
import { filterByRobocopDescription, filterBySupportedSchemaVersions, annotateBatchErrors } from '../src/batch.js';
import { parseGitHubPrUrl } from '../src/urls.js';
import { fetchBatches, fetchBatchOutput, fetchBatchError, fetchPrStatus } from './api.js';
import { renderBatches, renderDetailPanel } from './render.js';

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

let refreshTimer = null;
let isLoadingBatches = false;
let currentBatches = [];
let recentExpanded = true;

const SUPPORTED_SCHEMA_VERSIONS = ['1'];

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

window.onload = function() {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
        document.getElementById('apiKey').value = savedKey;
        loadBatches();
    } else {
        openSettingsModal();
    }

    // Load GitHub token
    const savedGitHubToken = localStorage.getItem('github_token');
    if (savedGitHubToken) {
        document.getElementById('githubToken').value = savedGitHubToken;
    }

    // Load display cancelled jobs setting
    const displayCancelled = localStorage.getItem('display_cancelled_jobs');
    document.getElementById('displayCancelledJobs').checked = displayCancelled === 'true';

    updateRefreshInterval();

    // Pause refresh when tab is hidden
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (refreshTimer) {
                clearInterval(refreshTimer);
                refreshTimer = null;
            }
        } else {
            updateRefreshInterval();
            if (!isLoadingBatches) {
                loadBatches();
            }
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeDetailPanel();
            closeSettingsModal();
        }
    });

    // Event delegation for clickable items
    document.addEventListener('click', function(e) {
        const card = e.target.closest('.progress-card, .recent-item');
        if (card) {
            const batchId = card.getAttribute('data-batch-id');
            if (batchId) {
                openDetailPanel(batchId);
            }
        }
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS MODAL
// ═══════════════════════════════════════════════════════════════════════════

window.openSettingsModal = function() {
    document.getElementById('settingsModal').classList.add('open');
};

window.closeSettingsModal = function() {
    document.getElementById('settingsModal').classList.remove('open');
};

window.saveSettings = function() {
    const displayCancelled = document.getElementById('displayCancelledJobs').checked;
    localStorage.setItem('display_cancelled_jobs', displayCancelled.toString());

    const apiKey = document.getElementById('apiKey').value.trim();
    if (apiKey) {
        localStorage.setItem('openai_api_key', apiKey);
    }

    const githubToken = document.getElementById('githubToken').value.trim();
    if (githubToken) {
        localStorage.setItem('github_token', githubToken);
    } else {
        localStorage.removeItem('github_token');
    }

    showMessage('Settings saved', 'success');
    closeSettingsModal();

    if (getApiKey()) {
        loadBatches();
    }
};

function getApiKey() {
    return document.getElementById('apiKey').value.trim() || localStorage.getItem('openai_api_key');
}

function getGitHubToken() {
    return document.getElementById('githubToken').value.trim() || localStorage.getItem('github_token') || null;
}

function getDisplayCancelledJobs() {
    return localStorage.getItem('display_cancelled_jobs') === 'true';
}

// ═══════════════════════════════════════════════════════════════════════════
// DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════

function openDetailPanel(batchId) {
    const batch = currentBatches.find(b => b.id === batchId);
    if (!batch) {
        console.warn('Batch not found:', batchId);
        return;
    }

    renderDetailPanel(batch);

    document.getElementById('panelOverlay').classList.add('open');
    document.getElementById('detailPanel').classList.add('open');
    document.body.style.overflow = 'hidden';
}

window.closeDetailPanel = function() {
    document.getElementById('panelOverlay').classList.remove('open');
    document.getElementById('detailPanel').classList.remove('open');
    document.body.style.overflow = '';
};

// ═══════════════════════════════════════════════════════════════════════════
// RECENT SECTION TOGGLE
// ═══════════════════════════════════════════════════════════════════════════

window.toggleRecentSection = function() {
    const list = document.getElementById('recentList');
    const toggle = document.getElementById('recentToggle');

    recentExpanded = !recentExpanded;

    if (recentExpanded) {
        list.classList.remove('collapsed');
        list.classList.add('expanded');
        toggle.textContent = 'Collapse';
    } else {
        list.classList.remove('expanded');
        list.classList.add('collapsed');
        toggle.textContent = 'Expand';
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// REFRESH CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

window.updateRefreshInterval = function() {
    const interval = parseInt(document.getElementById('refreshInterval').value);

    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    if (interval > 0 && !document.hidden) {
        refreshTimer = setInterval(loadBatches, interval * 1000);
    }
};

window.loadBatches = loadBatches;

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

function showMessage(message, type = 'error') {
    const messageDiv = document.getElementById('message');
    const messageText = document.getElementById('messageText');

    messageText.textContent = message;
    messageDiv.className = `message visible ${type}`;

    setTimeout(() => {
        messageDiv.classList.remove('visible');
    }, 5000);
}

function displaySchemaWarnings(batches) {
    const unknownVersions = findUnknownSchemaVersions(batches, SUPPORTED_SCHEMA_VERSIONS);

    const warningDiv = document.getElementById('schemaWarning');
    const warningText = document.getElementById('schemaWarningText');

    if (unknownVersions.size > 0) {
        const versions = Array.from(unknownVersions).join(', ');
        warningText.textContent = `Unknown schema version(s): ${versions}. Some data may not display correctly. Dashboard supports: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}`;
        warningDiv.classList.add('visible');
    } else {
        warningDiv.classList.remove('visible');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Safely read and parse a JSON cache from localStorage.
 * Returns empty object if missing, malformed, or on error.
 * Clears corrupted cache entries.
 * @param {string} key - localStorage key
 * @returns {object} Parsed cache or empty object
 */
function readCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) {
            console.warn(`Cache ${key} is not an object, resetting`);
            localStorage.removeItem(key);
            return {};
        }
        return parsed;
    } catch (e) {
        console.warn(`Failed to parse cache ${key}, resetting:`, e);
        try {
            localStorage.removeItem(key);
        } catch (_) {
            // Ignore removal errors
        }
        return {};
    }
}

/**
 * Safely write a cache object to localStorage.
 * On quota errors, attempts to clear the cache and retry once.
 * Fails silently if storage is unavailable.
 * @param {string} key - localStorage key
 * @param {object} data - Data to cache
 */
function writeCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.warn(`Storage quota exceeded for ${key}, clearing cache and retrying`);
            try {
                localStorage.removeItem(key);
                localStorage.setItem(key, JSON.stringify(data));
            } catch (retryError) {
                console.error(`Failed to write cache ${key} after clearing:`, retryError);
            }
        } else {
            console.error(`Failed to write cache ${key}:`, e);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════

async function loadBatches() {
    if (isLoadingBatches) {
        return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        showMessage('Please enter an API key');
        return;
    }

    isLoadingBatches = true;

    const loading = document.getElementById('loading');
    const refreshBtn = document.getElementById('refreshBtn');
    loading.classList.remove('hidden');
    refreshBtn.disabled = true;

    try {
        const allBatches = await fetchBatches(apiKey);

        // Filter for robocop batches (any schema version)
        const allRobocopBatches = filterByRobocopDescription(allBatches);

        // Check for unknown schema versions before filtering them out
        displaySchemaWarnings(allRobocopBatches);

        // Now filter to only supported schema versions
        const supportedBatches = filterBySupportedSchemaVersions(allRobocopBatches, SUPPORTED_SCHEMA_VERSIONS);

        // Annotate with error information
        const annotatedBatches = annotateBatchErrors(supportedBatches);

        // Cache for completed batch review data
        const cachedReviews = readCache('robocop_review_cache');
        const cachedErrors = readCache('robocop_error_cache');

        // Fetch output for completed batches in parallel
        const outputPromises = annotatedBatches
            .filter(batch => batch.status === 'completed' && batch.output_file_id)
            .map(async batch => {
                if (cachedReviews[batch.id]) {
                    batch.reviewData = cachedReviews[batch.id];
                    return;
                }

                try {
                    const output = await fetchBatchOutput(batch.output_file_id, apiKey);
                    batch.reviewData = parseReviewFromOutput(output);

                    if (batch.reviewData) {
                        cachedReviews[batch.id] = batch.reviewData;
                        writeCache('robocop_review_cache', cachedReviews);
                    }
                } catch (e) {
                    console.error(`Failed to fetch output for batch ${batch.id}:`, e);
                }
            });

        // Fetch error files for batches with errors
        const errorPromises = annotatedBatches
            .filter(batch => batch.hasErrors && batch.errorFileId)
            .map(async batch => {
                if (cachedErrors[batch.id]) {
                    batch.errorData = cachedErrors[batch.id];
                    return;
                }

                try {
                    const errorText = await fetchBatchError(batch.errorFileId, apiKey);
                    batch.errorData = parseErrorFromOutput(errorText);

                    if (batch.errorData) {
                        cachedErrors[batch.id] = batch.errorData;
                        writeCache('robocop_error_cache', cachedErrors);
                    }
                } catch (e) {
                    console.error(`Failed to fetch error file for batch ${batch.id}:`, e);
                }
            });

        await Promise.all([...outputPromises, ...errorPromises]);

        // Fetch PR statuses from GitHub
        const githubToken = getGitHubToken();
        const cachedPrStatus = readCache('robocop_pr_status_cache');
        const now = Date.now();
        const PR_CACHE_TTL_OPEN = 5 * 60 * 1000; // 5 minutes for open PRs
        const PR_CACHE_TTL_CLOSED = 60 * 60 * 1000; // 1 hour for closed/merged PRs

        // Group batches by PR cacheKey to avoid duplicate API calls
        const prToBatches = new Map(); // cacheKey -> { parsed, batches: [] }
        for (const batch of annotatedBatches) {
            const prUrl = batch.metadata?.pull_request_url;
            if (!prUrl) continue;

            const parsed = parseGitHubPrUrl(prUrl);
            if (!parsed) continue;

            const cacheKey = `${parsed.owner}/${parsed.repo}/${parsed.number}`;
            if (!prToBatches.has(cacheKey)) {
                prToBatches.set(cacheKey, { parsed, batches: [] });
            }
            prToBatches.get(cacheKey).batches.push(batch);
        }

        // Fetch each unique PR once and apply to all matching batches
        const prStatusPromises = Array.from(prToBatches.entries()).map(async ([cacheKey, { parsed, batches }]) => {
            const cached = cachedPrStatus[cacheKey];

            if (cached) {
                const ttl = cached.state === 'open' ? PR_CACHE_TTL_OPEN : PR_CACHE_TTL_CLOSED;
                if (now - cached.checkedAt < ttl) {
                    const prStatus = cached.merged ? 'merged' : cached.state;
                    for (const batch of batches) {
                        batch.prStatus = prStatus;
                    }
                    return;
                }
            }

            const status = await fetchPrStatus(parsed.owner, parsed.repo, parsed.number, githubToken);
            if (status) {
                const prStatus = status.merged ? 'merged' : status.state;
                for (const batch of batches) {
                    batch.prStatus = prStatus;
                }
                cachedPrStatus[cacheKey] = {
                    state: status.state,
                    merged: status.merged,
                    checkedAt: now
                };
                writeCache('robocop_pr_status_cache', cachedPrStatus);
            }
        });

        await Promise.all(prStatusPromises);

        // Store batches globally for panel access
        currentBatches = annotatedBatches;

        renderBatches(annotatedBatches, getDisplayCancelledJobs());

        document.getElementById('lastUpdate').textContent = `Updated ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        console.error('Error loading batches:', error);
        showMessage(`Error: ${error.message}`);
    } finally {
        loading.classList.add('hidden');
        refreshBtn.disabled = false;
        isLoadingBatches = false;
    }
}
