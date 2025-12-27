import { test, expect, describe } from 'bun:test';
import { formatCommitHash, getSafeRepoUrl, getPrUrl, normalizeId, parseGitHubPrUrl } from '../src/urls.js';

describe('formatCommitHash', () => {
    test('truncates long hash to 7 characters', () => {
        expect(formatCommitHash('abc1234567890def')).toBe('abc1234');
    });

    test('returns short hash as-is', () => {
        expect(formatCommitHash('abc')).toBe('abc');
    });

    test('returns N/A for null', () => {
        expect(formatCommitHash(null)).toBe('N/A');
    });

    test('returns N/A for undefined', () => {
        expect(formatCommitHash(undefined)).toBe('N/A');
    });

    test('returns N/A for empty string', () => {
        expect(formatCommitHash('')).toBe('N/A');
    });
});

describe('getSafeRepoUrl', () => {
    test('returns HTTPS URLs for allowed hosts', () => {
        expect(getSafeRepoUrl('https://github.com/user/repo')).toBe('https://github.com/user/repo');
        expect(getSafeRepoUrl('https://gitlab.com/user/repo')).toBe('https://gitlab.com/user/repo');
        expect(getSafeRepoUrl('https://bitbucket.org/user/repo')).toBe('https://bitbucket.org/user/repo');
    });

    test('upgrades HTTP to HTTPS for allowed hosts', () => {
        expect(getSafeRepoUrl('http://github.com/user/repo')).toBe('https://github.com/user/repo');
        expect(getSafeRepoUrl('http://gitlab.com/user/repo')).toBe('https://gitlab.com/user/repo');
        expect(getSafeRepoUrl('http://bitbucket.org/user/repo')).toBe('https://bitbucket.org/user/repo');
    });

    test('normalizes host case', () => {
        expect(getSafeRepoUrl('https://GitHub.COM/user/repo')).toBe('https://github.com/user/repo');
        expect(getSafeRepoUrl('https://GITLAB.com/user/repo')).toBe('https://gitlab.com/user/repo');
    });

    test('returns null for unknown HTTPS hosts', () => {
        expect(getSafeRepoUrl('https://evil.com/user/repo')).toBeNull();
        expect(getSafeRepoUrl('https://github.io/user/repo')).toBeNull();
        expect(getSafeRepoUrl('https://notgithub.com/user/repo')).toBeNull();
    });

    test('returns null for unknown HTTP hosts', () => {
        expect(getSafeRepoUrl('http://evil.com/user/repo')).toBeNull();
        expect(getSafeRepoUrl('http://phishing-site.com/github.com/user/repo')).toBeNull();
    });

    test('converts GitHub SSH to HTTPS', () => {
        expect(getSafeRepoUrl('git@github.com:user/repo')).toBe('https://github.com/user/repo');
    });

    test('converts GitHub SSH with .git suffix', () => {
        expect(getSafeRepoUrl('git@github.com:user/repo.git')).toBe('https://github.com/user/repo');
    });

    test('converts GitLab SSH to HTTPS', () => {
        expect(getSafeRepoUrl('git@gitlab.com:user/repo')).toBe('https://gitlab.com/user/repo');
    });

    test('converts Bitbucket SSH to HTTPS', () => {
        expect(getSafeRepoUrl('git@bitbucket.org:user/repo')).toBe('https://bitbucket.org/user/repo');
    });

    test('converts ssh:// protocol to HTTPS for known hosts', () => {
        expect(getSafeRepoUrl('ssh://git@github.com/user/repo')).toBe('https://github.com/user/repo');
    });

    test('returns null for unknown SSH hosts', () => {
        expect(getSafeRepoUrl('git@unknown.com:user/repo')).toBeNull();
        expect(getSafeRepoUrl('ssh://git@evil.com/user/repo')).toBeNull();
    });

    test('returns null for null input', () => {
        expect(getSafeRepoUrl(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
        expect(getSafeRepoUrl(undefined)).toBeNull();
    });

    test('returns null for empty string', () => {
        expect(getSafeRepoUrl('')).toBeNull();
    });
});

describe('getPrUrl', () => {
    test('returns pull_request_url when present', () => {
        const batch = {
            metadata: {
                pull_request_url: 'https://github.com/user/repo/pull/123',
                remote_url: 'https://github.com/user/repo'
            }
        };
        expect(getPrUrl(batch)).toBe('https://github.com/user/repo/pull/123');
    });

    test('falls back to remote_url when no PR URL', () => {
        const batch = {
            metadata: {
                remote_url: 'https://github.com/user/repo'
            }
        };
        expect(getPrUrl(batch)).toBe('https://github.com/user/repo');
    });

    test('converts SSH PR URL to HTTPS', () => {
        const batch = {
            metadata: {
                pull_request_url: 'git@github.com:user/repo'
            }
        };
        expect(getPrUrl(batch)).toBe('https://github.com/user/repo');
    });

    test('returns null when no metadata', () => {
        expect(getPrUrl({})).toBeNull();
    });

    test('returns null when metadata has no URLs', () => {
        expect(getPrUrl({ metadata: {} })).toBeNull();
    });
});

describe('normalizeId', () => {
    test('produces consistent output for same input', () => {
        const id = 'batch_123';
        expect(normalizeId(id)).toBe(normalizeId(id));
    });

    test('produces different output for different inputs', () => {
        expect(normalizeId('batch_123')).not.toBe(normalizeId('batch_456'));
        expect(normalizeId('a')).not.toBe(normalizeId('b'));
    });

    test('encodes input using base64', () => {
        // btoa('test') = 'dGVzdA=='
        // After URL-safe replacement: 'dGVzdA' (no change needed, padding removed)
        expect(normalizeId('test')).toBe('id_dGVzdA');

        // btoa('batch_123') = 'YmF0Y2hfMTIz'
        expect(normalizeId('batch_123')).toBe('id_YmF0Y2hfMTIz');
    });

    test('uses URL-safe base64 characters', () => {
        // Input that would produce + and / in standard base64
        // btoa('>>??') = 'Pj4_Pw==' which has ? after URL-safe conversion
        // Actually btoa('>>>') = 'Pj4+' and after replacement becomes 'Pj4-'
        const result = normalizeId('>>>');
        expect(result).not.toMatch(/[+/=]/);
        expect(result).toBe('id_Pj4-'); // + becomes -
    });

    test('handles empty string', () => {
        expect(normalizeId('')).toBe('id_');
    });
});

describe('parseGitHubPrUrl', () => {
    test('parses standard GitHub PR URL', () => {
        expect(parseGitHubPrUrl('https://github.com/owner/repo/pull/123')).toEqual({
            owner: 'owner',
            repo: 'repo',
            number: 123
        });
    });

    test('parses PR URL with nested repo path', () => {
        expect(parseGitHubPrUrl('https://github.com/my-org/my-repo/pull/42')).toEqual({
            owner: 'my-org',
            repo: 'my-repo',
            number: 42
        });
    });

    test('parses PR URL with trailing content', () => {
        expect(parseGitHubPrUrl('https://github.com/owner/repo/pull/123/files')).toEqual({
            owner: 'owner',
            repo: 'repo',
            number: 123
        });
    });

    test('handles case-insensitive domain', () => {
        expect(parseGitHubPrUrl('https://GitHub.COM/owner/repo/pull/1')).toEqual({
            owner: 'owner',
            repo: 'repo',
            number: 1
        });
    });

    test('returns null for non-GitHub URLs', () => {
        expect(parseGitHubPrUrl('https://gitlab.com/owner/repo/pull/123')).toBeNull();
        expect(parseGitHubPrUrl('https://bitbucket.org/owner/repo/pull/123')).toBeNull();
    });

    test('returns null for GitHub URLs that are not PRs', () => {
        expect(parseGitHubPrUrl('https://github.com/owner/repo')).toBeNull();
        expect(parseGitHubPrUrl('https://github.com/owner/repo/issues/123')).toBeNull();
        expect(parseGitHubPrUrl('https://github.com/owner/repo/commit/abc123')).toBeNull();
    });

    test('returns null for malformed PR URLs', () => {
        expect(parseGitHubPrUrl('https://github.com/owner/pull/123')).toBeNull();
        expect(parseGitHubPrUrl('https://github.com//repo/pull/123')).toBeNull();
    });

    test('returns null for null input', () => {
        expect(parseGitHubPrUrl(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
        expect(parseGitHubPrUrl(undefined)).toBeNull();
    });

    test('returns null for empty string', () => {
        expect(parseGitHubPrUrl('')).toBeNull();
    });

    test('normalizes HTTP to HTTPS and parses', () => {
        expect(parseGitHubPrUrl('http://github.com/owner/repo/pull/123')).toEqual({
            owner: 'owner',
            repo: 'repo',
            number: 123
        });
    });
});
