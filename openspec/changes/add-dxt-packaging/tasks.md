## 1. Manifest
- [x] 1.1 Install `@anthropic-ai/dxt` CLI globally (`npm install -g @anthropic-ai/dxt`)
- [x] 1.2 Create `manifest.json` at repo root using `dxt init` or hand-written
- [x] 1.3 Verify manifest passes `dxt validate`

## 2. Build script
- [x] 2.1 Add `pack:dxt` script to `package.json` that runs `npm run build && dxt pack`
- [x] 2.2 Test that `npm run pack:dxt` produces a valid `.dxt` file
- [x] 2.3 Add `.dxt` to `.gitignore`

## 3. Release integration
- [x] 3.1 Update release workflow documentation in `CLAUDE.md` to include `.dxt` upload step
- [x] 3.2 Document `gh release upload` command for attaching `.dxt` to GitHub releases

## 4. Documentation
- [x] 4.1 Add "One-click install" section to `README.md` (before manual install section)
- [x] 4.2 Update `LOG.md`
- [x] 4.3 Update `docs/DEPLOYMENT.md` (release checklist + complete workflow steps)
