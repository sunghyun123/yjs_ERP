import { 추출JSONSchema, 추출지시 } from '@/app/(dashboard)/history-card/_lib/extract'

/** 상류(OpenAI) 실패. 단계명만 담는다 — 응답 원문·PDF 내용은 로그에 남기지 않는다. */
export class UpstreamError extends Error {
  constructor(public readonly 단계: string) {
    super(단계)
  }
}

type 옵션 = { apiKey: string; model: string; fetchImpl?: typeof fetch; timeoutMs?: number }

type ResponsesBody = {
  status?: string
  output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[]
}

/** 1쪽 PDF를 보내고, 구조화 출력 JSON을 파싱해 돌려준다. 스키마 검증은 호출한 쪽(zod)이 한다. */
export async function 통보서읽기(pdf1쪽: Uint8Array, opts: 옵션): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const body = {
    model: opts.model,
    store: false, // OpenAI 쪽에도 통보서 내용을 남기지 않는다
    input: [
      { role: 'system', content: 추출지시 },
      {
        role: 'user',
        content: [
          {
            type: 'input_file',
            filename: 'notice.pdf',
            file_data: `data:application/pdf;base64,${Buffer.from(pdf1쪽).toString('base64')}`,
          },
          { type: 'input_text', text: '이 시공통보서 1쪽에서 값을 읽어 주세요.' },
        ],
      },
    ],
    text: { format: { type: 'json_schema', name: 'construction_notice', schema: 추출JSONSchema, strict: true } },
  }

  // 50초: 운영 nginx의 proxy_read_timeout이 60초다(nginx/erp.yjsboard.com.conf).
  // 그보다 오래 기다리면 브라우저는 이미 nginx의 504 HTML을 받았는데 우리는 계속 기다리며 요금이 나가고,
  // 사용자가 다시 누르면 같은 통보서에 두 번 낸다. nginx보다 먼저 포기해야 우리 502 메시지가 화면에 닿는다.
  const timeoutMs = opts.timeoutMs ?? 50_000

  let res: Response
  try {
    res = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    throw new UpstreamError(e instanceof DOMException && e.name === 'TimeoutError' ? 'openai_timeout' : 'openai_network')
  }
  if (!res.ok) throw new UpstreamError(`openai_http_${res.status}`)

  let json: ResponsesBody
  try {
    json = (await res.json()) as ResponsesBody
  } catch {
    // JSON이 아닌 본문의 SyntaxError 메시지엔 본문 앞부분이 실린다 → 단계명만 남기고 버린다
    throw new UpstreamError('openai_body')
  }
  if (json.status === 'incomplete') throw new UpstreamError('openai_incomplete')

  const contents = (json.output ?? []).filter(o => o.type === 'message').flatMap(o => o.content ?? [])
  if (contents.some(c => c.type === 'refusal')) throw new UpstreamError('openai_refusal')
  const text = contents.filter(c => c.type === 'output_text').map(c => c.text ?? '').join('')

  try {
    return JSON.parse(text)
  } catch {
    throw new UpstreamError('openai_json')
  }
}
