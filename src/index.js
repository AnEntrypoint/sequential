import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { SequentialFetchVM } = require('sequential-fetch');

class InMemoryStorage {
  constructor() {
    this.storage = new Map();
  }
  async save(task) { this.storage.set(task.id, task); }
  async load(taskId) { return this.storage.get(taskId); }
  async delete(taskId) { this.storage.delete(taskId); }
}

export class SequentialFlow {
  static defaultStorage = new InMemoryStorage();

  static async execute(request, options = {}) {
    const { storage = this.defaultStorage, ttl = 2 * 60 * 60 * 1000 } = options;
    const taskId = request.id || `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const vm = new SequentialFetchVM();

    try {
      await vm.initialize();
      const result = await vm.executeCode(request.code);

      const task = {
        id: taskId,
        name: request.name || taskId,
        code: request.code,
        status: result.type === 'pause' ? 'paused' : result.type === 'complete' ? 'completed' : 'error',
        result: result.result,
        error: result.error,
        vmState: result.state,
        pausedState: result.type === 'pause' ? {
          ...vm.paused,
          variables: [...vm.paused.variables.entries()]
        } : null,
        fetchRequest: result.fetchRequest,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl).toISOString()
      };

      if (task.status === 'paused') await storage.save(task);
      return task;
    } catch (error) {
      return {
        id: taskId,
        name: request.name || taskId,
        code: request.code,
        status: 'error',
        error: error.message,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl).toISOString()
      };
    } finally {
      vm.dispose();
    }
  }

  static async resume(request, options = {}) {
    const { storage = this.defaultStorage } = options;
    const { taskId, fetchResponse } = request;

    const storedTask = await storage.load(taskId);
    if (!storedTask) throw new Error(`Task ${taskId} not found`);

    const vm = new SequentialFetchVM();

    try {
      await vm.initialize();

      // Restore paused state with Map conversion
      if (storedTask.pausedState) {
        vm.paused = {
          ...storedTask.pausedState,
          variables: new Map(storedTask.pausedState.variables)
        };
        // Restore variables to VM (the library doesn't do this automatically)
        for (const [k, v] of vm.paused.variables) {
          vm.variables.set(k, v);
        }
      }

      const result = await vm.resumeExecution(storedTask.vmState, fetchResponse?.data ?? fetchResponse);

      const task = {
        id: taskId,
        name: storedTask.name,
        code: storedTask.code,
        status: result.type === 'pause' ? 'paused' : result.type === 'complete' ? 'completed' : 'error',
        result: result.result,
        error: result.error,
        vmState: result.state,
        pausedState: result.type === 'pause' ? {
          ...vm.paused,
          variables: [...vm.paused.variables.entries()]
        } : null,
        fetchRequest: result.fetchRequest,
        updatedAt: new Date().toISOString()
      };

      if (task.status === 'paused') await storage.save(task);
      else await storage.delete(taskId);

      return task;
    } catch (error) {
      await storage.delete(taskId);
      return { id: taskId, name: storedTask.name, code: storedTask.code, status: 'error', error: error.message };
    } finally {
      vm.dispose();
    }
  }

  static async getTask(taskId, options = {}) {
    return (options.storage ?? this.defaultStorage).load(taskId);
  }

  static async deleteTask(taskId, options = {}) {
    await (options.storage ?? this.defaultStorage).delete(taskId);
  }
}

export { InMemoryStorage };
export const createFlow = (storage) => ({
  execute: (req, opts) => SequentialFlow.execute(req, { storage, ...opts }),
  resume: (req, opts) => SequentialFlow.resume(req, { storage, ...opts }),
  getTask: (id, opts) => SequentialFlow.getTask(id, { storage, ...opts }),
  deleteTask: (id, opts) => SequentialFlow.deleteTask(id, { storage, ...opts })
});
