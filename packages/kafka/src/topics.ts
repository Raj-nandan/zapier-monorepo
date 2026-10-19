export const ZAP_EVENTS_PARTITIONS = 12;
export const ZAP_EVENTS_KEY = "zapId";

export const topics = {
  zapEvents: "zap-events",
  zapEventsRetry: "zap-events.retry",
  zapEventsDLT: "zap-events.DLT",
} as const;

export const topicConfig = {
  [topics.zapEvents]: { numPartitions: ZAP_EVENTS_PARTITIONS, key: ZAP_EVENTS_KEY },
  [topics.zapEventsRetry]: { numPartitions: ZAP_EVENTS_PARTITIONS, key: ZAP_EVENTS_KEY },
  [topics.zapEventsDLT]: { numPartitions: ZAP_EVENTS_PARTITIONS, key: ZAP_EVENTS_KEY },
} as const;
