-- Allow authenticated owners to delete their own document metadata.
-- Storage object deletion remains separately protected by the existing bucket policy.
create policy "Users delete their own documents"
  on public.documents
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));
