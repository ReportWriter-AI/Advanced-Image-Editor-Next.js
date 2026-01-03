"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import LocationSearch from '@/components/LocationSearch';
import FileUpload from '@/components/FileUpload';
import { LOCATION_OPTIONS } from '@/constants/locations';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const ThreeSixtyViewer = dynamic(() => import('@/components/ThreeSixtyViewer'), { 
  ssr: false,
  loading: () => (
    <div style={{ 
      width: '100%', 
      height: '400px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#000',
      borderRadius: '8px'
    }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', color: 'white' }}></i>
    </div>
  )
});

export interface Defect {
  _id: string;
  inspection_id: string;
  image: string;
  location: string;
  section: string;
  subsection: string;
  defect_description: string;
  defect_short_description: string;
  materials: string;
  material_total_cost: number;
  labor_type: string;
  labor_rate: number;
  hours_required: number;
  recommendation: string;
  color?: string;
  type: string;
  thumbnail: string;
  video: string;
  isThreeSixty?: boolean;
  additional_images?: Array<{ url: string; location: string; isThreeSixty?: boolean }>;
  base_cost?: number;
  annotations?: any[];
  originalImage?: string;
}

interface InspectionDetails {
  hidePricing?: boolean;
  [key: string]: any;
}

interface BulkItem {
  file: File;
  preview: string;
  location: string;
  isThreeSixty: boolean;
}

interface DefectCardProps {
  defect: Defect;
  index: number;
  isEditing: boolean;
  editingId: string | null;
  editedValues: Partial<Defect>;
  deleting: string | null;
  autoSaving: boolean;
  lastSaved: string | null;
  playingVideoId: string | null;
  inspectionId: string;
  inspectionDetails: InspectionDetails;
  allLocationOptions: string[];
  displayDefect: Defect;
  onStartEditing: (defect: Defect) => void;
  onCancelEditing: () => void;
  onDelete: (defectId: string) => void;
  onFieldChange: (field: keyof Defect, value: string) => void;
  onAnnotateMainImage: (defect: Defect) => void;
  onUpdateLocationForImage: (index: number, newLocation: string) => void;
  onRemoveLocationPhoto: (index: number) => void;
  onAddNewLocation: (newLocation: string) => void;
  onSetPlayingVideoId: (id: string | null) => void;
  onUpdateDefect: (defectId: string, updates: Partial<Defect>) => void;
  getProxiedSrc: (url?: string | null) => string;
  handleImgError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  formatCurrency: (amount: number) => string;
  calculateTotalCost: (defect: Defect) => number;
}

export default function DefectCard({
  defect,
  index,
  isEditing,
  editingId,
  editedValues,
  deleting,
  autoSaving,
  lastSaved,
  playingVideoId,
  inspectionId,
  inspectionDetails,
  allLocationOptions,
  displayDefect,
  onStartEditing,
  onCancelEditing,
  onDelete,
  onFieldChange,
  onAnnotateMainImage,
  onUpdateLocationForImage,
  onRemoveLocationPhoto,
  onAddNewLocation,
  onSetPlayingVideoId,
  onUpdateDefect,
  getProxiedSrc,
  handleImgError,
  formatCurrency,
  calculateTotalCost,
}: DefectCardProps) {
  const [bulkAddOpen, setBulkAddOpen] = useState<boolean>(false);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkSaving, setBulkSaving] = useState<boolean>(false);

  const handleBulkAdd = async () => {
    if (!editingId) return;
    if (!defect) return;
    setBulkSaving(true);
    try {
      const updatedImages = [...(defect.additional_images || [])];
      for (const item of bulkItems) {
        const fd = new FormData();
        fd.append('file', item.file);
        const uploadRes = await fetch('/api/r2api', { method: 'POST', body: fd });
        if (!uploadRes.ok) throw new Error('Upload failed');
        const { url } = await uploadRes.json();
        updatedImages.push({ url, location: item.location || defect.location || '', isThreeSixty: item.isThreeSixty });
      }
      onUpdateDefect(editingId, { additional_images: updatedImages });
      setBulkItems([]);
      setBulkAddOpen(false);
    } catch (e) {
      alert('Failed to add photos. Please try again.');
      console.error(e);
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="defect-card border rounded-lg p-6">
      <div className="defect-header flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Defect #{index + 1}</h3>
        <div className="defect-actions flex items-center gap-2">
          {!isEditing && (
            <button
              className="professional-edit-btn px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onStartEditing(defect)}
              title="Edit defect"
            >
              <i className="fas fa-edit"></i>
            </button>
          )}
          {isEditing && (
            <>
              <div className="auto-save-indicator mr-2 text-xs flex items-center gap-2">
                {autoSaving ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <i className="fas fa-check-circle text-green-600"></i>
                    <span>Saved at {lastSaved}</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-info-circle"></i>
                    <span>Auto-save enabled</span>
                  </>
                )}
              </div>
              <button 
                className="cancel-defect-btn px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700" 
                onClick={onCancelEditing}
                title="Done editing"
              >
                <i className="fas fa-check"></i>
              </button>
            </>
          )}
          <button
            className="delete-defect-btn px-3 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onDelete(defect._id)}
            disabled={deleting === defect._id}
          >
            {deleting === defect._id ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-trash"></i>
            )}
          </button>
        </div>
      </div>

      <div className="defect-content grid md:grid-cols-2 gap-6">
        <div className="defect-image">
          {displayDefect.isThreeSixty && displayDefect.image ? (
            <ThreeSixtyViewer
              imageUrl={getProxiedSrc(displayDefect.image)}
              alt={`360° view - ${displayDefect.defect_short_description || 'defect'}`}
              height="400px"
            />
          ) : displayDefect.type === "video" && displayDefect.video ? (
            <>
              {playingVideoId !== displayDefect._id ? (
                <img
                  src={getProxiedSrc(displayDefect.thumbnail) || "/placeholder-image.jpg"}
                  alt="Video thumbnail"
                  className="max-w-full max-h-[200px] cursor-pointer rounded-md"
                  onError={handleImgError}
                  onClick={() => onSetPlayingVideoId(displayDefect._id)}
                />
              ) : (
                <video
                  src={getProxiedSrc(displayDefect.video)}
                  controls
                  autoPlay
                  className="max-w-full max-h-[200px] rounded-md"
                />
              )}
            </>
          ) : (
            <img
              src={
                getProxiedSrc(displayDefect.image) ||
                getProxiedSrc(displayDefect.thumbnail) ||
                "/placeholder-image.jpg"
              }
              alt="Defect"
              onError={handleImgError}
              className="rounded-md w-full"
            />
          )}
          {displayDefect.image && !displayDefect.isThreeSixty && displayDefect.type !== "video" && (
            <button
              onClick={() => onAnnotateMainImage(displayDefect)}
              className="mt-2 w-full px-3 py-2 text-sm rounded-md border border-purple-600 bg-purple-600 text-white font-semibold hover:bg-purple-700"
            >
              <i className="fas fa-pencil-alt mr-2"></i>
              Annotate
            </button>
          )}
        </div>
        <div className="defect-details space-y-3">
          <div className="detail-row">
            <strong className="block text-sm font-semibold mb-1">Location:</strong>
            {isEditing ? (
              <LocationSearch
                options={allLocationOptions}
                value={editedValues.location ?? displayDefect.location ?? ''}
                onChangeAction={(val) => onFieldChange('location', val)}
                placeholder="Select location…"
                width={220}
              />
            ) : (
              <span className="text-sm">{displayDefect.location || 'Not specified'}</span>
            )}
          </div>
          <div className="detail-row">
            <strong className="block text-sm font-semibold mb-1">Section:</strong>
            {isEditing ? (
              <Input
                type="text"
                value={editedValues.section ?? displayDefect.section ?? ''}
                onChange={(e) => onFieldChange('section', e.target.value)}
              />
            ) : (
              <span className="text-sm">{displayDefect.section || 'Not specified'}</span>
            )}
          </div>
          <div className="detail-row">
            <strong className="block text-sm font-semibold mb-1">Subsection:</strong>
            {isEditing ? (
              <Input
                type="text"
                value={editedValues.subsection ?? displayDefect.subsection ?? ''}
                onChange={(e) => onFieldChange('subsection', e.target.value)}
              />
            ) : (
              <span className="text-sm">{displayDefect.subsection || 'Not specified'}</span>
            )}
          </div>
          <div className="detail-row">
            <strong className="block text-sm font-semibold mb-1">Description:</strong>
            {isEditing ? (
              <Textarea
                className="min-h-[80px]"
                value={editedValues.defect_description ?? displayDefect.defect_description ?? ''}
                onChange={(e) => onFieldChange('defect_description', e.target.value)}
              />
            ) : (
              <p className="text-sm">{displayDefect.defect_description || 'No description available'}</p>
            )}
          </div>
          
          {!inspectionDetails.hidePricing && (
            <>
              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Materials:</strong>
                {isEditing ? (
                  <Input
                    type="text"
                    value={editedValues.materials ?? displayDefect.materials ?? ''}
                    onChange={(e) => onFieldChange('materials', e.target.value)}
                  />
                ) : (
                  <span className="text-sm">{displayDefect.materials || 'No materials specified'}</span>
                )}
              </div>
              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Material Cost:</strong>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={String(editedValues.material_total_cost ?? displayDefect.material_total_cost ?? 0)}
                    onChange={(e) => onFieldChange('material_total_cost', e.target.value)}
                  />
                ) : (
                  <span className="text-sm">{formatCurrency(displayDefect.material_total_cost || 0)}</span>
                )}
              </div>
              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Labor:</strong>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      type="text"
                      value={editedValues.labor_type ?? displayDefect.labor_type ?? ''}
                      onChange={(e) => onFieldChange('labor_type', e.target.value)}
                    />
                    <span className="text-sm">at</span>
                    <Input
                      className="w-24"
                      type="number"
                      step="0.01"
                      value={String(editedValues.labor_rate ?? displayDefect.labor_rate ?? 0)}
                      onChange={(e) => onFieldChange('labor_rate', e.target.value)}
                    />
                    <span className="text-sm">/hr</span>
                  </div>
                ) : (
                  <span className="text-sm">{displayDefect.labor_type || 'Not specified'} at {formatCurrency(displayDefect.labor_rate || 0)}/hr</span>
                )}
              </div>
              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Hours:</strong>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.1"
                    value={String(editedValues.hours_required ?? displayDefect.hours_required ?? 0)}
                    onChange={(e) => onFieldChange('hours_required', e.target.value)}
                  />
                ) : (
                  <span className="text-sm">{displayDefect.hours_required || 0}</span>
                )}
              </div>
            </>
          )}
          
          <div className="detail-row">
            <strong className="block text-sm font-semibold mb-1">Recommendation:</strong>
            {isEditing ? (
              <Textarea
                className="min-h-[80px]"
                value={editedValues.recommendation ?? displayDefect.recommendation ?? ''}
                onChange={(e) => onFieldChange('recommendation', e.target.value)}
              />
            ) : (
              <p className="text-sm">{displayDefect.recommendation || 'No recommendation available'}</p>
            )}
          </div>

          {/* Additional Location Photos Section */}
          {isEditing && (
            <div className="mt-6 p-4 bg-muted rounded-md border">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <strong className="text-sm">
                  📍 Additional Location Photos ({displayDefect.additional_images?.length || 0})
                </strong>
                <button
                  onClick={() => setBulkAddOpen((v) => !v)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90"
                >
                  {bulkAddOpen ? 'Close' : 'Add Another Locations For This Defect'}
                </button>
              </div>

              {bulkAddOpen && (
                <div className="mb-4 p-3 bg-card border rounded-md">
                  <p className="mb-2 text-sm font-semibold">Select multiple photos and set a location for each:</p>
                  <FileUpload
                    onFilesSelect={(files) => {
                      const mapped = files.map((file) => ({
                        file,
                        preview: URL.createObjectURL(file),
                        location: '',
                        isThreeSixty: false,
                      }));
                      setBulkItems((prev) => [...prev, ...mapped]);
                    }}
                  />
                  {bulkItems.length > 0 && (
                    <div className="bulk-items-list mt-3 space-y-3">
                      {bulkItems.map((item, i) => (
                        <div key={i} className="bulk-item-row flex flex-wrap gap-3 items-center py-3 border-b">
                          <img src={item.preview} alt={`bulk-${i}`} className="w-20 h-20 object-cover rounded-md shadow-sm" />
                          <div className="flex-1 min-w-[260px]">
                            <label className="block text-xs mb-1 font-medium">Location</label>
                            <LocationSearch
                              options={allLocationOptions}
                              onAddNew={onAddNewLocation}
                              value={item.location}
                              onChangeAction={(val) => setBulkItems((prev) => {
                                const copy = [...prev];
                                copy[i] = { ...copy[i], location: val };
                                return copy;
                              })}
                              placeholder="Type to search…"
                              width="100%"
                            />
                            <label className="inline-flex items-center gap-2 mt-2 text-xs">
                              <input type="checkbox" checked={item.isThreeSixty} onChange={(e) => setBulkItems((prev) => {
                                const copy = [...prev];
                                copy[i] = { ...copy[i], isThreeSixty: e.target.checked };
                                return copy;
                              })} />
                              This is a 360° photo
                            </label>
                          </div>
                          <button
                            onClick={() => setBulkItems((prev) => prev.filter((_, idx) => idx !== i))}
                            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="bulk-items-actions flex justify-center gap-2 mt-3">
                        <button
                          disabled={bulkSaving || bulkItems.length === 0}
                          onClick={handleBulkAdd}
                          className="px-4 py-2 bg-green-600 text-white rounded-md font-semibold disabled:opacity-50"
                        >
                          {bulkSaving ? 'Saving…' : 'Add All'}
                        </button>
                        <button onClick={() => { setBulkItems([]); setBulkAddOpen(false); }} className="px-4 py-2 bg-muted text-foreground rounded-md">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {displayDefect.additional_images && displayDefect.additional_images.length > 0 && (
                <div className="additional-items-list space-y-3">
                  {displayDefect.additional_images.map((img, idx) => {
                    const locationValue = img.location || "";
                    return (
                    <div key={`${img.url}-${idx}`} className="additional-item-row flex flex-wrap gap-3 items-center py-3 border-b">
                      <img 
                        src={getProxiedSrc(img.url)} 
                        alt={`Location ${idx + 2}`}
                        onError={handleImgError}
                        className="w-20 h-20 object-cover rounded-md shadow-sm"
                      />
                      <div className="flex-1 min-w-[260px]">
                        <label className="block text-xs mb-1 font-medium">
                          Location:
                        </label>
                        <LocationSearch
                          key={`location-${displayDefect._id}-${idx}-${img.url}`}
                          options={LOCATION_OPTIONS}
                          value={locationValue}
                          onChangeAction={(val) => {
                            onUpdateLocationForImage(idx, val);
                          }}
                          placeholder="Type to search…"
                          width="100%"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const editorUrl = `/image-editor/?inspectionId=${encodeURIComponent(inspectionId)}&imageUrl=${encodeURIComponent(img.url)}&mode=edit-additional&defectId=${encodeURIComponent(displayDefect._id)}&index=${idx}`;
                          window.open(editorUrl, '_blank');
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium mr-2"
                        title="Annotate this photo"
                      >
                        Annotate
                      </button>
                      <button
                        onClick={() => onRemoveLocationPhoto(idx)}
                        className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                    );
                  })}
                </div>
              )}
              
              {(!displayDefect.additional_images || displayDefect.additional_images.length === 0) && (
                <p className="text-xs text-muted-foreground italic">
                  No additional location photos yet. Click "Add Location Photo" to add photos from different locations with the same defect.
                </p>
              )}
            </div>
          )}

          {!inspectionDetails.hidePricing && (
            <div className="detail-row pt-4 border-t">
              <strong className="block text-sm font-semibold mb-1">Total Cost:</strong>
              <span className="text-lg font-bold">
                {formatCurrency(
                  calculateTotalCost({
                    ...displayDefect,
                    material_total_cost: Number(
                      isEditing
                        ? editedValues.material_total_cost ?? displayDefect.material_total_cost ?? 0
                        : displayDefect.material_total_cost ?? 0
                    ),
                    labor_rate: Number(
                      isEditing
                        ? editedValues.labor_rate ?? displayDefect.labor_rate ?? 0
                        : displayDefect.labor_rate ?? 0
                    ),
                    hours_required: Number(
                      isEditing
                        ? editedValues.hours_required ?? displayDefect.hours_required ?? 0
                        : displayDefect.hours_required ?? 0
                    ),
                  } as Defect)
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

