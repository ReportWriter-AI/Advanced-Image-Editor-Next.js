"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, BadgeCheck, ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActionForm, ActionFormNormalizedValues, ActionFormValues } from "../../../_components/ActionForm";

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

interface ActionApiResponse {
  action: {
    _id: string;
    id?: string;
    name: string;
    category: string | { _id: string; name: string };
    automationTrigger: string;
    isActive: boolean;
    conditions?: Array<{
      type: string;
      operator: string;
      value?: string;
      serviceId?: string | { toString: () => string };
      addonName?: string;
      serviceCategory?: string;
      categoryId?: string | { toString: () => string };
      yearBuild?: number;
      foundation?: string;
      squareFeet?: number;
      zipCode?: string;
      city?: string;
      state?: string;
    }>;
    conditionLogic?: "AND" | "OR";
    communicationType?: "EMAIL" | "TEXT";
    sendTiming?: "AFTER" | "BEFORE";
    sendDelay?: number;
    sendDelayUnit?: "MINUTES" | "HOURS" | "DAYS" | "WEEKS" | "MONTHS";
    onlyTriggerOnce?: boolean;
    sendEvenWhenNotificationsDisabled?: boolean;
    sendDuringCertainHoursOnly?: boolean;
    startTime?: string;
    endTime?: string;
    doNotSendOnWeekends?: boolean;
    emailTo?: string[];
    emailCc?: string[];
    emailBcc?: string[];
    emailFrom?: "COMPANY" | "INSPECTOR";
    emailSubject?: string;
    emailBody?: string;
  };
}

export default function EditActionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const actionId = params?.id;

  const [message, setMessage] = useState<MessageState>(null);
  const [loading, setLoading] = useState(true);
  const [initialValues, setInitialValues] = useState<Partial<ActionFormValues> | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!actionId) return;

    const fetchAction = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/automations/actions/${actionId}`, {
          credentials: "include",
        });
        const result: ActionApiResponse | { error: string } = await response.json();
        if (!response.ok) {
          throw new Error((result as { error?: string }).error || "Failed to load action");
        }
        const action = (result as ActionApiResponse).action;
        setInitialValues({
          name: action.name,
          category:
            typeof action.category === "string"
              ? action.category
              : action.category?._id || "",
          automationTrigger: action.automationTrigger,
          isActive: action.isActive,
          conditions: action.conditions?.map((cond) => ({
            type: cond.type as "INSPECTION" | "AGREEMENT" | "EVENT_NAME" | "SERVICE" | "ADDONS" | "SERVICE_CATEGORY" | "CLIENT_CATEGORY" | "CLIENT_AGENT_CATEGORY" | "LISTING_AGENT_CATEGORY" | "ALL_REPORTS" | "ANY_REPORTS" | "YEAR_BUILD" | "FOUNDATION" | "SQUARE_FEET" | "ZIP_CODE" | "CITY" | "STATE",
            operator: cond.operator,
            value: cond.value,
            serviceId: cond.serviceId
              ? typeof cond.serviceId === "string"
                ? cond.serviceId
                : cond.serviceId.toString()
              : undefined,
            addonName: cond.addonName,
            serviceCategory: cond.serviceCategory,
            categoryId: cond.categoryId
              ? typeof cond.categoryId === "string"
                ? cond.categoryId
                : cond.categoryId.toString()
              : undefined,
            yearBuild: cond.yearBuild,
            foundation: cond.foundation,
            squareFeet: cond.squareFeet,
            zipCode: cond.zipCode,
            city: cond.city,
            state: cond.state,
          })),
          conditionLogic: action.conditionLogic || "AND",
          communicationType: action.communicationType,
          sendTiming: action.sendTiming,
          sendDelay: action.sendDelay,
          sendDelayUnit: action.sendDelayUnit,
          onlyTriggerOnce: action.onlyTriggerOnce,
          sendEvenWhenNotificationsDisabled: action.sendEvenWhenNotificationsDisabled,
          sendDuringCertainHoursOnly: action.sendDuringCertainHoursOnly,
          startTime: action.startTime,
          endTime: action.endTime,
          doNotSendOnWeekends: action.doNotSendOnWeekends,
          emailTo: action.emailTo || [],
          emailCc: action.emailCc || [],
          emailBcc: action.emailBcc || [],
          emailFrom: action.emailFrom,
          emailSubject: action.emailSubject || "",
          emailBody: action.emailBody || "",
        });
      } catch (error: any) {
        setMessage({ type: "error", text: error.message || "Failed to load action" });
      } finally {
        setLoading(false);
      }
    };

    fetchAction();
  }, [actionId]);

  const handleSubmit = async (values: ActionFormNormalizedValues) => {
    if (!actionId) return;
    try {
      setSubmitting(true);
      setMessage(null);

      const response = await fetch(`/api/automations/actions/${actionId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update action");
      }

      setMessage({ type: "success", text: result.message || "Action updated successfully" });
      // Redirect to automations list after a short delay
      setTimeout(() => {
        router.push("/automations");
      }, 1000);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update action" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!actionId) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-6 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            Invalid action identifier.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Action</h1>
          <p className="text-muted-foreground mt-1">
            Update the action information below.
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

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading action...
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Action Information</CardTitle>
            <CardDescription>Update the settings for this automation action.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm
              initialValues={initialValues}
              submitLabel="Update Action"
              onSubmit={handleSubmit}
              onCancel={() => router.push("/automations")}
              isSubmitting={submitting}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

