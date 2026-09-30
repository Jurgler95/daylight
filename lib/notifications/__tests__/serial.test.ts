import { createSerialQueue } from '../serial';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createSerialQueue', () => {
  it('starts a task only after the one before it has finished', async () => {
    const enqueue = createSerialQueue();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`${name} start`);
      await tick();
      log.push(`${name} end`);
    };
    await Promise.all([enqueue(task('a')), enqueue(task('b'))]);
    expect(log).toEqual(['a start', 'a end', 'b start', 'b end']);
  });

  it('keeps going after a task fails and hands the error to its caller', async () => {
    const enqueue = createSerialQueue();
    const failed = enqueue(async () => {
      throw new Error('kaputt');
    });
    const next = jest.fn(async () => undefined);
    await expect(failed).rejects.toThrow('kaputt');
    await enqueue(next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
