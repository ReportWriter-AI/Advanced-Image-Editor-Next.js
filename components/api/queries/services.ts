import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export interface Service {
  _id: string;
  name: string;
  serviceCategory: string;
  description?: string;
  hiddenFromScheduler: boolean;
  baseCost: number;
  baseDurationHours: number;
  defaultInspectionEvents: string[];
  organizationServiceId?: string;
  orderIndex?: number;
  createdAt: string;
  updatedAt: string;
}

export const useServicesQuery = () => 
  useQuery({
    queryKey: [apiRoutes.services.get],
    queryFn: () => axios.get(apiRoutes.services.get),
  })

export const useServiceQuery = (serviceId: string) => 
  useQuery({
    queryKey: [apiRoutes.services.getById(serviceId)],
    queryFn: () => axios.get(apiRoutes.services.getById(serviceId)),
    enabled: !!serviceId,
  })

export const useCreateServiceMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (serviceData: any) => axios.post(apiRoutes.services.create, serviceData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.services.get] });
      toast.success('Service created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create service');
      return Promise.reject(error);
    },
  })
}

export const useUpdateServiceMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ serviceId, serviceData }: { serviceId: string; serviceData: any }) => 
      axios.put(apiRoutes.services.update(serviceId), serviceData),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.services.get] });
      queryClient.invalidateQueries({ queryKey: [apiRoutes.services.getById(variables.serviceId)] });
      toast.success(response.data?.message || 'Service updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update service');
      return Promise.reject(error);
    },
  })
}

export const useDeleteServiceMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (serviceId: string) => axios.delete(apiRoutes.services.delete(serviceId)),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.services.get] });
      toast.success(response.data?.message || 'Service deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete service');
      return Promise.reject(error);
    },
  })
}

export const useReorderServicesMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { services: Array<{ id: string; order: number }> }) =>
      axios.patch(apiRoutes.services.reorder, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.services.get] });
      toast.success('Service order updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reorder services');
      return Promise.reject(error);
    },
  })
}

export const useDuplicateServiceMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (serviceId: string) => axios.post(apiRoutes.services.duplicate(serviceId)),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [apiRoutes.services.get] });
      toast.success(response.data?.message || 'Service duplicated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to duplicate service');
      return Promise.reject(error);
    },
  })
}