#!/bin/bash

npm install -g lalph@latest @anthropic-ai/claude-code@latest opencode-ai@latest

if [ ! -f ~/.local/share/opencode/auth.json ]; then
  opencode auth login
fi

if [ ! -f ~/.config/gh/hosts.yml ]; then
  gh auth login
fi

git config --global user.name "$GIT_AUTHOR_NAME"
git config --global user.email "$GIT_AUTHOR_EMAIL"
gh auth setup-git

corepack enable
corepack install

exec /bin/bash
