# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static frontend dashboard for the [Robocop](https://github.com/Smaug123/robocop) code review tool. It displays OpenAI batch job statuses and review results by querying the OpenAI Batch API directly from the browser.

## Development

No build step required. Open `index.html` in a browser.

Run tests with `bun test`.

The dashboard requires an OpenAI API key (which the user enters via Settings modal) which is stored in localStorage.

## Architecture

The codebase follows a functional core / imperative shell pattern using ES modules.
There are no backward-compatibility constraints on the JS library's API surface, because it is only consumed in this repository and deployed alongside its only consumer.

### Pure Functions (`src/`)

Testable, side-effect-free modules:

- **src/parsing.js** - JSONL parsing for batch output/error files: `parseReviewFromOutput()`, `parseErrorFromOutput()`, `parseJsonContent()`
- **src/urls.js** - URL validation and transformation: `getSafeRepoUrl()`, `getPrUrl()`, `formatCommitHash()`, `normalizeId()`
- **src/time.js** - Time formatting (accepts `now` parameter for testability): `getRelativeTime()`, `isToday()`
- **src/schema.js** - Schema version validation: `findUnknownSchemaVersions()`
- **src/batch.js** - Batch status helpers: `isInProgress()`, `categorizeBatches()`, `computeSummary()`, `annotateBatchErrors()`, `filterRobocopBatches()`

### Imperative Shell (`shell/`)

DOM, fetch, and state management:

- **shell/api.js** - OpenAI API fetch wrappers: `fetchBatches()`, `fetchBatchOutput()`, `fetchBatchError()`
- **shell/render.js** - All DOM rendering: `renderBatches()`, `renderInProgress()`, `renderRecent()`, `renderDetailPanel()`, plus `escapeHtml()`, `renderMarkdown()`
- **shell/app.js** - Application state, initialization, event handlers, orchestration, and the main `loadBatches()` function

### Other Files

- **index.html** - Single page with HTML structure, loads CDN dependencies (marked.js, DOMPurify) and the app module
- **styles.css** - Complete styling (Tron-inspired dark theme with cyan/magenta accents)

### Tests (`tests/`)

Bun tests for pure functions:

- **tests/parsing.test.js**
- **tests/urls.test.js**
- **tests/time.test.js**
- **tests/schema.test.js**
- **tests/batch.test.js**

## Data Flow

1. `loadBatches()` in `shell/app.js` fetches from OpenAI's `/v1/batches` endpoint via `shell/api.js`
2. Filters using `filterRobocopBatches()` from `src/batch.js` for batches where `metadata.description === 'robocop code review tool'` and `metadata.metadata_schema === '1'`
3. Annotates with error info using `annotateBatchErrors()` from `src/batch.js`
4. For completed batches, fetches output/error files in parallel and parses with functions from `src/parsing.js`
5. Caches completed batch data in localStorage (`robocop_review_cache`, `robocop_error_cache`)
6. Renders via `renderBatches()` in `shell/render.js`

## Schema Versioning

See `schemas/1.md` for the current metadata schema. The dashboard validates schema versions and shows warnings for unrecognized versions. When adding new schemas:
1. Add new schema version to `SUPPORTED_SCHEMA_VERSIONS` array in `shell/app.js`
2. Add migration/display logic for the new format
3. Document in `schemas/` folder
