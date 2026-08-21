'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const adminTemplate = fs.readFileSync(path.join(root, 'views', 'admin.ejs'), 'utf8');
const aiRoutes = fs.readFileSync(path.join(root, 'routes', 'ai.js'), 'utf8');

test('admin AI description controls use the backend endpoint and response field', () => {
    assert.match(aiRoutes, /router\.post\('\/api\/ai-describe'/);
    assert.match(aiRoutes, /res\.json\(\{\s*deskripsi:/);

    const endpointCalls = adminTemplate.match(/fetch\('\/api\/ai-describe'/g) || [];
    const responseAssignments = adminTemplate.match(/\.value=d\.deskripsi/g) || [];

    assert.equal(endpointCalls.length, 2, 'add and edit controls must call /api/ai-describe');
    assert.equal(responseAssignments.length, 2, 'add and edit controls must consume d.deskripsi');
});
