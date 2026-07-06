# Bootstrap

Standalone repo: **https://github.com/Kazispace/kazispace-test**

Org admin: create an empty public repo named `kazispace-test`, then push:

```bash
git clone -b cursor/kazispace-test-30c2 https://github.com/Kazispace/kazispace-ai.git kazispace-test-import
cd kazispace-test-import
git remote set-url origin https://github.com/Kazispace/kazispace-test.git
git push -u origin HEAD:main
```

Or with GitHub CLI (org admin):

```bash
gh repo create Kazispace/kazispace-test --public --description "KaziSpace Function, Stress, and Monkey tests"
```
