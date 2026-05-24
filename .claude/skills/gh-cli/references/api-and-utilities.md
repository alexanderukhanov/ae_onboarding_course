# API Requests & Utilities

## API Requests (gh api)

```bash
gh api /user
gh api --method POST /repos/owner/repo/issues \
  --field title="Issue title" \
  --field body="Issue body"
gh api /user --header "Accept: application/vnd.github.v3+json"
gh api /user/repos --paginate
gh api /user --raw
gh api /user --include
gh api /user --silent
gh api --input request.json
gh api /user --jq '.login'
gh api /repos/owner/repo --jq '.stargazers_count'
gh api /user --hostname enterprise.internal

# GraphQL
gh api graphql \
  -f query='
  {
    viewer {
      login
      repositories(first: 5) {
        nodes {
          name
        }
      }
    }
  }'
```

## Gists (gh gist)

```bash
gh gist list
gh gist list --public
gh gist list --limit 20
gh gist view abc123
gh gist view abc123 --files
gh gist create script.py
gh gist create script.py --desc "My script"
gh gist create script.py --public
gh gist create file1.py file2.py
echo "print('hello')" | gh gist create
gh gist edit abc123
gh gist delete abc123
gh gist rename abc123 --filename old.py new.py
gh gist clone abc123
gh gist clone abc123 my-directory
```

## Codespaces (gh codespace)

```bash
gh codespace list
gh codespace create
gh codespace create --repo owner/repo
gh codespace create --branch develop
gh codespace create --machine premiumLinux
gh codespace view
gh codespace ssh
gh codespace ssh --command "cd /workspaces && ls"
gh codespace code
gh codespace code --codec
gh codespace code --path /workspaces/repo
gh codespace stop
gh codespace delete
gh codespace logs --tail 100
gh codespace ports
gh codespace cp 8080:8080
gh codespace rebuild
gh codespace edit --machine standardLinux
gh codespace jupyter
gh codespace cp file.txt :/workspaces/file.txt
gh codespace cp :/workspaces/file.txt ./file.txt
```

## Organizations (gh org)

```bash
gh org list
gh org list --user username
gh org list --json login,name,description
gh org view orgname
gh org view orgname --json members --jq '.members[] | .login'
```

## Search (gh search)

```bash
gh search code "TODO"
gh search code "TODO" --repo owner/repo
gh search commits "fix bug"
gh search issues "label:bug state:open"
gh search prs "is:open is:pr review:required"
gh search repos "stars:>1000 language:python"
gh search repos "topic:api" --limit 50
gh search repos "stars:>100" --json name,description,stargazers
gh search repos "language:rust" --order desc --sort stars
gh search code "import" --extension py
gh search prs "is:open" --web
```

## Extensions (gh extension)

```bash
gh extension list
gh extension search github
gh extension install owner/extension-repo
gh extension install owner/extension-repo --branch develop
gh extension upgrade extension-name
gh extension remove extension-name
gh extension create my-extension
gh extension browse
gh extension exec my-extension --arg value
```

## Aliases (gh alias)

```bash
gh alias list
gh alias set prview 'pr view --web'
gh alias set co 'pr checkout' --shell
gh alias delete prview
gh alias import ./aliases.sh
```

## Configuration (gh config)

```bash
gh config list
gh config get editor
gh config set editor vim
gh config set git_protocol ssh
gh config set prompt disabled
gh config set prompt enabled
gh config set pager "less -R"
gh config clear-cache
```

## SSH Keys (gh ssh-key)

```bash
gh ssh-key list
gh ssh-key add ~/.ssh/id_rsa.pub --title "My laptop"
gh ssh-key add ~/.ssh/id_ed25519.pub --type "authentication"
gh ssh-key delete 12345
gh ssh-key delete --title "My laptop"
```

## GPG Keys (gh gpg-key)

```bash
gh gpg-key list
gh gpg-key add ~/.ssh/id_rsa.pub
gh gpg-key delete 12345
gh gpg-key delete ABCD1234
```

## Status (gh status)

```bash
gh status
gh status --repo owner/repo
gh status --json
```

## Rulesets (gh ruleset)

```bash
gh ruleset list
gh ruleset view 123
gh ruleset check --branch feature
gh ruleset check --repo owner/repo --branch main
```

## Attestations (gh attestation)

```bash
gh attestation download owner/repo --artifact-id 123456
gh attestation verify owner/repo
gh attestation trusted-root
```

## Completion (gh completion)

```bash
gh completion -s bash > ~/.gh-complete.bash
gh completion -s zsh > ~/.gh-complete.zsh
gh completion -s fish > ~/.gh-complete.fish
gh completion -s powershell > ~/.gh-complete.ps1
gh completion --shell=bash
gh completion --shell=zsh
```

## Preview & Agent Tasks

```bash
gh preview
gh preview prompter
gh agent-task list
gh agent-task view 123
gh agent-task create --description "My task"
```
