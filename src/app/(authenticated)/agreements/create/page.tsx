"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BadgeCheck, PlusCircle } from "lucide-react";

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
} from "../_components/AgreementForm";

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

export default function CreateAgreementPage() {
  const router = useRouter();
  const [message, setMessage] = useState<MessageState>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: AgreementFormNormalizedValues) => {
    try {
      setSubmitting(true);
      setMessage(null);
      const response = await fetch("/api/agreements", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create agreement");
      }
      setMessage({ type: "success", text: result.message || "Agreement created successfully" });
      router.push("/agreements");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to create agreement" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create Agreement</h1>
          <p className="text-muted-foreground">
            Draft the content that clients will review and sign before their inspections.
          </p>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            Agreement Details
          </CardTitle>
          <CardDescription>Provide the name and content for your new agreement.</CardDescription>
        </CardHeader>
        <CardContent>
          <AgreementForm
            submitLabel="Create Agreement"
            onSubmit={handleSubmit}
            onCancel={() => router.push("/agreements")}
            isSubmittingExternal={submitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}


