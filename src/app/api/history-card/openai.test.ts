import { describe, expect, it, vi } from 'vitest'
import { 통보서읽기, UpstreamError } from './openai'

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
const 옵션 = (fetchImpl: typeof fetch) => ({ apiKey: 'sk-test', model: 'test-model', fetchImpl })

function 응답(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
}

const 성공본문 = {
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text: '{"a":1}' }] }],
}

describe('통보서읽기', () => {
  it('요청: Responses API, PDF는 base64 data URL, strict 스키마, store false, 키는 Authorization 헤더', async () => {
    const f = 응답(성공본문)
    await 통보서읽기(pdf, 옵션(f))
    const [url, init] = vi.mocked(f).mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ]
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(init.headers.Authorization).toBe('Bearer sk-test')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('test-model')
    expect(body.store).toBe(false)
    expect(body.text.format.type).toBe('json_schema')
    expect(body.text.format.strict).toBe(true)
    expect(body.text.format.name).toMatch(/^[a-zA-Z0-9_-]+$/)
    const file = body.input[1].content[0]
    expect(file.type).toBe('input_file')
    expect(file.file_data).toBe('data:application/pdf;base64,JVBERi0=')
  })

  it('output_text를 JSON으로 파싱해 돌려준다', async () => {
    expect(await 통보서읽기(pdf, 옵션(응답(성공본문)))).toEqual({ a: 1 })
  })

  it('HTTP 오류는 UpstreamError (단계명에 상태코드)', async () => {
    await expect(통보서읽기(pdf, 옵션(응답({ error: {} }, 429)))).rejects.toMatchObject({ 단계: 'openai_http_429' })
  })

  it('거절(refusal)은 UpstreamError', async () => {
    const f = 응답({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] })
    await expect(통보서읽기(pdf, 옵션(f))).rejects.toMatchObject({ 단계: 'openai_refusal' })
  })

  it('미완료(incomplete)는 UpstreamError', async () => {
    await expect(통보서읽기(pdf, 옵션(응답({ status: 'incomplete', output: [] })))).rejects.toMatchObject({ 단계: 'openai_incomplete' })
  })

  it('JSON이 아닌 출력은 UpstreamError', async () => {
    const f = 응답({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json' }] }] })
    await expect(통보서읽기(pdf, 옵션(f))).rejects.toMatchObject({ 단계: 'openai_json' })
  })

  it('네트워크 실패·시간 초과는 UpstreamError', async () => {
    const f = vi.fn(async () => { throw new DOMException('timeout', 'TimeoutError') }) as unknown as typeof fetch
    await expect(통보서읽기(pdf, 옵션(f))).rejects.toBeInstanceOf(UpstreamError)
  })
})
