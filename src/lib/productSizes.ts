export const STANDARD_PRODUCT_SIZES = ['P', 'M', 'G', 'GG'] as const;

const standardSizeOrder = new Map<string, number>(
  STANDARD_PRODUCT_SIZES.map((size, index) => [size, index]),
);

export function compareProductSizes(first: string, second: string) {
  const normalizedFirst = first.trim().toLocaleUpperCase('pt-BR');
  const normalizedSecond = second.trim().toLocaleUpperCase('pt-BR');
  const firstOrder = standardSizeOrder.get(normalizedFirst);
  const secondOrder = standardSizeOrder.get(normalizedSecond);

  if (firstOrder !== undefined || secondOrder !== undefined) {
    if (firstOrder === undefined) return 1;
    if (secondOrder === undefined) return -1;
    return firstOrder - secondOrder;
  }

  return normalizedFirst.localeCompare(normalizedSecond, 'pt-BR', { numeric: true });
}

export function orderProductSizes(sizes: string[]) {
  return [...sizes].sort(compareProductSizes);
}
