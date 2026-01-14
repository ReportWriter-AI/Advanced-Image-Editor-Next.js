"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { axios } from "@/components/api/axios";
import apiRoutes from "@/components/api/apiRoutes";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  AlertCircle,
  Loader2,
  PlusCircle,
  RotateCcw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  useTemplateSectionsQuery,
  useCreateTemplateSectionMutation,
  useUpdateTemplateSectionMutation,
  useDeleteTemplateSectionMutation,
  useReorderTemplateSectionsMutation,
  TemplateSection,
} from "@/components/api/queries/templateSections";
import {
  useTemplateSubsectionsQuery,
  useCreateTemplateSubsectionMutation,
  useUpdateTemplateSubsectionMutation,
  useDeleteTemplateSubsectionMutation,
  useReorderTemplateSubsectionsMutation,
  TemplateSubsection,
} from "@/components/api/queries/templateSubsections";
import { TemplateSectionForm } from "./_components/TemplateSectionForm";
import { TemplateSubsectionForm } from "./_components/TemplateSubsectionForm";
import { TemplateSidebar } from "./_components/TemplateSidebar";
import { ChecklistContent } from "./_components/ChecklistContent";
import { RestoreSectionModal } from "./_components/RestoreSectionModal";
import { RestoreSubsectionModal } from "./_components/RestoreSubsectionModal";

export default function TemplatePage() {
  const params = useParams();
  const templateId = params.id as string;
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [createSectionDialogOpen, setCreateSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<TemplateSection | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);
  const [restoreSectionModalOpen, setRestoreSectionModalOpen] = useState(false);
  const [restoreSubsectionModalOpen, setRestoreSubsectionModalOpen] = useState(false);
  const [restoreSubsectionModalSectionId, setRestoreSubsectionModalSectionId] = useState<string | null>(null);
  
  const [createSubsectionDialogOpen, setCreateSubsectionDialogOpen] = useState(false);
  const [editingSubsection, setEditingSubsection] = useState<{ section: TemplateSection; subsection: TemplateSubsection } | null>(null);
  const [deletingSubsection, setDeletingSubsection] = useState<{ section: TemplateSection; subsectionId: string } | null>(null);
  const [isDeletingSubsection, setIsDeletingSubsection] = useState(false);
  
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSubsectionId, setSelectedSubsectionId] = useState<string | null>(null);
  const [selectedSectionForSubsection, setSelectedSectionForSubsection] = useState<TemplateSection | null>(null);

  const initialSelectionMadeRef = useRef(false);

  const { data, isLoading, error } = useTemplateSectionsQuery(templateId);
  const createSectionMutation = useCreateTemplateSectionMutation(templateId);
  const updateSectionMutation = useUpdateTemplateSectionMutation(templateId);
  const deleteSectionMutation = useDeleteTemplateSectionMutation(templateId);
  const reorderSectionsMutation = useReorderTemplateSectionsMutation(templateId);

  // Create subsection mutations - we'll update sectionId before using them
  // Use a stable sectionId from state or empty string
  const subsectionMutationSectionId = selectedSectionForSubsection?._id || editingSubsection?.section._id || deletingSubsection?.section._id || "";
  const createSubsectionMutation = useCreateTemplateSubsectionMutation(templateId, subsectionMutationSectionId);
  const updateSubsectionMutation = useUpdateTemplateSubsectionMutation(templateId, subsectionMutationSectionId);
  const deleteSubsectionMutation = useDeleteTemplateSubsectionMutation(templateId, subsectionMutationSectionId);

  // Get subsection data for selected section to find subsection name
  const { data: subsectionsData, isLoading: subsectionsLoading } = useTemplateSubsectionsQuery(
    templateId,
    selectedSectionId || ""
  );

  const selectedSubsectionName = (() => {
    if (!selectedSubsectionId || !subsectionsData?.data?.subsections) return undefined;
    const subsection = Array.isArray(subsectionsData.data.subsections)
      ? subsectionsData.data.subsections.find((s: TemplateSubsection) => s._id === selectedSubsectionId)
      : null;
    return subsection?.name;
  })();

  // Auto-select first subsection of first section on initial load
  useEffect(() => {
    if (initialSelectionMadeRef.current) return;
    
    // Wait for sections to load
    if (isLoading || !data?.data?.sections) return;
    
    const sectionsArray = Array.isArray(data.data.sections) ? data.data.sections : [];
    if (sectionsArray.length === 0) {
      initialSelectionMadeRef.current = true;
      return;
    }

    // Sort sections by orderIndex
    const sortedSections = [...sectionsArray].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const firstSection = sortedSections[0];
    
    if (!firstSection?._id) {
      initialSelectionMadeRef.current = true;
      return;
    }

    // Select the first section
    setSelectedSectionId(firstSection._id);
    initialSelectionMadeRef.current = true;
  }, [data, isLoading]);

  // Auto-select first subsection when subsections load for the selected section
  useEffect(() => {
    if (!initialSelectionMadeRef.current || !selectedSectionId) return;
    if (selectedSubsectionId) return; // Already have a subsection selected
    
    // Wait for subsections to load
    if (subsectionsLoading || !subsectionsData?.data?.subsections) return;

    const subsectionsArray = Array.isArray(subsectionsData.data.subsections) 
      ? subsectionsData.data.subsections 
      : [];
    
    if (subsectionsArray.length > 0) {
      // Sort subsections by orderIndex
      const sortedSubsections = [...subsectionsArray].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      const firstSubsection = sortedSubsections[0];
      if (firstSubsection?._id) {
        setSelectedSubsectionId(firstSubsection._id);
      }
    }
  }, [selectedSectionId, subsectionsData, subsectionsLoading, selectedSubsectionId]);

  const handleCreateSection = async (values: any) => {
    try {
      await createSectionMutation.mutateAsync(values);
      setCreateSectionDialogOpen(false);
    } catch (error) {
      console.error("Create section error:", error);
    }
  };

  const handleUpdateSection = async (values: any) => {
    if (!editingSection?._id) return;

    try {
      await updateSectionMutation.mutateAsync({
        sectionId: editingSection._id,
        sectionData: {
          ...values,
          orderIndex: editingSection.orderIndex,
        },
      });
      setEditingSection(null);
    } catch (error) {
      console.error("Update section error:", error);
    }
  };

  const handleDeleteSection = async () => {
    if (!deletingSectionId) return;

    try {
      await deleteSectionMutation.mutateAsync(deletingSectionId);
      setDeletingSectionId(null);
      if (selectedSectionId === deletingSectionId) {
        setSelectedSectionId(null);
        setSelectedSubsectionId(null);
      }
    } catch (error) {
      console.error("Delete section error:", error);
    }
  };

  const handleCreateSubsection = async (values: any) => {
    if (!selectedSectionForSubsection?._id) return;

    try {
      await createSubsectionMutation.mutateAsync(values);
      setCreateSubsectionDialogOpen(false);
      setSelectedSectionForSubsection(null);
    } catch (error) {
      console.error("Create subsection error:", error);
    }
  };

  const handleUpdateSubsection = async (values: any) => {
    if (!editingSubsection?.subsection._id || !editingSubsection?.section._id) return;

    try {
      await updateSubsectionMutation.mutateAsync({
        subsectionId: editingSubsection.subsection._id,
        subsectionData: {
          ...values,
          orderIndex: editingSubsection.subsection.orderIndex,
        },
      });
      setEditingSubsection(null);
    } catch (error) {
      console.error("Update subsection error:", error);
    }
  };

  const handleDeleteSubsection = async () => {
    if (!deletingSubsection?.subsectionId || !deletingSubsection?.section._id) return;

    const sectionId = deletingSubsection.section._id;
    const subsectionId = deletingSubsection.subsectionId;

    setIsDeletingSubsection(true);
    try {
      await axios.delete(apiRoutes.templateSubsections.delete(templateId, sectionId, subsectionId));
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateSubsections.get(templateId, sectionId)] });
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateSubsections.deleted(templateId, sectionId)] });
      
      toast.success('Subsection deleted successfully');
      
      setDeletingSubsection(null);
      if (selectedSubsectionId === subsectionId) {
        setSelectedSubsectionId(null);
      }
    } catch (error: any) {
      console.error("Delete subsection error:", error);
      toast.error(error.response?.data?.error || 'Failed to delete subsection');
    } finally {
      setIsDeletingSubsection(false);
    }
  };

  const handleSectionSelect = (sectionId: string | null) => {
    setSelectedSectionId(sectionId);
    setSelectedSubsectionId(null);
  };

  const handleSubsectionSelect = (sectionId: string, subsectionId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedSubsectionId(subsectionId);
  };

  const handleSectionEdit = (section: TemplateSection) => {
    setEditingSection(section);
  };

  const handleSectionDelete = (sectionId: string) => {
    setDeletingSectionId(sectionId);
  };

  const handleSubsectionEdit = (section: TemplateSection, subsection: TemplateSubsection) => {
    setEditingSubsection({ section, subsection });
    setSelectedSectionForSubsection(section);
  };

  const handleSubsectionDelete = (section: TemplateSection, subsectionId: string) => {
    setDeletingSubsection({ section, subsectionId });
    setSelectedSectionForSubsection(section);
  };

  const handleAddSubsection = (section: TemplateSection) => {
    setSelectedSectionForSubsection(section);
    setCreateSubsectionDialogOpen(true);
  };

  const handleSectionRestoreClick = (sectionId: string) => {
    setRestoreSubsectionModalSectionId(sectionId);
    setRestoreSubsectionModalOpen(true);
  };

  const reorderSectionsDisabled =
    reorderSectionsMutation.isPending || isLoading || !!editingSection || !!deletingSectionId;

  const reorderSubsectionsDisabled = (sectionId: string) => {
    return (
      !!editingSubsection ||
      !!deletingSubsection ||
      selectedSectionId !== sectionId
    );
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)] w-full -m-4">
      <div className="flex h-16 items-center border-b px-4 md:px-6 shrink-0 bg-background">
        <div className="flex flex-1 items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">Manage Template</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              Manage sections, subsections, and checklists for this template.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={() => setRestoreSectionModalOpen(true)} size="sm" variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Restore</span>
            </Button>
            <Button onClick={() => setCreateSectionDialogOpen(true)} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add Section</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </div>

      {isMobile ? (
        // Mobile: Vertical layout - sidebar on top, checklist below
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="border-b bg-sidebar text-sidebar-foreground overflow-y-auto max-h-[40vh] shrink-0">
            <TemplateSidebar
              templateId={templateId}
              selectedSectionId={selectedSectionId}
              selectedSubsectionId={selectedSubsectionId}
              onSectionSelect={handleSectionSelect}
              onSubsectionSelect={handleSubsectionSelect}
              onSectionEdit={handleSectionEdit}
              onSectionDelete={handleSectionDelete}
              onSubsectionEdit={handleSubsectionEdit}
              onSubsectionDelete={handleSubsectionDelete}
              onAddSubsection={handleAddSubsection}
              onSectionRestoreClick={handleSectionRestoreClick}
              reorderSectionsDisabled={reorderSectionsDisabled}
              reorderSubsectionsDisabled={reorderSubsectionsDisabled}
            />
          </div>
          <div className="flex flex-col flex-1 min-h-0 bg-background overflow-y-auto">
            {error && (
              <div className="p-4 md:p-6">
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="flex items-start gap-3 p-4">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {error instanceof Error ? error.message : "Failed to load sections"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {isLoading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading sections...</span>
                </div>
              </div>
            ) : (
              <ChecklistContent
                templateId={templateId}
                sectionId={selectedSectionId || ""}
                subsectionId={selectedSubsectionId}
                subsectionName={selectedSubsectionName}
              />
            )}
          </div>
        </div>
      ) : (
        // Desktop: Horizontal resizable layout
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
            <TemplateSidebar
              templateId={templateId}
              selectedSectionId={selectedSectionId}
              selectedSubsectionId={selectedSubsectionId}
              onSectionSelect={handleSectionSelect}
              onSubsectionSelect={handleSubsectionSelect}
              onSectionEdit={handleSectionEdit}
              onSectionDelete={handleSectionDelete}
              onSubsectionEdit={handleSubsectionEdit}
              onSubsectionDelete={handleSubsectionDelete}
              onAddSubsection={handleAddSubsection}
              onSectionRestoreClick={handleSectionRestoreClick}
              reorderSectionsDisabled={reorderSectionsDisabled}
              reorderSubsectionsDisabled={reorderSubsectionsDisabled}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={80} minSize={60} maxSize={85}>
            <div className="flex flex-col min-w-0 bg-background">
              <div>
                {error && (
                  <div className="p-6">
                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="flex items-start gap-3 p-4">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <p className="text-sm text-muted-foreground">
                          {error instanceof Error ? error.message : "Failed to load sections"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {isLoading ? (
                  <div className="flex min-h-[400px] items-center justify-center">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading sections...</span>
                    </div>
                  </div>
                ) : (
                  <ChecklistContent
                    templateId={templateId}
                    sectionId={selectedSectionId || ""}
                    subsectionId={selectedSubsectionId}
                    subsectionName={selectedSubsectionName}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {/* Section Forms */}
      <TemplateSectionForm
        open={createSectionDialogOpen}
        onOpenChange={setCreateSectionDialogOpen}
        onSubmit={handleCreateSection}
        isSubmitting={createSectionMutation.isPending}
      />

      <TemplateSectionForm
        open={!!editingSection}
        onOpenChange={(open) => !open && setEditingSection(null)}
        onSubmit={handleUpdateSection}
        initialValues={editingSection}
        isSubmitting={updateSectionMutation.isPending}
      />

      <AlertDialog
        open={!!deletingSectionId}
        onOpenChange={(open) => !open && setDeletingSectionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this section? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSectionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
              disabled={deleteSectionMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSectionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subsection Forms */}
      {selectedSectionForSubsection && (
        <>
          <TemplateSubsectionForm
            open={createSubsectionDialogOpen}
            onOpenChange={(open) => {
              setCreateSubsectionDialogOpen(open);
              if (!open) {
                setSelectedSectionForSubsection(null);
              }
            }}
            onSubmit={handleCreateSubsection}
            isSubmitting={createSubsectionMutation.isPending}
          />

          {editingSubsection && (
            <TemplateSubsectionForm
              open={!!editingSubsection}
              onOpenChange={(open) => {
                if (!open) {
                  setEditingSubsection(null);
                  setSelectedSectionForSubsection(null);
                }
              }}
              onSubmit={handleUpdateSubsection}
              initialValues={editingSubsection.subsection}
              isSubmitting={updateSubsectionMutation.isPending}
            />
          )}

          <AlertDialog
            open={!!deletingSubsection}
            onOpenChange={(open) => {
              if (!open) {
                setDeletingSubsection(null);
                setSelectedSectionForSubsection(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Subsection</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this subsection? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingSubsection}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteSubsection}
                  disabled={isDeletingSubsection}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeletingSubsection ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <RestoreSectionModal 
        open={restoreSectionModalOpen} 
        onOpenChange={setRestoreSectionModalOpen}
        templateId={templateId}
      />

      {restoreSubsectionModalSectionId && (
        <RestoreSubsectionModal
          open={restoreSubsectionModalOpen}
          onOpenChange={setRestoreSubsectionModalOpen}
          templateId={templateId}
          sectionId={restoreSubsectionModalSectionId}
        />
      )}
    </div>
  );
}
