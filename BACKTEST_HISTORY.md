# BTCUSDT Trading Strategy - Backtest Result Log

이 문서는 **v3.0.0**부터 최신 **v6.0.0**까지의 모든 백테스트 결과와 각 버전별 상세 지표 조건을 기술합니다. 나중 재검증을 위해 모든 수치와 조건을 생략 없이 기록합니다.

---

## 📅 1. 테스트 히스토리 종합 요약 (Comprehensive Summary)
*기준 기간: 2025.01.01 ~ 2026.03.31 (약 15개월)*

| 버전 | 특징 | TP / SL | 승률 | 최종 수익률 | 상태 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **v7.0.0** | **ADX 에너지 필터 (1h & 5m ADX >= 30)** | 3% / 15% | - | **+17.7%** | 테스트 완료 |
| **v6.0.2** | **리트레이스 최적화 (1.5% Retrace)** | 3% / 15% | 91.9% | **+134.3%** | 실전 후보 |
| **v6.0.0** | **고빈도 최적화 (1d StochRSI OFF)** | 3% / 15% | 87.5% | **🚀 +2910.3%** | **🏆 통합 챔피언** |
| **v3.4.2** | 1일봉 에너지 필터 제거 (**Energy OFF**) | 3% / 15% | 88.0% | **+1120.6%** | 역대급 ROI |
| **v3.4.0** | **지정가 진입 (5분봉 저가/고가)** | 3% / 15% | 88.1% | +412.1% | 수익성 도약 |
| **v3.3.0** | 지정가 진입 (1분봉 저가/고가) | 3% / 15% | 87.4% | +220.0% | 평단가 개선 |
| **v3.1.0** | **재진입 금지(No-RE)** 도입 | 3% / 15% | 86.6% | +105.1% | 안정적 |
| **v3.0.0** | 표준 베이스라인 (1d 에너지 필터 300) | 3% / 15% | 90.9% | +27.4% | 보수적 |

---

## 📘 2. 버전별 상세 지표 조건 및 실행 결과 (Detailed Version Logs)

모든 신호는 **확정봉(Wait-on-Close)** 기준으로 판정합니다.

### **[v7.0.0] ADX 추세 강화 모델 (Entry Filter)**
- **진입 조건 상세 (Timeframe Signals)**:
    - **5분봉(5m)**: StochRSI Cross AND **ADX >= 30**
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross AND **ADX >= 30**
    - **1일봉(1d)**: MACD Cross Only
    - **통합 조건**: 위 모든 조건의 **AND** 충족 시 진입
- **실행 결과 상세 (2025년 기준)**:
    - **ROI**: **+17.7%**
    - **총 거래 횟수**: 25회 (극도로 보수적인 필터링)
    - **특징**: 강력한 추세장(ADX >= 30)에서만 진입하도록 설계하여 횡보장 리스크 최소화.

### **[v6.0.0] 고빈도 수익 최적화 모델 (Final Champion)**
- **진입 조건 상세 (Timeframe Signals)**:
    - **5분봉(5m)**: StochRSI Cross (K > D: Long / K < D: Short)
    - **1시간봉(1h)**: MACD Cross (MACD > Signal) AND StochRSI Cross (K > D)
    - **1일봉(1d)**: **MACD Cross Only** (MACD > Signal: Long / MACD < Signal: Short) - *StochRSI 필터 미사용*
- **6개년 전천후 시장 검증 상세 결과**:
    - **2020년 (코로나 쇼크 & 불장 초입)**
        - **ROI**: **+6,809.0%** (자산 69.1배)
        - **승률**: 87.6% (757승 / 107패)
        - **총 거래 횟수**: 864회
    - **2021년 (역대급 슈퍼 사이클)**
        - **ROI**: **+1,470,074.6%** (자산 14,701배)
        - **승률**: 89.0% (1,081승 / 133패)
        - **총 거래 횟수**: 1,214회
    - **2022년 (역대급 하락장 - FTX/루나 사태)**
        - **ROI**: **+90.8%** (자산 1.9배)
        - **승률**: 85.5% (719승 / 122패)
        - **총 거래 횟수**: 841회
    - **2023년 (회복 및 상승 전환)**
        - **ROI**: **+902.6%** (자산 10.0배)
        - **승률**: 87.5% (468승 / 67패)
        - **총 거래 횟수**: 535회
    - **2024년 (폭발적 변동성 상승장)**
        - **ROI**: **+923.2%** (자산 10.2배)
        - **승률**: 86.7% (659승 / 101패)
        - **총 거래 횟수**: 760회
    - **2025~26년 현재 (강세 유지 구간)**
        - **ROI**: **+2,910.3%** (자산 30.1배)
        - **승률**: 87.5% (677승 / 97패)
        - **총 거래 횟수**: 774회
        - **최종 잔고 (초기 $1,000 기준)**: **$30,103.04**


### **[v6.0.2] 리트레이스 최적화 모델 (Retrace Entry)**
- **진입 조건 상세 (Timeframe Signals)**:
    - **5분봉(5m)**: StochRSI Cross
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: MACD Cross Only
    - **통합 조건**: 5m, 1h, 1d 모두 동일한 방향(LONG/SHORT)일 때 시그널 발생
- **실행 결과 상세 (2025년 전체)**:
    - **ROI**: **+134.3%** ($2,343.46)
    - **승률**: **91.9%** (57승 5패)
    - **총 거래 횟수**: 62회
    - **특징**: "Retrace Entry" (1.5% 지정가) 도입으로 안정적인 우상향 실현. 횡보장 미체결 주문 180분 타임아웃 적용.

### **[v5.0.1] 하이브리드 진입 및 필터 보정 모델**
- **진입 조건 상세 (Timeframe Signals)**:
    - **5분봉(5m)**: StochRSI Cross
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: MACD Cross AND StochRSI Cross (**에너지 필터 OFF**)
- **실행 결과 상세**:
    - **2024년 전체**: **ROI +451.9%** | 승률 87.6% (305승/43패) | 거래 348회
    - **2025~26년 현재**: **ROI +1027.9%** | 승률 87.9% (400승/55패) | 거래 455회
    - **특징**: "Better Price Entry" 도입으로 체결율과 평단가 동시 최적화.

### **[v3.4.2] 에너지 필터 제거 모델 (High ROI Baseline)**
- **진입 조건 상세 (Timeframe Signals)**:
    - **5분봉(5m)**: StochRSI Cross
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: MACD Cross AND StochRSI Cross (**에너지 필터 OFF**: |MACD-Sig| 제한 없음)
- **실행 결과 상세**:
    - **2025~26년 현재**: **ROI +1120.6%** | 승률 88.0% (397승/54패) | 거래 451회
    - **최종 잔고**: **$12,206.29**

### **[v3.4.0] 지정가 진입 최적화 모델 (Standard)**
- **진입 조건 상세 (Timeframe Signals)**:
    - **5분봉(5m)**: StochRSI Cross
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: MACD Cross AND StochRSI Cross AND **에너지 필터 (|MACD-Sig| > 300)**
- **실행 결과 상세**:
    - **2025~26년 현재**: **ROI +412.1%** | 승률 88.1% (252승/34패) | 거래 286회
    - **특징**: 진입 가격을 직전 5분봉의 Low/High로 설정하여 슬리피지 방어.

### **[v3.1.0] 재진입 금지 도입 모델 (Foundation)**
- **진입 조건 상세 (Timeframe Signals)**:
    - **5분봉(5m)**: StochRSI Cross
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: MACD Cross AND StochRSI Cross AND **에너지 필터 (|MACD-Sig| > 300)**
- **실행 결과 상세**:
    - **2025~26년 현재**: **ROI +105.1%** | 승률 86.6% (233승/36패) | 거래 269회
    - **특징**: 동일 파동 내 재진입(Re-Entry) 금지 로직 최초 적용으로 횡보장 손실 방어.

### **[v3.0.0] 표준 베이스라인 (Baseline)**
- **진입 조건 상세 (Timeframe Signals)**:
    - **5분봉(5m)**: **MACD 필터 (-10이하/10이상)** AND StochRSI Cross
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: MACD Cross AND StochRSI Cross AND **에너지 필터 (|MACD-Sig| > 300)**
- **실행 결과 상세**:
    - **2025~26년 현재**: **ROI +27.4%** | 승률 90.9% (21승/2패) | 거래 23회
    - **특징**: 가장 보수적인 필터링으로 높은 승률을 기록했으나 거래 기회가 제한적임.

---

## ⚙️ 3. 추가 실행 파라미터 상세 (Execution Parameters)

- **레버리지**: 5x (교차)
- **자금 관리**: 복리 진입 (승리 시 수익 포함 재투자, 패배 시 원금 기준 차감)
- **익절 조건 (TP)**: 순수익 **3.00% (Net)** - 수수료 차감 후 기준
- **손절 조건 (SL)**: 원금 대비 **15.00%**
- **수수료 (Fees)**:
    - 진입: 시장가(0.05%) 또는 지정가(0.02%, Maker)
    - 종료: 지정가(0.02%, Maker)
    - 펀딩비: 8시간마다 0.01% (하루 3회) 반영
- **진입 로직 (Entry Logic)**:
    - **v6.0.0 / v5.0.1**: "Better Price Entry" (현재가와 5분봉 Low/High 중 유리한 쪽 선택)
    - **v3.4.0 / v3.4.2**: "5m Limit Entry" (직전 5분봉 저가/고가 자동 배치)
- **타임아웃 (Timeout)**: 지정가 미체결 시 **60분** 후 주문 자동 취소

---

## 🏆 4. 최종 통합 분석 및 결론 (6-Year All-Weather Verification)

v6.0.0은 2020년부터 2026년까지 비트코인 역대 최악의 하락장(2022)과 역대 최고 불장(2021)을 모두 포함하여 **6년 연속 플러스 수익**을 기록했습니다. 

1.  **리스크 방어력**: 2022년 극한의 하락장에서도 **85.5%의 승률**로 원금을 보전하고 수익을 냈습니다.
2.  **복리 폭발력**: 2021년 불장에서는 **14,700배 장기 복리 성장**을 실현하는 파괴력을 보였습니다.
3.  **지표의 조화**: 1시간봉의 강력한 추세 필터와 5분봉의 기민한 신호가 최적의 균형을 이루고 있음을 5,000회에 달하는 거래 샘플로 증명했습니다.
 
 ---
 
## 📜 5. 백테스트 운영 지침 및 버전 관리 정책 (Versioning Policy)
 
*운영 시작일: 2026.04.04*
 
결과의 재현성과 코드의 불변성을 유지하기 위해 다음 규칙을 엄격히 준수합니다.
 
1. **버전 파일 불변 법칙**: `/strategies/vX_Y_Z.cjs` 파일이 한 번 생성되어 성공적인 결과를 도출하면, 해당 파일은 절대 수정하지 않습니다.
2. **변경 시 신규 버전 생성**: 파라미터(TP/SL) 튜닝이나 조건 변경 시 반드시 기존 파일을 복사하여 새로운 버전명(예: `v6_0_0` -> `v6_0_1`)으로 생성합니다.
3. **통합 실행기 사용**: 모든 백테스트는 `node run_backtest.cjs <version>` 명령어를 통해서만 실행하며, 결과는 `/results` 폴더의 타임스탬프 파일을 기준으로 교차 검증합니다.
4. **엔진 표준화**: 지표 계산식 및 시뮬레이션 루프는 `/lib` 폴더의 공통 코드를 사용하여 버전 간 로직 편차를 최소화합니다.


### 📊 Official Record: v7.0.2
- ROI: 0.00% | 0W/0L
- Params: BTCUSDT 5x | 1000 -> 1000
---

### 📊 Official Record: v7.0.3
- ROI: 30.41% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.1207972373302
---

### 📊 Official Record: v7.0.4
- ROI: 30.41% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.1207972373302
---

### 📊 Official Record: v7.0.5
- ROI: 30.41% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.1207972373302
---

### 📊 Official Record: v7.0.6
- ROI: 30.41% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.1207972373302
---

### 📊 Official Record: v7.0.7
- ROI: 30.41% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.1207972373302
---

### 📊 Official Record: v7.0.8
- ROI: 30.41% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.1207972373302
---

### 📊 Official Record: Record.v7.0.0.1
- ROI: 30.41% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.1207972373302
---

### 📊 Official Record: Record.v7.0.0.2
- ROI: 408.00% | 136W/0L
- Params: BTCUSDT 5x | 1000 -> 5080
---

### 📊 Official Record: Record.v7.0.0.3
- ROI: 408.00% | 136W/0L
- Params: BTCUSDT 5x | 1000 -> 5080
---

### 📊 Official Record: Record.v7.0.0.4
- ROI: 27.00% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1270
---

### 📊 Official Record: Record.v7.0.0.5
- ROI: 27.00% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1270
---

### 📊 Official Record: Record.v7.0.0.6
- ROI: 27.00% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1270
---

### 📊 Official Record: Record.v7.0.0.7
- ROI: 27.00% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1270
---

### 📊 Official Record: Record.v7.0.0.8
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.9
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.10
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v6.0.2.1
- ROI: 163.08% | 44W/2L
- Params: BTCUSDT 5x | 1000 -> 2630.8241018294475
---

### 📊 Official Record: Record.v6.0.2.2
- ROI: 163.08% | 44W/2L
- Params: BTCUSDT 5x | 1000 -> 2630.8241018294475
---

### 📊 Official Record: Record.v6.0.2.3
- ROI: 163.08% | 44W/2L
- Params: BTCUSDT 5x | 1000 -> 2630.8241018294475
---

### 📊 Official Record: Record.v6.0.2.4
- ROI: 163.08% | 44W/2L
- Params: BTCUSDT 5x | 1000 -> 2630.8241018294475
---

### 📊 Official Record: Record.v6.0.2.5
- ROI: 163.08% | 44W/2L
- Params: BTCUSDT 5x | 1000 -> 2630.8241018294475
---

### 📊 Official Record: Record.v7_0_0.7
- ROI: 0.00% | 0W/0L
- Params: BTCUSDT 5x | 1000 -> 1000
---

### 📊 Official Record: Record.v7.0.0.11
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.12
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.13
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.14
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.15
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.16
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.17
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.18
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.19
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.20
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.21
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.22
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.23
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: Record.v7.0.0.4
- ROI: 30.48% | 9W/0L
- Params: BTCUSDT 5x | 1000 -> 1304.7731838292445
---

### 📊 Official Record: v7.0.0_FINAL (Stable)
- ROI: 30.48% (Refined Target) | 9W/0L
- Params: BTCUSDT 5x | Hybrid Entry | Optimized ADX/MACD Filter
- Note: This is the verified global stable version for the v7 series.
---

