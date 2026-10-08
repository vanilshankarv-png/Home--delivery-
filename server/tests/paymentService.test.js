import {
  createGatewayOrder,
  createMockSignature,
  verifyPaymentSignature
} from "../src/services/paymentService.js";

describe("payment service", () => {
  test("creates mock orders in paise without requiring gateway keys", async () => {
    const order = await createGatewayOrder({
      razorpay: null,
      mock: true,
      amount: 123.45,
      currency: "INR",
      receipt: "booking-demo"
    });

    expect(order.id).toMatch(/^order_mock_/);
    expect(order.amount).toBe(12345);
    expect(order.currency).toBe("INR");
  });

  test("rejects real orders when the Razorpay client is not configured", async () => {
    await expect(createGatewayOrder({
      razorpay: null,
      mock: false,
      amount: 123,
      currency: "INR",
      receipt: "booking-demo"
    })).rejects.toMatchObject({ statusCode: 503 });
  });

  test("validates an HMAC payment signature and rejects tampering", () => {
    const signature = createMockSignature("order_123", "pay_456", "test-secret");
    expect(verifyPaymentSignature({
      orderId: "order_123",
      paymentId: "pay_456",
      signature,
      secret: "test-secret"
    })).toBe(true);
    expect(verifyPaymentSignature({
      orderId: "order_123",
      paymentId: "pay_changed",
      signature,
      secret: "test-secret"
    })).toBe(false);
  });
});
