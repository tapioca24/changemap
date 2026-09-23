import type { ReviewStatus } from "../shared/review.js";
import type { ReviewSnapshot } from "../git/snapshot.js";

export interface ReviewSource {
  capture(): Promise<ReviewSnapshot>;
  fingerprint(): Promise<string>;
}

export class ReviewSession {
  private stale = false;
  private error: string | null = null;
  private refreshing: Promise<ReviewSnapshot> | null = null;
  private checking: Promise<void> | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  private constructor(
    private source: ReviewSource,
    private current: ReviewSnapshot,
  ) {}

  static async create(source: ReviewSource): Promise<ReviewSession> {
    return new ReviewSession(source, await source.capture());
  }

  get snapshot(): ReviewSnapshot {
    return this.current;
  }

  get status(): ReviewStatus {
    return {
      snapshotId: this.current.summary.id,
      stale: this.stale,
      refreshing: this.refreshing !== null,
      error: this.error,
    };
  }

  check(): Promise<void> {
    if (this.checking) return this.checking;
    if (this.refreshing || this.stopped) return Promise.resolve();
    const current = this.current;
    this.checking = (async () => {
      try {
        const fingerprint = await this.source.fingerprint();
        if (this.current === current && !this.refreshing)
          this.stale = fingerprint !== current.fingerprint;
      } catch (error) {
        if (this.current === current && !this.refreshing) {
          this.stale = true;
          this.error = error instanceof Error ? error.message : String(error);
        }
      } finally {
        this.checking = null;
      }
    })();
    return this.checking;
  }

  refresh(): Promise<ReviewSnapshot> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        await this.checking;
        const next = await this.source.capture();
        this.current = next;
        this.stale = false;
        this.error = null;
        return next;
      } catch (error) {
        this.stale = true;
        this.error = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  startPolling(intervalMs = 1500): void {
    if (this.timer || this.stopped) return;
    const poll = async () => {
      await this.check();
      if (!this.stopped) this.timer = setTimeout(poll, intervalMs);
    };
    this.timer = setTimeout(poll, intervalMs);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await Promise.allSettled([this.checking, this.refreshing]);
  }
}
