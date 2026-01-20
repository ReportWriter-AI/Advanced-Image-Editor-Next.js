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

export interface PublishValidationResponse {
  canPublish: boolean;
  totalStatusChecklists: number;
  checkedStatusChecklists: number;
  isAlreadyPublished: boolean;
}

export interface CompletionStatus {
  sections: {
    [sectionId: string]: {
      isComplete: boolean;
      subsections: {
        [subsectionId: string]: {
          isComplete: boolean;
          totalStatusChecklists: number;
          completedStatusChecklists: number;
        };
      };
    };
  };
}

export interface ChecklistSearchResult {
  sectionId: string;
  sectionName: string;
  subsectionId: string;
  subsectionName: string;
  checklistId: string;
  checklistName: string;
  matchedIn: 'name' | 'comment';
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

export const useInspectionTemplatePublishValidationQuery = (inspectionId: string, templateId: string) => 
  useQuery({
    queryKey: [apiRoutes.inspectionTemplates.validatePublish(inspectionId, templateId)],
    queryFn: () => axios.get(apiRoutes.inspectionTemplates.validatePublish(inspectionId, templateId)),
    enabled: !!inspectionId && !!templateId,
    refetchOnMount: true,
    staleTime: 0,
  })

export const useInspectionTemplateCompletionStatusQuery = (inspectionId: string, templateId: string) => 
  useQuery({
    queryKey: [apiRoutes.inspectionTemplates.completionStatus(inspectionId, templateId)],
    queryFn: () => axios.get(apiRoutes.inspectionTemplates.completionStatus(inspectionId, templateId)),
    enabled: !!inspectionId && !!templateId,
    refetchOnMount: true,
    staleTime: 0,
  })

export const useSearchInspectionChecklistsQuery = (
  inspectionId: string,
  templateId: string,
  searchQuery: string,
  enabled: boolean = true
) => 
  useQuery({
    queryKey: [apiRoutes.inspectionTemplates.searchChecklists(inspectionId, templateId), searchQuery],
    queryFn: async () => {
      const url = `${apiRoutes.inspectionTemplates.searchChecklists(inspectionId, templateId)}?query=${encodeURIComponent(searchQuery)}`;
      return axios.get(url);
    },
    enabled: !!inspectionId && !!templateId && searchQuery.length >= 3 && enabled,
    staleTime: 0,
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

export const usePublishInspectionMutation = (inspectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => axios.post(apiRoutes.inspections.publish(inspectionId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspections.get(inspectionId)] });
      toast.success('Report published successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to publish report');
      return Promise.reject(error);
    },
  })
}
