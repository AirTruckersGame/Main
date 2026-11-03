import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('cold-loads and invokes the emitted ESM API in native Node without Vite or a TS loader', () => {
  const root = resolve('.');
  const output = mkdtempSync(join(tmpdir(), 'airtruckers-api-esm-'));
  try {
    // Vercel's Node builder emits this module graph as ESM JS. Do not bundle,
    // rewrite extensionless imports, or use Vitest's module loader for this test.
    for (const file of ['api/efb.ts', 'server/handler.ts', 'server/providerFetch.ts', 'server/service.ts', 'server/providers.ts', 'src/efbData.ts']) {
      const emitted = ts.transpileModule(readFileSync(join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true } }).outputText;
      const destination = join(output, file.replace(/\.ts$/, '.js'));
      mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, emitted);
    }
    writeFileSync(join(output, 'package.json'), JSON.stringify({ type: 'module' }));
    symlinkSync(join(root, 'node_modules'), join(output, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    writeFileSync(join(output, 'invoke.mjs'), `
      import assert from 'node:assert/strict';
      import { readFileSync } from 'node:fs';
      const root = process.argv[2];
      const fixture = name => readFileSync(root + '/tests/fixtures/' + name, 'utf8');
      // Fixture fetch intercepts provider IO only. Function loading and invocation
      // run in ordinary Node with the actual installed runtime dependencies.
      Date.now = () => Date.parse('2026-11-03T00:44:00Z');
      let fail = false;
      globalThis.fetch = async url => {
        if (fail) throw new Error('Controlled upstream failure');
        const value = String(url);
        if (value.includes('/api/data/metar')) return new Response(fixture('awc-padq-metar-2026-11.json'));
        if (value.includes('/api/data/taf')) return new Response(fixture('awc-padq-taf-2026-11.json'));
        if (value.endsWith('/dtpp/search/')) return new Response(fixture('faa-search-2026-11.html'));
        if (value.endsWith('d-tpp_Metafile.xml')) return new Response(fixture('faa-padq-2611.xml'));
        if (value.endsWith('.PDF')) return new Response('%PDF-1.4\\nFixture bytes for invocation testing');
        throw new Error('Unexpected provider URL');
      };
      const { default: handler } = await import('./api/efb.js');
      assert.equal(typeof handler, 'function');
      async function invoke(query) {
        const headers = {}; let body;
        const response = { statusCode: 200, setHeader(k, v) { headers[k] = v; }, end(value) { body = value; } };
        await handler({ method: 'GET', url: '/api/efb?' + query, headers: {}, socket: { remoteAddress: '127.0.0.1' } }, response);
        return { status: response.statusCode, headers, body, json: () => JSON.parse(body) };
      }
      for (const kind of ['metar', 'taf']) {
        const result = await invoke('action=weather&airport=PADQ&kind=' + kind);
        assert.equal(result.status, 200); assert.equal(result.json().status, 'available'); assert.match(result.json().raw, /PADQ/);
      }
      const charts = await invoke('action=charts&airport=PADQ');
      assert.equal(charts.status, 200); assert.equal(charts.json().charts.length, 6);
      const pdf = await invoke('action=pdf&airport=PADQ&url=' + encodeURIComponent(charts.json().charts[0].url));
      assert.equal(pdf.status, 200); assert.equal(pdf.headers['Content-Type'], 'application/pdf'); assert.equal(new TextDecoder().decode(pdf.body).slice(0, 5), '%PDF-');
      assert.equal((await invoke('action=weather&airport=PADQ&kind=bad')).status, 400);
      fail = true;
      const outage = await invoke('action=weather&airport=PANC&kind=metar');
      assert.equal(outage.status, 503); assert.equal(outage.json().status, 'unavailable');
      console.log('Native Node ESM: METAR, TAF, FAA catalog, PDF, invalid input and provider failure passed.');
    `);
    const result = spawnSync(process.execPath, [join(output, 'invoke.mjs'), root], { encoding: 'utf8', timeout: 20000 });
    expect(result.error, result.error?.message).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('Native Node ESM:');
  } finally { rmSync(output, { recursive: true, force: true }); }
}, 30000);
