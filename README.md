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
- Calendário operacional, histórico e filtros serão desenvolvidos nas próximas entregas.

## Supabase e login

1. No Supabase, confirme que o usuário existe em **Authentication → Users** e que o e-mail está confirmado. Se criou o usuário por convite, use o link de convite/definição de senha; se já definiu a senha, entre com exatamente esse e-mail e senha. O aplicativo não usa código TOTP do Authenticator como senha.
2. No Netlify, configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` usando a URL e a chave publicável do **mesmo projeto**.
3. Em **Authentication → URL Configuration**, defina `https://SEU-SITE.netlify.app` como Site URL e inclua `https://SEU-SITE.netlify.app/redefinir-senha` nos Redirect URLs permitidos. Substitua pelo domínio real.
4. O link **Esqueci minha senha** abre `/recuperar-senha`. O e-mail do Supabase encaminha para `/redefinir-senha`. Para entrega confiável em produção, configure SMTP próprio em **Authentication → SMTP Settings** e confira spam/limites de envio.
5. Se o site ainda aparecer sem estilo, confirme que o deploy foi feito a partir da branch `feat/concierge-travel-mvp`, execute **Clear cache and deploy site** no Netlify e verifique que `src/app/layout.tsx` importa `globals.css`. O layout inclui estilos críticos inline para que a tela de acesso continue legível mesmo se o CSS compilado não carregar.

## Deploy no Netlify

O arquivo `netlify.toml` configura o build Next.js e o plugin oficial do Netlify. Conecte o repositório, publique a branch `feat/concierge-travel-mvp` para teste e configure as variáveis de ambiente em Site configuration. Faça um deploy novo após alterar variáveis.

## Segurança e arquivos

O bucket `trip-documents` é privado, limitado ao prefixo do usuário, e os arquivos são abertos por URL assinada curta. RLS protege os dados no banco. Nunca coloque a chave `service_role` no frontend ou em variável `NEXT_PUBLIC_*`; a chave publicável é apropriada no navegador quando as políticas RLS estão corretas. Backups PostgreSQL não substituem backup dos objetos Storage.

## Desenvolvimento local

1. Use Node.js 20 ou superior.
2. Execute em ordem as migrations em `supabase/migrations/` no SQL Editor.
3. Configure `.env.local` com as variáveis Supabase publicáveis.
4. Cadastre o usuário no Supabase Authentication e execute `npm install` e `npm run dev`.
