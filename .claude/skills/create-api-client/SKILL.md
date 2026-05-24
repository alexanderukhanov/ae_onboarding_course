---
name: create-api-client
description: Scaffold a new API client in the business layer that wraps APIRequestContext for a given endpoint or domain. Use when creating a new API client, endpoint wrapper, or when adding API operations for a new resource.
---

# Create API Client

## Workflow

1. Gather the API client name (e.g., "User") and the endpoint path or domain (e.g., "/api/users" or "users").
2. **API client existence check**: Check if an API client for this domain already exists (`business/api/*.api.ts` and fixtures in `test.ext.ts`, e.g. `userApi`, `authApi`). If a client with the same logical domain or path exists, treat as potential duplicate.
3. **AskQuestion** (merge / stop / continue; add options only when needed): If duplicate likely, ask how to proceed. Options: **merge** – add methods or endpoints to existing API client; **stop** – use existing client; **continue** – create a new API client. If **merge**, identify which file and update it. If **stop**, end. If **continue**, proceed.
4. **Dependency check**: If the new client needs authentication, ensure `authApi` (or the required auth client) exists and is used by tests that will call this client; no need to create auth inside this client—callers pass token or use `authApi` fixture. If the client is auth itself (e.g. login), no extra dependency.
5. **AskQuestion** (options by need): If a required dependency (e.g. auth pattern) is unclear, ask whether to proceed with placeholders or align with existing `authApi` usage.
6. Create the file at `business/api/{camelName}Api.api.ts` (e.g. `userApi.api.ts` → class `UserApi`).
7. Register a fixture in `business/extensions/test.ext.ts` using the `request` fixture.

Use the AskQuestion tool to gather client name and endpoint/path if not provided.

## Template

```typescript
import { APIRequestContext } from '@playwright/test'

/**
 * {Brief description of what this API client does and which endpoints it wraps.}
 */
export class {Name}Api {
  private request: APIRequestContext

  constructor(request: APIRequestContext) {
    this.request = request
  }

  // Example: method that performs a request and optionally returns parsed data
  // async create(payload: { name: string; email: string }): Promise<unknown> {
  //   const response = await this.request.post('/api/users', { data: payload })
  //   return response.json()
  // }
}
```

## Post-Creation Registration

Add a fixture in `business/extensions/test.ext.ts`:

```typescript
{camelName}Api: async ({ request }, use) => { await use(new {Name}Api(request)) },
```

Also add the import and extend the fixture type.

## Error Handling

After scaffolding, run these verification steps in order:

1. **Lint and format check**: Run `npx eslint {file}` and `npx prettier --check {file}`. Fix violations (semicolons, quotes, naming, member spacing).
2. **Inheritance and types**: Verify the constructor takes `APIRequestContext` only. Verify the class uses a named export. Confirm file is named `{camelName}Api.api.ts`.
3. **Imports and paths**: Verify all imports use the `@/` path alias. Confirm the fixture is registered in `business/extensions/test.ext.ts` with the correct import.
4. **Rule compliance**: Read and verify against `.cursor/rules/business/ui.mdc` and `.cursor/rules/project.mdc`.

## Architectural Pillar Checklist

**Layered Architecture**
- [ ] File is in `business/api/` (business layer; not framework, not tests)
- [ ] File named `{camelName}Api.api.ts`; named export (`export class`)

**Configuration-Driven**
- [ ] No default credentials or URLs; methods accept explicit parameters

**API artifact**
- [ ] Constructor accepts `APIRequestContext` only
- [ ] One class per API domain; single-responsibility (no mixing auth and other domains in one class)
- [ ] Fixture registered in `test.ext.ts` using `request` fixture; import and fixture type extended

**Workflow and dependencies**
- [ ] API client existence check done; AskQuestion used if duplicate likely
- [ ] Auth dependency (e.g. authApi) considered; callers pass token or use fixture

**Error Handling completed**
- [ ] Lint and format check passed; constructor and file naming verified
- [ ] Rule compliance verified (business/ui.mdc, project.mdc)
