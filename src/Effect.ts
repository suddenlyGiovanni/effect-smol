/**
 * @since 2.0.0
 */
import { Cause, Failure } from "./Cause.js"
import { Exit } from "./Exit.js"
import { Fiber } from "./Fiber.js"
import { LazyArg } from "./Function.js"
import type { TypeLambda } from "./HKT.js"
import { Option } from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { Predicate, Refinement } from "./Predicate.js"
import { Scheduler } from "./Scheduler.js"
import type { Concurrency, Covariant } from "./Types.js"
import type * as Unify from "./Unify.js"
import { YieldWrap } from "./Utils.js"
import * as core from "./internal/core.js"
import type { Scope } from "./Scope.js"

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

// -----------------------------------------------------------------------------
// Creating Effects
// -----------------------------------------------------------------------------

/**
 * Creates an `Effect` that represents an asynchronous computation guaranteed to
 * succeed.
 *
 * **When to Use**
 *
 * Use `promise` when you are sure the operation will not reject.
 *
 * **Details**
 *
 * The provided function (`thunk`) returns a `Promise` that should never reject; if it does, the error
 * will be treated as a "defect".
 *
 * This defect is not a standard error but indicates a flaw in the logic that
 * was expected to be error-free. You can think of it similar to an unexpected
 * crash in the program, which can be further managed or logged using tools like
 * {@link catchAllDefect}.
 *
 * **Interruptions**
 *
 * An optional `AbortSignal` can be provided to allow for interruption of the
 * wrapped `Promise` API.
 *
 * @see {@link tryPromise} for a version that can handle failures.
 *
 * @example
 * ```ts
 * // Title: Delayed Message
 * import { Effect } from "effect"
 *
 * const delay = (message: string) =>
 *   Effect.promise<string>(
 *     () =>
 *       new Promise((resolve) => {
 *         setTimeout(() => {
 *           resolve(message)
 *         }, 2000)
 *       })
 *   )
 *
 * //      ┌─── Effect<string, never, never>
 * //      ▼
 * const program = delay("Async operation completed successfully!")
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const promise: <A>(
  evaluate: (signal: AbortSignal) => PromiseLike<A>,
) => Effect<A> = core.promise

/**
 * Creates an `Effect` that always succeeds with a given value.
 *
 * **When to Use**
 *
 * Use this function when you need an effect that completes successfully with a
 * specific value without any errors or external dependencies.
 *
 * @see {@link fail} to create an effect that represents a failure.
 *
 * @example
 * ```ts
 * // Title: Creating a Successful Effect
 * import { Effect } from "effect"
 *
 * // Creating an effect that represents a successful scenario
 * //
 * //      ┌─── Effect<number, never, never>
 * //      ▼
 * const success = Effect.succeed(42)
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const succeed: <A>(value: A) => Effect<A> = core.succeed

/**
 * Returns an effect which succeeds with `None`.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const succeedNone: Effect<Option<never>> = core.succeedNone

/**
 * Returns an effect which succeeds with the value wrapped in a `Some`.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const succeedSome: <A>(value: A) => Effect<Option<A>> = core.succeedSome

/**
 * Delays the creation of an `Effect` until it is actually needed.
 *
 * **When to Use**
 *
 * Use `suspend` when you need to defer the evaluation of an effect until it is required. This is particularly useful for optimizing expensive computations, managing circular dependencies, or resolving type inference issues.
 *
 * **Details**
 *
 * `suspend` takes a thunk that represents the effect and wraps it in a suspended effect. This means the effect will not be created until it is explicitly needed, which is helpful in various scenarios:
 * - **Lazy Evaluation**: Helps optimize performance by deferring computations, especially when the effect might not be needed, or when its computation is expensive. This also ensures that any side effects or scoped captures are re-executed on each invocation.
 * - **Handling Circular Dependencies**: Useful in managing circular dependencies, such as recursive functions that need to avoid eager evaluation to prevent stack overflow.
 * - **Unifying Return Types**: Can help TypeScript unify return types in situations where multiple branches of logic return different effects, simplifying type inference.
 *
 * @example
 * ```ts
 * // Title: Lazy Evaluation with Side Effects
 * import { Effect } from "effect"
 *
 * let i = 0
 *
 * const bad = Effect.succeed(i++)
 *
 * const good = Effect.suspend(() => Effect.succeed(i++))
 *
 * console.log(Effect.runSync(bad)) // Output: 0
 * console.log(Effect.runSync(bad)) // Output: 0
 *
 * console.log(Effect.runSync(good)) // Output: 1
 * console.log(Effect.runSync(good)) // Output: 2
 * ```
 *
 * @example
 * // Title: Recursive Fibonacci
 * import { Effect } from "effect"
 *
 * const blowsUp = (n: number): Effect.Effect<number> =>
 *   n < 2
 *     ? Effect.succeed(1)
 *     : Effect.zipWith(blowsUp(n - 1), blowsUp(n - 2), (a, b) => a + b)
 *
 * // console.log(Effect.runSync(blowsUp(32)))
 * // crash: JavaScript heap out of memory
 *
 * const allGood = (n: number): Effect.Effect<number> =>
 *   n < 2
 *     ? Effect.succeed(1)
 *     : Effect.zipWith(
 *         Effect.suspend(() => allGood(n - 1)),
 *         Effect.suspend(() => allGood(n - 2)),
 *         (a, b) => a + b
 *       )
 *
 * console.log(Effect.runSync(allGood(32)))
 * // Output: 3524578
 *
 * @example
 * // Title: Using Effect.suspend to Help TypeScript Infer Types
 * import { Effect } from "effect"
 *
 * //   Without suspend, TypeScript may struggle with type inference.
 * //   Inferred type:
 * //     (a: number, b: number) =>
 * //       Effect<never, Error, never> | Effect<number, never, never>
 * const withoutSuspend = (a: number, b: number) =>
 *   b === 0
 *     ? Effect.fail(new Error("Cannot divide by zero"))
 *     : Effect.succeed(a / b)
 *
 * //   Using suspend to unify return types.
 * //   Inferred type:
 * //     (a: number, b: number) => Effect<number, Error, never>
 * const withSuspend = (a: number, b: number) =>
 *   Effect.suspend(() =>
 *     b === 0
 *       ? Effect.fail(new Error("Cannot divide by zero"))
 *       : Effect.succeed(a / b)
 *   )
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const suspend: <A, E, R>(
  effect: LazyArg<Effect<A, E, R>>,
) => Effect<A, E, R> = core.suspend

/**
 * Creates an `Effect` that represents a synchronous side-effectful computation.
 *
 * **When to Use**
 *
 * Use `sync` when you are sure the operation will not fail.
 *
 * **Details**
 *
 * The provided function (`thunk`) must not throw errors; if it does, the error
 * will be treated as a "defect".
 *
 * This defect is not a standard error but indicates a flaw in the logic that
 * was expected to be error-free. You can think of it similar to an unexpected
 * crash in the program, which can be further managed or logged using tools like
 * {@link catchAllDefect}.
 *
 * @see {@link try_ | try} for a version that can handle failures.
 *
 * @example
 * ```ts
 * // Title: Logging a Message
 * import { Effect } from "effect"
 *
 * const log = (message: string) =>
 *   Effect.sync(() => {
 *     console.log(message) // side effect
 *   })
 *
 * //      ┌─── Effect<void, never, never>
 * //      ▼
 * const program = log("Hello, World!")
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const sync: <A>(thunk: LazyArg<A>) => Effect<A> = core.sync

const _void: Effect<void> = core.void
export {
  /**
   * @since 2.0.0
   * @category Creating Effects
   */
  _void as void,
}

/**
 * Returns an effect that will never produce anything. The moral equivalent of
 * `while(true) {}`, only without the wasted CPU cycles.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const never: Effect<never> = core.never

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

/**
 * Creates an `Effect` that represents a recoverable error.
 *
 * **When to Use**
 *
 * Use this function to explicitly signal an error in an `Effect`. The error
 * will keep propagating unless it is handled. You can handle the error with
 * functions like {@link catchAll} or {@link catchTag}.
 *
 * @see {@link succeed} to create an effect that represents a successful value.
 *
 * @example
 * ```ts
 * // Title: Creating a Failed Effect
 * import { Effect } from "effect"
 *
 * //      ┌─── Effect<never, Error, never>
 * //      ▼
 * const failure = Effect.fail(
 *   new Error("Operation failed due to network error")
 * )
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const fail: <E>(error: E) => Effect<never, E> = core.fail

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const failSync: <E>(evaluate: LazyArg<E>) => Effect<never, E> =
  core.failSync

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const failCause: <E>(cause: Cause<E>) => Effect<never, E> =
  core.failCause

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const failCauseSync: <E>(
  evaluate: LazyArg<Cause<E>>,
) => Effect<never, E> = core.failCauseSync

/**
 * Creates an effect that terminates a fiber with a specified error.
 *
 * **When to Use**
 *
 * Use `die` when encountering unexpected conditions in your code that should
 * not be handled as regular errors but instead represent unrecoverable defects.
 *
 * **Details**
 *
 * The `die` function is used to signal a defect, which represents a critical
 * and unexpected error in the code. When invoked, it produces an effect that
 * does not handle the error and instead terminates the fiber.
 *
 * The error channel of the resulting effect is of type `never`, indicating that
 * it cannot recover from this failure.
 *
 * @see {@link dieSync} for a variant that throws a specified error, evaluated lazily.
 * @see {@link dieMessage} for a variant that throws a `RuntimeException` with a message.
 *
 * @example
 * ```ts
 * // Title: Terminating on Division by Zero with a Specified Error
 * import { Effect } from "effect"
 *
 * const divide = (a: number, b: number) =>
 *   b === 0
 *     ? Effect.die(new Error("Cannot divide by zero"))
 *     : Effect.succeed(a / b)
 *
 * //      ┌─── Effect<number, never, never>
 * //      ▼
 * const program = divide(1, 0)
 *
 * Effect.runPromise(program).catch(console.error)
 * // Output:
 * // (FiberFailure) Error: Cannot divide by zero
 * //   ...stack trace...
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const die: (defect: unknown) => Effect<never> = core.die

// -----------------------------------------------------------------------------
// Mapping
// -----------------------------------------------------------------------------

/**
 * Chains effects to produce new `Effect` instances, useful for combining
 * operations that depend on previous results.
 *
 * **Syntax**
 * ```ts
 * const flatMappedEffect = pipe(myEffect, Effect.flatMap(transformation))
 * // or
 * const flatMappedEffect = Effect.flatMap(myEffect, transformation)
 * // or
 * const flatMappedEffect = myEffect.pipe(Effect.flatMap(transformation))
 * ```
 *
 * **When to Use**
 *
 * Use `flatMap` when you need to chain multiple effects, ensuring that each
 * step produces a new `Effect` while flattening any nested effects that may
 * occur.
 *
 * **Details**
 *
 * `flatMap` lets you sequence effects so that the result of one effect can be
 * used in the next step. It is similar to `flatMap` used with arrays but works
 * specifically with `Effect` instances, allowing you to avoid deeply nested
 * effect structures.
 *
 * Since effects are immutable, `flatMap` always returns a new effect instead of
 * changing the original one.
 *
 * @example
 * ```ts
 * import { pipe, Effect } from "effect"
 *
 * // Function to apply a discount safely to a transaction amount
 * const applyDiscount = (
 *   total: number,
 *   discountRate: number
 * ): Effect.Effect<number, Error> =>
 *   discountRate === 0
 *     ? Effect.fail(new Error("Discount rate cannot be zero"))
 *     : Effect.succeed(total - (total * discountRate) / 100)
 *
 * // Simulated asynchronous task to fetch a transaction amount from database
 * const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
 *
 * // Chaining the fetch and discount application using `flatMap`
 * const finalAmount = pipe(
 *   fetchTransactionAmount,
 *   Effect.flatMap((amount) => applyDiscount(amount, 5))
 * )
 *
 * Effect.runPromise(finalAmount).then(console.log)
 * // Output: 95
 * ```
 *
 * @since 2.0.0
 * @category Mapping
 */
export const flatMap: {
  <A, B, E1, R1>(
    f: (a: A) => Effect<B, E1, R1>,
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E1 | E, R1 | R>
  <A, E, R, B, E1, R1>(
    self: Effect<A, E, R>,
    f: (a: A) => Effect<B, E1, R1>,
  ): Effect<B, E | E1, R | R1>
} = core.flatMap

/**
 * Transforms the value inside an effect by applying a function to it.
 *
 * **Syntax**
 *
 * ```ts
 * const mappedEffect = pipe(myEffect, Effect.map(transformation))
 * // or
 * const mappedEffect = Effect.map(myEffect, transformation)
 * // or
 * const mappedEffect = myEffect.pipe(Effect.map(transformation))
 * ```
 *
 * **Details**
 *
 * `map` takes a function and applies it to the value contained within an
 * effect, creating a new effect with the transformed value.
 *
 * It's important to note that effects are immutable, meaning that the original
 * effect is not modified. Instead, a new effect is returned with the updated
 * value.
 *
 * @see {@link mapError} for a version that operates on the error channel.
 * @see {@link mapBoth} for a version that operates on both channels.
 * @see {@link flatMap} or {@link andThen} for a version that can return a new effect.
 *
 * @example
 * ```ts
 * // Title: Adding a Service Charge
 * import { pipe, Effect } from "effect"
 *
 * const addServiceCharge = (amount: number) => amount + 1
 *
 * const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
 *
 * const finalAmount = pipe(
 *   fetchTransactionAmount,
 *   Effect.map(addServiceCharge)
 * )
 *
 * Effect.runPromise(finalAmount).then(console.log)
 * // Output: 101
 * ```
 * @since 2.0.0
 * @category Mapping
 */
export const map: {
  <A, B>(f: (a: A) => B): <E, R>(self: Effect<A, E, R>) => Effect<B, E, R>
  <A, E, R, B>(self: Effect<A, E, R>, f: (a: A) => B): Effect<B, E, R>
} = core.map

// -----------------------------------------------------------------------------
// Error handling
// -----------------------------------------------------------------------------

const catch_: {
  <E, A2, E2, R2>(
    f: (e: E) => Effect<A2, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E2, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    f: (e: E) => Effect<A2, E2, R2>,
  ): Effect<A2 | A, E2, R2 | R>
} = core.catch_

export {
  /**
   * Handles all errors in an effect by providing a fallback effect.
   *
   * **Details**
   *
   * The `catchAll` function catches any errors that may occur during the
   * execution of an effect and allows you to handle them by specifying a fallback
   * effect. This ensures that the program continues without failing by recovering
   * from errors using the provided fallback logic.
   *
   * **Note**: `catchAll` only handles recoverable errors. It will not recover
   * from unrecoverable defects.
   *
   * @see {@link catchAllCause} for a version that can recover from both recoverable and unrecoverable errors.
   *
   * @example
   * ```ts
   * // Title: Providing Recovery Logic for Recoverable Errors
   * import { Effect, Random } from "effect"
   *
   * class HttpError {
   *   readonly _tag = "HttpError"
   * }
   *
   * class ValidationError {
   *   readonly _tag = "ValidationError"
   * }
   *
   * //      ┌─── Effect<string, HttpError | ValidationError, never>
   * //      ▼
   * const program = Effect.gen(function* () {
   *   const n1 = yield* Random.next
   *   const n2 = yield* Random.next
   *   if (n1 < 0.5) {
   *     yield* Effect.fail(new HttpError())
   *   }
   *   if (n2 < 0.5) {
   *     yield* Effect.fail(new ValidationError())
   *   }
   *   return "some result"
   * })
   *
   * //      ┌─── Effect<string, never, never>
   * //      ▼
   * const recovered = program.pipe(
   *   Effect.catchAll((error) =>
   *     Effect.succeed(`Recovering from ${error._tag}`)
   *   )
   * )
   * ```
   *
   * @since 4.0.0
   * @category Error handling
   */
  catch_ as catch,
}

/**
 * Handles both recoverable and unrecoverable errors by providing a recovery
 * effect.
 *
 * **When to Use**
 *
 * The `catchAllCause` function allows you to handle all errors, including
 * unrecoverable defects, by providing a recovery effect. The recovery logic is
 * based on the `Cause` of the error, which provides detailed information about
 * the failure.
 *
 * **When to Recover from Defects**
 *
 * Defects are unexpected errors that typically shouldn't be recovered from, as
 * they often indicate serious issues. However, in some cases, such as
 * dynamically loaded plugins, controlled recovery might be needed.
 *
 * @example
 * ```ts
 * // Title: Recovering from All Errors
 * import { Cause, Effect } from "effect"
 *
 * // Define an effect that may fail with a recoverable or unrecoverable error
 * const program = Effect.fail("Something went wrong!")
 *
 * // Recover from all errors by examining the cause
 * const recovered = program.pipe(
 *   Effect.catchAllCause((cause) =>
 *     Cause.isFailType(cause)
 *       ? Effect.succeed("Recovered from a regular error")
 *       : Effect.succeed("Recovered from a defect")
 *   )
 * )
 *
 * Effect.runPromise(recovered).then(console.log)
 * // Output: "Recovered from a regular error"
 * ```
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchCause: {
  <E, A2, E2, R2>(
    f: (cause: Cause<E>) => Effect<A2, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E2, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    f: (cause: Cause<E>) => Effect<A2, E2, R2>,
  ): Effect<A | A2, E2, R | R2>
} = core.catchCause

/**
 * Recovers from all defects using a provided recovery function.
 *
 * **When to Use**
 *
 * There is no sensible way to recover from defects. This method should be used
 * only at the boundary between Effect and an external system, to transmit
 * information on a defect for diagnostic or explanatory purposes.
 *
 * **Details**
 *
 * `catchAllDefect` allows you to handle defects, which are unexpected errors
 * that usually cause the program to terminate. This function lets you recover
 * from these defects by providing a function that handles the error. However,
 * it does not handle expected errors (like those from {@link fail}) or
 * execution interruptions (like those from {@link interrupt}).
 *
 * **When to Recover from Defects**
 *
 * Defects are unexpected errors that typically shouldn't be recovered from, as
 * they often indicate serious issues. However, in some cases, such as
 * dynamically loaded plugins, controlled recovery might be needed.
 *
 * @example
 * ```ts
 * // Title: Handling All Defects
 * import { Effect, Cause, Console } from "effect"
 *
 * // Simulating a runtime error
 * const task = Effect.dieMessage("Boom!")
 *
 * const program = Effect.catchAllDefect(task, (defect) => {
 *   if (Cause.isRuntimeException(defect)) {
 *     return Console.log(
 *       `RuntimeException defect caught: ${defect.message}`
 *     )
 *   }
 *   return Console.log("Unknown defect caught.")
 * })
 *
 * // We get an Exit.Success because we caught all defects
 * Effect.runPromiseExit(program).then(console.log)
 * // Output:
 * // RuntimeException defect caught: Boom!
 * // {
 * //   _id: "Exit",
 * //   _tag: "Success",
 * //   value: undefined
 * // }
 * ```
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchDefect: {
  <A2, E2, R2>(
    f: (defect: unknown) => Effect<A2, E2, R2>,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A2 | A, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    f: (defect: unknown) => Effect<A2, E2, R2>,
  ): Effect<A | A2, E | E2, R | R2>
} = core.catchDefect

/**
 * Recovers from specific errors based on a predicate.
 *
 * **When to Use**
 *
 * `catchIf` works similarly to {@link catchSome}, but it allows you to
 * recover from errors by providing a predicate function. If the predicate
 * matches the error, the recovery effect is applied. This function doesn't
 * alter the error type, so the resulting effect still carries the original
 * error type unless a user-defined type guard is used to narrow the type.
 *
 * @example
 * ```ts
 * // Title: Catching Specific Errors with a Predicate
 * import { Effect, Random } from "effect"
 *
 * class HttpError {
 *   readonly _tag = "HttpError"
 * }
 *
 * class ValidationError {
 *   readonly _tag = "ValidationError"
 * }
 *
 * //      ┌─── Effect<string, HttpError | ValidationError, never>
 * //      ▼
 * const program = Effect.gen(function* () {
 *   const n1 = yield* Random.next
 *   const n2 = yield* Random.next
 *   if (n1 < 0.5) {
 *     yield* Effect.fail(new HttpError())
 *   }
 *   if (n2 < 0.5) {
 *     yield* Effect.fail(new ValidationError())
 *   }
 *   return "some result"
 * })
 *
 * //      ┌─── Effect<string, ValidationError, never>
 * //      ▼
 * const recovered = program.pipe(
 *   Effect.catchIf(
 *     // Only handle HttpError errors
 *     (error) => error._tag === "HttpError",
 *     () => Effect.succeed("Recovering from HttpError")
 *   )
 * )
 * ```
 *
 * @since 2.0.0
 * @category Error handling
 */
export const catchIf: {
  <E, EB extends E, A2, E2, R2>(
    refinement: Refinement<NoInfer<E>, EB>,
    f: (e: EB) => Effect<A2, E2, R2>,
  ): <A, R>(
    self: Effect<A, E, R>,
  ) => Effect<A2 | A, E2 | Exclude<E, EB>, R2 | R>
  <E, A2, E2, R2>(
    predicate: Predicate<NoInfer<E>>,
    f: (e: NoInfer<E>) => Effect<A2, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E | E2, R2 | R>
  <A, E, R, EB extends E, A2, E2, R2>(
    self: Effect<A, E, R>,
    refinement: Refinement<E, EB>,
    f: (e: EB) => Effect<A2, E2, R2>,
  ): Effect<A | A2, E2 | Exclude<E, EB>, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate<E>,
    f: (e: E) => Effect<A2, E2, R2>,
  ): Effect<A | A2, E | E2, R | R2>
} = core.catchIf

/**
 * Recovers from specific failures based on a predicate.
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchFailure: {
  <E, B, E2, R2, EB extends Failure<E>>(
    refinement: Refinement<Failure<E>, EB>,
    f: (failure: EB, cause: Cause<E>) => Effect<B, E2, R2>,
  ): <A, R>(
    self: Effect<A, E, R>,
  ) => Effect<A | B, Exclude<E, Failure.Error<EB>> | E2, R | R2>
  <E, B, E2, R2>(
    predicate: Predicate<Failure<NoInfer<E>>>,
    f: (failure: NoInfer<Failure<E>>, cause: Cause<E>) => Effect<B, E2, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | B, E | E2, R | R2>
  <A, E, R, B, E2, R2, EB extends Failure<E>>(
    self: Effect<A, E, R>,
    refinement: Refinement<Failure<E>, EB>,
    f: (failure: EB, cause: Cause<E>) => Effect<B, E2, R2>,
  ): Effect<A | B, Exclude<E, Failure.Error<EB>> | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate<Failure<NoInfer<E>>>,
    f: (failure: NoInfer<Failure<E>>, cause: Cause<E>) => Effect<B, E2, R2>,
  ): Effect<A | B, E | E2, R | R2>
} = core.catchFailure

// -----------------------------------------------------------------------------
// Pattern matching
// -----------------------------------------------------------------------------

/**
 * Handles both success and failure cases of an effect without performing side
 * effects.
 *
 * **Details**
 *
 * `match` lets you define custom handlers for both success and failure
 * scenarios. You provide separate functions to handle each case, allowing you
 * to process the result if the effect succeeds, or handle the error if the
 * effect fails.
 *
 * **When to Use**
 *
 * This is useful for structuring your code to respond differently to success or
 * failure without triggering side effects.
 *
 * @see {@link matchEffect} if you need to perform side effects in the handlers.
 *
 * @example
 * ```ts
 * // Title: Handling Both Success and Failure Cases
 * import { Effect } from "effect"
 *
 * const success: Effect.Effect<number, Error> = Effect.succeed(42)
 *
 * const program1 = Effect.match(success, {
 *   onFailure: (error) => `failure: ${error.message}`,
 *   onSuccess: (value) => `success: ${value}`
 * })
 *
 * // Run and log the result of the successful effect
 * Effect.runPromise(program1).then(console.log)
 * // Output: "success: 42"
 *
 * const failure: Effect.Effect<number, Error> = Effect.fail(
 *   new Error("Uh oh!")
 * )
 *
 * const program2 = Effect.match(failure, {
 *   onFailure: (error) => `failure: ${error.message}`,
 *   onSuccess: (value) => `success: ${value}`
 * })
 *
 * // Run and log the result of the failed effect
 * Effect.runPromise(program2).then(console.log)
 * // Output: "failure: Uh oh!"
 * ```
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const match: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (error: E) => A2
    readonly onSuccess: (value: A) => A3
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    },
  ): Effect<A2 | A3, never, R>
} = core.match

/**
 * Handles failures by matching the cause of failure.
 *
 * **Details**
 *
 * The `matchCause` function allows you to handle failures with access to the
 * full cause of the failure within a fiber.
 *
 * **When to Use**
 *
 * This is useful for differentiating between different types of errors, such as
 * regular failures, defects, or interruptions. You can provide specific
 * handling logic for each failure type based on the cause.
 *
 * @see {@link matchCauseEffect} if you need to perform side effects in the
 * handlers.
 * @see {@link match} if you don't need to handle the cause of the failure.
 *
 * @example
 * ```ts
 * // Title: Handling Different Failure Causes
 * import { Effect } from "effect"
 *
 * const task: Effect.Effect<number, Error> = Effect.die("Uh oh!")
 *
 * const program = Effect.matchCause(task, {
 *   onFailure: (cause) => {
 *     switch (cause._tag) {
 *       case "Fail":
 *         // Handle standard failure
 *         return `Fail: ${cause.error.message}`
 *       case "Die":
 *         // Handle defects (unexpected errors)
 *         return `Die: ${cause.defect}`
 *       case "Interrupt":
 *         // Handle interruption
 *         return `${cause.fiberId} interrupted!`
 *     }
 *     // Fallback for other causes
 *     return "failed due to other causes"
 *   },
 *   onSuccess: (value) =>
 *     // task completes successfully
 *     `succeeded with ${value} value`
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: "Die: Uh oh!"
 *
 * ```
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const matchCause: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (cause: Cause<E>) => A2
    readonly onSuccess: (a: A) => A3
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause<E>) => A2
      readonly onSuccess: (a: A) => A3
    },
  ): Effect<A2 | A3, never, R>
} = core.matchCause

/**
 * Handles failures with access to the cause and allows performing side effects.
 *
 * **Details**
 *
 * The `matchCauseEffect` function works similarly to {@link matchCause}, but it
 * also allows you to perform additional side effects based on the failure
 * cause. This function provides access to the complete cause of the failure,
 * making it possible to differentiate between various failure types, and allows
 * you to respond accordingly while performing side effects (like logging or
 * other operations).
 *
 * @see {@link matchCause} if you don't need side effects and only want to handle the result or failure.
 * @see {@link matchEffect} if you don't need to handle the cause of the failure.
 *
 * @example
 * ```ts
 * // Title: Handling Different Failure Causes with Side Effects
 * import { Effect, Console } from "effect"
 *
 * const task: Effect.Effect<number, Error> = Effect.die("Uh oh!")
 *
 * const program = Effect.matchCauseEffect(task, {
 *   onFailure: (cause) => {
 *     switch (cause._tag) {
 *       case "Fail":
 *         // Handle standard failure with a logged message
 *         return Console.log(`Fail: ${cause.error.message}`)
 *       case "Die":
 *         // Handle defects (unexpected errors) by logging the defect
 *         return Console.log(`Die: ${cause.defect}`)
 *       case "Interrupt":
 *         // Handle interruption and log the fiberId that was interrupted
 *         return Console.log(`${cause.fiberId} interrupted!`)
 *     }
 *     // Fallback for other causes
 *     return Console.log("failed due to other causes")
 *   },
 *   onSuccess: (value) =>
 *     // Log success if the task completes successfully
 *     Console.log(`succeeded with ${value} value`)
 * })
 *
 * Effect.runPromise(program)
 * // Output: "Die: Uh oh!"
 * ```
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const matchCauseEffect: {
  <E, A2, E2, R2, A, A3, E3, R3>(options: {
    readonly onFailure: (cause: Cause<E>) => Effect<A2, E2, R2>
    readonly onSuccess: (a: A) => Effect<A3, E3, R3>
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause<E>) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    },
  ): Effect<A2 | A3, E2 | E3, R2 | R3 | R>
} = core.matchCauseEffect

/**
 * Handles both success and failure cases of an effect, allowing for additional
 * side effects.
 *
 * **Details**
 *
 * The `matchEffect` function is similar to {@link match}, but it enables you to
 * perform side effects in the handlers for both success and failure outcomes.
 *
 * **When to Use**
 *
 * This is useful when you need to execute additional actions, like logging or
 * notifying users, based on whether an effect succeeds or fails.
 *
 * @see {@link match} if you don't need side effects and only want to handle the
 * result or failure.
 *
 * @example
 * ```ts
 * // Title: Handling Both Success and Failure Cases with Side Effects
 * import { Effect } from "effect"
 *
 * const success: Effect.Effect<number, Error> = Effect.succeed(42)
 * const failure: Effect.Effect<number, Error> = Effect.fail(
 *   new Error("Uh oh!")
 * )
 *
 * const program1 = Effect.matchEffect(success, {
 *   onFailure: (error) =>
 *     Effect.succeed(`failure: ${error.message}`).pipe(
 *       Effect.tap(Effect.log)
 *     ),
 *   onSuccess: (value) =>
 *     Effect.succeed(`success: ${value}`).pipe(Effect.tap(Effect.log))
 * })
 *
 * console.log(Effect.runSync(program1))
 * // Output:
 * // timestamp=... level=INFO fiber=#0 message="success: 42"
 * // success: 42
 *
 * const program2 = Effect.matchEffect(failure, {
 *   onFailure: (error) =>
 *     Effect.succeed(`failure: ${error.message}`).pipe(
 *       Effect.tap(Effect.log)
 *     ),
 *   onSuccess: (value) =>
 *     Effect.succeed(`success: ${value}`).pipe(Effect.tap(Effect.log))
 * })
 *
 * console.log(Effect.runSync(program2))
 * // Output:
 * // timestamp=... level=INFO fiber=#1 message="failure: Uh oh!"
 * // failure: Uh oh!
 * ```
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const matchEffect: {
  <E, A2, E2, R2, A, A3, E3, R3>(options: {
    readonly onFailure: (e: E) => Effect<A2, E2, R2>
    readonly onSuccess: (a: A) => Effect<A3, E3, R3>
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (e: E) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    },
  ): Effect<A2 | A3, E2 | E3, R2 | R3 | R>
} = core.matchEffect

// -----------------------------------------------------------------------------
// Resource management & finalization
// -----------------------------------------------------------------------------

/**
 * This function adds a finalizer to the scope of the calling `Effect` value.
 * The finalizer is guaranteed to be run when the scope is closed, and it may
 * depend on the `Exit` value that the scope is closed with.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const addFinalizer: (
  finalizer: (exit: Exit<unknown, unknown>) => Effect<void>,
) => Effect<void, never, Scope> = core.addFinalizer

/**
 * Returns an effect that, if this effect _starts_ execution, then the
 * specified `finalizer` is guaranteed to be executed, whether this effect
 * succeeds, fails, or is interrupted.
 *
 * For use cases that need access to the effect's result, see `onExit`.
 *
 * Finalizers offer very powerful guarantees, but they are low-level, and
 * should generally not be used for releasing resources. For higher-level
 * logic built on `ensuring`, see the `acquireRelease` family of methods.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const ensuring: {
  <X, R1>(
    finalizer: Effect<X, never, R1>,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R1 | R>
  <A, E, R, X, R1>(
    self: Effect<A, E, R>,
    finalizer: Effect<X, never, R1>,
  ): Effect<A, E, R1 | R>
} = core.ensuring

/**
 * Runs the specified effect if this effect fails, providing the error to the
 * effect if it exists. The provided effect will not be interrupted.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const onError: {
  <E, X, R2>(
    cleanup: (cause: Cause<E>) => Effect<X, never, R2>,
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E, R2 | R>
  <A, E, R, X, R2>(
    self: Effect<A, E, R>,
    cleanup: (cause: Cause<E>) => Effect<X, never, R2>,
  ): Effect<A, E, R2 | R>
} = core.onError

/**
 * Ensures that a cleanup functions runs, whether this effect succeeds, fails,
 * or is interrupted.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const onExit: {
  <A, E, X, R2>(
    cleanup: (exit: Exit<A, E>) => Effect<X, never, R2>,
  ): <R>(self: Effect<A, E, R>) => Effect<A, E, R2 | R>
  <A, E, R, X, R2>(
    self: Effect<A, E, R>,
    cleanup: (exit: Exit<A, E>) => Effect<X, never, R2>,
  ): Effect<A, E, R | R2>
} = core.onExit

// -----------------------------------------------------------------------------
// Interruption
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category Interruption
 */
export const interrupt: Effect<never> = core.interrupt

// -----------------------------------------------------------------------------
// Semaphore
// -----------------------------------------------------------------------------

/**
 * @category Semaphore
 * @since 2.0.0
 */
export interface Semaphore {
  /** when the given amount of permits are available, run the effect and release the permits when finished */
  withPermits(
    permits: number,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  /** only if the given permits are available, run the effect and release the permits when finished */
  withPermitsIfAvailable(
    permits: number,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Option<A>, E, R>
  /** take the given amount of permits, suspending if they are not yet available */
  take(permits: number): Effect<number>
  /** release the given amount of permits, and return the resulting available permits */
  release(permits: number): Effect<number>
  /** release all the taken permits, and return the resulting available permits */
  releaseAll: Effect<number>
}

/**
 * Unsafely creates a new Semaphore
 *
 * @since 2.0.0
 * @category Semaphore
 */
export const unsafeMakeSemaphore: (permits: number) => Semaphore =
  core.unsafeMakeSemaphore

/**
 * Creates a new Semaphore
 *
 * @since 2.0.0
 * @category Semaphore
 */
export const makeSemaphore: (permits: number) => Effect<Semaphore> =
  core.makeSemaphore

// -----------------------------------------------------------------------------
// Latch
// -----------------------------------------------------------------------------

/**
 * @category Latch
 * @since 3.8.0
 */
export interface Latch {
  /** open the latch, releasing all fibers waiting on it */
  readonly open: Effect<void>
  /** release all fibers waiting on the latch, without opening it */
  readonly release: Effect<void>
  /** wait for the latch to be opened */
  readonly await: Effect<void>
  /** close the latch */
  readonly close: Effect<void>
  /** close the latch */
  readonly unsafeClose: () => void
  /** only run the given effect when the latch is open */
  readonly whenOpen: <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
}

/**
 * @category Latch
 * @since 3.8.0
 */
export const unsafeMakeLatch: (open?: boolean | undefined) => Latch =
  core.unsafeMakeLatch

/**
 * @category latch
 * @since 3.8.0
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * Effect.gen(function*() {
 *   // Create a latch, starting in the closed state
 *   const latch = yield* Effect.makeLatch(false)
 *
 *   // Fork a fiber that logs "open sesame" when the latch is opened
 *   const fiber = yield* Effect.log("open sesame").pipe(
 *     latch.whenOpen,
 *     Effect.fork
 *   )
 *
 *   // Open the latch
 *   yield* latch.open
 *   yield* fiber.await
 * })
 * ```
 */
export const makeLatch: (open?: boolean | undefined) => Effect<Latch> =
  core.makeLatch

// -----------------------------------------------------------------------------
// Supervision & Fiber's
// -----------------------------------------------------------------------------

/**
 * Forks the effect in the specified scope. The fiber will be interrupted
 * when the scope is closed.
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const forkIn: {
  (
    scope: Scope,
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R>
  <A, E, R>(self: Effect<A, E, R>, scope: Scope): Effect<Fiber<A, E>, never, R>
} = core.forkIn

/**
 * Forks the fiber in a `Scope`, interrupting it when the scope is closed.
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const forkScoped: <A, E, R>(
  self: Effect<A, E, R>,
) => Effect<Fiber<A, E>, never, Scope | R> = core.forkScoped

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

// -----------------------------------------------------------------------------
// Function
// -----------------------------------------------------------------------------

/**
 * @since 3.12.0
 * @category Function
 */
export namespace fn {
  /**
   * @since 3.12.0
   * @category Function
   */
  export type Gen = {
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
    ): (
      ...args: Args
    ) => Effect<
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
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A extends Effect<any, any, any>,
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
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
        >,
      ) => A,
    ): (...args: Args) => A
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B extends Effect<any, any, any>,
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
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
        >,
      ) => A,
      b: (_: A) => B,
    ): (...args: Args) => B
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C extends Effect<any, any, any>,
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
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
        >,
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
    ): (...args: Args) => C
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D extends Effect<any, any, any>,
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
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
        >,
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
    ): (...args: Args) => D
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E extends Effect<any, any, any>,
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
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
        >,
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
      e: (_: D) => E,
    ): (...args: Args) => E
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F extends Effect<any, any, any>,
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
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
        >,
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
      e: (_: D) => E,
      f: (_: E) => F,
    ): (...args: Args) => F
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G extends Effect<any, any, any>,
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
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
        >,
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
      e: (_: D) => E,
      f: (_: E) => F,
      g: (_: F) => G,
    ): (...args: Args) => G
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      H extends Effect<any, any, any>,
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
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
        >,
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
      e: (_: D) => E,
      f: (_: E) => F,
      g: (_: F) => G,
      h: (_: G) => H,
    ): (...args: Args) => H
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      H,
      I extends Effect<any, any, any>,
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
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
        >,
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
      e: (_: D) => E,
      f: (_: E) => F,
      g: (_: F) => G,
      h: (_: G) => H,
      i: (_: H) => I,
    ): (...args: Args) => I
  }

  /**
   * @since 3.11.0
   * @category models
   */
  export type NonGen = {
    <Eff extends Effect<any, any, any>, Args extends Array<any>>(
      body: (...args: Args) => Eff,
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A) => Eff,
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => Eff,
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => Eff,
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, D, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => Eff,
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, D, E, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => E,
      e: (_: E) => Eff,
    ): (...args: Args) => Eff
    <
      Eff extends Effect<any, any, any>,
      A,
      B,
      C,
      D,
      E,
      F,
      Args extends Array<any>,
    >(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => E,
      e: (_: E) => F,
      f: (_: E) => Eff,
    ): (...args: Args) => Eff
    <
      Eff extends Effect<any, any, any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      Args extends Array<any>,
    >(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => E,
      e: (_: E) => F,
      f: (_: E) => G,
      g: (_: G) => Eff,
    ): (...args: Args) => Eff
    <
      Eff extends Effect<any, any, any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      H,
      Args extends Array<any>,
    >(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => E,
      e: (_: E) => F,
      f: (_: E) => G,
      g: (_: G) => H,
      h: (_: H) => Eff,
    ): (...args: Args) => Eff
    <
      Eff extends Effect<any, any, any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      H,
      I,
      Args extends Array<any>,
    >(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => E,
      e: (_: E) => F,
      f: (_: E) => G,
      g: (_: G) => H,
      h: (_: H) => I,
      i: (_: H) => Eff,
    ): (...args: Args) => Eff
  }
}

/**
 * Creates a function that returns an Effect.
 *
 * The function can be created using a generator function that can yield
 * effects.
 *
 * `Effect.fnUntraced` also acts as a `pipe` function, allowing you to create a pipeline after the function definition.
 *
 * @example
 * ```ts
 * // Title: Creating a traced function with a generator function
 * import { Effect } from "effect"
 *
 * const logExample = Effect.fnUntraced(function*<N extends number>(n: N) {
 *   yield* Effect.annotateCurrentSpan("n", n)
 *   yield* Effect.logInfo(`got: ${n}`)
 *   yield* Effect.fail(new Error())
 * })
 *
 * Effect.runFork(logExample(100))
 * ```
 *
 * @since 3.12.0
 * @category function
 */
export const fnUntraced: fn.Gen = core.fnUntraced
