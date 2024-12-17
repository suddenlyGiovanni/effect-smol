/**
 * @since 2.0.0
 */
import * as Context from "./Context.js"
import type { Covariant } from "./Types.js"
import * as internal from "./internal/fiber.js"
import { Exit } from "./Exit.js"
import { Effect } from "./Effect.js"
import * as core from "./internal/core.js"
import { Pipeable } from "./Pipeable.js"

/**
 * @since 2.0.0
 * @category type ids
 */
export const TypeId: unique symbol = internal.TypeId

/**
 * @since 2.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface Fiber<out A, out E = never> extends Pipeable {
  readonly [TypeId]: Fiber.Variance<A, E>

  readonly id: number
  readonly currentOpCount: number
  readonly getRef: <I, A>(ref: Context.Reference<I, A>) => A
  readonly context: Context.Context<never>
  readonly addObserver: (cb: (exit: Exit<A, E>) => void) => () => void
  readonly unsafeInterrupt: (fiberId?: number | undefined) => void
  readonly unsafePoll: () => Exit<A, E> | undefined
}

/**
 * @since 2.0.0
 * @category models
 */
export declare namespace Fiber {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<out A, out E = never> {
    readonly _A: Covariant<A>
    readonly _E: Covariant<E>
  }
}

const await_: <A, E>(self: Fiber<A, E>) => Effect<Exit<A, E>> = core.fiberAwait
export {
  /**
   * @since 2.0.0
   * @category combinators
   */
  await_ as await,
}

/**
 * @since 2.0.0
 * @category combinators
 */
export const join: <A, E>(self: Fiber<A, E>) => Effect<A, E> = core.fiberJoin

/**
 * @since 2.0.0
 * @category interruption
 */
export const interrupt: <A, E>(self: Fiber<A, E>) => Effect<void> =
  core.fiberInterrupt

/**
 * @since 2.0.0
 * @category interruption
 */
export const interruptAll: <A extends Iterable<Fiber<any, any>>>(
  fibers: A,
) => Effect<void> = core.fiberInterruptAll
