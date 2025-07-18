/**
 * This module provides utilities for working with durations of time. A `Duration`
 * is an immutable data type that represents a span of time with high precision,
 * supporting operations from nanoseconds to weeks.
 *
 * Durations support:
 * - **High precision**: Nanosecond-level accuracy using BigInt
 * - **Multiple formats**: Numbers (millis), BigInt (nanos), tuples, strings
 * - **Arithmetic operations**: Add, subtract, multiply, divide
 * - **Comparisons**: Equal, less than, greater than
 * - **Conversions**: Between different time units
 * - **Human-readable formatting**: Pretty printing and parsing
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Duration } from "effect/time"
 *
 * // Creating durations
 * const oneSecond = Duration.seconds(1)
 * const fiveMinutes = Duration.minutes(5)
 * const oneHour = Duration.decode("1 hour")
 * const precise = Duration.nanos(BigInt(123456789))
 *
 * // Arithmetic operations
 * const total = Duration.sum(Duration.sum(oneSecond, fiveMinutes), oneHour)
 * const double = Duration.times(oneSecond, 2)
 * const half = Duration.divide(oneSecond, 2)
 *
 * // Comparisons
 * const isLonger = Duration.greaterThan(fiveMinutes, oneSecond) // true
 * const isEqual = Duration.equals(oneSecond, Duration.millis(1000)) // true
 *
 * // Converting and formatting
 * console.log(Duration.toMillis(oneSecond)) // 1000
 * console.log(Duration.format(fiveMinutes)) // "5m"
 *
 * // Using with Effects
 * const program = Effect.gen(function* () {
 *   console.log("Starting...")
 *   yield* Effect.sleep(Duration.seconds(2))
 *   console.log("Done!")
 * })
 * ```
 *
 * @since 2.0.0
 */
import type * as equivalence from "../data/Equivalence.ts"
import * as Option from "../data/Option.ts"
import * as order from "../data/Order.ts"
import { hasProperty, isBigInt, isNumber, isString } from "../data/Predicate.ts"
import { dual } from "../Function.ts"
import * as Equal from "../interfaces/Equal.ts"
import * as Hash from "../interfaces/Hash.ts"
import * as Inspectable from "../interfaces/Inspectable.ts"
import { NodeInspectSymbol } from "../interfaces/Inspectable.ts"
import type { Pipeable } from "../interfaces/Pipeable.ts"
import { pipeArguments } from "../interfaces/Pipeable.ts"

/**
 * The unique type identifier for Duration values.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.seconds(5)
 * console.log(duration[Duration.TypeId]) // Symbol(effect/Duration)
 * ```
 *
 * @category symbols
 * @since 2.0.0
 */
export const TypeId: unique symbol = Symbol.for("effect/Duration")

const bigint0 = BigInt(0)
const bigint24 = BigInt(24)
const bigint60 = BigInt(60)
const bigint1e3 = BigInt(1_000)
const bigint1e6 = BigInt(1_000_000)
const bigint1e9 = BigInt(1_000_000_000)

/**
 * The unique type identifier for Duration values.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * type IdType = Duration.TypeId // unique symbol
 * const duration = Duration.seconds(5)
 * console.log(duration[Duration.TypeId] === Duration.TypeId) // true
 * ```
 *
 * @category symbols
 * @since 2.0.0
 */
export type TypeId = typeof TypeId

/**
 * Represents a span of time with high precision, supporting operations from nanoseconds to weeks.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 * import * as Equal from "effect/interfaces/Equal"
 *
 * const duration: Duration.Duration = Duration.seconds(5)
 * console.log(Duration.toMillis(duration)) // 5000
 *
 * // Duration implements Equal, so you can compare durations
 * const another = Duration.millis(5000)
 * console.log(Equal.equals(duration, another)) // true
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Duration extends Equal.Equal, Pipeable, Inspectable.Inspectable {
  readonly [TypeId]: TypeId
  readonly value: DurationValue
}
/**
 * The internal representation of a Duration value.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const milliDuration = Duration.millis(1000)
 * const nanoDuration = Duration.nanos(BigInt(1000000000))
 * const infiniteDuration = Duration.infinity
 *
 * // Access internal value (usually not needed in user code)
 * console.log(milliDuration.value._tag) // "Millis"
 * console.log(nanoDuration.value._tag) // "Nanos"
 * console.log(infiniteDuration.value._tag) // "Infinity"
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type DurationValue =
  | { _tag: "Millis"; millis: number }
  | { _tag: "Nanos"; nanos: bigint }
  | { _tag: "Infinity" }

/**
 * Valid time units that can be used in duration string representations.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * // All supported units (singular and plural forms)
 * const units: Duration.Unit[] = [
 *   "nano", "nanos", "micro", "micros", "milli", "millis",
 *   "second", "seconds", "minute", "minutes", "hour", "hours",
 *   "day", "days", "week", "weeks"
 * ]
 *
 * // Used in string-based duration creation
 * const duration1 = Duration.decode("5 seconds")
 * const duration2 = Duration.decode("1 hour")
 * const duration3 = Duration.decode("2 days")
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type Unit =
  | "nano"
  | "nanos"
  | "micro"
  | "micros"
  | "milli"
  | "millis"
  | "second"
  | "seconds"
  | "minute"
  | "minutes"
  | "hour"
  | "hours"
  | "day"
  | "days"
  | "week"
  | "weeks"

/**
 * Valid input types that can be converted to a Duration.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * // Different ways to create durations
 * const duration1: Duration.DurationInput = Duration.seconds(5)
 * const duration2: Duration.DurationInput = 5000 // milliseconds
 * const duration3: Duration.DurationInput = BigInt(5000000000) // nanoseconds
 * const duration4: Duration.DurationInput = [5, 500000000] // [seconds, nanos]
 * const duration5: Duration.DurationInput = "5 seconds"
 *
 * // All can be decoded to Duration
 * const decoded1 = Duration.decode(duration1)
 * const decoded2 = Duration.decode(duration2)
 * const decoded3 = Duration.decode(duration3)
 * const decoded4 = Duration.decode(duration4)
 * const decoded5 = Duration.decode(duration5)
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export type DurationInput =
  | Duration
  | number // millis
  | bigint // nanos
  | [seconds: number, nanos: number]
  | `${number} ${Unit}`

const DURATION_REGEX = /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/

/**
 * Decodes a DurationInput into a Duration.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration1 = Duration.decode(1000) // 1000 milliseconds
 * const duration2 = Duration.decode("5 seconds")
 * const duration3 = Duration.decode([2, 500_000_000]) // 2 seconds and 500ms
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const decode = (input: DurationInput): Duration => {
  if (isDuration(input)) {
    return input
  } else if (isNumber(input)) {
    return millis(input)
  } else if (isBigInt(input)) {
    return nanos(input)
  } else if (Array.isArray(input) && input.length === 2 && input.every(isNumber)) {
    if (input[0] === -Infinity || input[1] === -Infinity || Number.isNaN(input[0]) || Number.isNaN(input[1])) {
      return zero
    }

    if (input[0] === Infinity || input[1] === Infinity) {
      return infinity
    }

    return nanos(BigInt(Math.round(input[0] * 1_000_000_000)) + BigInt(Math.round(input[1])))
  } else if (isString(input)) {
    const match = DURATION_REGEX.exec(input)
    if (match) {
      const [_, valueStr, unit] = match
      const value = Number(valueStr)
      switch (unit) {
        case "nano":
        case "nanos":
          return nanos(BigInt(valueStr))
        case "micro":
        case "micros":
          return micros(BigInt(valueStr))
        case "milli":
        case "millis":
          return millis(value)
        case "second":
        case "seconds":
          return seconds(value)
        case "minute":
        case "minutes":
          return minutes(value)
        case "hour":
        case "hours":
          return hours(value)
        case "day":
        case "days":
          return days(value)
        case "week":
        case "weeks":
          return weeks(value)
      }
    }
  }
  throw new Error("Invalid DurationInput")
}

/**
 * Safely decodes an unknown value into a Duration, returning None if decoding fails.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 * import { Option } from "effect/data"
 *
 * const valid = Duration.decodeUnknown(1000)
 * console.log(Option.isSome(valid)) // true
 *
 * const invalid = Duration.decodeUnknown("invalid")
 * console.log(Option.isNone(invalid)) // true
 * ```
 *
 * @since 2.5.0
 * @category constructors
 */
export const decodeUnknown: (u: unknown) => Option.Option<Duration> = Option.liftThrowable(decode) as any

const zeroValue: DurationValue = { _tag: "Millis", millis: 0 }
const infinityValue: DurationValue = { _tag: "Infinity" }

const DurationProto: Omit<Duration, "value"> = {
  [TypeId]: TypeId,
  [Hash.symbol](this: Duration) {
    return Hash.cached(this, () => Hash.structure(this.value))
  },
  [Equal.symbol](this: Duration, that: unknown): boolean {
    return isDuration(that) && equals(this, that)
  },
  toString(this: Duration) {
    return Inspectable.format(this.toJSON())
  },
  toJSON(this: Duration) {
    switch (this.value._tag) {
      case "Millis":
        return { _id: "Duration", _tag: "Millis", millis: this.value.millis }
      case "Nanos":
        return { _id: "Duration", _tag: "Nanos", hrtime: toHrTime(this) }
      case "Infinity":
        return { _id: "Duration", _tag: "Infinity" }
    }
  },
  [NodeInspectSymbol]() {
    return this.toJSON()
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
} as const

const make = (input: number | bigint): Duration => {
  const duration = Object.create(DurationProto)
  if (isNumber(input)) {
    if (isNaN(input) || input <= 0) {
      duration.value = zeroValue
    } else if (!Number.isFinite(input)) {
      duration.value = infinityValue
    } else if (!Number.isInteger(input)) {
      duration.value = { _tag: "Nanos", nanos: BigInt(Math.round(input * 1_000_000)) }
    } else {
      duration.value = { _tag: "Millis", millis: input }
    }
  } else if (input <= bigint0) {
    duration.value = zeroValue
  } else {
    duration.value = { _tag: "Nanos", nanos: input }
  }
  return duration
}

/**
 * Checks if a value is a Duration.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.isDuration(Duration.seconds(1))) // true
 * console.log(Duration.isDuration(1000)) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isDuration = (u: unknown): u is Duration => hasProperty(u, TypeId)

/**
 * Checks if a Duration is finite (not infinite).
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.isFinite(Duration.seconds(5))) // true
 * console.log(Duration.isFinite(Duration.infinity)) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isFinite = (self: Duration): boolean => self.value._tag !== "Infinity"

/**
 * Checks if a Duration is zero.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.isZero(Duration.zero)) // true
 * console.log(Duration.isZero(Duration.seconds(1))) // false
 * ```
 *
 * @since 3.5.0
 * @category guards
 */
export const isZero = (self: Duration): boolean => {
  switch (self.value._tag) {
    case "Millis": {
      return self.value.millis === 0
    }
    case "Nanos": {
      return self.value.nanos === bigint0
    }
    case "Infinity": {
      return false
    }
  }
}

/**
 * A Duration representing zero time.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.toMillis(Duration.zero)) // 0
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const zero: Duration = make(0)

/**
 * A Duration representing infinite time.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.toMillis(Duration.infinity)) // Infinity
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const infinity: Duration = make(Infinity)

/**
 * Creates a Duration from nanoseconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.nanos(BigInt(500_000_000))
 * console.log(Duration.toMillis(duration)) // 500
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const nanos = (nanos: bigint): Duration => make(nanos)

/**
 * Creates a Duration from microseconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.micros(BigInt(500_000))
 * console.log(Duration.toMillis(duration)) // 500
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const micros = (micros: bigint): Duration => make(micros * bigint1e3)

/**
 * Creates a Duration from milliseconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.millis(1000)
 * console.log(Duration.toMillis(duration)) // 1000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const millis = (millis: number): Duration => make(millis)

/**
 * Creates a Duration from seconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.seconds(30)
 * console.log(Duration.toMillis(duration)) // 30000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const seconds = (seconds: number): Duration => make(seconds * 1000)

/**
 * Creates a Duration from minutes.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.minutes(5)
 * console.log(Duration.toMillis(duration)) // 300000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const minutes = (minutes: number): Duration => make(minutes * 60_000)

/**
 * Creates a Duration from hours.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.hours(2)
 * console.log(Duration.toMillis(duration)) // 7200000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const hours = (hours: number): Duration => make(hours * 3_600_000)

/**
 * Creates a Duration from days.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.days(1)
 * console.log(Duration.toMillis(duration)) // 86400000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const days = (days: number): Duration => make(days * 86_400_000)

/**
 * Creates a Duration from weeks.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.weeks(1)
 * console.log(Duration.toMillis(duration)) // 604800000
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const weeks = (weeks: number): Duration => make(weeks * 604_800_000)

/**
 * Converts a Duration to milliseconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.toMillis(Duration.seconds(5))) // 5000
 * console.log(Duration.toMillis(Duration.minutes(2))) // 120000
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const toMillis = (self: DurationInput): number =>
  match(self, {
    onMillis: (millis) => millis,
    onNanos: (nanos) => Number(nanos) / 1_000_000
  })

/**
 * Converts a Duration to seconds.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.toSeconds(Duration.millis(5000))) // 5
 * console.log(Duration.toSeconds(Duration.minutes(2))) // 120
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const toSeconds = (self: DurationInput): number =>
  match(self, {
    onMillis: (millis) => millis / 1_000,
    onNanos: (nanos) => Number(nanos) / 1_000_000_000
  })

/**
 * Converts a Duration to minutes.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.toMinutes(Duration.seconds(120))) // 2
 * console.log(Duration.toMinutes(Duration.hours(1))) // 60
 * ```
 *
 * @since 3.8.0
 * @category getters
 */
export const toMinutes = (self: DurationInput): number =>
  match(self, {
    onMillis: (millis) => millis / 60_000,
    onNanos: (nanos) => Number(nanos) / 60_000_000_000
  })

/**
 * Converts a Duration to hours.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.toHours(Duration.minutes(120))) // 2
 * console.log(Duration.toHours(Duration.days(1))) // 24
 * ```
 *
 * @since 3.8.0
 * @category getters
 */
export const toHours = (self: DurationInput): number =>
  match(self, {
    onMillis: (millis) => millis / 3_600_000,
    onNanos: (nanos) => Number(nanos) / 3_600_000_000_000
  })

/**
 * Converts a Duration to days.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.toDays(Duration.hours(48))) // 2
 * console.log(Duration.toDays(Duration.weeks(1))) // 7
 * ```
 *
 * @since 3.8.0
 * @category getters
 */
export const toDays = (self: DurationInput): number =>
  match(self, {
    onMillis: (millis) => millis / 86_400_000,
    onNanos: (nanos) => Number(nanos) / 86_400_000_000_000
  })

/**
 * Converts a Duration to weeks.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * console.log(Duration.toWeeks(Duration.days(14))) // 2
 * console.log(Duration.toWeeks(Duration.days(7))) // 1
 * ```
 *
 * @since 3.8.0
 * @category getters
 */
export const toWeeks = (self: DurationInput): number =>
  match(self, {
    onMillis: (millis) => millis / 604_800_000,
    onNanos: (nanos) => Number(nanos) / 604_800_000_000_000
  })

/**
 * Get the duration in nanoseconds as a bigint.
 *
 * If the duration is infinite, returns `Option.none()`
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 * import { Option } from "effect/data"
 *
 * const duration = Duration.seconds(1)
 * const nanos = Duration.toNanos(duration)
 * console.log(Option.getOrNull(nanos)) // 1000000000n
 *
 * const infinite = Duration.infinity
 * const infiniteNanos = Duration.toNanos(infinite)
 * console.log(Option.isNone(infiniteNanos)) // true
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const toNanos = (self: DurationInput): Option.Option<bigint> => {
  const _self = decode(self)
  switch (_self.value._tag) {
    case "Infinity":
      return Option.none()
    case "Nanos":
      return Option.some(_self.value.nanos)
    case "Millis":
      return Option.some(BigInt(Math.round(_self.value.millis * 1_000_000)))
  }
}

/**
 * Get the duration in nanoseconds as a bigint.
 *
 * If the duration is infinite, it throws an error.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.seconds(2)
 * const nanos = Duration.unsafeToNanos(duration)
 * console.log(nanos) // 2000000000n
 *
 * // This will throw an error
 * try {
 *   Duration.unsafeToNanos(Duration.infinity)
 * } catch (error) {
 *   console.log((error as Error).message) // "Cannot convert infinite duration to nanos"
 * }
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const unsafeToNanos = (self: DurationInput): bigint => {
  const _self = decode(self)
  switch (_self.value._tag) {
    case "Infinity":
      throw new Error("Cannot convert infinite duration to nanos")
    case "Nanos":
      return _self.value.nanos
    case "Millis":
      return BigInt(Math.round(_self.value.millis * 1_000_000))
  }
}

/**
 * Converts a Duration to high-resolution time format [seconds, nanoseconds].
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const duration = Duration.millis(1500)
 * const hrtime = Duration.toHrTime(duration)
 * console.log(hrtime) // [1, 500000000]
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const toHrTime = (self: DurationInput): [seconds: number, nanos: number] => {
  const _self = decode(self)
  switch (_self.value._tag) {
    case "Infinity":
      return [Infinity, 0]
    case "Nanos":
      return [
        Number(_self.value.nanos / bigint1e9),
        Number(_self.value.nanos % bigint1e9)
      ]
    case "Millis":
      return [
        Math.floor(_self.value.millis / 1000),
        Math.round((_self.value.millis % 1000) * 1_000_000)
      ]
  }
}

/**
 * Pattern matches on a Duration, providing different handlers for millis and nanos.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const result = Duration.match(Duration.seconds(5), {
 *   onMillis: (millis) => `${millis} milliseconds`,
 *   onNanos: (nanos) => `${nanos} nanoseconds`
 * })
 * console.log(result) // "5000 milliseconds"
 * ```
 *
 * @since 2.0.0
 * @category pattern matching
 */
export const match: {
  <A, B>(
    options: {
      readonly onMillis: (millis: number) => A
      readonly onNanos: (nanos: bigint) => B
    }
  ): (self: DurationInput) => A | B
  <A, B>(
    self: DurationInput,
    options: {
      readonly onMillis: (millis: number) => A
      readonly onNanos: (nanos: bigint) => B
    }
  ): A | B
} = dual(2, <A, B>(
  self: DurationInput,
  options: {
    readonly onMillis: (millis: number) => A
    readonly onNanos: (nanos: bigint) => B
  }
): A | B => {
  const _self = decode(self)
  switch (_self.value._tag) {
    case "Nanos":
      return options.onNanos(_self.value.nanos)
    case "Infinity":
      return options.onMillis(Infinity)
    case "Millis":
      return options.onMillis(_self.value.millis)
  }
})

/**
 * Pattern matches on two Durations, providing handlers that receive both values.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const sum = Duration.matchWith(Duration.seconds(3), Duration.seconds(2), {
 *   onMillis: (a, b) => a + b,
 *   onNanos: (a, b) => Number(a + b)
 * })
 * console.log(sum) // 5000
 * ```
 *
 * @since 2.0.0
 * @category pattern matching
 */
export const matchWith: {
  <A, B>(
    that: DurationInput,
    options: {
      readonly onMillis: (self: number, that: number) => A
      readonly onNanos: (self: bigint, that: bigint) => B
    }
  ): (self: DurationInput) => A | B
  <A, B>(
    self: DurationInput,
    that: DurationInput,
    options: {
      readonly onMillis: (self: number, that: number) => A
      readonly onNanos: (self: bigint, that: bigint) => B
    }
  ): A | B
} = dual(3, <A, B>(
  self: DurationInput,
  that: DurationInput,
  options: {
    readonly onMillis: (self: number, that: number) => A
    readonly onNanos: (self: bigint, that: bigint) => B
  }
): A | B => {
  const _self = decode(self)
  const _that = decode(that)
  if (_self.value._tag === "Infinity" || _that.value._tag === "Infinity") {
    return options.onMillis(
      toMillis(_self),
      toMillis(_that)
    )
  } else if (_self.value._tag === "Nanos" || _that.value._tag === "Nanos") {
    const selfNanos = _self.value._tag === "Nanos" ?
      _self.value.nanos :
      BigInt(Math.round(_self.value.millis * 1_000_000))
    const thatNanos = _that.value._tag === "Nanos" ?
      _that.value.nanos :
      BigInt(Math.round(_that.value.millis * 1_000_000))
    return options.onNanos(selfNanos, thatNanos)
  }

  return options.onMillis(
    _self.value.millis,
    _that.value.millis
  )
})

/**
 * Order instance for Duration, allowing comparison operations.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const durations = [Duration.seconds(3), Duration.seconds(1), Duration.seconds(2)]
 * const sorted = durations.sort((a, b) => Duration.Order(a, b))
 * console.log(sorted.map(Duration.toSeconds)) // [1, 2, 3]
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const Order: order.Order<Duration> = order.make((self, that) =>
  matchWith(self, that, {
    onMillis: (self, that) => (self < that ? -1 : self > that ? 1 : 0),
    onNanos: (self, that) => (self < that ? -1 : self > that ? 1 : 0)
  })
)

/**
 * Checks if a `Duration` is between a `minimum` and `maximum` value.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const isInRange = Duration.between(Duration.seconds(3), {
 *   minimum: Duration.seconds(2),
 *   maximum: Duration.seconds(5)
 * })
 * console.log(isInRange) // true
 * ```
 *
 * @category predicates
 * @since 2.0.0
 */
export const between: {
  (options: {
    minimum: DurationInput
    maximum: DurationInput
  }): (self: DurationInput) => boolean
  (self: DurationInput, options: {
    minimum: DurationInput
    maximum: DurationInput
  }): boolean
} = order.between(order.mapInput(Order, decode))

/**
 * Equivalence instance for Duration, allowing equality comparisons.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const isEqual = Duration.Equivalence(Duration.seconds(5), Duration.millis(5000))
 * console.log(isEqual) // true
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const Equivalence: equivalence.Equivalence<Duration> = (self, that) =>
  matchWith(self, that, {
    onMillis: (self, that) => self === that,
    onNanos: (self, that) => self === that
  })

const _min = order.min(Order)

/**
 * Returns the smaller of two Durations.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const shorter = Duration.min(Duration.seconds(5), Duration.seconds(3))
 * console.log(Duration.toSeconds(shorter)) // 3
 * ```
 *
 * @since 2.0.0
 * @category order
 */
export const min: {
  (that: DurationInput): (self: DurationInput) => Duration
  (self: DurationInput, that: DurationInput): Duration
} = dual(2, (self: DurationInput, that: DurationInput): Duration => _min(decode(self), decode(that)))

const _max = order.max(Order)

/**
 * Returns the larger of two Durations.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const longer = Duration.max(Duration.seconds(5), Duration.seconds(3))
 * console.log(Duration.toSeconds(longer)) // 5
 * ```
 *
 * @since 2.0.0
 * @category order
 */
export const max: {
  (that: DurationInput): (self: DurationInput) => Duration
  (self: DurationInput, that: DurationInput): Duration
} = dual(2, (self: DurationInput, that: DurationInput): Duration => _max(decode(self), decode(that)))

const _clamp = order.clamp(Order)

/**
 * Clamps a Duration between a minimum and maximum value.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const clamped = Duration.clamp(Duration.seconds(10), {
 *   minimum: Duration.seconds(2),
 *   maximum: Duration.seconds(5)
 * })
 * console.log(Duration.toSeconds(clamped)) // 5
 * ```
 *
 * @since 2.0.0
 * @category order
 */
export const clamp: {
  (options: {
    minimum: DurationInput
    maximum: DurationInput
  }): (self: DurationInput) => Duration
  (self: DurationInput, options: {
    minimum: DurationInput
    maximum: DurationInput
  }): Duration
} = dual(
  2,
  (self: DurationInput, options: {
    minimum: DurationInput
    maximum: DurationInput
  }): Duration =>
    _clamp(decode(self), {
      minimum: decode(options.minimum),
      maximum: decode(options.maximum)
    })
)

/**
 * Divides a Duration by a number, returning None if division is invalid.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 * import { Option } from "effect/data"
 *
 * const half = Duration.divide(Duration.seconds(10), 2)
 * console.log(Option.map(half, Duration.toSeconds)) // Some(5)
 *
 * const invalid = Duration.divide(Duration.seconds(10), 0)
 * console.log(Option.isNone(invalid)) // true
 * ```
 *
 * @since 2.4.19
 * @category math
 */
export const divide: {
  (by: number): (self: DurationInput) => Option.Option<Duration>
  (self: DurationInput, by: number): Option.Option<Duration>
} = dual(
  2,
  (self: DurationInput, by: number): Option.Option<Duration> =>
    match(self, {
      onMillis: (millis) => {
        if (by === 0 || isNaN(by) || !Number.isFinite(by)) {
          return Option.none()
        }
        return Option.some(make(millis / by))
      },
      onNanos: (nanos) => {
        if (isNaN(by) || by <= 0 || !Number.isFinite(by)) {
          return Option.none()
        }
        try {
          return Option.some(make(nanos / BigInt(by)))
        } catch {
          return Option.none()
        }
      }
    })
)

/**
 * Divides a Duration by a number, potentially returning infinity or zero.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const half = Duration.unsafeDivide(Duration.seconds(10), 2)
 * console.log(Duration.toSeconds(half)) // 5
 *
 * const infinite = Duration.unsafeDivide(Duration.seconds(10), 0)
 * console.log(Duration.toMillis(infinite)) // Infinity
 * ```
 *
 * @since 2.4.19
 * @category math
 */
export const unsafeDivide: {
  (by: number): (self: DurationInput) => Duration
  (self: DurationInput, by: number): Duration
} = dual(
  2,
  (self: DurationInput, by: number): Duration =>
    match(self, {
      onMillis: (millis) => make(millis / by),
      onNanos: (nanos) => {
        if (isNaN(by) || by < 0 || Object.is(by, -0)) {
          return zero
        } else if (Object.is(by, 0) || !Number.isFinite(by)) {
          return infinity
        }
        return make(nanos / BigInt(by))
      }
    })
)

/**
 * Multiplies a Duration by a number.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const doubled = Duration.times(Duration.seconds(5), 2)
 * console.log(Duration.toSeconds(doubled)) // 10
 * ```
 *
 * @since 2.0.0
 * @category math
 */
export const times: {
  (times: number): (self: DurationInput) => Duration
  (self: DurationInput, times: number): Duration
} = dual(
  2,
  (self: DurationInput, times: number): Duration =>
    match(self, {
      onMillis: (millis) => make(millis * times),
      onNanos: (nanos) => make(nanos * BigInt(times))
    })
)

/**
 * Subtracts one Duration from another.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const result = Duration.subtract(Duration.seconds(10), Duration.seconds(3))
 * console.log(Duration.toSeconds(result)) // 7
 * ```
 *
 * @since 2.0.0
 * @category math
 */
export const subtract: {
  (that: DurationInput): (self: DurationInput) => Duration
  (self: DurationInput, that: DurationInput): Duration
} = dual(
  2,
  (self: DurationInput, that: DurationInput): Duration =>
    matchWith(self, that, {
      onMillis: (self, that) => make(self - that),
      onNanos: (self, that) => make(self - that)
    })
)

/**
 * Adds two Durations together.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const total = Duration.sum(Duration.seconds(5), Duration.seconds(3))
 * console.log(Duration.toSeconds(total)) // 8
 * ```
 *
 * @since 2.0.0
 * @category math
 */
export const sum: {
  (that: DurationInput): (self: DurationInput) => Duration
  (self: DurationInput, that: DurationInput): Duration
} = dual(
  2,
  (self: DurationInput, that: DurationInput): Duration =>
    matchWith(self, that, {
      onMillis: (self, that) => make(self + that),
      onNanos: (self, that) => make(self + that)
    })
)

/**
 * Checks if the first Duration is less than the second.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const isLess = Duration.lessThan(Duration.seconds(3), Duration.seconds(5))
 * console.log(isLess) // true
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const lessThan: {
  (that: DurationInput): (self: DurationInput) => boolean
  (self: DurationInput, that: DurationInput): boolean
} = dual(
  2,
  (self: DurationInput, that: DurationInput): boolean =>
    matchWith(self, that, {
      onMillis: (self, that) => self < that,
      onNanos: (self, that) => self < that
    })
)

/**
 * Checks if the first Duration is less than or equal to the second.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const isLessOrEqual = Duration.lessThanOrEqualTo(Duration.seconds(5), Duration.seconds(5))
 * console.log(isLessOrEqual) // true
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const lessThanOrEqualTo: {
  (that: DurationInput): (self: DurationInput) => boolean
  (self: DurationInput, that: DurationInput): boolean
} = dual(
  2,
  (self: DurationInput, that: DurationInput): boolean =>
    matchWith(self, that, {
      onMillis: (self, that) => self <= that,
      onNanos: (self, that) => self <= that
    })
)

/**
 * Checks if the first Duration is greater than the second.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const isGreater = Duration.greaterThan(Duration.seconds(5), Duration.seconds(3))
 * console.log(isGreater) // true
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const greaterThan: {
  (that: DurationInput): (self: DurationInput) => boolean
  (self: DurationInput, that: DurationInput): boolean
} = dual(
  2,
  (self: DurationInput, that: DurationInput): boolean =>
    matchWith(self, that, {
      onMillis: (self, that) => self > that,
      onNanos: (self, that) => self > that
    })
)

/**
 * Checks if the first Duration is greater than or equal to the second.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const isGreaterOrEqual = Duration.greaterThanOrEqualTo(Duration.seconds(5), Duration.seconds(5))
 * console.log(isGreaterOrEqual) // true
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const greaterThanOrEqualTo: {
  (that: DurationInput): (self: DurationInput) => boolean
  (self: DurationInput, that: DurationInput): boolean
} = dual(
  2,
  (self: DurationInput, that: DurationInput): boolean =>
    matchWith(self, that, {
      onMillis: (self, that) => self >= that,
      onNanos: (self, that) => self >= that
    })
)

/**
 * Checks if two Durations are equal.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * const isEqual = Duration.equals(Duration.seconds(5), Duration.millis(5000))
 * console.log(isEqual) // true
 * ```
 *
 * @since 2.0.0
 * @category predicates
 */
export const equals: {
  (that: DurationInput): (self: DurationInput) => boolean
  (self: DurationInput, that: DurationInput): boolean
} = dual(2, (self: DurationInput, that: DurationInput): boolean => Equivalence(decode(self), decode(that)))

/**
 * Converts a `Duration` to its parts.
 *
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * // Create a complex duration by adding multiple parts
 * const duration = Duration.sum(
 *   Duration.sum(
 *     Duration.sum(Duration.days(1), Duration.hours(2)),
 *     Duration.sum(Duration.minutes(30), Duration.seconds(45))
 *   ),
 *   Duration.millis(123)
 * )
 * const components = Duration.parts(duration)
 * console.log(components)
 * // {
 * //   days: 1,
 * //   hours: 2,
 * //   minutes: 30,
 * //   seconds: 45,
 * //   millis: 123,
 * //   nanos: 0
 * // }
 *
 * const complex = Duration.sum(Duration.hours(25), Duration.minutes(90))
 * const complexParts = Duration.parts(complex)
 * console.log(complexParts)
 * // {
 * //   days: 1,
 * //   hours: 2,
 * //   minutes: 30,
 * //   seconds: 0,
 * //   millis: 0,
 * //   nanos: 0
 * // }
 * ```
 *
 * @since 3.8.0
 * @category conversions
 */
export const parts = (self: DurationInput): {
  days: number
  hours: number
  minutes: number
  seconds: number
  millis: number
  nanos: number
} => {
  const duration = decode(self)
  if (duration.value._tag === "Infinity") {
    return {
      days: Infinity,
      hours: Infinity,
      minutes: Infinity,
      seconds: Infinity,
      millis: Infinity,
      nanos: Infinity
    }
  }

  const nanos = unsafeToNanos(duration)
  const ms = nanos / bigint1e6
  const sec = ms / bigint1e3
  const min = sec / bigint60
  const hr = min / bigint60
  const days = hr / bigint24

  return {
    days: Number(days),
    hours: Number(hr % bigint24),
    minutes: Number(min % bigint60),
    seconds: Number(sec % bigint60),
    millis: Number(ms % bigint1e3),
    nanos: Number(nanos % bigint1e6)
  }
}

/**
 * Converts a `Duration` to a human readable string.
 *
 * @since 2.0.0
 * @category conversions
 * @example
 * ```ts
 * import { Duration } from "effect/time"
 *
 * Duration.format(Duration.millis(1000)) // "1s"
 * Duration.format(Duration.millis(1001)) // "1s 1ms"
 * ```
 */
export const format = (self: DurationInput): string => {
  const duration = decode(self)
  if (duration.value._tag === "Infinity") {
    return "Infinity"
  }
  if (isZero(duration)) {
    return "0"
  }

  const fragments = parts(duration)
  const pieces = []
  if (fragments.days !== 0) {
    pieces.push(`${fragments.days}d`)
  }

  if (fragments.hours !== 0) {
    pieces.push(`${fragments.hours}h`)
  }

  if (fragments.minutes !== 0) {
    pieces.push(`${fragments.minutes}m`)
  }

  if (fragments.seconds !== 0) {
    pieces.push(`${fragments.seconds}s`)
  }

  if (fragments.millis !== 0) {
    pieces.push(`${fragments.millis}ms`)
  }

  if (fragments.nanos !== 0) {
    pieces.push(`${fragments.nanos}ns`)
  }

  return pieces.join(" ")
}
