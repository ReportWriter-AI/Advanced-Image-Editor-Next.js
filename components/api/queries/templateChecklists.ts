import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface TemplateChecklist {
  _id?: string;
  type: 'status' | 'information' | 'defects';
  name: string;
  field?: 'checkbox' | 'multipleAnswers' | 'date' | 'number' | 'numberRange' | 'signature';
  location?: string;
  comment?: string;
  defaultChecked?: boolean;
  answerChoices?: string[];
  orderIndex: number;
}

export const useTemplateChecklistsQuery = (templateId: string, sectionId: string, subsectionId: string) => 
  useQuery({
    queryKey: [apiRoutes.templateChecklists.get(templateId, sectionId, subsectionId)],
    queryFn: () => axios.get(apiRoutes.templateChecklists.get(templateId, sectionId, subsectionId)),
    enabled: !!templateId && !!sectionId && !!subsectionId,
  })

export const useCreateTemplateChecklistMutation = (templateId: string, sectionId: string, subsectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (checklistData: Omit<TemplateChecklist, '_id' | 'orderIndex'> & { orderIndex?: number }) => 
      axios.post(apiRoutes.templateChecklists.create(templateId, sectionId, subsectionId), checklistData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateChecklists.get(templateId, sectionId, subsectionId)] });
      toast.success('Checklist created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create checklist');
      return Promise.reject(error);
    },
  })
}

export const useUpdateTemplateChecklistMutation = (templateId: string, sectionId: string, subsectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ checklistId, checklistData }: { checklistId: string; checklistData: Partial<TemplateChecklist> }) => 
      axios.put(apiRoutes.templateChecklists.update(templateId, sectionId, subsectionId, checklistId), checklistData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateChecklists.get(templateId, sectionId, subsectionId)] });
      toast.success('Checklist updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update checklist');
      return Promise.reject(error);
    },
  })
}

export const useDeleteTemplateChecklistMutation = (templateId: string, sectionId: string, subsectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (checklistId: string) => 
      axios.delete(apiRoutes.templateChecklists.delete(templateId, sectionId, subsectionId, checklistId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateChecklists.get(templateId, sectionId, subsectionId)] });
      toast.success('Checklist deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete checklist');
      return Promise.reject(error);
    },
  })
}

export const useReorderTemplateChecklistsMutation = (templateId: string, sectionId: string, subsectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { checklists: Array<{ id: string; order: number }> }) =>
      axios.patch(apiRoutes.templateChecklists.reorder(templateId, sectionId, subsectionId), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.templateChecklists.get(templateId, sectionId, subsectionId)] });
      toast.success('Checklist order updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reorder checklists');
      return Promise.reject(error);
    },
  })
}
