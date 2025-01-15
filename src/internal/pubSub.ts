import * as Arr from "../Array.js"
import * as Deferred from "../Deferred.js"
import * as Effect from "../Effect.js"
import * as Exit from "../Exit.js"
import { dual, identity, pipe } from "../Function.js"
import * as MutableList from "../MutableList.js"
import * as MutableRef from "../MutableRef.js"
import { nextPow2 } from "../Number.js"
import * as Option from "../Option.js"
import { pipeArguments } from "../Pipeable.js"
import type * as PubSub from "../PubSub.js"
import * as Scope from "../Scope.js"

/** @internal */
export const TypeId: PubSub.TypeId = Symbol.for("effect/PubSub") as PubSub.TypeId

const AbsentValue = Symbol.for("effect/PubSub/AbsentValue")
type AbsentValue = typeof AbsentValue

const addSubscribers = <A>(
  subscribers: PubSub.PubSub.Subscribers<A>,
  subscription: PubSub.PubSub.BackingSubscription<A>,
  pollers: MutableList.MutableList<Deferred.Deferred<A>>
) => {
  if (!subscribers.has(subscription)) {
    subscribers.set(subscription, new Set())
  }
  const set = subscribers.get(subscription)!
  set.add(pollers)
}

const removeSubscribers = <A>(
  subscribers: PubSub.PubSub.Subscribers<A>,
  subscription: PubSub.PubSub.BackingSubscription<A>,
  pollers: MutableList.MutableList<Deferred.Deferred<A>>
) => {
  if (!subscribers.has(subscription)) {
    return
  }
  const set = subscribers.get(subscription)!
  set.delete(pollers)
  if (set.size === 0) {
    subscribers.delete(subscription)
  }
}

/** @internal */
export const bounded = <A>(
  capacity: number | {
    readonly capacity: number
    readonly replay?: number | undefined
  }
): Effect.Effect<PubSub.PubSub<A>> =>
  Effect.suspend(() => {
    const pubsub = makeBoundedPubSub<A>(capacity)
    return makePubSub(pubsub, new BackPressureStrategy())
  })

/** @internal */
export const dropping = <A>(
  capacity: number | {
    readonly capacity: number
    readonly replay?: number | undefined
  }
): Effect.Effect<PubSub.PubSub<A>> =>
  Effect.suspend(() => {
    const pubsub = makeBoundedPubSub<A>(capacity)
    return makePubSub(pubsub, new DroppingStrategy())
  })

/** @internal */
export const sliding = <A>(
  capacity: number | {
    readonly capacity: number
    readonly replay?: number | undefined
  }
): Effect.Effect<PubSub.PubSub<A>> =>
  Effect.suspend(() => {
    const pubsub = makeBoundedPubSub<A>(capacity)
    return makePubSub(pubsub, new SlidingStrategy())
  })

/** @internal */
export const unbounded = <A>(options?: {
  readonly replay?: number | undefined
}): Effect.Effect<PubSub.PubSub<A>> =>
  Effect.suspend(() => {
    const pubsub = makeUnboundedPubSub<A>(options)
    return makePubSub(pubsub, new DroppingStrategy())
  })

/** @internal */
export const size = <A>(self: PubSub.PubSub<A>): Effect.Effect<number> =>
  Effect.suspend(() =>
    MutableRef.get(self.shutdownFlag) ?
      Effect.interrupt :
      Effect.sync(() => self.pubsub.size())
  )

/** @internal */
export const capacity = <A>(self: PubSub.PubSub<A>): number => self.pubsub.capacity

/** @internal */
export const unsafeSize = <A>(self: PubSub.PubSub<A>): Option.Option<number> => {
  if (MutableRef.get(self.shutdownFlag)) {
    return Option.none()
  }
  return Option.some(self.pubsub.size())
}

/** @internal */
export const isFull = <A>(self: PubSub.PubSub<A>): Effect.Effect<boolean> =>
  Effect.map(size(self), (size) => size === self.pubsub.capacity)

/** @internal */
export const isEmpty = <A>(self: PubSub.PubSub<A>): Effect.Effect<boolean> =>
  Effect.map(size(self), (size) => size === 0)

/** @internal */
export const awaitShutdown = <A>(self: PubSub.PubSub<A>): Effect.Effect<void> => Deferred.await(self.shutdownHook)

/** @internal */
export const isShutdown = <A>(self: PubSub.PubSub<A>): Effect.Effect<boolean> =>
  Effect.sync(() => MutableRef.get(self.shutdownFlag))

/** @internal */
export const shutdown = <A>(self: PubSub.PubSub<A>): Effect.Effect<void> =>
  Effect.uninterruptible(Effect.withFiber((fiber) => {
    MutableRef.set(self.shutdownFlag, true)
    return pipe(
      self.scope.close(Exit.interrupt(fiber.id)),
      Effect.andThen(self.strategy.shutdown),
      Effect.when(Deferred.succeed(self.shutdownHook, void 0)),
      Effect.asVoid
    )
  }))

/** @internal */
export const publish: {
  <A>(value: A): (self: PubSub.PubSub<A>) => Effect.Effect<boolean>
  <A>(self: PubSub.PubSub<A>, value: A): Effect.Effect<boolean>
} = dual(2, <A>(self: PubSub.PubSub<A>, value: A): Effect.Effect<boolean> =>
  Effect.suspend(() => {
    if (self.shutdownFlag.current) {
      return Effect.interrupt
    }

    if (self.pubsub.publish(value)) {
      self.strategy.unsafeCompleteSubscribers(self.pubsub, self.subscribers)
      return Effect.succeed(true)
    }

    return self.strategy.handleSurplus(
      self.pubsub,
      self.subscribers,
      [value],
      self.shutdownFlag
    )
  }))

/** @internal */
export const isActive = <A>(self: PubSub.PubSub<A>): boolean => !self.shutdownFlag.current

/** @internal */
export const unsafePublish: {
  <A>(value: A): (self: PubSub.PubSub<A>) => boolean
  <A>(self: PubSub.PubSub<A>, value: A): boolean
} = dual(2, <A>(self: PubSub.PubSub<A>, value: A): boolean => {
  if (self.shutdownFlag.current) return false
  if (self.pubsub.publish(value)) {
    self.strategy.unsafeCompleteSubscribers(self.pubsub, self.subscribers)
    return true
  }
  return false
})

/** @internal */
export const publishAll: {
  <A>(elements: Iterable<A>): (self: PubSub.PubSub<A>) => Effect.Effect<boolean>
  <A>(self: PubSub.PubSub<A>, elements: Iterable<A>): Effect.Effect<boolean>
} = dual(2, <A>(self: PubSub.PubSub<A>, elements: Iterable<A>): Effect.Effect<boolean> =>
  Effect.suspend(() => {
    if (self.shutdownFlag.current) {
      return Effect.interrupt
    }
    const surplus = self.pubsub.publishAll(elements)
    self.strategy.unsafeCompleteSubscribers(self.pubsub, self.subscribers)
    if (surplus.length === 0) {
      return Effect.succeed(true)
    }
    return self.strategy.handleSurplus(
      self.pubsub,
      self.subscribers,
      surplus,
      self.shutdownFlag
    )
  }))

/** @internal */
export const subscribe: <A>(self: PubSub.PubSub<A>) => Effect.Effect<PubSub.Subscription<A>, never, Scope.Scope> =
  Effect.fnUntraced(function*<A>(self: PubSub.PubSub<A>) {
    const scope = yield* Effect.scope
    let subscription: PubSub.Subscription<A> | undefined = undefined
    const forkedScope = yield* self.scope.fork
    yield* forkedScope.addFinalizer(() => subscription ? unsubscribe(subscription) : Effect.void)
    yield* scope.addFinalizer(() => forkedScope.close(Exit.void))
    return subscription = yield* makeSubscription(self.pubsub, self.subscribers, self.strategy)
  })

/** @internal */
const makeBoundedPubSub = <A>(
  capacity: number | {
    readonly capacity: number
    readonly replay?: number | undefined
  }
): PubSub.PubSub.Atomic<A> => {
  const options = typeof capacity === "number" ? { capacity } : capacity
  ensureCapacity(options.capacity)
  const replayBuffer = options.replay && options.replay > 0 ? new ReplayBuffer<A>(Math.ceil(options.replay)) : undefined
  if (options.capacity === 1) {
    return new BoundedPubSubSingle(replayBuffer)
  } else if (nextPow2(options.capacity) === options.capacity) {
    return new BoundedPubSubPow2(options.capacity, replayBuffer)
  } else {
    return new BoundedPubSubArb(options.capacity, replayBuffer)
  }
}

/** @internal */
const makeUnboundedPubSub = <A>(options?: {
  readonly replay?: number | undefined
}): PubSub.PubSub.Atomic<A> => new UnboundedPubSub(options?.replay ? new ReplayBuffer(options.replay) : undefined)

/** @internal */
const makeSubscription = <A>(
  pubsub: PubSub.PubSub.Atomic<A>,
  subscribers: PubSub.PubSub.Subscribers<A>,
  strategy: PubSub.PubSub.Strategy<A>
): Effect.Effect<PubSub.Subscription<A>> =>
  Effect.map(Deferred.make<void>(), (deferred) =>
    unsafeMakeSubscription(
      pubsub,
      subscribers,
      pubsub.subscribe(),
      MutableList.make<Deferred.Deferred<A>>(),
      deferred,
      MutableRef.make(false),
      strategy
    ))

/** @internal */
export const unsafeMakeSubscription = <A>(
  pubsub: PubSub.PubSub.Atomic<A>,
  subscribers: PubSub.PubSub.Subscribers<A>,
  subscription: PubSub.PubSub.BackingSubscription<A>,
  pollers: MutableList.MutableList<Deferred.Deferred<A>>,
  shutdownHook: Deferred.Deferred<void>,
  shutdownFlag: MutableRef.MutableRef<boolean>,
  strategy: PubSub.PubSub.Strategy<A>
): PubSub.Subscription<A> =>
  new SubscriptionImpl(
    pubsub,
    subscribers,
    subscription,
    pollers,
    shutdownHook,
    shutdownFlag,
    strategy,
    pubsub.replayWindow()
  )

/** @internal */
class BoundedPubSubArb<in out A> implements PubSub.PubSub.Atomic<A> {
  array: Array<A>
  publisherIndex = 0
  subscribers: Array<number>
  subscriberCount = 0
  subscribersIndex = 0

  constructor(readonly capacity: number, readonly replayBuffer: ReplayBuffer<A> | undefined) {
    this.array = Array.from({ length: capacity })
    this.subscribers = Array.from({ length: capacity })
  }

  replayWindow(): PubSub.PubSub.ReplayWindow<A> {
    return this.replayBuffer ? new ReplayWindowImpl(this.replayBuffer) : emptyReplayWindow
  }

  isEmpty(): boolean {
    return this.publisherIndex === this.subscribersIndex
  }

  isFull(): boolean {
    return this.publisherIndex === this.subscribersIndex + this.capacity
  }

  size(): number {
    return this.publisherIndex - this.subscribersIndex
  }

  publish(value: A): boolean {
    if (this.isFull()) {
      return false
    }
    if (this.subscriberCount !== 0) {
      const index = this.publisherIndex % this.capacity
      this.array[index] = value
      this.subscribers[index] = this.subscriberCount
      this.publisherIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.offer(value)
    }
    return true
  }

  publishAll(elements: Iterable<A>): Array<A> {
    if (this.subscriberCount === 0) {
      if (this.replayBuffer) {
        this.replayBuffer.offerAll(elements)
      }
      return []
    }
    const chunk = Arr.fromIterable(elements)
    const n = chunk.length
    const size = this.publisherIndex - this.subscribersIndex
    const available = this.capacity - size
    const forPubSub = Math.min(n, available)
    if (forPubSub === 0) {
      return chunk
    }
    let iteratorIndex = 0
    const publishAllIndex = this.publisherIndex + forPubSub
    while (this.publisherIndex !== publishAllIndex) {
      const a = chunk[iteratorIndex++]
      const index = this.publisherIndex % this.capacity
      this.array[index] = a
      this.subscribers[index] = this.subscriberCount
      this.publisherIndex += 1
      if (this.replayBuffer) {
        this.replayBuffer.offer(a)
      }
    }
    return chunk.slice(iteratorIndex)
  }

  slide(): void {
    if (this.subscribersIndex !== this.publisherIndex) {
      const index = this.subscribersIndex % this.capacity
      this.array[index] = AbsentValue as unknown as A
      this.subscribers[index] = 0
      this.subscribersIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.slide()
    }
  }

  subscribe(): PubSub.PubSub.BackingSubscription<A> {
    this.subscriberCount += 1
    return new BoundedPubSubArbSubscription(this, this.publisherIndex, false)
  }
}

class BoundedPubSubArbSubscription<in out A> implements PubSub.PubSub.BackingSubscription<A> {
  constructor(
    private self: BoundedPubSubArb<A>,
    private subscriberIndex: number,
    private unsubscribed: boolean
  ) {
  }

  isEmpty(): boolean {
    return (
      this.unsubscribed ||
      this.self.publisherIndex === this.subscriberIndex ||
      this.self.publisherIndex === this.self.subscribersIndex
    )
  }

  size() {
    if (this.unsubscribed) {
      return 0
    }
    return this.self.publisherIndex - Math.max(this.subscriberIndex, this.self.subscribersIndex)
  }

  poll(): A | MutableList.Empty {
    if (this.unsubscribed) {
      return MutableList.Empty
    }
    this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
    if (this.subscriberIndex !== this.self.publisherIndex) {
      const index = this.subscriberIndex % this.self.capacity
      const elem = this.self.array[index]!
      this.self.subscribers[index] -= 1
      if (this.self.subscribers[index] === 0) {
        this.self.array[index] = AbsentValue as unknown as A
        this.self.subscribersIndex += 1
      }
      this.subscriberIndex += 1
      return elem
    }
    return MutableList.Empty
  }

  pollUpTo(n: number): Array<A> {
    if (this.unsubscribed) {
      return []
    }
    this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
    const size = this.self.publisherIndex - this.subscriberIndex
    const toPoll = Math.min(n, size)
    if (toPoll <= 0) {
      return []
    }
    const builder: Array<A> = []
    const pollUpToIndex = this.subscriberIndex + toPoll
    while (this.subscriberIndex !== pollUpToIndex) {
      const index = this.subscriberIndex % this.self.capacity
      const a = this.self.array[index] as A
      this.self.subscribers[index] -= 1
      if (this.self.subscribers[index] === 0) {
        this.self.array[index] = AbsentValue as unknown as A
        this.self.subscribersIndex += 1
      }
      builder.push(a)
      this.subscriberIndex += 1
    }

    return builder
  }

  unsubscribe(): void {
    if (!this.unsubscribed) {
      this.unsubscribed = true
      this.self.subscriberCount -= 1
      this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
      while (this.subscriberIndex !== this.self.publisherIndex) {
        const index = this.subscriberIndex % this.self.capacity
        this.self.subscribers[index] -= 1
        if (this.self.subscribers[index] === 0) {
          this.self.array[index] = AbsentValue as unknown as A
          this.self.subscribersIndex += 1
        }
        this.subscriberIndex += 1
      }
    }
  }
}

/** @internal */
class BoundedPubSubPow2<in out A> implements PubSub.PubSub.Atomic<A> {
  array: Array<A>
  mask: number
  publisherIndex = 0
  subscribers: Array<number>
  subscriberCount = 0
  subscribersIndex = 0

  constructor(readonly capacity: number, readonly replayBuffer: ReplayBuffer<A> | undefined) {
    this.array = Array.from({ length: capacity })
    this.mask = capacity - 1
    this.subscribers = Array.from({ length: capacity })
  }

  replayWindow(): PubSub.PubSub.ReplayWindow<A> {
    return this.replayBuffer ? new ReplayWindowImpl(this.replayBuffer) : emptyReplayWindow
  }

  isEmpty(): boolean {
    return this.publisherIndex === this.subscribersIndex
  }

  isFull(): boolean {
    return this.publisherIndex === this.subscribersIndex + this.capacity
  }

  size(): number {
    return this.publisherIndex - this.subscribersIndex
  }

  publish(value: A): boolean {
    if (this.isFull()) {
      return false
    }
    if (this.subscriberCount !== 0) {
      const index = this.publisherIndex & this.mask
      this.array[index] = value
      this.subscribers[index] = this.subscriberCount
      this.publisherIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.offer(value)
    }
    return true
  }

  publishAll(elements: Iterable<A>): Array<A> {
    if (this.subscriberCount === 0) {
      if (this.replayBuffer) {
        this.replayBuffer.offerAll(elements)
      }
      return []
    }
    const chunk = Arr.fromIterable(elements)
    const n = chunk.length
    const size = this.publisherIndex - this.subscribersIndex
    const available = this.capacity - size
    const forPubSub = Math.min(n, available)
    if (forPubSub === 0) {
      return chunk
    }
    let iteratorIndex = 0
    const publishAllIndex = this.publisherIndex + forPubSub
    while (this.publisherIndex !== publishAllIndex) {
      const elem = chunk[iteratorIndex++]
      const index = this.publisherIndex & this.mask
      this.array[index] = elem
      this.subscribers[index] = this.subscriberCount
      this.publisherIndex += 1
      if (this.replayBuffer) {
        this.replayBuffer.offer(elem)
      }
    }
    return chunk.slice(iteratorIndex)
  }

  slide(): void {
    if (this.subscribersIndex !== this.publisherIndex) {
      const index = this.subscribersIndex & this.mask
      this.array[index] = AbsentValue as unknown as A
      this.subscribers[index] = 0
      this.subscribersIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.slide()
    }
  }

  subscribe(): PubSub.PubSub.BackingSubscription<A> {
    this.subscriberCount += 1
    return new BoundedPubSubPow2Subscription(this, this.publisherIndex, false)
  }
}

/** @internal */
class BoundedPubSubPow2Subscription<in out A> implements PubSub.PubSub.BackingSubscription<A> {
  constructor(
    private self: BoundedPubSubPow2<A>,
    private subscriberIndex: number,
    private unsubscribed: boolean
  ) {
  }

  isEmpty(): boolean {
    return (
      this.unsubscribed ||
      this.self.publisherIndex === this.subscriberIndex ||
      this.self.publisherIndex === this.self.subscribersIndex
    )
  }

  size() {
    if (this.unsubscribed) {
      return 0
    }
    return this.self.publisherIndex - Math.max(this.subscriberIndex, this.self.subscribersIndex)
  }

  poll(): A | MutableList.Empty {
    if (this.unsubscribed) {
      return MutableList.Empty
    }
    this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
    if (this.subscriberIndex !== this.self.publisherIndex) {
      const index = this.subscriberIndex & this.self.mask
      const elem = this.self.array[index]!
      this.self.subscribers[index] -= 1
      if (this.self.subscribers[index] === 0) {
        this.self.array[index] = AbsentValue as unknown as A
        this.self.subscribersIndex += 1
      }
      this.subscriberIndex += 1
      return elem
    }
    return MutableList.Empty
  }

  pollUpTo(n: number): Array<A> {
    if (this.unsubscribed) {
      return []
    }
    this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
    const size = this.self.publisherIndex - this.subscriberIndex
    const toPoll = Math.min(n, size)
    if (toPoll <= 0) {
      return []
    }
    const builder: Array<A> = []
    const pollUpToIndex = this.subscriberIndex + toPoll
    while (this.subscriberIndex !== pollUpToIndex) {
      const index = this.subscriberIndex & this.self.mask
      const elem = this.self.array[index] as A
      this.self.subscribers[index] -= 1
      if (this.self.subscribers[index] === 0) {
        this.self.array[index] = AbsentValue as unknown as A
        this.self.subscribersIndex += 1
      }
      builder.push(elem)
      this.subscriberIndex += 1
    }
    return builder
  }

  unsubscribe(): void {
    if (!this.unsubscribed) {
      this.unsubscribed = true
      this.self.subscriberCount -= 1
      this.subscriberIndex = Math.max(this.subscriberIndex, this.self.subscribersIndex)
      while (this.subscriberIndex !== this.self.publisherIndex) {
        const index = this.subscriberIndex & this.self.mask
        this.self.subscribers[index] -= 1
        if (this.self.subscribers[index] === 0) {
          this.self.array[index] = AbsentValue as unknown as A
          this.self.subscribersIndex += 1
        }
        this.subscriberIndex += 1
      }
    }
  }
}

/** @internal */
class BoundedPubSubSingle<in out A> implements PubSub.PubSub.Atomic<A> {
  publisherIndex = 0
  subscriberCount = 0
  subscribers = 0
  value: A = AbsentValue as unknown as A

  readonly capacity = 1
  constructor(readonly replayBuffer: ReplayBuffer<A> | undefined) {}

  replayWindow(): PubSub.PubSub.ReplayWindow<A> {
    return this.replayBuffer ? new ReplayWindowImpl(this.replayBuffer) : emptyReplayWindow
  }

  pipe() {
    return pipeArguments(this, arguments)
  }

  isEmpty(): boolean {
    return this.subscribers === 0
  }

  isFull(): boolean {
    return !this.isEmpty()
  }

  size(): number {
    return this.isEmpty() ? 0 : 1
  }

  publish(value: A): boolean {
    if (this.isFull()) {
      return false
    }
    if (this.subscriberCount !== 0) {
      this.value = value
      this.subscribers = this.subscriberCount
      this.publisherIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.offer(value)
    }
    return true
  }

  publishAll(elements: Iterable<A>): Array<A> {
    if (this.subscriberCount === 0) {
      if (this.replayBuffer) {
        this.replayBuffer.offerAll(elements)
      }
      return []
    }
    const chunk = Arr.fromIterable(elements)
    if (chunk.length === 0) {
      return chunk
    }
    if (this.publish(chunk[0])) {
      return chunk.slice(1)
    } else {
      return chunk
    }
  }

  slide(): void {
    if (this.isFull()) {
      this.subscribers = 0
      this.value = AbsentValue as unknown as A
    }
    if (this.replayBuffer) {
      this.replayBuffer.slide()
    }
  }

  subscribe(): PubSub.PubSub.BackingSubscription<A> {
    this.subscriberCount += 1
    return new BoundedPubSubSingleSubscription(this, this.publisherIndex, false)
  }
}

/** @internal */
class BoundedPubSubSingleSubscription<in out A> implements PubSub.PubSub.BackingSubscription<A> {
  constructor(
    private self: BoundedPubSubSingle<A>,
    private subscriberIndex: number,
    private unsubscribed: boolean
  ) {
  }

  isEmpty(): boolean {
    return (
      this.unsubscribed ||
      this.self.subscribers === 0 ||
      this.subscriberIndex === this.self.publisherIndex
    )
  }

  size() {
    return this.isEmpty() ? 0 : 1
  }

  poll(): A | MutableList.Empty {
    if (this.isEmpty()) {
      return MutableList.Empty
    }
    const elem = this.self.value
    this.self.subscribers -= 1
    if (this.self.subscribers === 0) {
      this.self.value = AbsentValue as unknown as A
    }
    this.subscriberIndex += 1
    return elem
  }

  pollUpTo(n: number): Array<A> {
    if (this.isEmpty() || n < 1) {
      return []
    }
    const a = this.self.value
    this.self.subscribers -= 1
    if (this.self.subscribers === 0) {
      this.self.value = AbsentValue as unknown as A
    }
    this.subscriberIndex += 1
    return [a]
  }

  unsubscribe(): void {
    if (!this.unsubscribed) {
      this.unsubscribed = true
      this.self.subscriberCount -= 1
      if (this.subscriberIndex !== this.self.publisherIndex) {
        this.self.subscribers -= 1
        if (this.self.subscribers === 0) {
          this.self.value = AbsentValue as unknown as A
        }
      }
    }
  }
}

/** @internal */
interface Node<out A> {
  value: A | AbsentValue
  subscribers: number
  next: Node<A> | null
}

/** @internal */
class UnboundedPubSub<in out A> implements PubSub.PubSub.Atomic<A> {
  publisherHead: Node<A> = {
    value: AbsentValue,
    subscribers: 0,
    next: null
  }
  publisherTail = this.publisherHead
  publisherIndex = 0
  subscribersIndex = 0

  readonly capacity = Number.MAX_SAFE_INTEGER
  constructor(readonly replayBuffer: ReplayBuffer<A> | undefined) {}

  replayWindow(): PubSub.PubSub.ReplayWindow<A> {
    return this.replayBuffer ? new ReplayWindowImpl(this.replayBuffer) : emptyReplayWindow
  }

  isEmpty(): boolean {
    return this.publisherHead === this.publisherTail
  }

  isFull(): boolean {
    return false
  }

  size(): number {
    return this.publisherIndex - this.subscribersIndex
  }

  publish(value: A): boolean {
    const subscribers = this.publisherTail.subscribers
    if (subscribers !== 0) {
      this.publisherTail.next = {
        value,
        subscribers,
        next: null
      }
      this.publisherTail = this.publisherTail.next
      this.publisherIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.offer(value)
    }
    return true
  }

  publishAll(elements: Iterable<A>): Array<A> {
    if (this.publisherTail.subscribers !== 0) {
      for (const a of elements) {
        this.publish(a)
      }
    } else if (this.replayBuffer) {
      this.replayBuffer.offerAll(elements)
    }
    return []
  }

  slide(): void {
    if (this.publisherHead !== this.publisherTail) {
      this.publisherHead = this.publisherHead.next!
      this.publisherHead.value = AbsentValue
      this.subscribersIndex += 1
    }
    if (this.replayBuffer) {
      this.replayBuffer.slide()
    }
  }

  subscribe(): PubSub.PubSub.BackingSubscription<A> {
    this.publisherTail.subscribers += 1
    return new UnboundedPubSubSubscription(
      this,
      this.publisherTail,
      this.publisherIndex,
      false
    )
  }
}

/** @internal */
class UnboundedPubSubSubscription<in out A> implements PubSub.PubSub.BackingSubscription<A> {
  constructor(
    private self: UnboundedPubSub<A>,
    private subscriberHead: Node<A>,
    private subscriberIndex: number,
    private unsubscribed: boolean
  ) {
  }

  isEmpty(): boolean {
    if (this.unsubscribed) {
      return true
    }
    let empty = true
    let loop = true
    while (loop) {
      if (this.subscriberHead === this.self.publisherTail) {
        loop = false
      } else {
        if (this.subscriberHead.next!.value !== AbsentValue) {
          empty = false
          loop = false
        } else {
          this.subscriberHead = this.subscriberHead.next!
          this.subscriberIndex += 1
        }
      }
    }
    return empty
  }

  size() {
    if (this.unsubscribed) {
      return 0
    }
    return this.self.publisherIndex - Math.max(this.subscriberIndex, this.self.subscribersIndex)
  }

  poll(): A | MutableList.Empty {
    if (this.unsubscribed) {
      return MutableList.Empty
    }
    let loop = true
    let polled: A | MutableList.Empty = MutableList.Empty
    while (loop) {
      if (this.subscriberHead === this.self.publisherTail) {
        loop = false
      } else {
        const elem = this.subscriberHead.next!.value
        if (elem !== AbsentValue) {
          polled = elem
          this.subscriberHead.subscribers -= 1
          if (this.subscriberHead.subscribers === 0) {
            this.self.publisherHead = this.self.publisherHead.next!
            this.self.publisherHead.value = AbsentValue
            this.self.subscribersIndex += 1
          }
          loop = false
        }
        this.subscriberHead = this.subscriberHead.next!
        this.subscriberIndex += 1
      }
    }
    return polled
  }

  pollUpTo(n: number): Array<A> {
    const builder: Array<A> = []
    let i = 0
    while (i !== n) {
      const a = this.poll()
      if (a === MutableList.Empty) {
        i = n
      } else {
        builder.push(a)
        i += 1
      }
    }
    return builder
  }

  unsubscribe(): void {
    if (!this.unsubscribed) {
      this.unsubscribed = true
      this.self.publisherTail.subscribers -= 1
      while (this.subscriberHead !== this.self.publisherTail) {
        if (this.subscriberHead.next!.value !== AbsentValue) {
          this.subscriberHead.subscribers -= 1
          if (this.subscriberHead.subscribers === 0) {
            this.self.publisherHead = this.self.publisherHead.next!
            this.self.publisherHead.value = AbsentValue
            this.self.subscribersIndex += 1
          }
        }
        this.subscriberHead = this.subscriberHead.next!
      }
    }
  }
}

/** @internal */
export const SubscriptionTypeId: PubSub.SubscriptionTypeId = Symbol.for(
  "effect/PubSub/Subscription"
) as PubSub.SubscriptionTypeId

/** @internal */
class SubscriptionImpl<in out A> implements PubSub.Subscription<A> {
  readonly [SubscriptionTypeId] = {
    _A: identity
  }

  constructor(
    readonly pubsub: PubSub.PubSub.Atomic<A>,
    readonly subscribers: PubSub.PubSub.Subscribers<A>,
    readonly subscription: PubSub.PubSub.BackingSubscription<A>,
    readonly pollers: MutableList.MutableList<Deferred.Deferred<A>>,
    readonly shutdownHook: Deferred.Deferred<void>,
    readonly shutdownFlag: MutableRef.MutableRef<boolean>,
    readonly strategy: PubSub.PubSub.Strategy<A>,
    readonly replayWindow: PubSub.PubSub.ReplayWindow<A>
  ) {}

  pipe() {
    return pipeArguments(this, arguments)
  }
}

/** @internal */
export const unsubscribe = <A>(self: PubSub.Subscription<A>): Effect.Effect<void> =>
  Effect.uninterruptible(
    Effect.withFiber<void>((state) => {
      MutableRef.set(self.shutdownFlag, true)
      return Effect.forEach(
        MutableList.takeAll(self.pollers),
        (d) => Deferred.interruptWith(d, state.id),
        { discard: true, concurrency: "unbounded" }
      ).pipe(
        Effect.tap(() => {
          self.subscribers.delete(self.subscription)
          self.subscription.unsubscribe()
          self.strategy.unsafeOnPubSubEmptySpace(self.pubsub, self.subscribers)
        }),
        Effect.when(Deferred.succeed(self.shutdownHook, void 0)),
        Effect.asVoid
      )
    })
  )

/** @internal */
export const take = <A>(self: PubSub.Subscription<A>): Effect.Effect<A> =>
  Effect.suspend(() => {
    if (self.shutdownFlag.current) {
      return Effect.interrupt
    }
    if (self.replayWindow.remaining > 0) {
      const message = self.replayWindow.take()!
      return Effect.succeed(message)
    }
    const message = self.pollers.length === 0
      ? self.subscription.poll()
      : MutableList.Empty
    if (message === MutableList.Empty) {
      const deferred = Deferred.unsafeMake<A>()
      return Effect.suspend(() => {
        MutableList.append(self.pollers, deferred)
        addSubscribers(self.subscribers, self.subscription, self.pollers)
        self.strategy.unsafeCompletePollers(
          self.pubsub,
          self.subscribers,
          self.subscription,
          self.pollers
        )
        return self.shutdownFlag.current ? Effect.interrupt : Deferred.await(deferred)
      }).pipe(
        Effect.onInterrupt(Effect.sync(() => unsafeRemove(self.pollers, deferred)))
      )
    } else {
      self.strategy.unsafeOnPubSubEmptySpace(self.pubsub, self.subscribers)
      return Effect.succeed(message)
    }
  })

/** @internal */
export const takeAll = <A>(self: PubSub.Subscription<A>): Effect.Effect<Array<A>> =>
  Effect.suspend(() => {
    if (self.shutdownFlag.current) {
      return Effect.interrupt
    }
    const as = self.pollers.length === 0
      ? self.subscription.pollUpTo(Number.POSITIVE_INFINITY)
      : []
    self.strategy.unsafeOnPubSubEmptySpace(self.pubsub, self.subscribers)
    if (self.replayWindow.remaining > 0) {
      return Effect.succeed(self.replayWindow.takeAll().concat(as))
    }
    return Effect.succeed(as)
  })

/** @internal */
export const takeUpTo: {
  (max: number): <A>(self: PubSub.Subscription<A>) => Effect.Effect<Array<A>>
  <A>(self: PubSub.Subscription<A>, max: number): Effect.Effect<Array<A>>
} = dual(2, <A>(self: PubSub.Subscription<A>, max: number): Effect.Effect<Array<A>> =>
  Effect.suspend(() => {
    if (self.shutdownFlag.current) return Effect.interrupt
    let replay: Array<A> | undefined = undefined
    if (self.replayWindow.remaining >= max) {
      return Effect.succeed(self.replayWindow.takeN(max))
    } else if (self.replayWindow.remaining > 0) {
      replay = self.replayWindow.takeAll()
      max = max - replay.length
    }
    const as = self.pollers.length === 0
      ? self.subscription.pollUpTo(max)
      : []
    self.strategy.unsafeOnPubSubEmptySpace(self.pubsub, self.subscribers)
    return replay ? Effect.succeed(replay.concat(as)) : Effect.succeed(as)
  }))

/** @internal */
export const takeBetween: {
  (min: number, max: number): <A>(self: PubSub.Subscription<A>) => Effect.Effect<Array<A>>
  <A>(self: PubSub.Subscription<A>, min: number, max: number): Effect.Effect<Array<A>>
} = dual(
  3,
  <A>(self: PubSub.Subscription<A>, min: number, max: number): Effect.Effect<Array<A>> =>
    Effect.suspend(() => takeRemainderLoop(self, min, max, []))
)

const takeRemainderLoop = <A>(
  self: PubSub.Subscription<A>,
  min: number,
  max: number,
  acc: Array<A>
): Effect.Effect<Array<A>> => {
  if (max < min) {
    return Effect.succeed(acc)
  }
  return Effect.flatMap(takeUpTo(self, max), (bs) => {
    // eslint-disable-next-line no-restricted-syntax
    acc.push(...bs)
    const remaining = min - bs.length
    if (remaining === 1) {
      return Effect.map(take(self), (b) => {
        acc.push(b)
        return acc
      })
    }
    if (remaining > 1) {
      return Effect.flatMap(take(self), (b) => {
        acc.push(b)
        return takeRemainderLoop(
          self,
          remaining - 1,
          max - bs.length - 1,
          acc
        )
      })
    }
    return Effect.succeed(acc)
  })
}

/** @internal */
export const remaining = <A>(self: PubSub.Subscription<A>): Effect.Effect<number> =>
  Effect.suspend(() =>
    self.shutdownFlag.current
      ? Effect.interrupt
      : Effect.succeed(self.subscription.size() + self.replayWindow.remaining)
  )

/** @internal */
export const unsafeRemaining = <A>(self: PubSub.Subscription<A>): Option.Option<number> => {
  if (self.shutdownFlag.current) {
    return Option.none()
  }
  return Option.some(self.subscription.size() + self.replayWindow.remaining)
}

/** @internal */
class PubSubImpl<in out A> implements PubSub.PubSub<A> {
  readonly [TypeId] = {
    _A: identity
  }

  constructor(
    readonly pubsub: PubSub.PubSub.Atomic<A>,
    readonly subscribers: PubSub.PubSub.Subscribers<A>,
    readonly scope: Scope.Scope.Closeable,
    readonly shutdownHook: Deferred.Deferred<void>,
    readonly shutdownFlag: MutableRef.MutableRef<boolean>,
    readonly strategy: PubSub.PubSub.Strategy<A>
  ) {}

  pipe() {
    return pipeArguments(this, arguments)
  }
}

/** @internal */
export const makePubSub = <A>(
  pubsub: PubSub.PubSub.Atomic<A>,
  strategy: PubSub.PubSub.Strategy<A>
): Effect.Effect<PubSub.PubSub<A>> =>
  Effect.sync(() =>
    unsafeMakePubSub(
      pubsub,
      new Map(),
      Scope.unsafeMake(),
      Deferred.unsafeMake(),
      MutableRef.make(false),
      strategy
    )
  )

/** @internal */
export const unsafeMakePubSub = <A>(
  pubsub: PubSub.PubSub.Atomic<A>,
  subscribers: PubSub.PubSub.Subscribers<A>,
  scope: Scope.Scope.Closeable,
  shutdownHook: Deferred.Deferred<void>,
  shutdownFlag: MutableRef.MutableRef<boolean>,
  strategy: PubSub.PubSub.Strategy<A>
): PubSub.PubSub<A> => new PubSubImpl(pubsub, subscribers, scope, shutdownHook, shutdownFlag, strategy)

/** @internal */
const ensureCapacity = (capacity: number): void => {
  if (capacity <= 0) {
    throw new Error(`Cannot construct PubSub with capacity of ${capacity}`)
  }
}

/** @internal */
const unsafeRemove = <A>(queue: MutableList.MutableList<A>, value: A): void => {
  const items = MutableList.takeAll(queue)
  for (let i = 0; i < items.length; i++) {
    if (items[i] !== value) {
      MutableList.append(queue, items[i])
    }
  }
}

// -----------------------------------------------------------------------------
// PubSub.Strategy
// -----------------------------------------------------------------------------

/**
 * A strategy that applies back pressure to publishers when the `PubSub` is at
 * capacity. This guarantees that all subscribers will receive all messages
 * published to the `PubSub` while they are subscribed. However, it creates the
 * risk that a slow subscriber will slow down the rate at which messages
 * are published and received by other subscribers.
 *
 * @internal
 */
class BackPressureStrategy<in out A> implements PubSub.PubSub.Strategy<A> {
  publishers: MutableList.MutableList<
    readonly [A, Deferred.Deferred<boolean>, boolean]
  > = MutableList.make()

  get shutdown(): Effect.Effect<void> {
    return Effect.withFiber((fiber) => {
      const publishers = MutableList.takeAll(this.publishers)
      return Effect.forEach(
        publishers,
        ([_, deferred, last]) => last ? Deferred.interruptWith(deferred, fiber.id) : Effect.void,
        { concurrency: "unbounded", discard: true }
      )
    })
  }

  handleSurplus(
    pubsub: PubSub.PubSub.Atomic<A>,
    subscribers: PubSub.PubSub.Subscribers<A>,
    elements: Iterable<A>,
    isShutdown: MutableRef.MutableRef<boolean>
  ): Effect.Effect<boolean> {
    return Effect.suspend(() => {
      const deferred = Deferred.unsafeMake<boolean>()
      this.unsafeOffer(elements, deferred)
      this.unsafeOnPubSubEmptySpace(pubsub, subscribers)
      this.unsafeCompleteSubscribers(pubsub, subscribers)
      return (MutableRef.get(isShutdown) ? Effect.interrupt : Deferred.await(deferred)).pipe(
        Effect.onInterrupt(Effect.sync(() => this.unsafeRemove(deferred)))
      )
    })
  }

  unsafeOnPubSubEmptySpace(
    pubsub: PubSub.PubSub.Atomic<A>,
    subscribers: PubSub.PubSub.Subscribers<A>
  ): void {
    let keepPolling = true
    while (keepPolling && !pubsub.isFull()) {
      const publisher = MutableList.take(this.publishers)
      if (publisher === MutableList.Empty) {
        keepPolling = false
      } else {
        const [value, deferred] = publisher
        const published = pubsub.publish(value)
        if (published && publisher[2]) {
          Deferred.unsafeDone(deferred, Exit.succeed(true))
        } else if (!published) {
          MutableList.prepend(this.publishers, publisher)
        }
        this.unsafeCompleteSubscribers(pubsub, subscribers)
      }
    }
  }

  unsafeCompletePollers(
    pubsub: PubSub.PubSub.Atomic<A>,
    subscribers: PubSub.PubSub.Subscribers<A>,
    subscription: PubSub.PubSub.BackingSubscription<A>,
    pollers: MutableList.MutableList<Deferred.Deferred<A>>
  ): void {
    return unsafeStrategyCompletePollers(this, pubsub, subscribers, subscription, pollers)
  }

  unsafeCompleteSubscribers(pubsub: PubSub.PubSub.Atomic<A>, subscribers: PubSub.PubSub.Subscribers<A>): void {
    return unsafeStrategyCompleteSubscribers(this, pubsub, subscribers)
  }

  private unsafeOffer(elements: Iterable<A>, deferred: Deferred.Deferred<boolean>): void {
    const iterator = elements[Symbol.iterator]()
    let next: IteratorResult<A> = iterator.next()
    if (!next.done) {
      // eslint-disable-next-line no-constant-condition
      while (1) {
        const value = next.value
        next = iterator.next()
        if (next.done) {
          MutableList.append(this.publishers, [value, deferred, true])
          break
        }
        MutableList.append(this.publishers, [value, deferred, false])
      }
    }
  }

  unsafeRemove(deferred: Deferred.Deferred<boolean>): void {
    const items = MutableList.takeAll(this.publishers)
    for (let i = 0; i < items.length; i++) {
      if (items[i][1] !== deferred) {
        MutableList.append(this.publishers, items[i])
      }
    }
  }
}

/**
 * A strategy that drops new messages when the `PubSub` is at capacity. This
 * guarantees that a slow subscriber will not slow down the rate at which
 * messages are published. However, it creates the risk that a slow
 * subscriber will slow down the rate at which messages are received by
 * other subscribers and that subscribers may not receive all messages
 * published to the `PubSub` while they are subscribed.
 *
 * @internal
 */
export class DroppingStrategy<in out A> implements PubSub.PubSub.Strategy<A> {
  get shutdown(): Effect.Effect<void> {
    return Effect.void
  }

  handleSurplus(
    _pubsub: PubSub.PubSub.Atomic<A>,
    _subscribers: PubSub.PubSub.Subscribers<A>,
    _elements: Iterable<A>,
    _isShutdown: MutableRef.MutableRef<boolean>
  ): Effect.Effect<boolean> {
    return Effect.succeed(false)
  }

  unsafeOnPubSubEmptySpace(
    _pubsub: PubSub.PubSub.Atomic<A>,
    _subscribers: PubSub.PubSub.Subscribers<A>
  ): void {
    //
  }

  unsafeCompletePollers(
    pubsub: PubSub.PubSub.Atomic<A>,
    subscribers: PubSub.PubSub.Subscribers<A>,
    subscription: PubSub.PubSub.BackingSubscription<A>,
    pollers: MutableList.MutableList<Deferred.Deferred<A>>
  ): void {
    return unsafeStrategyCompletePollers(this, pubsub, subscribers, subscription, pollers)
  }

  unsafeCompleteSubscribers(pubsub: PubSub.PubSub.Atomic<A>, subscribers: PubSub.PubSub.Subscribers<A>): void {
    return unsafeStrategyCompleteSubscribers(this, pubsub, subscribers)
  }
}

/**
 * A strategy that adds new messages and drops old messages when the `PubSub` is
 * at capacity. This guarantees that a slow subscriber will not slow down
 * the rate at which messages are published and received by other
 * subscribers. However, it creates the risk that a slow subscriber will
 * not receive some messages published to the `PubSub` while it is subscribed.
 *
 * @internal
 */
export class SlidingStrategy<in out A> implements PubSub.PubSub.Strategy<A> {
  get shutdown(): Effect.Effect<void> {
    return Effect.void
  }

  handleSurplus(
    pubsub: PubSub.PubSub.Atomic<A>,
    subscribers: PubSub.PubSub.Subscribers<A>,
    elements: Iterable<A>,
    _isShutdown: MutableRef.MutableRef<boolean>
  ): Effect.Effect<boolean> {
    return Effect.sync(() => {
      this.unsafeSlidingPublish(pubsub, elements)
      this.unsafeCompleteSubscribers(pubsub, subscribers)
      return true
    })
  }

  unsafeOnPubSubEmptySpace(
    _pubsub: PubSub.PubSub.Atomic<A>,
    _subscribers: PubSub.PubSub.Subscribers<A>
  ): void {
    //
  }

  unsafeCompletePollers(
    pubsub: PubSub.PubSub.Atomic<A>,
    subscribers: PubSub.PubSub.Subscribers<A>,
    subscription: PubSub.PubSub.BackingSubscription<A>,
    pollers: MutableList.MutableList<Deferred.Deferred<A>>
  ): void {
    return unsafeStrategyCompletePollers(this, pubsub, subscribers, subscription, pollers)
  }

  unsafeCompleteSubscribers(pubsub: PubSub.PubSub.Atomic<A>, subscribers: PubSub.PubSub.Subscribers<A>): void {
    return unsafeStrategyCompleteSubscribers(this, pubsub, subscribers)
  }

  unsafeSlidingPublish(pubsub: PubSub.PubSub.Atomic<A>, elements: Iterable<A>): void {
    const it = elements[Symbol.iterator]()
    let next = it.next()
    if (!next.done && pubsub.capacity > 0) {
      let a = next.value
      let loop = true
      while (loop) {
        pubsub.slide()
        const pub = pubsub.publish(a)
        if (pub && (next = it.next()) && !next.done) {
          a = next.value
        } else if (pub) {
          loop = false
        }
      }
    }
  }
}

/** @internal */
const unsafeStrategyCompletePollers = <A>(
  strategy: PubSub.PubSub.Strategy<A>,
  pubsub: PubSub.PubSub.Atomic<A>,
  subscribers: PubSub.PubSub.Subscribers<A>,
  subscription: PubSub.PubSub.BackingSubscription<A>,
  pollers: MutableList.MutableList<Deferred.Deferred<A>>
): void => {
  let keepPolling = true
  while (keepPolling && !subscription.isEmpty()) {
    const poller = MutableList.take(pollers)
    if (poller === MutableList.Empty) {
      removeSubscribers(subscribers, subscription, pollers)
      if (pollers.length === 0) {
        keepPolling = false
      } else {
        addSubscribers(subscribers, subscription, pollers)
      }
    } else {
      const pollResult = subscription.poll()
      if (pollResult === MutableList.Empty) {
        MutableList.prepend(pollers, poller)
      } else {
        Deferred.unsafeDone(poller, Exit.succeed(pollResult))
        strategy.unsafeOnPubSubEmptySpace(pubsub, subscribers)
      }
    }
  }
}

/** @internal */
const unsafeStrategyCompleteSubscribers = <A>(
  strategy: PubSub.PubSub.Strategy<A>,
  pubsub: PubSub.PubSub.Atomic<A>,
  subscribers: PubSub.PubSub.Subscribers<A>
): void => {
  for (
    const [subscription, pollersSet] of subscribers
  ) {
    for (const pollers of pollersSet) {
      strategy.unsafeCompletePollers(pubsub, subscribers, subscription, pollers)
    }
  }
}

interface ReplayNode<A> {
  value: A | AbsentValue
  next: ReplayNode<A> | null
}

class ReplayBuffer<A> {
  constructor(readonly capacity: number) {}

  head: ReplayNode<A> = { value: AbsentValue, next: null }
  tail: ReplayNode<A> = this.head
  size = 0
  index = 0

  slide() {
    this.index++
  }
  offer(a: A): void {
    this.tail.value = a
    this.tail.next = {
      value: AbsentValue,
      next: null
    }
    this.tail = this.tail.next
    if (this.size === this.capacity) {
      this.head = this.head.next!
    } else {
      this.size += 1
    }
  }
  offerAll(as: Iterable<A>): void {
    for (const a of as) {
      this.offer(a)
    }
  }
}

class ReplayWindowImpl<A> implements PubSub.PubSub.ReplayWindow<A> {
  head: ReplayNode<A>
  index: number
  remaining: number
  constructor(readonly buffer: ReplayBuffer<A>) {
    this.index = buffer.index
    this.remaining = buffer.size
    this.head = buffer.head
  }
  fastForward() {
    while (this.index < this.buffer.index) {
      this.head = this.head.next!
      this.index++
    }
  }
  take(): A | undefined {
    if (this.remaining === 0) {
      return undefined
    } else if (this.index < this.buffer.index) {
      this.fastForward()
    }
    this.remaining--
    const value = this.head.value
    this.head = this.head.next!
    return value as A
  }
  takeN(n: number): Array<A> {
    if (this.remaining === 0) {
      return []
    } else if (this.index < this.buffer.index) {
      this.fastForward()
    }
    const len = Math.min(n, this.remaining)
    const items = new Array(len)
    for (let i = 0; i < len; i++) {
      const value = this.head.value as A
      this.head = this.head.next!
      items[i] = value
    }
    this.remaining -= len
    return items
  }
  takeAll(): Array<A> {
    return this.takeN(this.remaining)
  }
}

const emptyReplayWindow: PubSub.PubSub.ReplayWindow<never> = {
  remaining: 0,
  take: () => undefined,
  takeN: () => [],
  takeAll: () => []
}
