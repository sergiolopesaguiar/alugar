# Sistema Alugar

Sistema de gestão para locadora de veículos: controle de clientes, veículos, condutores, contratos, manutenção, atividades, faturamento e financeiro, com autenticação e permissões por usuário.

Aplicação publicada em: https://sergiolopesaguiar.github.io/alugar/

## Visão geral

- Frontend estático (HTML, CSS, JavaScript puro) com Bootstrap 5, sem build/framework.
- Backend em Supabase (Postgres + RPCs + Edge Functions).
- Hospedagem via GitHub Pages, publicada diretamente a partir da branch `main`.
- Documentos de condutores (CNH, Termo de Responsabilidade) são armazenados no próprio repositório GitHub, via uma Edge Function segura, em vez do Supabase Storage.

## Funcionalidades principais

### Dashboard
Tela inicial exibida logo após o login, com resumo das atividades (total, pendentes, concluídas, atrasadas) e uma lista somente leitura das atividades mais recentes.

### Cadastros
- **Atividades** — tarefas ligadas a veículo/condutor, com data prevista e status (Pendente/Concluída).
- **Clientes** — dados cadastrais com preenchimento automático de endereço (CEP via ViaCEP) e dados da Receita Federal (CNPJ via BrasilAPI), incluindo razão social, sócios (QSA), CNAE e natureza jurídica.
- **Condutor** — motoristas vinculados a veículos, com controle de documentos obrigatórios (CNH e Termo de Responsabilidade) e indicação visual de pendências.
- **Contratos** — vínculo entre cliente e um ou mais veículos, com vigência e valor, bloqueando veículos já em contrato ativo.
- **Fornecedor** — cadastro com preenchimento automático via CNPJ (BrasilAPI).
- **Veículos** — dados do veículo (placa, FIPE, documentação, status), incluindo registro de venda quando aplicável.

### Manutenção
Controle de veículos em manutenção, com entrada/saída, oficina responsável e quilometragem.

### Relatórios
- Inventário de Veículos
- Veículos
- Faturamento (com filtro por cliente)

### Financeiro
- **Faturamento** — geração mensal a partir dos contratos ativos.
- **Conta Contábil** — plano de contas simples.
- **Contas a Pagar** — lançamentos com geração automática de parcelas mensais (com pré-visualização antes de confirmar) quando o valor total é maior que o valor da parcela.

### Administração
- **Usuários** — cadastro de logins do sistema (autenticação própria, não usa Supabase Auth).
- **Permissões** — liberação/bloqueio de acesso por usuário e por rotina do sistema.

## Tecnologias

- HTML5, CSS3, JavaScript (ES6+), Bootstrap 5.3, Bootstrap Icons
- Supabase: banco Postgres, funções RPC, Edge Functions (Deno), Row Level Security
- APIs públicas integradas: ViaCEP (endereço por CEP) e BrasilAPI (dados de CNPJ)
- GitHub Pages (hospedagem) e GitHub Contents API (armazenamento de documentos)

## Estrutura do projeto

Cada tela do sistema é um arquivo HTML independente (sem roteador single-page), com seu respectivo arquivo `.js`:

```
index.html            Dashboard (tela inicial)
clientes.html          Clientes
atividades.html        Atividades
condutor.html          Condutor
contratos.html         Contratos
fornecedor.html        Fornecedor
veiculos.html          Veículos
manutencao.html        Manutenção
relatorio-*.html       Relatórios
faturamento.html       Faturamento
conta-contabil.html    Conta Contábil
contas-pagar.html      Contas a Pagar
usuarios.html          Usuários (admin)
permissoes.html        Permissões (admin)
auth.js                Login, logout e controle de sessão (compartilhado)
style.css              Estilos compartilhados
```

## Autenticação e permissões

O login usa uma tabela própria (`usuarios`) e funções RPC no Postgres (`login_usuario`), não o Supabase Auth — a sessão é controlada via `localStorage` no navegador. O acesso a cada rotina pode ser liberado ou negado individualmente por usuário na tela **Permissões**; usuários marcados como administradores têm acesso extra às telas de Usuários e Permissões.

## Deploy

O site é publicado diretamente no GitHub Pages a partir da branch `main` — qualquer alteração enviada ao repositório gera automaticamente um novo build (`pages-build-and-deployment`), sem etapas manuais de build.
