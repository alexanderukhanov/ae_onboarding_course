# Issues & Projects

## Issues (gh issue)

### Create

```bash
gh issue create
gh issue create --title "Bug: Login not working"
gh issue create \
  --title "Bug: Login not working" \
  --body "Steps to reproduce..."
gh issue create --body-file issue.md
gh issue create --title "Fix bug" --labels bug,high-priority
gh issue create --title "Fix bug" --assignee user1,user2
gh issue create --repo owner/repo --title "Issue title"
gh issue create --web
```

### List

```bash
gh issue list
gh issue list --state all
gh issue list --state closed
gh issue list --limit 50
gh issue list --assignee username
gh issue list --assignee @me
gh issue list --labels bug,enhancement
gh issue list --milestone "v1.0"
gh issue list --search "is:open is:issue label:bug"
gh issue list --json number,title,state,author
gh issue list --json number,title,labels \
  --jq '.[] | [.number, .title, .labels[].name] | @tsv'
gh issue list --json number,title,comments \
  --jq '.[] | [.number, .title, .comments]'
gh issue list --sort created --order desc
```

### View

```bash
gh issue view 123
gh issue view 123 --comments
gh issue view 123 --web
gh issue view 123 --json title,body,state,labels,comments
gh issue view 123 --json title --jq '.title'
```

### Edit

```bash
gh issue edit 123
gh issue edit 123 --title "New title"
gh issue edit 123 --body "New description"
gh issue edit 123 --add-label bug,high-priority
gh issue edit 123 --remove-label stale
gh issue edit 123 --add-assignee user1,user2
gh issue edit 123 --remove-assignee user1
gh issue edit 123 --milestone "v1.0"
```

### Close / Reopen

```bash
gh issue close 123
gh issue close 123 --comment "Fixed in PR #456"
gh issue reopen 123
```

### Comment

```bash
gh issue comment 123 --body "This looks good!"
gh issue comment 123 --edit 456789 --body "Updated comment"
gh issue comment 123 --delete 456789
```

### Status

```bash
gh issue status
gh issue status --repo owner/repo
```

### Pin / Unpin

```bash
gh issue pin 123
gh issue unpin 123
```

### Lock / Unlock

```bash
gh issue lock 123
gh issue lock 123 --reason off-topic
gh issue unlock 123
```

### Transfer

```bash
gh issue transfer 123 --repo owner/new-repo
```

### Delete

```bash
gh issue delete 123
gh issue delete 123 --yes
```

### Develop (Draft PR from Issue)

```bash
gh issue develop 123
gh issue develop 123 --branch fix/issue-123
gh issue develop 123 --base main
```

## Projects (gh project)

### List & View

```bash
gh project list
gh project list --owner owner
gh project list --open
gh project view 123
gh project view 123 --format json
gh project view 123 --web
```

### Create & Edit

```bash
gh project create --title "My Project"
gh project create --title "Project" --org orgname
gh project create --title "Project" --readme "Description here"
gh project edit 123 --title "New Title"
gh project delete 123
gh project close 123
gh project copy 123 --owner target-owner --title "Copy"
gh project mark-template 123
```

### Fields

```bash
gh project field-list 123
gh project field-create 123 --title "Status" --datatype single_select
gh project field-delete 123 --id 456
```

### Items

```bash
gh project item-list 123
gh project item-create 123 --title "New item"
gh project item-add 123 --owner-owner --repo repo --issue 456
gh project item-edit 123 --id 456 --title "Updated title"
gh project item-delete 123 --id 456
gh project item-archive 123 --id 456
```

### Links

```bash
gh project link 123 --id 456 --link-id 789
gh project unlink 123 --id 456 --link-id 789
```

## Labels (gh label)

```bash
gh label list
gh label create bug --color "d73a4a" --description "Something isn't working"
gh label create enhancement --color "#a2eeef"
gh label edit bug --name "bug-report" --color "ff0000"
gh label delete bug
gh label clone owner/repo
gh label clone owner/repo --repo target/repo
```
