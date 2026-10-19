import { createRegistry, type TriggerRegistry } from "./types";
import { handler as webhook } from "./webhook";
import { handler as schedule } from "./schedule";
import { handler as manual } from "./manual";
import { handler as githubPoll } from "./github-poll";
import { handler as rssPoll } from "./rss-poll";

export const registry: TriggerRegistry = createRegistry([
  webhook,
  schedule,
  manual,
  githubPoll,
  rssPoll,
]);

export {
  createRegistry,
  getHandler,
  hasHandler,
  listHandlers,
  DuplicateTriggerError,
  UnknownTriggerError,
  type TriggerRegistry,
  type TriggerHandler,
  type TriggerSampleInput,
  type FieldSpec,
  type FieldType,
} from "./types";

export { nextRunAt, isValidCron } from "./schedule";
export { itemsAfterCursor as itemsAfterCursorGithub, advanceCursor as advanceCursorGithub } from "./github-poll";
export { itemsAfterCursor as itemsAfterCursorRss, advanceCursor as advanceCursorRss } from "./rss-poll";
