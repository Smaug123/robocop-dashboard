/**
 * Imperative rendering functions - handles all DOM manipulation.
 */

import { getRelativeTime, isToday, formatUtcTime } from '../src/time.js';
import { formatCommitHash, getSafeRepoUrl, getPrUrl } from '../src/urls.js';
import { isInProgress, computeSummary } from '../src/batch.js';

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS (DOM-dependent)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Encode a UTF-8 string to base64.
 * @param {string} str - String to encode
 * @returns {string} Base64-encoded string
 */
function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

/**
 * Decode a base64 string to UTF-8.
 * @param {string} base64 - Base64-encoded string
 * @returns {string} Decoded UTF-8 string
 */
function base64ToUtf8(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function renderMarkdown(text) {
    if (!text) return '';
    const html = marked.parse(text);
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['href'],
        ALLOW_DATA_ATTR: false
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY RENDERING
// ═══════════════════════════════════════════════════════════════════════════

export function renderSummary(batches) {
    const today = new Date();
    const summary = computeSummary(batches, today);

    document.getElementById('inFlightCount').textContent = summary.inFlight;
    document.getElementById('completedCount').textContent = summary.completedToday;
    document.getElementById('issuesCount').textContent = summary.issuesFound;

    // Update system status indicator
    const indicator = document.getElementById('systemStatus');
    const statusText = document.getElementById('systemStatusText');

    if (summary.inFlight > 0) {
        indicator.className = 'status-indicator';
        statusText.textContent = 'Processing';
    } else if (batches.length > 0) {
        indicator.className = 'status-indicator';
        statusText.textContent = 'System Active';
    } else {
        indicator.className = 'status-indicator';
        statusText.textContent = 'Ready';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// IN-PROGRESS CARDS
// ═══════════════════════════════════════════════════════════════════════════

export function renderInProgress(batches) {
    const container = document.getElementById('inProgressList');
    const now = Date.now();
    const inProgressBatches = batches.filter(b => isInProgress(b.status));

    if (inProgressBatches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⟐</div>
                <div class="empty-state-text">No reviews in progress</div>
            </div>
        `;
        return;
    }

    container.innerHTML = inProgressBatches.map(batch => {
        const branch = escapeHtml(batch.metadata?.branch || 'Unknown branch');
        const repo = escapeHtml(batch.metadata?.repo_name || '');
        const status = escapeHtml(batch.status);
        const time = getRelativeTime(batch.created_at, now);
        const utcTime = formatUtcTime(batch.created_at);
        const prUrl = getPrUrl(batch);

        const branchContent = prUrl
            ? `<a href="${escapeHtml(prUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${branch}</a>`
            : branch;

        return `
            <div class="progress-card" data-batch-id="${escapeHtml(batch.id)}">
                <div class="progress-info">
                    <div class="progress-branch">${branchContent}</div>
                    <div class="progress-meta-line">
                        ${repo ? `<span class="progress-repo">${repo}</span>` : ''}
                        <span class="progress-status">${status}</span>
                    </div>
                </div>
                <div class="progress-meta">
                    <span class="progress-time" title="${utcTime}">${time}</span>
                    <div class="progress-indicator"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// RECENT LIST
// ═══════════════════════════════════════════════════════════════════════════

export function renderRecent(batches, displayCancelled) {
    const container = document.getElementById('recentList');
    const now = Date.now();

    // Filter for completed/cancelled batches (not in-progress)
    let recentBatches = batches.filter(b => !isInProgress(b.status));

    if (!displayCancelled) {
        recentBatches = recentBatches.filter(b => b.status !== 'cancelled');
    }

    if (recentBatches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">No recent reviews</div>
            </div>
        `;
        return;
    }

    container.innerHTML = recentBatches.map(batch => {
        const branch = escapeHtml(batch.metadata?.branch || 'Unknown');
        const time = getRelativeTime(batch.created_at, now);
        const utcTime = formatUtcTime(batch.created_at);
        const prUrl = getPrUrl(batch);

        let outcomeClass = 'clean';
        let outcomeIcon = '✓';

        if (batch.status === 'cancelled') {
            outcomeClass = '';
            outcomeIcon = '−';
        } else if (batch.status === 'failed' || batch.status === 'expired' || batch.hasErrors || batch.reviewData?.isHttpError) {
            outcomeClass = 'error';
            outcomeIcon = '✗';
        } else if (batch.reviewData?.substantiveComments) {
            outcomeClass = 'issues';
            outcomeIcon = '⚠';
        }

        const branchContent = prUrl
            ? `<a href="${escapeHtml(prUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${branch}</a>`
            : branch;

        return `
            <div class="recent-item" data-batch-id="${escapeHtml(batch.id)}">
                <div class="recent-item-info">
                    <span class="recent-item-outcome ${outcomeClass}">${outcomeIcon}</span>
                    <span class="recent-item-branch">${branchContent}</span>
                </div>
                <span class="recent-item-time" title="${utcTime}">${time}</span>
            </div>
        `;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════

export function renderDetailPanel(batch) {
    const content = document.getElementById('panelContent');
    const title = document.getElementById('panelTitle');

    const branch = escapeHtml(batch.metadata?.branch || 'Unknown branch');
    title.textContent = branch;

    const prUrl = getPrUrl(batch);
    const repoUrl = getSafeRepoUrl(batch.metadata?.remote_url);
    const repoName = escapeHtml(batch.metadata?.repo_name || 'Unknown repo');
    const sourceCommit = batch.metadata?.source_commit;
    const targetCommit = batch.metadata?.target_commit;
    const model = escapeHtml(batch.metadata?.model || 'N/A');
    const reasoningEffort = escapeHtml(batch.metadata?.reasoning_effort || 'N/A');
    const createdAt = new Date(batch.created_at * 1000).toLocaleString();
    const createdAtUtc = formatUtcTime(batch.created_at);

    let html = `
        <div class="panel-section">
            <div class="panel-section-title">Metadata</div>
            <div class="panel-field">
                <span class="panel-field-label">Status</span>
                <span class="panel-field-value">${escapeHtml(batch.status)}</span>
            </div>
            <div class="panel-field">
                <span class="panel-field-label">Created</span>
                <span class="panel-field-value" title="${createdAtUtc}">${createdAt}</span>
            </div>
            <div class="panel-field">
                <span class="panel-field-label">Repository</span>
                <span class="panel-field-value">
                    ${repoUrl ? `<a href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener noreferrer">${repoName}</a>` : repoName}
                </span>
            </div>
            ${prUrl ? `
            <div class="panel-field">
                <span class="panel-field-label">Pull Request</span>
                <span class="panel-field-value">
                    <a href="${escapeHtml(prUrl)}" target="_blank" rel="noopener noreferrer">View PR</a>
                </span>
            </div>
            ` : ''}
            <div class="panel-field">
                <span class="panel-field-label">Source Commit</span>
                <span class="panel-field-value hash">${formatCommitHash(sourceCommit)}</span>
            </div>
            <div class="panel-field">
                <span class="panel-field-label">Target Commit</span>
                <span class="panel-field-value hash">${formatCommitHash(targetCommit)}</span>
            </div>
            <div class="panel-field">
                <span class="panel-field-label">Model</span>
                <span class="panel-field-value">${model}</span>
            </div>
            <div class="panel-field">
                <span class="panel-field-label">Reasoning Effort</span>
                <span class="panel-field-value">${reasoningEffort}</span>
            </div>
        </div>
    `;

    // Render review content if available
    if (batch.status === 'completed') {
        if (batch.reviewData?.isHttpError) {
            html += renderHttpError(batch.reviewData);
        } else if (batch.hasErrors) {
            html += renderBatchErrors(batch);
        } else if (batch.reviewData) {
            html += renderReviewContent(batch.reviewData);
        } else {
            html += `
                <div class="panel-section">
                    <div class="panel-section-title">Review</div>
                    <div class="empty-state">
                        <div class="empty-state-text">Review data not available</div>
                    </div>
                </div>
            `;
        }
    } else if (batch.status === 'cancelled') {
        html += `
            <div class="panel-section">
                <div class="panel-section-title">Review</div>
                <div class="empty-state">
                    <div class="empty-state-text">Review was cancelled</div>
                </div>
            </div>
        `;
    } else if (batch.status === 'failed' || batch.status === 'expired') {
        html += `
            <div class="panel-section">
                <div class="panel-section-title">Review</div>
                <div class="empty-state">
                    <div class="empty-state-text">Review ${batch.status}</div>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="panel-section">
                <div class="panel-section-title">Review</div>
                <div class="empty-state">
                    <div class="empty-state-icon">⏳</div>
                    <div class="empty-state-text">Review in progress...</div>
                </div>
            </div>
        `;
    }

    content.innerHTML = html;

    // Set up reasoning toggle if present
    const reasoningToggle = content.querySelector('.panel-reasoning-toggle');
    if (reasoningToggle) {
        reasoningToggle.addEventListener('click', function() {
            const reasoning = content.querySelector('.panel-reasoning');
            if (reasoning) {
                reasoning.classList.toggle('expanded');
                this.textContent = reasoning.classList.contains('expanded')
                    ? 'Hide Reasoning'
                    : 'Show Reasoning';
            }
        });
    }

    // Set up copy button if present
    const copyBtn = content.querySelector('.panel-copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async function() {
            const encoded = this.getAttribute('data-copy');
            try {
                const text = base64ToUtf8(encoded);
                await navigator.clipboard.writeText(text);
                const originalText = this.textContent;
                this.textContent = 'Copied!';
                setTimeout(() => {
                    this.textContent = originalText;
                }, 1500);
            } catch (e) {
                console.error('Failed to copy:', e);
                this.textContent = 'Failed';
                setTimeout(() => {
                    this.textContent = 'Copy Markdown';
                }, 1500);
            }
        });
    }
}

function renderReviewContent(review) {
    const hasComments = review.substantiveComments;
    const outcomeClass = hasComments ? 'issues' : 'clean';
    const outcomeIcon = hasComments ? '⚠' : '✓';
    const outcomeLabel = hasComments ? 'Issues Found' : 'No Issues';

    const rawSummary = review.summary || 'No summary available';
    const rawReasoning = review.reasoning || 'No reasoning available';
    const summary = renderMarkdown(rawSummary);
    const reasoning = renderMarkdown(rawReasoning);

    // Encode raw text for data attribute (to preserve newlines etc)
    const encodedSummary = utf8ToBase64(rawSummary);

    return `
        <div class="panel-section">
            <div class="panel-section-title">Review</div>
            <div class="panel-review">
                <div class="panel-review-header">
                    <div class="panel-review-outcome ${outcomeClass}">
                        <span class="icon">${outcomeIcon}</span>
                        <span class="label">${outcomeLabel}</span>
                    </div>
                    <button class="panel-copy-btn" data-copy="${encodedSummary}">Copy</button>
                </div>
                <div class="panel-review-summary markdown-content">${summary}</div>
                <button class="panel-reasoning-toggle">Show Reasoning</button>
                <div class="panel-reasoning markdown-content">${reasoning}</div>
            </div>
        </div>
    `;
}

function renderHttpError(errorData) {
    return `
        <div class="panel-section">
            <div class="panel-section-title">Error</div>
            <div class="panel-review" style="border-color: var(--red);">
                <div class="panel-review-outcome error">
                    <span class="icon">✗</span>
                    <span class="label" style="color: var(--red);">HTTP Error ${errorData.statusCode}</span>
                </div>
                <div class="panel-field">
                    <span class="panel-field-label">Request ID</span>
                    <span class="panel-field-value hash">${escapeHtml(errorData.requestId)}</span>
                </div>
            </div>
        </div>
    `;
}

function renderBatchErrors(batch) {
    const failedCount = batch.failedCount || 0;
    const totalCount = batch.request_counts?.total || 0;

    let errorsHtml = '';
    if (batch.errorData && batch.errorData.length > 0) {
        errorsHtml = batch.errorData.map(error => {
            if (error.statusCode) {
                return `
                    <div class="panel-field">
                        <span class="panel-field-label">HTTP ${error.statusCode}</span>
                        <span class="panel-field-value hash">${escapeHtml(error.requestId || 'N/A')}</span>
                    </div>
                `;
            }
            return `
                <div class="panel-field">
                    <span class="panel-field-label">${escapeHtml(error.code)}</span>
                    <span class="panel-field-value">${escapeHtml(error.message)}</span>
                </div>
            `;
        }).join('');
    }

    return `
        <div class="panel-section">
            <div class="panel-section-title">Error</div>
            <div class="panel-review" style="border-color: var(--red);">
                <div class="panel-review-outcome error">
                    <span class="icon">✗</span>
                    <span class="label" style="color: var(--red);">Failed (${failedCount}/${totalCount})</span>
                </div>
                ${errorsHtml}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RENDER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export function renderBatches(batches, displayCancelled) {
    renderSummary(batches);
    renderInProgress(batches);
    renderRecent(batches, displayCancelled);
}
