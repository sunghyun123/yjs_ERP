// Supabase createClient<Database>에 전달하는 타입 구조
// Row: DB에서 읽을 때, Insert: 삽입할 때 (nullable/default 컬럼은 optional), Update: 수정할 때 (전부 optional)

export type 역할타입 = 'admin' | 'user'

export type Database = {
  public: {
    Tables: {
      사용자: {
        Row: {
          id: string
          이름: string
          이메일: string
          역할: 역할타입
          생성일: string
        }
        Insert: {
          id: string
          이름?: string
          이메일: string
          역할?: 역할타입
          생성일?: string
        }
        Update: {
          id?: string
          이름?: string
          이메일?: string
          역할?: 역할타입
          생성일?: string
        }
      }
      거래처: {
        Row: {
          id: number
          거래처코드: string
          거래처명: string
          보험료제외율: number | null
          하도전용율: number | null
          법인: string | null
          비고: string | null
          생성일: string
        }
        Insert: {
          id?: number
          거래처코드: string
          거래처명: string
          보험료제외율?: number | null
          하도전용율?: number | null
          법인?: string | null
          비고?: string | null
          생성일?: string
        }
        Update: {
          id?: number
          거래처코드?: string
          거래처명?: string
          보험료제외율?: number | null
          하도전용율?: number | null
          법인?: string | null
          비고?: string | null
          생성일?: string
        }
      }
      공사단가: {
        Row: {
          id: number
          적용시작일: string
          투입구분: string
          주간단가: number
          야간단가: number | null
          생성자: string | null
          생성일: string
        }
        Insert: {
          id?: number
          적용시작일: string
          투입구분: string
          주간단가: number
          야간단가?: number | null
          생성자?: string | null
          생성일?: string
        }
        Update: {
          id?: number
          적용시작일?: string
          투입구분?: string
          주간단가?: number
          야간단가?: number | null
          생성자?: string | null
          생성일?: string
        }
      }
      수주: {
        Row: {
          id: number
          지중no: string
          공사번호: string | null
          공사명: string
          법인: string | null
          공사구분: string | null
          공사종류: string | null
          공사현장: string | null
          작업구분: string | null
          시공상태: string | null
          준공여부: boolean
          정산상태: string | null
          포장여부: boolean
          자재청구여부: boolean
          발주자_id: number | null
          원청사_id: number | null
          공사담당: string | null
          감독자: string | null
          관리자: string | null
          관리자_연락처: string | null
          수주금액_공급가: number | null
          착공일: string | null
          준공일: string | null
          준공액_공급가: number | null
          달성율: number | null
          보험료율: number | null
          하도전용율: number | null
          참고사항: string | null
          생성자: string | null
          생성일: string
          수정자: string | null
          수정일: string | null
        }
        Insert: {
          id?: number
          지중no: string
          공사번호?: string | null
          공사명: string
          법인?: string | null
          공사구분?: string | null
          공사종류?: string | null
          공사현장?: string | null
          작업구분?: string | null
          시공상태?: string | null
          준공여부?: boolean
          정산상태?: string | null
          포장여부?: boolean
          자재청구여부?: boolean
          발주자_id?: number | null
          원청사_id?: number | null
          공사담당?: string | null
          감독자?: string | null
          관리자?: string | null
          관리자_연락처?: string | null
          수주금액_공급가?: number | null
          착공일?: string | null
          준공일?: string | null
          준공액_공급가?: number | null
          달성율?: number | null
          보험료율?: number | null
          하도전용율?: number | null
          참고사항?: string | null
          생성자?: string | null
          생성일?: string
          수정자?: string | null
          수정일?: string | null
        }
        Update: {
          id?: number
          지중no?: string
          공사번호?: string | null
          공사명?: string
          법인?: string | null
          공사구분?: string | null
          공사종류?: string | null
          공사현장?: string | null
          작업구분?: string | null
          시공상태?: string | null
          준공여부?: boolean
          정산상태?: string | null
          포장여부?: boolean
          자재청구여부?: boolean
          발주자_id?: number | null
          원청사_id?: number | null
          공사담당?: string | null
          감독자?: string | null
          관리자?: string | null
          관리자_연락처?: string | null
          수주금액_공급가?: number | null
          착공일?: string | null
          준공일?: string | null
          준공액_공급가?: number | null
          달성율?: number | null
          보험료율?: number | null
          하도전용율?: number | null
          참고사항?: string | null
          생성자?: string | null
          생성일?: string
          수정자?: string | null
          수정일?: string | null
        }
      }
      기성: {
        Row: {
          id: number
          수주_id: number
          차수: number
          기성일: string | null
          기성액_공급가: number | null
          생성자: string | null
          생성일: string
        }
        Insert: {
          id?: number
          수주_id: number
          차수: number
          기성일?: string | null
          기성액_공급가?: number | null
          생성자?: string | null
          생성일?: string
        }
        Update: {
          id?: number
          수주_id?: number
          차수?: number
          기성일?: string | null
          기성액_공급가?: number | null
          생성자?: string | null
          생성일?: string
        }
      }
      투입실적: {
        Row: {
          id: number
          수주_id: number
          투입일: string
          상용직_주: number
          상용직_야: number
          일용직_주: number
          일용직_야: number
          모범신호수_주: number
          모범신호수_야: number
          w6_주: number
          w6_야: number
          w3_주: number
          w3_야: number
          덤프15t_주: number
          덤프15t_야: number
          크레인_주: number
          크레인_야: number
          물청소차_주: number
          물청소차_야: number
          mcm_주: number
          mcm_야: number
          재료비인_주: number
          재료비인_야: number
          접속_주: number
          접속_야: number
          외주1: number
          외주2: number
          생성자: string | null
          생성일: string
          수정자: string | null
          수정일: string | null
        }
        Insert: {
          id?: number
          수주_id: number
          투입일: string
          상용직_주?: number
          상용직_야?: number
          일용직_주?: number
          일용직_야?: number
          모범신호수_주?: number
          모범신호수_야?: number
          w6_주?: number
          w6_야?: number
          w3_주?: number
          w3_야?: number
          덤프15t_주?: number
          덤프15t_야?: number
          크레인_주?: number
          크레인_야?: number
          물청소차_주?: number
          물청소차_야?: number
          mcm_주?: number
          mcm_야?: number
          재료비인_주?: number
          재료비인_야?: number
          접속_주?: number
          접속_야?: number
          외주1?: number
          외주2?: number
          생성자?: string | null
          생성일?: string
          수정자?: string | null
          수정일?: string | null
        }
        Update: {
          id?: number
          수주_id?: number
          투입일?: string
          상용직_주?: number
          상용직_야?: number
          일용직_주?: number
          일용직_야?: number
          모범신호수_주?: number
          모범신호수_야?: number
          w6_주?: number
          w6_야?: number
          w3_주?: number
          w3_야?: number
          덤프15t_주?: number
          덤프15t_야?: number
          크레인_주?: number
          크레인_야?: number
          물청소차_주?: number
          물청소차_야?: number
          mcm_주?: number
          mcm_야?: number
          재료비인_주?: number
          재료비인_야?: number
          접속_주?: number
          접속_야?: number
          외주1?: number
          외주2?: number
          생성자?: string | null
          생성일?: string
          수정자?: string | null
          수정일?: string | null
        }
      }
      시스템설정: {
        Row: {
          키: string
          값: string
          설명: string | null
        }
        Insert: {
          키: string
          값: string
          설명?: string | null
        }
        Update: {
          키?: string
          값?: string
          설명?: string | null
        }
      }
      계획금액: {
        Row: {
          년월: string       // 'YYYY-MM' 형식, PK
          금액: number
          입력자: string | null
          생성일: string
        }
        Insert: {
          년월: string
          금액: number
          입력자?: string | null
          생성일?: string
        }
        Update: {
          년월?: string
          금액?: number
          입력자?: string | null
          생성일?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// 각 테이블의 Row 타입 — 컴포넌트에서 편하게 import해서 쓸 수 있도록 re-export
export type 사용자Row      = Database['public']['Tables']['사용자']['Row']
export type 거래처Row      = Database['public']['Tables']['거래처']['Row']
export type 공사단가Row    = Database['public']['Tables']['공사단가']['Row']
export type 수주Row        = Database['public']['Tables']['수주']['Row']
export type 기성Row        = Database['public']['Tables']['기성']['Row']
export type 투입실적Row    = Database['public']['Tables']['투입실적']['Row']
export type 시스템설정Row  = Database['public']['Tables']['시스템설정']['Row']
export type 계획금액Row    = Database['public']['Tables']['계획금액']['Row']

// Insert 타입 re-export
export type 사용자Insert   = Database['public']['Tables']['사용자']['Insert']
export type 거래처Insert   = Database['public']['Tables']['거래처']['Insert']
export type 공사단가Insert = Database['public']['Tables']['공사단가']['Insert']
export type 수주Insert     = Database['public']['Tables']['수주']['Insert']
export type 기성Insert     = Database['public']['Tables']['기성']['Insert']
export type 투입실적Insert = Database['public']['Tables']['투입실적']['Insert']

// Update 타입 re-export
export type 수주Update     = Database['public']['Tables']['수주']['Update']
export type 투입실적Update = Database['public']['Tables']['투입실적']['Update']

// 투입구분 enum — 공사단가.투입구분, 투입실적 컬럼 매핑에 사용
export const 투입구분목록 = [
  '상용직', '일용직', '모범신호수',
  '6W', '3W', '덤프15T', '크레인', '물청소차', 'MCM',
  '재료비/인', '접속', '기타',
] as const
export type 투입구분타입 = (typeof 투입구분목록)[number]
