import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlannableSubOrder {
  id: string;
  kind: 'FOOD' | 'INSTAMART';
  /** best ETA-to-doorstep estimate, minutes (food: restaurant hint; im: fast) */
  estimatedEtaMin: number;
}

export interface PlanEntry {
  subOrderId: string;
  estimatedEtaMin: number;
  fireAtMs: number; // absolute epoch ms
}

export interface ComputedPlan {
  targetConvergenceMin: number;
  preDropLeadMin: number;
  entries: PlanEntry[];
}

/**
 * Turns "I want everything to arrive together, with supplies 15 min early" into
 * concrete per-order fire times — Swiggy has no scheduled delivery, so we
 * stagger when we call place_*.
 *
 *   foodLandAt   = T0 + max(foodEta)          // slowest food sets the convergence point
 *   food.fireAt  = foodLandAt - thisFoodEta   // faster restaurants fire later
 *   im.fireAt    = max(T0, foodLandAt - preDropLead - imEta)  // pre-drop lands earlier
 *
 * ETAs are estimates (MCP exposes no pre-order ETA), so convergence is a target,
 * not a guarantee — the tracking loop corrects the story for the user.
 */
@Injectable()
export class PlacementPlannerService {
  private readonly preDropLead: number;
  private readonly tolerance: number;
  private static readonly DEFAULT_FOOD_ETA = 32;
  private static readonly DEFAULT_IM_ETA = 12;

  constructor(config: ConfigService) {
    this.preDropLead = config.get<number>('orchestration.preDropLeadMin', 15);
    this.tolerance = config.get<number>('orchestration.convergenceToleranceMin', 5);
  }

  compute(subs: PlannableSubOrder[], t0Ms: number): ComputedPlan {
    const min = 60_000;
    const food = subs.filter((s) => s.kind === 'FOOD');
    const im = subs.filter((s) => s.kind === 'INSTAMART');

    const maxFoodEta = food.length ? Math.max(...food.map((s) => s.estimatedEtaMin)) : 0;
    const foodLandAtMs = t0Ms + maxFoodEta * min;

    const entries: PlanEntry[] = [];

    for (const s of food) {
      const fireAtMs = Math.max(t0Ms, foodLandAtMs - s.estimatedEtaMin * min);
      entries.push({ subOrderId: s.id, estimatedEtaMin: s.estimatedEtaMin, fireAtMs });
    }

    // Pre-drop target: preDropLead minutes before food lands (or before T0 if no food).
    const preDropTargetMs = (food.length ? foodLandAtMs : t0Ms) - this.preDropLead * min;
    for (const s of im) {
      const eta = s.estimatedEtaMin || PlacementPlannerService.DEFAULT_IM_ETA;
      const fireAtMs = Math.max(t0Ms, preDropTargetMs - eta * min);
      entries.push({ subOrderId: s.id, estimatedEtaMin: eta, fireAtMs });
    }

    return { targetConvergenceMin: this.tolerance, preDropLeadMin: this.preDropLead, entries };
  }

  defaultEta(kind: 'FOOD' | 'INSTAMART', hint?: number | null): number {
    if (hint && hint > 0) return hint;
    return kind === 'FOOD'
      ? PlacementPlannerService.DEFAULT_FOOD_ETA
      : PlacementPlannerService.DEFAULT_IM_ETA;
  }
}
