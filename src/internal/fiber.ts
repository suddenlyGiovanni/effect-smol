import * as Context from "../Context.js"
import { constVoid, identity } from "../Function.js"
import { globalValue } from "../GlobalValue.js"
import * as InternalContext from "../internal/context.js"
import { hasProperty } from "../Predicate.js"
import type { Covariant } from "../Types.js"
import type * as Api from "../Fiber.js"
import { Primitive } from "./primitive.js"
import type * as Effect from "../Effect.js"

/** @internal */
export const TypeId: Api.TypeId = Symbol.for("effect/Fiber") as Api.TypeId

const fiberVariance = {
  _A: identity,
  _E: identity,
}

/** @internal */
export class FiberImpl<in out A = any, in out E = any>
  implements Api.Fiber<A, E>
{
  readonly [TypeId]: Api.Fiber.Variance<A, E>

  readonly _stack: Array<Primitive> = []
  readonly _observers: Array<(exit: EffectExit<A, E>) => void> = []
  _exit: EffectExit<A, E> | undefined
  public _children: Set<FiberImpl<any, any>> | undefined

  public currentOpCount = 0

  constructor(
    public context: Context.Context<never>,
    public interruptible = true,
  ) {
    this[TypeId] = fiberVariance
  }

  getRef<I, A>(ref: Context.Reference<I, A>): A {
    return InternalContext.unsafeGetReference(this.context, ref)
  }

  addObserver(cb: (exit: EffectExit<A, E>) => void): () => void {
    if (this._exit) {
      cb(this._exit)
      return constVoid
    }
    this._observers.push(cb)
    return () => {
      const index = this._observers.indexOf(cb)
      if (index >= 0) {
        this._observers.splice(index, 1)
      }
    }
  }

  _interrupted = false
  unsafeInterrupt(): void {
    if (this._exit) {
      return
    }
    this._interrupted = true
    if (this.interruptible) {
      this.evaluate(exitInterrupt as any)
    }
  }

  unsafePoll(): EffectExit<A, E> | undefined {
    return this._exit
  }

  evaluate(effect: Primitive): void {
    if (this._exit) {
      return
    } else if (this._yielded !== undefined) {
      const yielded = this._yielded as () => void
      this._yielded = undefined
      yielded()
    }
    const exit = this.runLoop(effect)
    if (exit === Yield) {
      return
    }

    // the interruptChildren middlware is added in Effect.fork, so it can be
    // tree-shaken if not used
    const interruptChildren =
      fiberMiddleware.interruptChildren &&
      fiberMiddleware.interruptChildren(this)
    if (interruptChildren !== undefined) {
      return this.evaluate(flatMap(interruptChildren, () => exit) as any)
    }

    this._exit = exit
    for (let i = 0; i < this._observers.length; i++) {
      this._observers[i](exit)
    }
    this._observers.length = 0
  }

  runLoop(effect: Primitive): EffectExit<A, E> | Yield {
    let yielding = false
    let current: Primitive | Yield = effect
    this.currentOpCount = 0
    try {
      while (true) {
        this.currentOpCount++
        if (
          !yielding &&
          this.getRef(CurrentScheduler).shouldYield(this as any)
        ) {
          yielding = true
          const prev = current
          current = flatMap(yieldNow, () => prev as any) as any
        }
        current = (current as any)[evaluate](this)
        if (current === Yield) {
          const yielded = this._yielded!
          if (EffectExitTypeId in yielded) {
            this._yielded = undefined
            return yielded
          }
          return Yield
        }
      }
    } catch (error) {
      if (!hasProperty(current, evaluate)) {
        return exitDie(`Fiber.runLoop: Not a valid effect: ${String(current)}`)
      }
      return exitDie(error)
    }
  }

  getCont<S extends successCont | failureCont>(
    symbol: S,
  ):
    | (Primitive & Record<S, (value: any, fiber: FiberImpl) => Primitive>)
    | undefined {
    while (true) {
      const op = this._stack.pop()
      if (!op) return undefined
      const cont = op[ensureCont] && op[ensureCont](this)
      if (cont) return { [symbol]: cont } as any
      if (op[symbol]) return op as any
    }
  }

  // cancel the yielded operation, or for the yielded exit value
  _yielded: EffectExit<any, any> | (() => void) | undefined = undefined
  yieldWith(value: EffectExit<any, any> | (() => void)): Yield {
    this._yielded = value
    return Yield
  }

  children(): Set<Fiber<any, any>> {
    return (this._children ??= new Set())
  }
}

const fiberMiddleware = globalValue("effect/Fiber/fiberMiddleware", () => ({
  interruptChildren: undefined as
    | ((fiber: FiberImpl) => Effect.Effect<void> | undefined)
    | undefined,
}))

const fiberInterruptChildren = (fiber: FiberImpl) => {
  if (fiber._children === undefined || fiber._children.size === 0) {
    return undefined
  }
  return fiberInterruptAll(fiber._children)
}
