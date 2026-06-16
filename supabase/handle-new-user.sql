-- auth.users 신규 가입 시 public.사용자 프로필 행을 자동 생성하는 트리거 함수.
--
-- 배경: 기존 이메일/비번 로그인 시절 만들어진 handle_new_user()는 NEW.email을
-- 사용자.이메일(NOT NULL)에 그대로 넣었다. 카카오 OAuth 유저는 이메일이 NULL일 수
-- 있어(이메일 선택 동의 미제공/계정에 이메일 없음) NOT NULL 위반으로
-- "Database error saving new user" 가 발생했다.
--
-- 수정: 이메일이 없으면 합성값(<uid>@kakao.local)을 넣어 제약을 만족시킨다.
-- (사용자.이메일은 앱에서 사용하지 않음 — 표시 이름은 whitelist에서 읽고,
--  이 행은 생성자/수정자 FK 대상 용도로만 존재하면 된다.)
-- 이름도 카카오 메타데이터의 name 키까지 폴백을 추가했다.
-- ON CONFLICT (id) DO NOTHING 으로 재실행/중복에도 안전하게 만든다.
--
-- 적용: Supabase 대시보드 SQL Editor에서 이 파일 전체를 실행.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
  BEGIN
    INSERT INTO public.사용자 (id, 이메일, 이름)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, NEW.id::text || '@kakao.local'),
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        ''
      )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END;
  $function$;

-- 트리거(on_auth_user_created)는 이미 존재하므로 함수만 교체하면 된다.
-- 혹시 트리거가 없다면 아래 주석을 해제해 생성:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
