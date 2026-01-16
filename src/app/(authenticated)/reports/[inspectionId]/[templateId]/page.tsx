"use client";

import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportDisplay } from "./_components/ReportDisplay";

export default function ReportViewPage() {
  const params = useParams();
  const inspectionId = params.inspectionId as string;
  const templateId = params.templateId as string;

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)] w-full -m-4">
      <div className="flex h-16 items-center border-b px-4 md:px-6 shrink-0 bg-background">
        <div className="flex flex-1 items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">Report</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              View inspection report details.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="information">Information</TabsTrigger>
          </TabsList>
          <TabsContent value="status" className="mt-6">
            <ReportDisplay
              inspectionId={inspectionId}
              templateId={templateId}
              type="status"
            />
          </TabsContent>
          <TabsContent value="information" className="mt-6">
            <ReportDisplay
              inspectionId={inspectionId}
              templateId={templateId}
              type="information"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
