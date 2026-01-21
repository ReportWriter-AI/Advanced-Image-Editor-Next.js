"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { InspectionTemplateChecklist } from "@/components/api/queries/inspectionTemplateChecklists";
import ThreeSixtyViewer from "@/components/ThreeSixtyViewer";
import styles from "@/src/app/user-report/user-report.module.css";
import { useMemo, useCallback, useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button as UiButton } from "@/components/ui/button";

interface ReportDisplayProps {
  inspectionId: string;
  templateId: string;
}

interface Defect {
  _id: string;
  inspection_id: any;
  templateId?: any;
  sectionId?: any;
  subsectionId?: any;
  image: string;
  location: string;
  section: string;
  subsection: string;
  defect_description: string;
  title: string;
  narrative: string;
  color?: string;
  isThreeSixty?: boolean;
  additional_images?: Array<{url: string; location: string; isThreeSixty?: boolean}>;
  base_cost?: number;
  material_total_cost?: number;
  labor_rate?: number;
  hours_required?: number;
  recommendation?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChecklistWithAnswers extends InspectionTemplateChecklist {
  textAnswer?: string;
  selectedAnswers?: string[];
  dateAnswer?: Date | string;
  numberAnswer?: number;
  numberUnit?: string;
  rangeFrom?: number;
  rangeTo?: number;
  rangeUnit?: string;
}

interface EnrichedDefect extends Defect {
  numbering: string;
  sectionName: string;
  subsectionName: string;
  heading2: string;
  color: string;
  sectionOrderIndex: number;
  estimatedCosts: {
    materialsCost: number;
    laborRate: number;
    hoursRequired: number;
    recommendation: string;
    totalEstimatedCost: number;
  };
}

// Helper function to get proxied image URL
const getProxiedSrc = (url: string | null | undefined) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('/api/proxy-image?') || url.startsWith('blob:')) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

// Color helper functions for defect categorization
const parseColorToRgb = (input?: string): { r: number; g: number; b: number } | null => {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  // #rgb or #rrggbb
  const hexMatch = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return { r, g, b };
  }
  // rgb() or rgba()
  const rgbMatch = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgbMatch) {
    const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)));
    return { r, g, b };
  }
  return null;
};

const baseColors: Record<'red' | 'orange' | 'blue' | 'purple', { r: number; g: number; b: number }> = {
  red: { r: 220, g: 38, b: 38 },      // #dc2626
  orange: { r: 245, g: 158, b: 11 },  // #f59e0b
  blue: { r: 59, g: 130, b: 246 },    // #3b82f6
  purple: { r: 124, g: 58, b: 237 },  // #7c3aed
};

const nearestCategory = (color?: string): 'red' | 'orange' | 'blue' | 'purple' | null => {
  const rgb = parseColorToRgb(color);
  if (!rgb) return null;
  let bestKey: 'red' | 'orange' | 'blue' | 'purple' | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const key of Object.keys(baseColors) as Array<'red' | 'orange' | 'blue' | 'purple'>) {
    const b = baseColors[key];
    const d = (rgb.r - b.r) ** 2 + (rgb.g - b.g) ** 2 + (rgb.b - b.b) ** 2;
    if (d < bestDist) { bestDist = d; bestKey = key; }
  }
  return bestKey;
};

const isHazardColor = (input?: string) => {
  const cat = nearestCategory(input);
  return cat === 'red' || cat === 'purple';
};

// Transform defects with section metadata and numbering
function transformDefectsWithSectionData(
  defects: Defect[],
  sections: any[]
): EnrichedDefect[] {
  if (!defects || defects.length === 0) return [];
  
  // Sort sections by orderIndex to get proper array indices
  const sortedSections = [...sections]
    .filter((s) => !s.deletedAt)
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  
  // Create maps for quick lookups including array indices
  const sectionMap = new Map<string, any>();
  const subsectionMap = new Map<string, { name: string; sectionId: string; subsectionIndex: number }>();
  
  sortedSections.forEach((section, sectionIndex) => {
    const sectionId = section._id?.toString();
    if (!sectionId) return;
    
    sectionMap.set(sectionId, {
      name: section.name,
      sectionIndex: sectionIndex + 1, // 1-based index
      orderIndex: section.orderIndex || 0,
    });
    
    // Sort subsections by orderIndex to get proper array indices
    const sortedSubsections = [...(section.subsections || [])]
      .filter((sub: any) => !sub.deletedAt)
      .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
    
    sortedSubsections.forEach((subsection: any, subsectionIndex: number) => {
      const subsectionId = subsection._id?.toString();
      if (!subsectionId) return;
      
      subsectionMap.set(subsectionId, {
        name: subsection.name,
        sectionId,
        subsectionIndex: subsectionIndex + 1, // 1-based index
      });
    });
  });
  
  // Sort defects by section orderIndex, then by subsection orderIndex, then by creation
  const sortedDefects = [...defects].sort((a, b) => {
    const aSectionId = typeof a.sectionId === 'string' ? a.sectionId : String(a.sectionId || '');
    const bSectionId = typeof b.sectionId === 'string' ? b.sectionId : String(b.sectionId || '');
    
    const aSectionInfo = sectionMap.get(aSectionId);
    const bSectionInfo = sectionMap.get(bSectionId);
    
    const aOrder = aSectionInfo?.orderIndex || 0;
    const bOrder = bSectionInfo?.orderIndex || 0;
    
    if (aOrder !== bOrder) return aOrder - bOrder;
    
    // Secondary sort by subsection
    const aSubId = typeof a.subsectionId === 'string' ? a.subsectionId : String(a.subsectionId || '');
    const bSubId = typeof b.subsectionId === 'string' ? b.subsectionId : String(b.subsectionId || '');
    const aSubInfo = subsectionMap.get(aSubId);
    const bSubInfo = subsectionMap.get(bSubId);
    const aSubOrder = aSubInfo?.subsectionIndex || 0;
    const bSubOrder = bSubInfo?.subsectionIndex || 0;
    
    if (aSubOrder !== bSubOrder) return aSubOrder - bSubOrder;
    
    // Tertiary sort by creation date
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aDate - bDate;
  });
  
  // Calculate defect numbering within each subsection
  const defectCounters = new Map<string, number>();
  
  const enrichedDefects = sortedDefects.map((defect) => {
    const sectionId = typeof defect.sectionId === 'string' ? defect.sectionId : String(defect.sectionId || '');
    const subsectionId = typeof defect.subsectionId === 'string' ? defect.subsectionId : String(defect.subsectionId || '');
    
    const sectionInfo = sectionMap.get(sectionId);
    const subsectionInfo = subsectionMap.get(subsectionId);
    
    const sectionNum = sectionInfo?.sectionIndex || 0;
    const subsectionNum = subsectionInfo?.subsectionIndex || 0;
    const sectionName = sectionInfo?.name || defect.section || 'Unknown Section';
    const subsectionName = subsectionInfo?.name || defect.subsection || 'Unknown Subsection';
    
    // Increment defect counter for this subsection
    const fullKey = `${sectionId}|||${subsectionId}`;
    const currentCount = defectCounters.get(fullKey) || 0;
    const defectNum = currentCount + 1;
    defectCounters.set(fullKey, defectNum);
    
    // Create display number: Section.Subsection.Defect (e.g., "4.1.2")
    const numbering = `${sectionNum}.${subsectionNum}.${defectNum}`;
    
    // Calculate total cost
    const materialCost = defect.base_cost || defect.material_total_cost || 0;
    const laborRate = defect.labor_rate || 0;
    const hoursRequired = defect.hours_required || 0;
    const photoCount = 1 + (defect.additional_images?.length || 0);
    const baseCost = defect.base_cost || (materialCost + (laborRate * hoursRequired));
    const totalEstimatedCost = baseCost * photoCount;
    
    // Create heading2: "Section - Subsection"
    const heading2 = `${sectionName} - ${subsectionName}`;
    
    return {
      ...defect,
      numbering,
      sectionName,
      subsectionName,
      heading2,
      color: defect.color || '#d63636',
      sectionOrderIndex: sectionNum,
      estimatedCosts: {
        materialsCost: materialCost,
        laborRate,
        hoursRequired,
        recommendation: defect.recommendation || '',
        totalEstimatedCost,
      },
    } as EnrichedDefect;
  });
  
  return enrichedDefects;
}

export function ReportDisplay({
  inspectionId,
  templateId,
}: ReportDisplayProps) {
  // State management
  const [filterMode, setFilterMode] = useState<'full' | 'summary' | 'hazard'>('full');
  const { isAuthenticated, user } = useAuth();
  
  // Sample report modal state
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleName, setSampleName] = useState("");
  const [sampleDescription, setSampleDescription] = useState("");
  const [sampleSaving, setSampleSaving] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: [`public-report-template-${inspectionId}-${templateId}`],
    queryFn: async () => {
      const response = await fetch(`/api/public/reports/${inspectionId}/templates/${templateId}`);
      if (!response.ok) throw new Error('Failed to fetch template');
      return response.json();
    },
    enabled: !!inspectionId && !!templateId,
  });

  // Fetch defects for this template
  const { data: defectsData, isLoading: defectsLoading } = useQuery({
    queryKey: ['public-defects', inspectionId, templateId],
    queryFn: async () => {
      const response = await fetch(
        `/api/public/reports/${inspectionId}/defects?templateId=${templateId}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch defects');
      }
      return response.json();
    },
    enabled: !!inspectionId && !!templateId,
  });

  // Fetch inspection data for header
  const { data: inspectionData } = useQuery({
    queryKey: ['public-inspection', inspectionId],
    queryFn: async () => {
      const response = await fetch(`/api/public/reports/${inspectionId}`);
      if (!response.ok) throw new Error('Failed to fetch inspection');
      return response.json();
    },
    enabled: !!inspectionId,
  });

  const inspection = inspectionData;

  // Get template and defects (hooks must be called before any conditional returns)
  const template = data?.template;
  const defects: Defect[] = defectsData || [];
  
  // Transform defects with section metadata - always call useMemo
  const enrichedDefects = useMemo(() => {
    if (!template?.sections) return [];
    return transformDefectsWithSectionData(defects, template.sections);
  }, [defects, template?.sections]);

  // Filter defects based on mode
  const filteredDefects = useMemo(() => {
    if (filterMode === 'hazard') {
      return enrichedDefects.filter((d) => isHazardColor(d.color));
    } else if (filterMode === 'summary') {
      return enrichedDefects.filter((d) => nearestCategory(d.color) !== 'blue');
    }
    return enrichedDefects;
  }, [enrichedDefects, filterMode]);

  // Smooth scroll to defect by ID
  const scrollToDefect = useCallback((defectId: string) => {
    const el = document.getElementById(defectId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Image error handler
  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    const current = img.getAttribute('src') || '';
    if (current && !current.startsWith('/api/proxy-image?') && !current.startsWith('data:')) {
      img.src = `/api/proxy-image?url=${encodeURIComponent(current)}`;
    } else {
      img.src = '/placeholder-image.jpg';
    }
  };

  // Sample report modal handlers
  const handleSampleModalChange = useCallback((open: boolean) => {
    setSampleModalOpen(open);
    if (!open) {
      setSampleError(null);
      setSampleSaving(false);
    }
  }, []);

  const handleOpenSampleModal = useCallback(() => {
    setSampleError(null);
    setSampleName(inspection?.orderId ? `Order #${inspection.orderId}` : inspection?.id ? `Inspection ${inspection.id.slice(-4)}` : "");
    setSampleDescription("");
    setSampleModalOpen(true);
  }, [inspection]);

  const handleSampleReportSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sampleName.trim()) {
      setSampleError("Name is required.");
      return;
    }

    if (!inspectionId) {
      setSampleError("Invalid inspection identifier.");
      return;
    }

    const trimmedDescription = sampleDescription.trim();
    const payload: Record<string, any> = {
      title: sampleName.trim(),
      description: trimmedDescription ? trimmedDescription : undefined,
      inspectionId: inspectionId,
    };

    const preferredUrl =
      (typeof inspection?.htmlReportUrl === "string" && inspection.htmlReportUrl.trim()) ||
      (typeof window !== "undefined"
        ? `${window.location.origin}/reports/${inspectionId}/${templateId}`
        : "");

    if (!preferredUrl) {
      setSampleError("Unable to determine report URL.");
      return;
    }

    payload.url = preferredUrl;

    try {
      setSampleSaving(true);
      setSampleError(null);

      const response = await fetch("/api/sample-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save sample report");
      }

      setSampleModalOpen(false);
    } catch (err: any) {
      setSampleError(err.message || "An error occurred while saving.");
    } finally {
      setSampleSaving(false);
    }
  };

  // Now handle conditional rendering after all hooks are called
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading report...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Failed to load report"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Template not found</p>
        </CardContent>
      </Card>
    );
  }
  
  // Group enriched defects by sectionId
  const defectsBySection: Record<string, EnrichedDefect[]> = {};
  enrichedDefects.forEach((defect) => {
    if (defect.sectionId) {
      const sectionIdStr = typeof defect.sectionId === 'string' 
        ? defect.sectionId 
        : String(defect.sectionId);
      
      if (!defectsBySection[sectionIdStr]) {
        defectsBySection[sectionIdStr] = [];
      }
      defectsBySection[sectionIdStr].push(defect);
    }
  });

  // Group checklists by section → subsection → type
  type SubsectionData = {
    status: ChecklistWithAnswers[];
    information: ChecklistWithAnswers[];
  };
  
  type SectionData = Record<string, SubsectionData>;
  
  const grouped: Record<string, SectionData> = {};

  const sections = template.sections || [];
  sections
    .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
    .forEach((section: any) => {
      if (section.deletedAt) return;

      const subsections = section.subsections || [];
      subsections
        .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
        .forEach((subsection: any) => {
          if (subsection.deletedAt) return;

          const checklists = subsection.checklists || [];
          const sortedChecklists = checklists
            .filter((c: ChecklistWithAnswers) => c.defaultChecked === true)
            .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));

          // Separate status and information checklists
          const statusChecklists = sortedChecklists.filter(
            (c: ChecklistWithAnswers) => c.type === "status"
          );
          const informationChecklists = sortedChecklists.filter(
            (c: ChecklistWithAnswers) => c.type === "information"
          );

          // Only add subsection if it has checklists
          if (statusChecklists.length > 0 || informationChecklists.length > 0) {
            if (!grouped[section.name]) {
              grouped[section.name] = {};
            }
            grouped[section.name][subsection.name] = {
              status: statusChecklists,
              information: informationChecklists,
            };
          }
        });
    });

  // Filter out sections with no data
  const sectionsWithData = Object.entries(grouped).filter(
    ([, subsections]) => Object.keys(subsections).length > 0
  );

  if (sectionsWithData.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No Information Is Added For This Report
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header Image Display */}

        <div className={styles.headerImageDisplay}>
          <img 
            src={inspection?.headerImage ? getProxiedSrc(inspection.headerImage) : `http://localhost:3000/api/inspections/${inspectionId}/client-view/map-image`} 
            alt="Report Header" 
            className={styles.headerImage}
            onError={handleImgError}
          />
          <div className={styles.headerTextContainer}>
            {(inspection?.location?.address || inspection?.location?.city || inspection?.location?.state || inspection?.location?.zip) && (
              <div style={{ textAlign:'center', marginBottom:'8px' }}>
                {inspection?.location?.address && (
                  <h1 className={styles.inspectionTitle} style={{ margin:'0 0 4px 0', fontSize:'1.75rem' }}>
                    {inspection.location.address}
                  </h1>
                )}
                {(inspection?.location?.city || inspection?.location?.state || inspection?.location?.zip) && (
                  <div style={{fontSize:'1.75rem', fontWeight:700, color:'#1f2937', marginTop:'2px'}}>
                    {[
                      inspection?.location?.city,
                      inspection?.location?.state,
                      inspection?.location?.zip
                    ].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            )}
            <h2 className={styles.reportTitle}>{template?.name || "HOME INSPECTION REPORT"}</h2>
          </div>
        </div>


      {/* Navigation Toolbar */}
      <div className={styles.reportToolbar} role="tablist" aria-label="Report view">
        <div className={styles.toolbarGroup}>
          <button
            role="tab"
            aria-selected={filterMode === 'full'}
            className={`${styles.toolbarBtn} ${filterMode === 'full' ? styles.toolbarBtnActive : ''}`}
            onClick={() => { setFilterMode('full'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            Full Report
          </button>
          <button
            role="tab"
            aria-selected={filterMode === 'summary'}
            className={`${styles.toolbarBtn} ${filterMode === 'summary' ? styles.toolbarBtnActive : ''}`}
            onClick={() => { setFilterMode('summary'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            Summary
          </button>
          <button
            role="tab"
            aria-selected={filterMode === 'hazard'}
            className={`${styles.toolbarBtn} ${styles.toolbarBtnDanger} ${filterMode === 'hazard' ? styles.toolbarBtnActive : ''}`}
            onClick={() => { setFilterMode('hazard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            Immediate Attention
          </button>
        </div>
        
        {/* Make a Sample Report button - only show if authenticated */}
        {isAuthenticated && (
          <div className={styles.toolbarRightGroup}>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={handleOpenSampleModal}
              disabled={sampleSaving}
            >
              Make A Sample Report
            </button>
          </div>
        )}
      </div>

      {/* Defects Summary Table */}
      {filteredDefects.length > 0 && (
        <section className={styles.summaryCard} aria-label="Inspection Defects">
          <div className={styles.summaryHeader}>
            <h2 className={styles.summaryTitle}>
              Inspection Defects
              <span style={{ fontSize: '0.65em', fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
                (clickable links)
              </span>
            </h2>
          </div>
          <div className={styles.summaryTableWrapper}>
            <table className={styles.summaryTable}>
              <thead>
                <tr>
                  <th scope="col">No.</th>
                  <th scope="col">Section</th>
                  <th scope="col">Defect</th>
                </tr>
              </thead>
              <tbody>
                {filteredDefects.map((defect) => {
                  const defectTitle = defect.narrative || defect.title || defect.defect_description?.split('\n')[0] || '';
                  const cat = nearestCategory(defect.color) || 'red';
                  let catClass = '';
                  if (cat === 'red') catClass = styles.summaryRowCatRed;
                  else if (cat === 'orange') catClass = styles.summaryRowCatOrange;
                  else if (cat === 'blue') catClass = styles.summaryRowCatBlue;
                  else if (cat === 'purple') catClass = styles.summaryRowCatPurple;

                  return (
                    <tr
                      key={defect._id}
                      className={`${styles.summaryRow} ${catClass}`}
                      onClick={() => scrollToDefect(defect._id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          scrollToDefect(defect._id);
                        }
                      }}
                      role="link"
                      tabIndex={0}
                      aria-label={`Jump to defect ${defect.numbering}: ${defectTitle}`}
                    >
                      <td>{defect.numbering}</td>
                      <td>{defect.heading2}</td>
                      <td>{defectTitle}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {sectionsWithData.map(([sectionName, subsections]) => {
        // Find the section ID for this section name to get defects
        const section = sections.find((s: any) => s.name === sectionName);
        const sectionId = section?._id?.toString();
        const allSectionDefects = sectionId ? defectsBySection[sectionId] || [] : [];
        
        // Filter defects based on current mode
        const sectionDefects = allSectionDefects.filter(d => 
          filteredDefects.some(fd => fd._id === d._id)
        );

        return (
          <div key={sectionName} className="space-y-6">
            {/* Checklists - Only show in Full Report mode */}
            {filterMode === 'full' && Object.entries(subsections).map(([subsectionName, data]) => {
              // Check if this subsection has status or information data
              const hasStatusData = data.status.length > 0;
              const hasInfoData = data.information.length > 0;

              return (
                <div key={`${sectionName}-${subsectionName}`} className="space-y-3">
                  {/* Title outside card */}
                  <h2 className="text-2xl font-bold text-gray-900">
                    {sectionName}: {subsectionName}
                  </h2>
                  
                  <Card>
                    <CardContent className="pt-6 space-y-8">
                      {/* Status Checklists */}
                      {hasStatusData && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-300 pb-2">Status</h3>
                          {renderSubsectionData(data.status, "status")}
                        </div>
                      )}
                      
                      {/* Information Checklists */}
                      {hasInfoData && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-300 pb-2">Information</h3>
                          {renderSubsectionData(data.information, "information")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
            
            {/* Render defects for this section - show in all modes but filtered */}
            {sectionDefects.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  {renderDefects(sectionDefects)}
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}
    </div>
    
    {/* Sample Report Modal */}
    <Dialog open={sampleModalOpen} onOpenChange={handleSampleModalChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Make A Sample Report</DialogTitle>
          <DialogDescription>
            Give this report a name and description to feature it on your Sample Reports page.
          </DialogDescription>
        </DialogHeader>
        <form
          id="make-sample-report-form"
          className="space-y-4"
          onSubmit={handleSampleReportSubmit}
        >
          <div className="space-y-2">
            <Label htmlFor="sample-report-name">Name</Label>
            <Input
              id="sample-report-name"
              value={sampleName}
              onChange={(event) => setSampleName(event.target.value)}
              placeholder="e.g. Premium Home Inspection"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sample-report-description">Description</Label>
            <Textarea
              id="sample-report-description"
              value={sampleDescription}
              onChange={(event) => setSampleDescription(event.target.value)}
              rows={4}
              placeholder="Add context that highlights what this sample showcases."
            />
            <p className="text-xs text-muted-foreground">
              This description appears alongside the sample on your Sample Reports page.
            </p>
          </div>
          {sampleError && <p className="text-sm text-red-600">{sampleError}</p>}
        </form>
        <DialogFooter>
          <UiButton
            type="button"
            variant="outline"
            onClick={() => handleSampleModalChange(false)}
            disabled={sampleSaving}
          >
            Cancel
          </UiButton>
          <UiButton
            type="submit"
            form="make-sample-report-form"
            disabled={sampleSaving}
          >
            {sampleSaving ? "Saving..." : "Save Sample Report"}
          </UiButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function renderSubsectionData(checklists: ChecklistWithAnswers[], type: "status" | "information" = "status") {
  if (checklists.length === 0) return null;

  // Use flex wrap for status, flex col for information
  const containerClass = type === "status" 
    ? "flex flex-wrap gap-4 pr-4 border-r-2" 
    : "flex flex-col space-y-4 pr-4 border-r-2";
  
  // For status, items take content width with minimum of 300px
  const itemClass = type === "status"
    ? "space-y-2 min-w-[300px] flex-shrink-0"
    : "space-y-2";

  return (
    <div className={containerClass}>
      {checklists.map((checklist) => (
        <div key={checklist._id} className={itemClass}>
          <div className="font-medium">
            {checklist.name}:
          </div>
          {checklist.location && (
            <p className="text-sm text-gray-700 font-medium">
              Location: {checklist.location}
            </p>
          )}
          {renderAnswer(checklist)}
          {checklist.comment && (
            <p className="text-sm text-muted-foreground">
              {checklist.comment}
            </p>
          )}
          {(checklist.type === 'status' || checklist.type === 'information') && checklist.media && renderMedia(checklist.media)}
        </div>
      ))}
    </div>
  );
}

function renderAnswer(checklist: ChecklistWithAnswers) {
  if (!checklist.field) {
    // For information checklists or checklists without field, just show checked state
    return null;
  }

  switch (checklist.field) {
    case "checkbox":
      return null;

    case "text":
      return checklist.textAnswer ? (
        <p className="text-sm">{checklist.textAnswer}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No answer provided</p>
      );

    case "multipleAnswers":
      if (checklist.selectedAnswers && checklist.selectedAnswers.length > 0) {
        return (
          <p className="text-sm">
            {checklist.selectedAnswers.join(', ')}
          </p>
        );
      }
      return (
        <p className="text-sm text-muted-foreground italic">No answers selected</p>
      );

    case "date":
      if (checklist.dateAnswer) {
        try {
          const date = new Date(checklist.dateAnswer);
          return (
            <p className="text-sm">{format(date, "PPP")}</p>
          );
        } catch (e) {
          return (
            <p className="text-sm text-muted-foreground italic">Invalid date</p>
          );
        }
      }
      return (
        <p className="text-sm text-muted-foreground italic">No date provided</p>
      );

    case "number":
      if (checklist.numberAnswer !== undefined && checklist.numberAnswer !== null) {
        return (
          <p className="text-sm">
            {checklist.numberAnswer}
            {checklist.numberUnit && ` ${checklist.numberUnit}`}
          </p>
        );
      }
      return (
        <p className="text-sm text-muted-foreground italic">No number provided</p>
      );

    case "numberRange":
      if (
        checklist.rangeFrom !== undefined &&
        checklist.rangeTo !== undefined &&
        checklist.rangeFrom !== null &&
        checklist.rangeTo !== null
      ) {
        return (
          <p className="text-sm">
            {checklist.rangeFrom} - {checklist.rangeTo}
            {checklist.rangeUnit && ` ${checklist.rangeUnit}`}
          </p>
        );
      }
      return (
        <p className="text-sm text-muted-foreground italic">No range provided</p>
      );

    default:
      return null;
  }
}

function renderMedia(mediaArray: Array<{ url: string; mediaType: 'image' | 'video' | '360pic'; location?: string; order: number }> | undefined) {
  if (!mediaArray || !Array.isArray(mediaArray) || mediaArray.length === 0) {
    return null;
  }

  // Filter out invalid entries and sort by order
  const validMedia = mediaArray
    .filter((item) => item && item.url && item.mediaType && typeof item.order === 'number')
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (validMedia.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {validMedia.map((mediaItem, index) => (
          <div key={index} className="space-y-2">
            {mediaItem.mediaType === '360pic' ? (
              <div className="rounded-lg overflow-hidden" style={{ width: '300px', maxWidth: '100%', height: 'auto' }}>
                <ThreeSixtyViewer
                  imageUrl={getProxiedSrc(mediaItem.url)}
                  alt={mediaItem.location ? `360° photo - ${mediaItem.location}` : '360° photo'}
                  height="300px"
                  width="300px"
                />
              </div>
            ) : mediaItem.mediaType === 'video' ? (
              <div className="rounded-lg overflow-hidden" style={{ width: '300px', maxWidth: '100%', height: 'auto' }}>
                <video
                  src={getProxiedSrc(mediaItem.url)}
                  controls
                  preload="metadata"
                  className="rounded-lg"
                  style={{ width: '300px', maxWidth: '100%', height: 'auto' }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={{ width: '300px', maxWidth: '100%', height: 'auto' }}>
                <img
                  src={getProxiedSrc(mediaItem.url)}
                  alt={mediaItem.location || `Image ${index + 1}`}
                  className="rounded-lg"
                  style={{ width: '300px', maxWidth: '100%', height: 'auto' }}
                  onError={(e) => {
                    console.error('Failed to load image:', mediaItem.url);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            {mediaItem.location && (
              <p className="text-xs text-muted-foreground text-center">
                {mediaItem.location}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper functions for defect rendering
const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const img = e.currentTarget;
  const current = img.getAttribute('src') || '';
  if (current && !current.startsWith('/api/proxy-image?') && !current.startsWith('data:')) {
    img.src = `/api/proxy-image?url=${encodeURIComponent(current)}`;
  } else {
    img.src = '/placeholder-image.jpg';
  }
};

const colorToImportance = (input?: string) => {
  const cat = nearestCategory(input);
  switch (cat) {
    case 'red': return 'Immediate Attention';
    case 'orange': return 'Items for Repair';
    case 'blue': return 'Maintenance Items';
    case 'purple': return 'Further Evaluation';
    default: return 'Immediate Attention';
  }
};

const formatCurrency = (amount: number) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  } catch {
    return `$${(amount || 0).toFixed(2)}`;
  }
};

function renderDefects(enrichedDefects: EnrichedDefect[]) {

  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900">Defects</h3>
      {enrichedDefects.map((defect) => {
        const title = defect.title || defect.defect_description?.split('\n')[0] || '';
        const hasCombinedSectionLabel = Boolean(defect.heading2);

        return (
          <div
            key={defect._id}
            id={defect._id}
            className={styles.defectCompactCard}
            style={{
              '--selected-color': defect.color,
            } as React.CSSProperties}
          >
            <div className={styles.defectCompactBody}>
              <div className={styles.defectCompactMedia}>
                {defect.isThreeSixty && defect.image ? (
                  <div className={styles.compactPanoramaWrapper}>
                    <ThreeSixtyViewer
                      imageUrl={getProxiedSrc(defect.image)}
                      alt={`360° view for ${defect.subsectionName || 'defect'}`}
                      width="100%"
                      height="100%"
                    />
                    <span className={styles.mediaBadge}>360°</span>
                  </div>
                ) : defect.image ? (
                  <img
                    src={getProxiedSrc(defect.image)}
                    alt="Defect thumbnail"
                    className={styles.defectThumb}
                    onError={handleImgError}
                    loading="eager"
                  />
                ) : (
                  <div className={styles.defectThumbPlaceholder}>No media</div>
                )}
              </div>
              <div className={styles.defectCompactInfo}>
                {/* Header line moved to right column (number • section • defect), then divider */}
                <div className={styles.defectInlineHeader}>
                  <span className={styles.defectHeaderText}>
                    <span className={styles.defectNumberPrefix}>{defect.numbering} - </span>
                    {hasCombinedSectionLabel && (
                      <span className={styles.defectSectionPart}>
                        {title}
                      </span>
                    )}
                  </span>
                  <span className={styles.importanceBadgeSmall} style={{ background: defect.color }}>
                    {colorToImportance(defect.color)}
                  </span>
                </div>
                <div className={styles.defectDivider} />

                {/* Meta line under header: heading2 • location */}
                <div className={styles.defectCompactSummary}>
                  {[
                    defect.heading2 || '',
                    defect.location || ''
                  ].filter(Boolean).join(' • ')}
                </div>

                {/* Body paragraph */}
                {defect.narrative && (
                  <div className={styles.defectParagraph}>
                    {defect.narrative}
                  </div>
                )}

                {/* Costs and recommendation */}
                <>
                  {defect.estimatedCosts?.recommendation && (
                    <div className={styles.defectRecommendation}>
                      Recommended: {defect.estimatedCosts.recommendation}
                    </div>
                  )}
                  <div className={styles.defectCostLine}>
                    Materials: {formatCurrency(defect.estimatedCosts?.materialsCost || 0)} • Labor: {formatCurrency(defect.estimatedCosts?.laborRate || 0)}/hr • Hours: {defect.estimatedCosts?.hoursRequired || 0}
                  </div>
                  <div className={`${styles.defectCostLine} ${styles.defectTotalLine}`}>
                    Total: {formatCurrency(defect.estimatedCosts?.totalEstimatedCost || 0)}
                  </div>
                </>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
