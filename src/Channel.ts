/**
 * @since 2.0.0
 */
import * as Predicate from "./Predicate.js"
import { Pipeable } from "./Pipeable.js"
import * as Unify from "./Unify.js"
import * as Effect from "./Effect.js"
import * as Types from "./Types.js"
import { constant, dual, identity } from "./Function.js"
import * as Cause from "./Cause.js"

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
// export interface Channel<out Env, in InErr, in InElem, in InDone, out OutErr, out OutElem, out OutDone>
export interface Channel<
  out OutElem,
  in InElem = unknown,
  out OutErr = never,
  in InErr = unknown,
  out OutDone = void,
  in InDone = unknown,
  out Env = never,
> extends Channel.Variance<
      OutElem,
      InElem,
      OutErr,
      InErr,
      OutDone,
      InDone,
      Env
    >,
    Pipeable {
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: ChannelUnify<this>
  [Unify.ignoreSymbol]?: ChannelUnifyIgnore
}

/**
 * @since 2.0.0
 * @category models
 */
export interface ChannelUnify<A extends { [Unify.typeSymbol]?: any }>
  extends Effect.EffectUnify<A> {
  Channel?: () => A[Unify.typeSymbol] extends
    | Channel<
        infer OutElem,
        infer InElem,
        infer OutErr,
        infer InErr,
        infer OutDone,
        infer InDone,
        infer Env
      >
    | infer _
    ? Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>
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
    in InElem,
    out OutErr,
    in InErr,
    out OutDone,
    in InDone,
    out Env,
  > {
    readonly [TypeId]: VarianceStruct<
      OutElem,
      InElem,
      OutErr,
      InErr,
      OutDone,
      InDone,
      Env
    >
  }
  /**
   * @since 2.0.0
   * @category models
   */
  export interface VarianceStruct<
    out OutElem,
    in InElem,
    out OutErr,
    in InErr,
    out OutDone,
    in InDone,
    out Env,
  > {
    _Env: Types.Covariant<Env>
    _InErr: Types.Contravariant<InErr>
    _InElem: Types.Contravariant<InElem>
    _InDone: Types.Contravariant<InDone>
    _OutErr: Types.Covariant<OutErr>
    _OutElem: Types.Covariant<OutElem>
    _OutDone: Types.Covariant<OutDone>
  }
}

interface ChannelImpl<
  out OutElem,
  in InElem = unknown,
  out OutErr = never,
  in InErr = unknown,
  out OutDone = void,
  in InDone = unknown,
  out Env = never,
> extends Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env> {
  readonly transform: (
    upstream: Effect.Effect<InElem, InErr>,
  ) => Effect.Effect<Effect.Effect<OutElem, OutErr>, never, Env>
}

const ChannelProto = {
  [TypeId]: {
    _Env: identity,
    _InErr: identity,
    _InElem: identity,
    _InDone: identity,
    _OutErr: identity,
    _OutElem: identity,
    _OutDone: identity,
  },
}

const makeImpl = <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>(
  transform: ChannelImpl<
    OutElem,
    InElem,
    OutErr,
    InErr,
    OutDone,
    InDone,
    Env
  >["transform"],
): Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env> => {
  const self = Object.create(ChannelProto)
  self.transform = transform
  return self
}

const toTransform = <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>(
  channel: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
): ((
  upstream: Effect.Effect<InElem, InErr>,
) => Effect.Effect<Effect.Effect<OutElem, OutErr>, never, Env>) => {
  return (channel as any).transform
}

/**
 * Writes a single value to the channel.
 *
 * @since 2.0.0
 * @category constructors
 */
export const succeed = <A>(value: A): Channel<A> =>
  makeImpl(
    constant(
      Effect.sync(() => {
        let done = false
        return Effect.suspend(() => {
          if (done) {
            return Effect.die(Halt.void)
          } else {
            done = true
            return Effect.succeed(value)
          }
        })
      }),
    ),
  )

/**
 * Maps the output of this channel using the specified function.
 *
 * @since 2.0.0
 * @category mapping
 */
export const map: {
  <OutElem, OutElem2>(
    f: (o: OutElem) => OutElem2,
  ): <InElem, OutErr, InErr, OutDone, InDone, Env>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
  ) => Channel<OutElem2, InElem, OutErr, InErr, OutDone, InDone, Env>
  <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env, OutElem2>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    f: (o: OutElem) => OutElem2,
  ): Channel<OutElem2, InElem, OutErr, InErr, OutDone, InDone, Env>
} = dual(
  2,
  <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env, OutElem2>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    f: (o: OutElem) => OutElem2,
  ): Channel<OutElem2, InElem, OutErr, InErr, OutDone, InDone, Env> =>
    makeImpl((upstream) =>
      Effect.map(toTransform(self)(upstream), Effect.map(f)),
    ),
)

/**
 * @since 2.0.0
 * @category execution
 */
export const runForEach: {
  <OutElem, EX, RX>(
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): <InElem, OutErr, InErr, OutDone, InDone, Env>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
  ) => Effect.Effect<void, OutErr | EX, Env | RX>
  <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env, EX, RX>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): Effect.Effect<void, OutErr | EX, Env | RX>
} = dual(
  2,
  <OutElem, InElem, OutErr, InErr, OutDone, InDone, Env, EX, RX>(
    self: Channel<OutElem, InElem, OutErr, InErr, OutDone, InDone, Env>,
    f: (o: OutElem) => Effect.Effect<void, EX, RX>,
  ): Effect.Effect<void, OutErr | EX, Env | RX> =>
    Effect.gen(function* () {
      const effect = yield* toTransform(self)(Halt.voidEffect)
      while (true) {
        yield* f(yield* effect)
      }
    }).pipe(Halt.catch((_) => Effect.void)),
)

// -----------------------------------------------------------------------------
// Halt
// -----------------------------------------------------------------------------

const HaltTypeId: unique symbol = Symbol.for("effect/Channel/Halt")
type HaltTypeId = typeof HaltTypeId

class Halt<out Leftover = unknown> {
  readonly [HaltTypeId]: HaltTypeId = HaltTypeId
  constructor(readonly leftover: Leftover) {}

  static readonly void: Halt<void> = new Halt(void 0)
  static readonly voidEffect: Effect.Effect<never> = Effect.die(Halt.void)

  static catch<L, A2, E2, R2>(f: (halt: Halt<L>) => Effect.Effect<A2, E2, R2>) {
    return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.catchFailure(effect, failureIsHalt, (failure) =>
        f(failure.defect as any),
      )
  }
}

const isHalt = (u: unknown): u is Halt => Predicate.hasProperty(u, HaltTypeId)

const failureIsHalt = <E>(failure: Cause.Failure<E>): failure is Cause.Die =>
  failure._tag === "Die" && isHalt(failure.defect)

// -----------------------------------------------------------------------------

Effect.gen(function* () {
  const channel = succeed(1)
  yield* runForEach(channel, console.log)
}).pipe(Effect.runFork)
