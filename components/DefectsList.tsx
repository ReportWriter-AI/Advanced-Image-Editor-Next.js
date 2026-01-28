//@ts-nocheck
"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Loader2 } from 'lucide-react';
import ReactSelect from 'react-select';
import ImageEditorModal from '@/components/ImageEditorModal';
import DefectCard from '@/src/app/(authenticated)/inspections/[id]/edit/_components/DefectCard';
import { useDeleteDefectMutation, useDefectsByTemplateQuery, useUpdateDefectMutation, useMergeDefectsMutation, type Defect } from '@/components/api/queries/defects';
import { useReusableDropdownsQuery } from '@/components/api/queries/reusableDropdowns';
import { useInspectionTemplateSectionsAndSubsectionsQuery } from '@/components/api/queries/inspectionTemplates';

interface DefectsListProps {
	inspectionId?: string;    // Optional - if not provided, extracts from URL params
	templateId?: string;      // Optional - if not provided, extracts from URL params
	sectionId?: string;       // Optional - when provided, filters defects
	subsectionId?: string;    // Optional - when provided, filters defects
	hideFilter?: boolean;     // Optional - when true, hides filter dropdowns
}

export default function DefectsList({
	inspectionId: propInspectionId,
	templateId: propTemplateId,
	sectionId: propSectionId,
	subsectionId: propSubsectionId,
	hideFilter = false,
}: DefectsListProps) {
	const params = useParams();
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();

	// Determine if we're in page mode (no props provided) or component mode (props provided)
	const isPageMode = !propInspectionId || !propTemplateId;

	// Extract inspectionId and templateId - from props if provided, otherwise from URL params
	const inspectionId = propInspectionId || (params.inspectionId as string);
	const templateId = propTemplateId || (params.templateId as string);

	// Extract optional query parameters for filtering (only used in page mode)
	const urlSectionId = isPageMode ? (searchParams.get('sectionId') || undefined) : undefined;
	const urlSubsectionId = isPageMode ? (searchParams.get('subsectionId') || undefined) : undefined;

	// Determine which section/subsection to use for filtering
	// Priority: props > URL params (page mode) > undefined
	const effectiveSectionId = propSectionId || urlSectionId;
	const effectiveSubsectionId = propSubsectionId || urlSubsectionId;

	// State for selected section and subsection (only used when filters are shown)
	// Initialize from props or URL params
	const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(effectiveSectionId);
	const [selectedSubsectionId, setSelectedSubsectionId] = useState<string | undefined>(effectiveSubsectionId);

	// Determine which section/subsection IDs to use for the query
	// If props are provided, use them directly; otherwise use state (which may be synced with URL)
	const querySectionId = propSectionId || selectedSectionId;
	const querySubsectionId = propSubsectionId || selectedSubsectionId;

	// React Query hooks
	const { data: sectionsData } = useInspectionTemplateSectionsAndSubsectionsQuery(inspectionId, templateId);
	const { data: defectsData, isLoading, refetch } = useDefectsByTemplateQuery({
		inspectionId,
		templateId,
		sectionId: querySectionId,
		subsectionId: querySubsectionId,
	});

	const defects = useMemo(() => {
		return Array.isArray(defectsData) ? defectsData : [];
	}, [defectsData]);

	const deleteDefectMutation = useDeleteDefectMutation();
	const updateDefectMutation = useUpdateDefectMutation();
	const mergeDefectsMutation = useMergeDefectsMutation();
	const { data: dropdownsData } = useReusableDropdownsQuery();

	// Local UI state
	const [imageEditorOpen, setImageEditorOpen] = useState(false);
	const [editorMode, setEditorMode] = useState<'create' | 'defect-main' | 'additional-location' | 'edit-additional' | 'merged-defect'>('create');
	const [editorProps, setEditorProps] = useState<any>({});
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editedValues, setEditedValues] = useState<Partial<Defect>>({});
	const [lastSaved, setLastSaved] = useState<string | null>(null);
	const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
	const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
	const editedValuesRef = useRef<Partial<Defect>>({});
	const [autoSaving, setAutoSaving] = useState(false);
	const [selectedDefectIds, setSelectedDefectIds] = useState<Set<string>>(new Set());

	const handleImageEditorSave = async (result: any) => {
		console.log('📥 Image editor save result:', result);

		// Handle merged-defect mode save
		if (result.defectId && result.index !== undefined && result.newImageUrl && result.newOriginalImageUrl) {
			const defect = defects.find(d => d._id === result.defectId);
			if (defect && defect.additional_images) {
				// Update the specific additional_image in the array
				const updatedImages = defect.additional_images.map((img: any, i: number) =>
					i === result.index ? {
						...img,
						image: result.newImageUrl,
						originalImage: result.newOriginalImageUrl,
						annotations: result.annotations || [],
						location: result.location || img.location || ''
					} : img
				);

				// Update via API
				handleUpdateDefect(result.defectId, { additional_images: updatedImages });

				// Update editedValues if currently editing this defect
				if (editingId === result.defectId) {
					setEditedValues(prev => {
						const updated = { ...prev, additional_images: updatedImages };
						editedValuesRef.current = updated;
						return updated;
					});
				}
			}
		}
		// Handle regular edit-additional mode save
		else if (result.defectId && result.index !== undefined && result.newUrl && editingId === result.defectId) {
			setEditedValues(prev => {
				const currentImages = (prev.additional_images as any) || defects.find(d => d._id === result.defectId)?.additional_images || [];
				const updatedImages = currentImages.map((img: any, i: number) =>
					i === result.index ? { ...img, url: result.newUrl } : img
				);
				const updated = { ...prev, additional_images: updatedImages };
				editedValuesRef.current = updated;
				return updated;
			});
		}

		// Invalidate and refetch defects list after save
		await refetch();

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

		// Call the mutation with callbacks (pass inspectionId/templateId when in report-edit context so validation refetches)
		deleteDefectMutation.mutate(
			{
				defectId,
				...(inspectionId && templateId ? { inspectionId, templateId } : {}),
			},
			{
				onSuccess: () => {
					refetch();
				},
				onError: (error) => {
					console.error('Failed to delete defect:', error);
				},
			}
		);
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
		const materialCost = defect.material_total_cost || 0;
		const laborCost = (defect.labor_rate || 0) * (defect.hours_required || 0);
		const baseCost = materialCost + laborCost;
		return baseCost;
	};

	const handleUpdateDefect = async (defectId: string, updates: Partial<Defect>) => {
		// Get the defect to access inspection_id
		const defect = defects.find(d => d._id === defectId);
		if (!defect) {
			console.error('Defect not found for update');
			return;
		}

		// Use the mutation (pass inspectionId/templateId when in report-edit context so validation refetches)
		updateDefectMutation.mutate(
			{
				defectId,
				updates: { ...updates, inspection_id: defect.inspection_id },
				...(inspectionId && templateId ? { inspectionId, templateId } : {}),
			},
			{
				onSuccess: () => {
					// Update editedValues if we're currently editing this defect and additional_images was updated
					if (editingId === defectId && updates.additional_images !== undefined) {
						setEditedValues(prev => {
							const updated = { ...prev, additional_images: updates.additional_images };
							editedValuesRef.current = updated;
							return updated;
						});
					}
					// Refetch defect data after successful update
					refetch();
				},
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

		// Check if this is a merged defect (has 'image' field instead of 'url')
		const isMergedDefect = 'image' in additionalImage || defect.parentDefect;

		if (isMergedDefect) {
			// Merged defect structure: { id, image, originalImage, annotations, location, isThreeSixty }
			setEditorMode('merged-defect');
			setEditorProps({
				defectId: defect._id,
				editIndex: imageIndex,
				imageUrl: (additionalImage as any).originalImage || (additionalImage as any).image,
				originalImageUrl: (additionalImage as any).originalImage || (additionalImage as any).image,
				preloadedAnnotations: (additionalImage as any).annotations || [],
				location: (additionalImage as any).location || '',
			});
		} else {
			// Regular defect structure: { url, location, isThreeSixty }
			setEditorMode('edit-additional');
			setEditorProps({
				defectId: defect._id,
				editIndex: imageIndex,
				imageUrl: (additionalImage as any).url,
				preloadedAnnotations: [],
			});
		}
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

		const updatedImages = defect.additional_images.map((img: any, i: number) =>
			i === index ? { ...img, location: newLocation } : img
		);

		// Update using mutation
		handleUpdateDefect(editingId, { additional_images: updatedImages });
	};

	const handleRemoveLocationPhoto = async (index: number) => {
		if (!editingId) return;
		const defect = defects.find(d => d._id === editingId);
		if (!defect || !defect.additional_images) return;

		const updatedImages = defect.additional_images.filter((_item: any, i: number) => i !== index);

		// Update using mutation
		handleUpdateDefect(editingId, {
			additional_images: updatedImages,
			material_total_cost: (defect.base_cost || defect.material_total_cost) * (1 + updatedImages.length),
		});
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

	const handleDefectCheck = (defectId: string, checked: boolean) => {
		setSelectedDefectIds(prev => {
			const newSet = new Set(prev);
			if (checked) {
				newSet.add(defectId);
			} else {
				newSet.delete(defectId);
			}
			return newSet;
		});
	};

	const handleMerge = () => {
		if (selectedDefectIds.size > 1 && templateId) {
			const defectIdsArray = Array.from(selectedDefectIds);
			mergeDefectsMutation.mutate(
				{
					defectIds: defectIdsArray,
					templateId,
					...(inspectionId ? { inspectionId } : {}),
				},
				{
					onSuccess: () => {
						setSelectedDefectIds(new Set());
						refetch();
					},
				}
			);
		}
	};

	const allLocationOptions = useMemo(() => {
		if (!dropdownsData?.data?.location) return [];
		return dropdownsData.data.location.map((item: { id: string; value: string }) => item.value);
	}, [dropdownsData]);

	// Transform sections data for react-select
	const sectionOptions = useMemo(() => {
		if (!sectionsData?.data?.sections) return [];
		return sectionsData.data.sections.map((section: any) => ({
			value: section._id,
			label: section.name,
		}));
	}, [sectionsData]);

	// Get subsections for the selected section
	const subsectionOptions = useMemo(() => {
		if (!selectedSectionId || !sectionsData?.data?.sections) return [];
		const selectedSection = sectionsData.data.sections.find((section: any) => section._id === selectedSectionId);
		if (!selectedSection?.subsections) return [];
		return selectedSection.subsections.map((subsection: any) => ({
			value: subsection._id,
			label: subsection.name,
		}));
	}, [selectedSectionId, sectionsData]);

	// Get selected values for react-select
	const selectedSectionOption = useMemo(() => {
		return sectionOptions.find((option: { value: string; label: string }) => option.value === selectedSectionId) || null;
	}, [sectionOptions, selectedSectionId]);

	const selectedSubsectionOption = useMemo(() => {
		return subsectionOptions.find((option: { value: string; label: string }) => option.value === selectedSubsectionId) || null;
	}, [subsectionOptions, selectedSubsectionId]);

	// Handler for section change
	const handleSectionChange = (option: { value: string; label: string } | null) => {
		const newSectionId = option?.value || undefined;
		setSelectedSectionId(newSectionId);
		setSelectedSubsectionId(undefined); // Clear subsection when section changes
		
		// Update URL params only in page mode
		if (isPageMode) {
			const params = new URLSearchParams(searchParams.toString());
			if (newSectionId) {
				params.set('sectionId', newSectionId);
			} else {
				params.delete('sectionId');
			}
			params.delete('subsectionId'); // Always clear subsection when section changes
			router.replace(`${pathname}?${params.toString()}`);
		}
	};

	// Handler for subsection change
	const handleSubsectionChange = (option: { value: string; label: string } | null) => {
		const newSubsectionId = option?.value || undefined;
		setSelectedSubsectionId(newSubsectionId);
		
		// Update URL params only in page mode
		if (isPageMode) {
			const params = new URLSearchParams(searchParams.toString());
			if (newSubsectionId) {
				params.set('subsectionId', newSubsectionId);
			} else {
				params.delete('subsectionId');
			}
			router.replace(`${pathname}?${params.toString()}`);
		}
	};

	// Handler for clearing filters
	const handleClearFilters = () => {
		setSelectedSectionId(undefined);
		setSelectedSubsectionId(undefined);
		
		// Update URL only in page mode
		if (isPageMode) {
			router.replace(pathname);
		}
	};

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
			updateDefectMutation.mutate(
				{
					defectId: editingId,
					updates: {
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
					},
					...(inspectionId && templateId ? { inspectionId, templateId } : {}),
				},
				{
					onSuccess: () => {
						const now = new Date();
						setLastSaved(now.toLocaleTimeString());
						refetch();
					},
					onError: (err) => {
						console.error("Auto-save error:", err);
					},
				}
			);
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

	// Sync state with URL params when they change externally (only in page mode)
	useEffect(() => {
		if (isPageMode && !propSectionId && !propSubsectionId) {
			setSelectedSectionId(urlSectionId);
			setSelectedSubsectionId(urlSubsectionId);
		}
	}, [isPageMode, urlSectionId, urlSubsectionId, propSectionId, propSubsectionId]);

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


	if (!inspectionId || !templateId) {
		return (
			<div className="flex flex-col items-center justify-center py-12">
				<p className="text-muted-foreground">Invalid route parameters</p>
			</div>
		);
	}

	return (
		<div className="container mx-auto py-6 space-y-4">
			<Card>
				<CardContent className="pt-6">
					{!hideFilter && (
						<>
							<div className="flex items-center justify-between mb-6">
								<div>
									<h3 className="text-xl font-semibold">Defects</h3>
									{(querySectionId && querySubsectionId) && (
										<p className="text-sm text-muted-foreground">Filtered by section and subsection</p>
									)}
								</div>
								<div className="flex items-center gap-2">
			
									<Button
										size="sm"
										className="gap-2 bg-[#6422C7] hover:bg-[#6422C7]/90"
										onClick={() => window.open(`/image-editor?templateId=${templateId}&inspectionId=${inspectionId}`, '_blank')}
									>
										<Plus className="h-4 w-4" />
										Add Defects
									</Button>
								</div>
							</div>

							<div className="mb-6">
								<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
									<div className="w-full sm:w-[250px]">
										<label className="block text-sm font-medium mb-2">Section</label>
										<ReactSelect
											value={selectedSectionOption}
											onChange={handleSectionChange}
											options={sectionOptions}
											placeholder="Select a section"
											isClearable
											className="react-select-container"
											classNamePrefix="react-select"
										/>
									</div>
									<div className="w-full sm:w-[250px]">
										<label className="block text-sm font-medium mb-2">Subsection</label>
										<ReactSelect
											value={selectedSubsectionOption}
											onChange={handleSubsectionChange}
											options={subsectionOptions}
											placeholder="Select a subsection"
											isClearable
											isDisabled={!selectedSectionId}
											className="react-select-container"
											classNamePrefix="react-select"
										/>
									</div>
								</div>
								{(selectedSectionId || selectedSubsectionId) && (
									<div className="mt-4">
										<Button
											variant="outline"
											size="sm"
											onClick={handleClearFilters}
											className="whitespace-nowrap"
										>
											Clear Filters
										</Button>
									</div>
								)}
							</div>
						</>
				
					)}

					{selectedDefectIds.size > 1 && (
						<div className="flex items-center justify-end mb-6">
							<Button
								size="sm"
								className="gap-2 bg-green-600 hover:bg-green-700"
								onClick={handleMerge}
								disabled={mergeDefectsMutation.isPending}
							>
								{mergeDefectsMutation.isPending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin mr-1" />
										Merging...
									</>
								) : (
									<>
										<i className="fas fa-code-branch mr-1"></i>
										Merge ({selectedDefectIds.size})
									</>
								)}
							</Button>
						</div>
					)}

					{isLoading ? (
						<div className="flex flex-col items-center justify-center py-12">
							<Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
							<p>Loading defects...</p>
						</div>
					) : defects.length === 0 ? (
						<div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed">
							<i className="fas fa-clipboard-list text-4xl text-muted-foreground mb-4"></i>
							<h3 className="text-xl font-semibold mb-2">No Defects Found</h3>
						</div>
					) : (
						<div className="space-y-6">
							{defects.map((defect, index) => {
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
										isChecked={selectedDefectIds.has(defect._id)}
										onCheckChange={handleDefectCheck}
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
