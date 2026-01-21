# Sequential

Pause/resume executor for edge functions.

## How It Works

```
Edge Function 1          Edge Function 2          Edge Function N
───────────────          ───────────────          ───────────────
run generator            load state from DB       load state from DB
hit tool call            replay cached results    replay cached results
save result to DB        hit next tool call       generator completes
save step to DB          save result to DB        clean up DB
fire HTTP /resume        save step to DB          return final result
exit                     fire HTTP /resume
                         exit
```

Each edge function invocation:
1. Loads saved step from DB
2. Creates generator, replays cached results up to saved step
3. Executes next tool call
4. Saves result and increments step
5. Fires HTTP callback (non-blocking)
6. Exits

## Usage

```javascript
import { createFlowExecutor } from 'sequential';

const flow = createFlowExecutor(storage);

function* workflow(input) {
  const user = yield { __tool: ['api', 'user', { id: input.userId }] };
  const posts = yield { __tool: ['api', 'posts', { uid: user.id }] };
  return { user, posts };
}

const result = await flow.execute(workflow, 'exec-id', { userId: 123 });
// { paused: 'exec-id', step: 0 } after first tool call
// { user, posts } when generator completes
```

## Storage Interface

```javascript
const storage = {
  get(id) {},           // returns { step: number }
  set(id, { step }) {}, // saves step
  delete(id) {},        // cleanup on completion

  getResult(id, step) {},       // returns cached tool result
  setResult(id, step, data) {}, // saves tool result
};
```

## Global Hooks

```javascript
globalThis.__call = async (category, name, input) => {
  // Execute tool call (HTTP, DB, etc)
};

globalThis.__resume = async (id) => {
  // Fire HTTP POST /resume/:id (non-blocking)
};
```

## Generator Yields

```javascript
yield { __tool: [category, name, input] }  // tool call - pauses after execution
yield { __save: true }                     // explicit save point
```

## Error Handling

Tool errors are captured and returned to the generator:

```javascript
function* workflow() {
  const result = yield { __tool: ['api', 'flaky', {}] };
  if (result.__error) {
    return { failed: true, reason: result.__error };
  }
}
```
