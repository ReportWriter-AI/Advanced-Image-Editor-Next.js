import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface ReusableDropdown {
  foundation: string;
  role: string;
  referralSources: string;
  location: Array<{ id: string; value: string }>;
  serviceCategory: string;
  defaultDefectColor: string;
  defaultAnnotationTool: string;
}

export const useReusableDropdownsQuery = (options?: { enabled?: boolean }) => 
  useQuery({
    queryKey: [apiRoutes.reusableDropdowns.get],
    queryFn: () => axios.get(apiRoutes.reusableDropdowns.get),
    enabled: options?.enabled !== undefined ? options.enabled : true,
  })

export const useUpdateReusableDropdownsMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ReusableDropdown>) => 
      axios.put(apiRoutes.reusableDropdowns.update, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.reusableDropdowns.get] });
      toast.success('Locations updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update locations');
      return Promise.reject(error);
    },
  })
}
