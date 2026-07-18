<!-- RCI/TRIX 작업 컨텍스트 노트 -->
# 컨텍스트 노트 — RCI / TRIX 추가

## 결정과 근거
1. **계산 이중화**: 백엔드 lib/indicators.cjs(백테스트) + 프론트 indicatorUtils.js(차트)에 각각 동일 로직 추가. 기존 지표들도 이 구조라 관례를 따름.
2. **중첩 EMA 정렬**: TRIX 삼중 EMA는 기존 MACD 시그널과 동일하게 null 필터 후 realignTo로 재정렬. 새 헬퍼 realignTo 추가.
3. **엔진 로깅 위치**: 주 로그 result_*.csv(=output 배열)에만 12개 컬럼 추가.
   - signalRows 배열: 어디에도 writeFileSync 되지 않는 미사용 배열 → 건드리지 않음(지침: 내가 만들지 않은 죽은 코드 방치).
   - fullValidationRows(validation_FULL_*.csv): 부차적 심층검증 파일 → Phase 1 범위에서 제외(주 로그로 충분).
4. **TRIX 시그널 로깅 기본값**: 엔진 지표보장 블록은 타임프레임 단위(롱/숏 구분 없음)라 로그용 TRIX 시그널은 기본 9로 계산. 진입 필터는 Phase 2에서 룰별 trixSignalPeriod 사용 → 로그값과 필터 판정 시그널이 다를 수 있음(문서화 필요).
5. **RCI flat 데이터 = 50**: 완전 평탄 가격은 순위 동점으로 RCI 50이 나옴(공식상 정상, 실데이터엔 무의미). 버그 아님.
6. **차트 마커**: inspectTime 모드의 원형 마커는 기존 4개 차트만 유지. RCI/TRIX는 세로 검사선(DOM 오버레이)으로 충분해 마커 생략(스코프 최소화).
7. **필터 방식(사용자 확정)**: RCI=교차(9 vs 26), TRIX=시그널선 교차. TRIX 시그널 기간만 백테스트 룰에서 가변.

## Phase 1 검증 결과 (통과)
- npm run build 통과
- 백테스트(2026-05-01~08): RCI/TRIX 값 정상 채워짐 (d1_trix는 단기구간 워밍업 부족으로 '-', 장기구간 정상)
- 차트: 5분봉에 RCI(9/26)·TRIX(trix/signal) 패널 렌더 확인, 범례 실시간값 표시

## Phase 2 예정 (진입 필터)
- 새 전략 strategies/CC.v0.2.0.cjs (CC.v0.1.0 복사 + RCI Cross/TRIX Cross 필터 + indicators_logic에 rci9/rci26/trix/trixSignal)
- rules_helper.cjs .env 파싱, .env 기본값, RulesEditor 체크박스+TRIX시그널기간, rulesNormalizer passthrough, strategyConfigs CC.v0.2.0 등록
