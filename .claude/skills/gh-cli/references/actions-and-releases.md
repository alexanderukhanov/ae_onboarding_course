# GitHub Actions & Releases

## Workflow Runs (gh run)

```bash
gh run list
gh run list --workflow "ci.yml"
gh run list --branch main
gh run list --limit 20
gh run list --json databaseId,status,conclusion,headBranch

gh run view 123456789
gh run view 123456789 --log
gh run view 123456789 --job 987654321
gh run view 123456789 --web

gh run watch 123456789
gh run watch 123456789 --interval 5

gh run rerun 123456789
gh run rerun 123456789 --job 987654321

gh run cancel 123456789
gh run delete 123456789

gh run download 123456789
gh run download 123456789 --name build
gh run download 123456789 --dir ./artifacts
```

## Workflows (gh workflow)

```bash
gh workflow list
gh workflow view ci.yml
gh workflow view ci.yml --yaml
gh workflow view ci.yml --web
gh workflow enable ci.yml
gh workflow disable ci.yml
gh workflow run ci.yml
gh workflow run ci.yml \
  --raw-field \
  version="1.0.0" \
  environment="production"
gh workflow run ci.yml --ref develop
```

## Action Caches (gh cache)

```bash
gh cache list
gh cache list --branch main
gh cache list --limit 50
gh cache delete 123456789
gh cache delete --all
```

## Action Secrets (gh secret)

```bash
gh secret list
gh secret set MY_SECRET
echo "$MY_SECRET" | gh secret set MY_SECRET
gh secret set MY_SECRET --env production
gh secret set MY_SECRET --org orgname
gh secret delete MY_SECRET
gh secret delete MY_SECRET --env production
```

## Action Variables (gh variable)

```bash
gh variable list
gh variable set MY_VAR "some-value"
gh variable set MY_VAR "value" --env production
gh variable set MY_VAR "value" --org orgname
gh variable get MY_VAR
gh variable delete MY_VAR
gh variable delete MY_VAR --env production
```

## Releases (gh release)

### List & View

```bash
gh release list
gh release view
gh release view v1.0.0
gh release view v1.0.0 --web
```

### Create

```bash
gh release create v1.0.0 --notes "Release notes here"
gh release create v1.0.0 --notes-file notes.md
gh release create v1.0.0 --target main
gh release create v1.0.0 --draft
gh release create v1.0.0 --prerelease
gh release create v1.0.0 --title "Version 1.0.0"
```

### Upload & Download

```bash
gh release upload v1.0.0 ./file.tar.gz
gh release upload v1.0.0 ./file1.tar.gz ./file2.tar.gz
gh release download v1.0.0
gh release download v1.0.0 --pattern "*.tar.gz"
gh release download v1.0.0 --dir ./downloads
gh release download v1.0.0 --archive zip
```

### Edit & Delete

```bash
gh release edit v1.0.0 --notes "Updated notes"
gh release delete v1.0.0
gh release delete v1.0.0 --yes
gh release delete-asset v1.0.0 file.tar.gz
```

### Verify

```bash
gh release verify v1.0.0
gh release verify-asset v1.0.0 file.tar.gz
```
