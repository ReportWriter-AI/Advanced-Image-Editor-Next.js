import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"
import { toast } from "sonner"

export const useTemplatesQuery =  () => 
	  useQuery({
		queryKey: [apiRoutes.templates.get],
		queryFn: () => axios.get(apiRoutes.templates.get),
	})


	export const useCreateTemplateMutation =  () => {
		const queryClient = useQueryClient()
		return useMutation({
			mutationFn: (name: string) => axios.post(apiRoutes.templates.create, { name }),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: [apiRoutes.templates.get] });
				toast.success('Template created successfully');
			},
			onError: (error: any) => {
				toast.error(error.response?.data?.message || 'Failed to create template');
				return Promise.reject(error);
			},
		})
	}

	export const useReorderTemplatesMutation = () => {
		const queryClient = useQueryClient()
		return useMutation({
			mutationFn: (payload: { templates: Array<{ id: string; order: number }> }) =>
				axios.patch(apiRoutes.templates.reorder, payload),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: [apiRoutes.templates.get] });
				toast.success('Template order updated');
			},
			onError: (error: any) => {
				toast.error(error.response?.data?.error || 'Failed to reorder templates');
				return Promise.reject(error);
			},
		})
	}

	export const useDeleteTemplateMutation = () => {
		const queryClient = useQueryClient()
		return useMutation({
			mutationFn: (templateId: string) => axios.delete(`/templates/${templateId}`),
			onSuccess: (response) => {
				queryClient.invalidateQueries({ queryKey: [apiRoutes.templates.get] });
				queryClient.invalidateQueries({ queryKey: [apiRoutes.templates.deleted] });
				toast.success(response.data?.message || 'Template deleted');
			},
			onError: (error: any) => {
				toast.error(error.response?.data?.error || 'Failed to delete template');
				return Promise.reject(error);
			},
		})
	}

	export const useDeletedTemplatesQuery = () => 
		useQuery({
			queryKey: [apiRoutes.templates.deleted],
			queryFn: () => axios.get(apiRoutes.templates.deleted),
		})

	export const useRestoreTemplateMutation = () => {
		const queryClient = useQueryClient()
		return useMutation({
			mutationFn: (templateId: string) => axios.patch(`/templates/${templateId}/restore`),
			onSuccess: (response) => {
				queryClient.invalidateQueries({ queryKey: [apiRoutes.templates.get] });
				queryClient.invalidateQueries({ queryKey: [apiRoutes.templates.deleted] });
				toast.success(response.data?.message || 'Template restored successfully');
			},
			onError: (error: any) => {
				toast.error(error.response?.data?.error || 'Failed to restore template');
				return Promise.reject(error);
			},
		})
	}

	export const useTemplateQuery = (templateId: string) => 
		useQuery({
			queryKey: ['template', templateId],
			queryFn: () => axios.get(`/templates/${templateId}`),
			enabled: !!templateId,
		})

	export const useUpdateTemplateMutation = (templateId: string) => {
		const queryClient = useQueryClient()
		return useMutation({
			mutationFn: (data: { reportDescription?: string }) => 
				axios.put(`/templates/${templateId}`, data),
			onSuccess: (response) => {
				queryClient.invalidateQueries({ queryKey: ['template', templateId] });
				queryClient.invalidateQueries({ queryKey: [apiRoutes.templates.get] });
				toast.success(response.data?.message || 'Template updated successfully');
			},
			onError: (error: any) => {
				toast.error(error.response?.data?.error || 'Failed to update template');
				return Promise.reject(error);
			},
		})
	}