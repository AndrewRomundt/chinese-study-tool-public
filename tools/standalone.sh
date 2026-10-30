#!/bin/sh
# Builds dist/: the app as its own website (used by Cloudflare Pages), so it can open full-screen from the iPad home screen.
# app/index.html is written as a claude.ai Artifact page body, so wrap it in a full document with the home-screen tags.
# Outside claude.ai there is no Artifact storage, so progress is saved on the device only.
set -e
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
cp app/words.json app/strokes.json app/lessons.json app/manifest.webmanifest app/icon-180.png app/icon-512.png dist/
cp -r app/exercises dist/
{
  printf '%s\n' '<!doctype html><html lang="en"><head><meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' \
    '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">' \
    '<meta name="apple-mobile-web-app-title" content="Zìtiè"><meta name="apple-mobile-web-app-status-bar-style" content="default">' \
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f3f6f4"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#111a1c">' \
    '<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon-180.png">' \
    '</head><body>'
  cat app/index.html
  printf '%s\n' '</body></html>'
} > dist/index.html
echo "built dist/"
