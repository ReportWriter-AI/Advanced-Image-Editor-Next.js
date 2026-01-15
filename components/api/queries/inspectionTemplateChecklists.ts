import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface InspectionTemplateChecklist {
  _id?: string;
  type: 'status' | 'information' | 'defects';
  name: string;
  field?: 'checkbox' | 'multipleAnswers' | 'date' | 'number' | 'numberRange' | 'signature' | 'text';
  location?: string;
  comment?: string;
  defaultChecked?: boolean;
  answerChoices?: string[];
  orderIndex: number;
}

export const useInspectionTemplateChecklistsQuery = (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => 
  useQuery({
    queryKey: [apiRoutes.inspectionTemplateChecklists.get(inspectionId, templateId, sectionId, subsectionId)],
    queryFn: () => axios.get(apiRoutes.inspectionTemplateChecklists.get(inspectionId, templateId, sectionId, subsectionId)),
    enabled: !!inspectionId && !!templateId && !!sectionId && !!subsectionId,
  })

export const useCreateInspectionTemplateChecklistMutation = (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (checklistData: Omit<InspectionTemplateChecklist, '_id' | 'orderIndex'> & { orderIndex?: number }) => 
      axios.post(apiRoutes.inspectionTemplateChecklists.create(inspectionId, templateId, sectionId, subsectionId), checklistData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateChecklists.get(inspectionId, templateId, sectionId, subsectionId)] });
      toast.success('Checklist created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create checklist');
      return Promise.reject(error);
    },
  })
}

export const useUpdateInspectionTemplateChecklistMutation = (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ checklistId, checklistData }: { checklistId: string; checklistData: Partial<InspectionTemplateChecklist> }) => 
      axios.put(apiRoutes.inspectionTemplateChecklists.update(inspectionId, templateId, sectionId, subsectionId, checklistId), checklistData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateChecklists.get(inspectionId, templateId, sectionId, subsectionId)] });
      toast.success('Checklist updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update checklist');
      return Promise.reject(error);
    },
  })
}

export const useDeleteInspectionTemplateChecklistMutation = (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (checklistId: string) => 
      axios.delete(apiRoutes.inspectionTemplateChecklists.delete(inspectionId, templateId, sectionId, subsectionId, checklistId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateChecklists.get(inspectionId, templateId, sectionId, subsectionId)] });
      toast.success('Checklist deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete checklist');
      return Promise.reject(error);
    },
  })
}

export const useReorderInspectionTemplateChecklistsMutation = (inspectionId: string, templateId: string, sectionId: string, subsectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { checklists: Array<{ id: string; order: number }> }) =>
      axios.patch(apiRoutes.inspectionTemplateChecklists.reorder(inspectionId, templateId, sectionId, subsectionId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspectionTemplateChecklists.get(inspectionId, templateId, sectionId, subsectionId)] });
      toast.success('Checklist order updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reorder checklists');
      return Promise.reject(error);
    },
  })
}
