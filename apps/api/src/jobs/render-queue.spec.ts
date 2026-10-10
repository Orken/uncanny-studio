import { RenderQueue } from './render-queue';

const tick = () => new Promise(resolve => setImmediate(resolve));

describe('RenderQueue', () => {
  it('runs renders one at a time in arrival order and exposes positions', async () => {
    const started: string[] = [];
    const releases: (() => void)[] = [];
    const queue = new RenderQueue(1, id => new Promise<void>(resolve => { started.push(id); releases.push(resolve); }));
    queue.enqueue('a'); queue.enqueue('b'); queue.enqueue('c');
    expect(started).toEqual(['a']);
    expect(queue.position('a')).toBeUndefined();
    expect(queue.position('b')).toBe(1);
    expect(queue.position('c')).toBe(2);
    releases[0](); await tick();
    expect(started).toEqual(['a', 'b']);
    expect(queue.position('c')).toBe(1);
  });

  it('cancels a waiting render only', async () => {
    const started: string[] = [];
    const releases: (() => void)[] = [];
    const queue = new RenderQueue(1, id => new Promise<void>(resolve => { started.push(id); releases.push(resolve); }));
    queue.enqueue('a'); queue.enqueue('b'); queue.enqueue('c');
    expect(queue.cancel('a')).toBe(false);
    expect(queue.cancel('b')).toBe(true);
    releases[0](); await tick();
    expect(started).toEqual(['a', 'c']);
  });

  it('keeps going after a failed render', async () => {
    const started: string[] = [];
    const queue = new RenderQueue(1, async id => { started.push(id); if (id === 'a') throw new Error('boom'); });
    queue.enqueue('a'); queue.enqueue('b');
    await tick();
    expect(started).toEqual(['a', 'b']);
  });
});
