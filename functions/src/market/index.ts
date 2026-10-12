/**
 * The player market's callable functions. Exported from src/index.ts as
 * `market-placeOrder`, `market-cancelOrder`, `market-collect`.
 *
 * All three require a signed-in, non-anonymous Firebase user and an App Check
 * token (global option in src/index.ts). All three are refused unless the
 * owner has set `market/v1.enabled = true` — the server-side feature flag.
 */
import {CallableRequest, HttpsError, onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {MarketError, cancelOrder, collect, placeOrder, validatePlaceInput} from "./engine";
import {FirestoreMarketStore} from "./firestore-store";

let store: FirestoreMarketStore | null = null;
function marketStore(): FirestoreMarketStore {
  if (!store) store = new FirestoreMarketStore();
  return store;
}

function requireTrader(req: CallableRequest<unknown>): string {
  const auth = req.auth;
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in to trade.");
  const provider = (auth.token as {firebase?: {sign_in_provider?: string}}).firebase?.sign_in_provider;
  if (provider === "anonymous") throw new HttpsError("unauthenticated", "Sign in to trade.");
  return auth.uid;
}

async function guarded<T>(name: string, uid: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof MarketError) {
      throw new HttpsError(err.code, err.message, {reason: err.reason});
    }
    if (err instanceof HttpsError) throw err;
    logger.error(`market.${name} failed`, {uid, error: String(err)});
    throw new HttpsError("internal", "The market couldn't finish that. Nothing was taken — try again in a moment.");
  }
}

const OPTS = {maxInstances: 10, concurrency: 40, timeoutSeconds: 30};

export const placeOrderFn = onCall(OPTS, async (req) => {
  const uid = requireTrader(req);
  return guarded("placeOrder", uid, () => placeOrder(marketStore(), uid, validatePlaceInput(req.data), Date.now()));
});

export const cancelOrderFn = onCall(OPTS, async (req) => {
  const uid = requireTrader(req);
  const orderId = (req.data as {orderId?: unknown} | null)?.orderId;
  return guarded("cancelOrder", uid, () => cancelOrder(marketStore(), uid, orderId, Date.now()));
});

export const collectFn = onCall(OPTS, async (req) => {
  const uid = requireTrader(req);
  return guarded("collect", uid, () => collect(marketStore(), uid, Date.now()));
});
