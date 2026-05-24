---
name: gh-cli
description: GitHub CLI (gh) reference for repositories, issues, pull requests, Actions, projects, releases, gists, codespaces, organizations, extensions, and all GitHub operations from the command line.
---

# GitHub CLI (gh)

Work seamlessly with GitHub from the command line.

**Version:** 2.85.0 (current as of January 2026)

## Reference Files

Detailed command examples and snippets are in `references/`:

| File | Covers |
|---|---|
| `references/repos-and-prs.md` | Repositories, pull requests, browse |
| `references/issues-and-projects.md` | Issues, projects, labels |
| `references/actions-and-releases.md` | Workflow runs, workflows, caches, secrets, variables, releases |
| `references/api-and-utilities.md` | API requests, gists, codespaces, orgs, search, extensions, SSH/GPG keys, aliases, rulesets, attestations, completion |
| `references/workflows-and-patterns.md` | Common workflows, bulk operations, output formatting, best practices, environment setup |

## Prerequisites

```bash
# Install
brew install gh                    # macOS
winget install --id GitHub.cli     # Windows
sudo apt install gh                # Linux (after adding repo key)

# Authenticate
gh auth login
gh auth login --hostname enterprise.internal
gh auth login --with-token < mytoken.txt
gh auth status
gh auth setup-git
```

## CLI Structure

```
gh
├── auth          login, logout, refresh, setup-git, status, switch, token
├── browse        open repo/file/issue/PR in browser
├── repo          create, list, clone, view, edit, delete, fork, sync, rename, archive
├── pr            create, list, view, checkout, diff, merge, close, review, edit, checks, revert
├── issue         create, list, view, edit, close, comment, pin, lock, transfer, develop
├── project       create, list, view, edit, delete, close, field-*, item-*, link, unlink
├── release       create, list, view, edit, delete, upload, download, verify
├── run           list, view, watch, rerun, cancel, delete, download
├── workflow       list, view, run, enable, disable
├── cache         list, delete
├── secret        list, set, delete
├── variable       list, get, set, delete
├── gist          create, list, view, edit, delete, clone, rename
├── codespace     create, list, view, ssh, code, stop, delete, cp, logs, ports, rebuild
├── org           list
├── search        code, commits, issues, prs, repos
├── api           REST/GraphQL requests with jq/template formatting
├── label         create, list, edit, delete, clone
├── extension      install, list, search, create, upgrade, remove, browse
├── alias         set, list, delete, import
├── config        get, set, list, clear-cache
├── ssh-key       add, list, delete
├── gpg-key       add, list, delete
├── ruleset       list, view, check
├── attestation   download, verify, trusted-root
├── status        overview dashboard
├── completion    bash, zsh, fish, powershell
├── agent-task    list, view, create
└── preview       preview features
```

## Quick Reference

### Repositories

```bash
gh repo create my-repo --public --description "My project" --license mit
gh repo clone owner/repo
gh repo view owner/repo --json name,description
gh repo edit --default-branch main
gh repo fork owner/repo --clone
gh repo sync
gh repo set-default owner/repo
```

### Pull Requests

```bash
gh pr create --title "Feature" --body "Description" --draft
gh pr list --state open --author @me
gh pr view 123 --json title,state,checks
gh pr checkout 123
gh pr diff 123
gh pr merge 123 --squash --delete-branch
gh pr review 123 --approve --body "LGTM!"
gh pr checks 123 --watch
```

### Issues

```bash
gh issue create --title "Bug" --labels bug --assignee @me
gh issue list --state open --labels bug --assignee @me
gh issue view 123 --comments
gh issue edit 123 --add-label priority --milestone "v1.0"
gh issue close 123 --comment "Fixed in PR #456"
gh issue develop 123 --branch fix/issue-123
```

### Actions

```bash
gh run list --workflow "ci.yml" --branch main
gh run view 123456789 --log
gh run watch 123456789
gh run rerun 123456789
gh run download 123456789 --dir ./artifacts
gh workflow run ci.yml --ref develop
gh secret set MY_SECRET --env production
gh variable set MY_VAR "value"
```

### Releases

```bash
gh release create v1.0.0 --notes "Release notes" --target main
gh release upload v1.0.0 ./build.tar.gz
gh release download v1.0.0 --pattern "*.tar.gz" --dir ./downloads
gh release list
```

### API Requests

```bash
gh api /user
gh api /repos/owner/repo --jq '.stargazers_count'
gh api --method POST /repos/owner/repo/issues \
  --field title="Title" --field body="Body"
gh api graphql -f query='{ viewer { login } }'
gh api /user/repos --paginate
```

### Search

```bash
gh search repos "stars:>1000 language:python"
gh search code "TODO" --repo owner/repo
gh search issues "label:bug state:open"
gh search prs "is:open review:required"
```

## Configuration

```bash
gh config set editor vim
gh config set git_protocol ssh
gh config set prompt disabled
gh config list
gh config clear-cache
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `GH_TOKEN` | Authentication token (for automation) |
| `GH_HOST` | GitHub hostname |
| `GH_REPO` | Override default repository |
| `GH_PROMPT_DISABLED` | Disable interactive prompts |
| `GH_EDITOR` | Custom editor |
| `GH_PAGER` | Custom pager |
| `GH_TIMEOUT` | HTTP timeout (seconds) |
| `GH_ENTERPRISE_HOSTNAME` | Enterprise hostname |

## Global Flags

| Flag | Description |
|---|---|
| `--help` / `-h` | Show help |
| `--version` | Show version |
| `--repo [HOST/]OWNER/REPO` | Target repository |
| `--hostname HOST` | GitHub hostname |
| `--jq EXPRESSION` | Filter JSON output |
| `--json FIELDS` | Output as JSON |
| `--template STRING` | Format with Go template |
| `--web` | Open in browser |
| `--paginate` | Fetch all pages |
| `--verbose` | Verbose output |
| `--debug` | Debug output |

## Commit Types (Conventional Commits)

| Type | Purpose |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting (no logic change) |
| `refactor` | Code refactor (no feature/fix) |
| `perf` | Performance improvement |
| `test` | Add/update tests |
| `build` | Build system/dependencies |
| `ci` | CI/config changes |
| `chore` | Maintenance/misc |
| `revert` | Revert commit |

## Best Practices

1. Use `GH_TOKEN` env var for automation / CI pipelines
2. Set default repo with `gh repo set-default owner/repo` to avoid `--repo` everywhere
3. Use `--json` + `--jq` for scripting: `gh pr list --json number,title --jq '.[].title'`
4. Use `--paginate` for large result sets
5. Use `--web` to quickly open any resource in the browser
6. Reference issues in PRs: `Closes #123`, `Refs #456`

## External References

- Official Manual: https://cli.github.com/manual/
- GitHub Docs: https://docs.github.com/en/github-cli
- REST API: https://docs.github.com/en/rest
- GraphQL API: https://docs.github.com/en/graphql
