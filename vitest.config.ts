import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    // tsconfig의 "@/*" → "src/*" 를 vitest에도 알려준다.
    // 없으면 @/ 를 쓰는 모듈은 테스트에서 "Cannot find package" 로 죽는다.
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
