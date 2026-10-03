export interface ReceiptItem {
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  variantCode?: string | null;
  variantColor?: string | null;
  variantSize?: string | null;
}

export interface ReceiptSale {
  saleCode: string;
  clientName: string;
  clientPhone: string;
  paymentMethod: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  date: string;
  note: string;
  sellerName: string;
  items: ReceiptItem[];
}

const paymentLabels: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
};

const receiptFontScale = 1.5;
const receiptPdfFont = 'times';

const currency = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const itemDescription = (item: ReceiptItem) => {
  const variant = [item.variantColor, item.variantSize].filter(Boolean).join(' / ');
  const code = item.variantCode || item.productCode;
  return `${code} - ${item.productName}${variant ? ` (${variant})` : ''}`;
};

export const isMobileDevice = () => {
  const userAgent = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || window.matchMedia('(max-width: 767px)').matches;
};

export const buildReceiptHtml = (sale: ReceiptSale) => {
  const itemRows = sale.items.map(item => `
    <div class="item">
      <div class="item-description">${escapeHtml(itemDescription(item))}</div>
      <div class="row"><span>${item.quantity} x ${currency(item.unitPrice)}</span><strong>${currency(item.quantity * item.unitPrice)}</strong></div>
    </div>`).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Cupom ${escapeHtml(sale.saleCode)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    h1, p { margin: 0; }
    .center { text-align: center; }

    @media print {
      @page { size: 58mm auto; margin: 0; }
      html { width: 58mm; margin: 0 !important; padding: 0 !important; }
      body {
        width: 48mm;
        max-width: 48mm;
        margin: 0 auto !important;
        padding: 0 !important;
        color: #000;
        font-family: "Courier New", Courier, monospace;
        font-size: 14.5px;
        font-weight: 700;
        line-height: 1.2;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      h1 { font-size: 16px; font-weight: 900; text-align: center; }
      strong { font-weight: 700; }
      .divider { margin: 6px 0; border-top: 1px solid #000; }
      .row { display: flex; align-items: baseline; justify-content: space-between; gap: 4px; }
      .row > * { min-width: 0; }
      .row > :last-child { flex: none; white-space: nowrap; }
      .item { margin: 5px 0; }
      .item-description, .note, p { overflow-wrap: anywhere; word-break: break-word; }
      .total, .total strong { font-size: 15px; font-weight: 900; }
    }
  </style>
</head>
<body>
  <h1>JKB OUTFIT</h1>
  <p class="center">CUPOM DA VENDA</p>
  <div class="divider"></div>
  <p><strong>Venda:</strong> ${escapeHtml(sale.saleCode)}</p>
  <p><strong>Data:</strong> ${escapeHtml(new Date(sale.date).toLocaleString('pt-BR'))}</p>
  <p><strong>Cliente:</strong> ${escapeHtml(sale.clientName)}</p>
  ${sale.clientPhone ? `<p><strong>Telefone:</strong> ${escapeHtml(sale.clientPhone)}</p>` : ''}
  <p><strong>Pagamento:</strong> ${escapeHtml(paymentLabels[sale.paymentMethod] || sale.paymentMethod)}</p>
  <p><strong>Vendedor:</strong> ${escapeHtml(sale.sellerName)}</p>
  <div class="divider"></div>
  ${itemRows}
  <div class="divider"></div>
  <div class="row"><span>Subtotal</span><span>${currency(sale.subtotal)}</span></div>
  ${sale.discountAmount > 0 ? `<div class="row"><span>Desconto</span><span>- ${currency(sale.discountAmount)}</span></div>` : ''}
  <div class="row total"><strong>TOTAL</strong><strong>${currency(sale.total)}</strong></div>
  ${sale.note ? `<div class="divider"></div><p class="note"><strong>Observação:</strong> ${escapeHtml(sale.note)}</p>` : ''}
  <div class="divider"></div>
  <p class="center">'Avenida Dr. Délio Guaraná 391 A/ Agostinho Porto - São João de Meriti'</p>
  <p class="center">Obrigado pela preferência!</p>
</body>
</html>`;
};

const printReceipt = (sale: ReceiptSale) => new Promise<void>((resolve, reject) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.visibility = 'hidden';

  const removeFrame = () => window.setTimeout(() => frame.remove(), 1_000);
  frame.onload = () => {
    try {
      const printWindow = frame.contentWindow;
      if (!printWindow) throw new Error('Janela de impressão indisponível.');
      printWindow.onafterprint = removeFrame;
      printWindow.focus();
      printWindow.print();
      resolve();
      window.setTimeout(removeFrame, 60_000);
    } catch (error) {
      frame.remove();
      reject(error);
    }
  };
  frame.srcdoc = buildReceiptHtml(sale);
  document.body.appendChild(frame);
});

const downloadReceiptPdf = async (sale: ReceiptSale) => {
  const { jsPDF } = await import('jspdf');
  const estimatedHeight = Math.max(170, 125 + sale.items.length * 27 + (sale.note ? 27 : 0));
  const pdf = new jsPDF({ unit: 'mm', format: [80, estimatedHeight], orientation: 'portrait' });
  const left = 5;
  const right = 75;
  const width = right - left;
  let y = 8;

  const line = () => {
    pdf.setDrawColor(80);
    pdf.setLineDashPattern([1, 1], 0);
    pdf.line(left, y, right, y);
    y += 5;
  };
  const text = (value: string, size = 8) => {
    pdf.setFont(receiptPdfFont, 'bold');
    pdf.setFontSize(size * receiptFontScale);
    const lines = pdf.splitTextToSize(value, width) as string[];
    pdf.text(lines, left, y);
    y += lines.length * (size * receiptFontScale * 0.42) + 1;
  };
  const valueRow = (label: string, value: string, bold = false) => {
    pdf.setFont(receiptPdfFont, 'bold');
    pdf.setFontSize((bold ? 11 : 8) * receiptFontScale);
    pdf.text(label, left, y);
    pdf.text(value, right, y, { align: 'right' });
    y += bold ? 6 : 4;
  };

  pdf.setFont(receiptPdfFont, 'bold');
  pdf.setFontSize(15 * receiptFontScale);
  pdf.text('JKB OUTFIT', 40, y, { align: 'center' });
  y += 5;
  pdf.setFont(receiptPdfFont, 'bold');
  pdf.setFontSize(9 * receiptFontScale);
  pdf.text('CUPOM DA VENDA', 40, y, { align: 'center' });
  y += 5;
  line();
  text(`Venda: ${sale.saleCode}`);
  text(`Data: ${new Date(sale.date).toLocaleString('pt-BR')}`);
  text(`Cliente: ${sale.clientName}`);
  if (sale.clientPhone) text(`Telefone: ${sale.clientPhone}`);
  text(`Pagamento: ${paymentLabels[sale.paymentMethod] || sale.paymentMethod}`);
  text(`Vendedor: ${sale.sellerName}`);
  line();

  sale.items.forEach(item => {
    text(itemDescription(item), 8);
    valueRow(`${item.quantity} x ${currency(item.unitPrice)}`, currency(item.quantity * item.unitPrice));
    y += 2;
  });

  line();
  valueRow('Subtotal', currency(sale.subtotal));
  if (sale.discountAmount > 0) valueRow('Desconto', `- ${currency(sale.discountAmount)}`);
  valueRow('TOTAL', currency(sale.total), true);
  if (sale.note) {
    line();
    text(`Observação: ${sale.note}`);
  }
  line();
  pdf.setFont(receiptPdfFont, 'bold');
  pdf.setFontSize(8 * receiptFontScale);
  // pdf.text('Rua Delio guaraná 391 A/ Agostinho Porto - São João de Meriti', 40, y, { align: 'center' });
  pdf.text('Obrigado pela preferência!', 40, y, { align: 'center' });
  pdf.save(`cupom-${sale.saleCode.replace(/[^a-z0-9_-]/gi, '-')}.pdf`);
};

export const issueSaleReceipt = async (sale: ReceiptSale) => {
  if (isMobileDevice()) {
    await downloadReceiptPdf(sale);
    return 'pdf' as const;
  }

  await printReceipt(sale);
  return 'print' as const;
};
