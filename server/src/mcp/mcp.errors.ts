/** Caller must restart the OAuth flow (token expired/revoked — 401, no refresh in v1). */
export class NeedsReauthError extends Error {
  constructor(public readonly userId: string) {
    super(`Swiggy authorization required for user ${userId}`);
    this.name = 'NeedsReauthError';
  }
}

/**
 * A non-idempotent placement (place_food_order / checkout) failed mid-flight.
 * MUST NOT be retried blindly — the order may have gone through. Reconcile via
 * get_food_orders / get_orders before any retry.
 */
export class PlacementFailedError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly cause: unknown,
  ) {
    super(`Placement ${toolName} failed and is unsafe to retry: ${String(cause)}`);
    this.name = 'PlacementFailedError';
  }
}

/**
 * A tool ran but Swiggy refused it, with a human-readable reason in the text
 * content ("Coupon does not exist", "Add ₹610 more to avail this offer").
 * Callers should surface `.reason` to the user rather than a 500.
 */
export class ToolError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly reason: string,
  ) {
    super(reason);
    this.name = 'ToolError';
  }
}
