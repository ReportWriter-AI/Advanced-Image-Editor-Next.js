"use client";

import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  templateId?: string;
  sectionId?: string;
  subsectionId?: string;
  image: string;
  location: string;
  section: string;
  subsection: string;
  defect_description: string;
  materials: string;
  material_total_cost: number;
  labor_type: string;
  labor_rate: number;
  hours_required: number;
  recommendation: string;
  title?: string;
  narrative?: string;
  severity?: string;
  trade?: string;
  color?: string;
  isThreeSixty?: boolean;
  additional_images?: Array<{ url: string; location: string; isThreeSixty?: boolean }>;
  base_cost?: number;
  annotations?: any[];
  originalImage?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

interface DefectDisplayProps {
  defects: Defect[];
}

// Helper function to get proxied image URL
const getProxiedSrc = (url: string | null | undefined) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('/api/proxy-image?') || url.startsWith('blob:')) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const calculateTotalCost = (defect: Defect): number => {
  const materialCost = defect.material_total_cost || 0;
  const laborCost = (defect.labor_rate || 0) * (defect.hours_required || 0);
  const baseCost = materialCost + laborCost;
  return baseCost;
};

const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const img = e.currentTarget;
  if (img.src && !img.src.includes('/api/proxy-image')) {
    img.src = getProxiedSrc(img.src);
  }
};

export function DefectDisplay({ defects }: DefectDisplayProps) {
  if (!defects || defects.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 mt-6">
      <h3 className="text-xl font-semibold">Defects</h3>
      {defects.map((defect, index) => (
        <Card key={defect._id} className="p-6">
          <div className="defect-header mb-4">
            <h4 className="text-lg font-semibold">Defect #{index + 1}</h4>
          </div>

          <div className="defect-content grid md:grid-cols-2 gap-6">
            {/* Image Section */}
            <div className="defect-image">
              {defect.isThreeSixty && defect.image ? (
                <ThreeSixtyViewer
                  imageUrl={getProxiedSrc(defect.image)}
                  alt={`360° view - ${defect.title || 'defect'}`}
                  height="400px"
                />
              ) : (
                <img
                  src={getProxiedSrc(defect.image) || "/placeholder-image.jpg"}
                  alt="Defect"
                  onError={handleImgError}
                  className="rounded-md w-full"
                />
              )}
            </div>

            {/* Details Section */}
            <div className="defect-details space-y-3">
              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Location:</strong>
                <span className="text-sm">{defect.location || 'Not specified'}</span>
              </div>

              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Section:</strong>
                <span className="text-sm">{defect.section || 'Not specified'}</span>
              </div>

              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Subsection:</strong>
                <span className="text-sm">{defect.subsection || 'Not specified'}</span>
              </div>

              {defect.title && (
                <div className="detail-row">
                  <strong className="block text-sm font-semibold mb-1">Title:</strong>
                  <span className="text-sm">{defect.title}</span>
                </div>
              )}

              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Description:</strong>
                <p className="text-sm">{defect.defect_description || 'No description available'}</p>
              </div>

              {defect.severity && (
                <div className="detail-row">
                  <strong className="block text-sm font-semibold mb-1">Severity:</strong>
                  <Badge variant="secondary">{defect.severity}</Badge>
                </div>
              )}

              {defect.trade && (
                <div className="detail-row">
                  <strong className="block text-sm font-semibold mb-1">Trade:</strong>
                  <span className="text-sm">{defect.trade}</span>
                </div>
              )}

              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Materials:</strong>
                <span className="text-sm">{defect.materials || 'No materials specified'}</span>
              </div>

              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Material Cost:</strong>
                <span className="text-sm">{formatCurrency(defect.material_total_cost || 0)}</span>
              </div>

              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Labor:</strong>
                <span className="text-sm">
                  {defect.labor_type || 'Not specified'} at {formatCurrency(defect.labor_rate || 0)}/hr
                </span>
              </div>

              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Hours:</strong>
                <span className="text-sm">{defect.hours_required || 0}</span>
              </div>

              <div className="detail-row">
                <strong className="block text-sm font-semibold mb-1">Recommendation:</strong>
                <p className="text-sm">{defect.recommendation || 'No recommendation available'}</p>
              </div>

              {defect.narrative && (
                <div className="detail-row">
                  <strong className="block text-sm font-semibold mb-1">Narrative:</strong>
                  <p className="text-sm">{defect.narrative}</p>
                </div>
              )}

              <div className="detail-row pt-4 border-t">
                <strong className="block text-sm font-semibold mb-1">Total Cost:</strong>
                <span className="text-lg font-bold">{formatCurrency(calculateTotalCost(defect))}</span>
              </div>
            </div>
          </div>

          {/* Additional Location Photos */}
          {defect.additional_images && defect.additional_images.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <strong className="block text-sm font-semibold mb-4">
                Additional Location Photos ({defect.additional_images.length})
              </strong>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {defect.additional_images.map((img, idx) => (
                  <div key={`${img.url}-${idx}`} className="space-y-2">
                    {img.isThreeSixty ? (
                      <div className="rounded-lg overflow-hidden" style={{ width: '100%', height: '200px' }}>
                        <ThreeSixtyViewer
                          imageUrl={getProxiedSrc(img.url)}
                          alt={img.location ? `360° photo - ${img.location}` : '360° photo'}
                          height="200px"
                          width="100%"
                        />
                      </div>
                    ) : (
                      <img
                        src={getProxiedSrc(img.url)}
                        alt={img.location || `Location ${idx + 2}`}
                        onError={handleImgError}
                        className="w-full h-48 object-cover rounded-md shadow-sm"
                      />
                    )}
                    {img.location && (
                      <p className="text-xs text-muted-foreground">{img.location}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
