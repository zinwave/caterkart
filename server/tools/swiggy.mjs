#!/usr/bin/env node
/**
 * Swiggy MCP localhost harness — OAuth 2.1 + PKCE + Dynamic Client Registration.
 *
 * No Swiggy credentials, no API key, no approval needed: the client registers
 * itself (DCR) and you authorise as yourself with phone + OTP in the browser.
 * Verified against mcp.swiggy.com on 2026-07-13.
 *
 *   node tools/swiggy.mjs login                    # browser → phone+OTP → token
 *   node tools/swiggy.mjs whoami                   # token status
 *   node tools/swiggy.mjs probe                    # read-only smoke test
 *   node tools/swiggy.mjs tools [server]           # list tools a server exposes
 *   node tools/swiggy.mjs call <server> <tool> '<json>'
 *   node tools/swiggy.mjs logout
 *
 * server ∈ food | instamart | dineout
 *
 * SAFETY: there is NO Swiggy sandbox. Live tools act on your real account, and
 * ordering tools spend real money. Every mutating tool is blocked unless you
 * pass --i-know-this-is-real. Read-only calls are always allowed.
 */
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const BASE = process.env.MCP_BASE_URL ?? 'https://mcp.swiggy.com'
const SERVERS = { food: '/food', instamart: '/im', dineout: '/dineout' }
const SCOPE = 'mcp:tools'
const CALLBACK_PORT = 8765
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TOKEN_FILE = path.join(HERE, '..', '.swiggy-tokens.json')

// Tools that change state or spend money. Blocked behind an explicit flag.
const WRITE_TOOLS = new Set([
  'update_food_cart', 'flush_food_cart', 'apply_food_coupon', 'place_food_order',
  'update_cart', 'checkout', 'book_table', 'cancel_booking', 'report_error',
])

// ── token store ────────────────────────────────────────────────────────────
const readTokens = () => {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
  } catch {
    return null
  }
}
const writeTokens = (t) => {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2))
  fs.chmodSync(TOKEN_FILE, 0o600)
}

// ── discovery ──────────────────────────────────────────────────────────────
/** Resolve the authorization server + its endpoints from the protected resource. */
async function discover() {
  // The MCP spec way: ask a protected resource who guards it.
  const prm = await fetch(`${BASE}/food/.well-known/oauth-protected-resource`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)

  const as = prm?.authorization_servers?.[0] ?? `${BASE}/auth`

  // Swiggy does not serve AS metadata publicly (the well-known path sits behind
  // their MCP auth guard and 401s), so fall back to the documented endpoints.
  const meta = await fetch(`${as}/.well-known/oauth-authorization-server`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)

  return {
    authorization_endpoint: meta?.authorization_endpoint ?? `${as}/authorize`,
    token_endpoint: meta?.token_endpoint ?? `${as}/token`,
    registration_endpoint: meta?.registration_endpoint ?? `${as}/register`,
    scopes: prm?.scopes_supported ?? [SCOPE],
  }
}

/** RFC 7591 Dynamic Client Registration — this is why you need no credentials. */
async function registerClient(meta) {
  const res = await fetch(meta.registration_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'CaterKart-Local',
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // public client — PKCE is the proof
      scope: SCOPE,
    }),
  })
  if (!res.ok) throw new Error(`DCR failed: ${res.status} ${await res.text()}`)
  const reg = await res.json()
  return reg.client_id
}

// ── login (OAuth 2.1 + PKCE) ───────────────────────────────────────────────
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

async function login() {
  const meta = await discover()
  console.log(`→ authorization server: ${new URL(meta.authorization_endpoint).origin}${new URL(meta.authorization_endpoint).pathname}`)

  const clientId = await registerClient(meta)
  console.log(`→ registered client via DCR: ${clientId}  (no credentials needed)`)

  const verifier = b64url(crypto.randomBytes(48))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const state = b64url(crypto.randomBytes(16))

  const authUrl = new URL(meta.authorization_endpoint)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('scope', SCOPE)

  const code = await waitForCode(authUrl.toString(), state)
  console.log('→ got authorization code, exchanging for a token…')

  const res = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`)
  const tok = await res.json()

  const expiresIn = tok.expires_in ?? 5 * 86400
  writeTokens({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? null,
    token_type: tok.token_type ?? 'Bearer',
    scope: tok.scope ?? SCOPE,
    client_id: clientId,
    expires_at: Date.now() + expiresIn * 1000,
  })
  console.log(`✓ logged in. Token saved to ${path.relative(process.cwd(), TOKEN_FILE)}`)
  console.log(`  expires: ${new Date(Date.now() + expiresIn * 1000).toLocaleString()}`)
  console.log(`  refresh_token: ${tok.refresh_token ? 'yes' : 'NO — re-run `login` when it expires'}`)
}

/** Serve the loopback redirect, open the browser, resolve with the code. */
function waitForCode(authUrl, expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const err = url.searchParams.get('error')

      const done = (msg, ok) => {
        res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html' })
        res.end(
          `<body style="font:16px system-ui;display:grid;place-items:center;height:90vh;margin:0">
             <div style="text-align:center">
               <div style="font-size:44px">${ok ? '✅' : '⚠️'}</div>
               <h2>${msg}</h2>
               <p style="color:#666">You can close this tab and return to the terminal.</p>
             </div>
           </body>`,
        )
        setTimeout(() => server.close(), 300)
      }

      if (err) {
        done(`Swiggy returned an error: ${err}`, false)
        reject(new Error(`authorization failed: ${err}`))
      } else if (state !== expectedState) {
        // CSRF guard — never exchange a code that came back with a foreign state.
        done('State mismatch — aborted.', false)
        reject(new Error('state mismatch'))
      } else if (!code) {
        done('No authorization code returned.', false)
        reject(new Error('no code'))
      } else {
        done('Connected to Swiggy', true)
        resolve(code)
      }
    })

    server.on('error', reject)
    server.listen(CALLBACK_PORT, () => {
      console.log(`\n→ waiting for the Swiggy login on ${REDIRECT_URI}`)
      console.log('\nIf the browser did not open, paste this URL:\n')
      console.log(authUrl + '\n')
      execFile('open', [authUrl], () => {}) // macOS; harmless if it fails
    })
  })
}

// ── MCP calls ──────────────────────────────────────────────────────────────
async function connect(serverKey) {
  const p = SERVERS[serverKey]
  if (!p) throw new Error(`unknown server "${serverKey}" — use food | instamart | dineout`)

  const tokens = readTokens()
  if (!tokens) throw new Error('not logged in — run: node tools/swiggy.mjs login')
  if (tokens.expires_at <= Date.now()) throw new Error('token expired — run: node tools/swiggy.mjs login')

  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}${p}`), {
    requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  })
  const client = new Client({ name: 'caterkart-harness', version: '0.1.0' })
  await client.connect(transport)
  return client
}

/**
 * Swiggy returns the real payload in `structuredContent`, keyed by entity —
 * e.g. { restaurants: [...] } — NOT under a `data` envelope. The `content` text
 * block is LLM-facing prose (plus a "a rich UI widget is being shown" nudge),
 * so it is only a fallback.
 */
function unwrap(res) {
  const sc = res?.structuredContent
  if (sc && typeof sc === 'object' && Object.keys(sc).length > 0) {
    return 'data' in sc ? sc.data : sc
  }
  const text = res?.content?.find((c) => c.type === 'text')?.text
  if (text) {
    try {
      const parsed = JSON.parse(text)
      return parsed?.data ?? parsed
    } catch {
      return text
    }
  }
  return res
}

async function callTool(serverKey, tool, args, { force }) {
  if (WRITE_TOOLS.has(tool) && !force) {
    console.error(
      `\n⛔ "${tool}" mutates your real Swiggy account (there is no sandbox).\n` +
        `   Re-run with --i-know-this-is-real if you truly mean it.\n`,
    )
    process.exit(2)
  }
  const client = await connect(serverKey)
  try {
    const res = await client.callTool({ name: tool, arguments: args })
    if (res.isError) console.error('⚠️  tool returned isError')
    return unwrap(res)
  } finally {
    await client.close().catch(() => {})
  }
}

async function listTools(serverKey) {
  const client = await connect(serverKey)
  try {
    const { tools } = await client.listTools()
    return tools.map((t) => ({ name: t.name, description: (t.description ?? '').split('\n')[0] }))
  } finally {
    await client.close().catch(() => {})
  }
}

// ── commands ───────────────────────────────────────────────────────────────
const show = (label, v) => {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`)
  console.log(JSON.stringify(v, null, 2).slice(0, 4000))
}

async function probe() {
  console.log('Running read-only smoke tests against your real Swiggy account…')
  show('food · get_addresses', await callTool('food', 'get_addresses', {}, {}))
  show(
    'food · search_restaurants (biryani)',
    await callTool('food', 'search_restaurants', { query: 'biryani' }, {}),
  )
}

async function whoami() {
  const t = readTokens()
  if (!t) return console.log('not logged in — run: node tools/swiggy.mjs login')
  const left = t.expires_at - Date.now()
  console.log(`client_id : ${t.client_id}`)
  console.log(`scope     : ${t.scope}`)
  console.log(`expires   : ${new Date(t.expires_at).toLocaleString()}`)
  console.log(`status    : ${left > 0 ? `valid (${Math.round(left / 3600000)}h left)` : 'EXPIRED — run login'}`)
}

const [cmd, ...rest] = process.argv.slice(2)
const force = rest.includes('--i-know-this-is-real')
const args = rest.filter((a) => !a.startsWith('--'))

try {
  switch (cmd) {
    case 'login':
      await login()
      break
    case 'logout':
      fs.rmSync(TOKEN_FILE, { force: true })
      console.log('✓ token removed')
      break
    case 'whoami':
      await whoami()
      break
    case 'probe':
      await probe()
      break
    case 'tools':
      show(`${args[0] ?? 'food'} tools`, await listTools(args[0] ?? 'food'))
      break
    case 'call': {
      const [server, tool, json] = args
      if (!server || !tool) throw new Error("usage: call <server> <tool> '<json>'")
      show(`${server} · ${tool}`, await callTool(server, tool, json ? JSON.parse(json) : {}, { force }))
      break
    }
    default:
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].split('/**')[1])
  }
} catch (err) {
  console.error(`\n✗ ${err.message}\n`)
  process.exit(1)
}
