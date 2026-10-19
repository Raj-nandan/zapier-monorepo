import { Kafka, Producer, Consumer, logLevel } from "kafkajs";
import { env } from "@repo/config";

const kafka = new Kafka({
  clientId: "zapier-monorepo",
  brokers: [env.KAFKA_BROKERS || "localhost:9092"],
  logLevel: logLevel.WARN,
});

export function createProducer(): Producer {
  return kafka.producer({
    idempotent: true,
    maxInFlightRequests: 5,
    retry: { retries: 5 },
  });
}

export function createConsumer(groupId: string): Consumer {
  return kafka.consumer({
    groupId,
    maxWaitTimeInMs: 5000,
    maxBytes: 1048576,
  });
}

export { kafka };
