#!/usr/bin/env node
/**
 * Pre-release gate: known-answer search queries against live portals.
 *
 * Every case asserts which dataset must come back, not how many. That distinction is
 * the reason this file exists: v0.4.122 shipped with counts verified and ranking
 * broken, because "22 results" and "the right dataset first" are different claims.
 *
 *   npm run smoke            all cases
 *   npm run smoke -- lecce   only cases whose name matches
 *
 * Exits non-zero on the first failed assertion, so it can gate a release.
 */

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT ?? 3099);
const FILTER = process.argv[2]?.toLowerCase();

const { cases } = JSON.parse(readFileSync(join(ROOT, "tests/smoke/cases.json"), "utf8"));
const selected = FILTER ? cases.filter((c) => c.name.toLowerCase().includes(FILTER)) : cases;
const domains = [...new Set(selected.map((c) => new URL(c.server).hostname))].join(",");

const server = spawn("node", [join(ROOT, "dist/index.js")], {
  env: { ...process.env, TRANSPORT: "http", PORT: String(PORT), CKAN_ALLOWED_DOMAINS: domains },
  stdio: ["ignore", "ignore", "ignore"]
});
const stop = () => server.kill();
process.on("exit", stop);
process.on("SIGINT", () => { stop(); process.exit(130); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);

async function call(tool, server_url, args) {
  const res = await fetch(`http://localhost:${PORT}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: tool, arguments: { server_url, ...args, response_format: "json" } },
      id: 1
    })
  });
  const body = await res.json();
  const text = body?.result?.content?.[0]?.text;
  if (!text) throw new Error(`no content: ${JSON.stringify(body).slice(0, 200)}`);
  const payload = JSON.parse(text);
  if (payload?._error) throw new Error(payload.error ?? "tool returned an error");
  return payload;
}

/** The count a tool reports, whichever shape it uses. */
const totalOf = (p) => p.total_results ?? p.count ?? p.total ?? null;
/** The title of the first result, whichever list the tool returns. */
const firstTitle = (p) => (p.results ?? p.datasets ?? [])[0]?.title ?? "";
/** How many rows a listing tool returned. */
const listLength = (p) =>
  (p.organizations ?? p.tags ?? p.groups ?? p.results ?? p.datasets ?? []).length;

function check(expect, payload) {
  const fail = [];
  const total = totalOf(payload);
  const effective = payload.effective_query ?? payload.query ?? "";

  if (expect.total_min !== undefined && !(total >= expect.total_min))
    fail.push(`expected at least ${expect.total_min} results, got ${total}`);
  if (expect.total_max !== undefined && !(total <= expect.total_max))
    fail.push(`expected at most ${expect.total_max} results, got ${total}`);
  if (expect.count_min !== undefined && !(listLength(payload) >= expect.count_min))
    fail.push(`expected at least ${expect.count_min} rows, got ${listLength(payload)}`);
  if (expect.first_matches && !new RegExp(expect.first_matches).test(firstTitle(payload)))
    fail.push(`first result "${firstTitle(payload).slice(0, 60)}" does not match /${expect.first_matches}/`);
  if (expect.wrapped && !effective.startsWith("text:("))
    fail.push(`expected the text:(...) wrapper, effective query was "${effective}"`);
  if (expect.not_wrapped && effective.startsWith("text:("))
    fail.push(`expected no wrapper, effective query was "${effective}"`);
  if (expect.effective_contains && !effective.includes(expect.effective_contains))
    fail.push(`effective query "${effective}" does not contain "${expect.effective_contains}"`);
  return fail;
}

let failed = 0;
for (const c of selected) {
  let fails;
  try {
    fails = check(c.expect, await call(c.tool, c.server, c.args));
  } catch (err) {
    fails = [`${err.message}`];
  }
  if (fails.length === 0) {
    console.log(`  ok    ${c.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${c.name}`);
    console.log(`        guards: ${c.regression}`);
    for (const f of fails) console.log(`        ${f}`);
  }
}

console.log(`\n${selected.length - failed}/${selected.length} passed`);
stop();
process.exit(failed === 0 ? 0 : 1);
