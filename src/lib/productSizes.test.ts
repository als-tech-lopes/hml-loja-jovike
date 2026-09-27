import { describe, expect, it } from 'vitest';
import { orderProductSizes } from './productSizes';

describe('orderProductSizes', () => {
  it('mantém os tamanhos padrão na ordem apresentada no cadastro', () => {
    expect(orderProductSizes(['GG', 'P', 'G', 'M'])).toEqual(['P', 'M', 'G', 'GG']);
  });

  it('posiciona tamanhos personalizados depois dos padrões em ordem natural', () => {
    expect(orderProductSizes(['42', 'G', '38', 'P', 'XG'])).toEqual(['P', 'G', '38', '42', 'XG']);
  });
});
