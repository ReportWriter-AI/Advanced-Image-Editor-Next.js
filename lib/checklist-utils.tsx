import React from "react";
import {
  CircleCheckBig,
  ListCheck,
  CalendarDays,
  Hash,
  MoveHorizontal,
  Type,
} from "lucide-react";

/**
 * Gets the appropriate icon component for a checklist field type
 * @param fieldType - The field type string (checkbox, multipleAnswers, date, number, numberRange, text)
 * @returns The icon component or null if no matching field type
 */
export function getChecklistFieldIcon(fieldType?: string): React.ReactElement | null {
  const iconColor = '#4a1b73';
  const iconSize = 'h-4 w-4';

  switch (fieldType) {
    case 'checkbox':
      return <CircleCheckBig className={iconSize} style={{ color: iconColor }} />;
    case 'multipleAnswers':
      return <ListCheck className={iconSize} style={{ color: iconColor }} />;
    case 'date':
      return <CalendarDays className={iconSize} style={{ color: iconColor }} />;
    case 'number':
      return <Hash className={iconSize} style={{ color: iconColor }} />;
    case 'numberRange':
      return <MoveHorizontal className={iconSize} style={{ color: iconColor }} />;
    case 'text':
      return <Type className={iconSize} style={{ color: iconColor }} />;
    default:
      return null;
  }
}
