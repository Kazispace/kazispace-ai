# Repository bootstrap

The Cloud Agent token cannot create new repositories under the `Kazispace` org. Use one of the options below.

## Option A — Org admin creates empty repo (recommended)

1. Create **public** repo: `https://github.com/Kazispace/kazi-test`
2. From this branch (root = kazi-test contents):

```bash
git clone -b cursor/kazi-test-repo-30c2 https://github.com/Kazispace/kazispace-ai.git kazi-test-import
cd kazi-test-import
git remote set-url origin https://github.com/Kazispace/kazi-test.git
git push -u origin cursor/kazi-test-repo-30c2:main
```

## Option B — GitHub CLI (org admin)

```bash
gh repo create Kazispace/kazi-test --public --description "KaziSpace test suite"
cd kazi-test   # this repo root
git remote add origin https://github.com/Kazispace/kazi-test.git
git push -u origin main
```

## Option C — Keep on kazispace-ai branch

Use branch `cursor/kazi-test-repo-30c2` as the canonical source until the standalone repo exists.
