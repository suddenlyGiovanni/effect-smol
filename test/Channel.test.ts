import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Mailbox from "effect/Mailbox"
import { assert, describe, it } from "vitest"

describe("Channel", () => {
  describe("constructors", () => {
    it("succeed", () =>
      Effect.gen(function*() {
        const result = yield* Channel.succeed(1).pipe(Channel.runCollect)
        assert.deepStrictEqual(result, [1])
      }).pipe(Effect.runPromise))
  })

  describe("merging", () => {
    it("merge - interrupts left side if halt strategy is set to 'right'", () =>
      Effect.gen(function*() {
        const latch = yield* Effect.makeLatch(false)
        const leftMailbox = yield* Mailbox.make<number>()
        const rightMailbox = yield* Mailbox.make<number>()
        const left = Channel.fromMailbox(rightMailbox)
        const right = Channel.fromMailbox(leftMailbox).pipe(
          Channel.ensuring(latch.open)
        )
        const fiber = yield* Channel.merge(left, right, {
          haltStrategy: "right"
        }).pipe(Channel.runCollect, Effect.fork)
        yield* leftMailbox.offerAll([1, 2])
        yield* leftMailbox.end
        yield* latch.await
        yield* rightMailbox.offerAll([3, 4])
        const result = yield* Fiber.join(fiber)
        assert.deepStrictEqual(result, [1, 2])
      }).pipe(Effect.runPromise))

    it("merge - interrupts right side if halt strategy is set to 'left'", () =>
      Effect.gen(function*() {
        const latch = yield* Effect.makeLatch(false)
        const leftMailbox = yield* Mailbox.make<number>()
        const rightMailbox = yield* Mailbox.make<number>()
        const left = Channel.fromMailbox(leftMailbox).pipe(
          Channel.ensuring(latch.open)
        )
        const right = Channel.fromMailbox(rightMailbox)
        const fiber = yield* Channel.merge(left, right, {
          haltStrategy: "left"
        }).pipe(Channel.runCollect, Effect.fork)
        yield* leftMailbox.offerAll([1, 2])
        yield* leftMailbox.end
        yield* latch.await
        yield* rightMailbox.offerAll([3, 4])
        const result = yield* Fiber.join(fiber)
        assert.deepStrictEqual(result, [1, 2])
      }).pipe(Effect.runPromise))

    it("merge - interrupts losing side if halt strategy is set to 'either'", () =>
      Effect.gen(function*() {
        const left = Channel.fromEffect(Effect.never)
        const right = Channel.succeed(1)
        const result = yield* Channel.merge(left, right, {
          haltStrategy: "either"
        }).pipe(Channel.runCollect)
        assert.deepStrictEqual(result, [1])
      }).pipe(Effect.runPromise))

    it("merge - waits for both sides if halt strategy is set to 'both'", () =>
      Effect.gen(function*() {
        const left = Channel.succeed(1)
        const right = Channel.succeed(2)
        const result = yield* Channel.merge(left, right, {
          haltStrategy: "both"
        }).pipe(Channel.runCollect)
        assert.deepStrictEqual(result, [1, 2])
      }).pipe(Effect.runPromise))

    it("merge - prioritizes failure", () =>
      Effect.gen(function*() {
        const left = Channel.fromEffect(Effect.fail("boom"))
        const right = Channel.fromEffect(Effect.never)
        const result = yield* Channel.merge(left, right).pipe(
          Channel.runCollect,
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.fail("boom"))
      }).pipe(Effect.runPromise))
  })
})
