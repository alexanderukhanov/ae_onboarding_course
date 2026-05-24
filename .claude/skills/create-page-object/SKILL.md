---
name: create-page-object
description: Scaffold a new page object in the business layer with proper base class, pageUrl, and component composition. Use when creating a new page, POM, page object, or when adding a page for a new screen/view.
---

# Create Page Object

## Workflow

1. Gather the page name (e.g., "Dashboard") and its relative URL (e.g., "dashboard").
2. **Page existence check**: Check if a page for this name or URL already exists (`business/pages/*.pom.ts` and fixtures in `test.ext.ts`). If a POM with the same logical page or URL exists, treat as potential duplicate.
3. **AskQuestion** (merge / stop / continue; add options only when needed): If duplicate likely, ask how to proceed. Options: **merge** – add components or URL to existing page; **stop** – use existing page; **continue** – create a new page object. If **merge**, identify which file and update it. If **stop**, end. If **continue**, proceed.
4. **Component presence check**: From the page purpose, infer which components it should compose (e.g. login page → `LoginFormComponent`). Check `business/components/**/*.component.ts` for those components. **Extending functionality**: An existing property may be a raw locator (e.g. `this.page.locator('#login-form')`) where a component would be better—a component is a more complex locator object or collection of locators with behaviour. Consider creating the component and replacing the locator property (e.g. `loginForm = new LoginFormComponent(this.page.locator('#login-form'))`). If required components do not exist, note "required components missing."
5. **AskQuestion** (options by need): If required components are missing, ask whether to create them first (e.g. run create-component first, or scaffold page with placeholder/comment). After running create-component, the user can re-invoke this skill to add the new component to the page.
6. Create the file at `business/pages/{camelName}.pom.ts`.
7. Register a fixture in `business/extensions/test.ext.ts`.

Use the AskQuestion tool to gather page name and URL if not provided.

## Template

```typescript
import Page from '@/framework/page.pom'

export class {Name}Page extends Page {
  // Compose components as class fields
  // someSection = new SomeComponent(this.page.locator('#selector'))

  pageUrl = () => '{url}'
}
```

## Post-Creation Registration

Add a fixture in `business/extensions/test.ext.ts`:

```typescript
{camelName}Page: async ({ page }, use) => { await use(new {Name}Page(page)) },
```

Also add the import and extend the fixture type.

## Error Handling

After scaffolding, run these verification steps in order:

1. **Lint and format check**: Run `npx eslint {file}` and `npx prettier --check {file}`. Fix violations (semicolons, quotes, naming, member spacing).
2. **Inheritance and types**: Verify the class extends `Page` from `@/framework/page.pom`, uses a named export, and `pageUrl` is an arrow function property.
3. **Imports and paths**: Verify all imports use the `@/` path alias. Confirm component constructors receive `this.page.locator(selector)`, not `this.page`.
4. **Rule compliance**: Read and verify against `.cursor/rules/framework/ui.mdc`, `.cursor/rules/business/ui.mdc`, and `.cursor/rules/project.mdc`.

## Architectural Pillar Checklist

**Layered Architecture**
- [ ] File is in `business/pages/` (business layer; not framework, not tests)
- [ ] File named `{camelName}.pom.ts`; named export (`export class`)

**Composite Component POM**
- [ ] Extends `Page` from `@/framework/page.pom`
- [ ] `pageUrl` is arrow function property returning relative URL (not absolute)
- [ ] Components composed as class fields with `this.page.locator(selector)` -- no raw locators exposed

**Configuration-Driven**
- [ ] No hardcoded base URL; navigation uses `open()` which uses config base URL

**Workflow and dependencies**
- [ ] Page existence check done; AskQuestion used if duplicate likely
- [ ] Component presence check done; create-component run first if needed
- [ ] Fixture registered in `test.ext.ts` with import and fixture type

**Error Handling completed**
- [ ] Lint and format check passed (eslint, prettier)
- [ ] Inheritance and types verified (Page, pageUrl arrow property)
- [ ] Rule compliance verified (framework/ui.mdc, business/ui.mdc, project.mdc)
