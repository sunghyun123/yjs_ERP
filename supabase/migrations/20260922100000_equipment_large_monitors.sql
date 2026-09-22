begin;

alter table public.장비_수량품 drop constraint 장비_수량품_category_check;
alter table public.장비_수량품 add constraint 장비_수량품_category_check
 check(category in ('모니터','대형 모니터','키보드','마우스','케이블','기타'));

-- Allow explicit stock reclassification while retaining quantity, audit and version checks.
create or replace function public.equipment_save_item(kind text,payload jsonb) returns void language plpgsql security definer set search_path = public as $$
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
   update public.장비_수량품 set category=coalesce(payload->>'category',category),name=payload->>'name',block_id=loc,specification=payload->>'specification',status=payload->>'status',note=payload->>'note',deleted_at=case when (payload->>'remove')::boolean then now() end where id=ident and version=expected and deleted_at is null;
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

commit;