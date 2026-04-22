-- Habilitar Realtime para a tabela de pedidos
begin;
  -- remove the table from the publication if it's already there
  alter publication supabase_realtime replica identity full;
  alter publication supabase_realtime add table public.orders;
commit;
