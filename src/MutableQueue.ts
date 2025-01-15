/**
 * @since 2.0.0
 */
import * as Dual from "./Function.js"
import { type Inspectable } from "./Inspectable.js"
import { PipeInspectableProto } from "./internal/effectable.js"
import * as MutableList from "./MutableList.js"
import type { Pipeable } from "./Pipeable.js"

const TypeId: unique symbol = Symbol.for("effect/MutableQueue") as TypeId

/**
 * @since 2.0.0
 * @category symbol
 */
export type TypeId = typeof TypeId

export {
  /**
   * @since 2.0.0
   * @category symbol
   */
  Empty
} from "./MutableList.js"

/**
 * @since 2.0.0
 * @category model
 */
export interface MutableQueue<in out A> extends Pipeable, Inspectable {
  readonly [TypeId]: TypeId
  queue: MutableList.MutableList<A>
  capacity: number | undefined
}

const MutableQueueProto: Omit<MutableQueue<unknown>, "queue" | "capacity"> = {
  [TypeId]: TypeId,
  ...PipeInspectableProto,
  toJSON(this: any) {
    return {
      _id: "MutableQueue"
    }
  }
}

const make = <A>(capacity: number | undefined): MutableQueue<A> => {
  const queue = Object.create(MutableQueueProto)
  queue.queue = MutableList.make()
  queue.capacity = capacity
  return queue
}

/**
 * Creates a new bounded `MutableQueue`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const bounded = <A>(capacity: number): MutableQueue<A> => make(capacity)

/**
 * Creates a new unbounded `MutableQueue`.
 *
 * @since 2.0.0
 * @category constructors
 */
export const unbounded = <A>(): MutableQueue<A> => make(undefined)

/**
 * Returns the current number of elements in the queue.
 *
 * @since 2.0.0
 * @category getters
 */
export const length = <A>(self: MutableQueue<A>): number => self.queue.length

/**
 * Returns `true` if the queue is empty, `false` otherwise.
 *
 * @since 2.0.0
 * @category getters
 */
export const isEmpty = <A>(self: MutableQueue<A>): boolean => self.queue.length === 0

/**
 * Returns `true` if the queue is full, `false` otherwise.
 *
 * @since 2.0.0
 * @category getters
 */
export const isFull = <A>(self: MutableQueue<A>): boolean =>
  self.capacity === undefined ? false : self.queue.length === self.capacity

/**
 * The **maximum** number of elements that a queue can hold.
 *
 * **Note**: unbounded queues can still implement this interface with
 * `capacity = Infinity`.
 *
 * @since 2.0.0
 * @category getters
 */
export const capacity = <A>(self: MutableQueue<A>): number => self.capacity === undefined ? Infinity : self.capacity

/**
 * Offers an element to the queue.
 *
 * Returns whether the enqueue was successful or not.
 *
 * @since 2.0.0
 */
export const offer: {
  <A>(self: MutableQueue<A>, value: A): boolean
  <A>(value: A): (self: MutableQueue<A>) => boolean
} = Dual.dual<
  <A>(value: A) => (self: MutableQueue<A>) => boolean,
  <A>(self: MutableQueue<A>, value: A) => boolean
>(2, <A>(self: MutableQueue<A>, value: A) => {
  if (self.capacity !== undefined && self.queue.length === self.capacity) {
    return false
  }
  MutableList.append(self.queue, value)
  return true
})

/**
 * Enqueues a collection of values into the queue.
 *
 * Returns a `Array` of the values that were **not** able to be enqueued.
 *
 * @since 2.0.0
 */
export const offerAll: {
  <A>(values: Iterable<A>): (self: MutableQueue<A>) => Array<A>
  <A>(self: MutableQueue<A>, values: Iterable<A>): Array<A>
} = Dual.dual(2, <A>(self: MutableQueue<A>, values: Iterable<A>) => {
  const iterator = values[Symbol.iterator]()
  let next: IteratorResult<A> | undefined
  const remainder: Array<A> = []
  let offering = true
  while (offering && (next = iterator.next()) && !next.done) {
    offering = offer(self, next.value)
  }
  while (next != null && !next.done) {
    remainder.push(next.value)
    next = iterator.next()
  }
  return remainder
})

/**
 * Dequeues an element from the queue.
 *
 * @since 2.0.0
 */
export const poll = <A>(self: MutableQueue<A>): A | MutableList.Empty => MutableList.take(self.queue)

/**
 * Dequeues up to `n` elements from the queue.
 *
 * Returns a `Array` of up to `n` elements.
 *
 * @since 2.0.0
 */
export const pollUpTo: {
  (n: number): <A>(self: MutableQueue<A>) => Array<A>
  <A>(self: MutableQueue<A>, n: number): Array<A>
} = Dual.dual<
  (n: number) => <A>(self: MutableQueue<A>) => Array<A>,
  <A>(self: MutableQueue<A>, n: number) => Array<A>
>(2, <A>(self: MutableQueue<A>, n: number) => MutableList.takeN(self.queue, n))
