import { createRegistry, type ActionRegistry } from "./types";
import { handler as email } from "./email";
import { handler as slack } from "./slack";
import { handler as discord } from "./discord";
import { handler as httpRequest } from "./http-request";
import { handler as delay } from "./delay";
import { handler as filter } from "./filter";

export const registry: ActionRegistry = createRegistry([
  email,
  slack,
  discord,
  httpRequest,
  delay,
  filter,
]);

export {
  createRegistry,
  getHandler,
  hasHandler,
  listHandlers,
  DuplicateActionError,
  UnknownActionError,
  type ActionRegistry,
  type ActionHandler,
  type ActionRunInput,
  type ActionOutcome,
  type FieldSpec,
  type FieldType,
} from "./types";

export {
  assertSafeUrl,
  isBlockedIp,
  isBlockedHostname,
  isAllowlisted,
  SsrfError,
  BLOCKED_IPV4_CIDRS,
  ALLOWED_PROTOCOLS,
  REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  METADATA_IP,
} from "./lib/ssrf";
