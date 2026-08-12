/**
 * page.mjs — the vite server and the browser, shared by every gate that has to
 * render a frame.
 *
 * lookcheck, faultcheck and anything session 3 adds all need the same three
 * things: a dev server on a port nobody else is using, a chromium with a real
 * GPU behind it, and a page whose console is being recorded. Three copies of
 * that is three places for a flag to drift — and the flags matter: without
 * `channel: 'chromium'` playwright launches chrome-headless-shell, which has no
 * GPU and silently falls back to SwiftShader, and a gate measuring SwiftShader
 * output is measuring a different renderer from the one being shipped.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

export async function waitForServer(url, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

export async function startServer(port) {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(
    process.execPath,
    [viteBin, '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const log = [];
  child.stdout.on('data', (d) => log.push(String(d)));
  child.stderr.on('data', (d) => log.push(String(d)));

  const url = `http://127.0.0.1:${port}/`;
  if (!(await waitForServer(url))) {
    child.kill('SIGKILL');
    throw new Error(`vite did not come up on ${url}\n${log.join('')}`);
  }
  return { child, url };
}

/**
 * `NOCTIS_CHROMIUM`: an explicit browser binary, for a machine that already has
 * one at a revision this `playwright` does not expect.
 *
 * WHY THIS IS A LAUNCHER DETAIL AND NOT A GATE CHANGE. `playwright` pins a
 * browser revision and refuses to start when the installed one differs — here,
 * 1194 present against 1234 expected — and the refusal happens before a single
 * assertion is reached, so every gate that opens a page reports a missing
 * executable rather than a verdict about the city. CONTRACT §0.2 is explicit
 * about what that costs: *"a gate that can never pass produces zero
 * measurements, and zero measurements is not stricter than imperfect ones — it
 * is nothing."*
 *
 * IT CANNOT MAKE A RED GATE GREEN. The variable chooses which binary runs; it
 * changes no threshold, no route, no viewport and no argument below. A wrong
 * binary shows up as a wrong renderer string, which every gate already prints
 * beside its numbers, and `readRendererString` is how a log says what it was
 * measured on. Unset — which is every machine that has run this project so far
 * — nothing changes at all.
 */
export function launchBrowser() {
  const exe = process.env.NOCTIS_CHROMIUM || '';
  return chromium.launch({
    // chrome-headless-shell has no GPU and quietly falls back to SwiftShader.
    ...(exe ? { executablePath: exe } : { channel: 'chromium' }),
    headless: true,
    args: [
      '--use-angle=metal',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--enable-webgl-draft-extensions',
      '--disable-frame-rate-limit',
      '--disable-gpu-vsync',
    ],
  });
}

/**
 * A page with its console and page-error streams recorded from the first line.
 * Attaching the listeners after `goto` loses everything the bootstrap logged,
 * which is exactly where a quarantine reports itself.
 */
export async function openPage(browser, { viewport, deviceScaleFactor = 1 } = {}) {
  const context = await browser.newContext({
    viewport: viewport || { width: 800, height: 450 },
    deviceScaleFactor,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    else if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));

  return { context, page, consoleErrors, consoleWarnings, pageErrors };
}

export function rendererIsSoftware(name) {
  return /swiftshader|llvmpipe|software|lavapipe/i.test(name);
}

export async function readRendererString(page) {
  return page.evaluate(() => {
    const gl = document.getElementById('view').getContext('webgl2');
    if (!gl) return 'no webgl2';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  });
}
