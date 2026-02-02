# Cloudflare Platform Reference Guide

> Comprehensive reference for building and deploying websites on Cloudflare's platform.
> Last updated: January 2026

---

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [Wrangler CLI](#wrangler-cli)
3. [Workers](#workers)
4. [Pages](#pages)
5. [D1 Database](#d1-database)
6. [KV Storage](#kv-storage)
7. [R2 Object Storage](#r2-object-storage)
8. [Configuration Reference](#configuration-reference)
9. [Common Patterns](#common-patterns)

---

## Platform Overview

### Core Services
| Service | Purpose | Use Case |
|---------|---------|----------|
| **Workers** | Serverless compute at the edge | APIs, middleware, server-side logic |
| **Pages** | Full-stack web app deployment | Static sites, SSR apps, JAMstack |
| **D1** | Serverless SQLite database | Relational data, multi-tenant apps |
| **KV** | Global key-value storage | Caching, config, session data |
| **R2** | S3-compatible object storage | Files, images, large blobs (no egress fees) |

### Decision Tree: Workers vs Pages
- **Use Pages** for: Static sites, frameworks with SSR (Next.js, Nuxt, Astro), simple full-stack apps
- **Use Workers** for: APIs, complex routing, multiple bindings, custom behavior

---

## Wrangler CLI

### Installation
```bash
npm install -g wrangler
# or
npm install --save-dev wrangler
```

### Authentication
```bash
wrangler login      # OAuth browser flow
wrangler whoami     # Verify authentication
wrangler logout     # Remove credentials
```

### Essential Commands

#### Project Management
```bash
wrangler init [NAME]                    # Create new project (uses C3)
wrangler dev [SCRIPT]                   # Local development server (localhost:8787)
wrangler deploy [PATH]                  # Deploy to Cloudflare
wrangler delete [SCRIPT]                # Remove Worker
```

#### Development Options
```bash
wrangler dev --port 3000               # Custom port
wrangler dev --remote                  # Test against real Cloudflare services
wrangler dev --test-scheduled          # Test cron triggers
wrangler dev --env staging             # Use specific environment
```

#### D1 Database Commands
```bash
wrangler d1 create <DATABASE_NAME>      # Create database
wrangler d1 list                        # List all databases
wrangler d1 info <DATABASE_NAME>        # Get database info
wrangler d1 execute <DATABASE_NAME> --command "SQL"  # Run SQL
wrangler d1 execute <DATABASE_NAME> --file ./schema.sql  # Run SQL file
wrangler d1 migrations create <DB> <NAME>  # Create migration
wrangler d1 migrations apply <DB>       # Apply migrations
wrangler d1 export <DATABASE_NAME>      # Export data
```

#### KV Commands
```bash
wrangler kv namespace create <NAME>     # Create namespace
wrangler kv namespace list              # List namespaces
wrangler kv key put <KEY> <VALUE> --namespace-id <ID>  # Set value
wrangler kv key get <KEY> --namespace-id <ID>  # Get value
wrangler kv key list --namespace-id <ID>  # List keys
wrangler kv bulk put <FILE> --namespace-id <ID>  # Bulk upload JSON
```

#### R2 Commands
```bash
wrangler r2 bucket create <NAME>        # Create bucket
wrangler r2 bucket list                 # List buckets
wrangler r2 object put <BUCKET>/<KEY> --file <PATH>  # Upload object
wrangler r2 object get <BUCKET>/<KEY>   # Download object
```

#### Secrets Management
```bash
wrangler secret put <KEY>               # Add secret (prompts for value)
wrangler secret list                    # List secrets
wrangler secret delete <KEY>            # Remove secret
wrangler secret bulk                    # Bulk secret operations
```

#### Pages Commands
```bash
wrangler pages project create <NAME>    # Create Pages project
wrangler pages deploy <DIRECTORY>       # Deploy static assets
wrangler pages dev <DIRECTORY>          # Local dev for Pages
wrangler pages dev <DIR> --kv=BINDING   # With KV binding
wrangler pages dev <DIR> --d1=BINDING=DB_ID  # With D1 binding
```

#### Deployment & Monitoring
```bash
wrangler tail                           # Stream live logs
wrangler versions list                  # List versions
wrangler deployments list               # Deployment history
wrangler rollback                       # Revert to previous version
```

#### Utilities
```bash
wrangler types                          # Generate TypeScript types
wrangler check                          # Validate configuration
wrangler docs                           # Open docs in browser
```

---

## Workers

### Project Structure
```
my-worker/
├── src/
│   └── index.ts          # Entry point
├── wrangler.toml         # Or wrangler.jsonc (recommended)
├── package.json
└── tsconfig.json
```

### Basic Worker (TypeScript)
```typescript
export interface Env {
  MY_KV: KVNamespace;
  MY_DB: D1Database;
  MY_BUCKET: R2Bucket;
  API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Route handling
    if (url.pathname === '/api/data') {
      return handleApi(request, env);
    }

    return new Response('Hello World!');
  },

  // Scheduled handler (cron)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(doBackgroundWork(env));
  },
} satisfies ExportedHandler<Env>;
```

### Runtime APIs

#### Fetch API
```typescript
// Making requests
const response = await fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' }),
});

// Response creation
return new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});
```

#### Request/Response Utilities
```typescript
// Clone request for modification
const newRequest = new Request(request, {
  headers: new Headers(request.headers),
});

// Read request body
const body = await request.json();
const formData = await request.formData();
const text = await request.text();

// URL information
const url = new URL(request.url);
const { pathname, searchParams, hostname } = url;
```

#### HTMLRewriter (HTML Transformation)
```typescript
return new HTMLRewriter()
  .on('a', {
    element(element) {
      element.setAttribute('target', '_blank');
    },
  })
  .on('title', {
    text(text) {
      text.replace(text.text.toUpperCase());
    },
  })
  .transform(response);
```

#### Cache API
```typescript
const cache = caches.default;

// Check cache
const cachedResponse = await cache.match(request);
if (cachedResponse) return cachedResponse;

// Fetch and cache
const response = await fetch(request);
ctx.waitUntil(cache.put(request, response.clone()));
return response;
```

#### WebSockets
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();

      server.addEventListener('message', (event) => {
        server.send(`Echo: ${event.data}`);
      });

      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Expected WebSocket', { status: 400 });
  },
};
```

### Geolocation & Request Info
```typescript
// Available in request.cf object
const cf = request.cf;
const country = cf?.country;        // "US"
const city = cf?.city;              // "San Francisco"
const timezone = cf?.timezone;      // "America/Los_Angeles"
const latitude = cf?.latitude;
const longitude = cf?.longitude;
const asn = cf?.asn;                // AS number
const colo = cf?.colo;              // Data center code
```

---

## Pages

### Deployment Methods

#### 1. Git Integration (Recommended)
Connect GitHub/GitLab repository in Cloudflare dashboard for automatic deployments.

#### 2. Direct Upload
```bash
wrangler pages deploy ./dist
```

#### 3. C3 (Create Cloudflare)
```bash
npm create cloudflare@latest my-app
```

### Build Configuration

#### Framework Presets
| Framework | Build Command | Output Directory |
|-----------|--------------|------------------|
| React/Vite | `npm run build` | `dist` |
| Next.js | `npx @cloudflare/next-on-pages@1` | `.vercel/output/static` |
| Astro | `npm run build` | `dist` |
| SvelteKit | `npm run build` | `.svelte-kit/cloudflare` |
| Nuxt | `npm run build` | `.output/public` |
| Hugo | `hugo` | `public` |

#### Environment Variables (Automatic)
- `CI=true` - Indicates CI environment
- `CF_PAGES=1` - Indicates Pages deployment
- `CF_PAGES_COMMIT_SHA` - Git commit hash
- `CF_PAGES_BRANCH` - Branch name
- `CF_PAGES_URL` - Deployment URL

### Pages Functions

#### File-Based Routing
```
functions/
├── index.ts              → /
├── api/
│   ├── index.ts          → /api
│   ├── users.ts          → /api/users
│   └── [id].ts           → /api/:id (dynamic)
├── [[catchall]].ts       → /* (catch-all)
└── _middleware.ts        → Runs on all routes
```

#### Function Handler
```typescript
// functions/api/users.ts
interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;

  const users = await env.DB.prepare('SELECT * FROM users').all();

  return new Response(JSON.stringify(users.results), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await context.request.json();
  // Handle POST...
};
```

#### Middleware
```typescript
// functions/_middleware.ts
export const onRequest: PagesFunction = async (context) => {
  // Before request
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Continue to route handler
  const response = await context.next();

  // After request (modify response)
  response.headers.set('X-Custom-Header', 'value');
  return response;
};
```

#### Dynamic Routes
```typescript
// functions/users/[id].ts
export const onRequestGet: PagesFunction = async ({ params }) => {
  const userId = params.id;  // String
  return new Response(`User: ${userId}`);
};

// functions/docs/[[path]].ts (catch-all)
export const onRequestGet: PagesFunction = async ({ params }) => {
  const pathSegments = params.path;  // Array of strings
  return new Response(`Path: ${pathSegments.join('/')}`);
};
```

#### _routes.json (Route Control)
```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/static/*", "/assets/*", "/*.ico"]
}
```

### Custom Domains

1. **Dashboard Setup**: Workers & Pages → Project → Custom domains → Add
2. **DNS Configuration**:
   - **Apex domain**: Must use Cloudflare DNS (CNAME auto-created)
   - **Subdomain**: Add CNAME pointing to `<project>.pages.dev`

---

## D1 Database

### Setup
```bash
# Create database
wrangler d1 create my-database

# Add to wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "xxxx-xxxx-xxxx"
```

### Schema & Migrations
```bash
# Create migration
wrangler d1 migrations create my-database init

# migrations/0001_init.sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

# Apply migration
wrangler d1 migrations apply my-database
```

### Query API

#### Basic Queries
```typescript
// SELECT with run() - returns full result
const result = await env.DB.prepare(
  'SELECT * FROM users WHERE id = ?'
).bind(userId).run();
// result.results = array of rows
// result.meta = { duration, rows_read, rows_written }

// SELECT with first() - returns single row or null
const user = await env.DB.prepare(
  'SELECT * FROM users WHERE email = ?'
).bind(email).first();

// SELECT with raw() - returns array of arrays
const raw = await env.DB.prepare(
  'SELECT id, name FROM users'
).raw();
// [[1, 'John'], [2, 'Jane']]
```

#### Insert/Update/Delete
```typescript
// INSERT
const insert = await env.DB.prepare(
  'INSERT INTO users (email, name) VALUES (?, ?)'
).bind(email, name).run();
// insert.meta.last_row_id = new ID

// UPDATE
const update = await env.DB.prepare(
  'UPDATE users SET name = ? WHERE id = ?'
).bind(newName, id).run();
// update.meta.changes = rows affected

// DELETE
await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
```

#### Batch Operations
```typescript
const results = await env.DB.batch([
  env.DB.prepare('INSERT INTO users (email) VALUES (?)').bind('a@test.com'),
  env.DB.prepare('INSERT INTO users (email) VALUES (?)').bind('b@test.com'),
  env.DB.prepare('SELECT * FROM users'),
]);
// Returns array of results in order
```

#### TypeScript Typing
```typescript
interface User {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
}

const users = await env.DB.prepare('SELECT * FROM users').all<User>();
const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
  .bind(1)
  .first<User>();
```

### Type Mapping
| JavaScript | SQLite | On Read |
|-----------|--------|---------|
| `null` | NULL | `null` |
| `Number` | REAL/INTEGER | `Number` |
| `String` | TEXT | `String` |
| `Boolean` | INTEGER (0/1) | `Number` |
| `ArrayBuffer` | BLOB | `ArrayBuffer` |

### Time Travel (Backups)
```bash
# Restore to point in time (within 30 days)
wrangler d1 time-travel restore my-database --timestamp "2024-01-15T10:30:00Z"
```

---

## KV Storage

### Setup
```bash
# Create namespace
wrangler kv namespace create MY_KV

# Add to wrangler.toml
[[kv_namespaces]]
binding = "MY_KV"
id = "xxxx"

# For preview/dev
[[kv_namespaces]]
binding = "MY_KV"
id = "xxxx"
preview_id = "yyyy"
```

### API Reference

#### Read Operations
```typescript
// Get value (returns string or null)
const value = await env.MY_KV.get('key');

// Get with type
const json = await env.MY_KV.get('key', 'json');
const buffer = await env.MY_KV.get('key', 'arrayBuffer');
const stream = await env.MY_KV.get('key', 'stream');

// Get with metadata
const { value, metadata } = await env.MY_KV.getWithMetadata('key', 'json');
```

#### Write Operations
```typescript
// Basic put
await env.MY_KV.put('key', 'value');

// With options
await env.MY_KV.put('key', JSON.stringify(data), {
  expirationTtl: 3600,        // Seconds until expiration
  expiration: 1234567890,      // Unix timestamp
  metadata: { version: 1 },    // Arbitrary JSON metadata
});
```

#### Delete & List
```typescript
// Delete
await env.MY_KV.delete('key');

// List keys
const list = await env.MY_KV.list();
// list.keys = [{ name: 'key1' }, { name: 'key2' }]
// list.list_complete = boolean
// list.cursor = string (for pagination)

// List with options
const filtered = await env.MY_KV.list({
  prefix: 'user:',
  limit: 100,
  cursor: previousCursor,
});
```

### Best Practices
- **Eventual consistency**: Reads may be stale for up to 60 seconds
- **Key naming**: Use prefixes for organization (`user:123`, `session:abc`)
- **Size limits**: Values up to 25MB, keys up to 512 bytes
- **Use for**: Caching, configuration, session data
- **Don't use for**: Frequently updated data, strong consistency needs

---

## R2 Object Storage

### Setup
```bash
# Create bucket
wrangler r2 bucket create my-bucket

# Add to wrangler.toml
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket"
```

### API Reference

```typescript
// Upload object
await env.MY_BUCKET.put('path/to/file.jpg', imageData, {
  httpMetadata: {
    contentType: 'image/jpeg',
  },
  customMetadata: {
    uploadedBy: 'user123',
  },
});

// Get object
const object = await env.MY_BUCKET.get('path/to/file.jpg');
if (object) {
  const data = await object.arrayBuffer();
  // object.httpMetadata, object.customMetadata available
}

// Head (metadata only)
const head = await env.MY_BUCKET.head('path/to/file.jpg');

// Delete
await env.MY_BUCKET.delete('path/to/file.jpg');

// List objects
const listed = await env.MY_BUCKET.list({
  prefix: 'uploads/',
  limit: 100,
});
// listed.objects = array of R2Object
// listed.truncated, listed.cursor for pagination
```

### Serving Files via Worker
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);

    const object = await env.MY_BUCKET.get(key);
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    return new Response(object.body, { headers });
  },
};
```

---

## Configuration Reference

### wrangler.toml (Complete Example)
```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Account (optional if logged in)
account_id = "your-account-id"

# Routes
workers_dev = true
route = { pattern = "example.com/*", zone_name = "example.com" }

# Or multiple routes
# [[routes]]
# pattern = "api.example.com/*"
# zone_name = "example.com"

# Cron triggers
[triggers]
crons = ["0 * * * *", "0 0 * * *"]

# Static Assets (Workers)
[assets]
directory = "./public"
binding = "ASSETS"

# Environment variables
[vars]
ENVIRONMENT = "production"
API_URL = "https://api.example.com"

# KV Namespaces
[[kv_namespaces]]
binding = "MY_KV"
id = "xxx-xxx-xxx"

# D1 Databases
[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "xxx-xxx-xxx"

# R2 Buckets
[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket"

# Durable Objects
[[durable_objects.bindings]]
name = "MY_DO"
class_name = "MyDurableObject"

[[migrations]]
tag = "v1"
new_classes = ["MyDurableObject"]

# Service bindings
[[services]]
binding = "AUTH_SERVICE"
service = "auth-worker"

# Hyperdrive (Postgres)
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "xxx-xxx-xxx"

# AI
[ai]
binding = "AI"

# Build configuration
[build]
command = "npm run build"
cwd = "."
watch_dir = "src"

# Limits
[limits]
cpu_ms = 50

# Observability
[observability]
enabled = true
head_sampling_rate = 1

# Local development
[dev]
port = 8787
local_protocol = "https"

# Environments
[env.staging]
name = "my-worker-staging"
vars = { ENVIRONMENT = "staging" }

[env.staging.d1_databases]
binding = "DB"
database_name = "my-database-staging"
database_id = "yyy-yyy-yyy"
```

### wrangler.jsonc (Alternative Format - Recommended for New Projects)
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],

  "kv_namespaces": [
    { "binding": "MY_KV", "id": "xxx-xxx-xxx" }
  ],

  "d1_databases": [
    { "binding": "DB", "database_name": "my-db", "database_id": "xxx" }
  ],

  "r2_buckets": [
    { "binding": "MY_BUCKET", "bucket_name": "my-bucket" }
  ],

  "vars": {
    "ENVIRONMENT": "production"
  }
}
```

### Local Development Files

#### .dev.vars (Secrets for local dev)
```
API_KEY=your-secret-key
DATABASE_URL=postgres://localhost/dev
```

#### .gitignore additions
```
.dev.vars*
.env*
.wrangler/
node_modules/
dist/
```

---

## Common Patterns

### API with Authentication
```typescript
interface Env {
  DB: D1Database;
  API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Auth check
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${env.API_KEY}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    if (url.pathname === '/api/users' && request.method === 'GET') {
      const users = await env.DB.prepare('SELECT * FROM users').all();
      return Response.json(users.results, { headers: corsHeaders });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
```

### Caching Strategy
```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cache = caches.default;
    const cacheKey = new Request(request.url, request);

    // Try cache first
    let response = await cache.match(cacheKey);
    if (response) {
      return response;
    }

    // Fetch from origin
    response = await fetch(request);

    // Clone and cache (only successful responses)
    if (response.ok) {
      const responseToCache = response.clone();
      ctx.waitUntil(cache.put(cacheKey, responseToCache));
    }

    return response;
  },
};
```

### Redirect Handler
```typescript
const redirects: Record<string, string> = {
  '/old-page': '/new-page',
  '/blog': 'https://blog.example.com',
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const redirect = redirects[url.pathname];

    if (redirect) {
      return Response.redirect(
        redirect.startsWith('http') ? redirect : `${url.origin}${redirect}`,
        301
      );
    }

    return fetch(request);
  },
};
```

### Scheduled Task
```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // event.cron = "0 * * * *"
    // event.scheduledTime = timestamp

    ctx.waitUntil(async () => {
      // Cleanup old records
      await env.DB.prepare(
        'DELETE FROM sessions WHERE expires_at < datetime("now")'
      ).run();

      // Send notification
      await fetch('https://hooks.slack.com/...', {
        method: 'POST',
        body: JSON.stringify({ text: 'Cleanup complete' }),
      });
    }());
  },
};
```

### Static Site with API Routes (Pages)
```
project/
├── public/              # Static assets
│   ├── index.html
│   └── styles.css
├── functions/
│   ├── _middleware.ts   # Auth middleware
│   └── api/
│       ├── users.ts     # /api/users
│       └── [id].ts      # /api/:id
├── wrangler.toml
└── package.json
```

---

## Quick Reference

### Wrangler Commands Cheat Sheet
```bash
# Development
wrangler dev                    # Start local server
wrangler dev --remote           # Use real Cloudflare services
wrangler tail                   # Stream logs

# Deployment
wrangler deploy                 # Deploy Worker
wrangler pages deploy ./dist    # Deploy Pages
wrangler rollback               # Revert deployment

# Database
wrangler d1 execute DB --command "SELECT * FROM users"
wrangler d1 migrations apply DB

# Secrets
wrangler secret put MY_SECRET
wrangler secret list

# Debugging
wrangler types                  # Generate types
wrangler check                  # Validate config
```

### Binding Types Reference
```typescript
interface Env {
  // KV
  MY_KV: KVNamespace;

  // D1
  DB: D1Database;

  // R2
  BUCKET: R2Bucket;

  // Durable Objects
  MY_DO: DurableObjectNamespace;

  // Service bindings
  OTHER_WORKER: Fetcher;

  // Queue
  MY_QUEUE: Queue;

  // AI
  AI: Ai;

  // Vectorize
  VECTOR_INDEX: VectorizeIndex;

  // Static assets
  ASSETS: Fetcher;

  // Environment variables
  API_URL: string;
  DEBUG: string;
}
```

### Limits (Free Plan)
| Resource | Limit |
|----------|-------|
| Workers requests | 100,000/day |
| Worker CPU time | 10ms |
| KV reads | 100,000/day |
| KV writes | 1,000/day |
| D1 rows read | 5M/day |
| D1 rows written | 100,000/day |
| R2 Class A ops | 1M/month |
| R2 Class B ops | 10M/month |
| R2 storage | 10GB |
| Pages builds | 500/month |

---

## Troubleshooting

### Common Issues

**522 Error on Custom Domain**
- Always add domain via dashboard first, then configure DNS
- Wait for SSL certificate provisioning (can take minutes)

**KV Returns Stale Data**
- Expected behavior: KV is eventually consistent (up to 60s)
- Use D1 or Durable Objects for strong consistency

**D1 "No such table" Error**
- Run migrations: `wrangler d1 migrations apply DB`
- Check binding name matches config

**Local Dev Can't Access Bindings**
- Use `--remote` flag for real services
- Create `.dev.vars` for secrets

**TypeScript Errors with Bindings**
- Run `wrangler types` to generate types
- Ensure `@cloudflare/workers-types` is installed

### Useful Resources
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [D1 Docs](https://developers.cloudflare.com/d1/)
- [KV Docs](https://developers.cloudflare.com/kv/)
- [R2 Docs](https://developers.cloudflare.com/r2/)
- [Wrangler Commands](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Discord Community](https://discord.cloudflare.com)
