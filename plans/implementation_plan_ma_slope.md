# 5m / 1h MA Slope 개별 입력 기간 연동 구현 계획 (MA Slope Plan)

본 계획서는 5분봉과 1시간봉의 MA Slope 방향 필터에서 활용할 MA 기준 기간(Period)을 각각 따로 입력받아 적용할 수 있도록 엔진 및 UI의 설정을 개별 변수화하는 구현 계획을 담고 있습니다.

## 제안 배경 및 요구사항
1. **5m 및 1h MA Slope 입력 기간 개별화**
   * **기존**: `maSlopeAlignPeriod` 라는 단일 기간으로 5m 및 1h가 동일한 기준선(예: 20)을 공유
   * **개선**: 5m과 1h 각각 다른 기간의 Slope를 대조할 수 있도록 개별 변수 지원
     * **5m 기준 MA 기간**: `maSlopeAlignPeriod5m`
     * **1h 기준 MA 기간**: `maSlopeAlignPeriod1h`
2. **UI 최적화**
   * 설정 폼에서 5m 필터와 5m 기간, 1h 필터와 1h 기간을 명확하게 연결하여 입력받을 수 있도록 4열 그리드 레이아웃으로 변경

---

## Proposed Changes (변경 예정 내용)

### 1. 전략 규칙 및 판정 로직 반영
#### [MODIFY] [Logic.v8.2.5.cjs](file:///c:/dev/2026_candy/strategies/Logic.v8.2.5.cjs)
* **지표 사전 연산**: `indicators_logic` 함수에서 `maSlopeAlignPeriod5m` 및 `maSlopeAlignPeriod1h` 변수를 개별 파싱하여, 각각 지정된 기간의 SMA 및 Slope 지표(`ma_slope_${period5m}`, `ma_slope_${period1h}`)가 없을 경우 동적으로 선행 연산하여 캐싱하도록 로직을 수정했습니다.
* **개별 기간 Slope 검증**: `signal_logic` 판정부 내에서 5분봉 Slope 방향 검사 시 5m 전용 기간(`period5m`), 1시간봉 Slope 방향 검사 시 1h 전용 기간(`period1h`)의 Slope를 꺼내와 진입 제한 조건을 가려내도록 판정 논리를 적용했습니다.

### 2. 설정 도우미 및 .env 파일 매핑 연동
#### [MODIFY] [rules_helper.cjs](file:///c:/dev/2026_candy/lib/rules_helper.cjs)
* `buildRulesFromEnv` 함수 내 글로벌 규칙 파싱부에 `maSlopeAlignPeriod5m`, `maSlopeAlignPeriod1h` 속성을 추가하여 `.env` 설정값을 읽어들이도록 매핑을 추가했습니다. (하위 호환을 위해 기존 `MA_SLOPE_ALIGN_PERIOD` 값도 fallback으로 지원)
* `syncRulesToEnv` 함수에 글로벌 속성 동기화 코드를 수정하여 UI에서 설정한 두 개의 개별 기간이 `.env` 파일의 `MA_SLOPE_ALIGN_PERIOD_5M`, `MA_SLOPE_ALIGN_PERIOD_1H` 키에 정상적으로 저장되도록 연동했습니다.

### 3. 대시보드 웹 UI 설정 폼 연동
#### [MODIFY] [BacktestForm.jsx](file:///c:/dev/2026_candy/src/features/backtest/components/BacktestForm.jsx)
* **상태 복원**: `normalizeAndMapRules` 헬퍼 함수에 `maSlopeAlignPeriod5m`와 `maSlopeAlignPeriod1h` 복원 로직을 연동했습니다.
* **UI 컨트롤 배치**: 스위칭 진입 하단 영역을 **4열 그리드 레이아웃**으로 재배치했습니다.
  * **1열**: 5m 방향 필터 활성 [Checkbox]
  * **2열**: 5m 기준 MA 기간 [Number Input]
  * **3열**: 1h 방향 필터 활성 [Checkbox]
  * **4열**: 1h 기준 MA 기간 [Number Input]

#### [MODIFY] [strategyConfigs.js](file:///c:/dev/2026_candy/src/shared/config/strategyConfigs.js)
* `Logic.v8.2.5` 공식 버전의 기본 룰 템플릿(rules.global)에 `maSlopeAlignPeriod5m: 20`, `maSlopeAlignPeriod1h: 20` 기본 속성을 주입했습니다.

---

## Verification Plan (검증 계획)

### Automated Tests (자동화 테스트)
* 로컬 CLI 백테스트 커맨드라인 실행:
  ```powershell
  node run_backtest.cjs Logic.v8.2.5 --symbol=BTCUSDT --start=2025-01-01 --end=2025-01-10 --leverage=5 --balance=1000 --exitWaitMin=1500 --entryWaitMin=180
  ```
  전략 스크립트 실행 과정에서 구문 오류나 런타임 예외가 발생하지 않는지 확인합니다.

### Manual Verification (수동 검증)
1. 백테스트 웹 대시보드 화면(http://localhost:5173/2026_candy/)에 접속하여 새로고침합니다.
2. Backtest Config 탭 하단에 새로 추가된 **MA Slope 5m Filter**, **MA Slope 5m Period**, **MA Slope 1h Filter**, **MA Slope 1h Period** 컨트롤이 4열 그리드로 예쁘게 렌더링되는지 확인합니다.
3. 5m Period 에 `10`을 넣고, 1h Period 에 `20`을 넣은 뒤 둘 다 체크 활성화하고 백테스트를 수행해 봅니다.
4. 백테스트 완료 이후 다운로드되는 CSV 결과 파일의 각 행에 표기된 `M5_MA_Slope_10` 및 `H1_MA_Slope_20` 지표 수치가 롱 진입 시 둘 다 양수(+), 숏 진입 시 둘 다 음수(-) 인지 대조 검증합니다.
5. .env 파일에 `MA_SLOPE_ALIGN_PERIOD_5M=10` 및 `MA_SLOPE_ALIGN_PERIOD_1H=20` 설정이 안전하게 기입 및 저장되는지 확인합니다.
