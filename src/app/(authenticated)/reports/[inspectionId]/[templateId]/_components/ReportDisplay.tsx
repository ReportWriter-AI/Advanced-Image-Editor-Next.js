"use client";

import { useQuery } from "@tanstack/react-query";
import { axios } from "@/components/api/axios";
import apiRoutes from "@/components/api/apiRoutes";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { InspectionTemplateChecklist } from "@/components/api/queries/inspectionTemplateChecklists";
import ThreeSixtyViewer from "@/components/ThreeSixtyViewer";

interface ReportDisplayProps {
  inspectionId: string;
  templateId: string;
  type: "status" | "information";
}

interface ChecklistWithAnswers extends InspectionTemplateChecklist {
  textAnswer?: string;
  selectedAnswers?: string[];
  dateAnswer?: Date | string;
  numberAnswer?: number;
  numberUnit?: string;
  rangeFrom?: number;
  rangeTo?: number;
  rangeUnit?: string;
}

// Helper function to get proxied image URL
const getProxiedSrc = (url: string | null | undefined) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('/api/proxy-image?') || url.startsWith('blob:')) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

export function ReportDisplay({
  inspectionId,
  templateId,
  type,
}: ReportDisplayProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: [apiRoutes.inspectionTemplates.getById(inspectionId, templateId)],
    queryFn: () =>
      axios.get(apiRoutes.inspectionTemplates.getById(inspectionId, templateId)),
    enabled: !!inspectionId && !!templateId,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading report...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Failed to load report"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const template = data?.data?.template;
  if (!template) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Template not found</p>
        </CardContent>
      </Card>
    );
  }

  // Flatten all checklists from all sections and subsections
  const allChecklists: Array<{
    checklist: ChecklistWithAnswers;
    sectionName: string;
    subsectionName: string;
  }> = [];

  const sections = template.sections || [];
  sections
    .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
    .forEach((section: any) => {
      if (section.deletedAt) return;

      const subsections = section.subsections || [];
      subsections
        .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
        .forEach((subsection: any) => {
          if (subsection.deletedAt) return;

          const checklists = subsection.checklists || [];
          checklists
            .filter((c: ChecklistWithAnswers) => c.type === type && c.defaultChecked === true)
            .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
            .forEach((checklist: ChecklistWithAnswers) => {
              allChecklists.push({
                checklist,
                sectionName: section.name,
                subsectionName: subsection.name,
              });
            });
        });
    });

  if (allChecklists.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No {type} checklists with defaultChecked enabled found.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by section and subsection
  const grouped: Record<
    string,
    Record<string, ChecklistWithAnswers[]>
  > = {};

  allChecklists.forEach(({ checklist, sectionName, subsectionName }) => {
    if (!grouped[sectionName]) {
      grouped[sectionName] = {};
    }
    if (!grouped[sectionName][subsectionName]) {
      grouped[sectionName][subsectionName] = [];
    }
    grouped[sectionName][subsectionName].push(checklist);
  });

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([sectionName, subsections]) => (
        <Card key={sectionName}>
          <CardHeader>
            <CardTitle>{sectionName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(subsections).map(([subsectionName, checklists]) => (
              <div key={subsectionName} className="space-y-4">
                <h3 className="text-lg font-semibold">{subsectionName}</h3>
                <div className="space-y-4 pl-4 border-l-2">
                  {checklists.map((checklist) => (
                    <div key={checklist._id} className="space-y-2">
                      <div className="font-medium">{checklist.name}</div>
                      {checklist.comment && (
                        <p className="text-sm text-muted-foreground">
                          {checklist.comment}
                        </p>
                      )}
                      {renderAnswer(checklist)}
                      {checklist.type === 'status' && checklist.media && renderMedia(checklist.media)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function renderAnswer(checklist: ChecklistWithAnswers) {
  if (!checklist.field) {
    // For information checklists or checklists without field, just show checked state
    return checklist.defaultChecked ? (
      <Badge variant="default">Checked</Badge>
    ) : null;
  }

  switch (checklist.field) {
    case "checkbox":
      return checklist.defaultChecked ? (
        <Badge variant="default">Checked</Badge>
      ) : null;

    case "text":
      return checklist.textAnswer ? (
        <p className="text-sm">{checklist.textAnswer}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No answer provided</p>
      );

    case "multipleAnswers":
      if (checklist.selectedAnswers && checklist.selectedAnswers.length > 0) {
        return (
          <div className="flex flex-wrap gap-2">
            {checklist.selectedAnswers.map((answer, index) => (
              <Badge key={index} variant="secondary">
                {answer}
              </Badge>
            ))}
          </div>
        );
      }
      return (
        <p className="text-sm text-muted-foreground italic">No answers selected</p>
      );

    case "date":
      if (checklist.dateAnswer) {
        try {
          const date = new Date(checklist.dateAnswer);
          return (
            <p className="text-sm">{format(date, "PPP")}</p>
          );
        } catch (e) {
          return (
            <p className="text-sm text-muted-foreground italic">Invalid date</p>
          );
        }
      }
      return (
        <p className="text-sm text-muted-foreground italic">No date provided</p>
      );

    case "number":
      if (checklist.numberAnswer !== undefined && checklist.numberAnswer !== null) {
        return (
          <p className="text-sm">
            {checklist.numberAnswer}
            {checklist.numberUnit && ` ${checklist.numberUnit}`}
          </p>
        );
      }
      return (
        <p className="text-sm text-muted-foreground italic">No number provided</p>
      );

    case "numberRange":
      if (
        checklist.rangeFrom !== undefined &&
        checklist.rangeTo !== undefined &&
        checklist.rangeFrom !== null &&
        checklist.rangeTo !== null
      ) {
        return (
          <p className="text-sm">
            {checklist.rangeFrom} - {checklist.rangeTo}
            {checklist.rangeUnit && ` ${checklist.rangeUnit}`}
          </p>
        );
      }
      return (
        <p className="text-sm text-muted-foreground italic">No range provided</p>
      );

    default:
      return null;
  }
}

function renderMedia(mediaArray: Array<{ url: string; mediaType: 'image' | 'video' | '360pic'; location?: string; order: number }> | undefined) {
  if (!mediaArray || !Array.isArray(mediaArray) || mediaArray.length === 0) {
    return null;
  }

  // Filter out invalid entries and sort by order
  const validMedia = mediaArray
    .filter((item) => item && item.url && item.mediaType && typeof item.order === 'number')
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (validMedia.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {validMedia.map((mediaItem, index) => (
          <div key={index} className="space-y-2">
            {mediaItem.mediaType === '360pic' ? (
              <div className="rounded-lg overflow-hidden" style={{ width: '300px', maxWidth: '100%', height: 'auto' }}>
                <ThreeSixtyViewer
                  imageUrl={getProxiedSrc(mediaItem.url)}
                  alt={mediaItem.location ? `360° photo - ${mediaItem.location}` : '360° photo'}
                  height="300px"
                  width="300px"
                />
              </div>
            ) : mediaItem.mediaType === 'video' ? (
              <div className="rounded-lg overflow-hidden" style={{ width: '300px', maxWidth: '100%', height: 'auto' }}>
                <video
                  src={getProxiedSrc(mediaItem.url)}
                  controls
                  preload="metadata"
                  className="rounded-lg"
                  style={{ width: '300px', maxWidth: '100%', height: 'auto' }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={{ width: '300px', maxWidth: '100%', height: 'auto' }}>
                <img
                  src={getProxiedSrc(mediaItem.url)}
                  alt={mediaItem.location || `Image ${index + 1}`}
                  className="rounded-lg"
                  style={{ width: '300px', maxWidth: '100%', height: 'auto' }}
                  onError={(e) => {
                    console.error('Failed to load image:', mediaItem.url);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            {mediaItem.location && (
              <p className="text-xs text-muted-foreground text-center">
                {mediaItem.location}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
