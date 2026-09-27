# Proposta técnica — código identificador de produtos

## 1. Objetivo e escopo

Incluir um código público, curto, legível e exclusivo para cada produto, utilizável no cadastro, busca, estoque, venda, pós-venda e cupom fiscal.

Esta entrega é apenas uma proposta para aprovação. O script abaixo **não foi executado**, nenhuma migration foi criada/aplicada e nenhum objeto do banco de produção foi alterado.

## 2. Diagnóstico do sistema atual

- O front-end é React/TypeScript e persiste os dados diretamente no Supabase/PostgreSQL.
- `products.id` já identifica tecnicamente o produto por UUID, mas não é adequado para uso operacional por vendedores e clientes.
- A tela de Produtos busca somente por nome e categoria.
- Vendas e movimentações guardam `product_id` e uma cópia do nome. Não guardam um código público do produto.
- Catálogos, relatórios e seletores exibem o nome, sem código.
- Não foi encontrado no repositório um módulo, provedor ou fluxo de emissão de cupom fiscal. Portanto, a impressão do código no cupom depende da identificação do equipamento, sistema ou API usado pelo cliente.

## 3. Solução recomendada

### Formato

Usar o formato `PRD-00000001`, gerado exclusivamente pelo PostgreSQL por uma sequence.

Motivos:

- legível e fácil de ditar ou digitar;
- não deriva de nome, modelo ou categoria;
- seguro contra cadastros simultâneos;
- unicidade garantida pelo banco, e não apenas pela interface;
- capacidade de 99.999.999 produtos com oito dígitos, podendo crescer sem quebra de compatibilidade.

O código é um identificador interno. Ele não substitui GTIN/EAN/NCM/cEAN ou qualquer outro campo fiscal.

### Persistência

- `products.product_code`: fonte oficial do código, imutável e com restrição `UNIQUE NOT NULL`.
- `sale_items.product_code`: fotografia do código no momento da venda, para histórico, pós-venda e impressão/reimpressão do cupom.
- `movements.product_code`: fotografia do código na movimentação, para auditoria e consulta operacional.
- Trigger de geração no banco: cobre qualquer origem de cadastro, inclusive futuras integrações, e elimina colisões por concorrência.
- Triggers de preenchimento dos snapshots: evitam depender de cada cliente ou tela para propagar o código.

## 4. Alterações de aplicação propostas

1. Tipos e contexto de estoque
   - adicionar `productCode` ao tipo `Product` e aos mapeamentos Supabase;
   - expor o código como somente leitura; não permitir edição manual.

2. Cadastro e consulta de produtos
   - informar no formulário que o código será criado ao salvar;
   - mostrar o código na listagem e no detalhe;
   - pesquisar por correspondência exata ou parcial, sem diferenciar maiúsculas/minúsculas;
   - após salvar, mostrar confirmação com o código retornado pelo banco.

3. Vendas e pós-venda
   - mostrar `código — nome` no seletor, carrinho e detalhe da venda;
   - permitir localizar vendas por código do item;
   - persistir e ler o snapshot em `sale_items`.

4. Estoque, catálogos e relatórios
   - mostrar o código em movimentações e seletores de produto;
   - incluir código nos filtros e nas exportações XLSX;
   - decidir com o cliente se o código também ficará público nos catálogos e mensagens do WhatsApp. Por padrão, recomenda-se exibi-lo para facilitar o atendimento.

5. Cupom fiscal
   - mapear `sale_items.product_code` para o campo de código/referência do item aceito pelo emissor, equipamento ou API;
   - manter GTIN/EAN em campo próprio quando aplicável; não enviar `PRD-...` como GTIN;
   - validar tamanho, caracteres e layout com o fornecedor do cupom antes de homologar;
   - testar impressão, cancelamento e reimpressão em homologação.

6. Tipos gerados
   - após a aplicação autorizada da migration, regenerar `src/integrations/supabase/types.ts` a partir do schema, evitando alterações manuais divergentes.

## 5. Script proposto para aprovação

O script foi desenhado para PostgreSQL/Supabase, é idempotente nos objetos principais e faz o preenchimento dos registros existentes. Deve primeiro ser validado em clone/homologação com volume semelhante ao de produção.

```sql
BEGIN;

-- Evita concorrência com novos cadastros durante geração e backfill.
LOCK TABLE public.products IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.sale_items IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.movements IN SHARE ROW EXCLUSIVE MODE;

CREATE SEQUENCE IF NOT EXISTS public.product_code_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 20;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_code text;

CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'PRD-' || lpad(nextval('public.product_code_seq')::text, 8, '0')
$$;

ALTER TABLE public.products
  ALTER COLUMN product_code SET DEFAULT public.generate_product_code();

WITH missing AS (
  SELECT id, public.generate_product_code() AS generated_code
  FROM public.products
  WHERE product_code IS NULL
  ORDER BY created_at, id
)
UPDATE public.products AS p
SET product_code = missing.generated_code
FROM missing
WHERE p.id = missing.id;

ALTER TABLE public.products
  ALTER COLUMN product_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_product_code_uidx
  ON public.products (product_code);

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS product_code text;

ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS product_code text;

UPDATE public.sale_items AS si
SET product_code = p.product_code
FROM public.products AS p
WHERE si.product_id = p.id
  AND si.product_code IS NULL;

UPDATE public.movements AS m
SET product_code = p.product_code
FROM public.products AS p
WHERE m.product_id = p.id
  AND m.product_code IS NULL;

ALTER TABLE public.sale_items
  ALTER COLUMN product_code SET NOT NULL;

ALTER TABLE public.movements
  ALTER COLUMN product_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS sale_items_product_code_idx
  ON public.sale_items (product_code);

CREATE INDEX IF NOT EXISTS movements_product_code_idx
  ON public.movements (product_code);

CREATE OR REPLACE FUNCTION public.set_product_code_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT p.product_code
    INTO NEW.product_code
  FROM public.products AS p
  WHERE p.id = NEW.product_id;

  IF NEW.product_code IS NULL THEN
    RAISE EXCEPTION 'Código não encontrado para o produto %', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_sale_item_product_code ON public.sale_items;
CREATE TRIGGER set_sale_item_product_code
  BEFORE INSERT OR UPDATE OF product_id ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.set_product_code_snapshot();

DROP TRIGGER IF EXISTS set_movement_product_code ON public.movements;
CREATE TRIGGER set_movement_product_code
  BEFORE INSERT OR UPDATE OF product_id ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.set_product_code_snapshot();

CREATE OR REPLACE FUNCTION public.prevent_product_code_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_code IS DISTINCT FROM OLD.product_code THEN
    RAISE EXCEPTION 'O código do produto é imutável';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_product_code_change ON public.products;
CREATE TRIGGER prevent_product_code_change
  BEFORE UPDATE OF product_code ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.prevent_product_code_change();

COMMIT;
```

### Validações pós-execução

Executar como consultas de conferência, sem alterar dados:

```sql
SELECT count(*) AS products_without_code
FROM public.products
WHERE product_code IS NULL;

SELECT product_code, count(*)
FROM public.products
GROUP BY product_code
HAVING count(*) > 1;

SELECT count(*) AS sale_items_without_code
FROM public.sale_items
WHERE product_code IS NULL;

SELECT count(*) AS movements_without_code
FROM public.movements
WHERE product_code IS NULL;
```

Todos os resultados de ausência/duplicidade devem ser zero.

## 6. Impacto esperado

### Dados existentes

- Todos os produtos atuais receberão um código novo, seguindo a ordenação por `created_at` e `id` apenas para tornar o backfill previsível.
- Itens de venda e movimentações existentes receberão o mesmo código do produto relacionado.
- Nenhum nome, preço, saldo ou UUID será alterado.
- A numeração pode ter lacunas por rollback de transação ou tentativas de cadastro; isso é esperado e não afeta unicidade.

### Desempenho e bloqueios

- As atualizações percorrem `products`, `sale_items` e `movements` uma vez.
- A criação dos índices e os `LOCK TABLE` bloqueiam gravações nessas tabelas durante a transação.
- Leituras normalmente continuam disponíveis, mas cadastro, venda e movimentação devem ficar temporariamente suspensos.
- Com o volume ainda não aferido, a estimativa prudente é uma janela de manutenção de 5 a 15 minutos. A duração real deve ser medida primeiro em homologação. Para tabelas muito grandes, o plano deve mudar para implantação em fases e índices `CONCURRENTLY`.

### Segurança e consistência

- A sequence mais o índice único garantem ausência de duplicidade mesmo sob concorrência.
- O código não contém dados pessoais nem informações comerciais sensíveis.
- A imutabilidade preserva referências de pós-venda e cupons já emitidos.

## 7. Backup e reversão

### Antes da execução

1. Confirmar backup/PITR válido do projeto Supabase e registrar o ponto de restauração.
2. Exportar, no mínimo, schema e dados de `products`, `sale_items` e `movements`.
3. Registrar contagens das três tabelas e testar a restauração em ambiente isolado.
4. Bloquear temporariamente cadastros, vendas e movimentações na aplicação.
5. Aplicar primeiro em homologação e comparar contagens, duplicidades e amostras de histórico.

### Rollback imediato

Se houver erro antes do `COMMIT`, executar `ROLLBACK`; a transação desfará as alterações. Se o problema surgir depois do commit e antes de liberar a nova aplicação, usar o script abaixo.

```sql
BEGIN;

DROP TRIGGER IF EXISTS prevent_product_code_change ON public.products;
DROP TRIGGER IF EXISTS set_sale_item_product_code ON public.sale_items;
DROP TRIGGER IF EXISTS set_movement_product_code ON public.movements;

DROP FUNCTION IF EXISTS public.prevent_product_code_change();
DROP FUNCTION IF EXISTS public.set_product_code_snapshot();

DROP INDEX IF EXISTS public.movements_product_code_idx;
DROP INDEX IF EXISTS public.sale_items_product_code_idx;
DROP INDEX IF EXISTS public.products_product_code_uidx;

ALTER TABLE public.movements DROP COLUMN IF EXISTS product_code;
ALTER TABLE public.sale_items DROP COLUMN IF EXISTS product_code;
ALTER TABLE public.products DROP COLUMN IF EXISTS product_code;

DROP FUNCTION IF EXISTS public.generate_product_code();
DROP SEQUENCE IF EXISTS public.product_code_seq;

COMMIT;
```

Depois de a aplicação ou documentos fiscais dependerem do código, não se recomenda remover os campos. Nesse cenário, a reversão correta é restaurar a versão anterior da aplicação mantendo os dados, corrigir o defeito e publicar novamente. Restauração PITR deve ser o último recurso, pois também desfaz vendas ocorridas após o ponto restaurado.

## 8. Plano de implantação

1. Aprovar formato, prefixo, visibilidade em catálogo e provedor fiscal.
2. Criar clone/homologação e obter contagens/volume das tabelas.
3. Testar script, tempo de bloqueio, backup e rollback em homologação.
4. Implementar aplicação e testes automatizados contra o schema homologado.
5. Homologar com vendedores e responsável pelo cupom fiscal.
6. Agendar janela, congelar gravações e efetuar backup validado.
7. Aplicar migration autorizada, executar consultas de conferência e publicar a aplicação.
8. Fazer teste de fumaça: produto, busca, venda, movimentação, relatório e cupom no ambiente de homologação.
9. Monitorar erros e duplicidades após a liberação.

## 9. Critérios de aceite

- Dois ou mais cadastros simultâneos recebem códigos diferentes.
- Produtos antigos e novos possuem código no formato aprovado.
- Código não pode ser alterado pela interface nem diretamente por uma atualização comum.
- Busca localiza pelo código completo e por fragmento, além de nome/categoria.
- Vendedor vê o código na listagem, seleção e detalhe de venda.
- Venda e movimentação mantêm o snapshot do código correto.
- Exportações incluem o código.
- O cupom emitido apresenta o código no campo homologado sem substituir GTIN/EAN.
- Cancelamentos e reimpressões preservam o código original.
- Testes de permissão/RLS continuam aprovados.

## 10. Pendências para decisão do cliente

- Confirmar o prefixo (`PRD`) e a quantidade inicial de dígitos.
- Confirmar se o código será exibido nos catálogos público/offline e no WhatsApp.
- Informar qual equipamento, sistema ou API produz o cupom fiscal e fornecer documentação ou acesso de homologação.
- Informar o volume atual de produtos, itens de venda e movimentações para refinar a janela.
- Dar aprovação explícita e separada para aplicar a migration em homologação e, posteriormente, em produção.
