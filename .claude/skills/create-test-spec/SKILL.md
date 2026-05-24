---
name: create-test-spec
description: Scaffold a new test spec with AAA structure, data-driven pattern, and web-first assertions. Use when creating a new test, spec, test case, or test class.
---

# Create Test Spec

## Workflow

1. Gather the feature name (e.g., "Registration") and test type (UI or API).
2. **Feature coverage check**: List spec files under `tests/` that might cover the same or related feature (UI: `tests/*UI/**/*.spec.ts` and folder names; API: `tests/*Api/**/*.spec.ts`). If the same feature folder or related specs already exist, treat as potential overlap.
3. **AskQuestion** (merge / stop / continue; add options only when the scenario needs them): If overlap found, ask how to proceed. Options: **merge** – add new test cases to an existing spec file; **stop** – do not create or change anything; **continue** – create a new spec file (reuse patterns where relevant). If **merge**, scaffold into the chosen file. If **stop**, end workflow. If **continue**, proceed.
4. **POM and component presence check** (UI): From the test scenario, derive required page objects and components. Check: page exists in `business/pages/{camelName}.pom.ts` and has a fixture in `business/extensions/test.ext.ts`; required components exist in `business/components/**/*.component.ts` and are composed on the page. **Extending functionality**: The page might expose a raw locator (e.g. `this.page.locator('#form')`) where a component would be more appropriate—a component is a complex locator object or collection of locators with encapsulated behaviour. Then either the component exists and is composed, or it should be created and the locator property replaced. If any required POM or component is missing, do not create the spec yet. **API client presence check** (API): For API test type, derive required API clients (e.g. `authApi`, `userApi`). Check `business/api/*.api.ts` and fixtures in `test.ext.ts`. If any required API client is missing, do not create the spec yet.
5. **AskQuestion** (options by need): If POM or components are missing (UI), ask whether to create them first (e.g. **pom_first**, **component_first**, **both**, or **continue** with placeholders). If API clients are missing (API), suggest running create-api-client first or **continue** with placeholders. After the user runs create-page-object, create-component, or create-api-client, they can re-invoke this skill to generate the spec.
6. Create the file in the correct tests location.

Use the AskQuestion tool to gather feature name and test type if not provided.

## File Locations

- UI: `tests/{feature}UI/{camelFeature}.spec.ts`
- API: `tests/{feature}Api/{camelFeature}.spec.ts`

## UI Test Template

```typescript
import { describe, expect, test } from '@/business/extensions/test.ext'

describe('{Feature}', () => {
  const testData = [{ /* fields */ }]

  testData.forEach(({ /* destructured */ }) => {
    test(`should do something: ${/* interpolation */}`, async ({ /* page fixtures */ }) => {
      // Arrange
      await somePage.open()

      // Act
      await somePage.someComponent.doSomething()

      // Assert
      await expect(somePage.someElement).toBeVisible()
    })
  })
})
```

## API Test Template

```typescript
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/naming-convention */

import { faker } from '@faker-js/faker'
import { describe, expect, test } from '@/business/extensions/test.ext'

describe('{Feature} API', () => {
  test.beforeEach(async ({ authApi }) => {
    await authApi.auth('John Smith', '12345')
  })

  const validUserData = [
    { testCase: 'alphanumeric name', name: `${faker.person.fullName()}123`, email: faker.internet.email() },
  ]

  validUserData.forEach(({ testCase, name, email }) => {
    test(`should create user with ${testCase}`, async ({ request, authApi }) => {
      // Arrange
      const userData = { name, email }
      // Act
      const response = await request.post('/api/users', {
        headers: { Authorization: `Bearer ${authApi.token}` },
        data: userData,
      })
      // Assert
      expect(response.status()).toBe(201)
    })
  })
})
```

## Error Handling

After scaffolding, run these verification steps in order:

1. **Lint and format check**: Run `npx eslint {file}` and `npx prettier --check {file}`. Fix violations (semicolons, quotes, magic numbers, member spacing). API specs need `eslint-disable` for `no-magic-numbers` and `naming-convention`.
2. **Inheritance and types**: Verify page navigation uses `open()` (not `navigate()` or `goto()`). Verify assertions use `expect()` from fixtures, not direct Playwright imports.
3. **Imports and paths**: Verify `test`, `expect`, `describe` are imported from `@/business/extensions/test.ext` -- never from `@playwright/test`. Verify all imports use `@/` path alias.
4. **Rule compliance**: Read and verify against `.cursor/rules/tests/ui.mdc` (UI) or `.cursor/rules/tests/api.mdc` (API), and `.cursor/rules/project.mdc`.

## Architectural Pillar Checklist

**Layered Architecture**
- [ ] Imports from `@/business/` only (not `@/framework/` directly)
- [ ] Import `test`, `expect`, `describe` from `@/business/extensions/test.ext` (never `@playwright/test`)

**Composite Component POM**
- [ ] Interact via page -> component -> child pattern; use `open()` for navigation

**Browser Lifecycle Isolation**
- [ ] No manual browser/context management (fixtures handle it)

**Configuration-Driven**
- [ ] No hardcoded URLs (base URL from playwright.config.ts)

**Native Assertions**
- [ ] `expect()` directly; no wrapping, no try/catch

**Parallel-First**
- [ ] No shared mutable state; self-contained tests

**Test structure**
- [ ] AAA comments in every test
- [ ] Data-driven via `forEach` with test data arrays; API specs use eslint-disable for magic-numbers/naming-convention where needed

**Workflow and dependencies**
- [ ] Feature coverage check done; AskQuestion used if overlap
- [ ] POM/component (UI) or API client (API) presence check done; other skills run first if needed

**Error Handling completed**
- [ ] Lint and format check passed; imports and rule compliance verified (tests/ui.mdc or tests/api.mdc, project.mdc)
