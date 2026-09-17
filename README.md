# HML - LOJA JOVIKE

Crie um sistema SaaS de controle de estoque moderno, simples e intuitivo (lovable), com foco em pequenos negócios como lojas de joias e semijoias.

🎯 OBJETIVO:

O sistema deve permitir controle rápido de estoque, com interface limpa e poucas etapas. O usuário deve conseguir realizar ações em poucos cliques.

👤 AUTENTICAÇÃO E USUÁRIOS:

- Tela de login

- Cadastro de usuários

- Campos: nome, email, senha

👥 TIPOS DE USUÁRIO:

- Admin

- Usuário comum

🔐 CONTROLE DE ACESSO (RBAC):

- O Admin pode:

  - Acessar todos os módulos

  - Criar, editar e excluir usuários

  - Definir permissões para usuários comuns

- O Usuário comum:

  - Só pode acessar os módulos liberados pelo Admin

🧩 PERMISSÕES POR MÓDULO:

O Admin pode ativar/desativar acesso a:

- Dashboard

- Produtos

- Movimentações

- Relatórios (se existir)

💡 Criar uma tela de gerenciamento de permissões:

- Lista de usuários

- Para cada usuário:

  - Checkbox ou toggle para cada módulo

  - Exemplo:

    [x] Dashboard

    [ ] Produtos

    [x] Movimentações

📊 DASHBOARD:

- Total de produtos

- Produtos com estoque baixo

- Valor total em estoque

- Lista de produtos com estoque baixo

- Ações rápidas:

  - Adicionar produto

  - Dar baixa no estoque

  - Buscar produto

📦 PRODUTOS:

- Listagem com nome, quantidade, preço

- Campo de busca

- Botão "Novo produto"

➕ CADASTRO DE PRODUTO:

- Nome, quantidade, preço (obrigatórios)

- Categoria e descrição (opcional)

🔄 MOVIMENTAÇÃO:

- Entrada e saída de estoque

- Atualização automática

📈 HISTÓRICO:

- Lista de movimentações com data

🔔 ALERTAS:

- Produtos com estoque baixo

🎨 UI/UX:

- Interface moderna

- Responsiva

- Simples e rápida

- Navegação clara (sidebar)

⚙️ TÉCNICO:

- Gerar front-end em React

- Criar estrutura preparada para integração com API externa

- Organizar estados de autenticação e permissões

💡 IMPORTANTE:

- O sistema deve esconder módulos que o usuário não tem acesso

- O Admin deve ter uma experiência simples para gerenciar permissões

- Priorizar facilidade de uso e poucos cliques

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/af006377-b24f-4f06-a104-693e4d3a3568).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
