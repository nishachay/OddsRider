type Handler<T = unknown> = (payload: T) => void;

class Emitter {
  private map = new Map<string, Set<Handler<never>>>();

  on<T>(event: string, fn: Handler<T>): () => void {
    let set = this.map.get(event);
    if (!set) {
      set = new Set();
      this.map.set(event, set);
    }
    set.add(fn as Handler<never>);
    return () => this.off(event, fn);
  }

  off<T>(event: string, fn: Handler<T>): void {
    this.map.get(event)?.delete(fn as Handler<never>);
  }

  emit<T>(event: string, payload?: T): void {
    const set = this.map.get(event);
    if (!set) return;
    for (const fn of set) (fn as Handler<T | undefined>)(payload);
  }
}

export const bus = new Emitter();

export let activeRideStore: { current: unknown } = { current: null };

export const EV = {
  SPEED: 'hud:speed',
  MUTE: 'hud:mute',
  INPUT_FIRST: 'hud:input-first',
  NITRO: 'hud:nitro',
  CRASH: 'hud:crash',
  PROB: 'hud:prob',
  MARKET: 'hud:market',
  SCORE: 'hud:score',
  RESULT: 'hud:result',
  TRACK: 'hud:track',
  POSITION: 'hud:position',
  STUDIO_UPDATE: 'studio:update',
  RESTART: 'game:restart',
  GROUNDED: 'hud:grounded',
  LOAD_MARKET: 'game:load-market',
  OPEN_LOBBY: 'game:open-lobby',
} as const;
