import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Mailbox from "effect/Mailbox"
import * as Stream from "effect/Stream"

Effect.gen(function*() {
  const mailbox = yield* Mailbox.make<number>()
  console.time("smol")
  yield* mailbox.offerAll(Array.range(0, 1_000_000))
  yield* mailbox.end
  console.timeLog("smol", "offered")
  console.log(
    yield* Stream.fromMailbox(mailbox).pipe(
      Stream.runCount
    )
  )
  console.timeEnd("smol")
}).pipe(Effect.runSync)
