import { initializePaddle } from "@paddle/paddle-js";

let paddleInstance = null;

export async function getPaddle() {
  if (!paddleInstance) {
    paddleInstance = await initializePaddle({
      environment: "sandbox",
      token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN,
    });
  }

  return paddleInstance;
}

export async function buyItem({ priceId, customData }) {
  const paddle = await getPaddle();

  paddle.Checkout.open({
    items: [
      {
        priceId,
        quantity: 1,
      },
    ],
    customData,
    settings: {
      successUrl: `${window.location.origin}/?payment=success`,
    },
  });
}

export async function openMultiItemCheckout({ items, customData }) {
  const paddle = await getPaddle();

  paddle.Checkout.open({
    items,
    customData,
    settings: {
      successUrl: `${window.location.origin}/?payment=success`,
    },
  });
}
