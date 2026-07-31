import { NextRequest, NextResponse } from 'next/server'
import { captureServerException } from '@/lib/analytics/server'

const MAX_MESSAGE_LENGTH = 2_000
const MAX_STACK_LENGTH = 12_000

function limitedString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid_error' }, { status: 400 })
  }

  const input = body as { name?: unknown; message?: unknown; stack?: unknown }
  const message = limitedString(input.message, MAX_MESSAGE_LENGTH)
  if (!message) {
    return NextResponse.json({ error: 'invalid_error' }, { status: 400 })
  }

  const error = new Error(message)
  error.name = limitedString(input.name, 120) || 'Error'
  error.stack = limitedString(input.stack, MAX_STACK_LENGTH) || error.stack

  await captureServerException(error)
  return NextResponse.json({ ok: true })
}
