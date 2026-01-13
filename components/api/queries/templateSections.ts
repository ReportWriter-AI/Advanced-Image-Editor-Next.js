import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface TemplateSection {
  _id?: string;
  name: string;
  excludeFromSummaryView: boolean;
  includeInEveryReport: boolean;
  startSectionOnNewPage: boolean;
  sectionIcon?: string;
  inspectionGuidelines?: string;
  inspectorNotes?: string;
  orderIndex: number;
}

export const useTemplateSectionsQuery = (templateId: string) => 
  useQuery({
    queryKey: [apiRoutes.templateSections.get(templateId)],
    queryFn: () => axios.get(apiRoutes.templateSections.get(templateId)),
    enabled: !!templateId,
  })

export const useCreateTemplateSectionMutation = (templateId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sectionData: Omit<TemplateSection, '_id' | 'orderIndex'> & { orderIndex?: number }) => 
      axios.post(apiRoutes.templateSections.create(templateId), sectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateSections.get(templateId)] });
      toast.success('Section created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create section');
      return Promise.reject(error);
    },
  })
}

export const useUpdateTemplateSectionMutation = (templateId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sectionId, sectionData }: { sectionId: string; sectionData: Partial<TemplateSection> }) => 
      axios.put(apiRoutes.templateSections.update(templateId, sectionId), sectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateSections.get(templateId)] });
      toast.success('Section updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update section');
      return Promise.reject(error);
    },
  })
}

export const useDeleteTemplateSectionMutation = (templateId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sectionId: string) => 
      axios.delete(apiRoutes.templateSections.delete(templateId, sectionId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateSections.get(templateId)] });
      toast.success('Section deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete section');
      return Promise.reject(error);
    },
  })
}

export const useReorderTemplateSectionsMutation = (templateId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { sections: Array<{ id: string; order: number }> }) =>
      axios.patch(apiRoutes.templateSections.reorder(templateId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateSections.get(templateId)] });
      toast.success('Section order updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reorder sections');
      return Promise.reject(error);
    },
  })
}