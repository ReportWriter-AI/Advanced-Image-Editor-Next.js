"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
  Search,
  Settings,
  Check,
  Eye,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useInspectionTemplateSectionsQuery,
  useCreateInspectionTemplateSectionMutation,
  useUpdateInspectionTemplateSectionMutation,
  useDeleteInspectionTemplateSectionMutation,
  useReorderInspectionTemplateSectionsMutation,
  InspectionTemplateSection,
} from "@/components/api/queries/inspectionTemplateSections";
import {
  useInspectionTemplateSubsectionsQuery,
  useCreateInspectionTemplateSubsectionMutation,
  useUpdateInspectionTemplateSubsectionMutation,
  useDeleteInspectionTemplateSubsectionMutation,
  InspectionTemplateSubsection,
} from "@/components/api/queries/inspectionTemplateSubsections";
import { InspectionTemplateSectionForm } from "./_components/InspectionTemplateSectionForm";
import { InspectionTemplateSubsectionForm } from "./_components/InspectionTemplateSubsectionForm";
import { InspectionTemplateSidebar } from "./_components/InspectionTemplateSidebar";
import { ChecklistContent } from "./_components/ChecklistContent";
import { RestoreSectionModal } from "./_components/RestoreSectionModal";
import { RestoreSubsectionModal } from "./_components/RestoreSubsectionModal";
import { InspectionTemplateSettingsModal } from "./_components/InspectionTemplateSettingsModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useInspectionQuery, useUpdateInspectionMutation } from "@/components/api/queries/inspections";
import { 
  useInspectionTemplateQuery,
  useInspectionTemplatePublishValidationQuery,
  usePublishInspectionMutation,
  useSearchInspectionChecklistsQuery,
} from "@/components/api/queries/inspectionTemplates";
import { ChecklistSearchDropdown } from "./_components/ChecklistSearchDropdown";

export default function InspectionTemplateEditPage() {
  const params = useParams();
  const inspectionId = params.inspectionId as string;
  const inspectionTemplateId = params.inspectionTemplateId as string;
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [createSectionDialogOpen, setCreateSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<InspectionTemplateSection | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);
  const [restoreSectionModalOpen, setRestoreSectionModalOpen] = useState(false);
  const [restoreSubsectionModalOpen, setRestoreSubsectionModalOpen] = useState(false);
  const [restoreSubsectionModalSectionId, setRestoreSubsectionModalSectionId] = useState<string | null>(null);
  const [settingsPopoverOpen, setSettingsPopoverOpen] = useState(false);
  const [templateSettingsModalOpen, setTemplateSettingsModalOpen] = useState(false);

  const [createSubsectionDialogOpen, setCreateSubsectionDialogOpen] = useState(false);
  const [editingSubsection, setEditingSubsection] = useState<{ section: InspectionTemplateSection; subsection: InspectionTemplateSubsection } | null>(null);
  const [deletingSubsection, setDeletingSubsection] = useState<{ section: InspectionTemplateSection; subsectionId: string } | null>(null);
  const [isDeletingSubsection, setIsDeletingSubsection] = useState(false);

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSubsectionId, setSelectedSubsectionId] = useState<string | null>(null);
  const [selectedSectionForSubsection, setSelectedSectionForSubsection] = useState<InspectionTemplateSection | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchDropdownRef = useRef<HTMLDivElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchDropdownRef = useRef<HTMLDivElement>(null);

  const initialSelectionMadeRef = useRef(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search query hook
  const { data: searchResults, isLoading: isSearching } = useSearchInspectionChecklistsQuery(
    inspectionId,
    inspectionTemplateId,
    debouncedSearchQuery,
    showSearchDropdown
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedOutsideMobile =
        mobileSearchDropdownRef.current &&
        !mobileSearchDropdownRef.current.contains(event.target as Node) &&
        mobileSearchInputRef.current &&
        !mobileSearchInputRef.current.contains(event.target as Node);

      const clickedOutsideDesktop =
        desktopSearchDropdownRef.current &&
        !desktopSearchDropdownRef.current.contains(event.target as Node) &&
        desktopSearchInputRef.current &&
        !desktopSearchInputRef.current.contains(event.target as Node);

      if (clickedOutsideMobile || clickedOutsideDesktop) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data, isLoading, error } = useInspectionTemplateSectionsQuery(inspectionId, inspectionTemplateId);
  const { data: inspectionData } = useInspectionQuery(inspectionId);
  const { data: templateData } = useInspectionTemplateQuery(inspectionId, inspectionTemplateId);
  const { data: validationData } = useInspectionTemplatePublishValidationQuery(inspectionId, inspectionTemplateId);
  const updateInspectionMutation = useUpdateInspectionMutation(inspectionId);
  const publishMutation = usePublishInspectionMutation(inspectionId);
  const createSectionMutation = useCreateInspectionTemplateSectionMutation(inspectionId, inspectionTemplateId);
  const updateSectionMutation = useUpdateInspectionTemplateSectionMutation(inspectionId, inspectionTemplateId);
  const deleteSectionMutation = useDeleteInspectionTemplateSectionMutation(inspectionId, inspectionTemplateId);
  const reorderSectionsMutation = useReorderInspectionTemplateSectionsMutation(inspectionId, inspectionTemplateId);

  // Create subsection mutations - we'll update sectionId before using them
  // Use a stable sectionId from state or empty string
  const subsectionMutationSectionId = selectedSectionForSubsection?._id || editingSubsection?.section._id || deletingSubsection?.section._id || "";
  const createSubsectionMutation = useCreateInspectionTemplateSubsectionMutation(inspectionId, inspectionTemplateId, subsectionMutationSectionId);
  const updateSubsectionMutation = useUpdateInspectionTemplateSubsectionMutation(inspectionId, inspectionTemplateId, subsectionMutationSectionId);
  const deleteSubsectionMutation = useDeleteInspectionTemplateSubsectionMutation(inspectionId, inspectionTemplateId, subsectionMutationSectionId);

  // Get subsection data for selected section to find subsection name
  const { data: subsectionsData, isLoading: subsectionsLoading } = useInspectionTemplateSubsectionsQuery(
    inspectionId,
    inspectionTemplateId,
    selectedSectionId || ""
  );

  const selectedSubsectionName = (() => {
    if (!selectedSubsectionId || !subsectionsData?.data?.subsections) return undefined;
    const subsection = Array.isArray(subsectionsData.data.subsections)
      ? subsectionsData.data.subsections.find((s: InspectionTemplateSubsection) => s._id === selectedSubsectionId)
      : null;
    return subsection?.name;
  })();

  const selectedSectionName = (() => {
    if (!selectedSectionId || !data?.data?.sections) return undefined;
    const sectionsArray = Array.isArray(data.data.sections) ? data.data.sections : [];
    const section = sectionsArray.find((s: InspectionTemplateSection) => s._id === selectedSectionId);
    return section?.name;
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

  // Helper functions to format display data
  const formatClientNames = (clients?: Array<{firstName?: string; lastName?: string; companyName?: string; isCompany?: boolean}>) => {
    if (!clients || clients.length === 0) return 'No client assigned';
    
    return clients.map(client => {
      if (client.isCompany && client.companyName) {
        return client.companyName;
      }
      return `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown Client';
    }).filter(Boolean).join(', ');
  };

  const formatLocationAddress = (location?: {address?: string; city?: string; state?: string; zip?: string}) => {
    if (!location) return '';
    
    const parts = [
      location.address,
      location.city,
      location.state,
      location.zip
    ].filter(Boolean);
    
    return parts.join(', ') || 'No location specified';
  };

  const handleHeaderImageUpdate = async (imageUrl: string) => {
    try {
      await updateInspectionMutation.mutateAsync({ headerImage: imageUrl });
    } catch (error) {
      // Error already handled by mutation's onError
    }
  };

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync();
      // Refetch validation data to update button state
      queryClient.invalidateQueries({ 
        queryKey: [apiRoutes.inspectionTemplates.validatePublish(inspectionId, inspectionTemplateId)] 
      });
    } catch (error) {
      // Error already handled by mutation's onError
    }
  };

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
      await axios.delete(apiRoutes.inspectionTemplateSubsections.delete(inspectionId, inspectionTemplateId, sectionId, subsectionId));

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSubsections.get(inspectionId, inspectionTemplateId, sectionId)] });
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSubsections.deleted(inspectionId, inspectionTemplateId, sectionId)] });

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

  const handleSectionEdit = (section: InspectionTemplateSection) => {
    setEditingSection(section);
  };

  const handleSectionDelete = (sectionId: string) => {
    setDeletingSectionId(sectionId);
  };

  const handleSubsectionEdit = (section: InspectionTemplateSection, subsection: InspectionTemplateSubsection) => {
    setEditingSubsection({ section, subsection });
    setSelectedSectionForSubsection(section);
  };

  const handleSubsectionDelete = (section: InspectionTemplateSection, subsectionId: string) => {
    setDeletingSubsection({ section, subsectionId });
    setSelectedSectionForSubsection(section);
  };

  const handleAddSubsection = (section: InspectionTemplateSection) => {
    setSelectedSectionForSubsection(section);
    setCreateSubsectionDialogOpen(true);
  };

  const handleSectionRestoreClick = (sectionId: string) => {
    setRestoreSubsectionModalSectionId(sectionId);
    setRestoreSubsectionModalOpen(true);
  };

  // Search handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSearchDropdown(value.length >= 3);
    setSelectedSearchIndex(0);
  };

  const handleSearchResultSelect = (sectionId: string, subsectionId: string) => {
    handleSubsectionSelect(sectionId, subsectionId);
    setShowSearchDropdown(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchDropdown || !searchResults?.data?.results) return;

    const results = searchResults.data.results;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSearchIndex((prev) => (prev + 1) % results.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedSearchIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedSearchIndex]) {
          const result = results[selectedSearchIndex];
          handleSearchResultSelect(result.sectionId, result.subsectionId);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSearchDropdown(false);
        break;
    }
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

      {isMobile ? (
        // Mobile: Vertical layout - sidebar on top, checklist below
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Mobile Header Section */}
          <div className="flex flex-col gap-3 border-b shrink-0 bg-background px-4 py-3">
            <div className="flex flex-col gap-2">
              <h1 className="text-lg font-bold">
                {templateData?.data?.template?.name || 'Loading template...'}
              </h1>
              <h3 className="text-sm text-muted-foreground">
                {formatClientNames(inspectionData?.clients)} - {formatLocationAddress(inspectionData?.location)}
              </h3>
              <div className="flex gap-2 flex-wrap">
                <Link href={`/reports/${inspectionId}/${inspectionTemplateId}`}>
                  <Button variant="outline" size="sm">Preview</Button>
                </Link>
                {validationData?.data?.isAlreadyPublished ? (
                  <Button variant="outline" size="sm" disabled>
                    <Check className="mr-2 h-4 w-4" />
                    Published
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={handlePublish}
                            disabled={
                              !validationData?.data?.canPublish || 
                              publishMutation.isPending
                            }
                          >
                            {publishMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Publishing...
                              </>
                            ) : (
                              'Publish'
                            )}
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {!validationData?.data?.canPublish && (
                        <TooltipContent>
                          <p>
                            {validationData?.data?.checkedStatusChecklists || 0} of{' '}
                            {validationData?.data?.totalStatusChecklists || 0} status checklists completed
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center justify-between">
              <div className="flex gap-2 flex-1">
                <Link href={`/defects/${inspectionId}/${inspectionTemplateId}`}>
                  <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    View Defects
                  </Button>
                </Link>
                <Button onClick={() => setCreateSectionDialogOpen(true)} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Section
                </Button>
            
                <Popover open={settingsPopoverOpen} onOpenChange={setSettingsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="end">
                    <div className="flex flex-col">
                      <button
                        className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          setSettingsPopoverOpen(false);
                          setTemplateSettingsModalOpen(true);
                        }}
                      >
                        Settings
                      </button>
                      <button
                        className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          setSettingsPopoverOpen(false);
                          setRestoreSectionModalOpen(true);
                        }}
                      >
                        Restore
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="relative flex-1" ref={mobileSearchDropdownRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={mobileSearchInputRef}
                  type="text"
                  placeholder="Search checklists"
                  className="w-full pl-9"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => searchQuery.length >= 3 && setShowSearchDropdown(true)}
                />
                {showSearchDropdown && (
                  <ChecklistSearchDropdown
                    results={searchResults?.data?.results || []}
                    isLoading={isSearching}
                    onSelect={handleSearchResultSelect}
                    searchQuery={searchQuery}
                    selectedIndex={selectedSearchIndex}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="border-b bg-sidebar text-sidebar-foreground overflow-y-auto max-h-[40vh] shrink-0">
            <InspectionTemplateSidebar
              inspectionId={inspectionId}
              inspectionTemplateId={inspectionTemplateId}
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
              headerImage={inspectionData?.headerImage || null}
              onHeaderImageUpdate={handleHeaderImageUpdate}
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
                inspectionId={inspectionId}
                inspectionTemplateId={inspectionTemplateId}
                sectionId={selectedSectionId || ""}
                subsectionId={selectedSubsectionId}
                subsectionName={selectedSubsectionName}
                sectionName={selectedSectionName}
              />
            )}
          </div>
        </div>
      ) : (
        // Desktop: Horizontal resizable layout
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
            <InspectionTemplateSidebar
              inspectionId={inspectionId}
              inspectionTemplateId={inspectionTemplateId}
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
              headerImage={inspectionData?.headerImage || null}
              onHeaderImageUpdate={handleHeaderImageUpdate}
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
                  <>
                    <div className="flex min-h-28 justify-between items-center border-b shrink-0 bg-background px-4 py-2">
                      <div className="flex flex-col gap-2">
                        <h1 className="text-xl md:text-2xl font-bold truncate">
                          {templateData?.data?.template?.name || 'Loading template...'}
                        </h1>
                        <h3 className="text-muted-foreground">
                          {formatClientNames(inspectionData?.clients)} - {formatLocationAddress(inspectionData?.location)}
                        </h3>
                        <div className="flex gap-2">
                          <Link href={`/reports/${inspectionId}/${inspectionTemplateId}`}>
                            <Button variant="outline">Preview</Button>
                          </Link>
                          {validationData?.data?.isAlreadyPublished ? (
                            <Button variant="outline" disabled>
                              <Check className="mr-2 h-4 w-4" />
                              Published
                            </Button>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button 
                                      variant="outline"
                                      onClick={handlePublish}
                                      disabled={
                                        !validationData?.data?.canPublish || 
                                        publishMutation.isPending
                                      }
                                    >
                                      {publishMutation.isPending ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Publishing...
                                        </>
                                      ) : (
                                        'Publish'
                                      )}
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                {!validationData?.data?.canPublish && (
                                  <TooltipContent>
                                    <p>
                                      {validationData?.data?.checkedStatusChecklists || 0} of{' '}
                                      {validationData?.data?.totalStatusChecklists || 0} status checklists completed
                                    </p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                      <div className="flex-col justify-end space-y-2">
                        <div className="flex justify-end gap-2 shrink-0">
                              <Link href={`/defects/${inspectionId}/${inspectionTemplateId}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Defects
                                </Button>
                              </Link>
                          <Button onClick={() => setCreateSectionDialogOpen(true)} size="sm">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Add Section</span>
                            <span className="sm:hidden">Add</span>
                          </Button>
                          <Popover open={settingsPopoverOpen} onOpenChange={setSettingsPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="icon">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1" align="end">
                              <div className="flex flex-col">
                                <button
                                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                  onClick={() => {
                                    setSettingsPopoverOpen(false);
                                    setTemplateSettingsModalOpen(true);
                                  }}
                                >
                                  Settings
                                </button>
                                <button
                                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                  onClick={() => {
                                    setSettingsPopoverOpen(false);
                                    setRestoreSectionModalOpen(true);
                                  }}
                                >
                                  Restore
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="relative w-64" ref={desktopSearchDropdownRef}>
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            ref={desktopSearchInputRef}
                            type="text"
                            placeholder="Search checklists"
                            className="w-64 pl-9"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onKeyDown={handleSearchKeyDown}
                            onFocus={() => searchQuery.length >= 3 && setShowSearchDropdown(true)}
                          />
                          {showSearchDropdown && (
                            <ChecklistSearchDropdown
                              results={searchResults?.data?.results || []}
                              isLoading={isSearching}
                              onSelect={handleSearchResultSelect}
                              searchQuery={searchQuery}
                              selectedIndex={selectedSearchIndex}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    <ChecklistContent
                      inspectionId={inspectionId}
                      inspectionTemplateId={inspectionTemplateId}
                      sectionId={selectedSectionId || ""}
                      subsectionId={selectedSubsectionId}
                      subsectionName={selectedSubsectionName}
                      sectionName={selectedSectionName}
                    />
                  </>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {/* Section Forms */}
      <InspectionTemplateSectionForm
        open={createSectionDialogOpen}
        onOpenChange={setCreateSectionDialogOpen}
        onSubmit={handleCreateSection}
        isSubmitting={createSectionMutation.isPending}
      />

      <InspectionTemplateSectionForm
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
          <InspectionTemplateSubsectionForm
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
            <InspectionTemplateSubsectionForm
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
        inspectionId={inspectionId}
        inspectionTemplateId={inspectionTemplateId}
      />

      {restoreSubsectionModalSectionId && (
        <RestoreSubsectionModal
          open={restoreSubsectionModalOpen}
          onOpenChange={setRestoreSubsectionModalOpen}
          inspectionId={inspectionId}
          inspectionTemplateId={inspectionTemplateId}
          sectionId={restoreSubsectionModalSectionId}
        />
      )}

      <InspectionTemplateSettingsModal
        open={templateSettingsModalOpen}
        onOpenChange={setTemplateSettingsModalOpen}
        inspectionId={inspectionId}
        inspectionTemplateId={inspectionTemplateId}
      />
    </div>
  );
}
