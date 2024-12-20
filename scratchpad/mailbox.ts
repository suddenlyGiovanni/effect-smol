import * as Effect from "effect/Effect"
import * as Mailbox from "effect/Mailbox"

Effect.gen(function*() {
  const mailbox = yield* Mailbox.make<string>()
  yield* mailbox.offer("Hello")
  console.log(yield* mailbox.take)
}).pipe(Effect.runSync)
