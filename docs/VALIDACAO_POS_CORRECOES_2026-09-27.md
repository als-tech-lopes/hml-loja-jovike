# Validação após correções — JKB Outfit

Data: 27/09/2026

## Parecer

**GO técnico condicionado à homologação manual autenticada e à configuração do ambiente de produção.**

Os bloqueadores técnicos P0 identificados na primeira revisão foram corrigidos no código e no banco local. A aplicação ainda deve passar pelo roteiro manual de aceite com usuários reais de cada perfil antes da abertura em produção.

## Correções realizadas

- RLS agora valida permissões de Produtos, Movimentações, Vendas e Relatórios no banco.
- Alteração direta de perfis e permissões privilegiadas foi restringida.
- `admin-users` impede que um administrador comum altere um `super_admin`, bloqueia autoexclusão/autodesativação e restringe CORS por `ALLOWED_ORIGINS`.
- Venda e movimentação de estoque agora são transações atômicas no PostgreSQL.
- Preço, variação, quantidade e disponibilidade da venda são validados no servidor.
- Estoque principal de produtos com variações é sincronizado automaticamente pela soma das variações.
- As três divergências de estoque foram reconciliadas; a consulta final retornou zero divergências.
- `.env` foi removido do índice do Git e substituído por `.env.example`; arquivos temporários locais do Supabase também foram ignorados.
- `xlsx` foi removido. A exportação passou para `exceljs`, carregado sob demanda e com neutralização de valores que poderiam virar fórmulas.
- Vite, Vitest, React Router e dependências transitivas foram atualizados.
- Suporte de cobertura do Vitest foi instalado.

## Evidências finais

| Verificação | Resultado |
|---|---|
| TypeScript (`tsc --noEmit`) | Aprovado |
| ESLint | 0 erros; 10 avisos não bloqueantes de Fast Refresh |
| Testes automatizados | 3/3 aprovados |
| Build de produção | Aprovado com Vite 7.3.6 |
| Auditoria npm completa | 0 vulnerabilidades |
| Lint do banco local | Nenhum erro de schema |
| Migrations locais | 27/27 aplicadas |
| Divergências produto × variações | 0 |
| Variações sem código | 0 |
| Teste RLS sem permissão | Aprovado; alteração afetou 0 linhas |
| Teste transacional de movimentação | Aprovado e revertido |
| Teste transacional de venda | Aprovado e revertido; nenhum dado de teste permaneceu |
| Edge Function `admin-users` | Compilou e respondeu 200 para origem local permitida, 403 para origem externa e 401 sem autenticação |
| Smoke test do build | Rotas públicas HTTP 200; rotas protegidas redirecionaram sem sessão; 0 erros de console |

## Alterações principais do banco

Migrations aplicadas localmente:

```text
supabase/migrations/20260927130000_harden_permissions_and_stock_transactions.sql
supabase/migrations/20260927140000_harden_profile_policies.sql
```

Ela ainda precisa ser aplicada no projeto remoto de produção com `supabase db push` depois de revisar o `--dry-run`.

## Pendências antes da abertura ao público

1. Executar manualmente, em homologação, cadastro/edição de produto, venda, cancelamento, movimentação, relatórios, exportação e administração de usuários.
2. Testar pelo menos um usuário comum com cada combinação de permissões.
3. Configurar `ALLOWED_ORIGINS` na Edge Function com o domínio real de produção.
4. Configurar no host as três variáveis `VITE_SUPABASE_*` usando o projeto de produção.
5. Revisar o histórico do Git. Como `.env` já esteve versionado, rotacionar qualquer chave que não seja exclusivamente pública.
6. Criar commit/tag da release e backup antes de aplicar as migrations remotamente.
7. Planejar otimização adicional do bundle. O JavaScript principal ficou em aproximadamente 1,43 MB e o módulo de Excel, carregado apenas na exportação, em aproximadamente 937 kB.

## Comandos finais para produção

```powershell
npx.cmd supabase link --project-ref <PROJECT_REF_PRODUCAO>
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
npx.cmd supabase secrets set ALLOWED_ORIGINS=https://seu-dominio.com
npx.cmd supabase functions deploy admin-users
npm.cmd ci
npm.cmd run lint
npx.cmd tsc -p tsconfig.app.json --noEmit
npm.cmd run test:coverage
npm.cmd run build
npm.cmd audit
```

Depois do deploy, repetir o roteiro manual no domínio definitivo antes de liberar os usuários.
