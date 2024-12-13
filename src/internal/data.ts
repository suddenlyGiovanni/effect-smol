import * as Equal from "../Equal.js"
import * as Hash from "../Hash.js"
import type * as Types from "../Types.js"

/** @internal */
export const ArrayProto: Equal.Equal = Object.assign(
  Object.create(Array.prototype),
  {
    [Hash.symbol](this: Array<any>) {
      return Hash.cached(this, Hash.array(this))
    },
    [Equal.symbol](this: Array<any>, that: Equal.Equal) {
      if (Array.isArray(that) && this.length === that.length) {
        return this.every((v, i) => Equal.equals(v, (that as Array<any>)[i]))
      } else {
        return false
      }
    },
  },
)

/** @internal */
export const StructuralPrototype: Equal.Equal = {
  [Hash.symbol]() {
    return Hash.cached(this, Hash.structure(this))
  },
  [Equal.symbol](this: Equal.Equal, that: Equal.Equal) {
    const selfKeys = Object.keys(this)
    const thatKeys = Object.keys(that as object)
    if (selfKeys.length !== thatKeys.length) {
      return false
    }
    for (const key of selfKeys) {
      if (
        !(
          key in (that as object) &&
          Equal.equals((this as any)[key], (that as any)[key])
        )
      ) {
        return false
      }
    }
    return true
  },
}

/** @internal */
export const Structural: new <A>(
  args: Types.Equals<Omit<A, keyof Equal.Equal>, {}> extends true
    ? void
    : {
        readonly [P in keyof A as P extends keyof Equal.Equal ? never : P]: A[P]
      },
) => {} = (function () {
  function Structural(this: any, args: any) {
    if (args) {
      Object.assign(this, args)
    }
  }
  Structural.prototype = StructuralPrototype
  return Structural as any
})()

/** @internal */
export const struct = <As extends Readonly<Record<string, any>>>(as: As): As =>
  Object.assign(Object.create(StructuralPrototype), as)
