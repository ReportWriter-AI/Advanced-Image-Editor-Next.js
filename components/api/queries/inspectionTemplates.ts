import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface InspectionTemplate {
  _id: string;
  name: string;
  sections: any[];
  orderIndex: number;
  reportDescription?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export const useInspectionTemplatesQuery = (inspectionId: string) => 
  useQuery({
    queryKey: [apiRoutes.inspectionTemplates.get(inspectionId)],
    queryFn: () => axios.get(apiRoutes.inspectionTemplates.get(inspectionId)),
    enabled: !!inspectionId,
  })

export const useInspectionTemplateQuery = (inspectionId: string, templateId: string) => 
  useQuery({
    queryKey: [apiRoutes.inspectionTemplates.getById(inspectionId, templateId)],
    queryFn: () => axios.get(apiRoutes.inspectionTemplates.getById(inspectionId, templateId)),
    enabled: !!inspectionId && !!templateId,
  })

export const useUpdateInspectionTemplateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ inspectionId, templateId, templateData }: { inspectionId: string; templateId: string; templateData: any }) => 
      axios.put(apiRoutes.inspectionTemplates.update(inspectionId, templateId), templateData),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplates.get(variables.inspectionId)] });
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplates.getById(variables.inspectionId, variables.templateId)] });
      toast.success(response.data?.message || 'Template updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update template');
      return Promise.reject(error);
    },
  })
}

export const useDeleteInspectionTemplateMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ inspectionId, templateId }: { inspectionId: string; templateId: string }) => 
      axios.delete(apiRoutes.inspectionTemplates.delete(inspectionId, templateId)),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplates.get(variables.inspectionId)] });
      toast.success(response.data?.message || 'Template deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete template');
      return Promise.reject(error);
    },
  })
}
