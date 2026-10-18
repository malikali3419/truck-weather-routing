#!/usr/bin/env bash
# Deploy the committed code to a Hugging Face Docker Space.
#
#   scripts/deploy-hf.sh https://huggingface.co/spaces/<user>/<space>
#
# Spaces read their settings from YAML front matter in README.md. We add it
# only to the copy pushed to the Space, so the GitHub README stays clean.
set -euo pipefail

SPACE_URL=${1:?"usage: scripts/deploy-hf.sh https://huggingface.co/spaces/<user>/<space>"}
SRC=$(git rev-parse --show-toplevel)
REV=$(git -C "$SRC" rev-parse --short HEAD)
NAME=$(git -C "$SRC" config user.name)
EMAIL=$(git -C "$SRC" config user.email)

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git -C "$SRC" archive HEAD | tar -x -C "$TMP"
cd "$TMP"

{
  printf -- '---\n'
  printf 'title: Weather-aware truck routing\n'
  printf 'emoji: 🚛\n'
  printf 'colorFrom: blue\n'
  printf 'colorTo: indigo\n'
  printf 'sdk: docker\n'
  printf 'app_port: 8000\n'
  printf 'pinned: false\n'
  printf -- '---\n\n'
  cat README.md
} > README.hf && mv README.hf README.md

git init -q -b main
git -c user.name="$NAME" -c user.email="$EMAIL" add -A
git -c user.name="$NAME" -c user.email="$EMAIL" commit -q -m "Deploy $REV"
# The Space only ever holds the latest deploy, so its history is replaced.
git push --force "$SPACE_URL" main
echo "Pushed $REV to $SPACE_URL — the Space is now building."
