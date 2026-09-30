-- Two-step sign-off: the vendor issues it (sign_off_issued), the client acknowledges it (signed_off).
-- Own migration because a new enum value can't be used in the transaction that adds it (0026 uses it).
alter type public.suite_status add value if not exists 'sign_off_issued' before 'signed_off';
