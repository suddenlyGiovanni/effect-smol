/**
 * @since 2.0.0
 */
import * as Equal from "../Equal.js"
import * as Hash from "../Hash.js"
import { toJSON } from "../Inspectable.js"
import type * as Option from "../Option.js"
import { hasProperty } from "../Predicate.js"
import { exitFail, exitSucceed, NoSuchElementError, PipeInspectableProto, YieldableProto } from "./core.js"

const TypeId: Option.TypeId = "~effect/Option"

const CommonProto = {
  [TypeId]: {
    _A: (_: never) => _
  },
  ...PipeInspectableProto,
  ...YieldableProto
}

const SomeProto = Object.assign(Object.create(CommonProto), {
  _tag: "Some",
  _op: "Some",
  [Equal.symbol]<A>(this: Option.Some<A>, that: unknown): boolean {
    return (
      isOption(that) && isSome(that) && Equal.equals(this.value, that.value)
    )
  },
  [Hash.symbol]<A>(this: Option.Some<A>) {
    return Hash.cached(this, () => Hash.combine(Hash.hash(this._tag))(Hash.hash(this.value)))
  },
  toJSON<A>(this: Option.Some<A>) {
    return {
      _id: "Option",
      _tag: this._tag,
      value: toJSON(this.value)
    }
  },
  asEffect(this: Option.Some<unknown>) {
    return exitSucceed(this.value)
  }
})

const NoneHash = Hash.hash("None")
const NoneProto = Object.assign(Object.create(CommonProto), {
  _tag: "None",
  _op: "None",
  [Equal.symbol]<A>(this: Option.None<A>, that: unknown): boolean {
    return isOption(that) && isNone(that)
  },
  [Hash.symbol]<A>(this: Option.None<A>) {
    return NoneHash
  },
  toJSON<A>(this: Option.None<A>) {
    return {
      _id: "Option",
      _tag: this._tag
    }
  },
  asEffect<A>(this: Option.None<A>) {
    return exitFail(new NoSuchElementError())
  }
})

/** @internal */
export const isOption = (input: unknown): input is Option.Option<unknown> => hasProperty(input, TypeId)

/** @internal */
export const isNone = <A>(fa: Option.Option<A>): fa is Option.None<A> => fa._tag === "None"

/** @internal */
export const isSome = <A>(fa: Option.Option<A>): fa is Option.Some<A> => fa._tag === "Some"

/** @internal */
export const none: Option.Option<never> = Object.create(NoneProto)

/** @internal */
export const some = <A>(value: A): Option.Option<A> => {
  const a = Object.create(SomeProto)
  a.value = value
  return a
}
