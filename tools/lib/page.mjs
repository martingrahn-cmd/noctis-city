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

export function launchBrowser() {
  return chromium.launch({
    // chrome-headless-shell has no GPU and quietly falls back to SwiftShader.
    channel: 'chromium',
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
