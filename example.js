import { createFlowExecutor } from './src/index.js';

// Storage with separate result handling (simulates DB)
const state = new Map();
const results = new Map();

const storage = {
  get: (id) => Promise.resolve(state.get(id)),
  set: (id, data) => { state.set(id, data); return Promise.resolve(); },
  delete: (id) => {
    // Clean up all results for this execution
    for (const key of results.keys()) {
      if (key.startsWith(`${id}:`)) results.delete(key);
    }
    state.delete(id);
    return Promise.resolve();
  },
  getResult: (id, step) => Promise.resolve(results.get(`${id}:${step}`)),
  setResult: (id, step, data) => {
    results.set(`${id}:${step}`, data);
    return Promise.resolve();
  }
};

const flow = createFlowExecutor(storage);

// Workflow with multiple tool calls
function* workflow(input) {
  const user = yield { __tool: ['api', 'user', { id: input.userId }] };
  const posts = yield { __tool: ['api', 'posts', { uid: user.id }] };
  const comments = yield { __tool: ['api', 'comments', { postIds: posts.map(p => p.id) }] };

  return {
    user,
    postsCount: posts.length,
    commentsCount: comments.length
  };
}

// Mock tool - in real use this would be HTTP calls
globalThis.__call = async (cat, n, i) => {
  const mocks = {
    user: { id: 1, name: 'Alice' },
    posts: [{ id: 101 }, { id: 102 }],
    comments: [{ id: 1001 }, { id: 1002 }, { id: 1003 }]
  };
  console.log(`  [tool] ${cat}/${n}`, JSON.stringify(i));
  return mocks[n];
};

// Resume hook - in real use this fires HTTP to /resume/:id
globalThis.__resume = async (id) => {
  console.log(`  [resume] → would HTTP POST /resume/${id}`);
};

(async () => {
  const id = 'exec-001';

  // Simulate edge function invocations
  console.log('=== Invocation 1: First tool call ===');
  let r = await flow.execute(workflow, id, { userId: 1 });
  console.log('  Result:', r);
  console.log('  DB state:', state.get(id));
  console.log('  Cached results:', [...results.entries()]);
  console.log();

  console.log('=== Invocation 2: Second tool call ===');
  r = await flow.execute(workflow, id, { userId: 1 });
  console.log('  Result:', r);
  console.log('  DB state:', state.get(id));
  console.log();

  console.log('=== Invocation 3: Third tool call ===');
  r = await flow.execute(workflow, id, { userId: 1 });
  console.log('  Result:', r);
  console.log('  DB state:', state.get(id));
  console.log();

  console.log('=== Invocation 4: Completion ===');
  r = await flow.execute(workflow, id, { userId: 1 });
  console.log('  Final result:', r);
  console.log('  DB cleaned:', !state.has(id) && results.size === 0);
})();
