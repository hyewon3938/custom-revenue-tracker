# 코드 컨벤션

3~5인 소규모 팀 기준으로, 이 프로젝트의 코드를 일관되게 유지하기 위한 규칙입니다.

---

## 1. 아키텍처 원칙

### 레이어 분리

```
┌─────────────────────────────────────────────────┐
│  UI Layer (components/, app/page.tsx)            │  ← React 컴포넌트, 사용자 인터랙션
├─────────────────────────────────────────────────┤
│  API Layer (app/api/*/route.ts)                  │  ← HTTP 요청/응답, 입력 검증
├─────────────────────────────────────────────────┤
│  Business Logic (lib/calculations/, lib/ai/)     │  ← 순수 함수, I/O 없음
├─────────────────────────────────────────────────┤
│  Data Layer (lib/storage/, lib/scrapers/)         │  ← 파일 I/O, 외부 API, 웹 수집
├─────────────────────────────────────────────────┤
│  Foundation (lib/types/, lib/config.ts, lib/utils/) │  ← 타입, 상수, 유틸리티
└─────────────────────────────────────────────────┘
```

**규칙:**
- 상위 레이어는 하위 레이어를 호출할 수 있지만, 역방향 호출은 금지
- `calculations/`은 절대 `storage/`를 직접 호출하지 않음 (API 레이어가 중개)
- 컴포넌트는 `fetch()`로 API를 호출하고, `storage`를 직접 import하지 않음

### 단일 책임

| 디렉터리 | 책임 | 금지 사항 |
|----------|------|----------|
| `lib/types/` | 타입 정의 | 로직, 런타임 코드 |
| `lib/config.ts` | 환경변수 읽기, 상수 | 비즈니스 로직 |
| `lib/calculations/` | 데이터 변환, 계산 | I/O, API 호출 |
| `lib/storage/` | 파일 읽기/쓰기 | 계산 로직 |
| `lib/scrapers/` | 웹 수집 | 데이터 저장 |
| `app/api/` | 요청 라우팅, 검증 | 직접 계산 |

---

## 2. 타입 시스템

### 엄격한 타입 안전성

- `tsconfig.json`에 `strict: true` 유지
- `any` 사용 금지 — `unknown`으로 받아서 타입 가드로 좁히기
- 모든 공개 인터페이스는 `src/lib/types/index.ts`에 정의

```typescript
// ✅ 좋은 예
function parseResponse(data: unknown): MonthlyReport {
  if (!isMonthlyReport(data)) throw new Error("잘못된 형식");
  return data;
}

// ❌ 나쁜 예
function parseResponse(data: any): MonthlyReport {
  return data as MonthlyReport;
}
```

### 타입 정의 위치

| 범위 | 위치 |
|------|------|
| 여러 파일에서 사용 | `lib/types/index.ts` |
| 컴포넌트 props | 해당 컴포넌트 파일 상단 |
| API 요청/응답 전용 | 해당 route.ts 파일 내 |

---

## 3. 네이밍 컨벤션

### 파일명

| 종류 | 규칙 | 예시 |
|------|------|------|
| 모듈/유틸 | kebab-case | `report-store.ts`, `deep-merge.ts` |
| React 컴포넌트 | PascalCase | `EditableField.tsx`, `VenueModal.tsx` |
| 스크립트 | 동사-명사 kebab-case | `collect-naver.ts`, `preview-prompt.ts` |
| 테스트 | 원본명 + `.test` | `profit.test.ts`, `format.test.ts` |

### 변수/함수

```typescript
// 함수: 동사로 시작
const calculateProfit = () => {};
const formatKRW = () => {};
const loadReport = async () => {};

// boolean: is/has/should 접두사
const isCurrentMonth = true;
const hasShippingStats = false;

// 상수: UPPER_SNAKE_CASE
const MAX_VERSIONS = 5;
const NAVER_SHIPPING_FEE = 3000;

// 타입/인터페이스: PascalCase
interface PlatformFees {}
type ProductCategory = "handmade" | "other";
```

---

## 4. 함수 설계

### 순수 함수 우선

`lib/calculations/` 아래 함수는 반드시 순수 함수로 작성합니다.

```typescript
// ✅ 순수 함수: 같은 입력 → 항상 같은 출력, 부작용 없음
function calcPlatformProfit(
  revenue: number,
  fees: PlatformFees,
  materialBase: number,
  materialRate: number
): PlatformProfit {
  const profit = revenue - fees.commissionFee - fees.logisticsFee - fees.adFee;
  const materialCost = Math.round(materialBase * materialRate);
  return { profit, materialCost, netProfit: profit - materialCost };
}

// ❌ 순수 함수 안에서 I/O 금지
function calcProfit(year: number, month: number) {
  const report = fs.readFileSync(`data/${year}-${month}.json`); // I/O 금지
  return calculate(report);
}
```

### 함수 크기

- 한 함수는 **하나의 작업**만 수행
- 30줄을 넘기면 분리를 고려
- 중첩이 3단계를 넘기면 헬퍼 함수로 추출

---

## 5. 에러 처리

### API 라우트

모든 API 라우트는 `getErrorMessage` 유틸을 사용합니다.

```typescript
import { getErrorMessage } from "@/lib/utils/error";

export async function PATCH(req: Request) {
  try {
    const result = await updateReport(year, month, updates);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[report/PATCH]", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "수정 실패") },
      { status: 500 }
    );
  }
}
```

### 스크레이퍼

`withRetry` 래퍼를 사용하여 재시도 + 폴백 처리합니다. 스크레이퍼 실패는 전체 수집을 중단하지 않고 경고(`ScrapeWarning`)로 수집합니다.

---

## 6. 컴포넌트 규칙

### 구조

```typescript
"use client"; // 필요한 경우에만

// 1) import (외부 라이브러리 → 내부 모듈 → 상대 경로)
import { useState, useMemo } from "react";
import { MonthlyReport } from "@/lib/types";
import { formatKRW } from "@/lib/utils/format";

// 2) Props 인터페이스
interface Props {
  report: MonthlyReport;
  onSave: (data: Partial<MonthlyReport>) => Promise<void>;
}

// 3) 컴포넌트
export default function DashboardCard({ report, onSave }: Props) {
  // 상태 선언
  // 이벤트 핸들러
  // useMemo/useCallback (비용이 큰 계산만)
  // JSX 반환
}
```

### 상태 관리

- 서버 데이터: `fetch` + `useState` (이 프로젝트 규모에서 충분)
- UI 상태: 컴포넌트 로컬 `useState`
- 전역 상태 라이브러리: 현재 불필요 (도입 시 근거 필요)

---

## 7. 주석

### 언제 쓰는가

```typescript
// ✅ "왜" 이렇게 했는지 (의도)
// 정산금은 순수입이 아니라 네이버가 판매자에게 지급하는 금액이므로 비용에서 제외
const profit = revenue - commissionFee - logisticsFee;

// ✅ 복잡한 비즈니스 규칙
// 협찬 리뷰의 판매 전환 효과는 1~2개월 뒤에 나타남 → 전달 협찬 상품의 당월 판매 추적
```

### 언제 쓰지 않는가

```typescript
// ❌ 코드가 이미 말하고 있는 것
// 매출을 포맷한다
const formatted = formatKRW(revenue);

// ❌ 이름으로 충분한 것
// 보고서를 로드한다
const report = await loadReport(year, month);
```

### 섹션 구분

파일 내 논리적 구역은 구분선으로 나눕니다.

```typescript
// ─── 헬퍼 함수 ─────────────────────────────────────────────────
// ─── 프롬프트 빌더 ──────────────────────────────────────────────
// ─── 메인 함수 ─────────────────────────────────────────────────
```

---

## 8. 환경변수와 상수

### 규칙

- 모든 `process.env` 접근은 `lib/config.ts` 한 곳에서만
- 비즈니스 상수도 `config.ts`에서 관리 (매직 넘버 금지)
- 기본값이 있는 설정은 `envInt(key, fallback)` 패턴 사용

```typescript
// ✅ config.ts에서 가져오기
import { ONLINE_MATERIAL_RATE } from "@/lib/config";

// ❌ 직접 접근 금지
const rate = parseFloat(process.env.ONLINE_MATERIAL_RATE!);
```

### 기본 상수 (defaults)

여러 곳에서 사용하는 기본값은 `lib/constants.ts`에 정의합니다.

```typescript
// lib/constants.ts
export const EMPTY_FEES: PlatformFees = {
  settlementAmount: 0,
  commissionFee: 0,
  logisticsFee: 0,
  shippingFee: 0,
  adFee: 0,
};
```

---

## 9. 테스트

### 도구

- **Vitest** — TypeScript + ESM + path alias(`@/*`) 네이티브 지원
- 테스트 파일: 원본과 같은 디렉터리에 `*.test.ts`로 배치

### 테스트 대상 우선순위

| 우선순위 | 대상 | 이유 |
|----------|------|------|
| 높음 | `lib/calculations/` (profit, ranking, product, overview) | 순수 함수, 금액 계산이라 정확성 필수 |
| 높음 | `lib/utils/` (format, deep-merge) | 유틸리티는 전체에 영향 |
| 중간 | `lib/storage/` (report-store) | 파생 필드 재계산 로직 |
| 낮음 | `lib/scrapers/` | 외부 의존성(브라우저)이 커서 단위 테스트 어려움 |
| 낮음 | 컴포넌트 | 이 프로젝트 규모에서 E2E보다 수동 확인이 효율적 |

### 테스트 작성 패턴

```typescript
import { describe, test, expect } from "vitest";
import { calcPlatformProfit } from "./profit";

describe("calcPlatformProfit", () => {
  test("매출에서 수수료와 물류비를 차감한다", () => {
    const result = calcPlatformProfit(100_000, fees, 85_000, 0.15);
    expect(result.profit).toBe(expectedProfit);
  });

  test("매출이 0이면 모든 값이 0이다", () => {
    const result = calcPlatformProfit(0, emptyFees, 0, 0.15);
    expect(result.netProfit).toBe(0);
  });
});
```

---

## 10. 커밋 컨벤션

### 메시지 형식

```
<type>: <설명>

<본문 (선택)>
```

### 타입

| 타입 | 용도 | 예시 |
|------|------|------|
| `feat` | 새 기능 | `feat: 마케팅 비용 차트 추가` |
| `fix` | 버그 수정 | `fix: 네이버 정산 날짜 검증 오류` |
| `refactor` | 동작 변경 없는 코드 개선 | `refactor: API 에러 처리 유틸 통합` |
| `test` | 테스트 추가/수정 | `test: 이익 계산 단위 테스트` |
| `chore` | 설정, 의존성 | `chore: Vitest 설정` |
| `docs` | 문서 | `docs: 코드 컨벤션 문서 작성` |
| `style` | 포맷, CSS | `style: 디자인 시스템 변수 정리` |

### 언어 규칙

- **한글로 작성** (한자어 금지: 分析 → 분석)
- 현재형 사용: "추가했다" 대신 "추가"
- 50자 이내로 요약

### 보안 규칙 (필수)

커밋 메시지와 PR 본문에 아래 내용이 포함되지 않도록 합니다:

- ❌ 실제 매출/수익 금액 (`매출 842,600원`)
- ❌ API 키, 토큰, 비밀번호
- ❌ 개인 식별 정보 (주소, 전화번호 등)
- ❌ `.env.local`에 있는 값

```
// ❌ 나쁜 커밋 메시지
fix: 2월 매출 842,600원 계산 오류 수정

// ✅ 좋은 커밋 메시지
fix: 월별 매출 합산 계산 오류 수정
```

PR 본문도 동일합니다. 테스트 결과를 보여줄 때 실제 데이터 대신 "테스트 통과 확인" 등 결과만 기재합니다.

---

## 11. 코드 품질 유지

### 체크리스트

코드 작성 후 아래를 확인합니다:

- [ ] `npx tsc --noEmit` — 타입 오류 없음
- [ ] `npx vitest run` — 테스트 통과
- [ ] `any` 사용하지 않았는가
- [ ] 매직 넘버를 상수로 추출했는가
- [ ] 새 함수에 적절한 주석(의도)이 있는가
- [ ] 중복 코드가 없는가 (기존 유틸 확인)
- [ ] 커밋 메시지에 민감 데이터가 없는가

### 새 기능 추가 시 흐름

```
1. 타입 정의 (lib/types/)
2. 순수 함수 구현 (lib/calculations/)
3. 테스트 작성 및 통과 확인
4. 저장소/API 연결 (lib/storage/ → app/api/)
5. UI 구현 (components/)
6. 타입 체크 + 테스트 실행
7. 커밋
```
