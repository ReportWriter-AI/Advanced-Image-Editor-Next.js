import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface Inspection {
  _id: string;
  headerImage?: string;
  headerText?: string;
  headerName?: string;
  headerAddress?: string;
  status?: string;
  date?: Date;
  companyId?: string;
  inspector?: string;
  location?: {
    address?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    squareFeet?: number;
    yearBuild?: number;
    foundation?: string;
  };
  clients?: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    isCompany?: boolean;
  }>;
  // Add other fields as needed
}

export const useInspectionQuery = (inspectionId: string) => 
  useQuery({
    queryKey: [apiRoutes.inspections.get(inspectionId)],
    queryFn: async () => {
      const response = await axios.get(apiRoutes.inspections.get(inspectionId));
      return response.data;
    },
    enabled: !!inspectionId,
  })

export const useUpdateInspectionMutation = (inspectionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (updates: Partial<Inspection>) => 
      axios.put(apiRoutes.inspections.update(inspectionId), updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.inspections.get(inspectionId)] });
      toast.success('Inspection updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update inspection');
      return Promise.reject(error);
    },
  })
}
