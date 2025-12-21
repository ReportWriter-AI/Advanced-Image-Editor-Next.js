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

