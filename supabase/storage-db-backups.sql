-- DB 백업 보관용 비공개 Storage 버킷.
-- 적용: Supabase 대시보드 SQL Editor에서 이 파일 전체를 1회 실행.
--
-- public=false 로 공개 URL 노출을 차단한다. 업로드/삭제/조회는 service-role 키로만
-- 수행하므로(서버 측 스크립트 전용) 별도 RLS 정책은 필요하지 않다.

insert into storage.buckets (id, name, public)
values ('db-backups', 'db-backups', false)
on conflict (id) do nothing;
