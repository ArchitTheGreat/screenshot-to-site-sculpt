const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    // Verify IPN signature
    const receivedSignature = event.headers['x-nowpayments-sig'];
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    
    if (!ipnSecret) {
      console.error('IPN_SECRET not configured');
      return { statusCode: 500, body: 'Configuration error' };
    }

    const payload = event.body;
    const calculatedSignature = crypto
      .createHmac('sha512', ipnSecret)
      .update(payload)
      .digest('hex');

    if (receivedSignature !== calculatedSignature) {
      console.error('Invalid signature');
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid signature' }) 
      };
    }

    const paymentData = JSON.parse(payload);
    console.log('Payment webhook received:', paymentData);

    // Store payment confirmation
    if (paymentData.payment_status === 'finished' || paymentData.payment_status === 'confirmed') {
      const store = getStore('payments');
      
      // Store with payment_id as key
      await store.set(paymentData.payment_id, JSON.stringify({
        status: 'confirmed',
        payment_id: paymentData.payment_id,
        order_id: paymentData.order_id,
        price_amount: paymentData.price_amount,
        actually_paid: paymentData.actually_paid,
        pay_currency: paymentData.pay_currency,
        confirmed_at: new Date().toISOString()
      }));

      console.log('Payment confirmed and stored:', paymentData.payment_id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
