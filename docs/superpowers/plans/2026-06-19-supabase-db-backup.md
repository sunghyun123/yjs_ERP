# Supabase DB 백업 자동화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 라이브 Supabase DB를 매일 자동으로 `supabase db dump`하여 VPS 로컬 + Supabase Storage에 이중 보관하고, 보관주기(일7/주4)를 적용하며, 검증된 복원 런북을 제공한다.

**Architecture:** 순수 TS 스크립트(`scripts/backup-db.ts`, `npm run backup:db`)가 dump→gzip→manifest→Storage 업로드→정리를 오케스트레이션한다. 보관주기 판정은 외부 의존 없는 순수 함수(`src/lib/backup/storage-retention.ts`)로 분리해 로컬·Storage 양쪽에 동일 적용하고 vitest로 단위 테스트한다. VPS cron이 매일 호출한다.

**Tech Stack:** Node.js (ts-node, CommonJS), `@supabase/supabase-js`, `supabase` CLI, zlib(gzip), vitest, dotenv

**스펙:** `docs/superpowers/specs/2026-06-19-supabase-db-backup-design.md`

---

## File Structure

- Create: `src/lib/backup/storage-retention.ts` — 보관주기 판정 순수 함수
- Create: `src/lib/backup/storage-retention.test.ts` — vitest 단위 테스트 (기존 `src/**/*.test.ts` glob이 자동 인식)
- Create: `scripts/backup-db.ts` — 백업 오케스트레이터
- Create: `supabase/storage-db-backups.sql` — `db-backups` 비공개 버킷 생성
- Create: `deploy/backup-db.cron.example` — VPS crontab 예시
- Create: `docs/runbook-db-restore.md` — 복원 런북
- Modify: `package.json` — `backup:db` 스크립트 추가
- Modify: `.env.production.example` — `SUPABASE_DB_URL` 항목 추가
- Modify: `docs/backup-inventory.md` — DB 백업 절차 한 단락 추가

**설정 변경 불필요:** `scripts/tsconfig.json`(`include: ["*.ts"]`)은 `scripts/backup-db.ts`를 포함하고, `vitest.config.ts`(`src/**/*.test.ts`)는 retention 테스트를 자동 인식한다. 기존 `sync-whitelist.ts` → `../src/lib/whitelist-sync` import 패턴과 동일하므로 추가 설정이 없다.

---

## Task 1: 보관주기 판정 순수 함수 (TDD)

**Files:**
- Create: `src/lib/backup/storage-retention.ts`
- Test: `src/lib/backup/storage-retention.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/backup/storage-retention.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { selectForRetention } from './storage-retention'

const POLICY = { dailyDays: 7, weeklyCount: 4 }
const f = (d: string) => `${d}-030000-db.sql.gz`

describe('selectForRetention', () => {
  // 기준일 2026-06-19은 금요일. 2026-06-07/05-31/05-24/05-17/05-10은 모두 일요일.
  it('일별 보관 윈도우(7일) 안의 파일은 전부 보관한다', () => {
    const now = new Date(2026, 5, 19)
    const names = ['2026-06-19', '2026-06-18', '2026-06-15', '2026-06-13'].map(f)
    const { keep, delete: del } = selectForRetention(names, now, POLICY)
    expect(del).toEqual([])
    expect(keep).toHaveLength(4)
  })

  it('일별 윈도우 밖의 일요일 파일은 주간 백업으로 보관한다', () => {
    const now = new Date(2026, 5, 19)
    const sunday = f('2026-06-07') // 12일 전, 일요일
    const { keep } = selectForRetention([sunday], now, POLICY)
    expect(keep).toContain(sunday)
  })

  it('일별 윈도우 밖의 비(非)일요일 파일은 삭제한다', () => {
    const now = new Date(2026, 5, 19)
    const monday = f('2026-06-08') // 11일 전, 월요일
    const { delete: del } = selectForRetention([monday], now, POLICY)
    expect(del).toContain(monday)
  })

  it('주간(일요일) 백업은 최신 N개만 보관한다', () => {
    const now = new Date(2026, 5, 19)
    const sundays = ['2026-06-07', '2026-05-31', '2026-05-24', '2026-05-17', '2026-05-10'].map(f)
    const { keep, delete: del } = selectForRetention(sundays, now, POLICY)
    expect(keep).toEqual(sundays.slice(0, 4))
    expect(del).toEqual([sundays[4]])
  })

  it('파싱 불가한 파일명은 절대 삭제하지 않는다', () => {
    const now = new Date(2026, 5, 19)
    const names = ['README.md', 'random.txt']
    const { keep, delete: del } = selectForRetention(names, now, POLICY)
    expect(del).toEqual([])
    expect(keep).toEqual(names)
  })

  it('빈 입력은 빈 결과를 반환한다', () => {
    expect(selectForRetention([], new Date(), POLICY)).toEqual({ keep: [], delete: [] })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/backup/storage-retention.test.ts`
Expected: FAIL — `Failed to resolve import "./storage-retention"` (파일 없음)

- [ ] **Step 3: 최소 구현 작성**

`src/lib/backup/storage-retention.ts`:

```ts
/**
 * 백업 파일명 목록을 보관(keep) / 삭제(delete)로 분류하는 순수 함수.
 * 로컬 디스크와 Supabase Storage 양쪽에 동일하게 적용한다.
 *
 * 파일명 규칙: YYYY-MM-DD-HHMMSS-db.sql.gz
 * 규칙: 최근 dailyDays일 내 전부 보관 → 그보다 오래된 것 중 일요일자 최신
 *       weeklyCount개 보관 → 나머지 삭제. 파싱 불가 파일은 절대 삭제하지 않는다.
 */
export type RetentionPolicy = { dailyDays: number; weeklyCount: number }
export type RetentionResult = { keep: string[]; delete: string[] }

const FILE_RE = /^(\d{4})-(\d{2})-(\d{2})-(\d{6})-db\.sql\.gz$/

function parseDate(name: string): Date | null {
  const m = FILE_RE.exec(name)
  if (!m) return null
  const [, y, mo, d] = m
  return new Date(Number(y), Number(mo) - 1, Number(d))
}

function dayDiff(now: Date, then: Date): number {
  const MS = 86_400_000
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const b = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()
  return Math.round((a - b) / MS)
}

export function selectForRetention(
  fileNames: string[],
  now: Date,
  policy: RetentionPolicy,
): RetentionResult {
  const keep: string[] = []
  const del: string[] = []
  const weeklyCandidates: { name: string; date: Date }[] = []

  for (const name of fileNames) {
    const date = parseDate(name)
    if (!date) {
      keep.push(name) // 알 수 없는 파일은 보존
      continue
    }
    const diff = dayDiff(now, date)
    if (diff < policy.dailyDays) {
      keep.push(name) // 최근 N일(미래 날짜 포함) 일별 전부 보관
    } else if (date.getDay() === 0) {
      weeklyCandidates.push({ name, date }) // 일요일자만 주간 후보
    } else {
      del.push(name)
    }
  }

  weeklyCandidates.sort((a, b) => b.date.getTime() - a.date.getTime())
  weeklyCandidates.forEach((c, i) => {
    if (i < policy.weeklyCount) keep.push(c.name)
    else del.push(c.name)
  })

  return { keep, delete: del }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/backup/storage-retention.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: 커밋**

```bash
git add src/lib/backup/storage-retention.ts src/lib/backup/storage-retention.test.ts
git commit -m "feat: 백업 보관주기 판정 순수 함수 + 단위 테스트"
```

---

## Task 2: Storage 버킷 생성 SQL

**Files:**
- Create: `supabase/storage-db-backups.sql`

- [ ] **Step 1: SQL 파일 작성**

`supabase/storage-db-backups.sql`:

```sql
-- DB 백업 보관용 비공개 Storage 버킷.
-- 적용: Supabase 대시보드 SQL Editor에서 이 파일 전체를 1회 실행.
--
-- public=false 로 공개 URL 노출을 차단한다. 업로드/삭제/조회는 service-role 키로만
-- 수행하므로(서버 측 스크립트 전용) 별도 RLS 정책은 필요하지 않다.

insert into storage.buckets (id, name, public)
values ('db-backups', 'db-backups', false)
on conflict (id) do nothing;
```

- [ ] **Step 2: 커밋**

```bash
git add supabase/storage-db-backups.sql
git commit -m "feat: db-backups 비공개 Storage 버킷 생성 SQL"
```

> **운영 적용 메모(코드 아님):** 구현 후 Supabase 대시보드 SQL Editor에서 이 파일을 1회 실행해야 업로드가 동작한다. 실행 전에는 Task 4 업로드 단계가 "Bucket not found"로 실패한다.

---

## Task 3: 백업 오케스트레이터 스크립트

**Files:**
- Create: `scripts/backup-db.ts`
- Modify: `package.json` (scripts 블록)
- Modify: `.env.production.example`

- [ ] **Step 1: `scripts/backup-db.ts` 작성**

```ts
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
import { createClient } from '@supabase/supabase-js'
import { selectForRetention } from '../src/lib/backup/storage-retention'

const ROOT = path.resolve(__dirname, '..')
// .env.production 먼저 로드(운영). 이미 설정된 값은 .env.local 로드 시 덮어쓰지 않음(로컬 테스트 폴백).
dotenv.config({ path: path.resolve(ROOT, '.env.production') })
dotenv.config({ path: path.resolve(ROOT, '.env.local') })

const BUCKET = 'db-backups'
const RETENTION = { dailyDays: 7, weeklyCount: 4 }
const PRIVATE_DIR = path.join(ROOT, 'backups', 'private')

const DB_URL = process.env.SUPABASE_DB_URL
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
  supabase: ReturnType<typeof createClient>,
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
      console.error('❌ supabase db dump 실패:', err.message)
    }
    logLine(`[${nowStamp()}] FAIL | ${gzName} | dump-error | - | ${Date.now() - started}ms | upload:N`)
    process.exit(1)
  }

  // 2. dump 검증
  const sqlStat = fs.statSync(sqlPath)
  if (sqlStat.size === 0) {
    console.error('❌ dump 결과가 0바이트입니다.')
    logLine(`[${nowStamp()}] FAIL | ${gzName} | empty-dump | 0 | ${Date.now() - started}ms | upload:N`)
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
```

- [ ] **Step 2: `package.json`에 스크립트 추가**

`scripts` 블록의 `"backup:portfolio"` 줄 바로 다음에 추가:

```json
    "backup:db": "ts-node --project scripts/tsconfig.json scripts/backup-db.ts",
```

- [ ] **Step 3: `.env.production.example`에 DB URL 항목 추가**

`# ── Supabase ──` 섹션의 `SUPABASE_SERVICE_ROLE_KEY` 줄 다음에 추가:

```bash

# DB 백업용 Postgres 연결 문자열 (supabase db dump 전용, 서버에서만 사용)
# Supabase 대시보드 → Settings → Database → Connection string (URI) 에서 확인
# 예: postgresql://postgres:[PASSWORD]@db.YOUR_PROJECT_ID.supabase.co:5432/postgres
SUPABASE_DB_URL=postgresql://postgres:your_db_password@db.YOUR_PROJECT_ID.supabase.co:5432/postgres
```

- [ ] **Step 4: 컴파일/타입 확인**

Run: `npx tsc --noEmit -p scripts/tsconfig.json`
Expected: 에러 없이 종료(타입 통과). 만약 `@supabase/supabase-js` Storage 타입 관련 경고가 나오면 import/시그니처를 위 코드와 대조.

- [ ] **Step 5: 커밋**

```bash
git add scripts/backup-db.ts package.json .env.production.example
git commit -m "feat: Supabase DB 백업 스크립트(backup:db) + env 항목"
```

---

## Task 4: cron 예시 + 복원 런북 + 인벤토리 갱신

**Files:**
- Create: `deploy/backup-db.cron.example`
- Create: `docs/runbook-db-restore.md`
- Modify: `docs/backup-inventory.md`

- [ ] **Step 1: cron 예시 작성**

`deploy/backup-db.cron.example`:

```cron
# yjs-erp DB 백업 cron 예시
# 적용: 아래 한 줄을 `crontab -e` 에 추가하거나 /etc/cron.d/ 에 배치.
#
# 주의:
#  - VPS 타임존을 확인하세요(`timedatectl`). UTC면 KST 03:00은 18 0 * * * 입니다.
#  - npm 절대경로는 `which npm` 으로 확인 후 교체하세요(예: /usr/bin/npm 또는 nvm 경로).
#  - 로그 디렉터리(/var/log/yjs-erp)는 미리 생성: sudo mkdir -p /var/log/yjs-erp
#
# 매일 03:00(서버 로컬시간) DB 백업
0 3 * * * cd /var/www/yjs_erp && /usr/bin/npm run backup:db >> /var/log/yjs-erp/db-backup.cron.log 2>&1
```

- [ ] **Step 2: 복원 런북 작성**

`docs/runbook-db-restore.md`:

```markdown
# 런북: Supabase DB 복원

대상 백업은 `npm run backup:db`가 생성한 `YYYY-MM-DD-HHMMSS-db.sql.gz` (gzip된 `supabase db dump` 결과)이다.

## 1. 백업 확보 및 무결성 검증

로컬(VPS):
- 최신 위치: `backups/private/LATEST_DB_BACKUP.txt` 의 `path`, `sha256` 확인.

Supabase Storage(`db-backups` 버킷)에서 받기:
- 대시보드 → Storage → `db-backups` → 대상 파일 다운로드, 또는 service-role 키로 API 다운로드.

무결성 검증(해당 백업 폴더의 `manifest.json` 과 대조):

\`\`\`bash
sha256sum 2026-06-19-030000-db.sql.gz   # manifest.json 의 sha256 과 일치해야 함
\`\`\`

## 2. 압축 해제

\`\`\`bash
gunzip -k 2026-06-19-030000-db.sql.gz   # -k: 원본 .gz 보존
\`\`\`

## 3. 복원

> 운영 DB에 바로 복원하기 전, 가능하면 **별도(staging) Supabase 프로젝트나 로컬 Postgres**에 먼저 복원해 검증할 것.

\`\`\`bash
# $SUPABASE_DB_URL 은 복원 대상 DB의 연결 문자열
psql "$SUPABASE_DB_URL" -f 2026-06-19-030000-db.sql
\`\`\`

## 4. 복원 검증

핵심 테이블의 행 수/합계를 백업 시점과 대조:

\`\`\`sql
select count(*) from "투입실적";
select count(*) from "수주";
select sum("성과금액") from "공사이력";   -- 컬럼명은 실제 스키마에 맞게 조정
\`\`\`

## 5. 정기 복원 훈련 (중요)

**분기 1회**, 최신 백업을 staging에 복원해 백업이 실제로 살아있는지 검증한다.
한 번도 복원해보지 않은 백업은 "백업이 있다"고 말할 수 없다.
```

- [ ] **Step 3: `docs/backup-inventory.md`에 DB 백업 단락 추가**

`## Automated Local Backup` 섹션의 끝(다음 `##` 헤더 직전)에 추가:

```markdown
## Automated Supabase DB Backup

라이브 Supabase DB는 별도로 매일 백업한다(소스 엑셀 백업과 무관).

\`\`\`bash
npm run backup:db
\`\`\`

- 방식: `supabase db dump` → gzip → `backups/private/<ts>-db-backup/<ts>-db.sql.gz`
- 이중 보관: VPS 로컬 + Supabase Storage `db-backups`(비공개) 버킷
- 보관주기: 일 7개 + 일요일자 주간 4개(로컬·Storage 동일)
- 필요 env: `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- 스케줄: VPS cron(`deploy/backup-db.cron.example`)
- 복원: `docs/runbook-db-restore.md`
- 로그: `backups/private/db-backup.log`

`supabase/storage-db-backups.sql` 을 Supabase SQL Editor에서 1회 실행해 버킷을 만들어야 한다.
```

- [ ] **Step 4: 커밋**

```bash
git add deploy/backup-db.cron.example docs/runbook-db-restore.md docs/backup-inventory.md
git commit -m "docs: DB 백업 cron 예시 + 복원 런북 + 인벤토리 갱신"
```

---

## Task 5: 통합 점검 (운영자 수동 실행)

> 실제 자격증명이 필요하므로 자동화 테스트가 아닌 **운영자/사용자 수동 검증**이다. 코드 변경 없음.

- [ ] **Step 1: 버킷 생성**

Supabase 대시보드 SQL Editor에서 `supabase/storage-db-backups.sql` 실행.

- [ ] **Step 2: env 설정**

VPS의 `.env.production`(로컬 테스트면 `.env.local`)에 `SUPABASE_DB_URL` 실제 값 입력. supabase CLI 설치 확인: `supabase --version`.

- [ ] **Step 3: 1회 실행 및 결과 확인**

Run: `npm run backup:db`
Expected:
- 콘솔에 `✅ DB 백업 완료: ...` 출력
- `backups/private/<ts>-db-backup/<ts>-db.sql.gz` + `manifest.json` 생성
- `backups/private/LATEST_DB_BACKUP.txt` 갱신
- `backups/private/db-backup.log` 에 `OK ... upload:Y` 1줄
- Supabase Storage `db-backups` 버킷에 `.gz` 객체 존재

- [ ] **Step 4: cron 등록**

`deploy/backup-db.cron.example` 안내대로 VPS crontab 등록 후 다음 날 로그 확인.

- [ ] **Step 5: 복원 훈련 1회**

`docs/runbook-db-restore.md` 절차대로 staging/로컬 Postgres에 1회 복원해 백업 유효성 검증.

---

## Self-Review

**스펙 커버리지:**
- supabase db dump 매일 → Task 3 ✅
- VPS/Storage 이중 보관 → Task 3(업로드) + Task 2(버킷) + Task 4(cron) ✅
- 보관주기 일7/주4 로컬·Storage 동일 → Task 1(순수함수) + Task 3(pruneLocal/pruneStorage) ✅
- 에러 처리(fail-fast, 부분 실패 시 로컬 보존+비0 종료, prune은 업로드 후) → Task 3 ✅
- 로깅(db-backup.log 1줄 포맷) → Task 3 ✅
- 단위 테스트 → Task 1 ✅
- 복원 런북 + 분기 복원 훈련 → Task 4/Task 5 ✅
- 보안(private 디렉터리, env .example 플레이스홀더, 비공개 버킷) → Task 2/3 ✅
- 인벤토리 문서 갱신 → Task 4 ✅

**플레이스홀더 스캔:** 모든 코드/명령 단계에 실제 내용 포함. TODO/TBD 없음. ✅

**타입 일관성:** `selectForRetention(fileNames, now, policy) → { keep, delete }` 시그니처가 Task 1 정의와 Task 3의 `pruneLocal`/`pruneStorage` 호출에서 일치. `RetentionPolicy` 형태(`{dailyDays, weeklyCount}`)가 테스트·구현·스크립트(`RETENTION` 상수)에서 동일. 파일명 규칙 `YYYY-MM-DD-HHMMSS-db.sql.gz`가 retention 정규식·`stamp()`·`pruneLocal` 디렉터리 변환에서 일치. ✅
