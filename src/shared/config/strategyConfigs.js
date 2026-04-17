/**
 * Pre-defined configurations for official strategy versions.
 * This acts as a registry for the UI to load historical rules.
 */
export const OFFICIAL_STRATEGIES = [
  {
    version: 'Logic.v7.0.3',
    name: 'Logic.v7.0.3 (Experimental)',
    description: 'v7.0.2 기반의 신규 실험용 버전 (전략 수정용)',
    stats: {
      initialBalance: 1000,
      finalBalance: 1000,
      roi: '0.0%',
      winRate: '-',
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'New'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 2000,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 80 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 80 },
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
      trades: 0,
      wins: 0,
      losses: 0,
      period: 'Verified'
    },
    rules: {
      entryWaitMin: 180,
      exitWaitMin: 2000,
      long: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 80 },
        '1h': { useMacdBeyondSig: true, useStochCross: true, useADX: false, adxThreshold: 30 },
        '1d': { useMacdBeyondSig: true, useStochCross: false, useMacdSigDiff: false, macdSigDiff: 0, useADX: false, adxThreshold: 15 }
      },
      short: {
        '5m': { useMacdVal: false, macdVal: 0, useMacdBeyondSig: false, useStochCross: true, useADX: true, adxThreshold: 80 },
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
