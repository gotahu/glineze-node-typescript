export type ServiceHealth = {
  id: string;
  name: string;
  state: 'operational' | 'degraded' | 'offline' | 'disabled';
  label: string;
  detail: string;
  meta: string;
  attempts?: number;
  skipped?: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastDurationMs?: number;
  lastError?: string;
};

export type PopularReaction = {
  emoji: string;
  count: number;
};

export type StatusSnapshot = {
  generatedAt: string;
  overall: 'operational' | 'degraded' | 'offline';
  services: ServiceHealth[];
  system: {
    uptimeSeconds: number;
    requestsToday: number;
    requestsTotal: number;
    memoryRssBytes: number;
    startedAt: string;
  };
  activity: {
    discordMessagesToday: number;
    discordReactionsToday: number;
    popularReactions: PopularReaction[];
  };
};
