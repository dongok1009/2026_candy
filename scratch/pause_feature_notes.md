<!-- 텔레그램 /pause 명령으로 실전 봇 신규 진입을 원격 중단하는 기능의 결정·근거 -->
# 텔레그램 일시정지 기능 컨텍스트 노트

## 목표
오라클 실전 봇(bybit_trader.cjs)을 원격으로 일시정지/재개.
2026-07-25 변경: pause = **완전히 손 떼기**. 신규 진입 + RESCUE 포지션 입양 + monitorPosition 관리를 모두 중단.
(초기엔 "신규 진입만 중단"이었으나, RESCUE가 사용자의 수동 바이비트 포지션까지 입양해 청산하는 문제로 hands-off로 전환.)
봇이 이전에 건 거래소 측 TP/SL 주문은 남아 하드 손절 보호는 유지된다.

## 왜 텔레그램인가 (홈페이지 버튼 아님)
대시보드는 로컬에서만 돌고 `API_BASE=localhost:3001`로 로컬 candy-api만 부른다.
오라클은 인터넷 미노출이라 브라우저가 오라클 봇에 직접 닿을 수 없다.
포트를 여는 건 실전 자금 봇 노출이라 보안 부담 → 이미 연결된 텔레그램으로 제어(포트 노출 0).
사용자 선택: 텔레그램 /pause 방식(권장).

## 설계 (bybit_trader.cjs 한 파일)
- `tradingPaused` 모듈 변수 + `bot_control.json` 저장 → pm2 재시작에도 정지 상태 유지.
- 텔레그램 명령 폴러: 약 5초 주기 getUpdates(axios). `/pause` `/resume` `/status`.
  - **인증**: `TELEGRAM_CHAT_ID`와 일치하는 chat에서 온 명령만 수락. 타인 메시지 무시.
  - 시작 시 백로그 update_id를 건너뛴다(며칠 전 /pause 오작동 방지).
  - getUpdates 실패는 조용히 무시하고 다음 주기 재시도(거래 루프와 격리).
- 진입 게이트: checkMarkets의 `if (isLong||isShort)` 안에서 tradingPaused면 handleEntry 스킵 + 로그만.
- 하트비트(checkStatusNotification)에 매매 상태(가동중/일시정지) 한 줄 추가.

## 거래 로직 불변 원칙
handleEntry/monitorPosition/주문/상태 동기화 코드는 일절 변경하지 않는다.
진입 여부를 감싸는 게이트 한 곳만 추가.

## getUpdates 충돌 검토
- 기존 코드에 getUpdates/webhook 사용 없음(grep 확인). signal-bot은 bybit-live로 통합됨 →
  같은 봇 토큰으로 getUpdates 하는 프로세스는 이 하나뿐. 업데이트 가로채기 충돌 없음.

## 검증 한계
에이전트는 오라클/텔레그램 실전송 테스트 불가. 로컬 `node --check`만 수행.
배포 후 사용자가 실제 /pause·/resume·/status로 검증. [[live-deployment]] 절차 사용.
