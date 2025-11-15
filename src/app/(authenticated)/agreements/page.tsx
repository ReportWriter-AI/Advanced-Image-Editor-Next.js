"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertCircle,
  BadgeCheck,
  Loader2,
  PlusCircle,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

type SignatureType = "checkbox" | "written";

interface Agreement {
  _id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

const DEFAULT_INSTRUCTIONS = "Please read through and sign:";

export default function AgreementsPage() {
  const router = useRouter();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<MessageState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [signatureType, setSignatureType] = useState<SignatureType>("checkbox");
  const [clientInstructions, setClientInstructions] = useState(DEFAULT_INSTRUCTIONS);

  const editorModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
      ],
    }),
    []
  );

  const editorFormats = useMemo(
    () => ["header", "bold", "italic", "underline", "strike", "list", "link"],
    []
  );

  const fetchAgreements = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/agreements", { credentials: "include" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch agreements");
      }
      setAgreements(Array.isArray(result.agreements) ? result.agreements : []);
    } catch (error: any) {
      console.error("Error fetching agreements:", error);
      setMessage({ type: "error", text: error.message || "Failed to load agreements" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const response = await fetch("/api/agreements/settings", { credentials: "include" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to load settings");
      }
      setSignatureType(result.signatureType === "written" ? "written" : "checkbox");
      setClientInstructions(result.clientInstructions || DEFAULT_INSTRUCTIONS);
    } catch (error: any) {
      console.error("Error fetching agreement settings:", error);
      toast.error(error.message || "Failed to load settings");
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgreements();
    fetchSettings();
  }, [fetchAgreements, fetchSettings]);

  const noAgreements = useMemo(
    () => !loading && agreements.length === 0,
    [loading, agreements.length]
  );

  const handleSaveSettings = async () => {
    try {
      setSettingsSaving(true);
      const response = await fetch("/api/agreements/settings", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatureType,
          clientInstructions,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update settings");
      }
      toast.success("Settings updated");
      setSettingsOpen(false);
    } catch (error: any) {
      console.error("Update settings error:", error);
      toast.error(error.message || "Failed to update settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Agreements</h1>
            <p className="text-muted-foreground">
              Manage the agreements clients must sign before their inspections.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="gap-2" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" />
              Basic Settings
            </Button>
            <Button className="gap-2" onClick={() => router.push("/agreements/create")}>
              <PlusCircle className="h-4 w-4" />
              Create Agreement
            </Button>
          </div>
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
              Loading agreements...
            </CardContent>
          </Card>
        ) : noAgreements ? (
          <Card>
            <CardContent className="space-y-4 p-10 text-center text-muted-foreground">
              <p>No agreements yet.</p>
              <Button variant="link" onClick={() => router.push("/agreements/create")}>
                Create your first agreement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Existing Agreements</CardTitle>
              <CardDescription>Review and manage the agreements shown to your clients.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full divide-y divide-muted border-collapse text-sm">
                <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Created On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted">
                  {agreements.map((agreement) => (
                    <tr key={agreement._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 align-top font-medium text-foreground">{agreement.name}</td>
                      <td className="px-4 py-3 align-top text-muted-foreground">
                        {format(new Date(agreement.createdAt), "dd MMMM yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-2xl sm:max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Basic Settings</DialogTitle>
              <DialogDescription>Customize how agreements appear to your clients.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 overflow-y-auto pr-2" style={{ maxHeight: "60vh" }}>
              <div className="space-y-2">
                <Label>Signature Type</Label>
                <Select
                  value={signatureType}
                  onValueChange={(value) => setSignatureType(value as SignatureType)}
                  disabled={settingsLoading || settingsSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select signature type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checkbox">E-signature (checkbox)</SelectItem>
                    <SelectItem value="written">Written Signature</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Both checkbox signatures and written signatures are legally binding for agreements. They both
                  capture the date and time as well as the IP address that the signature originated from. Certain
                  regions have regulations around which signature is preferred. Look into your local laws when selecting.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Client agreement instructions</Label>
                <div className="h-[300px]">
                  <ReactQuill
                    theme="snow"
                    value={clientInstructions}
                    onChange={setClientInstructions}
                    modules={editorModules}
                    formats={editorFormats}
                    readOnly={settingsLoading || settingsSaving}
                    className="h-full [&_.ql-container]:!h-[236px] [&_.ql-container]:overflow-y-auto"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  This text will appear on the client portal under "Sign Agreement(s)".
                </p>
              </div>
            </div>
            <DialogFooter className="sm:space-x-2">
              <Button variant="outline" onClick={() => setSettingsOpen(false)} disabled={settingsSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings} disabled={settingsSaving || settingsLoading}>
                {settingsSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}


