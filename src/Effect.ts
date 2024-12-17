/**
 * @since 2.0.0
 */
import { Exit } from "./Exit.js"
import { Fiber } from "./Fiber.js"
import type { TypeLambda } from "./HKT.js"
import type { Pipeable } from "./Pipeable.js"
import { Scheduler } from "./Scheduler.js"
import type { Concurrency, Covariant } from "./Types.js"
import type * as Unify from "./Unify.js"
import { YieldWrap } from "./Utils.js"
import * as core from "./internal/core.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/Effect")

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * The `Effect` interface defines a value that lazily describes a workflow or
 * job. The workflow requires some context `R`, and may fail with an error of
 * type `E`, or succeed with a value of type `A`.
 *
 * `Effect` values model resourceful interaction with the outside world,
 * including synchronous, asynchronous, concurrent, and parallel interaction.
 * They use a fiber-based concurrency model, with built-in support for
 * scheduling, fine-grained interruption, structured concurrency, and high
 * scalability.
 *
 * To run an `Effect` value, you need a `Runtime`, which is a type that is
 * capable of executing `Effect` values.
 *
 * @since 2.0.0
 * @category Models
 */
export interface Effect<out A, out E = never, out R = never> extends Pipeable {
  readonly [TypeId]: Effect.Variance<A, E, R>
  [Symbol.iterator](): EffectIterator<Effect<A, E, R>>
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: EffectUnify<this>
  [Unify.ignoreSymbol]?: EffectUnifyIgnore
}

/**
 * @category models
 * @since 2.0.0
 */
export interface EffectUnify<A extends { [Unify.typeSymbol]?: any }> {
  Effect?: () => A[Unify.typeSymbol] extends
    | Effect<infer A0, infer E0, infer R0>
    | infer _
    ? Effect<A0, E0, R0>
    : never
}

/**
 * @category models
 * @since 2.0.0
 */
export interface EffectUnifyIgnore {
  Effect?: true
}
/**
 * @category type lambdas
 * @since 2.0.0
 */
export interface EffectTypeLambda extends TypeLambda {
  readonly type: Effect<this["Target"], this["Out1"], this["Out2"]>
}

/**
 * @since 2.0.0
 */
export declare namespace Effect {
  /**
   * @since 2.0.0
   */
  export interface Variance<A, E, R> {
    _A: Covariant<A>
    _E: Covariant<E>
    _R: Covariant<R>
  }

  /**
   * @since 2.0.0
   */
  export type Success<T> =
    T extends Effect<infer _A, infer _E, infer _R> ? _A : never

  /**
   * @since 2.0.0
   */
  export type Error<T> =
    T extends Effect<infer _A, infer _E, infer _R> ? _E : never

  /**
   * @since 2.0.0
   */
  export type Context<T> =
    T extends Effect<infer _A, infer _E, infer _R> ? _R : never
}

/**
 * @since 2.0.0
 * @category guards
 */
export const isEffect = (u: unknown): u is Effect<any, any, any> =>
  typeof u === "object" && u !== null && TypeId in u

/**
 * @since 2.0.0
 * @category models
 */
export interface EffectIterator<T extends Effect<any, any, any>> {
  next(
    ...args: ReadonlyArray<any>
  ): IteratorResult<YieldWrap<T>, Effect.Success<T>>
}

// ========================================================================
// collecting & elements
// ========================================================================

/**
 * @since 2.0.0
 */
export declare namespace All {
  /**
   * @since 2.0.0
   */
  export type EffectAny = Effect<any, any, any>

  /**
   * @since 2.0.0
   */
  export type ReturnIterable<
    T extends Iterable<EffectAny>,
    Discard extends boolean,
  > = [T] extends [Iterable<Effect<infer A, infer E, infer R>>]
    ? Effect<Discard extends true ? void : Array<A>, E, R>
    : never

  /**
   * @since 2.0.0
   */
  export type ReturnTuple<
    T extends ReadonlyArray<unknown>,
    Discard extends boolean,
  > =
    Effect<
      Discard extends true
        ? void
        : T[number] extends never
          ? []
          : {
              -readonly [K in keyof T]: T[K] extends Effect<
                infer _A,
                infer _E,
                infer _R
              >
                ? _A
                : never
            },
      T[number] extends never
        ? never
        : T[number] extends Effect<infer _A, infer _E, infer _R>
          ? _E
          : never,
      T[number] extends never
        ? never
        : T[number] extends Effect<infer _A, infer _E, infer _R>
          ? _R
          : never
    > extends infer X
      ? X
      : never

  /**
   * @since 2.0.0
   */
  export type ReturnObject<T, Discard extends boolean> = [T] extends [
    { [K: string]: EffectAny },
  ]
    ? Effect<
        Discard extends true
          ? void
          : {
              -readonly [K in keyof T]: [T[K]] extends [
                Effect<infer _A, infer _E, infer _R>,
              ]
                ? _A
                : never
            },
        keyof T extends never
          ? never
          : T[keyof T] extends Effect<infer _A, infer _E, infer _R>
            ? _E
            : never,
        keyof T extends never
          ? never
          : T[keyof T] extends Effect<infer _A, infer _E, infer _R>
            ? _R
            : never
      >
    : never

  /**
   * @since 2.0.0
   */
  export type IsDiscard<A> = [Extract<A, { readonly discard: true }>] extends [
    never,
  ]
    ? false
    : true

  /**
   * @since 2.0.0
   */
  export type Return<
    Arg extends Iterable<EffectAny> | Record<string, EffectAny>,
    O extends {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: boolean | undefined
    },
  > = [Arg] extends [ReadonlyArray<EffectAny>]
    ? ReturnTuple<Arg, IsDiscard<O>>
    : [Arg] extends [Iterable<EffectAny>]
      ? ReturnIterable<Arg, IsDiscard<O>>
      : [Arg] extends [Record<string, EffectAny>]
        ? ReturnObject<Arg, IsDiscard<O>>
        : never
}

/**
 * Provides a way to write effectful code using generator functions, simplifying
 * control flow and error handling.
 *
 * **When to Use**
 *
 * `gen` allows you to write code that looks and behaves like synchronous
 * code, but it can handle asynchronous tasks, errors, and complex control flow
 * (like loops and conditions). It helps make asynchronous code more readable
 * and easier to manage.
 *
 * The generator functions work similarly to `async/await` but with more
 * explicit control over the execution of effects. You can `yield*` values from
 * effects and return the final result at the end.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const addServiceCharge = (amount: number) => amount + 1
 *
 * const applyDiscount = (
 *   total: number,
 *   discountRate: number
 * ): Effect.Effect<number, Error> =>
 *   discountRate === 0
 *     ? Effect.fail(new Error("Discount rate cannot be zero"))
 *     : Effect.succeed(total - (total * discountRate) / 100)
 *
 * const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
 *
 * const fetchDiscountRate = Effect.promise(() => Promise.resolve(5))
 *
 * export const program = Effect.gen(function* () {
 *   const transactionAmount = yield* fetchTransactionAmount
 *   const discountRate = yield* fetchDiscountRate
 *   const discountedAmount = yield* applyDiscount(
 *     transactionAmount,
 *     discountRate
 *   )
 *   const finalAmount = addServiceCharge(discountedAmount)
 *   return `Final amount to charge: ${finalAmount}`
 * })
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const gen: {
  <Eff extends YieldWrap<Effect<any, any, any>>, AEff>(
    f: () => Generator<Eff, AEff, never>,
  ): Effect<
    AEff,
    [Eff] extends [never]
      ? never
      : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>]
        ? E
        : never,
    [Eff] extends [never]
      ? never
      : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>]
        ? R
        : never
  >
  <Self, Eff extends YieldWrap<Effect<any, any, any>>, AEff>(
    self: Self,
    f: (this: Self) => Generator<Eff, AEff, never>,
  ): Effect<
    AEff,
    [Eff] extends [never]
      ? never
      : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>]
        ? E
        : never,
    [Eff] extends [never]
      ? never
      : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>]
        ? R
        : never
  >
} = core.gen

// -----------------------------------------------------------------------------
// Running Effects
// -----------------------------------------------------------------------------

/**
 * The foundational function for running effects, returning a "fiber" that can
 * be observed or interrupted.
 *
 * **When to Use**
 *
 * `runFork` is used to run an effect in the background by creating a
 * fiber. It is the base function for all other run functions. It starts a fiber
 * that can be observed or interrupted.
 *
 * Unless you specifically need a `Promise` or synchronous operation,
 * `runFork` is a good default choice.
 *
 * @example
 * ```ts
 * // Title: Running an Effect in the Background
 * import { Effect, Console, Schedule, Fiber } from "effect"
 *
 * //      ┌─── Effect<number, never, never>
 * //      ▼
 * const program = Effect.repeat(
 *   Console.log("running..."),
 *   Schedule.spaced("200 millis")
 * )
 *
 * //      ┌─── RuntimeFiber<number, never>
 * //      ▼
 * const fiber = Effect.runFork(program)
 *
 * setTimeout(() => {
 *   Effect.runFork(Fiber.interrupt(fiber))
 * }, 500)
 * ```
 *
 * @since 2.0.0
 * @category Running Effects
 */
export const runFork: <A, E>(
  effect: Effect<A, E>,
  options?:
    | {
        readonly signal?: AbortSignal | undefined
        readonly scheduler?: Scheduler | undefined
      }
    | undefined,
) => Fiber<A, E> = core.runFork

/**
 * Executes an effect and returns the result as a `Promise`.
 *
 * **When to Use**
 *
 * Use `runPromise` when you need to execute an effect and work with the
 * result using `Promise` syntax, typically for compatibility with other
 * promise-based code.
 *
 * If the effect succeeds, the promise will resolve with the result. If the
 * effect fails, the promise will reject with an error.
 *
 * @see {@link runPromiseExit} for a version that returns an `Exit` type instead of rejecting.
 *
 * @example
 * ```ts
 * // Title: Running a Successful Effect as a Promise
 * import { Effect } from "effect"
 *
 * Effect.runPromise(Effect.succeed(1)).then(console.log)
 * // Output: 1
 * ```
 *
 * @example
 * //Example: Handling a Failing Effect as a Rejected Promise
 * import { Effect } from "effect"
 *
 * Effect.runPromise(Effect.fail("my error")).catch(console.error)
 * // Output:
 * // (FiberFailure) Error: my error
 *
 * @since 2.0.0
 * @category Running Effects
 */
export const runPromise: <A, E>(
  effect: Effect<A, E>,
  options?:
    | {
        readonly signal?: AbortSignal | undefined
        readonly scheduler?: Scheduler | undefined
      }
    | undefined,
) => Promise<A> = core.runPromise

/**
 * Runs an effect and returns a `Promise` that resolves to an `Exit`, which
 * represents the outcome (success or failure) of the effect.
 *
 * **When to Use**
 *
 * Use `runPromiseExit` when you need to determine if an effect succeeded
 * or failed, including any defects, and you want to work with a `Promise`.
 *
 * **Details**
 *
 * The `Exit` type represents the result of the effect:
 * - If the effect succeeds, the result is wrapped in a `Success`.
 * - If it fails, the failure information is provided as a `Failure` containing
 *   a `Cause` type.
 *
 * @example
 * ```ts
 * // Title: Handling Results as Exit
 * import { Effect } from "effect"
 *
 * // Execute a successful effect and get the Exit result as a Promise
 * Effect.runPromiseExit(Effect.succeed(1)).then(console.log)
 * // Output:
 * // {
 * //   _id: "Exit",
 * //   _tag: "Success",
 * //   value: 1
 * // }
 *
 * // Execute a failing effect and get the Exit result as a Promise
 * Effect.runPromiseExit(Effect.fail("my error")).then(console.log)
 * // Output:
 * // {
 * //   _id: "Exit",
 * //   _tag: "Failure",
 * //   cause: {
 * //     _id: "Cause",
 * //     _tag: "Fail",
 * //     failure: "my error"
 * //   }
 * // }
 * ```
 *
 * @since 2.0.0
 * @category Running Effects
 */
export const runPromiseExit: <A, E>(
  effect: Effect<A, E>,
  options?:
    | {
        readonly signal?: AbortSignal | undefined
        readonly scheduler?: Scheduler | undefined
      }
    | undefined,
) => Promise<Exit<A, E>> = core.runPromiseExit

/**
 * Executes an effect synchronously, running it immediately and returning the
 * result.
 *
 * **When to Use**
 *
 * Use `runSync` to run an effect that does not fail and does not include
 * any asynchronous operations.
 *
 * If the effect fails or involves asynchronous work, it will throw an error,
 * and execution will stop where the failure or async operation occurs.
 *
 * @see {@link runSyncExit} for a version that returns an `Exit` type instead of
 * throwing an error.
 *
 * @example
 * ```ts
 * // Title: Synchronous Logging
 * import { Effect } from "effect"
 *
 * const program = Effect.sync(() => {
 *   console.log("Hello, World!")
 *   return 1
 * })
 *
 * const result = Effect.runSync(program)
 * // Output: Hello, World!
 *
 * console.log(result)
 * // Output: 1
 * ```
 *
 * @example
 * // Title: Incorrect Usage with Failing or Async Effects
 * import { Effect } from "effect"
 *
 * try {
 *   // Attempt to run an effect that fails
 *   Effect.runSync(Effect.fail("my error"))
 * } catch (e) {
 *   console.error(e)
 * }
 * // Output:
 * // (FiberFailure) Error: my error
 *
 * try {
 *   // Attempt to run an effect that involves async work
 *   Effect.runSync(Effect.promise(() => Promise.resolve(1)))
 * } catch (e) {
 *   console.error(e)
 * }
 * // Output:
 * // (FiberFailure) AsyncFiberException: Fiber #0 cannot be resolved synchronously. This is caused by using runSync on an effect that performs async work
 *
 * @since 2.0.0
 * @category Running Effects
 */
export const runSync: <A, E>(effect: Effect<A, E>) => A = core.runSync

/**
 * Runs an effect synchronously and returns the result as an `Exit` type, which
 * represents the outcome (success or failure) of the effect.
 *
 * **When to Use**
 *
 * Use `runSyncExit` to find out whether an effect succeeded or failed,
 * including any defects, without dealing with asynchronous operations.
 *
 * **Details**
 *
 * The `Exit` type represents the result of the effect:
 * - If the effect succeeds, the result is wrapped in a `Success`.
 * - If it fails, the failure information is provided as a `Failure` containing
 *   a `Cause` type.
 *
 * If the effect contains asynchronous operations, `runSyncExit` will
 * return an `Failure` with a `Die` cause, indicating that the effect cannot be
 * resolved synchronously.
 *
 * @example
 * ```ts
 * // Title: Handling Results as Exit
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSyncExit(Effect.succeed(1)))
 * // Output:
 * // {
 * //   _id: "Exit",
 * //   _tag: "Success",
 * //   value: 1
 * // }
 *
 * console.log(Effect.runSyncExit(Effect.fail("my error")))
 * // Output:
 * // {
 * //   _id: "Exit",
 * //   _tag: "Failure",
 * //   cause: {
 * //     _id: "Cause",
 * //     _tag: "Fail",
 * //     failure: "my error"
 * //   }
 * // }
 * ```
 *
 * @example
 * // Title: Asynchronous Operation Resulting in Die
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSyncExit(Effect.promise(() => Promise.resolve(1))))
 * // Output:
 * // {
 * //   _id: 'Exit',
 * //   _tag: 'Failure',
 * //   cause: {
 * //     _id: 'Cause',
 * //     _tag: 'Die',
 * //     defect: [Fiber #0 cannot be resolved synchronously. This is caused by using runSync on an effect that performs async work] {
 * //       fiber: [FiberRuntime],
 * //       _tag: 'AsyncFiberException',
 * //       name: 'AsyncFiberException'
 * //     }
 * //   }
 * // }
 *
 * @since 2.0.0
 * @category Running Effects
 */
export const runSyncExit: <A, E>(effect: Effect<A, E>) => Exit<A, E> =
  core.runSyncExit
