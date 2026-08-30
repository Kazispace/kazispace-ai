/**
 * KAZI-665 — shared file-resolution logic for the JS budget scripts
 * (check-clinic-js-budget.mjs / check-route-js-budgets.mjs). Both scripts
 * independently reimplemented `readJson`/`walkJs`/`fileSize` and the
 * build-manifest reading logic (KAZI-588 review on PR #209 flagged this as a
 * real risk: updating the candidate-path logic in one script but not the
 * other would make one of them silently measure the wrong thing).
 *
 * This module only extracts the *file-resolution* mechanics. Each script
 * keeps its own semantics for *which* files it's asking about: the Clinic
 * script scans every app-build-manifest page key matching a predicate and
 * unions their files (it has multiple first-load entry points); the route
 * script's page_key mode asks for exactly one key (a predicate that matches
 * only that key); its loadable_key mode is a different manifest entirely.
 * None of that per-caller semantics moved here — see `collectManifestFiles`'s
 * `matchPageKey` param.
 */
import fs from 'fs';
import path from 'path';

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function walkJs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, acc);
    else if (entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

/** A manifest-listed file may live under `.next/<rel>`, `.next/static/<rel>` (stripped of a leading `static/`), or the project root. */
export function fileSize(nextDir, root, rel) {
  const candidates = [
    path.join(nextDir, rel),
    path.join(nextDir, 'static', rel.replace(/^static\//, '')),
    path.join(root, rel),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.statSync(candidate).size;
  }
  return 0;
}

/**
 * Shared first-load files (build-manifest.json's polyfill/lowPriority/
 * rootMain lists) unioned with every app-build-manifest.json page entry
 * whose key satisfies `matchPageKey`. Pass `(key) => key === pageKey` for an
 * exact single-page match, or a broader predicate to union several entry
 * points (e.g. Clinic's multiple first-load routes).
 */
export function collectManifestFiles(nextDir, matchPageKey) {
  const files = new Set();
  const buildManifest = path.join(nextDir, 'build-manifest.json');
  const appBuildManifest = path.join(nextDir, 'app-build-manifest.json');

  if (fs.existsSync(buildManifest)) {
    const manifest = readJson(buildManifest);
    for (const key of ['polyfillFiles', 'lowPriorityFiles', 'rootMainFiles']) {
      for (const file of manifest[key] ?? []) files.add(file);
    }
  }

  if (fs.existsSync(appBuildManifest)) {
    const manifest = readJson(appBuildManifest);
    for (const [pageKey, pageFiles] of Object.entries(manifest.pages ?? {})) {
      if (!matchPageKey(pageKey) || !Array.isArray(pageFiles)) continue;
      for (const file of pageFiles) files.add(file);
    }
  }

  return [...files].filter((file) => file.endsWith('.js'));
}

/**
 * Files behind a single `next/dynamic()` chunk, keyed by its source location
 * in react-loadable-manifest.json. Fails loud on a missing entry rather than
 * falling back to "measure everything" — a missing entry means the dynamic
 * import this budget targets was renamed/moved/removed and the config is
 * stale, not that its bundle shrank to zero.
 */
export function collectLoadableFiles(nextDir, loadableKey) {
  const loadableManifestPath = path.join(nextDir, 'react-loadable-manifest.json');
  if (!fs.existsSync(loadableManifestPath)) {
    throw new Error('react-loadable-manifest.json missing — run next build first.');
  }
  const manifest = readJson(loadableManifestPath);
  const entry = manifest[loadableKey];
  if (!entry || !Array.isArray(entry.files)) {
    throw new Error(
      `react-loadable-manifest.json has no entry "${loadableKey}" — update route-js-budgets.json to the current dynamic import's source path.`
    );
  }
  return entry.files.filter((file) => file.endsWith('.js'));
}

/** Sum sizes for a list of manifest-relative file paths; keeps per-file rows for the over-budget report. */
export function measureFiles(nextDir, root, relFiles) {
  let total = 0;
  const measured = [];
  for (const rel of relFiles) {
    const size = fileSize(nextDir, root, rel);
    if (size > 0) {
      total += size;
      measured.push({ rel, size });
    }
  }
  return { total, measured };
}

/** Fallback when manifest resolution finds nothing: walk every static chunk under .next/static. */
export function measureAllStaticChunks(nextDir) {
  let total = 0;
  const measured = [];
  for (const file of walkJs(path.join(nextDir, 'static'))) {
    const size = fs.statSync(file).size;
    total += size;
    measured.push({ rel: path.relative(nextDir, file), size });
  }
  return { total, measured };
}
