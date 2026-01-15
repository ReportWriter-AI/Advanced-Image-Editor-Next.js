"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { ServiceForm, ServiceFormNormalizedValues } from "../_components/ServiceForm";
import { useCreateServiceMutation } from "@/components/api/queries/services";

export default function CreateServicePage() {
  const router = useRouter();
  const createServiceMutation = useCreateServiceMutation();

  const handleSubmit = async (values: ServiceFormNormalizedValues) => {
    try {
      await createServiceMutation.mutateAsync(values);
      router.push("/services");
    } catch (error) {
      // Error is handled by the mutation (toast notification)
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create Service</h1>
          <p className="text-muted-foreground">
            Define a new inspection service that your team can schedule and manage.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/services")}>
          Back to Services
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            New Service Details
          </CardTitle>
          <CardDescription>Fill out the information below to create your service.</CardDescription>
        </CardHeader>
        <CardContent>
          <ServiceForm
            submitLabel="Create Service"
            onSubmit={handleSubmit}
            onCancel={() => router.push("/services")}
            isSubmittingExternal={createServiceMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}


