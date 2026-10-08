-- The suite while the vendor drafts its sign-off report (Create draft → Issue). Its own migration:
-- a new enum value can't be used in the transaction that adds it.
alter type public.suite_status add value if not exists 'for_sign_off' after 'in_testing';
