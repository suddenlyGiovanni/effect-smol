import * as Request from "#dist/effect/batching/Request"
import * as Resolver from "#dist/effect/batching/RequestResolver"
import * as Array from "#dist/effect/collections/Array"
import * as Effect from "#dist/effect/Effect"

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

Effect.runFork(effect)
