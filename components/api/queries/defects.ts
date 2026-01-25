import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface Defect {
  _id: string;
  inspection_id: string;
  templateId?: string;
  sectionId?: string;
  subsectionId?: string;
  image: string;
  originalImage?: string;
  annotations?: any[];
  defect_description: string;
  defect_short_description: string;
  materials: string;
  material_total_cost: number;
  base_cost?: number;
  location: string;
  section: string;
  subsection: string;
  labor_type: string;
  labor_rate: number;
  hours_required: number;
  recommendation: string;
  color?: string;
  type: string;
  thumbnail: string;
  video: string;
  isThreeSixty?: boolean;
  additional_images?: Array<{
    url: string;
    location: string;
    isThreeSixty?: boolean;
  }>;
}

export const useDefectsBySubsectionQuery = (params: {
  inspectionId: string;
  templateId: string;
  sectionId: string;
  subsectionId: string;
}) => 
  useQuery({
    queryKey: [apiRoutes.defects.bySubsection(params)],
    queryFn: async () => {
      const response = await axios.get(apiRoutes.defects.bySubsection(params));
      return response.data;
    },
    enabled: !!params.subsectionId,
  })

export const useDefectsByTemplateQuery = (params: {
  inspectionId: string;
  templateId: string;
  sectionId?: string;
  subsectionId?: string;
}) => 
  useQuery({
    queryKey: [apiRoutes.defects.byTemplate(params)],
    queryFn: async () => {
      const response = await axios.get(apiRoutes.defects.byTemplate(params));
      return response.data;
    },
    enabled: !!params.inspectionId && !!params.templateId,
  })

export const useUpdateDefectMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ defectId, updates }: { defectId: string; updates: Partial<Defect> }) => 
      axios.patch(apiRoutes.defects.update(defectId), updates),
    onSuccess: (response, variables) => {
      // Invalidate all defects queries to refresh the list
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (key.includes('/defects/by-subsection') || key.includes('/defects/by-template'));
        }
      });
      toast.success('Defect updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update defect');
      return Promise.reject(error);
    },
  })
}

export const useDeleteDefectMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (defectId: string) => axios.delete(apiRoutes.defects.delete(defectId)),
    onSuccess: (response) => {
      // Invalidate all defects queries to refresh the list
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (key.includes('/defects/by-subsection') || key.includes('/defects/by-template'));
        }
      });
      toast.success('Defect deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete defect');
      return Promise.reject(error);
    },
  })
}
