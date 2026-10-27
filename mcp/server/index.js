import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  CONSTRUCTIONS_DESCRIPTION,
  PROFIT_DESCRIPTION,
  RelayError,
  fetchJson,
  parseApiKey,
  parseServerUrl,
  toText,
} from "./relay.js";

const server = new McpServer({ name: "yj-erp", version: "0.1.0" });

const 연도 = z.union([z.literal("current"), z.number().int().min(2000).max(2100)]);
const 월 = z.union([z.literal("current"), z.number().int().min(1).max(12)]);

async function 조회(도구, path, params) {
  try {
    // 설정은 호출마다 읽는다. 주소·키를 잘못 넣어도 서버 기동은 되고, 실패 이유가 대화에 그대로 보이게.
    const base = parseServerUrl(process.env.YJ_ERP_URL);
    const apiKey = parseApiKey(process.env.YJ_ERP_API_KEY);
    const result = await fetchJson(base, path, params, apiKey);
    return { content: [{ type: "text", text: toText(result) }] };
  } catch (error) {
    const text = error instanceof RelayError ? error.message : "ERP 조회에 실패했습니다.";
    // stdout은 MCP 통신 전용이라 진단은 stderr로만 남긴다(키·금액은 남기지 않는다).
    console.error(`[yj-erp] ${도구} 실패: ${error?.name ?? "Error"}`);
    return { isError: true, content: [{ type: "text", text }] };
  }
}

server.registerTool(
  "get_constructions",
  {
    title: "공사 목록 (준공 여부)",
    description: CONSTRUCTIONS_DESCRIPTION,
    inputSchema: {
      completed_year: 연도.optional().describe("준공 연도. 'current'=올해. 안 주면 전체 공사"),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  ({ completed_year }) => 조회("get_constructions", "/api/mcp/constructions", { completed_year }),
);

server.registerTool(
  "get_profit",
  {
    title: "공사별 손익",
    description: PROFIT_DESCRIPTION,
    inputSchema: {
      year: 연도.optional().describe("연도. 'current'=올해(기본)"),
      month: 월.optional().describe("월. 'current'=이번 달. 안 주면 연간"),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  ({ year, month }) => 조회("get_profit", "/api/mcp/profit", { year, month }),
);

await server.connect(new StdioServerTransport());
