export type AutomationTriggerSection =
  | 'PRE_INSPECTION'
  | 'CLIENT_ACTIVITY'
  | 'DAY_OF_INSPECTION'
  | 'INSPECTION_EVENTS'
  | 'POST_INSPECTION';

export interface AutomationTrigger {
  key: string;
  title: string;
  description: string;
  section: AutomationTriggerSection;
}

// Type for all valid trigger keys
export type AutomationTriggerKey =
  | 'INSPECTION_REQUESTED'
  | 'INSPECTION_SCHEDULED'
  | 'SERVICE_OR_ADDON_ADDED_AFTER_CONFIRMATION'
  | 'SERVICE_OR_ADDON_REMOVED_AFTER_CONFIRMATION'
  | 'AGREEMENT_ADDED_AFTER_CONFIRMATION'
  | 'AGREEMENT_REMOVED_AFTER_CONFIRMATION'
  | 'ATTACHMENT_ADDED_AFTER_CONFIRMATION'
  | 'ATTACHMENT_REMOVED_AFTER_CONFIRMATION'
  | 'FEE_ADDED_AFTER_CONFIRMATION'
  | 'FEE_REMOVED_AFTER_CONFIRMATION'
  | 'INSPECTOR_ASSIGNED'
  | 'INSPECTOR_UNASSIGNED'
  | 'INSPECTION_RESCHEDULED'
  | 'INSPECTION_CANCELED'
  | 'ALL_AGREEMENTS_SIGNED'
  | 'INSPECTION_FULLY_PAID'
  | 'ALL_AGREEMENTS_SIGNED_AND_FULLY_PAID'
  | 'ANY_REPORTS_PUBLISHED'
  | 'INSPECTION_EVENT_CREATED'
  | 'INSPECTION_EVENT_UPDATED'
  | 'INSPECTION_EVENT_DELETED'
  | 'INSPECTION_START_TIME'
  | 'INSPECTION_END_TIME'
  | 'INSPECTION_CLOSING_DATE'
  | 'INSPECTION_END_OF_PERIOD_DATE'
  | 'ANY_REPORT_VIEWED_BY_AGENT'
  | 'ANY_REPORT_VIEWED_BY_CLIENT';

export const AUTOMATION_TRIGGERS: AutomationTrigger[] = [
  // PRE-INSPECTION
  {
    key: 'INSPECTION_REQUESTED',
    title: 'Inspection Requested',
    description:
      'Triggers when an unconfirmed inspection is created, defaulting to send once, even if notifications are off.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'INSPECTION_SCHEDULED',
    title: 'Inspection Scheduled (Confirmed)',
    description:
      'Triggers when an inspection is confirmed, either at creation or later when an unconfirmed inspection is confirmed.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'SERVICE_OR_ADDON_ADDED_AFTER_CONFIRMATION',
    title: 'Service or Add-on Added After Confirmation',
    description:
      'Triggers when a service or add-on is added to an order after the inspection is confirmed.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'SERVICE_OR_ADDON_REMOVED_AFTER_CONFIRMATION',
    title: 'Service or Add-on Removed After Confirmation',
    description:
      'Triggers when a service or add-on is removed from an order after the inspection is confirmed.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'AGREEMENT_ADDED_AFTER_CONFIRMATION',
    title: 'Agreement Added After Confirmation',
    description:
      'Triggers when an agreement is added to an order after the inspection has been confirmed.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'AGREEMENT_REMOVED_AFTER_CONFIRMATION',
    title: 'Agreement Removed After Confirmation',
    description:
      'Triggers when an agreement is removed from the order after the inspection is confirmed.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'ATTACHMENT_ADDED_AFTER_CONFIRMATION',
    title: 'Attachment Added After Confirmation',
    description:
      'Triggers when an attachment is added to the order after the inspection is confirmed.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'ATTACHMENT_REMOVED_AFTER_CONFIRMATION',
    title: 'Attachment Removed After Confirmation',
    description:
      'Triggers when an attachment is removed from the order after the inspection is confirmed.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'FEE_ADDED_AFTER_CONFIRMATION',
    title: 'Fee Added After Confirmation',
    description:
      'Triggers when a manual fee is added to the order after the inspection is confirmed.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'FEE_REMOVED_AFTER_CONFIRMATION',
    title: 'Fee Removed After Confirmation',
    description:
      'Triggers when a manual fee is removed from the order after the inspection is confirmed.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'INSPECTOR_ASSIGNED',
    title: 'Inspector Assigned',
    description:
      'Triggers when an inspector is assigned to an inspection after it has been created.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'INSPECTOR_UNASSIGNED',
    title: 'Inspector Unassigned',
    description:
      'Triggers when an inspector is unassigned from an inspection after it has been created.',
    section: 'PRE_INSPECTION',
  },
  {
    key: 'INSPECTION_RESCHEDULED',
    title: 'Inspection Rescheduled',
    description:
      "Triggers when the inspection's date and/or time is changed or updated after being scheduled.",
    section: 'PRE_INSPECTION',
  },
  {
    key: 'INSPECTION_CANCELED',
    title: 'Inspection Canceled',
    description: 'Triggers when the inspection is canceled.',
    section: 'PRE_INSPECTION',
  },

  // CLIENT ACTIVITY
  {
    key: 'ALL_AGREEMENTS_SIGNED',
    title: 'All Agreements Signed',
    description:
      'Triggers when all agreements linked to the inspection are signed.',
    section: 'CLIENT_ACTIVITY',
  },
  {
    key: 'INSPECTION_FULLY_PAID',
    title: 'Inspection Fully Paid',
    description: 'Triggers when the inspection is completely paid for.',
    section: 'CLIENT_ACTIVITY',
  },
  {
    key: 'ALL_AGREEMENTS_SIGNED_AND_FULLY_PAID',
    title: 'All Agreements Signed and Inspection Fully Paid',
    description:
      'Triggers when all agreements are signed and the inspection is fully paid.',
    section: 'CLIENT_ACTIVITY',
  },

  // DAY OF INSPECTION
  {
    key: 'INSPECTION_START_TIME',
    title: 'Inspection Start Time',
    description: 'Triggers when the inspection is scheduled to begin.',
    section: 'DAY_OF_INSPECTION',
  },
  {
    key: 'INSPECTION_END_TIME',
    title: 'Inspection End Time',
    description: 'Triggers when the inspection is scheduled to end.',
    section: 'DAY_OF_INSPECTION',
  },
  {
    key: 'ANY_REPORTS_PUBLISHED',
    title: 'Any Reports Published',
    description:
      'Triggers when any reports linked to the inspection are published.',
    section: 'DAY_OF_INSPECTION',
  },

  // INSPECTION EVENTS
  {
    key: 'INSPECTION_EVENT_CREATED',
    title: 'Inspection Event Created',
    description:
      'Triggers when an inspection event is created, including those added during or after order creation.',
    section: 'INSPECTION_EVENTS',
  },
  {
    key: 'INSPECTION_EVENT_UPDATED',
    title: 'Inspection Event Updated',
    description:
      'Triggers when an inspection event is updated or modified.',
    section: 'INSPECTION_EVENTS',
  },
  {
    key: 'INSPECTION_EVENT_DELETED',
    title: 'Inspection Event Deleted',
    description:
      'Triggers when an inspection event is deleted from an order.',
    section: 'INSPECTION_EVENTS',
  },

  // POST-INSPECTION
  {
    key: 'INSPECTION_CLOSING_DATE',
    title: 'Inspection Closing Date',
    description:
      'Triggers at the beginning of the day on the Closing Date set in the order.',
    section: 'POST_INSPECTION',
  },
  {
    key: 'INSPECTION_END_OF_PERIOD_DATE',
    title: 'Inspection End of Period Date',
    description:
      'Triggers at the beginning of the End of Period Date defined in the order.',
    section: 'POST_INSPECTION',
  },
  // {
  //   key: 'ANY_REPORT_VIEWED_BY_AGENT',
  //   title: 'Any Report Viewed By Agent',
  //   description:
  //     'Triggers when an agent views any report linked to the order. Specify which report using conditions (optional).',
  //   section: 'POST_INSPECTION',
  // },
  // {
  //   key: 'ANY_REPORT_VIEWED_BY_CLIENT',
  //   title: 'Any Report Viewed By Client',
  //   description:
  //     'Triggers when a client views any report linked to the order. Specify which report with conditions (optional).',
  //   section: 'POST_INSPECTION',
  // },
];

// Helper function to get triggers grouped by section for react-select
export function getGroupedTriggerOptions() {
  const sections: Record<AutomationTriggerSection, string> = {
    PRE_INSPECTION: 'PRE-INSPECTION',
    CLIENT_ACTIVITY: 'CLIENT ACTIVITY',
    DAY_OF_INSPECTION: 'DAY OF INSPECTION',
    INSPECTION_EVENTS: 'INSPECTION EVENTS',
    POST_INSPECTION: 'POST-INSPECTION',
  };

  const grouped: Record<string, { label: string; value: string; description: string }[]> = {};

  AUTOMATION_TRIGGERS.forEach((trigger) => {
    const sectionLabel = sections[trigger.section];
    if (!grouped[sectionLabel]) {
      grouped[sectionLabel] = [];
    }
    grouped[sectionLabel].push({
      label: trigger.title,
      value: trigger.key,
      description: trigger.description,
    });
  });

  return Object.entries(grouped).map(([label, options]) => ({
    label,
    options,
  }));
}

// Helper function to get trigger by key
export function getTriggerByKey(key: string): AutomationTrigger | undefined {
  return AUTOMATION_TRIGGERS.find((trigger) => trigger.key === key);
}

// Helper function to validate trigger key
export function isValidTriggerKey(key: string): boolean {
  return AUTOMATION_TRIGGERS.some((trigger) => trigger.key === key);
}

/**
 * Checks if a trigger requires the inspection to be confirmed.
 * These triggers explicitly state "after confirmation" or "when confirmed" in their descriptions.
 */
export function requiresConfirmedInspection(triggerKey: string): boolean {
  const triggersRequiringConfirmation = [
    'INSPECTION_SCHEDULED', // "Triggers when an inspection is confirmed"
    'SERVICE_OR_ADDON_ADDED_AFTER_CONFIRMATION',
    'SERVICE_OR_ADDON_REMOVED_AFTER_CONFIRMATION',
    'AGREEMENT_ADDED_AFTER_CONFIRMATION',
    'AGREEMENT_REMOVED_AFTER_CONFIRMATION',
    'ATTACHMENT_ADDED_AFTER_CONFIRMATION',
    'ATTACHMENT_REMOVED_AFTER_CONFIRMATION',
    'FEE_ADDED_AFTER_CONFIRMATION',
    'FEE_REMOVED_AFTER_CONFIRMATION',
    'INSPECTION_RESCHEDULED', // "after being scheduled" - scheduled means confirmed
  ];
  
  return triggersRequiringConfirmation.includes(triggerKey);
}