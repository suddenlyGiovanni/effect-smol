import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"

const abc = Channel.asyncPush<string>(
  Effect.fnUntraced(function* (emit) {
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => console.log("finalizer")),
    )
    emit.single("a")
    emit.single("b")
    emit.single("c")
    emit.end()
  }),
)

Effect.gen(function* () {
  console.log(yield* Channel.runCollect(abc))
}).pipe(Effect.runFork)
