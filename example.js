import { SequentialFlow } from './src/index.js';

// Code uses semicolons to separate statements
// Final expression becomes the result (use array for multiple values)
const code = 'const user = await fetch("https://api.example.com/user/1"); const posts = await fetch("https://api.example.com/posts?uid=" + user.id); [user, posts]';

(async () => {
  // First execution - pauses on first fetch
  console.log('=== Execute ===');
  let task = await SequentialFlow.execute({ code, id: 'task-1' });
  console.log('Status:', task.status);
  console.log('Fetch URL:', task.fetchRequest?.url);
  console.log();

  // Resume with first response
  console.log('=== Resume 1 ===');
  task = await SequentialFlow.resume({
    taskId: 'task-1',
    fetchResponse: { id: 1, name: 'Alice' }
  });
  console.log('Status:', task.status);
  console.log('Fetch URL:', task.fetchRequest?.url);
  console.log();

  // Resume with second response
  console.log('=== Resume 2 ===');
  task = await SequentialFlow.resume({
    taskId: 'task-1',
    fetchResponse: [{ id: 101, title: 'Post 1' }, { id: 102, title: 'Post 2' }]
  });
  console.log('Status:', task.status);
  console.log('Result:', JSON.stringify(task.result, null, 2));
})();
