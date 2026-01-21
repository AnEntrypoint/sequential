import { nanoid } from 'nanoid';

export class ExecutableFlow {
  #db;

  constructor(db) {
    this.#db = db;
  }

  async execute(genFn, id = nanoid(), input = {}) {
    const saved = await this.#db?.get?.(id);
    const step = saved?.step ?? 0;

    let currentStep = 0;
    let gen = genFn(input);
    let iter = gen.next();

    try {
      while (!iter.done) {
        const { __tool, __save } = iter.value ?? {};

        if (__save) {
          await this.#db?.set?.(id, { step: currentStep });
          globalThis.__resume?.(id).catch?.(() => {});
          throw Error('$pause$');
        }

        if (__tool) {
          const [cat, n, i] = __tool;

          let result;
          if (currentStep < step) {
            // Resume mode: load cached result from DB
            result = await this.#db?.getResult?.(id, currentStep);
          } else {
            // Execution mode: call tool, save result, pause
            try {
              result = await globalThis.__call?.(cat, n, i);
            } catch (e) {
              result = { __error: e.message };
            }
            await this.#db?.setResult?.(id, currentStep, result);
            await this.#db?.set?.(id, { step: currentStep + 1 });
            globalThis.__resume?.(id).catch?.(() => {});
            throw Error('$pause$');
          }

          currentStep++;
          iter = gen.next(result);
        } else {
          throw Error('Invalid yield: must be { __tool } or { __save }');
        }
      }

      await this.#db?.delete?.(id);
      return iter.value;
    } catch (e) {
      if (e.message === '$pause$') return { paused: id, step: currentStep };
      throw e;
    }
  }
}

globalThis.__call ??= async () => { throw Error('__call not configured'); };
globalThis.__resume ??= async () => {};

export const createFlowExecutor = (db) => new ExecutableFlow(db);
