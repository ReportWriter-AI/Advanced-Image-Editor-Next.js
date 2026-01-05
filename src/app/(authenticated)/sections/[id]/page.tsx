"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AlertCircle, BadgeCheck, Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SectionForm, type SectionFormNormalizedValues, type SectionFormValues } from "../_components/SectionForm";

interface InspectionSectionApiResponse {
  section: {
    _id: string;
    name: string;
    order_index: number;
    checklists: Array<{
      text: string;
      comment?: string;
      type: "status" | "information";
      tab: "information" | "limitations";
      answer_choices?: string[];
      default_checked?: boolean;
      default_selected_answers?: string[];
      order_index: number;
    }>;
    createdAt: string;
    updatedAt: string;
  };
}

type MessageState =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

export default function EditSectionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sectionId = params?.id;

  const [message, setMessage] = useState<MessageState>(null);
  const [loading, setLoading] = useState(true);
  const [initialValues, setInitialValues] = useState<SectionFormValues | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sectionId) return;

    const fetchSection = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/inspection-sections/${sectionId}`, {
          credentials: "include",
        });
        const result: InspectionSectionApiResponse | { error: string } = await response.json();
        if (!response.ok) {
          throw new Error((result as { error?: string }).error || "Failed to load section");
        }
        const section = (result as InspectionSectionApiResponse).section;
        setInitialValues({
          name: section.name,
          checklists: section.checklists.map((item) => ({
            text: item.text,
            comment: item.comment || "",
            type: item.type,
            tab: item.tab,
            answer_choices: item.answer_choices || [],
            default_checked: item.default_checked || false,
            default_selected_answers: item.default_selected_answers || [],
            order_index: item.order_index,
          })),
        });
      } catch (error: any) {
        console.error("Error fetching section:", error);
        setMessage({ type: "error", text: error.message || "Failed to load section" });
      } finally {
        setLoading(false);
      }
    };

    fetchSection();
  }, [sectionId]);

  const handleSubmit = async (values: SectionFormNormalizedValues) => {
    if (!sectionId) return;
    try {
      setSubmitting(true);
      setMessage(null);
      const response = await fetch(`/api/inspection-sections/${sectionId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update section");
      }
      setMessage({ type: "success", text: result.message || "Section updated successfully" });
      router.push("/sections");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update section" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!sectionId) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-6 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            Invalid section identifier.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading section...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!initialValues) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-6 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            Section not found or you don't have permission to view it.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Inspection Section</h1>
          <p className="text-muted-foreground">Update section details and checklist items.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/sections")}>
          Back to Sections
        </Button>
      </div>

      {message && (
        <Card
          className={
            message.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          }
        >
          <CardContent className="flex items-start gap-3 p-4">
            {message.type === "success" ? (
              <BadgeCheck className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <p className="text-sm text-muted-foreground">{message.text}</p>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setMessage(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Section Details
          </CardTitle>
          <CardDescription>Update the information below to modify your section.</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionForm
            initialValues={initialValues}
            submitLabel="Save Changes"
            onSubmit={handleSubmit}
            onCancel={() => router.push("/sections")}
            isSubmittingExternal={submitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}

