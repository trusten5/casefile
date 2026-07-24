-- Contacts used to call findOrCreateCompany for any free-typed company name,
-- which meant a contact at a company we don't track (or a typo) permanently
-- polluted the shared companies table/directory. Store the raw typed name
-- here instead when it doesn't match an existing tracked company, so it
-- stays scoped to the user's own contact instead of the shared database.
alter table contacts add column company_name_input text;
