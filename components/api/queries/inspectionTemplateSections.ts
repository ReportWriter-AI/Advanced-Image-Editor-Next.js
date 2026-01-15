import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface InspectionTemplateSection {
  _id?: string;
  name: string;
  excludeFromSummaryView: boolean;
  includeInEveryReport: boolean;
  startSectionOnNewPage: boolean;
  sectionIcon?: string;
  inspectionGuidelines?: string;
  inspectorNotes?: string;
  orderIndex: number;
  deletedAt?: string;
}

export const useInspectionTemplateSectionsQuery = (inspectionId: string, templateId: string) => 
  useQuery({
    queryKey: [apiRoutes.inspectionTemplateSections.get(inspectionId, templateId)],
    queryFn: () => axios.get(apiRoutes.inspectionTemplateSections.get(inspectionId, templateId)),
    enabled: !!inspectionId && !!templateId,
  })

export const useCreateInspectionTemplateSectionMutation = (inspectionId: string, templateId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sectionData: Omit<InspectionTemplateSection, '_id' | 'orderIndex'> & { orderIndex?: number }) => 
      axios.post(apiRoutes.inspectionTemplateSections.create(inspectionId, templateId), sectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSections.get(inspectionId, templateId)] });
      toast.success('Section created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create section');
      return Promise.reject(error);
    },
  })
}

export const useUpdateInspectionTemplateSectionMutation = (inspectionId: string, templateId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sectionId, sectionData }: { sectionId: string; sectionData: Partial<InspectionTemplateSection> }) => 
      axios.put(apiRoutes.inspectionTemplateSections.update(inspectionId, templateId, sectionId), sectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSections.get(inspectionId, templateId)] });
      toast.success('Section updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update section');
      return Promise.reject(error);
    },
  })
}

export const useDeleteInspectionTemplateSectionMutation = (inspectionId: string, templateId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sectionId: string) => 
      axios.delete(apiRoutes.inspectionTemplateSections.delete(inspectionId, templateId, sectionId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSections.get(inspectionId, templateId)] });
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSections.deleted(inspectionId, templateId)] });
      toast.success('Section deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete section');
      return Promise.reject(error);
    },
  })
}

export const useDeletedInspectionTemplateSectionsQuery = (inspectionId: string, templateId: string) => 
  useQuery({
    queryKey: [apiRoutes.inspectionTemplateSections.deleted(inspectionId, templateId)],
    queryFn: () => axios.get(apiRoutes.inspectionTemplateSections.deleted(inspectionId, templateId)),
    enabled: !!inspectionId && !!templateId,
  })

export const useRestoreInspectionTemplateSectionMutation = (inspectionId: string, templateId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sectionId: string) => 
      axios.patch(apiRoutes.inspectionTemplateSections.restore(inspectionId, templateId, sectionId)),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSections.get(inspectionId, templateId)] });
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSections.deleted(inspectionId, templateId)] });
      toast.success(response.data?.message || 'Section restored successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to restore section');
      return Promise.reject(error);
    },
  })
}

export const useReorderInspectionTemplateSectionsMutation = (inspectionId: string, templateId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { sections: Array<{ id: string; order: number }> }) =>
      axios.patch(apiRoutes.inspectionTemplateSections.reorder(inspectionId, templateId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSections.get(inspectionId, templateId)] });
      toast.success('Section order updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reorder sections');
      return Promise.reject(error);
    },
  })
}
