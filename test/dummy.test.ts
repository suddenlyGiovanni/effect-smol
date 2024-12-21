import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Mailbox from "effect/Mailbox"
import { assert, describe, it } from "vitest"

describe("Channel", () => {
  it("succeed", () =>
    Effect.gen(function*() {
      const result = yield* Channel.succeed(1).pipe(Channel.runCollect)
      assert.deepStrictEqual(result, [1])
    }).pipe(Effect.runPromise))

  it("merge", () =>
    Effect.gen(function*() {
      const leftMailbox = yield* Mailbox.make<number>()
      const rightMailbox = yield* Mailbox.make<number>()
      const latch = yield* Effect.makeLatch(false)
      const fiber = yield* Channel.fromMailbox(leftMailbox).pipe(
        Channel.ensuring(latch.open),
        Channel.merge(Channel.fromMailbox(rightMailbox), { haltStrategy: "left" }),
        Channel.runCollect,
        Effect.fork
      )
      yield* leftMailbox.offerAll([1, 2])
      yield* leftMailbox.end
      yield* latch.await
      yield* rightMailbox.offerAll([3, 4])
      const result = yield* Fiber.join(fiber)
      assert.deepStrictEqual(result, [1, 2])
    }).pipe(Effect.runPromise))
})
