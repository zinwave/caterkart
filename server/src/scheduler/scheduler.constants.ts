export const PLACEMENT_QUEUE = 'placement';
export const TRACKING_QUEUE = 'tracking';

export interface PlacementJob {
  subOrderId: string;
  celebrationId: string;
  userId: string;
}

export interface TrackingJob {
  subOrderId: string;
  celebrationId: string;
  userId: string;
}

export const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'] as const;
