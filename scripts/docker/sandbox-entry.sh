#!/bin/bash

direnv allow

if [ ! -f ~/.local/share/opencode/auth.json ]; then
  opencode auth login
fi

if [ ! -f ~/.config/gh/hosts.yml ]; then
  gh auth login
fi

exec /bin/bash
