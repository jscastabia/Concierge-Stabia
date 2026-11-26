# Concierge Stabia

Aplicação web para organizar viagens corporativas, tarefas e documentos da operação de concierge. Interface em português brasileiro, com Next.js/TypeScript, Supabase Auth, PostgreSQL e Storage privado.

## Funcionalidades iniciais

- Login com e-mail e senha pelo Supabase Auth.
- Painel com resumo operacional, agenda de hoje, tarefas vencidas e quadro Kanban.
- Cadastro de viagens e tarefas persistidos no PostgreSQL.
- Etapas da viagem independentes do status das tarefas.
- Detalhes da viagem com anexos privados vinculados à viagem ou a uma tarefa.
- Upload de PDF, JPG, PNG, WebP e documentos Office; limite inicial de 20 MB por arquivo.
- Links assinados de curta duração para abrir arquivos privados.
- Políticas RLS para isolar os registros pelo usuário autenticado.
- Esquema versionado para trechos, check-ins, cartões de embarque, hotéis e transfers.

## Supabase

1. Crie ou selecione o projeto Supabase.
2. No **SQL Editor**, execute em ordem todos os arquivos de `supabase/migrations/`.
3. Em **Authentication → Users**, crie o usuário que poderá entrar. O cadastro público não está habilitado no MVP.
4. Copie a Project URL e a chave publicável (anon) nas variáveis de ambiente da hospedagem:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

As variáveis do navegador são públicas por natureza; a segurança depende das políticas RLS e do bucket privado. Nunca coloque a chave `service_role` no frontend, em variáveis `NEXT_PUBLIC_*` ou no GitHub.

## Publicação no Netlify

O arquivo `netlify.toml` configura o comando de build e o plugin oficial do Next.js.

1. No Netlify, escolha **Add new site → Import an existing project** e conecte o GitHub.
2. Selecione o repositório `jscastabia/Concierge-Stabia` e a branch `feat/concierge-travel-mvp` para testar o MVP (ou a branch de produção após revisão/merge).
3. Em **Site configuration → Environment variables**, cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` para o contexto de deploy desejado.
4. Configure Node.js 20 ou superior, publique e acompanhe o log do deploy.
5. Abra a URL HTTPS gerada pelo Netlify e faça login com o usuário criado no Supabase.

Para login e redefinição de senha em produção, ajuste **Authentication → URL Configuration** no Supabase com a URL real do site Netlify e os redirect URLs permitidos. Não use URLs de preview como URL principal de produção.

## Desenvolvimento local

1. Instale Node.js 20 ou superior.
2. Copie `.env.example` para `.env.local` e informe a URL e a chave publicável do Supabase.
3. Execute `npm install` e `npm run dev`.

## Segurança, documentos e backup

O bucket `trip-documents` é privado e limita o acesso ao prefixo do usuário autenticado; os arquivos são abertos por URL assinada de 60 segundos. RLS protege os dados no banco. Triggers validam que viagens, tarefas, trechos e documentos relacionados pertençam ao mesmo usuário. A chave `service_role` não é necessária na aplicação cliente. Para expandir a equipe, migre o escopo `owner_id` para organização/membros com papéis e políticas auditadas antes de compartilhar os dados.

Defina backups conforme o plano Supabase contratado e valide restaurações periodicamente. Backups do PostgreSQL não devem ser considerados backup dos objetos do Storage: planeje exportação/versionamento independente dos arquivos e retenção adequada. O limite do MVP é 20 MB por arquivo; revise quotas, disponibilidade de backups, retenção e preços nas páginas oficiais dos provedores antes de operar com documentos reais.

## Próximas etapas

1. Configurar as variáveis de ambiente do Netlify e conferir se as migrations foram aplicadas no Supabase.
2. Validar login, cadastro de viagem/tarefa e upload/visualização de arquivo com usuário de teste.
3. Integrar telas para múltiplos passageiros, trechos, check-ins, hotéis e transfers.
4. Acrescentar calendário operacional, filtros combinados, relatórios e histórico detalhado.
5. Introduzir organizações, convites de equipe, papéis, auditoria e controles LGPD antes do uso multiusuário.
