import * as Arr from "../Array.js"
import type { Cause } from "../Cause.js"
import type { Effect } from "../Effect.js"
import type { Exit } from "../Exit.js"
import { dual } from "../Function.js"
import * as Inspectable from "../Inspectable.js"
import * as Iterable from "../Iterable.js"
import type * as Api from "../Mailbox.js"
import * as Option from "../Option.js"
import { pipeArguments } from "../Pipeable.js"
import { hasProperty } from "../Predicate.js"
import { CurrentScheduler } from "../References.js"
import type { Scheduler } from "../Scheduler.js"
import * as core from "./core.js"

/** @internal */
export const TypeId: Api.TypeId = Symbol.for("effect/Mailbox") as Api.TypeId

/** @internal */
export const ReadonlyTypeId: Api.ReadonlyTypeId = Symbol.for(
  "effect/Mailbox/ReadonlyMailbox"
) as Api.ReadonlyTypeId

/** @internal */
export const isMailbox = (u: unknown): u is Api.Mailbox<unknown, unknown> => hasProperty(u, TypeId)

/** @internal */
export const isReadonlyMailbox = (
  u: unknown
): u is Api.ReadonlyMailbox<unknown, unknown> => hasProperty(u, ReadonlyTypeId)

type MailboxState<A, E> =
  | {
    readonly _tag: "Open"
    readonly takers: Set<(_: Effect<void, E>) => void>
    readonly offers: Set<OfferEntry<A>>
    readonly awaiters: Set<(_: Effect<void, E>) => void>
  }
  | {
    readonly _tag: "Closing"
    readonly takers: Set<(_: Effect<void, E>) => void>
    readonly offers: Set<OfferEntry<A>>
    readonly awaiters: Set<(_: Effect<void, E>) => void>
    readonly exit: Exit<void, E>
  }
  | {
    readonly _tag: "Done"
    readonly exit: Exit<void, E>
  }

type OfferEntry<A> =
  | {
    readonly _tag: "Array"
    readonly remaining: Array<A>
    offset: number
    readonly resume: (_: Effect<Array<A>>) => void
  }
  | {
    readonly _tag: "Single"
    readonly message: A
    readonly resume: (_: Effect<boolean>) => void
  }

const empty = Arr.empty()
const exitEmpty = core.exitSucceed(empty)
const exitFalse = core.exitSucceed(false)
const exitTrue = core.exitSucceed(true)
const constDone = [empty, true] as const
const exitFailNone = core.exitFail(Option.none())
const exitToOption: <E>(
  exit: Exit<void, E>
) => Exit<never, Option.Option<E>> = (exit) => {
  if (exit._tag === "Success") return exitFailNone
  const fail = exit.cause.failures.find((_) => _._tag === "Fail")
  return fail ? core.exitFail(Option.some(fail.error)) : (exit as any)
}

class MailboxImpl<A, E> implements Api.Mailbox<A, E> {
  readonly [TypeId]: Api.TypeId = TypeId
  readonly [ReadonlyTypeId]: Api.ReadonlyTypeId = ReadonlyTypeId
  private state: MailboxState<A, E> = {
    _tag: "Open",
    takers: new Set(),
    offers: new Set(),
    awaiters: new Set()
  }
  private messages = new MutableList<A>()
  constructor(
    readonly scheduler: Scheduler,
    private capacity: number,
    readonly strategy: "suspend" | "dropping" | "sliding"
  ) {}

  offer(message: A): Effect<boolean> {
    return core.suspend(() => {
      if (this.state._tag !== "Open") {
        return exitFalse
      } else if (this.messages.length >= this.capacity) {
        switch (this.strategy) {
          case "dropping":
            return exitFalse
          case "suspend":
            if (this.capacity <= 0 && this.state.takers.size > 0) {
              this.messages.append(message)
              this.releaseTaker()
              return exitTrue
            }
            return this.offerRemainingSingle(message)
          case "sliding":
            this.messages.take()
            this.messages.append(message)
            return exitTrue
        }
      }
      this.messages.append(message)
      this.scheduleReleaseTaker()
      return exitTrue
    })
  }
  unsafeOffer(message: A): boolean {
    if (this.state._tag !== "Open") {
      return false
    } else if (this.messages.length >= this.capacity) {
      if (this.strategy === "sliding") {
        this.messages.take()
        this.messages.append(message)
        return true
      } else if (this.capacity <= 0 && this.state.takers.size > 0) {
        this.messages.append(message)
        this.releaseTaker()
        return true
      }
      return false
    }
    this.messages.append(message)
    this.scheduleReleaseTaker()
    return true
  }
  offerAll(messages: Iterable<A>): Effect<Array<A>> {
    return core.suspend(() => {
      if (this.state._tag !== "Open") {
        return core.succeed(Arr.fromIterable(messages))
      }
      const remaining = this.unsafeOfferAllArray(messages)
      if (remaining.length === 0) {
        return exitEmpty
      } else if (this.strategy === "dropping") {
        return core.succeed(remaining)
      }
      return this.offerRemainingArray(remaining)
    })
  }
  unsafeOfferAll(messages: Iterable<A>): Array<A> {
    return this.unsafeOfferAllArray(messages)
  }
  unsafeOfferAllArray(messages: Iterable<A>): Array<A> {
    if (this.state._tag !== "Open") {
      return Arr.fromIterable(messages)
    } else if (
      this.capacity === Number.POSITIVE_INFINITY ||
      this.strategy === "sliding"
    ) {
      this.messages.appendAll(messages)
      if (this.strategy === "sliding") {
        this.messages.takeN(this.messages.length - this.capacity)
      }
      this.scheduleReleaseTaker()
      return []
    }
    const free = this.capacity <= 0
      ? this.state.takers.size
      : this.capacity - this.messages.length
    if (free === 0) {
      return Arr.fromIterable(messages)
    }
    const remaining: Array<A> = []
    let i = 0
    for (const message of messages) {
      if (i < free) {
        this.messages.append(message)
      } else {
        remaining.push(message)
      }
      i++
    }
    this.scheduleReleaseTaker()
    return remaining
  }
  fail(error: E) {
    return this.done(core.exitFail(error))
  }
  failCause(cause: Cause<E>) {
    return this.done(core.exitFailCause(cause))
  }
  unsafeDone(exit: Exit<void, E>): boolean {
    if (this.state._tag !== "Open") {
      return false
    } else if (
      this.state.offers.size === 0 &&
      this.messages.length === 0
    ) {
      this.finalize(exit)
      return true
    }
    this.state = { ...this.state, _tag: "Closing", exit }
    return true
  }
  shutdown: Effect<boolean> = core.sync(() => {
    if (this.state._tag === "Done") {
      return true
    }
    this.messages.clear()
    const offers = this.state.offers
    this.finalize(this.state._tag === "Open" ? core.exitVoid : this.state.exit)
    if (offers.size > 0) {
      for (const entry of offers) {
        if (entry._tag === "Single") {
          entry.resume(exitFalse)
        } else {
          entry.resume(core.exitSucceed(entry.remaining.slice(entry.offset)))
        }
      }
      offers.clear()
    }
    return true
  })
  done(exit: Exit<void, E>) {
    return core.sync(() => this.unsafeDone(exit))
  }
  end = this.done(core.exitVoid)
  clear: Effect<Array<A>, E> = core.suspend(() => {
    if (this.state._tag === "Done") {
      return core.exitAs(this.state.exit, empty)
    }
    const messages = this.unsafeTakeAll()
    this.releaseCapacity()
    return core.succeed(messages)
  })
  takeAll: Effect<readonly [messages: Array<A>, done: boolean], E> = core.suspend(() => {
    if (this.state._tag === "Done") {
      return core.exitAs(this.state.exit, constDone)
    }
    const messages = this.unsafeTakeAll()
    if (messages.length === 0) {
      return core.andThen(this.awaitTake, this.takeAll)
    }
    return core.succeed([messages, this.releaseCapacity()])
  })
  takeN(
    n: number
  ): Effect<readonly [messages: Array<A>, done: boolean], E> {
    return core.suspend(() => {
      if (this.state._tag === "Done") {
        return core.exitAs(this.state.exit, constDone)
      } else if (n <= 0) {
        return core.succeed([empty, false])
      }
      n = Math.min(n, this.capacity)
      if (n <= this.messages.length) {
        return core.succeed([this.messages.takeN(n), this.releaseCapacity()])
      }
      return core.andThen(this.awaitTake, this.takeN(n))
    })
  }
  unsafeTake(): Exit<A, Option.Option<E>> | undefined {
    if (this.state._tag === "Done") {
      return exitToOption(this.state.exit)
    }
    if (this.messages.length > 0) {
      const message = this.messages.take()!
      this.releaseCapacity()
      return core.exitSucceed(message)
    } else if (this.capacity <= 0 && this.state.offers.size > 0) {
      this.capacity = 1
      this.releaseCapacity()
      this.capacity = 0
      return this.messages.length > 0
        ? core.exitSucceed(this.messages.take()!)
        : undefined
    }
    return undefined
  }
  take: Effect<A, Option.Option<E>> = core.suspend(
    () => this.unsafeTake() ?? core.andThen(this.awaitTakeOption, this.take)
  )
  await: Effect<void, E> = core.async<void, E>((resume) => {
    if (this.state._tag === "Done") {
      return resume(this.state.exit)
    }
    this.state.awaiters.add(resume)
    return core.sync(() => {
      if (this.state._tag !== "Done") {
        this.state.awaiters.delete(resume)
      }
    })
  })
  unsafeSize(): Option.Option<number> {
    return this.state._tag === "Done" ? Option.none() : Option.some(this.messages.length)
  }
  size = core.sync(() => this.unsafeSize())

  commit() {
    return this.takeAll
  }
  pipe() {
    return pipeArguments(this, arguments)
  }
  toJSON() {
    return {
      _id: "effect/Mailbox",
      state: this.state._tag,
      size: this.unsafeSize().toJSON()
    }
  }
  toString(): string {
    return Inspectable.format(this)
  }
  [Inspectable.NodeInspectSymbol]() {
    return Inspectable.format(this)
  }

  private offerRemainingSingle(message: A) {
    return core.async<boolean>((resume) => {
      if (this.state._tag !== "Open") {
        return resume(exitFalse)
      }
      const entry: OfferEntry<A> = { _tag: "Single", message, resume }
      this.state.offers.add(entry)
      return core.sync(() => {
        if (this.state._tag === "Open") {
          this.state.offers.delete(entry)
        }
      })
    })
  }
  private offerRemainingArray(remaining: Array<A>) {
    return core.async<Array<A>>((resume) => {
      if (this.state._tag !== "Open") {
        return resume(core.exitSucceed(remaining))
      }
      const entry: OfferEntry<A> = {
        _tag: "Array",
        remaining,
        offset: 0,
        resume
      }
      this.state.offers.add(entry)
      return core.sync(() => {
        if (this.state._tag === "Open") {
          this.state.offers.delete(entry)
        }
      })
    })
  }
  private releaseCapacity(): boolean {
    if (this.state._tag === "Done") {
      return this.state.exit._tag === "Success"
    } else if (this.state.offers.size === 0) {
      if (
        this.state._tag === "Closing" &&
        this.messages.length === 0
      ) {
        this.finalize(this.state.exit)
        return this.state.exit._tag === "Success"
      }
      return false
    }
    let n = this.capacity - this.messages.length
    for (const entry of this.state.offers) {
      if (n === 0) return false
      else if (entry._tag === "Single") {
        this.messages.append(entry.message)
        n--
        entry.resume(exitTrue)
        this.state.offers.delete(entry)
      } else {
        for (; entry.offset < entry.remaining.length; entry.offset++) {
          if (n === 0) return false
          this.messages.append(entry.remaining[entry.offset])
          n--
        }
        entry.resume(exitEmpty)
        this.state.offers.delete(entry)
      }
    }
    return false
  }
  private awaitTake = core.async<void, E>((resume) => {
    if (this.state._tag === "Done") {
      return resume(this.state.exit)
    }
    this.state.takers.add(resume)
    return core.sync(() => {
      if (this.state._tag !== "Done") {
        this.state.takers.delete(resume)
      }
    })
  })
  private awaitTakeOption = core.mapError(this.awaitTake, Option.some)

  private scheduleRunning = false
  private scheduleReleaseTaker() {
    if (this.scheduleRunning) {
      return
    }
    this.scheduleRunning = true
    this.scheduler.scheduleTask(this.releaseTaker, 0)
  }
  private releaseTaker = () => {
    this.scheduleRunning = false
    if (this.state._tag === "Done") {
      return
    } else if (this.state.takers.size === 0) {
      return
    }
    const taker = Iterable.unsafeHead(this.state.takers)
    this.state.takers.delete(taker)
    taker(core.exitVoid)
  }

  private unsafeTakeAll() {
    if (this.messages.length > 0) {
      return this.messages.takeAll()
    } else if (this.state._tag !== "Done" && this.state.offers.size > 0) {
      this.capacity = 1
      this.releaseCapacity()
      this.capacity = 0
      return [this.messages.take()!]
    }
    return empty
  }

  private finalize(exit: Exit<void, E>) {
    if (this.state._tag === "Done") {
      return
    }
    const openState = this.state
    this.state = { _tag: "Done", exit }
    for (const taker of openState.takers) {
      taker(exit)
    }
    openState.takers.clear()
    for (const awaiter of openState.awaiters) {
      awaiter(exit)
    }
    openState.awaiters.clear()
  }
}

/** @internal */
export const make = <A, E = never>(
  capacity?:
    | number
    | {
      readonly capacity?: number | undefined
      readonly strategy?: "suspend" | "dropping" | "sliding" | undefined
    }
    | undefined
): Effect<Api.Mailbox<A, E>> =>
  core.withFiber((fiber) =>
    core.succeed(
      new MailboxImpl<A, E>(
        fiber.getRef(CurrentScheduler),
        typeof capacity === "number"
          ? capacity
          : (capacity?.capacity ?? Number.POSITIVE_INFINITY),
        typeof capacity === "number"
          ? "suspend"
          : (capacity?.strategy ?? "suspend")
      )
    )
  )

/** @internal */
export const into: {
  <A, E>(
    self: Api.Mailbox<A, E>
  ): <AX, EX extends E, RX>(
    effect: Effect<AX, EX, RX>
  ) => Effect<boolean, never, RX>
  <AX, E, EX extends E, RX, A>(
    effect: Effect<AX, EX, RX>,
    self: Api.Mailbox<A, E>
  ): Effect<boolean, never, RX>
} = dual(
  2,
  <AX, E, EX extends E, RX, A>(
    effect: Effect<AX, EX, RX>,
    self: Api.Mailbox<A, E>
  ): Effect<boolean, never, RX> =>
    core.uninterruptibleMask((restore) =>
      core.matchCauseEffect(restore(effect), {
        onFailure: (cause) => self.failCause(cause),
        onSuccess: (_) => self.end
      })
    )
)

interface Chunk<A> {
  readonly array: Array<A>
  offset: number
  length: number
  next: Chunk<A> | undefined
}

const emptyChunk = (): Chunk<never> => ({
  array: [],
  offset: 0,
  length: 0,
  next: undefined
})

class MutableList<A> {
  private head: Chunk<A> = emptyChunk()
  private tail: Chunk<A> = this.head
  public length = 0

  append(message: A) {
    this.tail.array.push(message)
    this.tail.length++
    this.length++
  }

  appendAll(messages: Iterable<A>) {
    const array = Array.from(messages)
    this.tail.next = {
      array,
      offset: 0,
      length: array.length,
      next: undefined
    }
    this.tail = this.tail.next
    if (this.head.length === 0) {
      this.head = this.tail
    }
    this.length += array.length
    return array.length
  }

  takeN(n: number) {
    const array = new Array<A>(n)
    let index = 0
    let chunk: Chunk<A> | undefined = this.head
    while (chunk) {
      while (chunk.offset < chunk.length) {
        array[index++] = chunk.array[chunk.offset]
        chunk.array[chunk.offset++] = undefined as any
        if (index === n) {
          this.length -= n
          if (this.length === 0) this.clear()
          return array
        }
      }
      chunk = chunk.next
    }
    this.clear()
    return array
  }

  takeAll() {
    if (this.head === this.tail && this.head.offset === 0) {
      const array = this.head.array
      this.clear()
      return array
    }
    const array = new Array<A>(this.length)
    let index = 0
    let chunk: Chunk<A> | undefined = this.head
    while (chunk) {
      for (let i = chunk.offset; i < chunk.length; i++) {
        array[index++] = chunk.array[i]
      }
      chunk = chunk.next
    }
    this.clear()
    return array
  }

  take(): A | undefined {
    if (this.length === 0) {
      return undefined
    } else if (this.head.length === 0) {
      this.head = this.head.next!
    }
    const message = this.head.array[this.head.offset]
    this.head.array[this.head.offset++] = undefined as any
    this.length--
    if (this.head.offset === this.head.length) {
      if (this.head.next) {
        this.head = this.head.next
      } else {
        this.clear()
      }
    }
    return message
  }

  clear() {
    this.head = this.tail = emptyChunk()
    this.length = 0
  }
}
