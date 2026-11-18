import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const indexPath = path.resolve(process.cwd(), 'index.html');
const previewPath = path.resolve(process.cwd(), 'preview.html');

const indexHtml = fs.readFileSync(indexPath, 'utf8');
const previewHtml = fs.readFileSync(previewPath, 'utf8');

function getCspDirectives(html) {
    const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
    if (!match) return {};
    const directives = {};
    match[1].split(';').forEach(directiveStr => {
        const parts = directiveStr.trim().split(/\s+/);
        if (parts.length > 0 && parts[0]) {
            directives[parts[0]] = parts.slice(1).sort().join(' ');
        }
    });
    return directives;
}

const expectedIndexDirectives = {
    'default-src': "'self'",
    'script-src': "'self'",
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data:",
    'font-src': "'self'",
    'connect-src': "'self'",
    'frame-src': "'self'",
    'object-src': "'none'",
    'base-uri': "'none'"
};

const expectedPreviewDirectives = {
    ...expectedIndexDirectives,
    'script-src': "'self' 'unsafe-eval'"
};

test('CSP - index.html matches exact hardened policy', () => {
    const dirs = getCspDirectives(indexHtml);
    assert.deepStrictEqual(dirs, expectedIndexDirectives);
});

test('CSP - preview.html matches exact hardened policy', () => {
    const dirs = getCspDirectives(previewHtml);
    assert.deepStrictEqual(dirs, expectedPreviewDirectives);
});
