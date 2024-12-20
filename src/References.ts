/**
 * @since 4.0.0
 */
import * as Context from "./Context.js"
import type { Scheduler } from "./Scheduler.js"
import { MaxOpsBeforeYield, MixedScheduler } from "./Scheduler.js"

export {
  /**
   * @since 4.0.0
   * @category references
   */
  MaxOpsBeforeYield
}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentConcurrency extends Context.Reference<CurrentConcurrency>()<
  "effect/Effect/currentConcurrency",
  "unbounded" | number
>("effect/Effect/currentConcurrency", { defaultValue: () => "unbounded" }) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentScheduler extends Context.Reference<CurrentScheduler>()<
  "effect/Effect/currentScheduler",
  Scheduler
>("effect/Effect/currentScheduler", {
  defaultValue: () => new MixedScheduler()
}) {}
