import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface TemplateSubsection {
  _id?: string;
  name: string;
  informationalOnly: boolean;
  includeInEveryReport: boolean;
  inspectorNotes?: string;
  orderIndex: number;
}

export const useTemplateSubsectionsQuery = (templateId: string, sectionId: string) => 
  useQuery({
    queryKey: [apiRoutes.templateSubsections.get(templateId, sectionId)],
    queryFn: () => axios.get(apiRoutes.templateSubsections.get(templateId, sectionId)),
    enabled: !!templateId && !!sectionId,
  })

export const useCreateTemplateSubsectionMutation = (templateId: string, sectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subsectionData: Omit<TemplateSubsection, '_id' | 'orderIndex'> & { orderIndex?: number }) => 
      axios.post(apiRoutes.templateSubsections.create(templateId, sectionId), subsectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateSubsections.get(templateId, sectionId)] });
      toast.success('Subsection created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create subsection');
      return Promise.reject(error);
    },
  })
}

export const useUpdateTemplateSubsectionMutation = (templateId: string, sectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ subsectionId, subsectionData }: { subsectionId: string; subsectionData: Partial<TemplateSubsection> }) => 
      axios.put(apiRoutes.templateSubsections.update(templateId, sectionId, subsectionId), subsectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateSubsections.get(templateId, sectionId)] });
      toast.success('Subsection updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update subsection');
      return Promise.reject(error);
    },
  })
}

export const useDeleteTemplateSubsectionMutation = (templateId: string, sectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subsectionId: string) => 
      axios.delete(apiRoutes.templateSubsections.delete(templateId, sectionId, subsectionId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateSubsections.get(templateId, sectionId)] });
      toast.success('Subsection deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete subsection');
      return Promise.reject(error);
    },
  })
}

export const useReorderTemplateSubsectionsMutation = (templateId: string, sectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { subsections: Array<{ id: string; order: number }> }) =>
      axios.patch(apiRoutes.templateSubsections.reorder(templateId, sectionId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateSubsections.get(templateId, sectionId)] });
      toast.success('Subsection order updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reorder subsections');
      return Promise.reject(error);
    },
  })
}
