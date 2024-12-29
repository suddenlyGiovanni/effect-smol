/**
 * @since 2.0.0
 */
import * as Context from "./Context.js"
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import * as core from "./internal/core.js"

/**
 * @since 2.0.0
 * @category symbols
 */
export const ClockTypeId: unique symbol = Symbol.for("effect/Clock")

/**
 * @since 2.0.0
 * @category symbols
 */
export type ClockTypeId = typeof ClockTypeId

/**
 * Represents a time-based clock which provides functionality related to time
 * and scheduling.
 *
 * @since 2.0.0
 * @category models
 */
export interface Clock {
  readonly [ClockTypeId]: ClockTypeId
  /**
   * Unsafely returns the current time in milliseconds.
   */
  unsafeCurrentTimeMillis(): number
  /**
   * Returns the current time in milliseconds.
   */
  readonly currentTimeMillis: Effect<number>
  /**
   * Unsafely returns the current time in nanoseconds.
   */
  unsafeCurrentTimeNanos(): bigint
  /**
   * Returns the current time in nanoseconds.
   */
  readonly currentTimeNanos: Effect<bigint>
  /**
   * Asynchronously sleeps for the specified duration.
   */
  sleep(duration: Duration.Duration): Effect<void>
}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentClock extends Context.Reference<CurrentClock>()("effect/Clock/CurrentClock", {
  defaultValue: (): Clock => new ClockImpl()
}) {}

const MAX_TIMER_MILLIS = 2 ** 31 - 1

class ClockImpl implements Clock {
  readonly [ClockTypeId]: ClockTypeId = ClockTypeId
  unsafeCurrentTimeMillis(): number {
    return Date.now()
  }
  readonly currentTimeMillis: Effect<number> = core.sync(() => this.unsafeCurrentTimeMillis())
  unsafeCurrentTimeNanos(): bigint {
    return processOrPerformanceNow()
  }
  readonly currentTimeNanos: Effect<bigint> = core.sync(() => this.unsafeCurrentTimeNanos())
  sleep(duration: Duration.Duration): Effect<void> {
    const millis = Duration.toMillis(duration)
    return core.async((resume) => {
      if (millis > MAX_TIMER_MILLIS) return
      const handle = setTimeout(() => resume(core.void), millis)
      return core.sync(() => {
        clearTimeout(handle)
      })
    })
  }
}

const performanceNowNanos = (function() {
  const bigint1e6 = BigInt(1_000_000)
  if (typeof performance === "undefined") {
    return () => BigInt(Date.now()) * bigint1e6
  } else if (typeof performance.timeOrigin === "number" && performance.timeOrigin === 0) {
    return () => BigInt(Math.round(performance.now() * 1_000_000))
  }
  const origin = (BigInt(Date.now()) * bigint1e6) - BigInt(Math.round(performance.now() * 1_000_000))
  return () => origin + BigInt(Math.round(performance.now() * 1_000_000))
})()
const processOrPerformanceNow = (function() {
  const processHrtime =
    typeof process === "object" && "hrtime" in process && typeof process.hrtime.bigint === "function" ?
      process.hrtime :
      undefined
  if (!processHrtime) {
    return performanceNowNanos
  }
  const origin = performanceNowNanos() - processHrtime.bigint()
  return () => origin + processHrtime.bigint()
})()

/**
 * @since 2.0.0
 * @category constructors
 */
export const clockWith = <A, E, R>(f: (clock: Clock) => Effect<A, E, R>): Effect<A, E, R> =>
  core.withFiberUnknown((fiber) => f(Context.get(fiber.context, CurrentClock)))

/**
 * @since 2.0.0
 * @category constructors
 */
export const sleep = (duration: Duration.DurationInput): Effect<void> =>
  clockWith((clock) => clock.sleep(Duration.decode(duration)))

/**
 * @since 2.0.0
 * @category constructors
 */
export const currentTimeMillis: Effect<number> = clockWith((clock) => clock.currentTimeMillis)

/**
 * @since 2.0.0
 * @category constructors
 */
export const currentTimeNanos: Effect<bigint> = clockWith((clock) => clock.currentTimeNanos)

/**
 * @since 2.0.0
 * @category context
 */
export const Clock: Context.Tag<Clock, Clock> = Context.GenericTag("effect/Clock")
