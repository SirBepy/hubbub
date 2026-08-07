import { describe, it, expect, afterEach } from "vitest";
import { SELF, env, reset } from "cloudflare:test";

afterEach(async () => { await reset(); });

describe("RateLimiterDO sharding by IP", () => {
  it("throttles one IP at the create threshold without affecting a different IP's budget", async () => {
    const a = env.RATE_LIMITER.getByName("ip:1.1.1.1");
    for (let i = 0; i < 20; i++) {
      expect(await a.checkCreate()).toBe(false);
    }
    expect(await a.checkCreate()).toBe(true);

    const b = env.RATE_LIMITER.getByName("ip:2.2.2.2");
    expect(await b.checkCreate()).toBe(false);
  });

  it("keeps checkJoin and checkDeezer as independent budgets on the same instance", async () => {
    const stub = env.RATE_LIMITER.getByName("ip:3.3.3.3");
    for (let i = 0; i < 20; i++) expect(await stub.checkJoin()).toBe(false);
    expect(await stub.checkJoin()).toBe(true);
    expect(await stub.checkDeezer()).toBe(false);
  });
});

describe("create-room endpoint rate limiting", () => {
  async function createFrom(ip: string) {
    return SELF.fetch("http://worker.local/api/rooms", {
      method: "POST",
      headers: { "CF-Connecting-IP": ip },
    });
  }

  it("throttles repeated create requests from one IP at 20/min, a different IP is unaffected", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await createFrom("9.9.9.1")).status).toBe(201);
    }
    expect((await createFrom("9.9.9.1")).status).toBe(429);
    expect((await createFrom("9.9.9.2")).status).toBe(201);
  });
});
