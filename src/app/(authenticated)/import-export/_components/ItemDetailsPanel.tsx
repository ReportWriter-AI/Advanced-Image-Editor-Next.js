"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ExcelRow {
  sectionName: string;
  itemName: string;
  commentName: string;
  commentText: string;
  commentType: string;
  multipleChoiceOptions: string;
  unitTypeOptions: string;
  order: string | number;
  answerType: string;
  defaultValue: string;
  defaultValue2: string;
  defaultUnitType: string;
  defaultLocation: string;
}

interface ItemDetailsPanelProps {
  itemData: ExcelRow[] | null;
  sectionName: string | null;
  itemName: string | null;
}

export function ItemDetailsPanel({
  itemData,
  sectionName,
  itemName,
}: ItemDetailsPanelProps) {
  // Group items by comment type in the specified order: info, limit, defect
  const groupedByCommentType = useMemo(() => {
    if (!itemData || itemData.length === 0) return null;

    const groups: Record<string, ExcelRow[]> = {
      info: [],
      limit: [],
      defect: [],
      other: [], // For any other comment types
    };

    itemData.forEach((row) => {
      const commentType = (row.commentType || "").toLowerCase().trim();
      if (commentType === "info") {
        groups.info.push(row);
      } else if (commentType === "limit") {
        groups.limit.push(row);
      } else if (commentType === "defect") {
        groups.defect.push(row);
      } else {
        groups.other.push(row);
      }
    });

    // Return in the specified order: info, limit, defect, then others
    return [
      { type: "info", rows: groups.info },
      { type: "limit", rows: groups.limit },
      { type: "defect", rows: groups.defect },
      ...(groups.other.length > 0 ? [{ type: "other", rows: groups.other }] : []),
    ].filter((group) => group.rows.length > 0);
  }, [itemData]);

  if (!itemData || itemData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Select an item from the sidebar to view details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{itemName || "(No Item Name)"}</h2>
          <p className="text-muted-foreground">
            Section: {sectionName || "(No Section Name)"}
          </p>
          {itemData.length > 1 && (
            <p className="text-sm text-muted-foreground mt-1">
              {itemData.length} rows for this item
            </p>
          )}
        </div>

        {groupedByCommentType && groupedByCommentType.map((group, groupIndex) => (
          <div key={group.type} className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-lg font-semibold capitalize">
                {group.type === "other" ? "Other Comments" : `${group.type} Comments`}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({group.rows.length} {group.rows.length === 1 ? "item" : "items"})
                </span>
              </h3>
            </div>
            {group.rows.map((row, index) => (
              <Card key={`${group.type}-${index}`}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {group.rows.length > 1 ? `${group.type.charAt(0).toUpperCase() + group.type.slice(1)} Comment ${index + 1}` : "Item Details"}
                  </CardTitle>
                  {row.commentName && (
                    <CardDescription>Comment: {row.commentName}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">Comment Name:</span>{" "}
                      <span className="text-foreground">
                        {row.commentName || <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Comment Text:</span>{" "}
                      <span className="text-foreground">
                        {row.commentText || <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Comment Type:</span>{" "}
                      <span className="text-foreground">
                        {row.commentType || <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Multiple Choice Options:</span>{" "}
                      <span className="text-foreground">
                        {row.multipleChoiceOptions || <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Unit Type Options:</span>{" "}
                      <span className="text-foreground">
                        {row.unitTypeOptions || <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Order:</span>{" "}
                      <span className="text-foreground">
                        {row.order !== "" ? String(row.order) : <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Answer Type:</span>{" "}
                      <span className="text-foreground">
                        {row.answerType || <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Default Value:</span>{" "}
                      <span className="text-foreground">
                        {row.defaultValue || <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Default Value 2:</span>{" "}
                      <span className="text-foreground">
                        {row.defaultValue2 || <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Default Unit Type:</span>{" "}
                      <span className="text-foreground">
                        {row.defaultUnitType || <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Default Location:</span>{" "}
                      <span className="text-foreground">
                        {row.defaultLocation || <span className="text-muted-foreground italic">(empty)</span>}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
