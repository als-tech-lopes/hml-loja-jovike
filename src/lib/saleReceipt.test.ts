import { describe, expect, it } from 'vitest';
import { buildReceiptHtml, isMobileDevice, type ReceiptSale } from './saleReceipt';

const sale: ReceiptSale = {
  saleCode: 'VEN-123', clientName: '<Cliente & Filhos>', clientPhone: '11999999999',
  paymentMethod: 'pix', subtotal: 100, discountAmount: 10, total: 90,
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
  });

  it('identifica celular pelo user agent', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' });
    expect(isMobileDevice()).toBe(true);
  });
});
