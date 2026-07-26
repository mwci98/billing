import {createHmac, timingSafeEqual} from 'node:crypto';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({error: 'Method not allowed'});
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = request.body || {};

  if (!secret || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return response.status(400).json({error: 'Incomplete add-on payment verification data.'});
  }

  const expected = createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(String(razorpaySignature));

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return response.status(401).json({error: 'Invalid Razorpay payment signature.'});
  }

  return response.status(200).json({
    verified: true,
    razorpayPaymentId,
  });
}
