"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ImageEditorModal from '@/components/ImageEditorModal';
import DefectCard from '@/src/app/(authenticated)/inspections/[id]/edit/_components/DefectCard';
import { useDefectsBySubsectionQuery, useUpdateDefectMutation, useDeleteDefectMutation, type Defect } from '@/components/api/queries/defects';

interface DefectsSectionProps {
  inspectionId: string;
  templateId: string;
  sectionId: string;
  subsectionId: string;
  subsectionName?: string;
}

export function DefectsSection({
  inspectionId,
  templateId,
  sectionId,
  subsectionId,
  subsectionName,
}: DefectsSectionProps) {
  // TanStack Query hooks
  const { data: defects = [], isLoading, refetch } = useDefectsBySubsectionQuery({
    inspectionId,
    templateId,
    sectionId,
    subsectionId,
  });
  const updateDefectMutation = useUpdateDefectMutation();
  const deleteDefectMutation = useDeleteDefectMutation();

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'defect-main' | 'additional-location' | 'edit-additional'>('create');
  const [editorProps, setEditorProps] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<Defect>>({});
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const handleCreateDefect = () => {
    setEditorMode('create');
    setEditorProps({
      templateId,
      sectionId,
      subsectionId,
    });
    setImageEditorOpen(true);
  };

  const handleImageEditorSave = async (result: any) => {
    console.log('📥 Image editor save result:', result);
    await refetch();
    setImageEditorOpen(false);
    setEditorProps({}); // Clear editor props to ensure fresh data on next open
  };

  const handleDeleteDefect = async (defectId: string) => {
    if (!confirm('Are you sure you want to delete this defect?')) {
      return;
    }

    deleteDefectMutation.mutate(defectId);
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
    setEditedValues({ ...defect });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditedValues({});
  };

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
    updateDefectMutation.mutate(
      { 
        defectId, 
        updates: {
          ...updates,
          inspection_id: inspectionId, // Required by PATCH endpoint
        }
      },
      {
        onSuccess: () => {
          setLastSaved(new Date().toLocaleTimeString());
        }
      }
    );
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

  const handleUpdateLocationForImage = async (imageIndex: number, newLocation: string) => {
    if (!editingId) return;
    const defect = defects.find((d: Defect) => d._id === editingId);
    if (!defect || !defect.additional_images) return;

    const updatedImages = [...defect.additional_images];
    updatedImages[imageIndex] = { ...updatedImages[imageIndex], location: newLocation };
    await handleUpdateDefect(editingId, { additional_images: updatedImages });
  };

  const handleRemoveLocationPhoto = async (imageIndex: number) => {
    if (!editingId) return;
    const defect = defects.find((d: Defect) => d._id === editingId);
    if (!defect || !defect.additional_images) return;

    const updatedImages = defect.additional_images.filter((_: any, idx: number) => idx !== imageIndex);
    await handleUpdateDefect(editingId, { additional_images: updatedImages });
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

  const allLocationOptions: string[] = Array.from(
    new Set(defects.map((d: Defect) => d.location).filter(Boolean))
  );

  const filteredDefects = filterDefects(defects, searchQuery);

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

          {isLoading ? (
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
                        displayDefect={displayDefect}
                        isEditing={isEditing}
                        editingId={editingId}
                        editedValues={editedValues}
                        deleting={deleteDefectMutation.isPending ? defect._id : null}
                        autoSaving={updateDefectMutation.isPending}
                        lastSaved={lastSaved}
                        playingVideoId={playingVideoId}
                        inspectionId={inspectionId}
                        inspectionDetails={{}}
                        allLocationOptions={allLocationOptions}
                        onStartEditing={startEditing}
                        onCancelEditing={cancelEditing}
                        onDelete={handleDeleteDefect}
                        onFieldChange={(field, value) => {
                          setEditedValues(prev => {
                            let parsed: any = value;
                            if (field === 'material_total_cost' || field === 'labor_rate' || field === 'hours_required') {
                              const num = parseFloat(value);
                              parsed = isNaN(num) ? 0 : num;
                            }
                            return { ...prev, [field]: parsed };
                          });
                        }}
                        onAnnotateMainImage={handleAnnotateMainImage}
                        onAnnotateAdditionalImage={handleAnnotateAdditionalImage}
                        onUpdateLocationForImage={handleUpdateLocationForImage}
                        onRemoveLocationPhoto={handleRemoveLocationPhoto}
                        onSetPlayingVideoId={setPlayingVideoId}
                        onUpdateDefect={handleUpdateDefect}
                        getProxiedSrc={getProxiedSrc}
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
