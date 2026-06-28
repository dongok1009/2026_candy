<!-- 매매 전략 및 지표 매개변수 가이드 문서 -->
# 🛡️ 2026_CANDY 실전 매매 전략 및 매개변수 가이드 (Strategy Parameters Guide)

본 가이드는 대시보드 UI에 표시되는 설정 항목, 해당 항목의 기능 및 판정 로직, 그리고 이에 매핑되는 환경변수(`.env`) 명세를 상세하게 정리해 둔 참조 문서입니다.

---

## 1. 글로벌 및 청산 매개변수 (Global & Exit Parameters)

이 설정들은 개별 차트의 경계 조건(Chart Border Conditions)을 통제하며, 전체적인 자금 관리와 청산 로직에 적용됩니다.

### 1-1. Target ROI / Stop Loss ROI (목표 수익률 및 최대 손실률)
포지션의 청산 기준선을 설정하는 매개변수입니다.
* **동작 변수**:
  * 익절 타겟: `TARGET_NET_ROI` (대시보드: `Target ROI` - 현재 `0.05` = 5%)
  * 손절 타겟: `SL_ROI` (대시보드: `Stop Loss ROI` - 현재 `0.14` = 14%)
* **진입 제한 및 청산 조건** (`lib/engine.cjs` 및 `bybit_trader.cjs` 기준):
  * 🟢 **익절 청산 조건**: 수수료를 포함한 목표 수익률 `tpPrice`에 도달 시 익절 청산합니다.
    * 롱: `entryPrice * (1 + (TARGET_NET_ROI + fees) / LEVERAGE)`
    * 숏: `entryPrice * (1 - (TARGET_NET_ROI + fees) / LEVERAGE)`
  * 🔴 **손절 청산 조건**: 최대 허용 손실 지점인 `slPrice`에 도달 시 손절 청산합니다.
    * 롱: `entryPrice * (1 - SL_ROI / LEVERAGE)`
    * 숏: `entryPrice * (1 + SL_ROI / LEVERAGE)`

### 1-2. Entry Wait Limit / Exit Wait Limit (대기 및 청산 시간 제한)
신호 발생 후 체결을 대기하거나, 포지션 진입 후 시간 만료 청산을 강제하는 시간 제한 조건입니다.
* **동작 변수**:
  * 진입 대기 제한: `ENTRY_WAIT_MIN` (대시보드: `Entry Wait Limit` - 현재 `180`분)
  * 청산 대기 제한: `EXIT_WAIT_MIN` (대시보드: `Exit Wait Limit` - 현재 `1500`분)
* **작동 조건**:
  * 🟢 **진입 대기**: 신호 감지 분봉 `T` 기준 `ENTRY_WAIT_MIN` 분이 경과하도록 지정 진입가에 체결되지 않으면 대기 주문을 취소합니다.
  * 🔴 **강제 청산 (TIMEOUT)**: 포지션 체결 후 `EXIT_WAIT_MIN` 분이 지나도 익절/손절가에 닿지 못하면 시장가(종가)로 강제 청산합니다.

### 1-3. Reduce TP Wait Time / Reduced Target ROI (동적 목표 수익률 하향)
포지션이 오랫동안 체결 상태로 횡보할 경우 탈출하기 위해 동적으로 타겟을 줄이는 연동 조건입니다.
* **동작 변수**:
  * 익절 하강 대기 시간: `REDUCE_TP_WAIT_MIN` (대시보드: `Reduce TP Wait Time` - 현재 `0`분 = 비활성)
  * 하향 조정 익절 타겟: `REDUCED_TARGET_ROI` (대시보드: `Reduced Target ROI` - 현재 `0.02` = 2%)
* **작동 조건**:
  * 🟢 **목표가 조정**: 포지션 유지 시간(분)이 `REDUCE_TP_WAIT_MIN`에 도달하면, 익절 주문 목표가를 `REDUCED_TARGET_ROI` 기준으로 하향 재조정하여 신속한 익절 탈출을 유도합니다.

### 1-4. Penetration Rate (목표가 돌파 비율 버퍼)
지정가 체결의 확실성을 확보하기 위한 버퍼 조건입니다.
* **동작 변수**:
  * 돌파 비율: `PENETRATION_RATE` (대시보드: `Penetration Rate` - 현재 `0.0005` = 0.05%)
* **작동 조건**:
  * 🟢 **익절 조건 판정**: 단순 익절가 도달이 아닌, `tpPrice * (1 + PENETRATION_RATE)` (숏은 `1 - PENETRATION_RATE`) 지점을 돌파해야 익절로 인정하고 청산합니다.

### 1-5. Entry Mode / Opposite Signal Switching (진입 방식 및 반대신호 스위칭)
진입 가격 산출 방식 및 추세 반전 시 청산 후 즉시 스위칭하는 기능입니다.
* **동작 변수**:
  * 진입 방식 설정: `ENTRY_MODE` (대시보드: `Entry Mode` - 현재 `HYBRID_5M`)
  * 스위칭 여부: `SWITCHING_ENABLED` (대시보드: `Opposite Signal Switching` - 현재 `false`)
* **작동 조건**:
  * 🟢 **진입가 설정**: `HYBRID_5M` 모드일 때 확정 5분봉 기준 유리한 가격을 연산하여 지정가 진입 대기합니다.
  * 🔴 **반대 시그널 감지**: 포지션 보유 중 반대 방향 시그널 확정 시, 즉시 기존 포지션을 시장가 청산하고 반대 포지션으로 신규 진입합니다.

### 1-6. MA Slope 필터 상세 작동 원칙 (글로벌 정렬 필터)
MA Slope로 매매를 제한하는 로직은 글로벌 정렬 필터와 개별 타임프레임 필터 2가지로 나뉩니다.
* **A. 5분봉 MA Slope 방향 필터 (글로벌 정렬 필터)**
  * **동작 변수**: 
    * 활성화 여부: `MA_SLOPE_ALIGN_5M_ENABLED` (대시보드: `MA Slope 5m Filter`)
    * MA 기준 기간: `MA_SLOPE_ALIGN_PERIOD_5M` (대시보드: `MA Slope 5m Period` - 현재 `2`로 설정됨)
  * **진입 제한 조건** (`Logic.v8.2.5.cjs` 기준):
    * 🟢 **LONG 진입 조건**: 5분봉 `2 MA`의 Slope가 **반드시 0보다 커야 함** (Slope <= 0 이면 롱 진입 제한)
    * 🔴 **SHORT 진입 조건**: 5분봉 `2 MA`의 Slope가 **반드시 0보다 작아야 함** (Slope >= 0 이면 숏 진입 제한)
    * *즉, 5분봉 상 해당 단기 이평선이 상승 추세일 때만 롱, 하락 추세일 때만 숏 진입이 허용되는 절대 제한 필터입니다.*
* **B. 기간 5 MA Slope 필터 (5 MA Filter)**
  * **동작 변수** (`rules_helper.cjs` 기준):
    * 활성화 여부: `[TF]_[SIDE]_USE_MA_SLOPE=true` (예: `5M_LONG_USE_MA_SLOPE=true`)
    * MA 기준 기간: `[TF]_[SIDE]_MA_SLOPE_PERIOD=5`
  * **진입 제한 조건** (`Logic.v8.2.5.cjs` 기준):
    * 🟢 **LONG 진입 조건**: 지정한 타임프레임의 `5 MA` Slope가 **0 이상(>= 0)**이어야 함 (0 미만이면 진입 불허)
    * 🔴 **SHORT 진입 조건**: 지정한 타임프레임의 `5 MA` Slope가 **0 미만(< 0)**이어야 함 (0 이상이면 진입 불허)
* **MA Slope 1h Filter 및 Period** (`MA_SLOPE_ALIGN_1H_ENABLED`, `MA_SLOPE_ALIGN_PERIOD_1H`) 도 위와 대칭적인 조건으로 동작합니다. (현재 `false` 상태)

---

## 2. 타임프레임별 진입 조건 (Entry Conditions)

각 타임프레임별(5m, 1h, 1d)로 설정된 조건들입니다. 체크박스가 활성화된 모든 필터가 동시에 충족(AND)되어야 최종 진입 시그널이 발생합니다.

### 2-1. ADX 필터 (추세 강도 필터)
* **동작 변수** (`rules_helper.cjs` 기준):
  * 활성화 여부: `[TF]_[SIDE]_USE_ADX=true` (예: `5M_LONG_USE_ADX=true`)
  * 임계값 범위: `[TF]_[SIDE]_ADX_LOW` 및 `[TF]_[SIDE]_ADX_HIGH` (예: `30` ~ `99`)
* **진입 조건** (`Logic.v8.2.5.cjs` 기준):
  * 🟢 **체결 허용**: 타임프레임의 ADX 지표값이 설정된 `LOW`와 `HIGH` 범위 내에 있을 때만 진입을 승인합니다. 범위 미만이거나 초과 시 진입이 제한됩니다.

### 2-2. StochK 제한 필터 (과매수/과매도 수치 필터)
* **동작 변수**:
  * 활성화 여부: `[TF]_[SIDE]_USE_STOCH_LIMIT=true` (예: `5M_LONG_USE_STOCH_LIMIT=true`)
  * 임계값 범위: `[TF]_[SIDE]_STOCH_LOW` 및 `[TF]_[SIDE]_STOCH_HIGH` (예: `0` ~ `99`)
* **진입 조건**:
  * 🟢 **체결 허용**: Stochastic RSI의 K 수치가 지정한 범위(예: 0~99) 내에 머물러 있을 때만 진입을 승인합니다.

### 2-3. RSI 범위 필터
* **동작 변수**:
  * 활성화 여부: `[TF]_[SIDE]_USE_RSI=true` (예: `5M_LONG_USE_RSI=false`)
  * 임계값 범위: `[TF]_[SIDE]_RSI_LOW` 및 `[TF]_[SIDE]_RSI_HIGH` (예: `5` ~ `95`)
* **진입 조건**:
  * 🟢 **체결 허용**: RSI 지표 수치가 지정한 범위(예: 5~95) 내에 머물러 있을 때만 진입을 승인합니다.

### 2-4. MACD 값 크기 필터 (\|MACD\| < Threshold)
* **동작 변수**:
  * 활성화 여부: `[TF]_[SIDE]_USE_MACD_VALUE=true` (예: `5M_LONG_USE_MACD_VALUE=false`)
  * 임계값: `[TF]_[SIDE]_MACD_VALUE_THRESHOLD` (예: `0`)
* **진입 조건**:
  * 🟢 **체결 허용**: 해당 봉의 MACD 주선 값이 임계값의 절댓값 미만이어야 진입을 승인합니다. 임계값을 초과하여 과도하게 가격 발산이 일어난 국면에서의 진입을 제한합니다.

### 2-5. MACD Cross 필터 (주선 & 시그널 크로스 필터)
* **동작 변수**:
  * 활성화 여부: `[TF]_[SIDE]_USE_MACD_CROSS=true`
* **진입 조건**:
  * 🟢 **LONG 진입 조건**: MACD 주선 > MACD Signal선 일 때만 승인
  * 🔴 **SHORT 진입 조건**: MACD 주선 < MACD Signal선 일 때만 승인

### 2-6. Stoch Cross 필터 (Stoch RSI K & D 크로스 필터)
* **동작 변수**:
  * 활성화 여부: `[TF]_[SIDE]_USE_STOCH_CROSS=true`
* **진입 조건**:
  * 🟢 **LONG 진입 조건**: Stoch RSI K선 > D선 일 때만 승인 (골든크로스 및 골든 유지)
  * 🔴 **SHORT 진입 조건**: Stoch RSI K선 < D선 일 때만 승인 (데드크로스 및 데드 유지)

### 2-7. Stochastic 극단값 바이패스 필터
* **동작 변수**:
  * 활성화 여부: `[TF]_[SIDE]_USE_STOCH_EXTREME_BYPASS=true` (예: `5M_LONG_USE_STOCH_EXTREME_BYPASS=true`)
* **진입 조건**:
  * ⚡ **바이패스 작동**: Stochastic RSI의 K선과 D선이 극단값(롱: 둘다 100, 숏: 둘다 0)에 도달한 초강세/초약세 국면에서는 Stoch Cross 조건(`K > D` 또는 `K < D` 미충족)을 완전히 무시하고 **무조건 통과(시장가 진입)** 시킵니다.

### 2-8. 1H 20MA 포지션 규모 조절 필터 (1h 타임프레임 전용)
* **동작 변수**:
  * 활성화 여부: `1H_[SIDE]_USE_MA_SIZE_FILTER=true`
* **진입 조건**:
  * 🟢 **배율 판정**:
    * 롱 진입 시: 진입 기준가격 < 1시간봉 20MA 이평선 이면 수량 배율을 **50% (0.5x)** 로 감축
    * 숏 진입 시: 진입 기준가격 > 1시간봉 20MA 이평선 이면 수량 배율을 **50% (0.5x)** 로 감축
    * 추세 지지선 밖에서 진입하는 역추세 리스크를 회피하고 보수적 수량 진입을 강제합니다.

---

## 3. 향후 전략 업데이트 시 준수 원칙

1. **지표/설정 추가 시**:
   * 새로운 매매 제한 조건이나 매개변수가 추가될 경우, 본 문서의 **글로벌 매개변수** 혹은 **타임프레임별 진입 조건** 섹션에 UI 명칭, 판정 로직, 환경변수 매핑 정보를 반드시 업데이트하십시오.
2. **버전 연동**:
   * 전략의 마이너 버전이 업데이트(예: v8.2.5 -> v8.3.0)될 때 추가되는 핵심 로직과 파라미터는 가이드에도 즉시 반영하여 히스토리를 추적할 수 있도록 합니다.
