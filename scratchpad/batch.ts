import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Request from "effect/Request"
import * as Resolver from "effect/RequestResolver"

class GetNameById extends Request.TaggedClass("GetNameById")<{
  readonly id: number
}, string> {}

const UserResolver = Resolver.make<GetNameById>((entries) =>
  Effect.sync(() => {
    for (const entry of entries) {
      entry.unsafeComplete(Effect.succeed(`User ${entry.request.id}`))
    }
  })
)

const effect = Effect.forEach(
  Array.range(1, 100_000),
  (id) => Effect.request(new GetNameById({ id }), UserResolver),
  { concurrency: "unbounded" }
)

Effect.gen(function*() {
  while (true) {
    console.time("batching")
    yield* effect
    console.timeEnd("batching")
  }
}).pipe(Effect.runSync)
