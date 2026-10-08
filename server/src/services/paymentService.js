import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function isMockPaymentsEnabled(env = process.env) {
  return String(env.MOCK_PAYMENTS).toLowerCase() === "true";
}

export function createRazorpayClient(env = process.env) {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET
  });
}

export function verifyPaymentSignature({ orderId, paymentId, signature, secret }) {
  if (!orderId || !paymentId || typeof signature !== "string" || !secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createMockSignature(orderId, paymentId, secret) {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function generateInvoiceNo() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `HD-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createGatewayOrder({ razorpay, mock, amount, currency, receipt }) {
  if (mock) {
    return {
      id: `order_mock_${randomBytes(12).toString("hex")}`,
      amount: Math.round(amount * 100),
      currency,
      receipt
    };
  }
  if (!razorpay) throw httpError("Razorpay is not configured. Set test keys or enable MOCK_PAYMENTS.", 503);
  return razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency,
    receipt
  });
}

export async function createGatewayRefund({ razorpay, payment, amount }) {
  if (payment.isMock || !razorpay) {
    return { id: `rfnd_mock_${randomBytes(8).toString("hex")}`, status: "processed" };
  }
  if (!payment.razorpayPaymentId) throw httpError("This payment has no captured gateway payment to refund.", 409);
  return razorpay.payments.refund(payment.razorpayPaymentId, {
    amount: Math.round(amount * 100),
    notes: { invoiceNo: payment.invoiceNo }
  });
}

export { httpError };
