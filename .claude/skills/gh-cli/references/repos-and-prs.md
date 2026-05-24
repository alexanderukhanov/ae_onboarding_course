# Repositories & Pull Requests

## Browse (gh browse)

```bash
gh browse                    # Open repo in browser
gh browse script/            # Open specific path
gh browse main.go:312        # Open file at line
gh browse 123                # Open issue or PR
gh browse --branch bug-fix main.go
gh browse --repo owner/repo
gh browse --actions          # Actions tab
gh browse --projects         # Projects tab
gh browse --releases         # Releases tab
gh browse --settings         # Settings page
gh browse --wiki             # Wiki page
gh browse --no-browser       # Print URL only
```

## Repositories (gh repo)

### Create

```bash
gh repo create my-repo
gh repo create my-repo --description "My awesome project"
gh repo create my-repo --public
gh repo create my-repo --private
gh repo create my-repo --homepage https://example.com
gh repo create my-repo --license mit
gh repo create my-repo --gitignore python
gh repo create my-repo --template
gh repo create org/my-repo
gh repo create my-repo --source=.
gh repo create my-repo --disable-issues
gh repo create my-repo --disable-wiki
```

### Clone

```bash
gh repo clone owner/repo
gh repo clone owner/repo my-directory
gh repo clone owner/repo --branch develop
```

### List

```bash
gh repo list
gh repo list owner
gh repo list --limit 50
gh repo list --public
gh repo list --source
gh repo list --json name,visibility,owner
gh repo list --json name --jq '.[].name'
```

### View

```bash
gh repo view
gh repo view owner/repo
gh repo view --json name,description,defaultBranchRef
gh repo view --web
```

### Edit

```bash
gh repo edit --description "New description"
gh repo edit --homepage https://example.com
gh repo edit --visibility private
gh repo edit --visibility public
gh repo edit --enable-issues
gh repo edit --disable-issues
gh repo edit --enable-wiki
gh repo edit --disable-wiki
gh repo edit --enable-projects
gh repo edit --disable-projects
gh repo edit --default-branch main
gh repo rename new-name
gh repo archive
gh repo unarchive
```

### Delete

```bash
gh repo delete owner/repo
gh repo delete owner/repo --yes
```

### Fork & Sync

```bash
gh repo fork owner/repo
gh repo fork owner/repo --org org-name
gh repo fork owner/repo --clone
gh repo fork owner/repo --remote-name upstream
gh repo sync
gh repo sync --branch feature
gh repo sync --force
```

### Set Default

```bash
gh repo set-default
gh repo set-default owner/repo
gh repo set-default --unset
```

### Autolinks

```bash
gh repo autolink list
gh repo autolink add \
  --key-prefix JIRA- \
  --url-template https://jira.example.com/browse/<num>
gh repo autolink delete 12345
```

### Deploy Keys

```bash
gh repo deploy-key list
gh repo deploy-key add ~/.ssh/id_rsa.pub \
  --title "Production server" --read-only
gh repo deploy-key delete 12345
```

### Gitignore & License

```bash
gh repo gitignore
gh repo license mit
gh repo license mit --fullname "John Doe"
```

## Pull Requests (gh pr)

### Create

```bash
gh pr create
gh pr create --title "Feature: Add new functionality"
gh pr create \
  --title "Feature: Add new functionality" \
  --body "This PR adds..."
gh pr create --body-file .github/PULL_REQUEST_TEMPLATE.md
gh pr create --base main
gh pr create --head feature-branch
gh pr create --draft
gh pr create --assignee user1,user2
gh pr create --reviewer user1,user2
gh pr create --labels enhancement,feature
gh pr create --issue 123
gh pr create --repo owner/repo
gh pr create --web
```

### List

```bash
gh pr list
gh pr list --state all
gh pr list --state merged
gh pr list --state closed
gh pr list --head feature-branch
gh pr list --base main
gh pr list --author username
gh pr list --author @me
gh pr list --assignee username
gh pr list --labels bug,enhancement
gh pr list --limit 50
gh pr list --search "is:open is:pr label:review-required"
gh pr list --json number,title,state,author,headRefName
gh pr list --json number,title,statusCheckRollup \
  --jq '.[] | [.number, .title, .statusCheckRollup[]?.status]'
gh pr list --sort created --order desc
```

### View

```bash
gh pr view 123
gh pr view 123 --comments
gh pr view 123 --web
gh pr view 123 --json title,body,state,author,commits,files
gh pr view 123 --json files --jq '.files[].path'
gh pr view 123 --json title,state --jq '"\(.title): \(.state)"'
```

### Checkout

```bash
gh pr checkout 123
gh pr checkout 123 --branch name-123
gh pr checkout 123 --force
```

### Diff

```bash
gh pr diff 123
gh pr diff 123 --color always
gh pr diff 123 > pr-123.patch
gh pr diff 123 --name-only
```

### Merge

```bash
gh pr merge 123
gh pr merge 123 --merge
gh pr merge 123 --squash
gh pr merge 123 --rebase
gh pr merge 123 --delete-branch
gh pr merge 123 --subject "Merge PR #123" --body "Merging feature"
gh pr merge 123 --admin
```

### Close / Reopen

```bash
gh pr close 123
gh pr close 123 --comment "Closing due to..."
gh pr reopen 123
```

### Edit

```bash
gh pr edit 123
gh pr edit 123 --title "New title"
gh pr edit 123 --body "New description"
gh pr edit 123 --add-label bug,enhancement
gh pr edit 123 --remove-label stale
gh pr edit 123 --add-assignee user1,user2
gh pr edit 123 --remove-assignee user1
gh pr edit 123 --add-reviewer user1,user2
gh pr edit 123 --remove-reviewer user1
gh pr edit 123 --ready
```

### Ready / Checks

```bash
gh pr ready 123
gh pr checks 123
gh pr checks 123 --watch
gh pr checks 123 --watch --interval 5
```

### Comment

```bash
gh pr comment 123 --body "Looks good!"
gh pr comment 123 --body "Fix this" \
  --repo owner/repo \
  --head-owner owner --head-branch feature
gh pr comment 123 --edit 456789 --body "Updated"
gh pr comment 123 --delete 456789
```

### Review

```bash
gh pr review 123
gh pr review 123 --approve --body "LGTM!"
gh pr review 123 --request-changes --body "Please fix these issues"
gh pr review 123 --comment --body "Some thoughts..."
gh pr review 123 --dismiss
```

### Update Branch

```bash
gh pr update-branch 123
gh pr update-branch 123 --force
gh pr update-branch 123 --merge
```

### Lock / Unlock

```bash
gh pr lock 123
gh pr lock 123 --reason off-topic
gh pr unlock 123
```

### Revert

```bash
gh pr revert 123
gh pr revert 123 --branch revert-pr-123
```

### Status

```bash
gh pr status
gh pr status --repo owner/repo
```
