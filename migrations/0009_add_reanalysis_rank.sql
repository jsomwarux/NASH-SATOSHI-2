-- Add rank column to reanalysis_queue table
-- This preserves the leaderboard ordering when processing the queue

ALTER TABLE reanalysis_queue ADD COLUMN IF NOT EXISTS rank integer;

-- Update existing pending items to have a rank based on their current order
-- This is a one-time fix for items already in the queue
UPDATE reanalysis_queue
SET rank = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY batch_id ORDER BY created_at) as row_num
  FROM reanalysis_queue
  WHERE status = 'pending'
) AS subquery
WHERE reanalysis_queue.id = subquery.id AND reanalysis_queue.rank IS NULL;
