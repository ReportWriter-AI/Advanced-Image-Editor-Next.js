"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BadgeCheck, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActionForm, ActionFormNormalizedValues } from "../../_components/ActionForm";

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

export default function NewActionPage() {
  const router = useRouter();
  const [message, setMessage] = useState<MessageState>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: ActionFormNormalizedValues) => {
    try {
      setSubmitting(true);
      setMessage(null);

      const response = await fetch("/api/automations/actions", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create action");
      }

      setMessage({ type: "success", text: result.message || "Action created successfully" });
      // Redirect to automations list after a short delay
      setTimeout(() => {
        router.push("/automations");
      }, 1000);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to create action" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Action</h1>
          <p className="text-muted-foreground mt-1">
            Fill out the information below to create your automation action.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/automations")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Automations
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
          <CardTitle>Action Information</CardTitle>
          <CardDescription>Configure your automation action settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            submitLabel="Create Action"
            onSubmit={handleSubmit}
            onCancel={() => router.push("/automations")}
            isSubmitting={submitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}

