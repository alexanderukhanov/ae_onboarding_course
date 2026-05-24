---
name: create-component
description: Scaffold a new composite UI component with nested child components and business methods. Use when creating a component, form, widget, section, or reusable UI element.
---

# Create Component

## Workflow

1. Gather the component name (e.g., "SearchForm") and its root selector (e.g., "#search-form").
2. **Component existence check**: Check `business/components/**/*.component.ts` for a component with the same name, root selector, or responsibility. If one exists (e.g. `LoginFormComponent` when user asks for "login form"), treat as potential duplicate.
3. **AskQuestion** (merge / stop / continue; add options only when needed): If duplicate likely, ask how to proceed. Options: **merge** – add child elements or methods to existing component; **stop** – use existing component; **continue** – create a new component. If **merge**, identify which file and update it. If **stop**, end. If **continue**, proceed.
4. Ask what child elements it contains (fields, buttons, labels, sub-components).
5. **Child components and locators check**: Verify that any child *components* referenced in the template exist in `business/components/` (e.g. `TextFieldComponent`, `ButtonComponent`). **Extending functionality**: An existing property may be a raw locator (e.g. `this.self.locator('#username')`) where a sub-component would be better—a component is a more complex locator object or collection of locators with encapsulated behaviour. Consider creating the sub-component and replacing the locator property (e.g. `emailField = new TextFieldComponent(this.self.locator('#username'))`). If the design uses a complex child that should be a component but does not exist, note "child component X missing."
6. **AskQuestion** (options by need): If the component needs child components that do not exist, ask whether to create them first (e.g. run create-component for the child, or scaffold with locators only). After creating child components, the user can re-invoke this skill to wire them in.
7. Create the file at `business/components/common/{camelName}.component.ts`.
8. Update the parent page to compose this component.

Use the AskQuestion tool to gather component name, selector, and children if not provided.

## Template

```typescript
import Component from '@/framework/component.comp'

export class {Name}Component extends Component {
  // Child components/locators relative to this.self
  // someField = new TextFieldComponent(this.self.locator('#field'))
  // submitButton = this.self.locator('#submit')
  // statusMsg = this.self.locator('[data-id=status]')

  // Business method
  // async doSomething(input: string) {
  //   await this.someField.self.fill(input)
  //   await this.submitButton.click()
  // }
}
```

## Composing in Parent Page

Add to the parent page class:

```typescript
someSection = new {Name}Component(this.page.locator('{selector}'))
```

## Error Handling

After scaffolding, run these verification steps in order:

1. **Lint and format check**: Run `npx eslint {file}` and `npx prettier --check {file}`. Fix violations (semicolons, quotes, naming, member spacing, blank lines between methods).
2. **Inheritance and types**: Verify the class extends `Component` from `@/framework/component.comp`, uses a named export, and the constructor takes `Locator` (not `Page`). Verify `this.self` is used for the root locator.
3. **Imports and paths**: Verify all imports use the `@/` path alias. Confirm child components receive `this.self.locator(selector)`.
4. **Rule compliance**: Read and verify against `.cursor/rules/framework/ui.mdc`, `.cursor/rules/business/ui.mdc`, and `.cursor/rules/project.mdc`.

## Architectural Pillar Checklist

**Layered Architecture**
- [ ] File is in `business/components/` (business layer; not framework, not tests)
- [ ] File named `{camelName}.component.ts`; named export (`export class`)

**Composite Component POM**
- [ ] Extends `Component` from `@/framework/component.comp`
- [ ] Constructor takes `Locator` (not Page); root locator is `this.self`
- [ ] Child elements use typed components or `this.self.locator(selector)` -- not raw locators for complex elements
- [ ] Multi-step interactions encapsulated as async business methods
- [ ] Parent page updated to compose this component with `this.page.locator(selector)`

**Workflow and dependencies**
- [ ] Component existence check done; AskQuestion used if duplicate likely
- [ ] Child components check done; sub-components created first if needed

**Error Handling completed**
- [ ] Lint and format check passed (eslint, prettier)
- [ ] Inheritance and types verified (Component, Locator, self)
- [ ] Rule compliance verified (framework/ui.mdc, business/ui.mdc, project.mdc)
