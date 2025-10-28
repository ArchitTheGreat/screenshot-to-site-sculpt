const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { amount, currency, orderId } = JSON.parse(event.body);
    
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    // Create payment with NOWPayments
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: currency,
        order_id: orderId,
        order_description: 'KryptoGain Tax Report',
        ipn_callback_url: `${process.env.URL}/.netlify/functions/payment-webhook`,
        success_url: `${process.env.URL}/calculator?payment=success`,
        cancel_url: `${process.env.URL}/calculator?payment=cancelled`,
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Payment creation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create payment' }),
    };
  }
};
