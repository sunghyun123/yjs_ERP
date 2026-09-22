import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const db = new PGlite()
const admin = '00000000-0000-4000-a000-000000000001'
const reader = '00000000-0000-4000-a000-000000000002'
const block = '00000000-0000-4000-a000-000000000010'
const stock = '00000000-0000-4000-a000-000000000011'
const person = '00000000-0000-4000-a000-000000000012'
const asset = '00000000-0000-4000-a000-000000000013'
const migration = (name: string) => readFileSync(resolve('supabase/migrations', name), 'utf8')
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.identities(user_id uuid,provider text,provider_id text,identity_data jsonb);
    create table public.whitelist(kakao_id text,role text);
    insert into auth.identities values ('${admin}','kakao','admin','{}'),('${reader}','kakao','reader','{}');
    insert into public.whitelist values('admin','admin'),('reader','user');
    create table public.audit_log(id bigint generated always as identity,table_name text,operation text,old_data jsonb,new_data jsonb);
    grant usage on schema public,auth to authenticated,anon;
    create table public.거래처(id integer); create table public.공사단가(id integer);`)
  await db.exec(migration('20260622090000_rls_whitelist_helper.sql'))
  await db.exec(migration('20260622090300_rls_admin_writes.sql'))
  await db.exec(migration('20260922090000_equipment.sql'))
  await db.exec(migration('20260922100000_equipment_large_monitors.sql'))
  await db.exec(`insert into public.장비_층 values(2,'2층',1000,650,1);
    insert into public.장비_인원(id,name,phone) values('${person}','테스트 직원','010-test-private');
    insert into public.장비_배치(id,floor_id,kind,name,x,y,width,height,person_id) values('${block}',2,'보관','테스트 보관',20,20,200,100,'${person}');
    insert into public.장비_자산(id,asset_no,category,name,block_id) values('${asset}','YJ-PC-001','데스크탑','테스트 PC','${block}');
    insert into public.장비_번호 values('PC',1);
    insert into public.장비_자산관리정보(asset_id,spec_grade) values('${asset}','admin-secret');
    insert into public.장비_수량품(id,block_id,category,name,quantity,confirmed) values('${stock}','${block}','마우스','테스트 마우스',2,true);`)
}, 30000)
afterAll(async () => { await db.close() })

async function asUser<T>(uid: string, operation: () => Promise<T>) {
  await db.exec('begin; set local role authenticated;')
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid])
  try { const result = await operation(); await db.exec('set constraints all immediate'); return result } finally { await db.exec('rollback') }
}
const save = (payload: object) => db.query('select public.equipment_save_layout($1::jsonb)',[JSON.stringify(payload)])
const layout = (overrides = {}) => ({ floor_id:2,version:1,width:1000,height:650,blocks:[],removed:[],assignments:[],...overrides })
describe('equipment database permissions and transactions', () => {
  it('registers large monitors and reclassifies stock without changing counted quantities', async () => {
    await asUser(admin, async () => {
      await db.query("select public.equipment_save_item('stock',$1::jsonb)", [JSON.stringify({name:'회의실 화면',category:'대형 모니터',quantity:1})])
      await db.query("select public.equipment_save_item('stock',$1::jsonb)", [JSON.stringify({id:stock,version:1,name:'대형 화면',category:'대형 모니터',status:'재고',quantity:999})])
      expect((await db.query('select category,quantity,version from public.장비_수량품 where id=$1',[stock])).rows[0]).toEqual({category:'대형 모니터',quantity:2,version:2})
      expect((await db.query("select count(*)::integer total from public.장비_수량품 where category='대형 모니터'")).rows[0]).toEqual({total:2})
    })
  })
  it('omits phones and admin data from the initial snapshot', async () => {
    await asUser(reader,async()=>{
      const result=await db.query('select public.equipment_snapshot() data')
      expect(JSON.stringify(result.rows)).not.toContain('010-test-private')
      expect(JSON.stringify(result.rows)).not.toContain('admin-secret')
      expect((await db.query('select * from public.장비_자산관리정보')).rows).toHaveLength(0)
      expect((await db.query('select public.equipment_phone($1) phone',[person])).rows[0]).toEqual({phone:'010-test-private'})
    })
  })
  it('blocks direct phone reads even for whitelist users', async () => {
    await expect(asUser(reader,()=>db.query('select phone from public.장비_인원'))).rejects.toThrow(/permission denied/)
  })
  it('denies direct writes and mutation RPCs to ordinary users', async () => {
    await expect(asUser(reader,()=>db.query("update public.장비_수량품 set quantity=9"))).rejects.toThrow(/permission denied/)
    await expect(asUser(reader,()=>save(layout()))).rejects.toThrow(/관리자/)
    await expect(asUser(reader,()=>db.query('select public.equipment_adjust_stock($1,1,1,null,null)',[stock]))).rejects.toThrow(/관리자/)
    await expect(asUser(reader,()=>db.query("select public.equipment_save_item('management',$1::jsonb)",[JSON.stringify({asset_id:asset,spec_grade:'forbidden'})]))).rejects.toThrow(/관리자/)
  })
  it('rejects non-whitelisted authenticated users', async () => {
    await expect(asUser('00000000-0000-4000-a000-000000000099',()=>db.query('select public.equipment_snapshot()'))).rejects.toThrow(/조회 권한/)
  })
  it('rejects stale and missing floor versions', async () => {
    await expect(asUser(admin,()=>save(layout({version:0})))).rejects.toThrow(/다른 사용자/)
    await expect(asUser(admin,()=>save(layout({version:null})))).rejects.toThrow(/다른 사용자/)
  })
  it('preserves assets and quantities when deleting their block', async () => {
    await asUser(admin,async()=>{
      await save(layout({removed:[block]}))
      expect((await db.query('select block_id,deleted_at from public.장비_자산')).rows[0]).toEqual({block_id:null,deleted_at:null})
      expect((await db.query('select block_id,quantity from public.장비_수량품')).rows[0]).toEqual({block_id:null,quantity:2})
    })
  })
  it('rolls back the whole layout if an assignment is stale', async () => {
    await expect(asUser(admin,()=>save(layout({removed:[block],assignments:[{id:asset,kind:'asset',version:99,block_id:null}]})))).rejects.toThrow(/장비가 변경/)
    expect((await db.query('select version from public.장비_층')).rows[0]).toEqual({version:1})
    expect((await db.query('select deleted_at from public.장비_배치')).rows[0]).toEqual({deleted_at:null})
  })
  it('makes increments atomic and rejects a replayed version', async () => {
    await asUser(admin,async()=>{
      await db.query('select public.equipment_adjust_stock($1,1,1,null,null)',[stock])
      expect((await db.query('select quantity,last_checked from public.장비_수량품')).rows[0]).toEqual({quantity:3,last_checked:null})
    })
    await expect(asUser(admin,async()=>{
      await db.query('select public.equipment_adjust_stock($1,1,1,null,null)',[stock])
      await db.query('select public.equipment_adjust_stock($1,1,1,null,null)',[stock])
    })).rejects.toThrow(/수량이 변경/)
  })
  it('preserves unknowns, rejects negatives, and records a count of zero', async () => {
    await expect(db.exec(`begin; update public.장비_수량품 set quantity=null where id='${stock}';`)).rejects.toThrow()
    await db.exec('rollback')
    await expect(asUser(admin,()=>db.query('select public.equipment_adjust_stock($1,1,null,-1,null)',[stock]))).rejects.toThrow(/check constraint/)
    await asUser(admin,async()=>{
      await db.query('select public.equipment_adjust_stock($1,1,null,0,null)',[stock])
      const row=(await db.query<{quantity:number;confirmed:boolean;last_checked:string}>('select quantity,confirmed,last_checked from public.장비_수량품')).rows[0]
      expect(row.quantity).toBe(0);expect(row.confirmed).toBe(true);expect(row.last_checked).toBeTruthy()
    })
  })
  it('rejects cyclic regions and out-of-bounds geometry', async () => {
    const b={id:block,name:'구역',kind:'구역',x:0,y:0,width:200,height:100,person_id:null,registration:'미등록',note:null}
    await expect(asUser(admin,()=>save(layout({blocks:[{...b,parent_id:block}]})))).rejects.toThrow(/순환/)
    await expect(asUser(admin,()=>save(layout({blocks:[{...b,x:950,parent_id:null}]})))).rejects.toThrow(/경계/)
  })
  it('registers assets from name and category with unique server-assigned numbers', async () => {
    await asUser(admin,async()=>{
      for (let i=0;i<2;i++) await db.query("select public.equipment_save_item('asset',$1::jsonb)",[JSON.stringify({name:'최소 등록',category:'데스크탑'})])
      const result=await db.query<{asset_no:string}>("select asset_no from public.장비_자산 where name='최소 등록' order by asset_no")
      expect(result.rows.map(r=>r.asset_no)).toEqual(['YJ-PC-002','YJ-PC-003'])
    })
  })
  it('stores per-person USD billing separately from user count and measurement state', async () => {
    await asUser(admin,async()=>{
      await db.query("select public.equipment_save_item('service',$1::jsonb)",[JSON.stringify({name:'구독',amount:16.8,currency:'USD',billing_unit:'1인',users:10,cycle:'월'})])
      const result=await db.query("select amount,currency,billing_unit,users,measurement from public.장비_서비스")
      expect(result.rows[0]).toMatchObject({amount:'16.8',currency:'USD',billing_unit:'1인',users:10,measurement:'미측정'})
    })
  })
  it('unlinks a deleted physical asset from services and excludes it from the snapshot', async () => {
    await asUser(admin,async()=>{
      await db.query("select public.equipment_save_item('service',$1::jsonb)",[JSON.stringify({name:'장비 연계 서비스',asset_id:asset})])
      const current=(await db.query<Record<string,unknown>>('select * from public.장비_자산 where id=$1',[asset])).rows[0]
      await db.query("select public.equipment_save_item('asset',$1::jsonb)",[JSON.stringify({...current,remove:true})])
      expect((await db.query('select asset_id from public.장비_서비스')).rows[0]).toEqual({asset_id:null})
      const snapshot=(await db.query<{data:{assets:unknown[]}}>('select public.equipment_snapshot() data')).rows[0].data
      expect(snapshot.assets).toHaveLength(0)
      expect((await db.query('select updated_by from public.장비_자산')).rows[0]).toEqual({updated_by:admin})
    })
  })
  it('retires people by clearing assignments while keeping their equipment', async () => {
    await asUser(admin,async()=>{
      await db.query("select public.equipment_save_item('person',$1::jsonb)",[JSON.stringify({id:person,version:1,name:'테스트 직원',title:'',active:false})])
      expect((await db.query('select person_id from public.장비_배치')).rows[0]).toEqual({person_id:null})
      expect((await db.query('select block_id from public.장비_자산')).rows[0]).toEqual({block_id:block})
      expect((await db.query('select version from public.장비_층')).rows[0]).toEqual({version:2})
    })
  })
  it('preserves the last inventory date when only a stock memo changes', async () => {
    await asUser(admin,async()=>{
      await db.query('select public.equipment_adjust_stock($1,1,null,4,null)',[stock])
      const current=(await db.query<Record<string,unknown>>('select * from public.장비_수량품 where id=$1',[stock])).rows[0]
      await db.query("select public.equipment_save_item('stock',$1::jsonb)",[JSON.stringify({...current,note:'메모만 수정',last_checked:null,quantity:99})])
      expect((await db.query('select quantity,last_checked,note from public.장비_수량품')).rows[0]).toEqual({quantity:4,last_checked:current.last_checked,note:'메모만 수정'})
    })
  })
  it('swaps two people in one transaction without a transient duplicate assignment', async () => {
    await asUser(admin,async()=>{
      const secondPerson='00000000-0000-4000-a000-000000000020'
      const secondBlock='00000000-0000-4000-a000-000000000021'
      await db.query("select public.equipment_save_item('person',$1::jsonb)",[JSON.stringify({id:secondPerson,name:'두 번째 직원'})])
      const b={id:secondBlock,kind:'자리',name:'두 번째 자리',x:300,y:20,width:200,height:100,parent_id:null,person_id:secondPerson,registration:'미등록'}
      await save(layout({blocks:[b]}))
      const first=(await db.query<Record<string,unknown>>('select * from public.장비_배치 where id=$1',[block])).rows[0]
      await save(layout({version:2,blocks:[{...first,person_id:secondPerson},{...b,person_id:person}]}))
      expect((await db.query('select person_id from public.장비_배치 where id=$1',[block])).rows[0]).toEqual({person_id:secondPerson})
      expect((await db.query('select person_id from public.장비_배치 where id=$1',[secondBlock])).rows[0]).toEqual({person_id:person})
    })
  })
  it('edits management information without adding it to the shared snapshot', async () => {
    await asUser(admin,async()=>{
      const info=(await db.query<Record<string,unknown>>('select * from public.장비_자산관리정보')).rows[0]
      await db.query("select public.equipment_save_item('management',$1::jsonb)",[JSON.stringify({...info,spec_grade:'관리자 변경',replacement_priority:'1순위'})])
      expect((await db.query('select spec_grade,replacement_priority from public.장비_자산관리정보')).rows[0]).toEqual({spec_grade:'관리자 변경',replacement_priority:'1순위'})
      expect(JSON.stringify((await db.query('select public.equipment_snapshot()')).rows)).not.toContain('관리자 변경')
    })
  })
})
