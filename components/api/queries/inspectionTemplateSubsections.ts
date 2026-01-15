import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface InspectionTemplateSubsection {
  _id?: string;
  name: string;
  informationalOnly: boolean;
  includeInEveryReport: boolean;
  inspectorNotes?: string;
  orderIndex: number;
  deletedAt?: string;
}

export const useInspectionTemplateSubsectionsQuery = (inspectionId: string, templateId: string, sectionId: string) => 
  useQuery({
    queryKey: [apiRoutes.inspectionTemplateSubsections.get(inspectionId, templateId, sectionId)],
    queryFn: () => axios.get(apiRoutes.inspectionTemplateSubsections.get(inspectionId, templateId, sectionId)),
    enabled: !!inspectionId && !!templateId && !!sectionId,
  })

export const useCreateInspectionTemplateSubsectionMutation = (inspectionId: string, templateId: string, sectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subsectionData: Omit<InspectionTemplateSubsection, '_id' | 'orderIndex'> & { orderIndex?: number }) => 
      axios.post(apiRoutes.inspectionTemplateSubsections.create(inspectionId, templateId, sectionId), subsectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSubsections.get(inspectionId, templateId, sectionId)] });
      toast.success('Subsection created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create subsection');
      return Promise.reject(error);
    },
  })
}

export const useUpdateInspectionTemplateSubsectionMutation = (inspectionId: string, templateId: string, sectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ subsectionId, subsectionData }: { subsectionId: string; subsectionData: Partial<InspectionTemplateSubsection> }) => 
      axios.put(apiRoutes.inspectionTemplateSubsections.update(inspectionId, templateId, sectionId, subsectionId), subsectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSubsections.get(inspectionId, templateId, sectionId)] });
      toast.success('Subsection updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update subsection');
      return Promise.reject(error);
    },
  })
}

export const useDeleteInspectionTemplateSubsectionMutation = (inspectionId: string, templateId: string, sectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subsectionId: string) => 
      axios.delete(apiRoutes.inspectionTemplateSubsections.delete(inspectionId, templateId, sectionId, subsectionId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSubsections.get(inspectionId, templateId, sectionId)] });
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSubsections.deleted(inspectionId, templateId, sectionId)] });
      toast.success('Subsection deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete subsection');
      return Promise.reject(error);
    },
  })
}

export const useDeletedInspectionTemplateSubsectionsQuery = (inspectionId: string, templateId: string, sectionId: string) => 
  useQuery({
    queryKey: [apiRoutes.inspectionTemplateSubsections.deleted(inspectionId, templateId, sectionId)],
    queryFn: () => axios.get(apiRoutes.inspectionTemplateSubsections.deleted(inspectionId, templateId, sectionId)),
    enabled: !!inspectionId && !!templateId && !!sectionId,
  })

export const useRestoreInspectionTemplateSubsectionMutation = (inspectionId: string, templateId: string, sectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subsectionId: string) => 
      axios.patch(apiRoutes.inspectionTemplateSubsections.restore(inspectionId, templateId, sectionId, subsectionId)),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSubsections.get(inspectionId, templateId, sectionId)] });
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSubsections.deleted(inspectionId, templateId, sectionId)] });
      toast.success(response.data?.message || 'Subsection restored successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to restore subsection');
      return Promise.reject(error);
    },
  })
}

export const useReorderInspectionTemplateSubsectionsMutation = (inspectionId: string, templateId: string, sectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { subsections: Array<{ id: string; order: number }> }) =>
      axios.patch(apiRoutes.inspectionTemplateSubsections.reorder(inspectionId, templateId, sectionId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateSubsections.get(inspectionId, templateId, sectionId)] });
      toast.success('Subsection order updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reorder subsections');
      return Promise.reject(error);
    },
  })
}
