"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { DataTable, Column } from "@/components/ui/data-table";
import { toast } from "sonner";

interface DefectNarrative {
  _id: string;
  company: string;
  sectionName: string;
  subsectionName: string;
  narrative: string;
  createdAt: string;
  updatedAt: string;
}

export default function DefectNarrativesPage() {
  const [defectNarratives, setDefectNarratives] = useState<DefectNarrative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const loadDefectNarratives = async (page: number = 1, limit: number = 100) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`/api/defect-narratives?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load defect narratives');
      }

      const data = await response.json();
      setDefectNarratives(data.defectNarratives || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error: any) {
      console.error(error);
      setError(error);
      toast.error(error.message || 'Unable to load defect narratives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDefectNarratives(pagination.page, pagination.limit);
  }, [pagination.page, pagination.limit]);

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const columns: Column<DefectNarrative>[] = [
    {
      id: 'sectionName',
      header: 'Section Name',
      cell: (row) => <span className="font-medium">{row.sectionName}</span>,
    },
    {
      id: 'subsectionName',
      header: 'Subsection Name',
      cell: (row) => row.subsectionName,
    },
    {
      id: 'narrative',
      header: 'Narrative',
      cell: (row) => (
        <div className="max-w-md">
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {row.narrative}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-3xl font-bold">Defect Narratives</h1>
          <p className="text-muted-foreground">
            View defect narratives imported from Excel files.
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to load defect narratives"}
            </p>
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={defectNarratives}
        loading={loading}
        pagination={
          pagination.totalPages > 0
            ? {
                page: pagination.page,
                limit: pagination.limit,
                total: pagination.total,
                totalPages: pagination.totalPages,
                onPageChange: handlePageChange,
              }
            : undefined
        }
        emptyMessage="No defect narratives found yet. Defect narratives will appear here after importing Excel files with defect-type data."
      />
    </div>
  );
}
