import { describe, expect, it } from 'vitest';
import { calculateCardFee, getAppliedCardFee } from './salePricing';

describe('salePricing', () => {
  it.each(['cartao_credito', 'cartao_debito'])('aplica 5%% para %s', paymentMethod => {
    expect(calculateCardFee(paymentMethod, 90)).toBe(4.5);
  });

  it('não aplica taxa em outras formas de pagamento', () => {
    expect(calculateCardFee('pix', 90)).toBe(0);
    expect(calculateCardFee('dinheiro', 90)).toBe(0);
  });

  it('arredonda a taxa para centavos', () => {
    expect(calculateCardFee('cartao_credito', 99.99)).toBe(5);
  });

  it('identifica a taxa persistida sem alterar vendas antigas', () => {
    expect(getAppliedCardFee('cartao_debito', 100, 10, 94.5)).toBe(4.5);
    expect(getAppliedCardFee('cartao_debito', 100, 10, 90)).toBe(0);
  });
});
