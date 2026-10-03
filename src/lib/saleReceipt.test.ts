import { describe, expect, it } from 'vitest';
import { buildReceiptHtml, isMobileDevice, type ReceiptSale } from './saleReceipt';

const sale: ReceiptSale = {
  saleCode: 'VEN-123', clientName: '<Cliente & Filhos>', clientPhone: '11999999999',
  paymentMethod: 'pix', subtotal: 100, discountAmount: 10, cardFeeAmount: 0, total: 90,
  date: '2026-10-03T12:00:00-03:00', note: 'Entregar <hoje>', sellerName: 'Arthur',
  items: [{ productName: 'Camiseta', productCode: 'P-1', quantity: 2, unitPrice: 50 }],
};

describe('saleReceipt', () => {
  it('gera o cupom com valores e conteúdo escapado', () => {
    const html = buildReceiptHtml(sale);
    expect(html).toContain('VEN-123');
    expect(html).toContain('90,00');
    expect(html).toContain('&lt;Cliente &amp; Filhos&gt;');
    expect(html).not.toContain('<Cliente & Filhos>');
    expect(html).toContain('@media print');
    expect(html).toContain('@page { size: 58mm auto; margin: 0; }');
    expect(html).toContain('width: 48mm');
    expect(html).toContain('font-family: Arial, sans-serif');
    expect(html).toContain('font-size: 13px');
    expect(html).toContain('font-weight: 400');
    expect(html).toContain('line-height: 1.35');
    expect(html).toContain('letter-spacing: 0.25px');
    expect(html).toContain('.total, .total strong { font-size: 15px; font-weight: 700; }');
  });

  it('exibe a taxa do cartão quando aplicada', () => {
    const html = buildReceiptHtml({
      ...sale,
      paymentMethod: 'cartao_credito',
      cardFeeAmount: 4.5,
      total: 94.5,
    });

    expect(html).toContain('Taxa do cartão (5%)');
    expect(html).toContain('4,50');
  });

  it('identifica celular pelo user agent', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' });
    expect(isMobileDevice()).toBe(true);
  });
});
