---
name: test-specs-writing
description: >
  Write Playwright test specs from a test case document (markdown, CSV, or structured format).
  Implements page objects and spec files following best practices with traceability back to the source test cases.
  Use when user asks to "write tests", "implement test cases", or "create spec files" from a test case document.
  Do NOT use for framework setup — use test-framework-setup instead.
---

# Test Specs Writing

## Overview

Translates a test case document into implemented Playwright test specs. Produces page objects (for UI tests) or API helpers (for API tests), spec files, and a traceability summary linking each implemented test back to its source test case.

---

## When to Use

- User says: "write tests from this test case", "implement these test cases", "create spec files"
- User is trying to: convert documented test cases into runnable Playwright specs
- User has: a test case document (markdown table, CSV, Qase export, or structured format)

---

## Steps

### Step 1: Read and Parse Test Case Document

Read the provided test case document and extract structured test case data.

**Supported formats:**
- Markdown table with columns like ID, Title, Steps, Expected Result
- CSV with test case fields
- Qase-style JSON export
- Free-form markdown with numbered test cases

For each test case, extract:
- **ID** (or assign sequential IDs if missing)
- **Title** / test intent
- **Preconditions** (if any)
- **Steps** (ordered actions)
- **Expected results** (assertions to verify)
- **Test type** (UI or API, inferred from steps if not explicit)

Expected result: structured list of test cases ready for implementation.

### Step 2: Assess Framework Context

Inspect the existing framework to understand conventions.

- Check for existing page objects (TS: `src/pages/`; Python: `pages/`; C#: `Pages/`; Java: `src/test/java/**/pages/`)
- Check for existing test patterns in `tests/` or equivalent
- Identify the test runner config (TS: `playwright.config.ts`; Python: `conftest.py`; C#: `.runsettings`; Java: `pom.xml` / `build.gradle`)
- Note naming conventions, assertion styles, and fixture patterns already in use

Expected result: clear picture of existing patterns to follow.

### Step 3: Implement Page Objects (UI tests)

For each UI test case, create or extend page objects.

**Rules:**
- Page objects own all locators — specs must not contain raw locator logic
- Prefer role-based locators: `getByRole`, `getByLabel`, `getByTestId`
- One page object per logical page/component
- Methods should represent user actions (e.g., `login(email, password)` not `fillEmailField`)
- Reuse existing page objects when they cover the needed interactions

**TypeScript:**
```typescript
import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

**Python:**
```python
from playwright.sync_api import Page, Locator

class LoginPage:
    def __init__(self, page: Page) -> None:
        self._page = page

    @property
    def email_input(self) -> Locator:
        return self._page.get_by_label("Email")

    @property
    def password_input(self) -> Locator:
        return self._page.get_by_label("Password")

    @property
    def submit_button(self) -> Locator:
        return self._page.get_by_role("button", name="Sign in")

    def login(self, email: str, password: str) -> None:
        self.email_input.fill(email)
        self.password_input.fill(password)
        self.submit_button.click()
```

**C#:**
```csharp
using Microsoft.Playwright;

public class LoginPage(IPage page)
{
    public ILocator EmailInput => page.GetByLabel("Email");
    public ILocator PasswordInput => page.GetByLabel("Password");
    public ILocator SubmitButton => page.GetByRole(AriaRole.Button, new() { Name = "Sign in" });

    public async Task LoginAsync(string email, string password)
    {
        await EmailInput.FillAsync(email);
        await PasswordInput.FillAsync(password);
        await SubmitButton.ClickAsync();
    }
}
```

**Java:**
```java
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Locator;

public class LoginPage {
    private final Page page;

    public LoginPage(Page page) { this.page = page; }

    public Locator emailInput() { return page.getByLabel("Email"); }
    public Locator passwordInput() { return page.getByLabel("Password"); }
    public Locator submitButton() { return page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in")); }

    public void login(String email, String password) {
        emailInput().fill(email);
        passwordInput().fill(password);
        submitButton().click();
    }
}
```

Expected result: page objects for all pages/components referenced by UI test cases.

### Step 4: Implement API Helpers (API tests)

For API test cases, set up request helpers if not already present.

**Rules:**
- Use Playwright's built-in `request` / `APIRequestContext` — no third-party HTTP clients
- Create typed response interfaces/models when response structure is known
- Group related endpoints in helper modules

**TypeScript:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Users API', () => {
  test('GET /users returns list', async ({ request }) => {
    const response = await request.get('/api/users');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});
```

**Python:**
```python
from playwright.sync_api import APIRequestContext

def test_get_users_returns_list(api_request_context: APIRequestContext) -> None:
    response = api_request_context.get("/api/users")
    assert response.ok
    assert response.status == 200
    body = response.json()
    assert isinstance(body, list)
```

**C#:**
```csharp
[Test]
public async Task GetUsersReturnsList()
{
    var response = await RequestContext.GetAsync("/api/users");
    Assert.That(response.Ok, Is.True);
    Assert.That(response.Status, Is.EqualTo(200));
}
```

**Java:**
```java
@Test
void getUsersReturnsList() {
    APIResponse response = requestContext.get("/api/users");
    assertTrue(response.ok());
    assertEquals(200, response.status());
}
```

Expected result: API helpers or inline API patterns ready for use in specs.

### Step 5: Write Spec Files

For each test case, write the corresponding spec file.

**Naming:** group specs by feature (e.g. `login.spec.ts`, `test_login.py`, `LoginTests.cs`, `LoginTests.java`).

**Structure per spec:**
- Group related tests (TS: `test.describe`; Python: class or module; C#: `[TestFixture]` class; Java: JUnit 5 class)
- One test per test case, with the test case title as the test name
- Clear arrange/act/assert flow within each test
- Use web-first assertions (`toBeVisible`, `toHaveText`, `toHaveURL` and their language equivalents)

**Principles:**
- **KISS** — simplest approach that satisfies the test intent
- **DRY** — reuse page objects and helpers; create new abstractions only when warranted
- **YAGNI** — no speculative utilities or over-engineering
- **No hard waits** — use auto-waiting and web-first assertions exclusively

Expected result: all test cases have corresponding spec files.

### Step 6: Create Traceability Summary

Produce a brief traceability document mapping each test case to its implementation.

| Test Case ID | Title | Spec File | Test Name | Page Objects Used |
|---|---|---|---|---|
| TC-001 | User login | tests/ui/login.spec.* | should login with valid credentials | LoginPage |

Expected result: complete mapping from source test cases to implemented specs.

---

## Examples

**Example 1: UI tests from markdown table**
User provides a markdown document with 5 login test cases.
What Claude does:
1. Parses 5 test cases (positive login, invalid password, empty fields, locked account, remember me).
2. Checks existing framework — finds pages directory exists but no `LoginPage`.
3. Creates `LoginPage` page object with locators and action methods.
4. Writes spec file with 5 tests following project conventions.
5. Produces traceability summary.
Result: 5 runnable UI specs with full page object coverage.

**Example 2: API tests from CSV**
User provides a CSV with 3 API test cases for a users endpoint.
What Claude does:
1. Parses 3 test cases (list users, create user, delete user).
2. Checks existing framework — uses `request` / `APIRequestContext` fixture pattern.
3. Writes spec file with 3 tests using inline Playwright API calls.
4. Produces traceability summary.
Result: 3 runnable API specs using Playwright's native request fixture.

---

## Error Handling

**Error: Test case document is ambiguous or incomplete**
Cause: Missing steps, expected results, or unclear test intent.
Fix: Ask the user to clarify the specific test cases before implementing.

**Error: Framework not found or not a Playwright project**
Cause: No Playwright config detected (`playwright.config.ts`, `conftest.py`, `.runsettings`, `pom.xml`, or equivalent).
Fix: Run the `test-framework-setup` skill first, then retry.

**Error: Duplicate test names detected**
Cause: Multiple test cases map to the same test name.
Fix: Report duplicates and ask user to disambiguate.

---

## Inputs

| Parameter | Required | Default | Description |
|---|---|---|---|
| `testCaseDocument` | yes | — | Path to the test case document (markdown, CSV, or JSON) |
| `testType` | no | auto-detect | `ui`, `api`, or `both` |
| `specOutputDir` | no | `tests/` | Where to write spec files |
| `pageObjectDir` | no | auto-detect | Where to write page objects |
