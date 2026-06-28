<!-- 매매 전략 및 지표 매개변수 가이드 문서 -->
# 🛡️ 2026_CANDY 실전 매매 전략 및 매개변수 가이드 (Strategy Parameters Guide)

본 가이드는 대시보드 UI에 표시되는 설정 항목, 해당 항목의 기능 및 판정 로직, 그리고 이에 매핑되는 환경변수(`.env`) 명세를 상세하게 정리해 둔 참조 문서입니다. 

---

## 1. 글로벌 및 청산 매개변수 (Global & Exit Parameters)

이 설정들은 개별 차트의 경계 조건(Chart Border Conditions)을 통제하며, 전체적인 자금 관리와 청산 로직에 적용됩니다.

| 설정 명칭 (UI) | 설명 및 판정 로직 | 매핑 환경변수 (`.env`) | 기본값 |
| :--- | :--- | :--- | :---: |
| **Target ROI** | 진입 후 수수료를 포함한 실질 목표 수익률입니다. 지정가 익절 주문(`tpPrice`) 생성 기준이 됩니다. | `TARGET_NET_ROI` | `0.05` (5%) |
| **Stop Loss ROI** | 허용 가능한 최대 손실률입니다. 진입 즉시 이 비율에 맞춰 지정가 손절 주문(`slPrice`)을 발주합니다. | `SL_ROI` | `0.14` (14%) |
| **Entry Wait Limit** | 진입 신호(시그널)가 확정된 후, 시장가가 계산된 진입가에 도달할 때까지 대기하는 최대 시간(분)입니다. 초과 시 진입은 취소됩니다. | `ENTRY_WAIT_MIN` | `180` (3시간) |
| **Exit Wait Limit** | 포지션 진입 이후 목표 익절가나 손절가에 도달하지 못하고 지정된 시간(분)이 지나면, 무조건 시장가 청산(타임아웃)을 실행합니다. | `EXIT_WAIT_MIN` | `1500` (25시간) |
| **Reduce TP Wait Time** | 포지션 진입 후 지정된 시간(분)이 지나도 청산되지 않는 경우, 익절 목표율을 강제로 낮춰 빠른 탈출을 유도합니다. (0이면 비활성) | `REDUCE_TP_WAIT_MIN` | `0` (비활성) |
| **Reduced Target ROI** | 익절 목표 하향 조정(Reduce TP)이 발동했을 때 적용할 새로운 목표 수익률입니다. | `REDUCED_TARGET_ROI` | `0.02` (2%) |
| **Penetration Rate** | 지정가 익절 시 거래소 체결 신뢰성을 확보하기 위해, 목표가를 확실하게 뚫었는지를 검증하는 돌파 버퍼 비율입니다. | `PENETRATION_RATE` | `0.0005` (0.05%) |
| **Entry Mode** | 포지션 진입 가격을 산출하는 방식입니다. (예: `HYBRID_5M`은 5분봉 기준으로 유리한 가격에 대기 진입) | `ENTRY_MODE` | `HYBRID_5M` |
| **Opposite Signal Switching** | 포지션 보유 중에 반대 방향의 강력한 시그널이 감지되면 즉시 보유 포지션을 시장가 청산하고 반대 방향 포지션을 신규 개시합니다. | `SWITCHING_ENABLED` | `false` |
| **MA Slope 5m Filter** | 5분봉 기준 특정 기간 MA의 기울기(Slope)가 진입 방향과 다르면 진입을 차단하는 글로벌 필터입니다. | `MA_SLOPE_ALIGN_5M_ENABLED` | `true` |
| **MA Slope 5m Period** | 5m MA Slope 필터 계산에 사용할 이동평균선 기간입니다. | `MA_SLOPE_ALIGN_PERIOD_5M` | `2` |
| **MA Slope 1h Filter** | 1시간봉 기준 특정 기간 MA의 기울기가 진입 방향과 다르면 진입을 차단하는 글로벌 필터입니다. | `MA_SLOPE_ALIGN_1H_ENABLED` | `false` |
| **MA Slope 1h Period** | 1h MA Slope 필터 계산에 사용할 이동평균선 기간입니다. | `MA_SLOPE_ALIGN_PERIOD_1H` | `20` |

---

## 2. 타임프레임별 진입 조건 (Entry Conditions)

포지션 진입을 위해 검증하는 조건들입니다. 각 타임프레임별(5m, 1h, 1d)로 **체크박스가 켜진 모든 조건(AND)**이 동시에 통과되어야 진입 신호가 생성됩니다.

### 2-1. 5분봉 (5m) 진입 조건
* **접두어**: `.env` 파일 내에서 롱은 `5M_LONG_`, 숏은 `5M_SHORT_` 접두어를 사용합니다.

| 지표명 (UI) | 판정 조건 | 매핑 환경변수 (`.env`) | 상세 판정 로직 |
| :--- | :--- | :--- | :--- |
| **ADX** | `ADX_LOW` < ADX < `ADX_HIGH` | `USE_ADX` / `ADX_LOW` / `ADX_HIGH` | 현재 5분봉 ADX 지표가 변동성 범위 내에 있는지 확인합니다. (예: `30` ~ `99`) |
| **StochK** | `STOCH_LOW` < StochK < `STOCH_HIGH` | `USE_STOCH_LIMIT` / `STOCH_LOW` / `STOCH_HIGH` | Stoch RSI의 K 지표가 과매수/과매도 지정 범위 내에 있는지 검사합니다. (예: `0` ~ `99`) |
| **RSI** | `RSI_LOW` < RSI < `RSI_HIGH` | `USE_RSI` / `RSI_LOW` / `RSI_HIGH` | RSI 지표가 설정 범위 내에 있는지 검사합니다. (예: `5` ~ `95`) |
| **\|MACD\| < Threshold** | \|MACD Value\| < `Threshold` | `USE_MACD_VALUE` / `MACD_VALUE_THRESHOLD` | MACD 값의 절댓값이 임계값 미만(횡보 박스권)인지 검증합니다. |
| **MACD Cross** | 롱: MACD > Signal<br>숏: MACD < Signal | `USE_MACD_CROSS` | MACD 선과 시그널 선의 골든크로스/데드크로스 방향성 일치를 검사합니다. |
| **Stoch Cross** | 롱: K > D<br>숏: K < D | `USE_STOCH_CROSS` | Stoch RSI의 K선과 D선의 크로스 일치를 검사합니다. |
| **극단값 무조건 진입** | 롱: K & D 모두 100<br>숏: K & D 모두 0 | `USE_STOCH_EXTREME_BYPASS` | 지표가 극단값에 도달하여 수렴하는 초강세/초약세 장세에서는 크로스 조건 판정을 생략하고 즉시 진입합니다. |

### 2-2. 1시간봉 (1h) 진입 조건
* **접두어**: `.env` 파일 내에서 롱은 `1H_LONG_`, 숏은 `1H_SHORT_` 접두어를 사용합니다. (지표 판정 로직은 5m과 동일합니다)
* **특수 조건**:
  * **1H 20MA 포지션 규모 조절**
    * **매핑 환경변수**: `1H_LONG_USE_MA_SIZE_FILTER`, `1H_SHORT_USE_MA_SIZE_FILTER` (또는 `useMaSizeFilter`)
    * **상세 판정**: 진입 기준가격이 1시간봉 20MA 이평선 대비 불리한 위치(롱일 때 이평선 미만, 숏일 때 이평선 초과)에 위치하면, 역추세 리스크 방지를 위해 주문 수량(진입 규모)을 **50%로 축소(0.5x)**하여 보수적으로 배팅합니다.

### 2-3. 1일봉 (1d) 진입 조건
* **접두어**: `.env` 파일 내에서 롱은 `1D_LONG_`, 숏은 `1D_SHORT_` 접두어를 사용합니다. (지표 판정 로직은 5m과 동일합니다)

---

## 3. 향후 전략 업데이트 시 준수 원칙

1. **지표/설정 추가 시**:
   * 새로운 매매 제한 조건이나 매개변수가 추가될 경우, 본 문서의 **글로벌 매개변수** 혹은 **타임프레임별 진입 조건** 섹션에 UI 명칭, 판정 로직, 환경변수 매핑 정보를 반드시 업데이트하십시오.
2. **버전 연동**:
   * 전략의 마이너 버전이 업데이트(예: v8.2.5 -> v8.3.0)될 때 추가되는 핵심 로직과 파라미터는 가이드에도 즉시 반영하여 히스토리를 추적할 수 있도록 합니다.
