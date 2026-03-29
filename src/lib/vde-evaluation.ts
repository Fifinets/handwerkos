// VDE measurement evaluation logic
// Pure functions for checking measured values against VDE normative limits

import type { MeasurementType, MeasurementResult, OverallResult, DeviceType } from '@/types/inspection';

// ============================================================================
// LIMIT TABLES
// ============================================================================

/** Insulation resistance minimum limits in MOhm, keyed by test voltage in V */
export const INSULATION_RESISTANCE_LIMITS: Record<number, number> = {
  250: 0.25,
  500: 1.0,
  1000: 1.0,
};

/** Loop impedance maximum limits in Ohm, keyed by fuse designation (e.g. "B16") */
export const LOOP_IMPEDANCE_LIMITS: Record<string, number> = {
  B6: 7.67,
  B10: 4.60,
  B13: 3.54,
  B16: 2.87,
  B20: 2.30,
  B25: 1.84,
  B32: 1.44,
  C6: 3.83,
  C10: 2.30,
  C13: 1.77,
  C16: 1.44,
  C20: 1.15,
  C25: 0.92,
  C32: 0.72,
};

/** RCD trip time limits in ms */
export const RCD_TRIP_TIME_LIMITS = {
  standard: 200,
  fast: 40,
} as const;

/** Protective conductor resistance limits in Ohm, keyed by device type */
export const PROTECTIVE_CONDUCTOR_LIMITS: Record<DeviceType, number> = {
  anlage: 1.0,
  geraet: 0.3,
};

/** General fixed limits */
export const FIXED_LIMITS = {
  earth_resistance_max: 2.0,       // Ohm
  voltage_drop_max: 4.0,           // %
  leakage_current_max: 3.5,        // mA
  touch_current_max: 0.5,          // mA
} as const;

// ============================================================================
// EVALUATION INPUT
// ============================================================================

export interface EvaluationInput {
  measurement_type: MeasurementType;
  measured_value: number;
  /** Test voltage in V, required for insulation_resistance */
  test_voltage?: number;
  /** Fuse type string e.g. "B16", required for loop_impedance */
  fuse_type?: string;
  /** Rated RCD current in mA, required for rcd_trip_current */
  rated_current?: number;
  /** 'standard' or 'fast', used for rcd_trip_time */
  rcd_type?: 'standard' | 'fast';
  /** Device type, used for protective_conductor */
  device_type?: DeviceType;
}

export interface EvaluationResult {
  result: MeasurementResult;
  limit_value: number;
  limit_type: 'min' | 'max';
  within_tolerance: boolean;
}

// ============================================================================
// EVALUATE SINGLE MEASUREMENT
// ============================================================================

export function evaluateMeasurement(input: EvaluationInput): EvaluationResult {
  const { measurement_type, measured_value } = input;

  switch (measurement_type) {
    case 'insulation_resistance': {
      const voltage = input.test_voltage || 500;
      const limit = INSULATION_RESISTANCE_LIMITS[voltage] ?? 1.0;
      return {
        result: measured_value >= limit ? 'pass' : 'fail',
        limit_value: limit,
        limit_type: 'min',
        within_tolerance: measured_value >= limit,
      };
    }

    case 'loop_impedance': {
      const fuse = input.fuse_type || 'B16';
      const limit = LOOP_IMPEDANCE_LIMITS[fuse] ?? 2.87;
      return {
        result: measured_value <= limit ? 'pass' : 'fail',
        limit_value: limit,
        limit_type: 'max',
        within_tolerance: measured_value <= limit,
      };
    }

    case 'rcd_trip_time': {
      const rcdType = input.rcd_type || 'standard';
      const limit = RCD_TRIP_TIME_LIMITS[rcdType];
      return {
        result: measured_value <= limit ? 'pass' : 'fail',
        limit_value: limit,
        limit_type: 'max',
        within_tolerance: measured_value <= limit,
      };
    }

    case 'rcd_trip_current': {
      const rated = input.rated_current || 30;
      const minLimit = rated * 0.5;
      const maxLimit = rated * 1.0;
      const pass = measured_value >= minLimit && measured_value <= maxLimit;
      return {
        result: pass ? 'pass' : 'fail',
        limit_value: maxLimit,
        limit_type: 'max',
        within_tolerance: pass,
      };
    }

    case 'protective_conductor': {
      const deviceType = input.device_type || 'geraet';
      const limit = PROTECTIVE_CONDUCTOR_LIMITS[deviceType];
      return {
        result: measured_value <= limit ? 'pass' : 'fail',
        limit_value: limit,
        limit_type: 'max',
        within_tolerance: measured_value <= limit,
      };
    }

    case 'earth_resistance': {
      const limit = FIXED_LIMITS.earth_resistance_max;
      return {
        result: measured_value <= limit ? 'pass' : 'fail',
        limit_value: limit,
        limit_type: 'max',
        within_tolerance: measured_value <= limit,
      };
    }

    case 'voltage_drop': {
      const limit = FIXED_LIMITS.voltage_drop_max;
      return {
        result: measured_value <= limit ? 'pass' : 'fail',
        limit_value: limit,
        limit_type: 'max',
        within_tolerance: measured_value <= limit,
      };
    }

    case 'leakage_current': {
      const limit = FIXED_LIMITS.leakage_current_max;
      return {
        result: measured_value <= limit ? 'pass' : 'fail',
        limit_value: limit,
        limit_type: 'max',
        within_tolerance: measured_value <= limit,
      };
    }

    case 'touch_current': {
      const limit = FIXED_LIMITS.touch_current_max;
      return {
        result: measured_value <= limit ? 'pass' : 'fail',
        limit_value: limit,
        limit_type: 'max',
        within_tolerance: measured_value <= limit,
      };
    }

    default: {
      // Unknown measurement type: fail-safe
      return {
        result: 'fail',
        limit_value: 0,
        limit_type: 'max',
        within_tolerance: false,
      };
    }
  }
}

// ============================================================================
// EVALUATE ALL MEASUREMENTS -> OVERALL RESULT
// ============================================================================

export interface MeasurementForEvaluation {
  result: MeasurementResult;
}

/**
 * Evaluates an array of measurement results to determine overall protocol result.
 * - All pass -> 'pass'
 * - Any fail -> 'fail'
 * - Mixed (no measurements) -> 'conditional'
 */
export function evaluateResults(measurements: MeasurementForEvaluation[]): OverallResult {
  if (measurements.length === 0) {
    return 'conditional';
  }

  const failCount = measurements.filter(m => m.result === 'fail').length;
  const passCount = measurements.filter(m => m.result === 'pass').length;

  if (failCount > 0) {
    return 'fail';
  }

  if (passCount === measurements.length) {
    return 'pass';
  }

  return 'conditional';
}
