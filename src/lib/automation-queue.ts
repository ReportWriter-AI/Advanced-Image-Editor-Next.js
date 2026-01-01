/**
 * Redis queue service for scheduled automation triggers
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const TRIGGER_QUEUE_KEY = 'automation:triggers:queue';
const TRIGGER_DATA_PREFIX = 'automation:trigger:data:';

export interface QueuedTrigger {
  inspectionId: string;
  triggerIndex: number; // Index in the inspection's triggers array
  executionTime: number; // Unix timestamp in milliseconds
  triggerKey: string; // Automation trigger key for logging
}

/**
 * Queues a trigger for execution at a specific time
 */
export async function queueTrigger(
  inspectionId: string,
  triggerIndex: number,
  executionTime: Date,
  triggerKey: string
): Promise<void> {
  const executionTimestamp = executionTime.getTime();

  const queuedTrigger: QueuedTrigger = {
    inspectionId,
    triggerIndex,
    executionTime: executionTimestamp,
    triggerKey,
  };

  // Store trigger data
  const dataKey = `${TRIGGER_DATA_PREFIX}${inspectionId}:${triggerIndex}`;
  await redis.set(dataKey, JSON.stringify(queuedTrigger), { ex: 60 * 60 * 24 * 30 }); // 30 days expiry

  // Add to sorted set (score = execution timestamp)
  await redis.zadd(TRIGGER_QUEUE_KEY, {
    score: executionTimestamp,
    member: `${inspectionId}:${triggerIndex}`,
  });

  console.log(
    `Queued trigger ${triggerKey} for inspection ${inspectionId} at ${executionTime.toISOString()}`
  );
}

/**
 * Removes a queued trigger
 */
export async function removeQueuedTrigger(
  inspectionId: string,
  triggerIndex: number
): Promise<void> {
  const member = `${inspectionId}:${triggerIndex}`;
  await redis.zrem(TRIGGER_QUEUE_KEY, member);

  const dataKey = `${TRIGGER_DATA_PREFIX}${inspectionId}:${triggerIndex}`;
  await redis.del(dataKey);
}

/**
 * Gets all triggers that are due for execution
 * Note: Execution times are stored as UTC timestamps, so we compare directly with UTC current time
 */
export async function getDueTriggers(currentTime: Date = new Date()): Promise<QueuedTrigger[]> {
  const currentTimestamp = currentTime.getTime();

  // Get all triggers with score <= currentTimestamp
  const members = await redis.zrange<string[]>(
    TRIGGER_QUEUE_KEY,
    0,
    currentTimestamp,
    { byScore: true }
  );

  if (!members || members.length === 0) {
    return [];
  }

  // Fetch trigger data for each member
  const triggers: QueuedTrigger[] = [];
  for (const member of members) {
    const dataKey = `${TRIGGER_DATA_PREFIX}${member}`;
    const data = await redis.get<string | QueuedTrigger>(dataKey);

    if (data) {
      try {
        // Handle both cases: data might be a string (needs parsing) or already an object
        const trigger: QueuedTrigger = typeof data === 'string' 
          ? JSON.parse(data) as QueuedTrigger
          : data as QueuedTrigger;
        triggers.push(trigger);
      } catch (error) {
        console.error(`Error parsing trigger data for ${member}:`, error);
      }
    }
  }

  return triggers;
}

/**
 * Removes processed triggers from the queue
 */
export async function removeProcessedTriggers(triggers: QueuedTrigger[]): Promise<void> {
  if (triggers.length === 0) return;

  const members = triggers.map((t) => `${t.inspectionId}:${t.triggerIndex}`);
  await redis.zrem(TRIGGER_QUEUE_KEY, ...members);

  // Also remove the data entries
  for (const trigger of triggers) {
    const dataKey = `${TRIGGER_DATA_PREFIX}${trigger.inspectionId}:${trigger.triggerIndex}`;
    await redis.del(dataKey);
  }
}

/**
 * Gets all queued triggers for a specific inspection
 * Returns only triggers that are scheduled for the future (not due yet)
 */
export async function getQueuedTriggersForInspection(
  inspectionId: string
): Promise<QueuedTrigger[]> {
  const currentTimestamp = Date.now();
  
  // Ensure inspectionId is a string for consistent comparison
  const inspectionIdStr = String(inspectionId);
  
  console.log(`[getQueuedTriggersForInspection] Fetching queued triggers for inspection: ${inspectionIdStr}`);

  // Get all members from the sorted set (we'll filter by inspectionId)
  // Use index-based retrieval (0 to -1 means all members)
  const allMembers = await redis.zrange<string[]>(
    TRIGGER_QUEUE_KEY,
    0,
    -1
  );

  console.log(`[getQueuedTriggersForInspection] Retrieved ${allMembers?.length || 0} total members from Redis`);

  if (!allMembers || allMembers.length === 0) {
    console.log(`[getQueuedTriggersForInspection] No members found in queue`);
    return [];
  }

  // Filter members that match this inspectionId
  const matchingMembers = allMembers.filter((member) => {
    const [memberInspectionId] = member.split(':');
    return memberInspectionId === inspectionIdStr;
  });

  console.log(`[getQueuedTriggersForInspection] Found ${matchingMembers.length} matching members for inspection ${inspectionIdStr}`);

  if (matchingMembers.length === 0) {
    return [];
  }

  // Fetch trigger data for each matching member
  const triggers: QueuedTrigger[] = [];
  for (const member of matchingMembers) {
    const dataKey = `${TRIGGER_DATA_PREFIX}${member}`;
    try {
      const data = await redis.get<string | QueuedTrigger>(dataKey);

      if (data) {
        try {
          // Handle both cases: data might be a string (needs parsing) or already an object
          const trigger: QueuedTrigger = typeof data === 'string' 
            ? JSON.parse(data) as QueuedTrigger
            : data as QueuedTrigger;
          
          // Only include triggers that are in the future (not due yet)
          if (trigger.executionTime > currentTimestamp) {
            triggers.push(trigger);
            console.log(`[getQueuedTriggersForInspection] Added trigger for member ${member}, execution time: ${new Date(trigger.executionTime).toISOString()}`);
          } else {
            console.log(`[getQueuedTriggersForInspection] Skipped trigger for member ${member} (execution time in the past: ${new Date(trigger.executionTime).toISOString()})`);
          }
        } catch (parseError) {
          console.error(`[getQueuedTriggersForInspection] Error parsing trigger data for ${member}:`, parseError);
        }
      } else {
        console.warn(`[getQueuedTriggersForInspection] No data found for member ${member} at key ${dataKey}`);
      }
    } catch (error) {
      console.error(`[getQueuedTriggersForInspection] Error fetching data for member ${member}:`, error);
    }
  }

  console.log(`[getQueuedTriggersForInspection] Returning ${triggers.length} queued triggers for inspection ${inspectionIdStr}`);
  return triggers;
}

/**
 * Cleans up old triggers that are past their execution time (for maintenance)
 */
export async function cleanupOldTriggers(olderThanHours: number = 24): Promise<number> {
  const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

  const oldMembers = await redis.zrange<string[]>(
    TRIGGER_QUEUE_KEY,
    0,
    cutoffTime,
    { byScore: true }
  );

  if (oldMembers && oldMembers.length > 0) {
    await redis.zrem(TRIGGER_QUEUE_KEY, ...oldMembers);
    return oldMembers.length;
  }

  return 0;
}

