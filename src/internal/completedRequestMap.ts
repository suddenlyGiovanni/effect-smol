import * as Context from "../Context.js"
import type { Entry } from "../Request.js"

/** @internal */
export class CompletedRequestMap extends Context.Reference<CompletedRequestMap>()("CompletedRequestMap", {
  defaultValue: () => new Set<Entry<any>>()
}) {}
