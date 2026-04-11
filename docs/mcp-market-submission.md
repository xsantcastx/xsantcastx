# MCP Server Directory Submissions

Package: `xsantcastx-mcp-server@1.0.0`
npm: https://www.npmjs.com/package/xsantcastx-mcp-server

---

## Quick Summary

| Directory | URL | Submission Method | Review Timeline |
|-----------|-----|-------------------|-----------------|
| Official MCP Registry | https://registry.modelcontextprotocol.io | CLI (`mcp-publisher publish`) | Not published |
| punkpeye/awesome-mcp-servers | https://github.com/punkpeye/awesome-mcp-servers | GitHub PR to README.md | Not specified (automated merge available) |
| mcpservers.org (wong2) | https://mcpservers.org | Web form at https://mcpservers.org/submit | ~12 hours |
| glama.ai | https://glama.ai/mcp/servers | "Add Server" button on site | Not specified |
| Smithery | https://smithery.ai | CLI or web portal at https://smithery.ai/new | Not specified |
| appcypher/awesome-mcp-servers | https://github.com/appcypher/awesome-mcp-servers | GitHub PR to README.md | Not specified |
| mcpmarket.com | https://mcpmarket.com | Unknown — site behind bot-protection checkpoint | Unknown |

---

## 1. Official MCP Registry (`registry.modelcontextprotocol.io`)

**URL:** https://registry.modelcontextprotocol.io
**GitHub repo:** https://github.com/modelcontextprotocol/registry
**Submission method:** CLI tool (`mcp-publisher`)

### Step-by-step

**Step 1 — Add `mcpName` to `package.json`**

The name must follow the format `io.github.<your-github-username>/<server-name>`:

```json
{
  "name": "xsantcastx-mcp-server",
  "version": "1.0.0",
  "mcpName": "io.github.xsantcastx/xsantcastx-mcp-server"
}
```

**Step 2 — Ensure the package is published on npm**

The package is already published at https://www.npmjs.com/package/xsantcastx-mcp-server, so this step is complete.

**Step 3 — Install the `mcp-publisher` CLI**

macOS/Linux (curl):
```bash
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/
```

Homebrew:
```bash
brew install mcp-publisher
```

**Step 4 — Generate `server.json`**

```bash
mcp-publisher init
```

This creates a `server.json` template. Fill in the required fields:

| Field | Required | Description |
|-------|----------|-------------|
| `$schema` | Yes | `"https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"` |
| `name` | Yes | Must match `mcpName` in package.json (e.g. `io.github.xsantcastx/xsantcastx-mcp-server`) |
| `description` | Yes | Short description of what the server does |
| `version` | Yes | Semver (e.g. `"1.0.0"`) |
| `repository.url` | Yes | GitHub repo URL |
| `repository.source` | Yes | `"github"` |
| `packages[].registryType` | Yes | `"npm"` |
| `packages[].identifier` | Yes | npm package name (`"xsantcastx-mcp-server"`) |
| `packages[].version` | Yes | Package version (`"1.0.0"`) |
| `packages[].transport` | Yes | Connection type (e.g. `"stdio"`) |
| `title` | Optional | Human-readable display name |
| `websiteUrl` | Optional | Docs or homepage URL |
| `repository.subfolder` | Optional | Path within monorepo if applicable |

Example `server.json`:
```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.xsantcastx/xsantcastx-mcp-server",
  "title": "xsantcastx MCP Server",
  "description": "...",
  "version": "1.0.0",
  "repository": {
    "url": "https://github.com/xsantcastx/xsantcastx-mcp-server",
    "source": "github"
  },
  "packages": [
    {
      "registryType": "npm",
      "identifier": "xsantcastx-mcp-server",
      "version": "1.0.0",
      "transport": "stdio"
    }
  ]
}
```

**Step 5 — Authenticate with GitHub**

```bash
mcp-publisher login github
```

Visit the device code URL shown in terminal and authorize the app. This proves you own the `io.github.xsantcastx` namespace.

**Step 6 — Publish**

```bash
mcp-publisher publish
```

**Verify publication:**
```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.xsantcastx/xsantcastx-mcp-server"
```

### Common errors

| Error | Fix |
|-------|-----|
| "Registry validation failed for package" | Ensure `mcpName` is set in package.json |
| "Invalid or expired Registry JWT token" | Re-run `mcp-publisher login github` |
| "You do not have permission to publish" | Server name must start with `io.github.xsantcastx/` |

### Review process
No manual review process documented — publication appears to be near-instant once CLI auth succeeds.

---

## 2. punkpeye/awesome-mcp-servers

**URL:** https://github.com/punkpeye/awesome-mcp-servers
**Submission method:** GitHub Pull Request to `README.md`
**Submission instructions:** https://github.com/punkpeye/awesome-mcp-servers/blob/main/CONTRIBUTING.md

### Step-by-step

1. Fork https://github.com/punkpeye/awesome-mcp-servers
2. Create a branch (e.g. `add-xsantcastx-mcp-server`)
3. Edit `README.md` — add one line entry in the correct category, in alphabetical order, following the existing format:
   ```
   - [xsantcastx-mcp-server](https://github.com/xsantcastx/xsantcastx-mcp-server) - Brief description of what the server does.
   ```
4. Keep the description concise and accurate
5. Commit with a clear message (e.g. `feat: add xsantcastx-mcp-server`)
6. Open a pull request with a clear title and description

### Required fields in the README entry
- Server name (linked to GitHub repo or npm page)
- Brief description of functionality
- Correct category placement, in alphabetical order

### Notes
- PRs from automated agents can add `🤖🤖🤖` to the PR title for a fast-tracked "streamlined merge" process
- Maintainers may request changes or clarification before merging
- Review timeline is not specified

---

## 3. mcpservers.org (wong2/awesome-mcp-servers)

**URL:** https://mcpservers.org
**Submit page:** https://mcpservers.org/submit
**GitHub repo:** https://github.com/wong2/awesome-mcp-servers
**Submission method:** Web form at https://mcpservers.org/submit (PRs to the GitHub repo are NOT accepted)

### Step-by-step

1. Go to https://mcpservers.org/submit
2. Fill in the form with the following fields:

| Field | Required | Notes |
|-------|----------|-------|
| Server Name | Yes | e.g. `xsantcastx-mcp-server` |
| Short Description | Yes | Brief overview of what the server does |
| Link (GitHub or docs) | Yes | e.g. `https://www.npmjs.com/package/xsantcastx-mcp-server` or GitHub URL |
| Category | Yes | Select from: Search, Web Scraping, Communication, Productivity, Development, Database, Cloud Service, File System, Cloud Storage, Version Control, or Other |
| Contact Email | Yes | Your email for communication |

3. Submit the form — listings are free

### Review timeline
Approximately **12 hours**. You will receive an email notification once approved.

### Premium option
An optional "Premium Submit" upgrade costs $39 (one-time) and includes faster approval, an official badge, and a dofollow link.

---

## 4. Glama (`glama.ai/mcp/servers`)

**URL:** https://glama.ai/mcp/servers
**Submission method:** "Add Server" button on the site (exact form fields not publicly documented)

### Step-by-step

1. Go to https://glama.ai/mcp/servers
2. Click the **"Add Server"** button in the navigation
3. Fill in the submission form (exact fields were not retrievable — the form is behind a dynamic UI)

### What Glama indexes
Glama auto-scans GitHub repositories and assigns automated grades for:
- Security
- License compliance
- Code quality

### Notes
- Glama hosts 21,000+ servers
- No review timeline documented
- If the form is inaccessible, check https://glama.ai/gateway/docs for API-based submission options

---

## 5. Smithery (`smithery.ai`)

**URL:** https://smithery.ai
**Submit portal:** https://smithery.ai/new
**Docs:** https://smithery.ai/docs/build/publish.md
**Submission method:** Web portal or CLI

### Step-by-step (Hosted/Remote server)

1. Go to https://smithery.ai/new
2. Enter your server's public HTTPS URL (requires Streamable HTTP transport)
3. Complete the publishing flow

Smithery auto-scans the server URL to extract capabilities. If scanning fails, provide metadata manually via a static server card at `/.well-known/mcp/server-card.json`:

```json
{
  "name": "xsantcastx-mcp-server",
  "version": "1.0.0",
  "authentication": { ... },
  "tools": [ ... ],
  "resources": [ ... ],
  "prompts": [ ... ]
}
```

### Step-by-step (CLI publish)

```bash
smithery mcp publish "https://your-server.com/mcp" -n @xsantcastx/xsantcastx-mcp-server
```

With a config schema:
```bash
smithery mcp publish "https://your-server.com/mcp" -n @xsantcastx/xsantcastx-mcp-server --config-schema '{"type":"object","properties":{"apiKey":{"type":"string"}}}'
```

### Notes
- Smithery requires a public HTTPS URL for the server (stdio-only servers may need a wrapper or hosted deployment)
- OAuth support is handled automatically via Client ID Metadata Documents
- No review timeline documented

---

## 6. appcypher/awesome-mcp-servers

**URL:** https://github.com/appcypher/awesome-mcp-servers
**Submission method:** GitHub Pull Request to `README.md`
**Contributing guide:** https://github.com/appcypher/awesome-mcp-servers/blob/main/CONTRIBUTING.md

### Step-by-step

1. Fork https://github.com/appcypher/awesome-mcp-servers
2. Create a branch (e.g. `add-xsantcastx-mcp-server`)
3. Edit `README.md` — add one line in the appropriate category, following existing formatting:
   - Use the correct category icon/emoji
   - Keep descriptions under ~125 characters
   - Include: server name (linked), brief description, category
4. Commit and push
5. Open a pull request

### Required fields in the README entry
- Server name linked to GitHub repo
- Description (~125 chars max)
- Correct category with icon

### Notes
- Review timeline not specified
- Maintainers may request formatting changes

---

## 7. mcpmarket.com

**URL:** https://mcpmarket.com
**Submission method:** UNKNOWN — the site is protected by a Vercel security checkpoint (bot protection) that blocked automated access during research.

### What is known
- mcpmarket.com exists and lists MCP servers
- The GitHub org at https://github.com/mcpmarket contains only integration repos (Google Ads, Analytics, Meta Ads, etc.) — no public submission repo found
- No submission form URL was retrievable

### Recommended action
Visit https://mcpmarket.com directly in a browser and look for a "Submit", "Add Server", or "List Your Server" button. If no form is present, check if there is a contact/support link on the site.

---

## Notes on `modelcontextprotocol/servers` (official reference repo)

**URL:** https://github.com/modelcontextprotocol/servers

This repo does **not** accept community server submissions. It contains only the small set of reference servers maintained by the MCP steering group (Everything, Fetch, Filesystem, Git, Memory, Sequential Thinking, Time). Community servers should go to the Official MCP Registry instead.
