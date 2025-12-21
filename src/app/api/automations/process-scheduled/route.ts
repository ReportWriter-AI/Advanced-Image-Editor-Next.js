/**
 * API endpoint for Vercel Cron to process scheduled triggers
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getDueTriggers, removeProcessedTriggers } from '@/src/lib/automation-queue';
import { processTrigger } from '@/src/lib/automation-trigger-service';
import Inspection from '@/src/models/Inspection';

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron (optional security check)
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return processScheduledTriggers();
}

export async function POST(req: NextRequest) {
  // Verify this is called by Vercel Cron (optional security check)
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return processScheduledTriggers();
}

async function processScheduledTriggers() {
  try {
    await dbConnect();

    const dueTriggers = await getDueTriggers();

    if (dueTriggers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No due triggers',
        processed: 0,
      });
    }

    const processed: string[] = [];
    const errors: Array<{ trigger: string; error: string }> = [];

    for (const queuedTrigger of dueTriggers) {
      try {
        // Fetch inspection to get trigger config
        const inspection = await Inspection.findById(queuedTrigger.inspectionId).lean();

        if (!inspection || !inspection.triggers) {
          errors.push({
            trigger: `${queuedTrigger.inspectionId}:${queuedTrigger.triggerIndex}`,
            error: 'Inspection or trigger not found',
          });
          continue;
        }

        const triggerConfig = inspection.triggers[queuedTrigger.triggerIndex];
        if (!triggerConfig) {
          errors.push({
            trigger: `${queuedTrigger.inspectionId}:${queuedTrigger.triggerIndex}`,
            error: 'Trigger config not found',
          });
          continue;
        }

        // Check if already sent and onlyTriggerOnce is true
        if (triggerConfig.onlyTriggerOnce && triggerConfig.sentAt) {
          continue;
        }

        // Process the trigger (skip timing check since it's already due)
        const result = await processTrigger(
          queuedTrigger.inspectionId,
          queuedTrigger.triggerIndex,
          triggerConfig as any,
          queuedTrigger.triggerKey,
          true // skipTimingCheck = true for queued triggers
        );

        if (result.success) {
          processed.push(`${queuedTrigger.inspectionId}:${queuedTrigger.triggerIndex}`);
        } else {
          errors.push({
            trigger: `${queuedTrigger.inspectionId}:${queuedTrigger.triggerIndex}`,
            error: result.error || 'Processing failed',
          });
        }
      } catch (error: any) {
        console.error(
          `Error processing trigger ${queuedTrigger.inspectionId}:${queuedTrigger.triggerIndex}:`,
          error
        );
        errors.push({
          trigger: `${queuedTrigger.inspectionId}:${queuedTrigger.triggerIndex}`,
          error: error.message || 'Unknown error',
        });
      }
    }

    // Remove successfully processed triggers from queue
    const successfullyProcessed = dueTriggers.filter((t) =>
      processed.includes(`${t.inspectionId}:${t.triggerIndex}`)
    );
    await removeProcessedTriggers(successfullyProcessed);

    return NextResponse.json({
      success: true,
      processed: processed.length,
      total: dueTriggers.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error processing scheduled triggers:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process scheduled triggers',
      },
      { status: 500 }
    );
  }
}

