"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Save } from "lucide-react";
import {
  ServiceForm,
  ServiceFormNormalizedValues,
  ServiceFormValues,
} from "../_components/ServiceForm";
import { useServiceQuery, useUpdateServiceMutation } from "@/components/api/queries/services";

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams<{ serviceId: string }>();
  const serviceId = params?.serviceId;

  const { data: serviceResponse, isLoading } = useServiceQuery(serviceId || "");
  const updateServiceMutation = useUpdateServiceMutation();

  const initialValues = useMemo<ServiceFormValues | undefined>(() => {
    if (!serviceResponse?.data?.service) return undefined;

    const service = serviceResponse.data.service as any;
    const mapModifierToForm = (modifier: any) => ({
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

    return {
      name: service.name,
      serviceCategory: service.serviceCategory || "",
      description: service.description || "",
      hiddenFromScheduler: service.hiddenFromScheduler,
      baseCost: service.baseCost !== undefined ? service.baseCost.toString() : "",
      baseDurationHours:
        service.baseDurationHours !== undefined ? service.baseDurationHours.toString() : "",
      defaultInspectionEvents: service.defaultInspectionEvents.join(", "),
      organizationServiceId: service.organizationServiceId || "",
      agreementIds: Array.isArray(service.agreementIds)
        ? service.agreementIds.map((id: any) => id.toString())
        : [],
      templateIds: Array.isArray(service.templateIds)
        ? service.templateIds.map((id: any) => id.toString())
        : [],
      modifiers: service.modifiers?.map(mapModifierToForm) || [],
      addOns:
        service.addOns
          ?.sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          .map((addOn: any) => ({
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
            agreementIds: Array.isArray(addOn.agreementIds)
              ? addOn.agreementIds.map((id: any) => id.toString())
              : [],
          })) || [],
      taxes:
        service.taxes
          ?.sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          .map((tax: any) => ({
            name: tax.name,
            addPercent:
              tax.addPercent !== undefined && tax.addPercent !== null
                ? tax.addPercent.toString()
                : "",
            orderIndex: tax.orderIndex ?? 0,
          })) || [],
    };
  }, [serviceResponse]);

  const handleSubmit = async (values: ServiceFormNormalizedValues) => {
    if (!serviceId) return;

    try {
      await updateServiceMutation.mutateAsync({ serviceId, serviceData: values });
      router.push("/services");
    } catch (error) {
      // Error is handled by the mutation (toast notification)
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

      {isLoading ? (
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
              isSubmittingExternal={updateServiceMutation.isPending}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}


