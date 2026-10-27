import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RelayError,
  buildUrl,
  fetchJson,
  parseApiKey,
  parseServerUrl,
  toText,
} from "../server/relay.js";

test("server url must be https except local test server", () => {
  assert.equal(parseServerUrl("https://erp.example.test/").href, "https://erp.example.test/");
  assert.equal(parseServerUrl("http://localhost:3000").origin, "http://localhost:3000");
  assert.throws(() => parseServerUrl("http://erp.example.test"), RelayError);
  assert.throws(() => parseServerUrl(""), RelayError);
});

test("api key must be present", () => {
  assert.equal(parseApiKey("  abc  "), "abc");
  assert.throws(() => parseApiKey(""), /키가 설정되지 않았습니다/);
  assert.throws(() => parseApiKey(undefined), RelayError);
});

test("url keeps base path, drops empty params", () => {
  const base = parseServerUrl("https://erp.example.test/?x=1");
  assert.equal(
    buildUrl(base, "/api/mcp/profit", { year: "current", month: undefined }).href,
    "https://erp.example.test/api/mcp/profit?year=current",
  );
  assert.equal(
    buildUrl(base, "/api/mcp/profit", { year: 2025, month: 3 }).href,
    "https://erp.example.test/api/mcp/profit?year=2025&month=3",
  );
  assert.equal(buildUrl(base, "/api/mcp/constructions", {}).href, "https://erp.example.test/api/mcp/constructions");
});

test("fetch sends bearer, refuses redirects, returns parsed json", async () => {
  let seen;
  const ok = (url, options) => {
    seen = { url: String(url), options };
    return Promise.resolve(Response.json({ 건수: 3 }));
  };
  const base = parseServerUrl("https://erp.example.test");
  const result = await fetchJson(base, "/api/mcp/constructions", {}, "k", { fetchImpl: ok });
  assert.deepEqual(result, { 건수: 3 });
  assert.equal(seen.options.headers.Authorization, "Bearer k");
  // 리다이렉트를 따라가면 키가 다른 서버로 실려 간다
  assert.equal(seen.options.redirect, "error");
});

test("http failures are described by status, with the server's message", async () => {
  const base = parseServerUrl("https://erp.example.test");
  const reply = (status, body) => () => Promise.resolve(Response.json(body, { status }));

  await assert.rejects(
    fetchJson(base, "/p", {}, "k", { fetchImpl: reply(401, { error: "Unauthorized" }) }),
    /키를 거절했습니다\(401\)/,
  );
  await assert.rejects(
    fetchJson(base, "/p", {}, "k", { fetchImpl: reply(400, { error: "month는 1~12" }) }),
    /잘못되었습니다\(400\).*month는 1~12/,
  );
  await assert.rejects(
    fetchJson(base, "/p", {}, "k", { fetchImpl: reply(500, { error: "투입실적 조회 실패" }) }),
    /오류가 났습니다\(500\).*투입실적 조회 실패/,
  );
  await assert.rejects(
    fetchJson(base, "/p", {}, "k", { fetchImpl: reply(404, {}) }),
    /배포되지 않았습니다\(404\)/,
  );
});

test("network failure and timeout become relay errors", async () => {
  const base = parseServerUrl("https://erp.example.test");
  const offline = () => Promise.reject(new TypeError("fetch failed"));
  await assert.rejects(fetchJson(base, "/p", {}, "k", { fetchImpl: offline }), /연결하지 못했습니다/);
  const slow = () => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" }));
  await assert.rejects(fetchJson(base, "/p", {}, "k", { fetchImpl: slow }), /시간 안에 끝나지 않았습니다/);
});

test("oversized responses fail loudly instead of being cut", () => {
  const result = { 공사: Array.from({ length: 50 }, (_, i) => ({ 지중no: `A${i}` })) };
  assert.deepEqual(JSON.parse(toText(result)), result);
  assert.throws(() => toText(result, { maxChars: 100 }), /응답이 너무 큽니다/);
});
