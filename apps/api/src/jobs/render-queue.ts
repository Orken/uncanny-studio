/** Runs at most `concurrency` renders at once; the others wait in arrival order. */
export class RenderQueue {
  private readonly waiting: string[] = [];
  private running = 0;

  constructor(private readonly concurrency: number, private readonly run: (id: string) => Promise<void>) {}

  enqueue(id: string) {
    this.waiting.push(id);
    this.drain();
  }

  /** Removes a render that has not started yet; false when it is not waiting. */
  cancel(id: string) {
    const index = this.waiting.indexOf(id);
    if (index < 0) return false;
    this.waiting.splice(index, 1);
    return true;
  }

  /** 1-based rank among the waiting renders; undefined when not waiting. */
  position(id: string) {
    const index = this.waiting.indexOf(id);
    return index < 0 ? undefined : index + 1;
  }

  private drain() {
    while (this.running < this.concurrency && this.waiting.length) {
      const id = this.waiting.shift()!;
      this.running++;
      this.run(id).catch(() => undefined).finally(() => { this.running--; this.drain(); });
    }
  }
}
