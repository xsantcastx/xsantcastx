# Stripe Webhook Failure Notice

> Hello,
>
> We've had some trouble sending requests in live mode to a webhook endpoint associated with your xsantcastx account. Stripe sends webhook events to your server to notify you of activity in your Stripe account, such as a completed payout or a newly created invoice.
>
> The URL of the failing webhook endpoint is: https://stripe-handlewebhook-77wvanqjhq-uc.a.run.app
>
> You (or someone on your team) configured your Stripe account to send events to that URL. You can change your account's webhook endpoints from the Dashboard.
>
> In most cases, a failing webhook does not impact your payments or payouts. However:
>
> - If you use subscriptions, we rely on your webhook endpoint to notify you of new invoices. These invoices may be delayed for up to three days if your endpoint is unable to successfully receive them.
> - If you use Checkout and rely on the `checkout.session.completed` event as part of your purchase fulfillment process, you should review your completed payments to ensure you have fulfilled all recent purchases.
>
> We have attempted to send event notifications to this endpoint 11 times since the first failure on October 9, 2025 at 10:09:40 AM UTC. If this endpoint is important to your application, please try and fix the issue. If you do not need this webhook endpoint, you can remove it from your Stripe webhook settings. We will stop sending event notifications to this webhook endpoint by October 18, 2025 at 10:09:40 AM UTC.
>
> Here is the summary of errors we received while attempting to send webhook events:
>
> - 11 requests had other errors while sending the webhook event.
>
> You need to return any status code between HTTP 200 and 299 for Stripe to consider the webhook event successfully delivered.
>
> For more details on these errors and to review your account's recent activity, you can find the full set of events and request logs on the Dashboard.
>
> For more in-depth information on how to use webhooks, we recommend reviewing our documentation.
>
> -- The Stripe team

---

Got it: your Stripe webhook URL on Cloud Run is not returning a 2xx status, so Stripe is retrying and will disable the endpoint on October 18, 2025 if it keeps failing. Use this checklist to restore the endpoint quickly and safely.

## 1. Confirm the Cloud Run service is public

In the Google Cloud console, open Cloud Run, select `stripe-handlewebhook`, and ensure Security allows unauthenticated invocations. If it does not, grant the role with:

```bash
gcloud run services add-iam-policy-binding stripe-handlewebhook \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --region=us-central1
```

## 2. Inspect recent Cloud Run logs

Review the error the service is emitting so you know what Stripe is seeing. From your terminal run:

```bash
gcloud run services describe stripe-handlewebhook \
  --region us-central1 \
  --format='value(status.url)'

gcloud run logs read stripe-handlewebhook \
  --region us-central1 \
  --limit 50
```

Confirm the service URL matches the Stripe endpoint and look for the HTTP status codes returned to Stripe. Fix any application errors surfaced in the logs before retrying.

## 3. Return a success response immediately

Stripe considers the webhook delivered only when your service responds with an HTTP 2xx status. Acknowledge the request quickly and push heavier work onto background jobs if needed.

## 4. Verify the Stripe signature correctly

When verifying signatures, read the raw request body and use the webhook endpoint secret from the Stripe Dashboard. Parsing the body before verification or using the wrong secret is the most common source of failures.

## 5. Reference implementation for Node and Express on Cloud Run

Create a minimal service that uses `express.raw`, returns `200 OK` quickly, and handles the events you care about.

```json
{
  "name": "stripe-webhook",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "stripe": "^16.0.0"
  }
}
```

```javascript
import express from "express";
import Stripe from "stripe";

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Use express.raw so Stripe signature verification sees the exact payload.
app.post("/", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
      // TODO: fulfill the purchase.
      break;
    case "invoice.paid":
    case "invoice.payment_failed":
      // TODO: handle subscription billing results.
      break;
    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  // Acknowledge the event so Stripe stops retrying.
  return res.status(200).send("ok");
});

app.get("/", (_req, res) => res.status(200).send("alive"));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`listening on ${port}`));
```

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
CMD ["npm", "start"]
```

## 6. Deploy to Cloud Run

Deploy in the same region as the failing URL and provide your secrets:

```bash
gcloud run deploy stripe-handlewebhook \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars STRIPE_SECRET_KEY=sk_live_xxx \
  --set-env-vars STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## 7. Test the endpoint

- Option A: Send a basic POST request to confirm the service is reachable (signature verification will fail, but the endpoint should respond).

```bash
curl -i -X POST https://stripe-handlewebhook-77wvanqjhq-uc.a.run.app
```

- Option B: Use the Stripe CLI for end-to-end testing.

```bash
stripe login
stripe listen --forward-to https://stripe-handlewebhook-77wvanqjhq-uc.a.run.app
stripe trigger checkout.session.completed
```

## 8. Update the Stripe Dashboard if the path changes

If you adjust the webhook path (for example, to `/webhook`), update the endpoint URL in Stripe Dashboard > Developers > Webhooks to match.

## Common gotchas

- Body parsing before signature verification invalidates the payload Stripe expects.
- Leaving the service private returns 401 or 403 to Stripe, causing retries.
- Doing slow or synchronous work before sending `200 OK` makes Stripe time out and retry.
- Using the wrong webhook secret (`whsec_...`) prevents signature validation from succeeding.
