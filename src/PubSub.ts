/**
 * @since 2.0.0
 */
import type { Deferred } from "./Deferred.js"
import type * as Effect from "./Effect.js"
import * as internal from "./internal/pubSub.js"
import type { Empty, MutableList } from "./MutableList.js"
import type { MutableRef } from "./MutableRef.js"
import type { Option } from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import type * as Scope from "./Scope.js"
import type { Covariant, Invariant } from "./Types.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = internal.TypeId

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * A `PubSub<A>` is an asynchronous message hub into which publishers can publish
 * messages of type `A` and subscribers can subscribe to take messages of type
 * `A`.
 *
 * @since 2.0.0
 * @category models
 */
export interface PubSub<in out A> extends Pipeable {
  readonly [TypeId]: {
    readonly _A: Invariant<A>
  }
  readonly pubsub: PubSub.Atomic<A>
  readonly subscribers: PubSub.Subscribers<A>
  readonly scope: Scope.Scope.Closeable
  readonly shutdownHook: Deferred<void>
  readonly shutdownFlag: MutableRef<boolean>
  readonly strategy: PubSub.Strategy<A>
}

/**
 * @since 2.0.0
 * @category models
 */
export namespace PubSub {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Atomic<in out A> {
    readonly capacity: number
    isEmpty(): boolean
    isFull(): boolean
    size(): number
    publish(value: A): boolean
    publishAll(elements: Iterable<A>): Array<A>
    slide(): void
    subscribe(): BackingSubscription<A>
    replayWindow(): ReplayWindow<A>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface BackingSubscription<out A> {
    isEmpty(): boolean
    size(): number
    poll(): A | Empty
    pollUpTo(n: number): Array<A>
    unsubscribe(): void
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export type Subscribers<A> = Map<
    BackingSubscription<A>,
    Set<MutableList<Deferred<A>>>
  >

  /**
   * @since 4.0.0
   * @category models
   */
  export interface ReplayWindow<A> {
    take(): A | undefined
    takeN(n: number): Array<A>
    takeAll(): Array<A>
    readonly remaining: number
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface Strategy<in out A> {
    /**
     * Describes any finalization logic associated with this strategy.
     */
    readonly shutdown: Effect.Effect<void>

    /**
     * Describes how publishers should signal to subscribers that they are
     * waiting for space to become available in the `PubSub`.
     */
    handleSurplus(
      pubsub: Atomic<A>,
      subscribers: Subscribers<A>,
      elements: Iterable<A>,
      isShutdown: MutableRef<boolean>
    ): Effect.Effect<boolean>

    /**
     * Describes how subscribers should signal to publishers waiting for space
     * to become available in the `PubSub` that space may be available.
     */
    unsafeOnPubSubEmptySpace(
      pubsub: Atomic<A>,
      subscribers: Subscribers<A>
    ): void

    /**
     * Describes how subscribers waiting for additional values from the `PubSub`
     * should take those values and signal to publishers that they are no
     * longer waiting for additional values.
     */
    unsafeCompletePollers(
      pubsub: Atomic<A>,
      subscribers: Subscribers<A>,
      subscription: BackingSubscription<A>,
      pollers: MutableList<Deferred<A>>
    ): void

    /**
     * Describes how publishers should signal to subscribers waiting for
     * additional values from the `PubSub` that new values are available.
     */
    unsafeCompleteSubscribers(
      pubsub: Atomic<A>,
      subscribers: Subscribers<A>
    ): void
  }
}

/**
 * @since 4.0.0
 * @category Subscription
 */
export const SubscriptionTypeId: unique symbol = internal.SubscriptionTypeId

/**
 * @since 4.0.0
 * @category Subscription
 */
export type SubscriptionTypeId = typeof SubscriptionTypeId

/**
 * @since 4.0.0
 * @category Subscription
 */
export interface Subscription<out A> extends Pipeable {
  readonly [SubscriptionTypeId]: {
    readonly _A: Covariant<A>
  }
  readonly pubsub: PubSub.Atomic<any>
  readonly subscribers: PubSub.Subscribers<any>
  readonly subscription: PubSub.BackingSubscription<A>
  readonly pollers: MutableList<Deferred<any>>
  readonly shutdownHook: Deferred<void>
  readonly shutdownFlag: MutableRef<boolean>
  readonly strategy: PubSub.Strategy<any>
  readonly replayWindow: PubSub.ReplayWindow<A>
}

/**
 * Creates a bounded `PubSub` with the back pressure strategy. The `PubSub` will retain
 * messages until they have been taken by all subscribers, applying back
 * pressure to publishers if the `PubSub` is at capacity.
 *
 * For best performance use capacities that are powers of two.
 *
 * @since 2.0.0
 * @category constructors
 */
export const bounded: <A>(
  capacity: number | { readonly capacity: number; readonly replay?: number | undefined }
) => Effect.Effect<PubSub<A>> = internal.bounded

/**
 * Creates a bounded `PubSub` with the dropping strategy. The `PubSub` will drop new
 * messages if the `PubSub` is at capacity.
 *
 * For best performance use capacities that are powers of two.
 *
 * @since 2.0.0
 * @category constructors
 */
export const dropping: <A>(
  capacity: number | { readonly capacity: number; readonly replay?: number | undefined }
) => Effect.Effect<PubSub<A>> = internal.dropping

/**
 * Creates a bounded `PubSub` with the sliding strategy. The `PubSub` will add new
 * messages and drop old messages if the `PubSub` is at capacity.
 *
 * For best performance use capacities that are powers of two.
 *
 * @since 2.0.0
 * @category constructors
 */
export const sliding: <A>(
  capacity: number | { readonly capacity: number; readonly replay?: number | undefined }
) => Effect.Effect<PubSub<A>> = internal.sliding

/**
 * Creates an unbounded `PubSub`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const unbounded: <A>(options?: { readonly replay?: number | undefined }) => Effect.Effect<PubSub<A>> =
  internal.unbounded

/**
 *  Returns the number of elements the queue can hold.
 *
 * @since 2.0.0
 * @category getters
 */
export const capacity: <A>(self: PubSub<A>) => number = internal.capacity

/**
 * Retrieves the size of the queue, which is equal to the number of elements
 * in the queue. This may be negative if fibers are suspended waiting for
 * elements to be added to the queue.
 *
 * @since 2.0.0
 * @category getters
 */
export const size: <A>(self: PubSub<A>) => Effect.Effect<number> = internal.size

/**
 * Retrieves the size of the queue, which is equal to the number of elements
 * in the queue. This may be negative if fibers are suspended waiting for
 * elements to be added to the queue.
 *
 * @since 2.0.0
 * @category getters
 */
export const unsafeSize: <A>(self: PubSub<A>) => Option<number> = internal.unsafeSize

/**
 * Returns `true` if the `Queue` contains at least one element, `false`
 * otherwise.
 *
 * @since 2.0.0
 * @category getters
 */
export const isFull: <A>(self: PubSub<A>) => Effect.Effect<boolean> = internal.isFull

/**
 * Returns `true` if the `Queue` contains zero elements, `false` otherwise.
 *
 * @since 2.0.0
 * @category getters
 */
export const isEmpty: <A>(self: PubSub<A>) => Effect.Effect<boolean> = internal.isEmpty

/**
 * Interrupts any fibers that are suspended on `offer` or `take`. Future calls
 * to `offer*` and `take*` will be interrupted immediately.
 *
 * @since 2.0.0
 * @category Shutdown
 */
export const shutdown: <A>(self: PubSub<A>) => Effect.Effect<void> = internal.shutdown

/**
 * Returns `true` if `shutdown` has been called, otherwise returns `false`.
 *
 * @since 2.0.0
 * @category Shutdown
 */
export const isShutdown: <A>(self: PubSub<A>) => Effect.Effect<boolean> = internal.isShutdown

/**
 * Waits until the queue is shutdown. The `Effect` returned by this method will
 * not resume until the queue has been shutdown. If the queue is already
 * shutdown, the `Effect` will resume right away.
 *
 * @since 2.0.0
 * @category Shutdown
 */
export const awaitShutdown: <A>(self: PubSub<A>) => Effect.Effect<void> = internal.awaitShutdown

/**
 * Publishes a message to the `PubSub`, returning whether the message was published
 * to the `PubSub`.
 *
 * @since 2.0.0
 * @category Publishing
 */
export const publish: {
  <A>(value: A): (self: PubSub<A>) => Effect.Effect<boolean>
  <A>(self: PubSub<A>, value: A): Effect.Effect<boolean>
} = internal.publish

/**
 * Publishes all of the specified messages to the `PubSub`, returning whether they
 * were published to the `PubSub`.
 *
 * @since 2.0.0
 * @category Publishing
 */
export const publishAll: {
  <A>(elements: Iterable<A>): (self: PubSub<A>) => Effect.Effect<boolean>
  <A>(self: PubSub<A>, elements: Iterable<A>): Effect.Effect<boolean>
} = internal.publishAll

/**
 * Subscribes to receive messages from the `PubSub`. The resulting subscription can
 * be evaluated multiple times within the scope to take a message from the `PubSub`
 * each time.
 *
 * @since 2.0.0
 * @category Subscription
 */
export const subscribe: <A>(self: PubSub<A>) => Effect.Effect<Subscription<A>, never, Scope.Scope> = internal.subscribe

/**
 * @since 4.0.0
 * @category Subscription
 */
export const unsubscribe: <A>(self: Subscription<A>) => Effect.Effect<void> = internal.unsubscribe

/**
 * @since 4.0.0
 * @category Subscription
 */
export const take: <A>(self: Subscription<A>) => Effect.Effect<A> = internal.take

/**
 * @since 4.0.0
 * @category Subscription
 */
export const takeAll: <A>(self: Subscription<A>) => Effect.Effect<Array<A>> = internal.takeAll

/**
 * @since 4.0.0
 * @category Subscription
 */
export const takeUpTo: {
  (max: number): <A>(self: Subscription<A>) => Effect.Effect<Array<A>>
  <A>(self: Subscription<A>, max: number): Effect.Effect<Array<A>>
} = internal.takeUpTo

/**
 * @since 4.0.0
 * @category Subscription
 */
export const takeBetween: {
  (min: number, max: number): <A>(self: Subscription<A>) => Effect.Effect<Array<A>>
  <A>(self: Subscription<A>, min: number, max: number): Effect.Effect<Array<A>>
} = internal.takeBetween

/**
 * @since 4.0.0
 * @category Subscription
 */
export const remaining: <A>(self: Subscription<A>) => Effect.Effect<number> = internal.remaining

/**
 * @since 4.0.0
 * @category Subscription
 */
export const unsafeRemaining: <A>(self: Subscription<A>) => Option<number> = internal.unsafeRemaining
