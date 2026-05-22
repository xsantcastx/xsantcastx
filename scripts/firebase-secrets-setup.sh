#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# firebase-secrets-setup.sh
#
# One-time operator script to finish the Firebase hardening:
#   1. (manual, FIRST) rotate the exposed credentials in their providers
#   2. push the (rotated) secrets into Cloud Secret Manager
#   3. deploy the functions (now bound to those secrets via defineSecret)
#   4. remove the unused firestore-send-email extension instances
#
# It contains NO secret values — `functions:secrets:set` prompts you to paste
# each value interactively. Run from the repo root: bash scripts/firebase-secrets-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cat <<'NOTE'
╭───────────────────────────────────────────────────────────────────────────╮
│ BEFORE running this: ROTATE the exposed credentials in their dashboards.    │
│   • Gmail app password (its.sc05@gmail.com) — revoke + regenerate          │
│   • PayPal LIVE client secret — regenerate                                 │
│   • Stripe secret/webhook + Brevo key — rotate if they were ever exposed   │
│ Rotation is the real fix; it invalidates whatever leaked in git/config.    │
╰───────────────────────────────────────────────────────────────────────────╯
NOTE
read -r -p "Have you rotated the credentials above? [y/N] " ok
[[ "${ok:-}" == "y" || "${ok:-}" == "Y" ]] || { echo "Aborting — rotate first."; exit 1; }

echo
echo "==> Step 2/4: store secrets in Secret Manager (paste each ROTATED value when prompted)"
for s in BREVO_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET; do
  echo "--- $s ---"
  firebase functions:secrets:set "$s"
done

echo
echo "==> Step 3/4: deploy functions (predeploy builds tsc; binds the secrets)"
firebase deploy --only functions

echo
echo "==> Step 4/4: remove the 3 unused firestore-send-email extension instances"
for id in firestore-send-email-dafc firestore-send-email-kk8r firestore-send-email; do
  echo "--- uninstalling $id ---"
  firebase ext:uninstall "$id" --force || echo "  (skip: $id not present / already removed)"
done

echo
echo "✔ Done. Optional follow-ups:"
echo "  • Purge the legacy values from the deprecated runtime config:"
echo "      firebase functions:config:unset paypal gmail   # (functions.config is being retired anyway)"
echo "  • Scrub the leaked file from git history (rotation already neutralizes it):"
echo "      git filter-repo --path extensions/firestore-send-email.env --invert-paths"
echo "      git push --force-with-lease origin main"
