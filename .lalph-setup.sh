#!/bin/bash

git fetch origin
git checkout origin/main
direnv allow || true
pnpm install
git submodule update --init --recursive
