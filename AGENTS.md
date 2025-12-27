# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static frontend dashboard for the [Robocop](https://github.com/Smaug123/robocop) code review tool. It displays OpenAI batch job statuses and review results by querying the OpenAI Batch API directly from the browser.

## Development

No build step required. Open `index.html` in a browser.

The dashboard requires an OpenAI API key (which the user enters via Settings modal) which is stored in localStorage.

## Architecture

The dashboard is vanilla JavaScript with no framework:

- **index.html** - Single page with all HTML structure, includes CDN dependencies (marked.js for Markdown, DOMPurify for sanitization)
- **app.js** - Application state, initialization, settings management, refresh controls, and the main `loadBatches()` data-fetching function
- **openai.js** - OpenAI API interaction: `fetchBatchOutput()`, `fetchBatchError()`, and parsing functions for batch output/error formats
- **rendering.js** - All DOM rendering: `renderBatches()`, `renderInProgress()`, `renderRecent()`, `renderDetailPanel()`, plus utility functions like `escapeHtml()`, `renderMarkdown()`, `getRelativeTime()`
- **styles.css** - Complete styling (Tron-inspired dark theme with cyan/magenta accents)

## Data Flow

1. `loadBatches()` fetches from OpenAI's `/v1/batches` endpoint
2. Filters for batches where `metadata.description === 'robocop code review tool'` and `metadata.metadata_schema === '1'`
3. For completed batches, fetches output/error files in parallel
4. Caches completed batch data in localStorage (`robocop_review_cache`, `robocop_error_cache`)
5. Renders via `renderBatches()` which calls the three section renderers

## Schema Versioning

See `schemas/1.md` for the current metadata schema. The dashboard validates schema versions and shows warnings for unrecognized versions. When adding new schemas:
1. Add new schema version to `SUPPORTED_SCHEMA_VERSIONS` array in `app.js`
2. Add migration/display logic for the new format
3. Document in `schemas/` folder
