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
  DiscountCodeForm,
  DiscountCodeFormNormalizedValues,
} from "../_components/DiscountCodeForm";

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

export default function CreateDiscountCodePage() {
  const router = useRouter();
  const [message, setMessage] = useState<MessageState>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: DiscountCodeFormNormalizedValues) => {
    try {
      setSubmitting(true);
      setMessage(null);
      const response = await fetch("/api/discount-codes", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create discount code");
      }
      setMessage({ type: "success", text: result.message || "Discount code created successfully" });
      router.push("/discount-codes");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to create discount code" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create Discount Code</h1>
          <p className="text-muted-foreground">
            Set up promotional codes that can be applied to services and add-ons.
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            Discount Code Details
          </CardTitle>
          <CardDescription>Fill out the information below to create your code.</CardDescription>
        </CardHeader>
        <CardContent>
          <DiscountCodeForm
            submitLabel="Create Discount Code"
            onSubmit={handleSubmit}
            onCancel={() => router.push("/discount-codes")}
            isSubmittingExternal={submitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}


