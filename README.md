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

## Desenvolvimento local

1. Instale Node.js 20 ou superior.
2. Crie um projeto no Supabase e execute, em ordem, as migrations em `supabase/migrations/` no SQL Editor.
3. Copie `.env.example` para `.env.local` e informe `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Cadastre uma conta em Supabase → Authentication → Users. O cadastro público não está habilitado no MVP.
5. Execute `npm install` e `npm run dev`.

As variáveis usadas no browser são somente URL e chave anon/publicável. **Nunca** exponha `service_role` no frontend ou no GitHub.

## Publicação

Conecte este repositório à Vercel, configure as duas variáveis públicas acima no projeto e publique. A URL do projeto será acessível em navegador. Use projeto Supabase de produção separado do ambiente de desenvolvimento, aplique as migrations versionadas e configure autenticação/recuperação de senha antes de convidar usuários.

## Segurança, documentos e backup

O bucket `trip-documents` é privado e limita o acesso ao prefixo do usuário autenticado; os arquivos são abertos por URL assinada de 60 segundos. RLS protege os dados no banco. Triggers validam que viagens, tarefas, trechos e documentos relacionados pertençam ao mesmo usuário. A chave `service_role` não é necessária na aplicação cliente. Para expandir a equipe, migre o escopo `owner_id` para organização/membros com papéis e políticas auditadas antes de compartilhar os dados.

Defina backups conforme o plano Supabase contratado e valide restaurações periodicamente. Backups do PostgreSQL não devem ser considerados backup dos objetos do Storage: planeje exportação/versionamento independente dos arquivos e retenção adequada. O limite do MVP é 20 MB por arquivo; revise quotas, disponibilidade de backups, retenção e preços nas páginas oficiais dos provedores antes de operar com documentos reais.

## Próximas etapas

1. Conectar o Supabase real, aplicar migrations e validar fluxo de autenticação e upload em ambiente de teste.
2. Integrar telas para múltiplos passageiros, trechos, check-ins, hotéis e transfers.
3. Acrescentar calendário operacional, filtros combinados, relatórios e histórico detalhado.
4. Introduzir organizações, convites de equipe, papéis, auditoria e controles LGPD antes do uso multiusuário.
