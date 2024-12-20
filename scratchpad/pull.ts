import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"

const abc = Channel.asyncPush<string>(
  Effect.fnUntraced(function*(emit) {
    yield* Effect.addFinalizer(() => Effect.sync(() => console.log("finalizer")))
    emit.single("a")
    emit.single("b")
    emit.single("c")
    emit.end()
  })
)

const merged = Channel.mergeAll(
  Channel.fromIterable([abc, abc, abc, abc, abc]),
  { concurrency: 2 }
)

Effect.gen(function*() {
  const pull = yield* Channel.toPull(merged)
  console.log(yield* pull)
  console.log(yield* pull)
  console.log(yield* pull)

  console.log(yield* pull)
  console.log(yield* pull)
  console.log(yield* pull)

  console.log(yield* pull)
  console.log(yield* pull)
  console.log(yield* pull)

  console.log(yield* pull)
  console.log(yield* pull)
  console.log(yield* pull)

  console.log(yield* pull)
  console.log(yield* pull)
  console.log(yield* pull)

  yield* pull.pipe(
    Effect.catch((error) => Effect.sync(() => console.log("error", error)))
  )
}).pipe(Effect.scoped, Effect.runPromise)
