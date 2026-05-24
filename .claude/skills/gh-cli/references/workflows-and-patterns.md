# Common Workflows & Patterns

## Create PR from Issue

```bash
gh issue develop 123 --branch feature/issue-123
git add .
git commit -m "Fix issue #123"
git push
gh pr create --title "Fix #123" --body "Closes #123"
```

## Bulk Operations

```bash
# Close multiple issues
gh issue list --search "label:stale" \
  --json number \
  --jq '.[].number' | \
  xargs -I {} gh issue close {} --comment "Closing as stale"

# Add label to multiple PRs
gh pr list --search "review:required" \
  --json number \
  --jq '.[].number' | \
  xargs -I {} gh pr edit {} --add-label needs-review
```

## Repository Setup

```bash
gh repo create my-project --public \
  --description "My awesome project" \
  --clone \
  --gitignore python \
  --license mit

cd my-project
git checkout -b develop
git push -u origin develop

gh label create bug --color "d73a4a" --description "Bug report"
gh label create enhancement --color "a2eeef" --description "Feature request"
gh label create documentation --color "0075ca" --description "Documentation"
```

## CI/CD Workflow

```bash
RUN_ID=$(gh workflow run ci.yml --ref main --jq '.databaseId')
gh run watch "$RUN_ID"
gh run download "$RUN_ID" --dir ./artifacts
```

## Fork Sync

```bash
gh repo fork original/repo --clone
cd repo
git remote add upstream https://github.com/original/repo.git
gh repo sync

# Manual sync alternative
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Output Formatting

### JSON + jq

```bash
gh repo view --json name,description
gh repo view --json owner,name --jq '.owner.login + "/" + .name'
gh pr list --json number,title --jq '.[] | select(.number > 100)'
gh issue list --json number,title,labels \
  --jq '.[] | {number, title: .title, tags: [.labels[].name]}'
```

### Go Templates

```bash
gh repo view --template '{{.name}}: {{.description}}'
gh pr view 123 \
  --template 'Title: {{.title}}
Author: {{.author.login}}
State: {{.state}}
'
```

## Authentication for Automation

```bash
# Use environment variable
export GH_TOKEN=$(gh auth token)

# Login with token
echo "$TOKEN" | gh auth login --with-token

# Web-based with clipboard
gh auth login --web --clipboard

# Specific git protocol
gh auth login --git-protocol ssh

# GitHub Enterprise
gh auth login --hostname enterprise.internal

# Check status
gh auth status --active
gh auth status --show-token
gh auth status --json hosts --jq '.hosts | add'

# Refresh scopes
gh auth refresh --scopes write:org,read:public_key
gh auth refresh --remove-scopes delete_repo
gh auth refresh --reset-scopes

# Switch accounts
gh auth switch --hostname github.com --user monalisa
```

## Shell Integration

```bash
# Add to ~/.bashrc or ~/.zshrc
eval "$(gh completion -s bash)"  # or zsh/fish

# Useful aliases
alias gs='gh status'
alias gpr='gh pr view --web'
alias gir='gh issue view --web'
alias gco='gh pr checkout'
```

## Git Configuration

```bash
gh auth setup-git
gh auth setup-git --hostname enterprise.internal
gh auth setup-git --hostname enterprise.internal --force
```

## Getting Help

```bash
gh --help
gh pr --help
gh issue create --help
gh help formatting
gh help environment
gh help exit-codes
gh help accessibility
```
