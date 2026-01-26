//@ts-nocheck
"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ImageEditorModal from '@/components/ImageEditorModal';
import DefectCard from '@/src/app/(authenticated)/inspections/[id]/edit/_components/DefectCard';
import { useDeleteDefectMutation, type Defect } from '@/components/api/queries/defects';
import { useReusableDropdownsQuery } from '@/components/api/queries/reusableDropdowns';

interface DefectsSectionProps {
  inspectionId: string;
  templateId: string;
  sectionId: string;
  subsectionId: string;
  subsectionName?: string;
  sectionName?: string;
}

export function DefectsSection({
  inspectionId,
  templateId,
  sectionId,
  subsectionId,
  subsectionName,
  sectionName,
}: DefectsSectionProps) {
  // TanStack Query hooks
  const [loading, setLoading] = useState(false);

  const fetchDefects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/defects/by-subsection?inspectionId=${inspectionId}&templateId=${templateId}&sectionId=${sectionId}&subsectionId=${subsectionId}`);
      if (response.ok) {
        const data = await response.json();

        const safeData = Array.isArray(data) ? data : [];
        setDefects(safeData);
      } else {
        console.error('Failed to fetch defects');
        setDefects([]);
      }
    } catch (error) {
      console.error('Error fetching defects:', error);
      setDefects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefects();
  }, [inspectionId, templateId, sectionId, subsectionId]);


  const deleteDefectMutation = useDeleteDefectMutation();
  const { data: dropdownsData } = useReusableDropdownsQuery();

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'defect-main' | 'additional-location' | 'edit-additional'>('create');
  const [editorProps, setEditorProps] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<Defect>>({});
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const editedValuesRef = useRef<Partial<Defect>>({});
  const [autoSaving, setAutoSaving] = useState(false);
  const [defects, setDefects] = useState<Defect[]>([]);

  const handleCreateDefect = () => {
    setEditorMode('create');
    setEditorProps({
      templateId,
      sectionId,
      subsectionId,
      sectionName,
      subsectionName,
    });
    setImageEditorOpen(true);
  };

  const handleImageEditorSave = async (result: any) => {
    console.log('📥 Image editor save result:', result);
    
    // Refresh defects list after save
    await fetchDefects();
    
    // Only close modal if not in create mode
    // In create mode, modal stays open and props are preserved for creating multiple defects
    if (editorMode !== 'create') {
      setImageEditorOpen(false);
      setEditorProps({}); // Clear editor props to ensure fresh data on next open
    }
  };

  const handleDeleteDefect = async (defectId: string) => {
    if (!confirm('Are you sure you want to delete this defect?')) {
      return;
    }

    // Store the defect and its index for potential rollback
    const defectToDelete = defects.find(d => d._id === defectId);
    if (!defectToDelete) return;
    const originalIndex = defects.findIndex(d => d._id === defectId);

    // Optimistic update: immediately remove from UI
    setDefects(prev => prev.filter(d => d._id !== defectId));

    // If the defect was being edited, cancel editing
    if (editingId === defectId) {
      cancelEditing();
    }

    // Call the mutation with callbacks
    deleteDefectMutation.mutate(defectId, {
      onSuccess: () => {
        // State is already updated, optionally refetch to ensure sync with server
        fetchDefects();
      },
      onError: (error) => {
        // Revert optimistic update on error
        setDefects(prev => {
          // Restore the defect in its original position
          if (originalIndex === -1) {
            // If we can't find the original position, just add it to the end
            return [...prev, defectToDelete];
          }
          // Insert at original position
          const newDefects = [...prev];
          newDefects.splice(originalIndex, 0, defectToDelete);
          return newDefects;
        });
        console.error('Failed to delete defect:', error);
      },
    });
  };

  const filterDefects = (defects: Defect[], query: string): Defect[] => {
    if (!query.trim()) {
      return defects;
    }

    const searchTerm = query.toLowerCase().trim();
    return defects.filter((defect) => {
      const toSearchableString = (value: any): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).toLowerCase();
        return String(value).toLowerCase();
      };

      return Object.values(defect).some((value) => 
        toSearchableString(value).includes(searchTerm)
      );
    });
  };

  const startEditing = (defect: Defect) => {
    setEditingId(defect._id);
    const initialValues = { ...defect };
    setEditedValues(initialValues);
    editedValuesRef.current = initialValues;
    setLastSaved(null);
  };

  const cancelEditing = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setEditingId(null);
    setEditedValues({});
    editedValuesRef.current = {};
    setLastSaved(null);
  };

  const handleFieldChange = (field: keyof Defect, value: string) => {
    setEditedValues(prev => {
      let parsed: any = value;
      if (field === 'material_total_cost' || field === 'labor_rate' || field === 'hours_required') {
        const num = parseFloat(value);
        parsed = isNaN(num) ? 0 : num;
      }
      const updated = { ...prev, [field]: parsed };
      // Sync ref immediately with the updated value
      editedValuesRef.current = updated;
      return updated;
    });

    triggerAutoSave();
  };



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const calculateTotalCost = (defect: Defect): number => {
    const materialCost = defect.base_cost || defect.material_total_cost || 0;
    const laborCost = (defect.labor_rate || 0) * (defect.hours_required || 0);
    const baseCost = materialCost + laborCost;
    const imageCount = 1 + (defect.additional_images?.length || 0);
    return baseCost * imageCount;
  };

  const handleUpdateDefect = async (defectId: string, updates: Partial<Defect>) => {
    // Update local state immediately for UI feedback
    setDefects(prev => prev.map(d => d._id === defectId ? { ...d, ...updates } : d));
    if (editingId === defectId) {
      setEditedValues(prev => ({ ...prev, ...updates }));
    }

    // Get the defect to access inspection_id
    const defect = defects.find(d => d._id === defectId);
    if (!defect) {
      console.error('Defect not found for update');
      return;
    }

    // Persist changes to database
    try {
      const response = await fetch(`/api/defects/${defectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: defect.inspection_id,
          ...updates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to update defect on server:', errorData.error);
      } else {
        // Refetch defect data after successful update
        await fetchDefects();
      }
    } catch (error) {
      console.error('Error updating defect:', error);
    }
  };

  const handleAnnotateMainImage = (defect: Defect) => {
    setEditorMode('defect-main');
    setEditorProps({
      defectId: defect._id,
      imageUrl: defect.originalImage || defect.image,
      originalImageUrl: defect.originalImage || defect.image,
      preloadedAnnotations: defect.annotations || [],
    });
    setImageEditorOpen(true);
  };

  const handleAnnotateAdditionalImage = (defect: Defect, imageIndex: number) => {
    const additionalImage = defect.additional_images?.[imageIndex];
    if (!additionalImage) return;

    setEditorMode('edit-additional');
    setEditorProps({
      defectId: defect._id,
      editIndex: imageIndex,
      imageUrl: additionalImage.url,
      preloadedAnnotations: [],
    });
    setImageEditorOpen(true);
  };

  const handleUpdateLocationForImage = async (index: number, newLocation: string) => {

    if (!editingId) return;
    const defect = defects.find(d => d._id === editingId);
    if (!defect || !defect.additional_images) return;

    setEditedValues(prev => {
      const currentImages = (prev.additional_images as any) || defect.additional_images || [];
      const updatedImages = currentImages.map((img: any, i: number) =>
        i === index ? { ...img, location: newLocation } : img
      );

      return {
        ...prev,
        additional_images: updatedImages,
      };
    });

    const updatedImages = defect.additional_images.map((img, i) =>
      i === index ? { ...img, location: newLocation } : img
    );

    setDefects(prev =>
      prev.map(d =>
        d._id === editingId ? { ...d, additional_images: updatedImages } : d
      )
    );

    try {
      const response = await fetch(`/api/defects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: defect.inspection_id,
          additional_images: updatedImages,
        }),
      });

      if (!response.ok) {
        console.error('Failed to update location on server');
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const handleRemoveLocationPhoto = async (index: number) => {
    if (!editingId) return;
    const defect = defects.find(d => d._id === editingId);
    if (!defect || !defect.additional_images) return;

    const updatedImages = defect.additional_images.filter((_, i) => i !== index);

    try {
      const response = await fetch(`/api/defects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: defect.inspection_id,
          additional_images: updatedImages,
          material_total_cost: (defect.base_cost || defect.material_total_cost) * (1 + updatedImages.length),
        }),
      });

      if (response.ok) {
        setDefects(prev =>
          prev.map(d =>
            d._id === editingId
              ? { ...d, additional_images: updatedImages, material_total_cost: (d.base_cost || d.material_total_cost) * (1 + updatedImages.length) }
              : d
          )
        );
        setEditedValues(prev => ({
          ...prev,
          additional_images: updatedImages,
        }));
      }
    } catch (error) {
      console.error('Error removing location photo:', error);
      alert('Failed to remove photo');
    }
  };

  const getProxiedSrc = (url?: string | null): string => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    if (url.startsWith('blob:')) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    if (img.src && !img.src.includes('/api/proxy-image')) {
      img.src = getProxiedSrc(img.src);
    }
  };

  const allLocationOptions = useMemo(() => {
    if (!dropdownsData?.data?.location) return [];
    return dropdownsData.data.location.map((item: { id: string; value: string }) => item.value);
  }, [dropdownsData]);

  const filteredDefects = filterDefects(defects, searchQuery);

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 1000);
  }, [editingId, defects]);

  const performAutoSave = async () => {
    if (!editingId) return;
    const index = defects.findIndex(d => d._id === editingId);
    if (index === -1) return;

    const updated: Defect = { ...defects[index], ...(editedValuesRef.current as Defect) };

    setAutoSaving(true);

    try {
      const response = await fetch(`/api/defects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: updated.inspection_id,
          defect_description: updated.defect_description,
          materials: updated.materials,
          material_total_cost: updated.material_total_cost,
          location: updated.location,
          section: updated.section,
          subsection: updated.subsection,
          labor_type: updated.labor_type,
          labor_rate: updated.labor_rate,
          hours_required: updated.hours_required,
          recommendation: updated.recommendation,
          additional_images: updated.additional_images,
          base_cost: updated.base_cost,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Auto-save error:", errorData.error);
        return;
      }

      const result = await response.json();

      setDefects(prev =>
        prev.map(d => (d._id === editingId ? updated : d))
      );

      const now = new Date();
      setLastSaved(now.toLocaleTimeString());

    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      setAutoSaving(false);
    }
  };

  useEffect(() => {
    editedValuesRef.current = editedValues;
  }, [editedValues]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const getDisplayDefect = (defect: Defect): Defect => {
    if (editingId === defect._id) {
      const merged = { ...defect, ...(editedValues as Partial<Defect>) } as Defect;

      if (editedValues.additional_images !== undefined) {
        merged.additional_images = editedValues.additional_images as any;
      }

      return merged;
    }
    return defect;
  };

  if (!subsectionId) {
    return null;
  }

  return (
    <div className="mt-8 space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold">Defects</h3>
              {subsectionName && (
                <p className="text-sm text-muted-foreground">{subsectionName}</p>
              )}
            </div>
            <Button
              onClick={handleCreateDefect}
              className="bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] hover:from-[rgb(106,17,203)] hover:to-[rgb(75,108,183)]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Defect
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p>Loading defects...</p>
            </div>
          ) : defects.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed">
              <i className="fas fa-clipboard-list text-4xl text-muted-foreground mb-4"></i>
              <h3 className="text-xl font-semibold mb-2">No Defects Found</h3>
              <p className="text-muted-foreground mb-6">Start documenting findings for this subsection.</p>
              <Button
                onClick={handleCreateDefect}
                className="bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] hover:from-[rgb(106,17,203)] hover:to-[rgb(75,108,183)]"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Defect
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search defects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {filteredDefects.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No defects match your search.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredDefects.map((defect, index) => {
                    const displayDefect = getDisplayDefect(defect);
                    const isEditing = editingId === defect._id;
                    return (
                      <DefectCard
                        key={defect._id}
                        defect={defect}
                        index={index}
                        isEditing={isEditing}
                        editingId={editingId}
                        editedValues={editedValues}
                        deleting={deleteDefectMutation.isPending ? defect._id : null}
                        autoSaving={autoSaving}
                        lastSaved={lastSaved}
                        playingVideoId={playingVideoId}
                        inspectionId={inspectionId}
                        inspectionDetails={{}}
                        allLocationOptions={allLocationOptions}
                        onStartEditing={startEditing}
                        onCancelEditing={cancelEditing}
                        onDelete={handleDeleteDefect}
                        onFieldChange={handleFieldChange}
                        onAnnotateMainImage={handleAnnotateMainImage}
                        onAnnotateAdditionalImage={handleAnnotateAdditionalImage}
                        onUpdateLocationForImage={handleUpdateLocationForImage}
                        onRemoveLocationPhoto={handleRemoveLocationPhoto}
                        onSetPlayingVideoId={setPlayingVideoId}
                        onUpdateDefect={handleUpdateDefect}
                        getProxiedSrc={getProxiedSrc}
                        displayDefect={displayDefect}
                        handleImgError={handleImgError}
                        formatCurrency={formatCurrency}
                        calculateTotalCost={calculateTotalCost}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Image Editor Modal */}
      <ImageEditorModal
        key={`${editorMode}-${editorProps.defectId || 'create'}-${editorProps.editIndex || '0'}`}
        isOpen={imageEditorOpen}
        onClose={() => setImageEditorOpen(false)}
        mode={editorMode}
        inspectionId={inspectionId}
        onSave={handleImageEditorSave}
        {...editorProps}
      />
    </div>
  );
}
