"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import {
  ServiceForm,
  ServiceFormNormalizedValues,
  ServiceFormValues,
} from "../_components/ServiceForm";

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

interface ServiceResponse {
  service: {
    _id: string;
    name: string;
    serviceCategory: string;
    description?: string;
    hiddenFromScheduler: boolean;
    baseCost: number;
    baseDurationHours: number;
    defaultInspectionEvents: string[];
    organizationServiceId?: string;
    modifiers: Array<{
      field: string;
      type?: string;
      greaterThan?: number;
      lessThanOrEqual?: number;
      equals?: string;
      addFee?: number;
      addHours?: number;
    }>;
    addOns?: Array<{
      name: string;
      serviceCategory: string;
      description?: string;
      hiddenFromScheduler?: boolean;
      baseCost?: number;
      baseDurationHours?: number;
      defaultInspectionEvents?: string[];
      organizationServiceId?: string;
      modifiers?: Array<{
        field: string;
        type?: string;
        greaterThan?: number;
        lessThanOrEqual?: number;
        equals?: string;
        addFee?: number;
        addHours?: number;
      }>;
      allowUpsell?: boolean;
      orderIndex?: number;
    }>;
    taxes?: Array<{
      name: string;
      addPercent: number;
      orderIndex?: number;
    }>;
  };
}

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams<{ serviceId: string }>();
  const serviceId = params?.serviceId;

  const [message, setMessage] = useState<MessageState>(null);
  const [loading, setLoading] = useState(true);
  const [initialValues, setInitialValues] = useState<ServiceFormValues | undefined>(undefined);

  useEffect(() => {
    if (!serviceId) return;

    const fetchService = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/services/${serviceId}`, {
          credentials: "include",
        });

        const result: ServiceResponse | { error: string } = await response.json();

        if (!response.ok) {
          throw new Error((result as { error?: string }).error || "Failed to load service");
        }

        const service = (result as ServiceResponse).service;
        const mapModifierToForm = (modifier: ServiceResponse["service"]["modifiers"][number]) => ({
          field: modifier.field,
          type: modifier.type || "range",
          greaterThan:
            modifier.greaterThan !== undefined && modifier.greaterThan !== null
              ? modifier.greaterThan.toString()
              : "",
          lessThanOrEqual:
            modifier.lessThanOrEqual !== undefined && modifier.lessThanOrEqual !== null
              ? modifier.lessThanOrEqual.toString()
              : "",
          equals: modifier.equals || "",
          addFee:
            modifier.addFee !== undefined && modifier.addFee !== null
              ? modifier.addFee.toString()
              : "",
          addHours:
            modifier.addHours !== undefined && modifier.addHours !== null
              ? modifier.addHours.toString()
              : "",
        });

        setInitialValues({
          name: service.name,
          serviceCategory: service.serviceCategory || "",
          description: service.description || "",
          hiddenFromScheduler: service.hiddenFromScheduler,
          baseCost: service.baseCost !== undefined ? service.baseCost.toString() : "",
          baseDurationHours:
            service.baseDurationHours !== undefined ? service.baseDurationHours.toString() : "",
          defaultInspectionEvents: service.defaultInspectionEvents.join(", "),
          organizationServiceId: service.organizationServiceId || "",
          modifiers: service.modifiers?.map(mapModifierToForm) || [],
          addOns:
            service.addOns
              ?.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
              .map((addOn) => ({
                name: addOn.name,
                serviceCategory: addOn.serviceCategory || "",
                description: addOn.description || "",
                hiddenFromScheduler: Boolean(addOn.hiddenFromScheduler),
                baseCost:
                  addOn.baseCost !== undefined && addOn.baseCost !== null
                    ? addOn.baseCost.toString()
                    : "",
                baseDurationHours:
                  addOn.baseDurationHours !== undefined && addOn.baseDurationHours !== null
                    ? addOn.baseDurationHours.toString()
                    : "",
                defaultInspectionEvents: addOn.defaultInspectionEvents?.join(", ") || "",
                organizationServiceId: addOn.organizationServiceId || "",
                modifiers: addOn.modifiers?.map(mapModifierToForm) || [],
                allowUpsell: Boolean(addOn.allowUpsell),
                orderIndex: addOn.orderIndex ?? 0,
              })) || [],
          taxes:
            service.taxes
              ?.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
              .map((tax) => ({
                name: tax.name,
                addPercent:
                  tax.addPercent !== undefined && tax.addPercent !== null
                    ? tax.addPercent.toString()
                    : "",
                orderIndex: tax.orderIndex ?? 0,
              })) || [],
        });
      } catch (error: any) {
        setMessage({ type: "error", text: error.message || "Failed to load service" });
      } finally {
        setLoading(false);
      }
    };

    fetchService();
  }, [serviceId]);

  const handleSubmit = async (values: ServiceFormNormalizedValues) => {
    if (!serviceId) return;

    try {
      setMessage(null);

      const response = await fetch(`/api/services/${serviceId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update service");
      }

      setMessage({ type: "success", text: result.message || "Service updated successfully" });
      router.push("/services");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update service" });
    }
  };

  if (!serviceId) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-6 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            Invalid service identifier.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Service</h1>
          <p className="text-muted-foreground">
            Update service details, pricing, and scheduling visibility.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/services")}>
          Back to Services
        </Button>
      </div>

      {message && (
        <Card
          className={
            message.type === "success"
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }
        >
          <CardContent className="flex items-start gap-3 p-4">
            {message.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
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
            Loading service...
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Service Information
            </CardTitle>
            <CardDescription>Adjust the details for this service.</CardDescription>
          </CardHeader>
          <CardContent>
            <ServiceForm
              initialValues={initialValues}
              submitLabel="Save Changes"
              onSubmit={handleSubmit}
              onCancel={() => router.push("/services")}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}


