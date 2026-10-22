/**
 * The game's own Cloud Functions codebase ("game" in firebase.json): trading and ground drops. Kept apart from
 * functions/ (site: contact, payments) so a deploy here never needs that codebase's payment secrets.
 */
export { tradeApi, groundSweep } from "./trade.js";
