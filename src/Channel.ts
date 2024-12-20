/**
 * @since 2.0.0
 */
import type * as Cause from "./Cause.js"
import * as Chunk from "./Chunk.js"
import * as Context from "./Context.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import type { LazyArg } from "./Function.js"
import { constant, constTrue, constVoid, dual, identity } from "./Function.js"
import * as internalMailbox from "./internal/mailbox.js"
import type { Mailbox, ReadonlyMailbox } from "./Mailbox.js"
import * as Option from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import * as Scope from "./Scope.js"
import type * as Types from "./Types.js"
import type * as Unify from "./Unify.js"

/**
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/Channel")

/**
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId

/**
 * @since 3.5.4
 * @category refinements
 */
export const isChannel = (
  u: unknown
): u is Channel<unknown, unknown, unknown, unknown, unknown> => hasProperty(u, TypeId)

/**
 * A `Channel` is a nexus of I/O operations, which supports both reading and
 * writing. A channel may read values of type `InElem` and write values of type
 * `OutElem`. When the channel finishes, it yields a value of type `OutDone`. A
 * channel may fail with a value of type `OutErr`.
 *
 * Channels are the foundation of Streams: both streams and sinks are built on
 * channels. Most users shouldn't have to use channels directly, as streams and
 * sinks are much more convenient and cover all common use cases. However, when
 * adding new stream and sink operators, or doing something highly specialized,
 * it may be useful to use channels directly.
 *
 * Channels compose in a variety of ways:
 *
 *  - **Piping**: One channel can be piped to another channel, assuming the
 *    input type of the second is the same as the output type of the first.
 *  - **Sequencing**: The terminal value of one channel can be used to create
 *    another channel, and both the first channel and the function that makes
 *    the second channel can be composed into a channel.
 *  - **Concatenating**: The output of one channel can be used to create other
 *    channels, which are all concatenated together. The first channel and the
 *    function that makes the other channels can be composed into a channel.
 *
 * @since 2.0.0
 * @category models
 */
export interface Channel<
  out OutElem,
  out OutErr = never,
  in InElem = unknown,
  in InErr = unknown,
  out Env = never
> extends Channel.Variance<OutElem, OutErr, InElem, InErr, Env>, Pipeable {
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: ChannelUnify<this>
  [Unify.ignoreSymbol]?: ChannelUnifyIgnore
}

/**
 * @since 2.0.0
 * @category models
 */
export interface ChannelUnify<A extends { [Unify.typeSymbol]?: any }> extends Effect.EffectUnify<A> {
  Channel?: () => A[Unify.typeSymbol] extends
    | Channel<infer OutElem, infer OutErr, infer InElem, infer InErr, infer Env>
    | infer _ ? Channel<OutElem, OutErr, InElem, InErr, Env>
    : never
}

/**
 * @category models
 * @since 2.0.0
 */
export interface ChannelUnifyIgnore extends Effect.EffectUnifyIgnore {
  Channel?: true
}

/**
 * @since 2.0.0
 */
export declare namespace Channel {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<
    out OutElem,
    out OutErr,
    in InElem,
    in InErr,
    out Env
  > {
    readonly [TypeId]: VarianceStruct<OutElem, OutErr, InElem, InErr, Env>
  }
  /**
   * @since 2.0.0
   * @category models
   */
  export interface VarianceStruct<
    out OutElem,
    out OutErr,
    in InElem,
    in InErr,
    out Env
  > {
    _Env: Types.Covariant<Env>
    _InErr: Types.Contravariant<InErr>
    _InElem: Types.Contravariant<InElem>
    _OutErr: Types.Covariant<OutErr>
    _OutElem: Types.Covariant<OutElem>
  }
}

// -----------------------------------------------------------------------------
// Halt
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 * @category Halt
 */
export const Halt: unique symbol = Symbol.for("effect/Channel/Halt")

/**
 * @since 4.0.0
 * @category Halt
 */
export type Halt = typeof Halt

function catchHalt<A, R, E, A2, E2, R2>(
  effect: Effect.Effect<A, E, R>,
  f: (halt: Halt) => Effect.Effect<A2, E2, R2>
) {
  return Effect.catchFailure(effect, isHaltFailure, (failure) => f(failure.defect))
}

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHalt = (u: unknown): u is Halt => u === Halt

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHaltCause = <E>(cause: Cause.Cause<E>): boolean => cause.failures.some(isHaltFailure)

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHaltFailure = <E>(
  failure: Cause.Failure<E>
): failure is Cause.Die & { readonly defect: Halt } => failure._tag === "Die" && failure.defect === Halt

/**
 * @since 4.0.0
 * @category Halt
 */
export const halt: Effect.Effect<never> = Effect.die(Halt)

const ChannelProto = {
  [TypeId]: {
    _Env: identity,
    _InErr: identity,
    _InElem: identity,
    _OutErr: identity,
    _OutElem: identity
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

// -----------------------------------------------------------------------------
// Constructors
// -----------------------------------------------------------------------------

const makeImpl = <OutElem, OutErr, InElem, InErr, EX, EnvX, Env>(
  transform: (
    upstream: Effect.Effect<InElem, InErr>,
    scope: Scope.Scope
  ) => Effect.Effect<Effect.Effect<OutElem, OutErr, EnvX>, EX, Env>
): Channel<OutElem, OutErr | EX, InElem, InErr, Env | EnvX> => {
  const self = Object.create(ChannelProto)
  self.transform = transform
  return self
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromPullUnsafe = <OutElem, OutErr, EX, EnvX, Env>(
  effect: Effect.Effect<Effect.Effect<OutElem, OutErr, EnvX>, EX, Env>
): Channel<OutElem, OutErr | EX, unknown, unknown, Env | EnvX> => makeImpl((_, __) => effect)

const makeImplScoped = <OutElem, OutErr, InElem, InErr, EX, EnvX, Env>(
  f: (
    upstream: Effect.Effect<InElem, InErr>,
    scope: Scope.Scope,
    forkedScope: Scope.Scope
  ) => Effect.Effect<Effect.Effect<OutElem, OutErr, EnvX>, EX, Env>
): Channel<OutElem, OutErr | EX, InElem, InErr, Env | EnvX> =>
  makeImpl(
    Effect.fnUntraced(function*(upstream, scope) {
      const closableScope = yield* scope.fork
      const onCause = (cause: Cause.Cause<EX | OutErr>) =>
        closableScope.close(
          isHaltCause(cause) ? Exit.void : Exit.failCause(cause)
        )
      const pull = yield* Effect.onError(
        f(upstream, scope, closableScope),
        onCause
      )
      return Effect.onError(pull, onCause)
    })
  )

const toTransform = <OutElem, OutErr, InElem, InErr, Env>(
  channel: Channel<OutElem, OutErr, InElem, InErr, Env>
): (
  upstream: Effect.Effect<InElem, InErr>,
  scope: Scope.Scope
) => Effect.Effect<Effect.Effect<OutElem, OutErr>, never, Env> => (channel as any).transform

/**
 * @since 2.0.0
 * @category models
 */
export const DefaultChunkSize: number = 4096

/**
 * @since 2.0.0
 * @category models
 */
export interface Emit<in A, in E> {
  /**
   * Terminates with a cause that dies with the specified defect.
   */
  die<Err>(defect: Err): void

  /**
   * Either emits the specified value if this `Exit` is a `Success` or else
   * terminates with the specified cause if this `Exit` is a `Failure`.
   */
  done(exit: Exit.Exit<A, E>): void

  /**
   * Terminates with an end of stream signal.
   */
  end(): void

  /**
   * Terminates with the specified error.
   */
  fail(error: E): void

  /**
   * Terminates the channel with the specified cause.
   */
  failCause(cause: Cause.Cause<E>): void

  /**
   * Emits a value
   */
  single(value: A): boolean
}

const emitFromMailbox = <A, E>(mailbox: Mailbox<A, E>): Emit<A, E> => ({
  die: (defect) => mailbox.unsafeDone(Exit.die(defect)),
  done: (exit) => mailbox.unsafeDone(Exit.asVoid(exit)),
  end: () => mailbox.unsafeDone(Exit.void),
  fail: (error) => mailbox.unsafeDone(Exit.fail(error)),
  failCause: (cause) => mailbox.unsafeDone(Exit.failCause(cause)),
  single: (value) => mailbox.unsafeOffer(value)
})

const mailboxToPull = <A, E>(mailbox: ReadonlyMailbox<A, E>) =>
  Effect.catch(
    mailbox.take,
    Option.match({
      onNone: () => halt,
      onSome: Effect.fail
    })
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const asyncPush = <A, E = never, R = never>(
  f: (emit: Emit<A, E>) => Effect.Effect<unknown, E, R | Scope.Scope>,
  options?: {
    readonly bufferSize?: number | undefined
    readonly strategy?: "sliding" | "dropping" | undefined
  }
): Channel<A, E, unknown, unknown, Exclude<R, Scope.Scope>> =>
  makeImplScoped(
    Effect.fnUntraced(function*(_, __, scope) {
      const mailbox = yield* internalMailbox.make<A, E>({
        capacity: options?.bufferSize,
        strategy: options?.strategy
      })
      yield* scope.addFinalizer(() => mailbox.shutdown)
      const emit = emitFromMailbox(mailbox)
      yield* Effect.forkIn(Scope.provideScope(f(emit), scope), scope)
      return mailboxToPull(mailbox)
    })
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const suspend = <OutElem, InElem, OutErr, InErr, Env>(
  evaluate: LazyArg<Channel<OutElem, OutErr, InElem, InErr, Env>>
): Channel<OutElem, OutErr, InElem, InErr, Env> =>
  makeImpl((upstream, scope) => Effect.suspend(() => toTransform(evaluate())(upstream, scope)))

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromPull = <A, E, R>(
  effect: Effect.Effect<A, Option.Option<E>, R>
): Channel<A, E, unknown, unknown, R> =>
  fromPullUnsafe(
    Effect.succeed(
      Effect.catch(
        effect,
        Option.match({
          onNone: () => halt,
          onSome: Effect.fail
        })
      )
    )
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const acquireUseRelease = <A, E, R, OutElem, InElem, OutErr, InErr, Env>(
  acquire: Effect.Effect<A, E, R>,
  use: (a: A) => Channel<OutElem, OutErr, InElem, InErr, Env>,
  release: (a: A, exit: Exit.Exit<void, OutErr>) => Effect.Effect<void>
): Channel<OutElem, OutErr | E, InElem, InErr, Env | R> =>
  makeImplScoped(
    Effect.fnUntraced(function*(upstream, scope, forkedScope) {
      let option = Option.none<A>()
      yield* forkedScope.addFinalizer((exit) =>
        Option.isSome(option)
          ? release(option.value, exit as any)
          : Effect.void
      )
      const value = yield* acquire
      option = Option.some(value)
      return yield* toTransform(use(value))(upstream, scope)
    })
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterator = <A>(iterator: LazyArg<Iterator<A>>): Channel<A> =>
  fromPullUnsafe(
    Effect.sync(() => {
      const iter = iterator()
      return Effect.suspend(() => {
        const state = iter.next()
        return state.done ? halt : Effect.succeed(state.value)
      })
    })
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIteratorChunk = <A>(
  iterator: LazyArg<Iterator<A>>,
  chunkSize = DefaultChunkSize
): Channel<Chunk.Chunk<A>> =>
  fromPullUnsafe(
    Effect.sync(() => {
      const iter = iterator()
      let done = false
      return Effect.suspend(() => {
        if (done) return halt
        const buffer: Array<A> = []
        while (buffer.length < chunkSize) {
          const state = iter.next()
          if (state.done) {
            if (buffer.length === 0) {
              return halt
            }
            done = true
            break
          }
          buffer.push(state.value)
        }
        return Effect.succeed(Chunk.unsafeFromArray(buffer))
      })
    })
  )

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterable = <A>(iterable: Iterable<A>): Channel<A> => fromIterator(() => iterable[Symbol.iterator]())

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromIterableChunk = <A>(
  iterable: Iterable<A>
): Channel<Chunk.Chunk<A>> => fromIteratorChunk(() => iterable[Symbol.iterator]())

/**
 * Writes a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeed = <A>(value: A): Channel<A> =>
  fromPullUnsafe(
    Effect.sync(() => {
      let done = false
      return Effect.suspend(() => {
        if (done) {
          return halt
        } else {
          done = true
          return Effect.succeed(value)
        }
      })
    })
  )

/**
 * Represents an Channel that emits no elements
 *
 * @since 2.0.0
 * @category constructors
 */
export const empty: Channel<never> = fromPullUnsafe(Effect.succeed(halt))

/**
 * Represents an Channel that never completes
 *
 * @since 2.0.0
 * @category constructors
 */
export const never: Channel<never> = fromPullUnsafe(
  Effect.succeed(Effect.never)
)

/**
 * Use an effect to write a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Channel<A, E, unknown, unknown, R> =>
  fromPullUnsafe(
    Effect.sync(() => {
      let done = false
      return Effect.suspend(() => {
        if (done) return halt
        done = true
        return effect
      })
    })
  )

/**
 * Create a channel from a ReadonlyMailbox
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromMailbox = <A, E>(
  mailbox: ReadonlyMailbox<A, E>
): Channel<A, E> => fromPullUnsafe(Effect.sync(() => mailboxToPull(mailbox)))

/**
 * Create a channel from a ReadonlyMailbox
 *
 * @since 4.0.0
 * @category constructors
 */
export const fromMailboxChunk = <A, E>(
  mailbox: ReadonlyMailbox<A, E>
): Channel<Chunk.Chunk<A>, E> =>
  fromPullUnsafe(
    Effect.succeed(
      Effect.flatMap(mailbox.takeAll, ([values]) => values.length === 0 ? halt : Effect.succeed(values))
    )
  )

/**
 * Maps the output of this channel using the specified function.
 *
 * @since 2.0.0
 * @category mapping
 */
export const map: {
  <OutElem, OutElem2>(
    f: (o: OutElem) => OutElem2
  ): <OutErr, InElem, InErr, Env>(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>
  ) => Channel<OutElem2, OutErr, InElem, InErr, Env>
  <OutElem, OutErr, InElem, InErr, Env, OutElem2>(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>,
    f: (o: OutElem) => OutElem2
  ): Channel<OutElem2, OutErr, InElem, InErr, Env>
} = dual(
  2,
  <OutElem, OutErr, InElem, InErr, Env, OutElem2>(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>,
    f: (o: OutElem) => OutElem2
  ): Channel<OutElem2, OutErr, InElem, InErr, Env> =>
    makeImpl((upstream, scope) => Effect.map(toTransform(self)(upstream, scope), Effect.map(f)))
)

const concurrencyIsSequential = (
  concurrency: number | "unbounded" | undefined
) => concurrency === undefined || (concurrency !== "unbounded" && concurrency <= 1)

/**
 * Returns a new channel, which sequentially combines this channel, together
 * with the provided factory function, which creates a second channel based on
 * the output values of this channel. The result is a channel that will first
 * perform the functions of this channel, before performing the functions of
 * the created channel (including yielding its terminal value).
 *
 * @since 2.0.0
 * @category sequencing
 */
export const mapEffect: {
  <OutElem, OutElem1, OutErr1, Env1>(
    f: (d: OutElem) => Effect.Effect<OutElem1, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded"
      readonly bufferSize?: number
    }
  ): <OutErr, InElem, InErr, Env>(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>
  ) => Channel<OutElem1, OutErr1 | OutErr, InElem, InErr, Env1 | Env>
  <OutElem, OutErr, InElem, InErr, Env, OutElem1, OutErr1, Env1>(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>,
    f: (d: OutElem) => Effect.Effect<OutElem1, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded"
      readonly bufferSize?: number
    }
  ): Channel<OutElem1, OutErr | OutErr1, InElem, InErr, Env | Env1>
} = dual(
  (args) => isChannel(args[0]),
  <OutElem, OutErr, InElem, InErr, Env, OutElem1, OutErr1, Env1>(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>,
    f: (d: OutElem) => Effect.Effect<OutElem1, OutErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded"
      readonly bufferSize?: number
    }
  ): Channel<OutElem1, OutErr | OutErr1, InElem, InErr, Env | Env1> =>
    concurrencyIsSequential(options?.concurrency)
      ? mapEffectSequential(self, f)
      : mapEffectConcurrent(self, f, options as any)
)

const mapEffectSequential = <
  OutElem,
  OutErr,
  InElem,
  InErr,
  Env,
  OutElem2,
  EX,
  RX
>(
  self: Channel<OutElem, OutErr, InElem, InErr, Env>,
  f: (o: OutElem) => Effect.Effect<OutElem2, EX, RX>
): Channel<OutElem2, OutErr | EX, InElem, InErr, Env | RX> =>
  makeImpl((upstream, scope) => Effect.map(toTransform(self)(upstream, scope), Effect.flatMap(f)))

const mapEffectConcurrent = <
  OutElem,
  InElem,
  OutErr,
  InErr,
  Env,
  OutElem2,
  EX,
  RX
>(
  self: Channel<OutElem, OutErr, InElem, InErr, Env>,
  f: (o: OutElem) => Effect.Effect<OutElem2, EX, RX>,
  options: {
    readonly concurrency: number | "unbounded"
    readonly bufferSize?: number | undefined
  }
): Channel<OutElem2, OutErr | EX, InElem, InErr, Env | RX> =>
  makeImplScoped(
    Effect.fnUntraced(function*(upstream, scope, forkedScope) {
      const pull = yield* toTransform(self)(upstream, scope)
      const concurrencyN = options.concurrency === "unbounded"
        ? Number.MAX_SAFE_INTEGER
        : options.concurrency
      const semaphore = Effect.unsafeMakeSemaphore(concurrencyN)
      const mailbox = yield* internalMailbox.make<OutElem2, OutErr | EX>(
        options.bufferSize ?? 16
      )
      yield* forkedScope.addFinalizer(() => mailbox.shutdown)

      yield* Effect.gen(function*() {
        while (true) {
          yield* semaphore.take(1)
          const value = yield* pull
          yield* f(value).pipe(
            Effect.flatMap((value) => mailbox.offer(value)),
            Effect.ensuring(semaphore.release(1)),
            Effect.fork
          )
        }
      }).pipe(
        Effect.onError((cause) => semaphore.withPermits(concurrencyN - 1)(mailbox.failCause(cause))),
        Effect.forkIn(forkedScope)
      )

      return mailboxToPull(mailbox)
    })
  )

/**
 * Returns a new channel, which sequentially combines this channel, together
 * with the provided factory function, which creates a second channel based on
 * the output values of this channel. The result is a channel that will first
 * perform the functions of this channel, before performing the functions of
 * the created channel (including yielding its terminal value).
 *
 * @since 2.0.0
 * @category sequencing
 */
export const flatMap: {
  <OutElem, OutElem1, OutErr1, InElem1, InErr1, Env1>(
    f: (d: OutElem) => Channel<OutElem1, OutErr1, InElem1, InErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded"
      readonly bufferSize?: number
    }
  ): <OutElem, InElem, OutErr, InErr, Env>(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>
  ) => Channel<
    OutElem1,
    OutErr1 | OutErr,
    InElem & InElem1,
    InErr & InErr1,
    Env1 | Env
  >
  <
    OutElem,
    OutErr,
    InElem,
    InErr,
    Env,
    OutElem1,
    OutErr1,
    InElem1,
    InErr1,
    Env1
  >(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>,
    f: (d: OutElem) => Channel<OutElem1, OutErr1, InElem1, InErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded"
      readonly bufferSize?: number
    }
  ): Channel<
    OutElem1,
    OutErr | OutErr1,
    InElem & InElem1,
    InErr & InErr1,
    Env | Env1
  >
} = dual(
  (args) => isChannel(args[0]),
  <
    OutElem,
    OutErr,
    InElem,
    InErr,
    Env,
    OutElem1,
    OutErr1,
    InElem1,
    InErr1,
    Env1
  >(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>,
    f: (d: OutElem) => Channel<OutElem1, OutErr1, InElem1, InErr1, Env1>,
    options?: {
      readonly concurrency?: number | "unbounded"
      readonly bufferSize?: number
    }
  ): Channel<
    OutElem1,
    OutErr | OutErr1,
    InElem & InElem1,
    InErr & InErr1,
    Env | Env1
  > =>
    concurrencyIsSequential(options?.concurrency)
      ? flatMapSequential(self, f)
      : flatMapConcurrent(self, f, options as any)
)

const flatMapSequential = <
  OutElem,
  OutErr,
  InElem,
  InErr,
  Env,
  OutElem1,
  OutErr1,
  InElem1,
  InErr1,
  Env1
>(
  self: Channel<OutElem, OutErr, InElem, InErr, Env>,
  f: (d: OutElem) => Channel<OutElem1, OutErr1, InElem1, InErr1, Env1>
): Channel<
  OutElem1,
  OutErr | OutErr1,
  InElem & InElem1,
  InErr & InErr1,
  Env | Env1
> =>
  makeImpl((upstream, scope) =>
    Effect.map(toTransform(self)(upstream, scope), (pull) => {
      let childPull: Effect.Effect<OutElem1, OutErr1, Env1> | null = null
      const makePull: Effect.Effect<OutElem1, OutErr | OutErr1, Env1> = pull.pipe(
        Effect.flatMap((value) => toTransform(f(value))(upstream, scope)),
        Effect.flatMap((pull) => {
          childPull = catchHalt(pull, (_) => {
            childPull = null
            return makePull
          }) as any
          return childPull!
        })
      )
      return Effect.suspend(() => childPull ?? makePull)
    })
  )

const flatMapConcurrent = <
  OutElem,
  OutErr,
  InElem,
  InErr,
  Env,
  OutElem1,
  OutErr1,
  InElem1,
  InErr1,
  Env1
>(
  self: Channel<OutElem, OutErr, InElem, InErr, Env>,
  f: (d: OutElem) => Channel<OutElem1, OutErr1, InElem1, InErr1, Env1>,
  options: {
    readonly concurrency: number | "unbounded"
    readonly bufferSize?: number | undefined
  }
): Channel<
  OutElem1,
  OutErr | OutErr1,
  InElem & InElem1,
  InErr & InErr1,
  Env | Env1
> => self.pipe(map(f), mergeAll(options))

/**
 * @since 2.0.0
 * @category utils
 */
export const mergeAll: {
  (options: {
    readonly concurrency: number | "unbounded"
    readonly bufferSize?: number | undefined
  }): <OutElem, OutErr1, InElem1, InErr1, Env1, OutErr, InElem, InErr, Env>(
    channels: Channel<
      Channel<OutElem, OutErr1, InElem1, InErr1, Env1>,
      OutErr,
      InElem,
      InErr,
      Env
    >
  ) => Channel<
    OutElem,
    OutErr1 | OutErr,
    InElem & InElem1,
    InErr & InErr1,
    Env1 | Env
  >
  <OutElem, OutErr1, InElem1, InErr1, Env1, OutErr, InElem, InErr, Env>(
    channels: Channel<
      Channel<OutElem, OutErr1, InElem1, InErr1, Env1>,
      OutErr,
      InElem,
      InErr,
      Env
    >,
    options: {
      readonly concurrency: number | "unbounded"
      readonly bufferSize?: number | undefined
    }
  ): Channel<
    OutElem,
    OutErr1 | OutErr,
    InElem & InElem1,
    InErr & InErr1,
    Env1 | Env
  >
} = dual(
  2,
  <OutElem, OutErr1, InElem1, InErr1, Env1, OutErr, InElem, InErr, Env>(
    channels: Channel<
      Channel<OutElem, OutErr1, InElem1, InErr1, Env1>,
      OutErr,
      InElem,
      InErr,
      Env
    >,
    {
      bufferSize = 16,
      concurrency
    }: {
      readonly concurrency: number | "unbounded"
      readonly bufferSize?: number | undefined
    }
  ): Channel<
    OutElem,
    OutErr1 | OutErr,
    InElem & InElem1,
    InErr & InErr1,
    Env1 | Env
  > =>
    makeImplScoped(
      Effect.fnUntraced(function*(upstream, scope, forkedScope) {
        const concurrencyN = concurrency === "unbounded"
          ? Number.MAX_SAFE_INTEGER
          : Math.max(1, concurrency)
        const semaphore = Effect.unsafeMakeSemaphore(concurrencyN)

        const mailbox = yield* internalMailbox.make<OutElem, OutErr | OutErr1>(
          bufferSize
        )
        yield* forkedScope.addFinalizer(() => mailbox.shutdown)

        const pull = yield* toTransform(channels)(upstream, scope)

        yield* Effect.gen(function*() {
          while (true) {
            yield* semaphore.take(1)
            const channel = yield* pull
            const childPull = yield* toTransform(channel)(upstream, scope)
            yield* Effect.whileLoop({
              while: constTrue,
              body: constant(
                Effect.flatMap(childPull, (value) => mailbox.offer(value))
              ),
              step: constVoid
            }).pipe(
              Effect.onExit(
                (exit): Effect.Effect<void> =>
                  exit._tag === "Failure" && !isHaltCause(exit.cause)
                    ? Effect.andThen(
                      semaphore.release(1),
                      mailbox.failCause(exit.cause as Cause.Cause<OutErr1>)
                    )
                    : semaphore.release(1)
              ),
              Effect.fork
            )
          }
        }).pipe(
          Effect.onError((cause) => semaphore.withPermits(concurrencyN - 1)(mailbox.failCause(cause))),
          Effect.forkIn(forkedScope)
        )

        return mailboxToPull(mailbox)
      })
    )
)

/**
 * Returns a new channel that pipes the output of this channel into the
 * specified channel. The returned channel has the input type of this channel,
 * and the output type of the specified channel, terminating with the value of
 * the specified channel.
 *
 * @since 2.0.0
 * @category utils
 */
export const pipeTo: {
  <OutElem2, OutErr2, OutElem, OutErr, Env2>(
    that: Channel<OutElem2, OutErr2, OutElem, OutErr, Env2>
  ): <InElem, InErr, Env>(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>
  ) => Channel<OutElem2, OutErr2, InElem, InErr, Env2 | Env>
  <OutElem, OutErr, InElem, InErr, Env, OutElem2, OutErr2, Env2>(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>,
    that: Channel<OutElem2, OutErr2, OutElem, OutErr, Env2>
  ): Channel<OutElem2, OutErr2, InElem, InErr, Env | Env2>
} = dual(
  2,
  <OutElem, OutErr, InElem, InErr, Env, OutElem2, OutErr2, Env2>(
    self: Channel<OutElem, OutErr, InElem, InErr, Env>,
    that: Channel<OutElem2, OutErr2, OutElem, OutErr, Env2>
  ): Channel<OutElem2, OutErr2, InElem, InErr, Env | Env2> =>
    makeImpl((upstream, scope) =>
      Effect.flatMap(toTransform(self)(upstream, scope), (upstream) => toTransform(that)(upstream, scope))
    )
)

/**
 * Returns a new channel which embeds the given input handler into a Channel.
 *
 * @since 2.0.0
 * @category utils
 */
export const embedInput: {
  <InElem, InErr, R>(
    input: (
      upstream: Effect.Effect<InElem, InErr>
    ) => Effect.Effect<void, never, R>
  ): <OutElem, OutErr, Env>(
    self: Channel<OutElem, OutErr, unknown, unknown, Env>
  ) => Channel<OutElem, OutErr, InElem, InErr, Env | R>
  <OutElem, OutErr, Env, InErr, InElem, R>(
    self: Channel<OutElem, OutErr, unknown, unknown, Env>,
    input: (
      upstream: Effect.Effect<InElem, InErr>
    ) => Effect.Effect<void, never, R>
  ): Channel<OutElem, OutErr, InElem, InErr, Env | R>
} = dual(
  2,
  <OutElem, OutErr, Env, InErr, InElem, R>(
    self: Channel<OutElem, OutErr, unknown, unknown, Env>,
    input: (
      upstream: Effect.Effect<InElem, InErr>
    ) => Effect.Effect<void, never, R>
  ): Channel<OutElem, OutErr, InElem, InErr, Env | R> =>
    makeImplScoped(
      Effect.fnUntraced(function*(upstream, scope, forkedScope) {
        yield* Effect.forkIn(input(upstream), forkedScope)
        return yield* toTransform(self)(halt, scope)
      })
    )
)

const runWith = <
  OutElem,
  OutErr,
  InErr,
  Env,
  EX,
  RX,
  AH = void,
  EH = never,
  RH = never
>(
  self: Channel<OutElem, OutErr, unknown, InErr, Env>,
  f: (pull: Effect.Effect<OutElem, OutErr>) => Effect.Effect<void, EX, RX>,
  onHalt?: Effect.Effect<AH, EH, RH>
): Effect.Effect<AH, EX | EH, Env | RX | RH> =>
  Effect.suspend(() => {
    const scope = Scope.unsafeMake()
    const makePull = toTransform(self)(halt, scope)
    return catchHalt(Effect.flatMap(makePull, f), (_) => onHalt ? onHalt : (Effect.void as any)).pipe(
      Effect.onExit((exit) => scope.close(exit))
    ) as any
  })

/**
 * @since 2.0.0
 * @category execution
 */
export const runDrain = <OutElem, OutErr, InErr, Env>(
  self: Channel<OutElem, OutErr, unknown, InErr, Env>
): Effect.Effect<void, OutErr, Env> =>
  runWith(self, (pull) =>
    Effect.whileLoop({
      while: constTrue,
      body: () => pull,
      step: constVoid
    }))

/**
 * @since 2.0.0
 * @category execution
 */
export const runForEach: {
  <OutElem, EX, RX>(
    f: (o: OutElem) => Effect.Effect<void, EX, RX>
  ): <OutErr, InErr, Env>(
    self: Channel<OutElem, OutErr, unknown, InErr, Env>
  ) => Effect.Effect<void, OutErr | EX, Env | RX>
  <OutElem, OutErr, InErr, Env, EX, RX>(
    self: Channel<OutElem, OutErr, unknown, InErr, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>
  ): Effect.Effect<void, OutErr | EX, Env | RX>
} = dual(
  2,
  <OutElem, OutErr, InErr, Env, EX, RX>(
    self: Channel<OutElem, OutErr, unknown, InErr, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>
  ): Effect.Effect<void, OutErr | EX, Env | RX> =>
    runWith(self, (pull) => {
      const pump = Effect.flatMap(pull, f)
      return Effect.whileLoop({
        while: constTrue,
        body: () => pump,
        step: constVoid
      })
    })
)

/**
 * @since 2.0.0
 * @category execution
 */
export const runCollect = <OutElem, OutErr, InErr, Env>(
  self: Channel<OutElem, OutErr, unknown, InErr, Env>
): Effect.Effect<Array<OutElem>, OutErr, Env> =>
  Effect.suspend(() => {
    const result: Array<OutElem> = []
    return runWith(
      self,
      (pull) =>
        Effect.whileLoop({
          while: constTrue,
          body: () => pull,
          step: (value) => {
            result.push(value)
          }
        }),
      Effect.succeed(result)
    )
  })

/**
 * @since 2.0.0
 * @category constructors
 */
export const toPull: <OutElem, OutErr, InErr, Env>(
  self: Channel<OutElem, OutErr, unknown, InErr, Env>
) => Effect.Effect<
  Effect.Effect<OutElem, Option.Option<OutErr>>,
  never,
  Env | Scope.Scope
> = Effect.fnUntraced(
  function*(self) {
    const semaphore = Effect.unsafeMakeSemaphore(1)
    const context = yield* Effect.context<Scope.Scope>()
    const scope = Context.get(context, Scope.Scope)
    const pull = yield* toTransform(self)(halt, scope)
    return pull.pipe(
      Effect.provideContext(context),
      Effect.mapError(Option.some),
      Effect.catchFailure(isHaltFailure, (_) => Effect.fail(Option.none())),
      semaphore.withPermits(1)
    )
  },
  // ensure errors are redirected to the pull effect
  Effect.catchCause((cause) => Effect.succeed(Effect.failCause(cause)))
)

/**
 * @since 4.0.0
 * @category conversions
 */
export const toMailbox: {
  (options?: {
    readonly bufferSize?: number | undefined
  }): <OutElem, OutErr, InErr, Env>(
    self: Channel<OutElem, OutErr, unknown, InErr, Env>
  ) => Effect.Effect<ReadonlyMailbox<OutElem, OutErr>, never, Env | Scope.Scope>
  <OutElem, OutErr, InErr, Env>(
    self: Channel<OutElem, OutErr, unknown, InErr, Env>,
    options?: {
      readonly bufferSize?: number | undefined
    }
  ): Effect.Effect<ReadonlyMailbox<OutElem, OutErr>, never, Env | Scope.Scope>
} = dual(
  (args) => isChannel(args[0]),
  Effect.fnUntraced(function*<OutElem, OutErr, InErr, Env>(
    self: Channel<OutElem, OutErr, unknown, InErr, Env>,
    options?: {
      readonly bufferSize?: number | undefined
    }
  ) {
    const scope = yield* Effect.scope
    const mailbox = yield* internalMailbox.make<OutElem, OutErr>(
      options?.bufferSize
    )
    yield* scope.addFinalizer(() => mailbox.shutdown)
    yield* Effect.forkIn(
      Effect.onExit(
        runForEach(self, (value) => mailbox.offer(value)),
        (exit) => mailbox.done(exit)
      ),
      scope
    )
    return mailbox
  })
)
