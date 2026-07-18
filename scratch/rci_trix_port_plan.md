<!-- RCI/TRIX 지표를 실전 저장소로 이식하는 작업 계획 -->
# RCI/TRIX 이식 계획 (candy_claude_2026 → 2026_candy)

## 배경

2026-07-18, 폐기된 분기 `candy_claude_2026`에서 RCI/TRIX 지표와 진입 필터를 구현하고
백테스트 탐색까지 마쳤으나, 그 저장소에는 **WHAT-IF 동적 필터와 MA_SLOPE_ALIGN 파싱이 없어**
실전과 조건이 달랐다. 따라서 당시의 "채택 안 함" 결론은 무효다.

실전 저장소(`2026_candy`)로 이식해 **같은 조건에서 다시 검증**하는 것이 이 작업의 목적이다.
채택 여부는 검증 후 사용자가 결정한다.

## 무엇을 만드는가

| 구분 | 내용 |
|---|---|
| 지표 | RCI(스피어만 순위상관, 9/26 이중), TRIX(삼중 EMA 변화율 + 시그널선) |
| 진입 필터 | RCI 교차(롱 RCI9>RCI26 / 숏 반대), TRIX 시그널선 교차 |
| 표시 | 대시보드 차트 패널 2개, 백테스트 거래 로그 컬럼 12개 |
| 설정 | `.env` 키 + 대시보드 체크박스 |

## 두 저장소의 구조 차이 (이식 난이도)

| 파일 | 구 저장소 | 신 저장소 | 이식 방식 |
|---|---|---|---|
| `lib/indicators.cjs` | 있음 | 있음 | 함수 추가 (단순) |
| `lib/engine.cjs` | 있음 | 있음 + WHAT-IF | 지표 보장·로그 컬럼 추가, **WHAT-IF 보존** |
| `lib/rules_helper.cjs` | 있음 | 있음 + MA_SLOPE_ALIGN·WHAT_IF | 키 추가, **기존 파싱 보존** |
| 전략 | `CC.v0.2.0.cjs` | `Logic.v8.2.6.cjs` | **신규 `Logic.v8.2.7.cjs`** 로 복사 후 추가 |
| 룰 편집 UI | `RulesEditor.jsx` (분해됨) | `BacktestForm.jsx` 1,917줄 monolith | **적응 필요** |
| 거래 로그 표 | `TradeLogTable.jsx` | 동일 monolith 내부 | **적응 필요** |
| `rulesNormalizer.js` | 있음 | **없음** | 신 저장소 방식에 맞춰 처리 |
| `exportUtils.js` | 있음 | **없음** | 동일 |
| 차트 | `PriceChart.jsx` 인라인 패널 | 동일 방식 | 유사 이식 |

## 절대 지켜야 할 것

1. **기존 전략 파일(`Logic.v8.2.6.cjs`)을 수정하지 않는다.** 새 번호로 복사한다.
2. **WHAT-IF와 MA_SLOPE_ALIGN 관련 코드를 건드리지 않는다.** 오늘 이미 한 번 사고가 났다.
3. **신규 필터의 기본값은 OFF.** 켜지 않으면 v8.2.6과 결과가 완전히 같아야 한다.
4. `bybit_trader.cjs`는 이번 작업에서 **건드리지 않는다.** (실전 봇 영향 배제)

## 성공 기준

- 필터 OFF 시 `Logic.v8.2.7` 백테스트 결과가 `Logic.v8.2.6`과 **ROI·승패·MDD 완전 일치**
- 필터 ON 시 거래 수가 감소하고 로그에 RCI/TRIX 값이 기록됨
- `npm run build` 통과, 대시보드에 RCI/TRIX 패널 렌더
- 기존 WHAT-IF·MA_SLOPE_ALIGN 동작 불변

## 단계

1. **지표 계산** — `lib/indicators.cjs`, `src/shared/utils/indicatorUtils.js`
2. **전략 + 엔진** — `strategies/Logic.v8.2.7.cjs` 신설, 엔진 지표 보장·로그 컬럼
3. **설정 배선** — `lib/rules_helper.cjs` env 파싱, `strategyConfigs.js` 등록
4. **UI** — 차트 패널, 룰 체크박스, 거래 로그 컬럼
5. **검증** — 동등성 테스트, 필터 동작 확인, 빌드

각 단계마다 커밋한다. 단계 2 완료 시점에 동등성 검증을 통과하지 못하면 다음으로 넘어가지 않는다.
