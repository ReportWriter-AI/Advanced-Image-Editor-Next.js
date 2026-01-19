"use client";

import { useParams } from "next/navigation";
import { ReportDisplay } from "./_components/ReportDisplay";

export default function ReportViewPage() {
  const params = useParams();
  const inspectionId = params.inspectionId as string;
  const templateId = params.templateId as string;

  return (
    <div className="flex flex-col min-h-screen w-full">
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <ReportDisplay
          inspectionId={inspectionId}
          templateId={templateId}
        />
      </div>
    </div>
  );
}
