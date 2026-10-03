export const CARD_FEE_RATE = 0.05;

const CARD_PAYMENT_METHODS = new Set(['cartao_credito', 'cartao_debito']);

export const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const isCardPayment = (paymentMethod: string) => CARD_PAYMENT_METHODS.has(paymentMethod);

export const calculateCardFee = (paymentMethod: string, amountAfterDiscount: number) => (
  isCardPayment(paymentMethod)
    ? roundCurrency(Math.max(0, amountAfterDiscount) * CARD_FEE_RATE)
    : 0
);

export const getAppliedCardFee = (
  paymentMethod: string,
  subtotal: number,
  discountAmount: number,
  total: number,
) => {
  if (!isCardPayment(paymentMethod)) return 0;

  const amountAfterDiscount = roundCurrency(subtotal - discountAmount);
  return roundCurrency(Math.max(0, total - amountAfterDiscount));
};
