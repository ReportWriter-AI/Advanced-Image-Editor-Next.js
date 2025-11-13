"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAnalysisStore } from "@/lib/store";
import styles from "./user-report.module.css";

interface ReportSection {
  id: number;
  heading: string;
  image: string | File | null;
  defect: string;
  location: string;
  section: string;
  subSection: string;
  estimatedCosts: {
    materials: string;
    materialsCost: number;
    labor: string;
    laborRate: number;
    hoursRequired: number;
    recommendation: string;
    totalEstimatedCost: number;
  };
}

type DefectTextParts = {
  title: string;
  body: string;
  paragraphs: string[];
};

const splitDefectText = (raw?: string): DefectTextParts => {
  const normalized = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { title: "", body: "", paragraphs: [] };
  }

  const paragraphBlocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (paragraphBlocks.length > 1) {
    const [title, ...rest] = paragraphBlocks;
    return {
      title,
      body: rest.join("\n\n").trim(),
      paragraphs: rest,
    };
  }

  const lineBlocks = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lineBlocks.length > 1) {
    const [title, ...restLines] = lineBlocks;
    const restCombined = restLines.join(" ").trim();
    return {
      title,
      body: restCombined,
      paragraphs: restCombined ? [restCombined] : [],
    };
  }

  const colonMatch = normalized.match(/^([^:]{3,120}):\s*([\s\S]+)$/);
  if (colonMatch) {
    const [, title, remainder] = colonMatch;
    const trimmedRemainder = remainder.trim();
    const paragraphs = trimmedRemainder
      ? trimmedRemainder.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      : [];
    return {
      title: title.trim(),
      body: trimmedRemainder,
      paragraphs: paragraphs.length ? paragraphs : trimmedRemainder ? [trimmedRemainder] : [],
    };
  }

  const dashMatch = normalized.match(/^([^–-]{3,120})[–-]\s*([\s\S]+)$/);
  if (dashMatch) {
    const [, title, remainder] = dashMatch;
    const trimmedRemainder = remainder.trim();
    const paragraphs = trimmedRemainder
      ? trimmedRemainder.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      : [];
    return {
      title: title.trim(),
      body: trimmedRemainder,
      paragraphs: paragraphs.length ? paragraphs : trimmedRemainder ? [trimmedRemainder] : [],
    };
  }

  const periodIndex = normalized.indexOf(".");
  if (periodIndex > 0 && periodIndex < normalized.length - 1) {
    const title = normalized.slice(0, periodIndex).trim();
    const remainder = normalized.slice(periodIndex + 1).trim();
    const paragraphs = remainder
      ? remainder.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      : [];
    return {
      title,
      body: remainder,
      paragraphs: paragraphs.length ? paragraphs : remainder ? [remainder] : [],
    };
  }

  return { title: normalized, body: "", paragraphs: [] };
};

export default function UserReport() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    defect: "",
    location: "",
    materials: "",
    materialsCost: 0,
    labor: "",
    laborRate: 0,
    hoursRequired: 0,
    recommendation: "",
    totalEstimatedCost: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false)

  const { analysisData, updateAnalysisData } = useAnalysisStore();

  // Get the selected arrow color for dynamic styling
  const getSelectedColor = () => {
    const color = analysisData?.selectedArrowColor || '#d63636'; // Default to red if not set
    console.log('Selected arrow color:', color);
    return color;
  };

  // Get a lighter shade of the selected color for gradients
  const getLightColor = () => {
    const color = getSelectedColor();
    // Convert hex to RGB and lighten it
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgb(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)})`;
  };

  // Initialize from store
  useEffect(() => {
    if (!analysisData) {
      router.push("/");
    } else {
      const { analysisResult } = analysisData;
      setEditedData({
        defect: analysisResult?.defect || "",
        location: analysisData.location || "",
        materials: analysisResult?.materials_names || "",
        materialsCost: Number(analysisResult?.materials_total_cost) || 0,
        labor: analysisResult?.labor_type || "",
        laborRate: Number(analysisResult?.labor_rate) || 0,
        hoursRequired: Number(analysisResult?.hours_required) || 0,
        recommendation: analysisResult?.recommendation || "",
        totalEstimatedCost: Number(analysisResult?.total_estimated_cost) || 0,
      });
    }
  }, [analysisData, router]);

  // Set current date
  useEffect(() => {
    const now = new Date();
    setCurrentDate(
      now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  // Auto-calc total cost
  useEffect(() => {
    const totalLaborCost = editedData.hoursRequired * editedData.laborRate;
    const total = editedData.materialsCost + totalLaborCost;
    setEditedData((prev) => ({
      ...prev,
      totalEstimatedCost: total,
    }));
  }, [editedData.materialsCost, editedData.hoursRequired, editedData.laborRate]);

  const handleEdit = () => setIsEditing(true);

  const handleSave = () => {
    if (analysisData) {
      const updatedAnalysisData = {
        ...analysisData,
        location: editedData.location,
        analysisResult: {
          ...analysisData.analysisResult,
          defect: editedData.defect,
          recommendation: editedData.recommendation,
          materials_names: editedData.materials,
          materials_total_cost: editedData.materialsCost,
          labor_type: editedData.labor,
          hours_required: editedData.hoursRequired,
          labor_rate: editedData.laborRate,
          total_estimated_cost: editedData.totalEstimatedCost,
        },
      };
      updateAnalysisData(updatedAnalysisData);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (analysisData) {
      const { analysisResult } = analysisData;
      setEditedData({
        defect: analysisResult?.defect || "",
        location: analysisData.location || "",
        materials: analysisResult?.materials_names || "",
        materialsCost: Number(analysisResult?.materials_total_cost) || 0,
        labor: analysisResult?.labor_type || "",
        laborRate: Number(analysisResult?.labor_rate) || 0,
        hoursRequired: Number(analysisResult?.hours_required) || 0,
        recommendation: analysisResult?.recommendation || "",
        totalEstimatedCost: Number(analysisResult?.total_estimated_cost) || 0,
      });
    }
    setIsEditing(false);
  };

  const handleInputChange = (field: string, value: string | number) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveReport = async () => {
    if (isSubmitting) {
      return
    } else {
      setIsSubmitting(true)
    }
    console.log("Save Report clicked!");
    console.log("Current analysis data:", analysisData);
    console.log("Edited data:", editedData);
    console.log("Report saved successfully!");

    let imageurl = ''
    // Direct-to-R2 upload via presigned URL (avoids Vercel bandwidth/limits)
    try {
      let fileToUpload: File | null = null;
      if (analysisData?.imageFile instanceof File) {
        fileToUpload = analysisData.imageFile;
      } else if (typeof analysisData?.image === 'string') {
        // Fallback: convert data URL or remote URL to File
        try {
          const directResp = await fetch(analysisData.image);
          const blob = await directResp.blob();
          fileToUpload = new File([blob], `upload-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        } catch (e) {
          // If CORS blocks direct fetch, retry via proxy endpoint
          try {
            const proxied = `/api/proxy-image?url=${encodeURIComponent(analysisData.image)}`;
            const proxyResp = await fetch(proxied);
            const blob = await proxyResp.blob();
            fileToUpload = new File([blob], `upload-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
          } catch (e2) {
            console.error('Failed to fetch image for upload:', e2);
          }
        }
      }

      if (!fileToUpload) {
        throw new Error('No image file available for upload');
      }

      // Get presigned URL
      const presignedRes = await fetch(
        `/api/r2api?action=presigned&fileName=${encodeURIComponent(fileToUpload.name)}&contentType=${encodeURIComponent(fileToUpload.type || 'application/octet-stream')}`
      );
      if (!presignedRes.ok) {
        const t = await presignedRes.text();
        throw new Error(`Failed to get presigned URL: ${t}`);
      }
      const { uploadUrl, publicUrl } = await presignedRes.json();

      // Upload directly to R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': fileToUpload.type || 'application/octet-stream' },
        body: fileToUpload,
      });
      if (!putRes.ok) {
        const t = await putRes.text();
        throw new Error(`R2 upload failed: ${putRes.status} ${t}`);
      }

      imageurl = publicUrl;
      console.log('Uploaded to R2 (direct):', imageurl);
    } catch (error) {
      console.log('IMAGE NOT UPLOADED: ', error)
    }
  
    try {
      // Calculate base_cost for future photo multiplier calculations
      const materialCost = analysisResult?.materials_total_cost || 0;
      const laborCost = (analysisResult?.labor_rate || 0) * (analysisResult?.hours_required || 0);
      const baseCost = materialCost + laborCost;
      
      const res = await fetch("/api/defects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: analysisData?.inspectionId,   // pass inspection reference if needed
          image: imageurl,
          location: analysisData?.location,
          section: analysisData?.section,
          subsection: analysisData?.subSection,
          defect_description: analysisResult?.defect,
          material_names: analysisResult?.materials,
          material_total_cost: analysisResult?.materials_total_cost,
          labor_type: analysisResult?.labor_type,
          labor_rate: analysisResult?.labor_rate,
          hours_required: analysisResult?.hours_required,
          recommendation: analysisResult?.recommendation,
          color: analysisData?.selectedArrowColor || '#d63636', // pass the selected arrow color (default to red if not set)
          base_cost: baseCost, // Save base cost for photo multiplier calculations
        }),
      });

      if (!res.ok) {
          // If the response status is not OK (e.g., 400, 500), log the status and response text
          const errorText = await res.text();
          console.error(
            "Failed to create inspection. Status:",
            res.status,
            "Response:",
            errorText
          );
          alert("Failed to create inspection. Check the console for details.");
          return;
        }
      
        const data = await res.json();
        console.log("Defect created successfully:", data);
        console.log("Defect created with id: " + data.id);
        // Navigate back to image editor with the same inspection ID
        router.push(`/image-editor?inspectionId=${analysisData?.inspectionId}`);
      } catch (error) {
        // Log any network or unexpected errors
        setIsSubmitting(false)
        console.error("Error creating inspection:", error);
        alert("An error occurred. Check the console for details.");
        // Navigate back to image editor even on error
        router.push(`/image-editor?inspectionId=${analysisData?.inspectionId}`);
      }
  };

  // Color to Importance mapping
  const colorToImportance = (hex?: string) => {
    if (!hex) return 'Immediate Attention';
    const c = hex.toLowerCase();
    if (c.includes('d63636') || c.includes('dc2626') || c.includes('ef4444') || c.includes('ff0000')) return 'Immediate Attention';
    if (c.includes('e69500') || c.includes('f59e0b') || c.includes('ffa500') || c.includes('fb923c')) return 'Items for Repair';
    if (c.includes('2d6cdf') || c.includes('3b82f6') || c.includes('60a5fa') || c.includes('1d4ed8')) return 'Maintenance Items';
    if (c.includes('7c3aed') || c.includes('8b5cf6') || c.includes('6d28d9') || c.includes('9333ea')) return 'Further Evaluation';
    return 'Immediate Attention';
  };

  if (!analysisData) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div>No analysis data found. Redirecting...</div>
      </div>
    );
  }

  const { image, description, location, analysisResult } = analysisData;

  const reportSections: ReportSection[] = [
    {
      id: 1,
      heading: `${analysisData.section} - ${analysisData.subSection}`,
      image: image || null,
      defect: isEditing
        ? editedData.defect
        : analysisResult?.defect || description || "No defect information",
      location: isEditing ? editedData.location : location || "Not specified",
      section: analysisData.section || '',
      subSection: analysisData.subSection || "",
      estimatedCosts: {
        materials: isEditing ? editedData.materials : analysisResult?.materials_names || "N/A",
        materialsCost: isEditing
          ? editedData.materialsCost
          : Number(analysisResult?.materials_total_cost) || 0,
        labor: isEditing ? editedData.labor : analysisResult?.labor_type || "N/A",
        laborRate: isEditing ? editedData.laborRate : Number(analysisResult?.labor_rate) || 0,
        hoursRequired: isEditing ? editedData.hoursRequired : Number(analysisResult?.hours_required) || 0,
        recommendation: isEditing ? editedData.recommendation : analysisResult?.recommendation || "N/A",
        totalEstimatedCost: isEditing
          ? editedData.totalEstimatedCost
          : Number(analysisResult?.total_estimated_cost) || 0,
      },
    },
  ];

  return (
    <div 
      className={styles.userReportContainer}
      style={{
        '--selected-color': getSelectedColor(),
        '--light-color': getLightColor(),
      } as React.CSSProperties}
    >
      <main className="py-8">
        <div className={styles.reportSectionsContainer}>
          {reportSections.map((section) => {
            const defectPartsView = splitDefectText(section.defect);
            const defectTitle = defectPartsView.title;
            const defectParagraphsRaw = defectPartsView.paragraphs.length
              ? defectPartsView.paragraphs
              : defectPartsView.body && defectPartsView.body !== defectTitle
                ? [defectPartsView.body]
                : [];
            const defectParagraphs = defectParagraphsRaw
              .map((paragraph) => paragraph?.trim?.())
              .filter((paragraph): paragraph is string => Boolean(paragraph));

            return (
            <div key={section.id} className={styles.reportSection}>
              {/* Heading */}
              <div className={styles.sectionHeading}>
                <h2 className={styles.sectionHeadingText}>
                  {section.heading}
                  <span
                    className={styles.importanceBadge}
                    style={{ background: getSelectedColor() }}
                  >
                    {colorToImportance(analysisData?.selectedArrowColor)}
                  </span>
                </h2>
              </div>

              <div className={styles.contentGrid}>
                {/* Image */}
                <div className={styles.imageSection}>
                  <h3 className={styles.imageTitle}>Visual Evidence</h3>
                  <div className={styles.imageContainer}>
                    {section.image ? (
                      <img
                        src={
                          typeof section.image === "string"
                            ? section.image
                            : URL.createObjectURL(section.image)
                        }
                        alt="Property analysis"
                        className={styles.propertyImage}
                      />
                    ) : (
                      <div className={styles.imagePlaceholder}>
                        <p>No image available</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Location moved here */}
                  <div className={styles.locationSection}>
                    <h4 className={styles.sectionTitle}>Location</h4>
                    {isEditing ? (
                      <input
                        type="text"
                        className={styles.editableInput}
                        value={editedData.location}
                        onChange={(e) => handleInputChange("location", e.target.value)}
                      />
                    ) : (
                      <p className={styles.sectionContent}>{section.location}</p>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className={styles.descriptionSection}>
                  <h3 className={styles.descriptionTitle}>Analysis Details</h3>
                  <div className="space-y-6">
                    {/* Defect */}
                    <div className={styles.section}>
                      <h4 className={styles.sectionTitle}>Defect</h4>
                      {isEditing ? (
                        <textarea
                          className={styles.editableText}
                          value={editedData.defect}
                          onChange={(e) => handleInputChange("defect", e.target.value)}
                        />
                      ) : (
                        <div>
                          {defectTitle ? (
                            <p
                              className={styles.defectHeadline}
                              style={{ color: getSelectedColor() }}
                            >
                              {defectTitle}
                            </p>
                          ) : null}
                          {defectParagraphs.length > 0 ? (
                            defectParagraphs.map((paragraph, idx) => (
                              <p key={idx} className={styles.defectBody}>
                                {paragraph}
                              </p>
                            ))
                          ) : !defectTitle && section.defect ? (
                            <p className={styles.defectBody}>{section.defect}</p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Estimated Costs */}
                    <div className={styles.section}>
                      <h4 className={styles.sectionTitle}>Estimated Costs</h4>
                      <div className={styles.sectionContent}>
                        {isEditing ? (
                          <div className={styles.editableCosts}>
                            <div className={styles.costEditRow}>
                              <label>Materials:</label>
                              <input
                                type="text"
                                className={styles.costInput}
                                value={editedData.materials}
                                onChange={(e) => handleInputChange("materials", e.target.value)}
                              />
                            </div>
                            <div className={styles.costEditRow}>
                              <label>Materials Cost ($):</label>
                              <input
                                type="number"
                                className={styles.costInput}
                                value={editedData.materialsCost}
                                onChange={(e) => handleInputChange("materialsCost", Number(e.target.value))}
                              />
                            </div>
                            <div className={styles.costEditRow}>
                              <label>Labor:</label>
                              <input
                                type="text"
                                className={styles.costInput}
                                value={editedData.labor}
                                onChange={(e) => handleInputChange("labor", e.target.value)}
                              />
                            </div>
                            <div className={styles.costEditRow}>
                              <label>Labor Rate ($/hr):</label>
                              <input
                                type="number"
                                className={styles.costInput}
                                value={editedData.laborRate}
                                onChange={(e) => handleInputChange("laborRate", Number(e.target.value))}
                              />
                            </div>
                            <div className={styles.costEditRow}>
                              <label>Hours Required:</label>
                              <input
                                type="number"
                                className={styles.costInput}
                                value={editedData.hoursRequired}
                                onChange={(e) => handleInputChange("hoursRequired", Number(e.target.value))}
                              />
                            </div>
                            <div className={styles.costEditRow}>
                              <label>Recommendation:</label>
                              <textarea
                                className={styles.editableText}
                                value={editedData.recommendation}
                                onChange={(e) => handleInputChange("recommendation", e.target.value)}
                              />
                            </div>
                            <div className={styles.costEditRow}>
                              <label>Total Estimated Cost ($):</label>
                              <input
                                type="number"
                                className={styles.costInput}
                                value={editedData.totalEstimatedCost}
                                readOnly
                              />
                            </div>
                          </div>
                        ) : (
                          <p>
                            <strong>Materials:</strong> {section.estimatedCosts.materials} ($
                            {section.estimatedCosts.materialsCost}),{" "}
                            <strong>Labor:</strong> {section.estimatedCosts.labor} at $
                            {section.estimatedCosts.laborRate}/hr, <strong>Hours:</strong>{" "}
                            {section.estimatedCosts.hoursRequired}, <strong>Recommendation:</strong>{" "}
                            {section.estimatedCosts.recommendation}, <strong>Total Estimated Cost:</strong> $
                            {section.estimatedCosts.totalEstimatedCost}.
                          </p>
                        )}
                      </div>
                     </div>
                     
                     {/* Total Cost Highlight */}
                     <div className={styles.costHighlight}>
                       <div className={styles.totalCost}>
                         Total Estimated Cost: ${section.estimatedCosts.totalEstimatedCost}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div className={styles.actionButtons}>
          <button onClick={() => router.push("/image-editor")} className={`${styles.actionButton} ${styles.secondaryButton}`}>
            Back
          </button>

          {!isEditing ? (
            <button onClick={handleEdit} className={`${styles.actionButton} ${styles.editButton}`}>
              Edit
            </button>
          ) : (
            <>
              <button onClick={handleCancel} className={`${styles.actionButton} ${styles.cancelButton}`}>
                Cancel
              </button>
              <button onClick={handleSave} className={`${styles.actionButton} ${styles.saveButton}`}>
                Save
              </button>
            </>
          )}

          <button
  onClick={handleSaveReport}
  className={`${styles.actionButton} ${styles.saveReportButton}`}
  disabled={isSubmitting}
>
  {isSubmitting ? (
    <>
      <span className={styles.spinner}></span>
      Saving...
    </>
  ) : (
    "Save Report"
  )}
</button>
        </div>
      </main>
    </div>
  );
}
