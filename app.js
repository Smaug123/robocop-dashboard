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

function openSettingsModal() {
    document.getElementById('settingsModal').classList.add('open');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('open');
}

function saveSettings() {
    const displayCancelled = document.getElementById('displayCancelledJobs').checked;
    localStorage.setItem('display_cancelled_jobs', displayCancelled.toString());

    const apiKey = document.getElementById('apiKey').value.trim();
    if (apiKey) {
        localStorage.setItem('openai_api_key', apiKey);
    }

    showMessage('Settings saved', 'success');
    closeSettingsModal();

    if (getApiKey()) {
        loadBatches();
    }
}

function getApiKey() {
    return document.getElementById('apiKey').value.trim() || localStorage.getItem('openai_api_key');
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

function closeDetailPanel() {
    document.getElementById('panelOverlay').classList.remove('open');
    document.getElementById('detailPanel').classList.remove('open');
    document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════════════════════
// RECENT SECTION TOGGLE
// ═══════════════════════════════════════════════════════════════════════════

function toggleRecentSection() {
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
}

// ═══════════════════════════════════════════════════════════════════════════
// REFRESH CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

function updateRefreshInterval() {
    const interval = parseInt(document.getElementById('refreshInterval').value);

    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    if (interval > 0 && !document.hidden) {
        refreshTimer = setInterval(loadBatches, interval * 1000);
    }
}

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

function checkSchemaVersions(batches) {
    const unknownVersions = new Set();

    for (const batch of batches) {
        const version = batch.metadata?.metadata_schema;
        if (version && !SUPPORTED_SCHEMA_VERSIONS.includes(version)) {
            unknownVersions.add(version);
        }
    }

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
        const response = await fetch(`${API_BASE}/batches?limit=100`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Filter for robocop batches with schema version 1
        const roboCopBatches = data.data.filter(batch =>
            batch.metadata?.description === 'robocop code review tool' &&
            batch.metadata?.metadata_schema === '1'
        );

        // Detect errors in batches
        roboCopBatches.forEach(batch => {
            const failedCount = batch.request_counts?.failed || 0;
            batch.hasErrors = failedCount > 0 || !!batch.error_file_id;
            batch.failedCount = failedCount;
            batch.errorFileId = batch.error_file_id;
        });

        // Cache for completed batch review data
        const cachedReviews = JSON.parse(localStorage.getItem('robocop_review_cache') || '{}');
        const cachedErrors = JSON.parse(localStorage.getItem('robocop_error_cache') || '{}');

        // Fetch output for completed batches in parallel
        const outputPromises = roboCopBatches
            .filter(batch => batch.status === 'completed' && batch.output_file_id)
            .map(async batch => {
                if (cachedReviews[batch.id]) {
                    batch.reviewData = cachedReviews[batch.id];
                    return;
                }

                try {
                    const output = await fetchBatchOutput(batch.output_file_id);
                    batch.reviewData = parseReviewFromOutput(output);

                    if (batch.reviewData) {
                        cachedReviews[batch.id] = batch.reviewData;
                        localStorage.setItem('robocop_review_cache', JSON.stringify(cachedReviews));
                    }
                } catch (e) {
                    console.error(`Failed to fetch output for batch ${batch.id}:`, e);
                }
            });

        // Fetch error files for batches with errors
        const errorPromises = roboCopBatches
            .filter(batch => batch.hasErrors && batch.errorFileId)
            .map(async batch => {
                if (cachedErrors[batch.id]) {
                    batch.errorData = cachedErrors[batch.id];
                    return;
                }

                try {
                    const errorText = await fetchBatchError(batch.errorFileId);
                    batch.errorData = parseErrorFromOutput(errorText);

                    if (batch.errorData) {
                        cachedErrors[batch.id] = batch.errorData;
                        localStorage.setItem('robocop_error_cache', JSON.stringify(cachedErrors));
                    }
                } catch (e) {
                    console.error(`Failed to fetch error file for batch ${batch.id}:`, e);
                }
            });

        await Promise.all([...outputPromises, ...errorPromises]);

        // Store batches globally for panel access
        currentBatches = roboCopBatches;

        checkSchemaVersions(roboCopBatches);
        renderBatches(roboCopBatches);

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
