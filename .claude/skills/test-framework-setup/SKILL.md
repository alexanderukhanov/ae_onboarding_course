---
name: test-framework-setup
description: >
  Scaffold a Playwright test automation framework with a standardized directory structure,
  environment management, page objects, and sample tests. Supports TypeScript, Python, C#, and Java.
  Use when user asks to "set up a Playwright framework", "scaffold a test project", or "create a QA automation framework".
  Do NOT use for adding tests to an existing framework — use test-specs-writing instead.
---

# Test Framework Setup

## Overview

Scaffolds a production-ready Playwright test automation framework. Supports TypeScript, Python, C#, and Java. Generates a standardized skeleton with environment management, page objects, API clients, and optional sample tests.

---

## When to Use

- User says: "set up a Playwright framework", "scaffold a test project", "create a QA automation framework"
- User is trying to: start a new Playwright-based test automation project with consistent structure and tooling

---

## Steps

### Step 1: Resolve Language

Determine the target language for the framework.

- Use explicit `language` input first (`ts`, `python`, `csharp`, or `java`).
- If omitted, auto-detect from repo signals:
  - TS: `package.json`, `playwright.config.ts`, `tsconfig.json`
  - Python: `pyproject.toml`, `pytest.ini`, `requirements.txt`
  - C#: `*.csproj`, `*.sln`, `.runsettings`
  - Java: `pom.xml`, `build.gradle`
- If no signals found, prompt the user to specify.

Expected result: language is resolved.

### Step 2: Validate Target Path

Confirm the output directory is ready.

- Confirm `{targetDirectory}/{projectName}` is clean.
- If non-empty, require explicit cleanup confirmation from the user.

Expected result: Target directory exists and is empty (or user confirmed overwrite).

### Step 3: Create Directory Skeleton

Generate the common directory structure.

- Required top-level dirs: `src`, `tests`, `config`, `data`, `docs`, `reports`.
- Test suite dirs: `tests/api`, `tests/ui`, `tests/integration`, `tests/smoke`, `tests/regression`.
- Core module dirs under `src`: `config/environments`, `pages`, `components`, `api/endpoints`, `data`, `utils`.
- Env setup: `.env.example` and `.env` with `TEST_ENV` variable.

Expected result: Full directory tree and environment files exist.

### Step 4: Apply Shared Principles

Enforce quality patterns across all languages.

- Keep selectors inside page/component classes — specs must not contain raw locator logic.
- Prefer role/label/text locators (`getByRole`, `getByLabel`, `getByTestId`) over CSS/XPath.
- Use Playwright-native API testing (`request` fixture) instead of third-party HTTP clients.
- Never use hard waits (`waitForTimeout`, `time.sleep`, `Thread.Sleep`, `Thread.sleep`) — use web-first assertions and auto-waiting.
- Use web-first assertions: `toBeVisible`, `toHaveText`, `toHaveURL`.

Expected result: Generated code follows all shared principles with no hard-sleep anti-patterns.

### Step 5: Apply Language-Specific Build

Generate language-specific configs, tooling, and sample code.

**TypeScript:**
- `package.json` with `@playwright/test`, dev dependencies (ESLint, Prettier, typescript)
- `playwright.config.ts` with projects for chromium/firefox/webkit, HTML reporter
- `tsconfig.json` with strict mode
- `.eslintrc.js` and `.prettierrc`
- Sample page object (`src/pages/base.page.ts`) and smoke test (`tests/smoke/health.spec.ts`)

**Python:**
- `requirements.txt` with `playwright`, `pytest`, `pytest-playwright`, `python-dotenv`
- `pyproject.toml` with pytest configuration
- `conftest.py` with base fixtures (browser, page, environment config)
- Ruff for linting
- Sample page object (`src/pages/base_page.py`) and smoke test (`tests/smoke/test_health.py`)

**C#:**
- `.csproj` with `Microsoft.Playwright.NUnit` (or `MSTest`), NUnit adapter
- `.runsettings` with Playwright browser config
- Base test class with Playwright setup/teardown
- Sample page object (`Pages/BasePage.cs`) and smoke test (`Tests/Smoke/HealthTests.cs`)

**Java:**
- `pom.xml` / `build.gradle` with `com.microsoft.playwright`, JUnit 5
- Base test class with Playwright lifecycle (`@BeforeAll` / `@AfterAll`)
- Sample page object (`src/test/java/pages/BasePage.java`) and smoke test (`src/test/java/smoke/HealthTest.java`)

Expected result: Language tooling (linter, formatter, type checking) is configured and functional.

### Step 6: Verify Scaffold

Run a quick validation to ensure the scaffold is complete.

- Confirm all expected directories exist.
- Confirm config files are syntactically valid (parse JSON/YAML/TOML).
- If `includeExamples` is true, confirm sample test files exist and have at least one test.
- Install Playwright browsers (`npx playwright install`, `playwright install`, `pwsh bin/Debug/net8.0/playwright.ps1 install`, or `mvn exec:java ...playwright.CLI install`).

Expected result: Framework is ready for test development.

---

## Examples

**Example 1: TypeScript framework from scratch**
User says: "Set up a Playwright framework in TypeScript called my-qa-project"
What Claude does:
1. Resolves language to `ts`.
2. Creates `my-qa-project/` with full skeleton.
3. Generates TS configs, page objects, sample smoke tests, and HTML report setup.
4. Verifies scaffold completeness.
Result: Ready-to-use TS Playwright framework with sample smoke test.

**Example 2: Python framework with custom URLs**
User says: "Scaffold a Python Playwright project targeting https://staging.example.com with API at https://api.example.com"
What Claude does:
1. Resolves language to `python`.
2. Creates skeleton with `.env` pre-populated with `BASE_URL` and `API_URL`.
3. Generates Python configs, pytest fixtures, page objects, and sample tests.
4. Verifies scaffold completeness.
Result: Python framework with environment-specific URLs configured.

---

## Error Handling

**Error: Target directory is not empty**
Cause: Previous run left files behind or user pointed to an existing project.
Fix: Ask user to confirm cleanup, or pass a clean directory path.

**Error: Language could not be resolved**
Cause: No explicit `language` input and no recognizable repo signals found.
Fix: Prompt user to specify `ts`, `python`, `csharp`, or `java` explicitly.

**Error: Missing directories after scaffold**
Cause: A step was skipped or a file generation failed silently.
Fix: Re-run the failed step and re-verify.

---

## Inputs

| Parameter | Required | Default | Description |
|---|---|---|---|
| `projectName` | yes | — | Name of the project directory to create |
| `language` | no | auto-detect | `ts`, `python`, `csharp`, or `java` |
| `targetDirectory` | no | `cwd` | Where to create the project |
| `prodUrl` | no | — | Application URL for `.env` |
| `apiUrl` | no | — | API base URL (do not infer blindly) |
| `testCredentials` | no | — | `{ email, password }` for sample tests |
| `includeExamples` | no | `true` | Whether to generate sample tests |
