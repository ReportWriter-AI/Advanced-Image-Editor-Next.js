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