-- 영전사 전산 현황. All writes use guarded, transactional RPCs.
begin;
create table public.장비_층 (
 id integer primary key check (id between 1 and 3), name text not null,
 width integer not null check (width between 400 and 2400),
 height integer not null check (height between 300 and 1800), version integer not null default 1
);
create table public.장비_인원 (
 id uuid primary key default gen_random_uuid(), source_key text unique,
 name text not null check (length(trim(name)) between 1 and 100), title text not null default '',
 department text, email text, phone text, active boolean not null default true, kakao_id text,
 version integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid, deleted_at timestamptz
);
create table public.장비_배치 (
 id uuid primary key default gen_random_uuid(), source_key text unique,
 floor_id integer not null references public.장비_층(id),
 kind text not null check (kind in ('자리','서랍','서버','벽부착','구역','구조물','보관')),
 name text not null check (length(trim(name)) between 1 and 100),
 x integer not null check(x >= 0), y integer not null check(y >= 0),
 width integer not null check(width >= 100), height integer not null check(height >= 60),
 parent_id uuid references public.장비_배치(id) deferrable initially deferred,
 person_id uuid references public.장비_인원(id),
 registration text not null default '미등록' check(registration in ('미등록','일부등록','확인완료','장비있음')),
 unverified_category text check(unverified_category in ('데스크탑','노트북','전자칠판','복합기','CCTV','공유기','NAS')),
 unverified_status text not null default '재고' check(unverified_status in ('사용중','재고','수리중','폐기대기')),
 note text, version integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid, deleted_at timestamptz
);
create unique index equipment_active_person on public.장비_배치(person_id) where deleted_at is null and person_id is not null;
create table public.장비_자산 (
 id uuid primary key default gen_random_uuid(), source_key text unique, asset_no text not null unique,
 category text not null check(category in ('데스크탑','노트북','전자칠판','복합기','CCTV','공유기','NAS')),
 name text not null check(length(trim(name)) between 1 and 150), block_id uuid references public.장비_배치(id),
 model text, serial text, specs jsonb not null default '{}', os text,
 status text not null default '사용중' check(status in ('사용중','재고','수리중','폐기대기')),
 identity_status text not null default '확정' check(identity_status in ('확정','중복미확정')),
 last_checked date, note text, version integer not null default 1,
 updated_at timestamptz not null default now(), updated_by uuid, deleted_at timestamptz
);
create table public.장비_수량품 (
 id uuid primary key default gen_random_uuid(), source_key text unique, block_id uuid references public.장비_배치(id),
 category text not null check(category in ('모니터','키보드','마우스','케이블','기타')),
 name text not null check(length(trim(name)) between 1 and 150), specification text,
 quantity integer check(quantity >= 0), confirmed boolean not null default false,
 check((confirmed and quantity is not null) or (not confirmed and quantity is null)),
 status text not null default '재고' check(status in ('사용중','재고','수리중','폐기대기')),
 last_checked date, note text, version integer not null default 1,
 updated_at timestamptz not null default now(), updated_by uuid, deleted_at timestamptz
);
create table public.장비_서비스 (
 id uuid primary key default gen_random_uuid(), source_key text unique, name text not null check(length(trim(name)) between 1 and 150),
 purpose text, vendor text, account_owner text, amount numeric check(amount >= 0),
 currency text check(currency in ('KRW','USD')), cycle text, billing_unit text, users integer check(users > 0),
 renewal_date date, measurement text not null default '미측정' check(measurement = '미측정'),
 asset_id uuid references public.장비_자산(id), source jsonb not null default '{}', needs_review boolean not null default false,
 note text, version integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid, deleted_at timestamptz
);
create table public.장비_자산관리정보 (
 id uuid primary key default gen_random_uuid(), asset_id uuid not null unique references public.장비_자산(id),
 spec_grade text, replacement_priority text, source jsonb not null default '{}',
 version integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid, deleted_at timestamptz
);
create table public.장비_번호 (prefix text primary key, value integer not null);

-- UUID records retain the full key in JSON; legacy audit row_id is bigint.
create function public.equipment_audit() returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into public.audit_log(table_name, operation, old_data, new_data)
 values(tg_table_name, tg_op, case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
 return null;
end $$;
create function public.equipment_stamp() returns trigger language plpgsql set search_path = public as $$
begin
 new.updated_at := now(); new.updated_by := auth.uid();
 if tg_op = 'UPDATE' then new.version := old.version + 1; end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['장비_층','장비_인원','장비_배치','장비_자산','장비_수량품','장비_서비스','장비_자산관리정보','장비_번호'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  if t <> '장비_번호' then
   execute format('create policy equipment_read on public.%I for select to authenticated using ((select public.%I()))', t, case when t = '장비_자산관리정보' then 'is_admin' else 'is_whitelisted' end);
   -- RLS also enforces admin-only writes if a later migration grants DML.
   execute format('create policy equipment_write on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',t);
   if t <> '장비_인원' then execute format('grant select on public.%I to authenticated',t); end if;
   execute format('create trigger equipment_audit after insert or update or delete on public.%I for each row execute function public.equipment_audit()',t);
   if t <> '장비_층' then
    execute format('create trigger equipment_stamp before insert or update on public.%I for each row execute function public.equipment_stamp()',t);
   end if;
  end if;
 end loop;
end $$;
grant select(id,source_key,name,title,department,email,active,kakao_id,version,updated_at,updated_by,deleted_at) on public.장비_인원 to authenticated;

create function public.equipment_validate_layout() returns void language plpgsql set search_path = public as $$
begin
 if exists(select 1 from public.장비_배치 b join public.장비_층 f on f.id=b.floor_id where b.deleted_at is null and (b.x+b.width>f.width or b.y+b.height>f.height)) then
  raise exception '배치가 캔버스 경계를 벗어났습니다'; end if;
 if exists(select 1 from public.장비_배치 b left join public.장비_배치 p on p.id=b.parent_id where b.deleted_at is null and b.parent_id is not null and (p.deleted_at is not null or p.floor_id<>b.floor_id or p.kind<>'구역')) then
  raise exception '소속 구역은 같은 층의 활성 구역이어야 합니다'; end if;
 if exists(with recursive tree as (
  select id,parent_id,array[id] path,false cycle from public.장비_배치 where deleted_at is null
  union all select p.id,p.parent_id,t.path||p.id,p.id=any(t.path) from tree t join public.장비_배치 p on p.id=t.parent_id where not t.cycle
 ) select 1 from tree where cycle) then raise exception '구역 순환 연결은 허용되지 않습니다'; end if;
 if exists(select 1 from public.장비_배치 b join public.장비_인원 p on p.id=b.person_id where b.deleted_at is null and (not p.active or p.deleted_at is not null)) then
  raise exception '재직 중인 인원만 배정할 수 있습니다'; end if;
 if exists(select 1 from public.장비_자산 a join public.장비_배치 b on b.id=a.block_id where a.deleted_at is null and b.deleted_at is not null)
 or exists(select 1 from public.장비_수량품 a join public.장비_배치 b on b.id=a.block_id where a.deleted_at is null and b.deleted_at is not null) then
  raise exception '장비는 삭제되지 않은 배치에 연결해야 합니다'; end if;
 if exists(select 1 from public.장비_서비스 s join public.장비_자산 a on a.id=s.asset_id where s.deleted_at is null and a.deleted_at is not null) then
  raise exception '서비스는 삭제되지 않은 자산에 연결해야 합니다'; end if;
end $$;
-- Enforce references at transaction end, allowing region/seat overlap and multi-row moves.
create function public.equipment_constraint_check() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.equipment_validate_layout(); return null; end $$;
do $$ declare t text; begin
 foreach t in array array['장비_층','장비_인원','장비_배치','장비_자산','장비_수량품','장비_서비스'] loop
  execute format('create constraint trigger equipment_references after insert or update or delete on public.%I deferrable initially deferred for each row execute function public.equipment_constraint_check()',t);
 end loop;
end $$;

create function public.equipment_snapshot() returns jsonb language plpgsql security definer set search_path = public as $$
begin
 if not public.is_whitelisted() then raise exception '조회 권한이 없습니다' using errcode='42501'; end if;
 return jsonb_build_object(
  'floors',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.장비_층 t),
  'people',(select coalesce(jsonb_agg(to_jsonb(t)-'phone'-'source_key'),'[]') from public.장비_인원 t where deleted_at is null),
  'blocks',(select coalesce(jsonb_agg(to_jsonb(t)-'source_key'),'[]') from public.장비_배치 t where deleted_at is null),
  'assets',(select coalesce(jsonb_agg(to_jsonb(t)-'source_key'),'[]') from public.장비_자산 t where deleted_at is null),
  'stocks',(select coalesce(jsonb_agg(to_jsonb(t)-'source_key'),'[]') from public.장비_수량품 t where deleted_at is null),
  'services',(select coalesce(jsonb_agg(to_jsonb(t)-'source_key'),'[]') from public.장비_서비스 t where deleted_at is null)
 );
end $$;
create function public.equipment_phone(person uuid) returns text language plpgsql security definer set search_path = public as $$
begin
 if not public.is_whitelisted() then raise exception '조회 권한이 없습니다' using errcode='42501'; end if;
 return (select phone from public.장비_인원 where id=person and active and deleted_at is null);
end $$;

create function public.equipment_save_layout(payload jsonb) returns void language plpgsql security definer set search_path = public as $$
declare f public.장비_층; b jsonb; a jsonb; removed uuid[]; fid integer := (payload->>'floor_id')::integer;
begin
 if not public.is_admin() then raise exception '관리자만 편집할 수 있습니다' using errcode='42501'; end if;
 -- Serialize equipment writes, including cross-floor assignments and inventory updates.
 perform pg_advisory_xact_lock(20260922);
 select * into f from public.장비_층 where id=fid for update;
 if not found or payload->>'version' is null or f.version<>(payload->>'version')::integer then raise exception '다른 사용자가 수정했습니다. 새로고침 후 다시 편집하세요' using errcode='40001'; end if;
 removed := array(select jsonb_array_elements_text(payload->'removed')::uuid);
 if exists(select 1 from public.장비_배치 where id=any(removed) and floor_id<>fid) then raise exception '다른 층의 배치는 삭제할 수 없습니다'; end if;
 update public.장비_층 set width=(payload->>'width')::integer,height=(payload->>'height')::integer,version=version+1 where id=fid;
 -- Clear changed assignments first so swapping two seats is valid under the unique index.
 update public.장비_배치 set person_id=null where floor_id=fid and id in (select (v->>'id')::uuid from jsonb_array_elements(payload->'blocks') v);
 update public.장비_배치 set deleted_at=now(),person_id=null where id=any(removed) and deleted_at is null;
 update public.장비_배치 set parent_id=null where parent_id=any(removed) and deleted_at is null;
 for b in select * from jsonb_array_elements(payload->'blocks') loop
  if exists(select 1 from public.장비_배치 where id=(b->>'id')::uuid and (floor_id<>fid or deleted_at is not null)) then raise exception '배치 위치가 변경되었거나 삭제되었습니다'; end if;
  insert into public.장비_배치(id,floor_id,kind,name,x,y,width,height,parent_id,person_id,registration,unverified_category,unverified_status,note)
  values((b->>'id')::uuid,fid,b->>'kind',b->>'name',(b->>'x')::integer,(b->>'y')::integer,(b->>'width')::integer,(b->>'height')::integer,(b->>'parent_id')::uuid,(b->>'person_id')::uuid,b->>'registration',b->>'unverified_category',coalesce(b->>'unverified_status','재고'),b->>'note')
  on conflict(id) do update set kind=excluded.kind,name=excluded.name,x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,parent_id=excluded.parent_id,person_id=excluded.person_id,registration=excluded.registration,unverified_category=excluded.unverified_category,unverified_status=excluded.unverified_status,note=excluded.note;
 end loop;
 for a in select * from jsonb_array_elements(payload->'assignments') loop
  if a->>'block_id' is not null and not exists(select 1 from public.장비_배치 where id=(a->>'block_id')::uuid and floor_id=fid and deleted_at is null) then raise exception '배정 위치가 올바르지 않습니다'; end if;
  if a->>'kind' = 'asset' then
   update public.장비_자산 set block_id=(a->>'block_id')::uuid where id=(a->>'id')::uuid and version=(a->>'version')::integer and deleted_at is null;
  elsif a->>'kind' = 'stock' then
   update public.장비_수량품 set block_id=(a->>'block_id')::uuid where id=(a->>'id')::uuid and version=(a->>'version')::integer and deleted_at is null;
  else raise exception '배정 유형 오류'; end if;
  if not found then raise exception '장비가 변경되었습니다. 다시 불러오세요' using errcode='40001'; end if;
 end loop;
 update public.장비_자산 set block_id=null where block_id=any(removed);
 update public.장비_수량품 set block_id=null where block_id=any(removed);
 perform public.equipment_validate_layout();
end $$;

create function public.equipment_save_item(kind text,payload jsonb) returns void language plpgsql security definer set search_path = public as $$
declare ident uuid := coalesce((payload->>'id')::uuid,gen_random_uuid()); loc uuid := (payload->>'block_id')::uuid;
 expected integer := (payload->>'version')::integer; n integer; number_prefix text; number_value integer;
begin
 if not public.is_admin() then raise exception '관리자만 편집할 수 있습니다' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(20260922);
 if loc is not null and not exists(select 1 from public.장비_배치 where id=loc and deleted_at is null) then raise exception '삭제되거나 존재하지 않는 위치입니다'; end if;
 if kind='asset' then
  if expected is null then
   number_prefix := case payload->>'category' when '데스크탑' then 'PC' when '노트북' then 'NB' when '전자칠판' then 'EB' when '복합기' then 'PR' when 'CCTV' then 'CV' when '공유기' then 'RT' when 'NAS' then 'NS' end;
   insert into public.장비_번호 values(number_prefix,1) on conflict(prefix) do update set value=장비_번호.value+1 returning value into number_value;
   insert into public.장비_자산(id,asset_no,category,name,block_id,model,serial,specs,os,status,identity_status,last_checked,note)
   values(ident,'YJ-'||number_prefix||'-'||lpad(number_value::text,greatest(3,length(number_value::text)),'0'),payload->>'category',payload->>'name',loc,payload->>'model',payload->>'serial',coalesce(payload->'specs','{}'),payload->>'os',coalesce(payload->>'status','사용중'),coalesce(payload->>'identity_status','확정'),(payload->>'last_checked')::date,payload->>'note');
  else
   update public.장비_자산 set name=payload->>'name',block_id=loc,model=payload->>'model',serial=payload->>'serial',specs=payload->'specs',os=payload->>'os',status=payload->>'status',identity_status=payload->>'identity_status',last_checked=(payload->>'last_checked')::date,note=payload->>'note',deleted_at=case when (payload->>'remove')::boolean then now() end
    where id=ident and version=expected and deleted_at is null;
   get diagnostics n = row_count;
   if n=0 then raise exception '장비가 변경되었습니다. 다시 불러오세요' using errcode='40001'; end if;
   if (payload->>'remove')::boolean then update public.장비_서비스 set asset_id=null where asset_id=ident; end if;
  end if;
 elsif kind='stock' then
  if expected is null then
   insert into public.장비_수량품(id,block_id,category,name,specification,quantity,confirmed,status,last_checked,note)
   values(ident,loc,payload->>'category',payload->>'name',payload->>'specification',(payload->>'quantity')::integer,(payload->>'quantity') is not null,coalesce(payload->>'status','재고'),(payload->>'last_checked')::date,payload->>'note');
  else
   -- Quantities are changed only via the atomic stock RPC.
   update public.장비_수량품 set name=payload->>'name',block_id=loc,specification=payload->>'specification',status=payload->>'status',note=payload->>'note',deleted_at=case when (payload->>'remove')::boolean then now() end where id=ident and version=expected and deleted_at is null;
   if not found then raise exception '재고가 변경되었습니다' using errcode='40001'; end if;
  end if;
 elsif kind='management' then
  if not exists(select 1 from public.장비_자산 where id=(payload->>'asset_id')::uuid and deleted_at is null) then raise exception '장비가 삭제되었거나 존재하지 않습니다'; end if;
  if expected is null then
   insert into public.장비_자산관리정보(id,asset_id,spec_grade,replacement_priority)
   values(ident,(payload->>'asset_id')::uuid,payload->>'spec_grade',payload->>'replacement_priority');
  else
   update public.장비_자산관리정보 set spec_grade=payload->>'spec_grade',replacement_priority=payload->>'replacement_priority'
    where id=ident and asset_id=(payload->>'asset_id')::uuid and version=expected and deleted_at is null;
   if not found then raise exception '관리정보가 변경되었습니다' using errcode='40001'; end if;
  end if;
 elsif kind='service' then
  if expected is null then
   insert into public.장비_서비스(id,name,purpose,vendor,account_owner,amount,currency,cycle,billing_unit,users,renewal_date,asset_id,needs_review,note)
   values(ident,payload->>'name',payload->>'purpose',payload->>'vendor',payload->>'account_owner',(payload->>'amount')::numeric,payload->>'currency',payload->>'cycle',payload->>'billing_unit',(payload->>'users')::integer,(payload->>'renewal_date')::date,(payload->>'asset_id')::uuid,coalesce((payload->>'needs_review')::boolean,false),payload->>'note');
  else
   update public.장비_서비스 set name=payload->>'name',purpose=payload->>'purpose',vendor=payload->>'vendor',account_owner=payload->>'account_owner',amount=(payload->>'amount')::numeric,currency=payload->>'currency',cycle=payload->>'cycle',billing_unit=payload->>'billing_unit',users=(payload->>'users')::integer,renewal_date=(payload->>'renewal_date')::date,asset_id=(payload->>'asset_id')::uuid,needs_review=(payload->>'needs_review')::boolean,note=payload->>'note',deleted_at=case when (payload->>'remove')::boolean then now() end where id=ident and version=expected and deleted_at is null;
   if not found then raise exception '서비스가 변경되었습니다' using errcode='40001'; end if;
  end if;
 elsif kind='person' then
  if expected is null then
   insert into public.장비_인원(id,name,title,department,email,phone,active) values(ident,payload->>'name',coalesce(payload->>'title',''),payload->>'department',payload->>'email',payload->>'phone',true);
  else
   update public.장비_인원 set name=payload->>'name',title=payload->>'title',department=payload->>'department',email=payload->>'email',phone=case when payload ? 'phone' then payload->>'phone' else phone end,active=(payload->>'active')::boolean where id=ident and version=expected and deleted_at is null;
   if not found then raise exception '인원이 변경되었습니다' using errcode='40001'; end if;
   if not (payload->>'active')::boolean then
    update public.장비_층 set version=version+1 where id in(select floor_id from public.장비_배치 where person_id=ident);
    update public.장비_배치 set person_id=null where person_id=ident;
   end if;
  end if;
 else raise exception '지원하지 않는 유형입니다'; end if;
end $$;
create function public.equipment_adjust_stock(item uuid,expected integer,delta integer,counted integer,memo text) returns void language plpgsql security definer set search_path = public as $$
declare s public.장비_수량품;
begin
 if not public.is_admin() then raise exception '관리자만 편집할 수 있습니다' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(20260922);
 select * into s from public.장비_수량품 where id=item and deleted_at is null for update;
 if not found or expected is null or s.version<>expected then raise exception '수량이 변경되었습니다. 다시 불러오세요' using errcode='40001'; end if;
 if (delta is null) = (counted is null) or (delta is not null and delta not in (-1,1)) then raise exception '증감 또는 실사 수량 하나를 입력하세요'; end if;
 if delta is not null and s.quantity is null then raise exception '미확인 수량은 실사 수량을 먼저 입력하세요'; end if;
 update public.장비_수량품 set quantity=coalesce(counted,s.quantity+delta),confirmed=true,
 last_checked=case when counted is not null then (now() at time zone 'Asia/Seoul')::date else last_checked end,
 note=coalesce(memo,note) where id=item;
end $$;

revoke all on function public.equipment_audit(),public.equipment_stamp(),public.equipment_validate_layout(),public.equipment_constraint_check() from public,anon,authenticated;
revoke all on function public.equipment_snapshot(),public.equipment_phone(uuid),public.equipment_save_layout(jsonb),public.equipment_save_item(text,jsonb),public.equipment_adjust_stock(uuid,integer,integer,integer,text) from public,anon;
grant execute on function public.equipment_snapshot(),public.equipment_phone(uuid),public.equipment_save_layout(jsonb),public.equipment_save_item(text,jsonb),public.equipment_adjust_stock(uuid,integer,integer,integer,text) to authenticated;
create index equipment_block_floor on public.장비_배치(floor_id) where deleted_at is null;
create index equipment_asset_location on public.장비_자산(block_id) where deleted_at is null;
create index equipment_stock_location on public.장비_수량품(block_id) where deleted_at is null;
commit;
