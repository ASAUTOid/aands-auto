import { readMap } from "../lib/hq.mjs";
import { advance } from "../lib/domains.mjs";

// Every 10 minutes: finish domain purchases the dealer paid on the Coinbase page but didn't confirm,
// and retry connecting domains that were bought but not linked yet. A paid checkout must be claimed within an hour.
export default async () => {
  const reqs = Object.values(await readMap("domainRequests"));
  for (const r of reqs) {
    const age = Date.now() - new Date(r.createdAt).getTime();
    if ((r.method === "usdc" && r.status === "awaiting_payment" && age < 26 * 3600e3) || r.status === "registered") await advance(r.id);
  }
};

export const config = { schedule: "*/10 * * * *" };
