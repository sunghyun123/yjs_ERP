/**
 * Supabase DB 일일 백업.
 * supabase db dump → gzip → manifest → Supabase Storage 업로드 → 보관주기 정리.
 *
 * 실행: npm run backup:db
 *
 * 필요한 환경변수 (.env.production 우선, 없으면 .env.local 로 폴백):
 *   SUPABASE_DB_URL            postgres 연결 문자열 (supabase db dump 용)
 *   NEXT_PUBLIC_SUPABASE_URL   Storage 업로드 용
 *   SUPABASE_SERVICE_ROLE_KEY  Storage 업로드 용 (비공개 버킷 접근)
 *
 * 전제: VPS/로컬에 supabase CLI가 설치되어 PATH에 있어야 한다.
 */
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import zlib from 'zlib'
import crypto from 'crypto'
import { execFileSync } from 'child_process'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'
import { selectForRetention } from '../src/lib/backup/storage-retention'

// Node 20엔 전역 WebSocket이 없다(Node 22+부터 내장). supabase-js의 SupabaseClient 생성자는
// realtime을 안 써도 RealtimeClient를 만들며 WebSocket 생성자를 요구해 createClient가 throw한다.
// realtime-js가 globalThis.WebSocket을 먼저 탐지하므로(websocket-factory) ws를 전역 주입해 회피한다.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  ;(globalThis as { WebSocket?: unknown }).WebSocket = ws
}

const ROOT = path.resolve(__dirname, '..')
// .env.production 먼저 로드(운영). 이미 설정된 값은 .env.local 로드 시 덮어쓰지 않음(로컬 테스트 폴백).
dotenv.config({ path: path.resolve(ROOT, '.env.production') })
dotenv.config({ path: path.resolve(ROOT, '.env.local') })

const BUCKET = 'db-backups'
const RETENTION = { dailyDays: 7, weeklyCount: 4 }
const PRIVATE_DIR = path.join(ROOT, 'backups', 'private')

const DB_URL = process.env.SUPABASE_DB_URL
// NEXT_PUBLIC_ 접두사가 맞다 — 프로젝트 URL은 비밀이 아니며(브라우저에도 노출됨)
// 코드베이스에 정의된 유일한 Supabase URL 변수다. SUPABASE_URL 로 바꾸지 말 것.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function pad(x: number): string {
  return String(x).padStart(2, '0')
}

function stamp(): { id: string; base: string; gzName: string } {
  const n = new Date()
  const date = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
  const time = `${pad(n.getHours())}${pad(n.getMinutes())}${pad(n.getSeconds())}`
  const base = `${date}-${time}`
  return { id: `${base}-db-backup`, base, gzName: `${base}-db.sql.gz` }
}

function nowStamp(): string {
  const n = new Date()
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`
}

function logLine(line: string): void {
  fs.mkdirSync(PRIVATE_DIR, { recursive: true })
  fs.appendFileSync(path.join(PRIVATE_DIR, 'db-backup.log'), line + '\n', 'utf8')
}

function cleanupDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // 정리 실패는 무시 — 백업 실패가 이미 비0 종료로 보고됨
  }
}

function pruneLocal(): void {
  if (!fs.existsSync(PRIVATE_DIR)) return
  const dirs = fs
    .readdirSync(PRIVATE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.endsWith('-db-backup'))
  const fileToDir = new Map<string, string>()
  for (const d of dirs) {
    const gz = `${d.name.replace(/-db-backup$/, '')}-db.sql.gz`
    fileToDir.set(gz, path.join(PRIVATE_DIR, d.name))
  }
  const { delete: toDelete } = selectForRetention([...fileToDir.keys()], new Date(), RETENTION)
  for (const f of toDelete) {
    const dir = fileToDir.get(f)
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  }
}

async function pruneStorage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 })
  if (error) {
    console.warn('⚠️ Storage 목록 조회 실패, 정리 건너뜀:', error.message)
    return
  }
  const names = (data ?? []).map((o) => o.name)
  const { delete: toDelete } = selectForRetention(names, new Date(), RETENTION)
  if (toDelete.length > 0) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(toDelete)
    if (rmErr) console.warn('⚠️ Storage 정리 실패:', rmErr.message)
  }
}

async function main(): Promise<void> {
  const started = Date.now()

  if (!DB_URL) {
    console.error('❌ SUPABASE_DB_URL 가 .env.production(또는 .env.local)에 필요합니다.')
    process.exit(1)
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
    process.exit(1)
  }

  const { id, base, gzName } = stamp()
  const dir = path.join(PRIVATE_DIR, id)
  fs.mkdirSync(dir, { recursive: true })
  const sqlPath = path.join(dir, `${base}-db.sql`)
  const gzPath = path.join(dir, gzName)

  // 1. dump
  try {
    execFileSync('supabase', ['db', 'dump', '--db-url', DB_URL, '-f', sqlPath], {
      stdio: 'inherit',
    })
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      console.error(
        '❌ supabase CLI를 찾을 수 없습니다. 설치: npm i -g supabase  (문서: https://supabase.com/docs/guides/cli)',
      )
    } else {
      // err.message 에는 전체 명령줄(= SUPABASE_DB_URL 비밀번호)이 포함되므로 출력 금지.
      console.error('❌ supabase db dump 실패 (exit code:', err.errno ?? (err as { status?: number }).status ?? 'unknown', ')')
    }
    logLine(`[${nowStamp()}] FAIL | ${gzName} | dump-error | - | ${Date.now() - started}ms | upload:N`)
    cleanupDir(dir)
    process.exit(1)
  }

  // 2. dump 검증
  const sqlStat = fs.statSync(sqlPath)
  if (sqlStat.size === 0) {
    console.error('❌ dump 결과가 0바이트입니다.')
    logLine(`[${nowStamp()}] FAIL | ${gzName} | empty-dump | 0 | ${Date.now() - started}ms | upload:N`)
    cleanupDir(dir)
    process.exit(1)
  }

  // 3. gzip + 체크섬 (소규모 DB이므로 동기 압축으로 충분)
  const gz = zlib.gzipSync(fs.readFileSync(sqlPath))
  fs.writeFileSync(gzPath, gz)
  fs.unlinkSync(sqlPath) // 압축본만 보관
  const sha = crypto.createHash('sha256').update(gz).digest('hex')

  // 4. manifest
  const manifest = {
    backupId: id,
    file: gzName,
    generatedAt: new Date().toISOString(),
    dumpCommand: 'supabase db dump --db-url *** -f <sql>',
    rawSqlBytes: sqlStat.size,
    gzBytes: gz.length,
    sha256: sha,
    retention: RETENTION,
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  // 5. Storage 업로드 (실패 시 로컬 보존 + 정리 생략 + 비0 종료)
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(gzName, gz, {
    contentType: 'application/gzip',
    upsert: true,
  })
  if (upErr) {
    console.error('❌ Storage 업로드 실패 (로컬 백업은 보존됨):', upErr.message)
    logLine(`[${nowStamp()}] FAIL | ${gzName} | ${gz.length} | ${sha.slice(0, 12)} | ${Date.now() - started}ms | upload:N`)
    process.exit(1)
  }

  // 6. 정리 — 업로드 성공 후에만
  pruneLocal()
  await pruneStorage(supabase)

  // 7. LATEST + 로그
  fs.writeFileSync(
    path.join(PRIVATE_DIR, 'LATEST_DB_BACKUP.txt'),
    [
      `backupId=${id}`,
      `file=${gzName}`,
      `path=${gzPath}`,
      `sha256=${sha}`,
      `generatedAt=${new Date().toISOString()}`,
      '',
    ].join('\n'),
    'utf8',
  )
  logLine(`[${nowStamp()}] OK | ${gzName} | ${gz.length} | ${sha.slice(0, 12)} | ${Date.now() - started}ms | upload:Y`)
  console.log(`✅ DB 백업 완료: ${gzName} (${gz.length} bytes) — Storage 업로드 + 보관주기 정리 완료`)
}

main().catch((e) => {
  console.error('❌ 백업 실패:', e)
  process.exit(1)
})
