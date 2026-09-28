-- Iteration lifecycle: not_started (planned, snapshot taken, no results yet) -> in_progress -> completed | stopped.
-- Separate migration: new enum values can't be used in the transaction that adds them (0009 uses them).
alter type public.iteration_status add value if not exists 'not_started' before 'in_progress';
alter type public.iteration_status add value if not exists 'stopped';
