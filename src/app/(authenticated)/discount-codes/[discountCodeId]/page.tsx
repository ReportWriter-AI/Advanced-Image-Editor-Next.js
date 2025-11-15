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
  DiscountCodeForm,
  DiscountCodeFormNormalizedValues,
  DiscountCodeFormValues,
} from "../_components/DiscountCodeForm";

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

interface DiscountCodeApiResponse {
  discountCode: {
    _id: string;
    code: string;
    type: "percent" | "amount";
    value: number;
    description?: string;
    notes?: string;
    appliesToServicesDetails: Array<{ serviceId: string }>;
    appliesToAddOns: Array<{
      service: string;
      addOnName: string;
      addOnOrderIndex?: number;
    }>;
    maxUses?: number;
    expirationDate?: string;
    active: boolean;
  };
}

export default function EditDiscountCodePage() {
  const router = useRouter();
  const params = useParams<{ discountCodeId: string }>();
  const discountCodeId = params?.discountCodeId;

  const [message, setMessage] = useState<MessageState>(null);
  const [loading, setLoading] = useState(true);
  const [initialValues, setInitialValues] = useState<DiscountCodeFormValues | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!discountCodeId) return;

    const fetchDiscountCode = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/discount-codes/${discountCodeId}`, {
          credentials: "include",
        });
        const result: DiscountCodeApiResponse | { error: string } = await response.json();
        if (!response.ok) {
          throw new Error((result as { error?: string }).error || "Failed to load discount code");
        }
        const discountCode = (result as DiscountCodeApiResponse).discountCode;
        setInitialValues({
          code: discountCode.code,
          type: discountCode.type,
          value: discountCode.value.toString(),
          description: discountCode.description || "",
          notes: discountCode.notes || "",
          appliesToServices:
            discountCode.appliesToServicesDetails?.map((detail) => detail.serviceId) || [],
          appliesToAddOns:
            discountCode.appliesToAddOns?.map((addOn, index) => {
              const orderIndex =
                typeof addOn.addOnOrderIndex === "number" ? addOn.addOnOrderIndex : index;
              return `${addOn.service}::${orderIndex}`;
            }) || [],
          maxUses:
            discountCode.maxUses !== undefined && discountCode.maxUses !== null
              ? discountCode.maxUses.toString()
              : "",
          expirationDate: discountCode.expirationDate ? new Date(discountCode.expirationDate) : null,
          active: discountCode.active,
        });
      } catch (error: any) {
        setMessage({ type: "error", text: error.message || "Failed to load discount code" });
      } finally {
        setLoading(false);
      }
    };

    fetchDiscountCode();
  }, [discountCodeId]);

  const handleSubmit = async (values: DiscountCodeFormNormalizedValues) => {
    if (!discountCodeId) return;
    try {
      setSubmitting(true);
      setMessage(null);
      const response = await fetch(`/api/discount-codes/${discountCodeId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update discount code");
      }
      setMessage({ type: "success", text: result.message || "Discount code updated successfully" });
      router.push("/discount-codes");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update discount code" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!discountCodeId) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-6 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            Invalid discount code identifier.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Discount Code</h1>
          <p className="text-muted-foreground">
            Update this discount code&apos;s details and availability.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/discount-codes")}>
          Back to Discount Codes
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
            Loading discount code...
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Discount Code Information
            </CardTitle>
            <CardDescription>Adjust the settings for this discount code.</CardDescription>
          </CardHeader>
          <CardContent>
            <DiscountCodeForm
              initialValues={initialValues}
              submitLabel="Save Changes"
              onSubmit={handleSubmit}
              onCancel={() => router.push("/discount-codes")}
              isSubmittingExternal={submitting}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}


