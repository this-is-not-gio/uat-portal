-- The client can reject an issued sign-off (0047). Its own migration: a new enum value can't be
-- used in the transaction that adds it.
alter type public.suite_status add value if not exists 'sign_off_rejected' after 'sign_off_issued';
