/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS verification */
const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
async function main() {
 const db = new PGlite()
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create table auth.identities(user_id uuid,provider text,provider_id text,identity_data jsonb);
   create table public.whitelist(kakao_id text,role text);
   insert into auth.identities values('00000000-0000-4000-a000-000000000001','kakao','test-admin','{}');
   insert into public.whitelist values('test-admin','admin');
   create table public.audit_log(id bigint generated always as identity,table_name text,operation text,old_data jsonb,new_data jsonb);
   create table public.거래처(id integer);create table public.공사단가(id integer);`)
  for (const name of ['20260622090000_rls_whitelist_helper.sql','20260622090300_rls_admin_writes.sql','20260922090000_equipment.sql','20260922100000_equipment_large_monitors.sql']) await db.exec(fs.readFileSync(path.resolve('supabase/migrations',name),'utf8'))
  const seed=fs.readFileSync(path.resolve('tmp/equipment/seed.sql'),'utf8')
  await db.exec(seed)
  await db.exec(seed)
  await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000001',false)")
  const data=(await db.query('select public.equipment_snapshot() data')).rows[0].data
  assert.equal(data.people.length,19)
  assert.equal(data.assets.filter(a=>a.category==='데스크탑').length,14)
  assert.equal(data.services.length,12)
  assert.equal(data.blocks.filter(b=>b.floor_id===1).length,0)
  assert.equal(data.blocks.filter(b=>b.floor_id===2&&b.person_id).length,18)
  assert.equal(data.assets.filter(a=>a.category==='전자칠판'&&a.identity_status==='중복미확정').length,3)
  assert.deepEqual(data.stocks.map(s=>s.quantity).sort((a,b)=>a-b),[2,3,4])
  const google=data.services.find(s=>s.vendor==='Google')
  assert.equal(google.amount,16.8);assert.equal(google.billing_unit,'1인');assert.equal(google.users,10);assert.equal(google.needs_review,true)
  fs.writeFileSync(path.resolve('tmp/equipment/snapshot.json'),JSON.stringify(data,null,2))
  console.log('Local PostgreSQL seed verification passed: re-run idempotence, 19 people, 14 PCs, 12 services, 18 second-floor seats, unknown boards, confirmed peripherals, per-person USD billing.')
 } finally { await db.close() }
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
