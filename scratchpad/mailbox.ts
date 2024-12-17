import * as Mailbox from "effect/Mailbox"
import * as Effect from "effect/Effect"

Effect.gen(function* () {
  const mailbox = yield* Mailbox.make<string>()
  yield* mailbox.offer("Hello")
  console.log(yield* mailbox.take)
}).pipe(Effect.runSync)
