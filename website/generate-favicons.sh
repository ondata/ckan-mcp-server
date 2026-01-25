#!/bin/bash

# Generate PNG favicons from SVG
# Requires: ImageMagick or sharp-cli

echo "Generating PNG favicons from SVG..."

if command -v convert &> /dev/null; then
    # Using ImageMagick
    echo "Using ImageMagick..."
    convert -background none public/favicon.svg -resize 32x32 public/favicon-32.png
    convert -background none public/favicon.svg -resize 180x180 public/favicon-180.png
    convert -background none public/favicon.svg -resize 192x192 public/favicon-192.png
    convert -background none public/favicon.svg -resize 512x512 public/favicon-512.png
    echo "✓ PNG favicons generated successfully"
elif command -v sharp &> /dev/null; then
    # Using sharp-cli
    echo "Using sharp-cli..."
    sharp -i public/favicon.svg -o public/favicon-32.png resize 32 32
    sharp -i public/favicon.svg -o public/favicon-180.png resize 180 180
    sharp -i public/favicon.svg -o public/favicon-192.png resize 192 192
    sharp -i public/favicon.svg -o public/favicon-512.png resize 512 512
    echo "✓ PNG favicons generated successfully"
else
    echo "❌ Error: Neither ImageMagick (convert) nor sharp-cli found"
    echo "Install one of:"
    echo "  - ImageMagick: apt-get install imagemagick (Linux) or brew install imagemagick (macOS)"
    echo "  - sharp-cli: npm install -g sharp-cli"
    exit 1
fi
