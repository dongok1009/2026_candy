<!-- RCI/TRIX 이식 작업 체크리스트 -->
# RCI/TRIX 이식 체크리스트

## 1단계 — 지표 계산
- [x] `lib/indicators.cjs`에 `realignTo` 헬퍼 추가 (중첩 EMA null 정렬)
- [x] `lib/indicators.cjs`에 `calculateRCI(closes, p)` 추가
- [x] `lib/indicators.cjs`에 `calculateTRIX(closes, p, signalPeriod)` 추가
- [x] exports에 두 함수 반영
- [x] `src/shared/utils/indicatorUtils.js`에 동일 함수 추가 (차트용)
- [x] 검증: RCI 값이 −100~+100 범위, 단조 상승 구간에서 +100 근접
- [x] 검증: TRIX 시그널선 길이가 trix 배열과 정렬됨
- [x] 커밋 (`7a03417`)

## 2단계 — 전략 + 엔진
- [x] `strategies/Logic.v8.2.6.cjs` → `Logic.v8.2.7.cjs` 복사 (원본 수정 금지)
- [x] v8.2.7의 `name`/`description` 갱신
- [x] `indicators_logic`에 rci9/rci26/trix/trix_sig 계산 추가
- [x] 룰별 가변 TRIX 시그널 기간 지원 (`trix_sig_{n}`)
- [x] `signal_logic`에 RCI 교차 필터 추가 (기본 OFF)
- [x] `signal_logic`에 TRIX 교차 필터 추가 (기본 OFF)
- [x] **WHAT-IF·MA_SLOPE_ALIGN 코드 무변경 확인**
- [x] `lib/engine.cjs` 지표 보장 블록에 rci9/rci26/trix/trix_sig 추가
- [x] `lib/engine.cjs` tradeData에 12개 필드 추가 (m5/h1/d1 × rci9/rci26/trix/trix_sig)
- [x] `lib/engine.cjs` CSV 헤더 + 행에 12개 컬럼 추가
- [x] **검증(필수): 필터 OFF 시 v8.2.6과 ROI·승패·MDD 완전 일치**
- [x] 검증: 필터 ON 시 거래 수 감소
- [x] 커밋 (`63a7e76`)

## 3단계 — 설정 배선
- [x] `lib/rules_helper.cjs`에 `USE_RCI_CROSS`/`USE_TRIX_CROSS`/`TRIX_SIGNAL_PERIOD` 파싱 추가
- [x] 동일 키를 write-back(`syncRulesToEnv`) 및 legacy 정리 목록에 추가
- [x] **기존 MA_SLOPE_ALIGN·WHAT_IF 파싱 무변경 확인**
- [x] `src/shared/config/strategyConfigs.js`에 Logic.v8.2.7 등록 (신규 필드 기본 false/9)
- [x] 검증: env 재현 파일로 `buildRulesFromEnv` 호출 시 신규 키가 false/9로 파싱됨
- [x] 커밋 (`f887343`)

## 4단계 — 백테스트 UI
- [x] `BacktestForm.jsx` 룰 편집 영역에 RCI Cross 체크박스 추가
- [x] `BacktestForm.jsx` 룰 편집 영역에 TRIX Cross 체크박스 + 시그널 기간 입력 추가
- [x] `BacktestForm.jsx` 거래 로그 표에 12개 컬럼 추가
- [x] 커밋 (`05d7366`)

## 5단계 — 라이브 대시보드 (백테스트 채택 조건을 실전 전 육안 검증하기 위함)
- [x] `PriceChart.jsx`에 RCI 패널 추가 (RCI9/RCI26 라인, ±80 기준선)
- [x] `PriceChart.jsx`에 TRIX 패널 추가 (TRIX/시그널 라인, 0 기준선)
- [x] 차트 동기화(crosshair·시간축) 목록에 신규 차트 2개 반영
- [x] 4개 데이터 경로 모두에 지표 배선 (최초 로드 / 과거 추가로드 / 실시간 / 검사시점)
- [x] **`evaluateSignal`에 RCI·TRIX 교차 필터 추가 (Logic.v8.2.7과 동일 판정)**
- [x] `SignalSettings.jsx`에 RCI/TRIX 체크박스 추가 (라이브 화면에서 필터를 켤 수단)
- [x] 검증: `npm run build` 통과, eslint 신규 경고 없음
- [x] 검증: 대시보드 3개 TF 모두 패널 렌더 및 값 표시 (RCI −100~+100, TRIX 소수 4자리)
- [x] 검증: 필터 ON 시 라이브 시그널 판정이 실제로 달라짐
      (1d RCI9 40.00 < RCI26 63.49 상태에서 LONG RCI Cross ON → 테두리 초록(LONG)→노랑(HOLDING))
- [x] 검증: 체크박스 → `.env`/`live_rules.json` 저장 및 새로고침 후 복원까지 왕복 확인
- [ ] 커밋

## 6단계 — 마무리
- [ ] 컨텍스트 노트 최종 갱신
- [ ] `main` 병합 및 푸시
- [ ] 구 저장소(`candy_claude_2026`) 삭제 가능 여부 최종 확인
