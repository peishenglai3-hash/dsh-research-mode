// Minimal Chrome DevTools Protocol driver (no third-party deps).
//
// Node 24 ships a global WebSocket, so we can talk CDP directly instead of pulling
// in playwright/puppeteer — which this repository deliberately does not depend on.
//
//   node tools/w01/cdp.mjs <url> <outDir> [--shot name] [--eval "expr"] [--wait ms]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

export async function withPage(url, options, fn) {
  const port = options.port ?? 9333
  const userDataDir = options.userDataDir
  const child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--disable-extensions', '--mute-audio',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1600,1000',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })

  const deadline = Date.now() + 20000
  let target = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      const list = await res.json()
      target = list.find((t) => t.type === 'page')
      if (target) break
    } catch { /* not up yet */ }
    await sleep(200)
  }
  if (!target) { child.kill(); throw new Error('chrome did not expose a page target') }

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })

  let id = 0
  const pending = new Map()
  const events = []
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`))
      else resolve(msg.result)
    } else if (msg.method) {
      events.push(msg)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id
    pending.set(msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })

  try {
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Page.navigate', { url })
    return await fn({ send, events, sleep })
  } finally {
    try { ws.close() } catch {}
    child.kill()
    await sleep(300)
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  }
  return result.result?.value
}

export async function waitFor(send, expression, timeoutMs = 30000, label = expression) {
  const deadline = Date.now() + timeoutMs
  let last
  while (Date.now() < deadline) {
    try {
      const value = await evaluate(send, expression)
      if (value) return value
      last = value
    } catch (error) { last = error.message }
    await sleep(250)
  }
  throw new Error(`timed out waiting for ${label}; last=${JSON.stringify(last)}`)
}

export async function screenshot(send, path) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(path, Buffer.from(data, 'base64'))
  return path
}

export async function clickText(send, text) {
  // DOM-level click: React's synthetic event system handles a native .click() that
  // bubbles, and it avoids the coordinate/DPR mismatch of synthesised mouse events.
  const hit = await evaluate(send, `(() => {
    const wanted = ${JSON.stringify(text)};
    const candidates = [...document.querySelectorAll('button, a, [role="button"], [role="tab"], li, span, div')]
      .filter((n) => (n.innerText || '').trim() === wanted);
    const node = candidates.find((n) => n.offsetParent !== null || n.getClientRects().length > 0);
    if (!node) return 'not-found';
    node.scrollIntoView({ block: 'center' });
    node.click();
    return 'clicked';
  })()`)
  await sleep(700)
  return hit === 'clicked'
}

export async function clickSelector(send, selector, index = 0) {
  const hit = await evaluate(send, `(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const node = nodes[${index}];
    if (!node) return 'not-found';
    node.scrollIntoView({ block: 'center' });
    node.click();
    return 'clicked';
  })()`)
  await sleep(700)
  return hit === 'clicked'
}

// Click the smallest visible element whose text contains `text`.
export async function clickContains(send, text) {
  const hit = await evaluate(send, `(() => {
    const wanted = ${JSON.stringify(text)};
    const nodes = [...document.querySelectorAll('button, a, [role="button"], [role="tab"], li, span, div, p')]
      .filter((n) => (n.innerText || '').includes(wanted))
      .filter((n) => n.getClientRects().length > 0)
      .sort((a, b) => (a.innerText.length - b.innerText.length));
    const node = nodes[0];
    if (!node) return 'not-found:' + wanted;
    node.scrollIntoView({ block: 'center' });
    node.click();
    return 'clicked';
  })()`)
  await sleep(900)
  return hit === 'clicked'
}

// Click a control whose aria-label / title matches a regex.
export async function clickLabelled(send, pattern) {
  const source = pattern.source ?? String(pattern)
  const flags = pattern.flags ?? ''
  const hit = await evaluate(send, `(() => {
    const re = new RegExp(${JSON.stringify(source)}, ${JSON.stringify(flags)});
    const node = [...document.querySelectorAll('button,[role="button"],[aria-label],[title]')]
      .filter((n) => n.getClientRects().length > 0)
      .find((n) => re.test(n.getAttribute('aria-label') || '') || re.test(n.getAttribute('title') || ''));
    if (!node) return 'not-found';
    node.click();
    return 'clicked';
  })()`)
  await sleep(1000)
  return hit === 'clicked'
}

export async function typeText(send, text) {
  await send('Input.insertText', { text })
  await sleep(150)
}
