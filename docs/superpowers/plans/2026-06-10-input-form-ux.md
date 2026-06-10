# 투입실적 입력 UI/UX 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `InputForm.tsx` 한 파일에서 Tailwind 클래스만 수정해 레이아웃 압축, 입력 필드 시인성, 행 가독성을 개선한다.

**Architecture:** 순수 스타일 변경. 로직·API·타입 변경 없음. 3개 독립 태스크(레이아웃 / 인풋 스타일 / 행 스타일)로 분리해 각각 커밋한다.

**Tech Stack:** Next.js, Tailwind CSS v3, React Hook Form

---

## File Map

| 파일 | 역할 |
|------|------|
| `src/app/(dashboard)/input/_components/InputForm.tsx` | 수정 대상 (유일) |

---

### Task 1: 폼 전체 max-width 제한 및 중앙 정렬

**Files:**
- Modify: `src/app/(dashboard)/input/_components/InputForm.tsx:300`

- [ ] **Step 1: 변경 전 코드 확인**

  `InputForm.tsx` 300번 줄:
  ```tsx
  <div className="flex flex-col lg:flex-row lg:items-start gap-5">
  ```

- [ ] **Step 2: max-width 클래스 추가**

  아래와 같이 수정한다:
  ```tsx
  <div className="flex flex-col lg:flex-row lg:items-start gap-5 max-w-2xl mx-auto w-full">
  ```

- [ ] **Step 3: 개발 서버 실행 후 시각 확인**

  ```bash
  npm run dev
  ```

  브라우저에서 `/input` 페이지 열기. 확인 항목:
  - 넓은 화면(1440px+)에서 폼이 672px로 제한되어 중앙에 위치하는지
  - lg 미만 화면에서 세로 스택이 정상 유지되는지

- [ ] **Step 4: 커밋**

  ```bash
  git add src/app/\(dashboard\)/input/_components/InputForm.tsx
  git commit -m "style: 투입실적 입력 폼 max-w-2xl 중앙 정렬"
  ```

---

### Task 2: 입력 필드(Input Box) 크기·테두리·포커스 강화

**Files:**
- Modify: `src/app/(dashboard)/input/_components/InputForm.tsx:407-432`

테이블 안에 주간/야간 입력 필드가 각각 하나씩, 총 2곳 있다. 두 곳 모두 동일하게 수정한다.

- [ ] **Step 1: 주간 입력 필드 수정 (407~419줄)**

  현재:
  ```tsx
  className={cn(
    'w-20 h-9 text-center rounded-md border text-sm tabular-nums outline-none transition-colors',
    'border-gray-200 bg-white focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af1]/20',
    주값 > 0 && 'border-blue-300 bg-blue-50/60 font-semibold text-blue-700',
  )}
  ```

  변경 후:
  ```tsx
  className={cn(
    'w-[68px] h-10 text-center rounded-md border text-sm tabular-nums outline-none transition-colors',
    'border-gray-400 bg-white focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af1]/40',
    주값 > 0 && 'border-blue-300 bg-blue-50/60 font-semibold text-blue-700',
  )}
  ```

- [ ] **Step 2: 야간 입력 필드 수정 (421~432줄)**

  현재:
  ```tsx
  className={cn(
    'w-20 h-9 text-center rounded-md border text-sm tabular-nums outline-none transition-colors',
    'border-gray-200 bg-white focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af1]/20',
    야값 > 0 && 'border-indigo-300 bg-indigo-50/60 font-semibold text-indigo-700',
  )}
  ```

  변경 후:
  ```tsx
  className={cn(
    'w-[68px] h-10 text-center rounded-md border text-sm tabular-nums outline-none transition-colors',
    'border-gray-400 bg-white focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af1]/40',
    야값 > 0 && 'border-indigo-300 bg-indigo-50/60 font-semibold text-indigo-700',
  )}
  ```

- [ ] **Step 3: 시각 확인**

  브라우저에서 `/input` 페이지 확인:
  - 빈 인풋에 회색 테두리가 뚜렷하게 보이는지 (기존보다 진한 회색)
  - 탭/클릭 시 파란 포커스 링이 기존보다 선명하게 나타나는지
  - 값 입력 후 파란/인디고 강조가 유지되는지

- [ ] **Step 4: 커밋**

  ```bash
  git add src/app/\(dashboard\)/input/_components/InputForm.tsx
  git commit -m "style: 투입실적 입력 인풋 크기·테두리·포커스 강화"
  ```

---

### Task 3: 테이블 행 지브라 패턴 + 호버 하이라이트

**Files:**
- Modify: `src/app/(dashboard)/input/_components/InputForm.tsx:392,399-404`

- [ ] **Step 1: tbody 구분선 강화 (392줄)**

  현재:
  ```tsx
  <tbody className="divide-y divide-gray-50">
  ```

  변경 후:
  ```tsx
  <tbody className="divide-y divide-gray-100">
  ```

- [ ] **Step 2: tr 행 스타일에 지브라 + 호버 추가 (399~404줄)**

  현재:
  ```tsx
  <tr
    key={label}
    className={cn(
      'hover:bg-slate-50/60 transition-colors',
      isEmpty && 'opacity-35',
    )}
  >
  ```

  변경 후:
  ```tsx
  <tr
    key={label}
    className={cn(
      'even:bg-blue-50/40 hover:bg-blue-100/50 transition-colors',
      isEmpty && 'opacity-35',
    )}
  >
  ```

- [ ] **Step 3: 시각 확인**

  브라우저에서 `/input` 페이지 확인:
  - 짝수 행(2,4,6,8,10번째)에 연한 파란 배경이 보이는지
  - 마우스를 올리면 해당 행 전체가 더 진한 파란색으로 강조되는지
  - 0값 행(흐리게 처리된 행)에도 지브라/호버가 적용되는지

- [ ] **Step 4: 커밋**

  ```bash
  git add src/app/\(dashboard\)/input/_components/InputForm.tsx
  git commit -m "style: 투입실적 테이블 행 지브라+호버 가독성 개선"
  ```

---

## 완료 기준

- `/input` 페이지에서 폼이 넓은 화면에서도 좌우 여백을 두고 중앙에 배치됨
- 빈 인풋에도 테두리가 뚜렷하게 보이고, 클릭 시 파란 포커스 링이 명확히 표시됨
- 짝수 행 연한 파란 배경 + 마우스 호버 시 진한 파란 하이라이트 동작
