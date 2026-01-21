# Sequential

Pause/resume code execution for edge functions. Uses `sequential-fetch` VM.

## How It Works

```
Edge Function 1              Edge Function 2              Edge Function N
───────────────              ───────────────              ───────────────
execute code                 load VM state from DB        load VM state from DB
VM hits fetch()              resume execution             resume execution
save VM state to DB          VM hits next fetch()         code completes
return paused + fetchRequest save VM state to DB          clean up DB
exit                         return paused + fetchRequest return result
                             exit
```

Code runs in a VM. When code calls `fetch()`, the VM pauses and returns the fetch request details. The VM state is saved to storage. On resume, the VM state is restored and execution continues from where it paused.

## Usage

```javascript
import { SequentialFlow } from 'sequential';

// Code uses semicolons to separate statements
// Final expression becomes the result
const code = 'const user = await fetch("https://api.example.com/user/1"); const posts = await fetch("https://api.example.com/posts"); [user, posts]';

// Execute - pauses on first fetch
let task = await SequentialFlow.execute({ code, id: 'task-1' });
// task.status === 'paused'
// task.fetchRequest.url === 'https://api.example.com/user/1'

// Resume with fetch response
task = await SequentialFlow.resume({
  taskId: 'task-1',
  fetchResponse: { id: 1, name: 'Alice' }
});
// task.status === 'paused' (second fetch)

// Resume again
task = await SequentialFlow.resume({
  taskId: 'task-1',
  fetchResponse: [{ id: 101 }, { id: 102 }]
});
// task.status === 'completed'
// task.result === [user, posts]
```

## API

### SequentialFlow.execute(request, options?)

```javascript
await SequentialFlow.execute({
  code: string,
  id?: string,
  name?: string
}, {
  storage?: Storage,
  ttl?: number
});
```

Returns:
```javascript
{
  id: string,
  status: 'paused' | 'completed' | 'error',
  result?: any,
  error?: string,
  fetchRequest?: { url, method, headers, body },
  vmState: any,
  pausedState: any
}
```

### SequentialFlow.resume(request, options?)

```javascript
await SequentialFlow.resume({
  taskId: string,
  fetchResponse: any
}, {
  storage?: Storage
});
```

### SequentialFlow.getTask(taskId, options?)

### SequentialFlow.deleteTask(taskId, options?)

## Storage Interface

```javascript
const storage = {
  async save(task) {},
  async load(taskId) {},
  async delete(taskId) {}
};

SequentialFlow.defaultStorage = storage;
```

## createFlow Helper

```javascript
import { createFlow } from 'sequential';

const flow = createFlow(myStorage);
await flow.execute({ code });
await flow.resume({ taskId, fetchResponse });
```

## Code Format

- Statements separated by semicolons
- Final expression becomes the result (not `return`)
- `fetch()` calls pause execution
