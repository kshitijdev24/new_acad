export class InProcessQueue {
  constructor(processor) {
    this.processor = processor;
    this.pending = [];
    this.queued = new Set();
    this.running = false;
    this.accepting = true;
    this.idleWaiters = [];
  }

  enqueue(jobId) {
    const id = String(jobId);
    if (!this.accepting) throw new Error('The PYQ worker is shutting down.');
    if (this.queued.has(id)) return false;
    this.queued.add(id);
    this.pending.push(id);
    void this.drain();
    return true;
  }

  async drain() {
    if (this.running) return;
    this.running = true;
    while (this.pending.length) {
      const jobId = this.pending.shift();
      try {
        await this.processor(jobId);
      } catch (error) {
        console.error(`[PYQ worker] Job ${jobId} could not be processed: ${error.message}`);
      } finally {
        this.queued.delete(jobId);
      }
    }
    this.running = false;
    for (const resolve of this.idleWaiters.splice(0)) resolve();
  }

  waitForIdle() {
    if (!this.running && this.pending.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  async close() {
    this.accepting = false;
    await this.waitForIdle();
  }
}
