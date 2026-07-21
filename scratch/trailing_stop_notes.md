<!-- 트레일링 스탑 구현 중 내린 결정과 근거 -->
# 트레일링 스탑 컨텍스트 노트

## 청산 로직 위치
청산은 전략 파일이 아니라 **`lib/engine.cjs`의 1분봉 순회 루프**에 있다.
따라서 트레일링은 엔진 레벨이며 모든 전략 버전에 공통 적용된다.
새 전략 파일(Logic.v8.2.8 등)은 만들지 않는다. `config.useTrailingStop`가
falsy면 기존 TP/SL 그대로 동작하므로 기본 OFF는 자동으로 보장된다.

## 트레일링 스탑 의미 정의

전역 청산 설정 두 개.
- `useTrailingStop` (bool) — TP 대신 트레일링 사용
- `trailStopPct` (가격 분수, 예 0.01 = 고점 대비 1% 하락) — **가격 기준, 레버리지 미적용**

동작 (롱 기준, 숏은 대칭).
- 활성화 트리거 = 기존 tpPrice (1차 목표가). LONG: high ≥ tpPrice에서 활성화.
- **활성화 전**: 기존 SL 그대로. low ≤ slPrice면 SL 청산.
- **활성화 후**: peak 추적(LONG=최고 high). trailStop = peak − trailDist.
  low ≤ trailStop이면 `TRAIL` 청산. 활성화 후에는 고정 SL을 적용하지 않는다
  (트레일링이 청산을 전담 — 사용자 표현 "트레일링 스탑이 실행되고").

### [변경] trailStopPct를 가격 기준 → 레버리지 반영 ROI 기준으로 전환
초기엔 가격 기준(peak × (1 − pct))이었으나, 사용자 요청으로 **레버리지 반영
수익률 기준**으로 바꿨다. ROI X% 되돌림 = 가격으로 entry × X / leverage 만큼 되돌림.
→ `trailDist = entryPrice × trailStopPct / LEVERAGE` (진입 시 1회 계산),
   trailStop = peak ∓ trailDist. targetRoi·slRoi와 동일한 ROI↔가격 환산이라 일관적이다.
거리를 peak가 아닌 **진입가 기준 절대 거리**로 두는 이유: ROI는 진입가 기준으로
정의되므로 "고점 ROI 대비 X%p 하락"은 정확히 entry×X/lev 가격 거리가 된다.
기본값도 0.01(가격 1%)에서 0.05(ROI 5%)로 상향 — ROI 기준에선 1%가 지나치게 타이트.

### 봉 내부 순서 (1분봉 한계)
1분봉은 OHLC만 있어 고가·저가 발생 순서를 모른다. 트레일링에서는
**고가로 peak를 먼저 갱신한 뒤 저가로 trailStop을 체크**한다.
→ trailStop이 더 높아져 청산이 더 쉽게 걸리므로 약간 비관적(보수적).
백테스트가 실제보다 이익을 과대평가하지 않게 하는 안전한 방향이다.

같은 봉에서 활성화와 트레일 청산이 동시에 가능하다(급등 후 반전).
활성화 봉에서 활성화는 SL보다 우선한다(기존 TP 우선 편향과 일관).

### 수수료·수익률
`TRAIL` 청산은 스탑-시장가 주문이므로 taker 수수료(SL과 동일).
exitPrice = trailStop, 순ROI는 TIMEOUT처럼 시장가 차익으로 계산.

### 기존 기능과의 상호작용
- SWITCHING·TIMEOUT은 여전히 우선(먼저 exitReason 설정).
- 동적 TP 하향(reduceTpWaitMin)은 tpPrice를 낮추는데, 트레일링에서는
  그 tpPrice가 활성화 트리거이므로 대기 후 활성화가 쉬워진다. 의도된 동작으로 두되 문서화.

## 실전 봇 (Bybit) 매핑
봇은 봉을 순회하지 않고 진입 시 거래소에 TP/SL을 걸어 둔다.
Bybit v5 네이티브 트레일링 스탑으로 매핑.
- `activePrice` = tpPrice (활성화 가격)
- `trailingStop` = tpPrice × trailStopPct (**절대 가격 거리**)
  Bybit는 % 아닌 절대 거리를 받으므로 "고점 대비 %"의 근사다.
- `stopLoss` = slPrice 유지 (활성화 전 손절 + 활성화 후엔 사실상 무의미하나 안전판)

**검증 한계**: 에이전트는 금융 거래 실행이 금지되어 거래소 실주문으로
검증할 수 없다. 코드만 작성하고, 테스트넷/실계좌 검증은 사용자가 수행한다.

## 검증 계획 (백테스트)
- OFF → 기존 결과와 ROI·승패·MDD 완전 일치 (회귀)
- 상승 지속 거래 → TP보다 높은 가격에 청산 (이익 ≥ 기존 TP)
- 활성화 직후 반전 → 고점 근처 청산
- 목표 미달 하락 → SL (기존과 동일)
