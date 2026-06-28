/**
 * Pre-defined configurations for official strategy versions.
 * This acts as a registry for the UI to load historical rules.
 */
export const OFFICIAL_STRATEGIES = [
  {
    version: 'Logic.v8.2.5',
    name: 'Logic.v8.2.5 (MA Slope, ROC & Switching/Sizing Filters)',
    description: '5분봉 MA Slope/ROC (0기준 필터), 반대신호 즉시 스위칭 진입, 1시간봉 20MA 수량조절 기능이 통합된 모델',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      targetRoi: 0.05,
      slRoi: 0.14,
      entryWaitMin: 180,
      exitWaitMin: 1500,
      reduceTpWaitMin: 0,
      reducedTargetRoi: 0.02,
      penetrationRate: 0.0005,
      entryMode: 'HYBRID_5M',
      global: {
        switchingEnabled: false,
        maSlopeAlign5mEnabled: true,
        maSlopeAlign1hEnabled: false,
        maSlopeAlignPeriod5m: 2,
        maSlopeAlignPeriod1h: 20
      },
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useStochExtremeBypass: true, useADX: true, adxLow: 30, adxHigh: 99, useStochKLimit: true, stochKThreshold: 99, stochKLow: 0, stochKHigh: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: true, useADX: false, adxLow: 30, adxHigh: 99, useStochKLimit: false, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95, useMaSizeFilter: true },
        '1d': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: false, useADX: false, adxLow: 15, adxHigh: 99, useStochKLimit: true, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useStochExtremeBypass: true, useADX: true, adxLow: 30, adxHigh: 99, useStochKLimit: true, stochKThreshold: 99, stochKLow: 0, stochKHigh: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: true, useADX: false, adxLow: 30, adxHigh: 99, useStochKLimit: false, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95, useMaSizeFilter: true },
        '1d': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: false, useADX: false, adxLow: 15, adxHigh: 99, useStochKLimit: true, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      }
    }
  },
  {
    version: 'Logic.v8.2.4',
    name: 'Logic.v8.2.4 (Custom Entry Modes & Penetration Rate Integration)',
    description: '돌파 깊이 필터(penetrationRate) 및 다중 진입 모드(Market, Limit 5m/10m/15m)가 결합된 BTC 전용 모델',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      targetRoi: 0.05,
      slRoi: 0.14,
      entryWaitMin: 180,
      exitWaitMin: 1500,
      reduceTpWaitMin: 0,
      reducedTargetRoi: 0.02,
      penetrationRate: 0.001,
      entryMode: 'HYBRID_5M',
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useStochExtremeBypass: true, useADX: true, adxLow: 30, adxHigh: 99, useStochKLimit: true, stochKThreshold: 99, stochKLow: 0, stochKHigh: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: true, useADX: false, adxLow: 30, adxHigh: 99, useStochKLimit: false, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1d': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: false, useADX: false, adxLow: 15, adxHigh: 99, useStochKLimit: true, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useStochExtremeBypass: true, useADX: true, adxLow: 30, adxHigh: 99, useStochKLimit: true, stochKThreshold: 99, stochKLow: 0, stochKHigh: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: true, useADX: false, adxLow: 30, adxHigh: 99, useStochKLimit: false, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1d': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: false, useADX: false, adxLow: 15, adxHigh: 99, useStochKLimit: true, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      }
    }
  },
  {
    version: 'Logic.v8.2.3',
    name: 'Logic.v8.2.3 (Integrated Rules & Global Parameters Repositioned)',
    description: '글로벌 변수를 상단으로 모으고, 롱/숏을 롱 조건 기준으로 단일 통합하여 숏은 대칭 적용되게 한 리팩토링 버전',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 1500,
      reduceTpWaitMin: 0,
      reducedTargetRoi: 0.02,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxLow: 30, adxHigh: 99, useStochKLimit: true, stochKThreshold: 99, stochKLow: 0, stochKHigh: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: true, useADX: false, adxLow: 30, adxHigh: 99, useStochKLimit: false, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1d': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: false, useADX: false, adxLow: 15, adxHigh: 99, useStochKLimit: true, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxLow: 30, adxHigh: 99, useStochKLimit: true, stochKThreshold: 99, stochKLow: 0, stochKHigh: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: true, useADX: false, adxLow: 30, adxHigh: 99, useStochKLimit: false, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1d': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: false, useADX: false, adxLow: 15, adxHigh: 99, useStochKLimit: true, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      }
    }
  },
  {
    version: 'Logic.v8.2.2',
    name: 'Logic.v8.2.2 (ADX Range & optimization UI advanced)',
    description: 'ADX 값 범위를 설정할 수 있는 버전 (Low < ADX < High)',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 1500,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxLow: 30, adxHigh: 99, useStochKLimit: true, stochKThreshold: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: true, useADX: false, adxLow: 30, adxHigh: 99, useStochKLimit: false, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1d': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: false, useADX: false, adxLow: 15, adxHigh: 99, useStochKLimit: true, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxLow: 30, adxHigh: 99, useStochKLimit: true, stochKThreshold: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: true, useADX: false, adxLow: 30, adxHigh: 99, useStochKLimit: false, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1d': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: false, useADX: false, adxLow: 15, adxHigh: 99, useStochKLimit: true, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      }
    }
  },
  {
    version: 'Logic.v8.2.1',
    name: 'Logic.v8.2.1 (MACD Value Filter Extended)',
    description: 'v8.2.0 기반으로 1시간봉 및 1일봉에도 MACD 값에 의한 진입 제한 필터를 추가로 확장 지원하는 버전',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 1500,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30, useStochKLimit: true, stochKThreshold: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1d': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15, useStochKLimit: true, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30, useStochKLimit: true, stochKThreshold: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1d': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15, useStochKLimit: true, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      }
    }
  },
  {
    version: 'Logic.v8.2.0',
    name: 'Logic.v8.2.0 (RSI Filter Added)',
    description: 'v8.1.0 기반으로 5 < RSI < 95 필터링 조건이 추가된 최신 모델 (지표 데이터 CSV 로깅 지원)',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 1500,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30, useStochKLimit: true, stochKThreshold: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15, useStochKLimit: true, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30, useStochKLimit: true, stochKThreshold: 99, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15, useStochKLimit: true, stochKThreshold: 98, useRSI: false, rsiLow: 5, rsiHigh: 95 }
      }
    }
  },
  {
    version: 'Logic.v8.1.0',
    name: 'Logic.v8.1.0 (Optimization Enabled)',
    description: 'v8.0.0 기반의 신규 로직 버전 및 대규모 다차원 최적화 튜닝 모델',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 1500,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15, useStochKLimit: false, stochKThreshold: 98 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15, useStochKLimit: false, stochKThreshold: 98 }
      }
    }
  },
  {
    version: 'Logic.v8.0.0',
    name: 'Logic.v8.0.0 (Base copied from v7.0.4)',
    description: 'v7.0.4 기반의 신규 로직 버전 (기능 추가용)',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 1500,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15, useStochKLimit: false, stochKThreshold: 98 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30, useStochKLimit: false, stochKThreshold: 98 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15, useStochKLimit: false, stochKThreshold: 98 }
      }
    }
  },
  {
    version: 'Logic.v7.0.4',
    name: 'Logic.v7.0.4 (Adjustable ROI/SL)',
    description: '익절률(Target ROI)과 손절률(SL ROI)을 UI에서 직접 입력하여 테스트할 수 있는 버전',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 2000,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      }
    }
  },
  {
    version: 'Logic.v7.0.3',
    name: 'Logic.v7.0.3 (Experimental)',
    description: 'v7.0.2 기반의 신규 실험용 버전 (전략 수정용)',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 2000,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      }
    }
  },
  {
    version: 'Logic.v7.0.2',
    name: 'Logic.v7.0.2 (Ultimate Sync)',
    description: 'UI 설정 실시간 동기화 완벽 보정 및 지표 데이터 180일 예열이 적용된 최종 완성 버전',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'Verified'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 2000,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      }
    }
  },
  {
    version: 'Logic.v7.0.1',
    name: 'Logic.v7.0.1 (Stable & Conservative)',
    description: 'T-1 확정봉 시그널 및 T 시점 즉시 진입 원칙이 적용된 최신 보수적 모델 (선행 편향 차단)',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      mdd: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'Testing...'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 3000,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      }
    }
  },
  {
    version: 'Logic.v7.0.0',
    name: 'Logic.v7.0.0 (Optimized Stable)',
    description: '지표 출력, 누적 ROI, 잔액 추적 기능이 통합된 7.0.0 통합 안정화 버전',
    stats: {
      initialBalance: 1000,
      finalBalance: 1304,
      roi: '30.4%',
      winRate: '100.0%',
      mdd: '-',
      trades: 9,
      wins: 9,
      losses: 0,
      period: '2025.01 ~ 2025.03'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 3000,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: true, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      }
    }
  },
  {
    version: 'Logic.v6.0.2',
    name: 'Logic.v6.0.2 (Retrace optimized)',
    description: '1.5% 리트레이스 지정가 진입에 최적화된 고승률(91.9%) 모델',
    stats: {
      initialBalance: 10000,
      finalBalance: 23430,
      roi: '134.3%',
      winRate: '91.9%',
      mdd: '-',
      trades: 62,
      wins: 57,
      losses: 5,
      period: '2025.01 ~ 2025.12'
    },
    rules: {
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 0 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 0 }
      }
    }
  },
  {
    version: 'Logic.v6.0.0',
    name: 'Logic.v6.0.0 (Champion High-Freq)',
    description: '1일봉 StochRSI 필터 비활성화를 통해 거래 기회 및 장기 복리 수익 극대화 (최상위 승률 챔피언)',
    stats: {
      initialBalance: 10000,
      finalBalance: 301030,
      roi: '2910.3%',
      winRate: '87.5%',
      mdd: '-',
      trades: 774,
      wins: 677,
      losses: 97,
      period: '2025.01 ~ 2026.03'
    },
    rules: {
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 0 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 0 }
      }
    }
  },
  {
    version: 'Logic.v5.0.1',
    name: 'Logic.v5.0.1 (Hybrid Entry)',
    description: 'Better Price 진입 로직이 적용된 하이브리드 모델',
    stats: {
      initialBalance: 1000,
      finalBalance: 11270,
      roi: '1027.9%',
      winRate: '87.9%',
      mdd: '-',
      trades: 455,
      wins: 400,
      losses: 55,
      period: '2025.01 ~ 2026.03'
    },
    rules: {
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1d': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 0 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1d': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 0 }
      }
    }
  },
  {
    version: 'Logic.v3.0.0',
    name: 'Logic.v3.0.0 (Standard Baseline)',
    description: '1일봉 에너지 필터(300)가 적용된 가장 보수적이고 안정적인 베이스라인 모델',
    stats: {
      initialBalance: 1000,
      finalBalance: 1274,
      roi: '27.4%',
      winRate: '90.9%',
      mdd: '-',
      trades: 23,
      wins: 21,
      losses: 2,
      period: '2025.01 ~ 2026.03'
    },
    rules: {
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1d': { useMacdBeyondSig: true, useStochCross: true, useMacdSigDiff: true, macdSigDiff: 300, useADX: false, adxThreshold: 0 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 0 },
        '1d': { useMacdBeyondSig: true, useStochCross: true, useMacdSigDiff: true, macdSigDiff: 300, useADX: false, adxThreshold: 0 }
      }
    }
  }
];
