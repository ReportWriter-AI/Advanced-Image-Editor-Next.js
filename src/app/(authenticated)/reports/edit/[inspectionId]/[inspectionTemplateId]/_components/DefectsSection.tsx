"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ImageEditorModal from '@/components/ImageEditorModal';
import DefectCard, { type Defect } from '@/src/app/(authenticated)/inspections/[id]/edit/_components/DefectCard';

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
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'defect-main' | 'additional-location' | 'edit-additional'>('create');
  const [editorProps, setEditorProps] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<Defect>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  // Fetch defects for this subsection
  const fetchDefects = useCallback(async () => {
    if (!subsectionId) return;
    
    try {
      setLoading(true);
      const response = await fetch(
        `/api/defects/by-subsection?inspectionId=${inspectionId}&templateId=${templateId}&sectionId=${sectionId}&subsectionId=${subsectionId}`
      );
      
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
  }, [inspectionId, templateId, sectionId, subsectionId]);

  useEffect(() => {
    fetchDefects();
  }, [fetchDefects]);

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
    await fetchDefects();
    setImageEditorOpen(false);
  };

  const handleDeleteDefect = async (defectId: string) => {
    if (!confirm('Are you sure you want to delete this defect?')) {
      return;
    }

    try {
      setDeleting(defectId);
      const response = await fetch(`/api/defects/${defectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDefects(prev => prev.filter(defect => defect._id !== defectId));
      } else {
        alert('Failed to delete defect. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting defect:', error);
      alert('Error deleting defect. Please try again.');
    } finally {
      setDeleting(null);
    }
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
                        displayDefect={displayDefect}
                        isEditing={isEditing}
                        editedValues={editedValues}
                        deleting={deleting}
                        inspectionId={inspectionId}
                        startEditing={startEditing}
                        cancelEditing={cancelEditing}
                        handleDeleteDefect={handleDeleteDefect}
                        handleFieldChange={(field, value) => {
                          setEditedValues(prev => {
                            let parsed: any = value;
                            if (field === 'material_total_cost' || field === 'labor_rate' || field === 'hours_required') {
                              const num = parseFloat(value);
                              parsed = isNaN(num) ? 0 : num;
                            }
                            return { ...prev, [field]: parsed };
                          });
                        }}
                        formatCurrency={formatCurrency}
                        calculateTotalCost={calculateTotalCost}
                        inspectionDetails={{}}
                        setEditorMode={setEditorMode}
                        setEditorProps={setEditorProps}
                        setImageEditorOpen={setImageEditorOpen}
                        setEditedValues={setEditedValues}
                        setDefects={setDefects}
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
