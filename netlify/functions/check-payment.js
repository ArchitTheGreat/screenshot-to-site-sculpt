const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { sessionId } = JSON.parse(event.body);
    
    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Session ID required' })
      };
    }

    const store = getStore('payments');
    
    // Check if payment exists with this session ID
    const paymentData = await store.get(sessionId);
    
    if (paymentData) {
      const payment = JSON.parse(paymentData);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          confirmed: payment.status === 'confirmed',
          payment 
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: false })
    };

  } catch (error) {
    console.error('Check payment error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to check payment' })
    };
  }
};
