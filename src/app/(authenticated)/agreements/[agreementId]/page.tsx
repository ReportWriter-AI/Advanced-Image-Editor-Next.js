"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, BadgeCheck, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AgreementForm,
  AgreementFormNormalizedValues,
  AgreementFormValues,
} from "../_components/AgreementForm";

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

interface AgreementResponse {
  agreement: {
    _id: string;
    name: string;
    content: string;
  };
}

export default function EditAgreementPage() {
  const router = useRouter();
  const params = useParams<{ agreementId: string }>();
  const agreementId = params?.agreementId;

  const [message, setMessage] = useState<MessageState>(null);
  const [loading, setLoading] = useState(true);
  const [initialValues, setInitialValues] = useState<AgreementFormValues | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!agreementId) return;

    const fetchAgreement = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/agreements/${agreementId}`, {
          credentials: "include",
        });
        const result: AgreementResponse | { error: string } = await response.json();
        if (!response.ok) {
          throw new Error((result as { error?: string }).error || "Failed to load agreement");
        }
        const agreement = (result as AgreementResponse).agreement;
        setInitialValues({
          name: agreement.name,
          content: agreement.content,
        });
      } catch (error: any) {
        setMessage({ type: "error", text: error.message || "Failed to load agreement" });
      } finally {
        setLoading(false);
      }
    };

    fetchAgreement();
  }, [agreementId]);

  const handleSubmit = async (values: AgreementFormNormalizedValues) => {
    if (!agreementId) return;

    try {
      setSubmitting(true);
      setMessage(null);
      const response = await fetch(`/api/agreements/${agreementId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update agreement");
      }
      setMessage({ type: "success", text: result.message || "Agreement updated successfully" });
      router.push("/agreements");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update agreement" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!agreementId) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-6 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            Invalid agreement identifier.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Agreement</h1>
          <p className="text-muted-foreground">Update the content displayed to clients before signing.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/agreements")}>
          Back to Agreements
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

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading agreement...
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Agreement Information
            </CardTitle>
            <CardDescription>Make changes to this agreement&apos;s name or content.</CardDescription>
          </CardHeader>
          <CardContent>
            <AgreementForm
              initialValues={initialValues}
              submitLabel="Save Changes"
              onSubmit={handleSubmit}
              onCancel={() => router.push("/agreements")}
              isSubmittingExternal={submitting}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}


