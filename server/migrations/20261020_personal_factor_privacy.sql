-- Apply before deploying the updated server and client, during a coordinated release.
-- Add explicit answer states; NULL means historical metadata is unavailable.
-- Do NOT backfill: old impact=1 could mean No OR Yes/slight impact.
-- No historical answers, attempts, recommendations, or narratives are rewritten.
ALTER TABLE PROFILE ADD COLUMN personal_factor_answers JSON DEFAULT NULL;
-- NULL now means personal factors were excluded, rather than a fabricated score.
ALTER TABLE RECOMMENDATION_ITEM MODIFY COLUMN personal_factor_match DECIMAL(5,4) NULL;
