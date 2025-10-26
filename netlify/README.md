# Netlify Functions Setup

## Environment Variables Required

Set these in Netlify Dashboard → Site Settings → Environment Variables:

```
NOWPAYMENTS_IPN_SECRET=your_ipn_secret_from_nowpayments_dashboard
VITE_ETHERSCAN_API_KEY=your_etherscan_key
VITE_POLYGONSCAN_API_KEY=your_polygonscan_key
```

## NOWPayments IPN Configuration

In your NOWPayments dashboard:
1. Go to Settings → IPN Settings
2. Set IPN Callback URL: `https://yoursite.netlify.app/.netlify/functions/payment-webhook`
3. Copy your IPN Secret and add it to Netlify environment variables

## How It Works

1. User clicks "Pay $15 with Crypto & Generate Report"
2. Generates unique session ID (wallet address + timestamp)
3. Stores session in localStorage
4. Opens NOWPayments in new tab with order_id
5. Frontend polls `/.netlify/functions/check-payment` every 5 seconds
6. NOWPayments sends IPN webhook to `/.netlify/functions/payment-webhook`
7. Webhook verifies signature and stores confirmation in Netlify Blobs
8. Frontend detects confirmation and generates tax report automatically

## Functions

- `payment-webhook.js` - Receives IPN callbacks from NOWPayments
- `check-payment.js` - Checks if a payment has been confirmed

## Testing

After deploying to Netlify:
1. Check function logs in Netlify Dashboard → Functions
2. Test payment flow with small amount
3. Monitor webhook calls in NOWPayments dashboard
