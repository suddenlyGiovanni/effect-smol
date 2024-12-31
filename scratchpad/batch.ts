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
  Array.range(1, 1000),
  (id) => Effect.request(new GetNameById({ id }), UserResolver),
  { concurrency: "unbounded" }
)

for (let i = 0; i < 10; i++) {
  Effect.runSync(effect)
}

console.time("smol batching")
for (let i = 0; i < 100; i++) {
  Effect.runSync(effect)
}
console.timeEnd("smol batching")
