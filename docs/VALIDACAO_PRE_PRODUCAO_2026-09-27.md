# Validação pré-produção — JKB Outfit

Data da validação: 27/09/2026

## Parecer executivo

**Status: NO-GO — não publicar em produção antes de corrigir os bloqueadores P0.**

O projeto compila, passa na verificação de tipos, não possui erros de lint, as migrations locais estão aplicadas e o banco não apresenta erros de schema. Porém, ainda há riscos de autorização no banco e na função administrativa, vulnerabilidades conhecidas nas dependências, divergências de estoque e configuração local versionada. Também não existem dados transacionais nem testes automatizados suficientes para validar de ponta a ponta vendas, movimentações e relatórios.

## Resultado das verificações técnicas

| Verificação | Resultado | Observação |
|---|---|---|
| Build de produção | Aprovado | 3.825 módulos; bundle JS principal com aproximadamente 1,66 MB (493,55 kB gzip) |
| TypeScript | Aprovado | `tsc --noEmit` sem erros |
| ESLint | Aprovado com ressalvas | 0 erros e 10 avisos de `react-refresh/only-export-components` |
| Testes automatizados | Aprovado, mas insuficiente | 2 arquivos e somente 3 testes; não cobrem os fluxos críticos |
| Cobertura de testes | Não executada | Falta a dependência `@vitest/coverage-v8` |
| Migrations locais | Aprovado | 25 migrations aplicadas, inclusive as três migrations de códigos de variação |
| Lint do banco | Aprovado | `supabase db lint --local`: nenhum erro de schema |
| Códigos de variações | Aprovado | 156 variações com código; nenhuma sem código e nenhuma duplicada |
| Integridade do estoque | Reprovado | 3 produtos possuem divergência entre o total principal e a soma das variações |
| Auditoria de dependências | Reprovado | 14 vulnerabilidades: 12 altas, 1 moderada e 1 baixa; `xlsx` não possui correção automática disponível |
| Smoke test público | Aprovado | `/` e `/catalogo` responderam HTTP 200, sem erro de console |
| Proteção de rotas | Aprovado parcialmente | Rotas protegidas redirecionaram visitante sem sessão para `/` |
| Configuração de produção | Reprovado | `.env` versionado e apontando para `127.0.0.1`; não há configuração de deploy ou CI/CD |

## Validação por módulo

| Módulo | Estado | O que foi validado | O que ainda precisa ser validado manualmente |
|---|---|---|---|
| Login e autorização | Parcial | Build, tipos e redirecionamento sem sessão | Login real; recuperação de senha; cada perfil e permissão; bloqueio direto via API |
| Dashboard | Parcial | Compilação e rotas | Indicadores com vendas, estoque e períodos reais |
| Produtos | Parcial | Schema, migrations, 156 códigos únicos e compilação | Criar/editar/excluir produto; cadastrar cor mantendo foco; tamanhos; imagens; códigos e estoque |
| Movimentações | Parcial | Compilação e revisão de banco | Entrada, saída, ajuste, histórico e atualização da variação correta |
| Vendas | Parcial | Compilação, tela e código revisados | Venda real, seleção de cor/tamanho/código, desconto, pagamento, cancelamento e recomposição do estoque |
| Relatórios | Parcial | Compilação e estrutura revisadas | Consolidação por código principal, expansão por variação, filtros, totais e exportação |
| Catálogo público | Aprovado parcialmente | Página pública abriu sem erro | Imagens em ambiente remoto, filtros, disponibilidade e contato/WhatsApp |
| Administração do catálogo/offline | Parcial | Compilação | Publicação, ordenação, visibilidade, cache e funcionamento offline |
| Usuários e permissões | Reprovado em segurança | Fluxos e função administrativa revisados | Corrigir escalada de privilégio; testar admin, super_admin e usuários restritos |
| Configurações | Parcial | Compilação | Persistência e efeito de cada configuração |
| Plano/faturamento | Parcial | Compilação | Integração e comportamento real do provedor, se utilizado |
| Comissões | Parcial | Compilação | Cálculos com vendas reais, cancelamentos e filtros |
| Templates de plano | Parcial | Compilação | CRUD, permissões e aplicação dos templates |

## Bloqueadores P0

1. **RLS não reflete as permissões dos módulos.** Qualquer usuário autenticado pode inserir/alterar produtos e variações e inserir vendas/movimentações; em alguns objetos também pode excluir. A proteção atual da interface pode ser contornada por chamada direta à API. As policies devem validar perfil e permissão no banco.
2. **Função `admin-users` permite operações indevidas sobre contas privilegiadas.** Um `admin` comum pode alterar dados/senha ou ativar/desativar um `super_admin` em determinados caminhos. Toda ação deve validar a hierarquia do autor e do usuário-alvo.
3. **Dependências com vulnerabilidades.** Foram encontradas 14 vulnerabilidades, sendo 12 altas. Atualizar as dependências compatíveis, revisar quebras e decidir substituição/isolamento de `xlsx`, que não possui correção automática disponível.
4. **Divergência de estoque.** Corrigir e investigar os produtos abaixo antes da migração:
   - `PRD-00000601`: principal 396; variações 395; diferença +1.
   - `PRD-00000621`: principal 39; variações 37; diferença +2.
   - `PRD-00000641`: principal 38; variações 37; diferença +1.
5. **Configuração local no Git.** O arquivo `.env` está rastreado e contém URL local. Removê-lo do versionamento, revisar o histórico, manter somente `.env.example` sem segredos e configurar variáveis diretamente na hospedagem.
6. **Árvore de trabalho sem versão fechada.** Há muitas alterações e migrations não commitadas. Revisar o diff, separar o que será publicado, criar commit/tag de release e guardar um ponto claro de rollback.

## Riscos P1/P2

- Não existem vendas, itens de venda ou movimentações no banco local; portanto, não houve validação funcional de transações e relatórios com dados reais.
- Os 3 testes automatizados não cobrem autenticação, RLS, Produtos, Vendas, Movimentações, Relatórios ou Edge Functions.
- Não há pipeline CI/CD nem configuração explícita de hospedagem/SPA.
- O bundle principal é grande e deve ser dividido por rota quando possível.
- Atualizar os dados do Browserslist e eliminar os 10 avisos de lint.
- Restringir o CORS da Edge Function ao domínio de produção.

## Plano de correção e nova validação

1. Corrigir RLS e a autorização de `admin-users`; criar testes SQL/API para usuários com e sem permissão.
2. Corrigir as divergências de estoque e incluir uma verificação automática que compare produto principal com suas variações.
3. Atualizar dependências e repetir `npm audit --omit=dev`, build e testes.
4. Remover `.env` do Git e cadastrar variáveis separadas para local, homologação e produção.
5. Criar massa de homologação e executar os casos críticos descritos abaixo.
6. Só então criar a release e aplicar as migrations no projeto Supabase de produção.

## Casos mínimos de aceite antes do go-live

- Usuário sem permissão não consegue modificar o módulo nem pela tela nem por requisição direta à API.
- Cadastro de cor preserva foco e texto durante a digitação e só salva com Enter/Adicionar/confirmação.
- Cada combinação de cor e tamanho recebe código único e permanece ligada ao produto principal.
- A venda mostra o código principal em destaque e o código da variação correspondente à cor/tamanho.
- Venda reduz exatamente o estoque da variação; cancelamento devolve exatamente a mesma quantidade.
- Estoque total do produto sempre equivale à soma das variações.
- Relatórios consolidam pelo código principal e detalham os subcódigos sem diferença de totais.
- Imagens aparecem em Produtos, Venda e Catálogo usando URLs do Storage de produção.
- Exportações abrem corretamente e não permitem fórmula maliciosa em planilhas.
- Backup e rollback são testados antes da abertura aos usuários.

## Roteiro de publicação

### 1. Preparar a release

Execute e arquive os resultados:

```powershell
npm.cmd ci
npm.cmd run lint
npx.cmd tsc -p tsconfig.app.json --noEmit
npm.cmd run test -- --run
npm.cmd run build
npm.cmd audit --omit=dev
```

O build aprovado gera a pasta `dist`. O comando `vite preview` serve apenas para validação local, não como servidor de produção.

### 2. Criar e proteger o Supabase de produção

- Criar um projeto separado de produção na região adequada.
- Configurar MFA das contas administrativas, Auth URLs, SMTP próprio, confirmação de e-mail, backups/PITR conforme o plano, SSL e restrição de rede quando aplicável.
- Revisar Security Advisor e Performance Advisor.
- Confirmar bucket `products`, policies de Storage e limites de arquivo.
- Não expor `service_role` no front-end.

### 3. Aplicar somente o schema/migrations

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref <PROJECT_REF_PRODUCAO>
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
npx.cmd supabase functions deploy admin-users
```

Primeiro revisar o `--dry-run`. O `db push` aplica migrations; ele não transfere automaticamente todos os registros locais nem os arquivos do Storage.

### 4. Decidir sobre os dados locais

Há hoje 23 produtos e 156 variações no banco local. Se eles devem ir para produção, preparar uma migração controlada de dados depois de corrigir o estoque. Tratar separadamente:

- tabelas públicas e suas sequências/relacionamentos;
- usuários do schema `auth`;
- arquivos do bucket de imagens;
- URLs de imagens que ainda apontem para o host local.

Não executar importação cega sobre um banco de produção já utilizado. Gerar backup, ensaiar a restauração em homologação e comparar contagens e totais.

### 5. Publicar o front-end

Na Vercel, Netlify ou hospedagem estática equivalente, configurar:

```text
VITE_SUPABASE_URL=https://<PROJECT_REF_PRODUCAO>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<CHAVE_PUBLICAVEL_OU_ANON>
VITE_SUPABASE_PROJECT_ID=<PROJECT_REF_PRODUCAO>
```

Configurar `npm ci && npm run build`, diretório de saída `dist` e fallback de SPA para `index.html`. Nunca usar a chave `service_role` em variável `VITE_*`.

### 6. Pós-deploy e liberação

Executar todos os casos mínimos de aceite no domínio final, verificar logs do front-end/Supabase, confirmar e-mails, imagens e Edge Function. Liberar usuários somente após resultado aprovado e manter o deploy anterior e o backup como rollback.

## Critério de GO

A publicação pode ser aprovada quando todos os P0 estiverem resolvidos, `npm audit` não tiver vulnerabilidade alta explorável, os casos críticos forem executados em homologação, as políticas RLS forem testadas por perfil, o estoque estiver reconciliado e houver backup/rollback validado.
