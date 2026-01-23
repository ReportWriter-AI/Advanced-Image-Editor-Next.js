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
			mutationFn: (data: { name?: string; reportDescription?: string }) => 
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

	interface ExcelRow {
		sectionName: string;
		itemName: string;
		commentName: string;
		commentText: string;
		commentType: string;
		multipleChoiceOptions: string;
		unitTypeOptions: string;
		order: string | number;
		answerType: string;
		defaultValue: string;
		defaultValue2: string;
		defaultUnitType: string;
		defaultLocation: string;
	}

	export const useImportTemplateMutation = () => {
		const queryClient = useQueryClient()
		return useMutation({
			mutationFn: (payload: { templateName: string; data: ExcelRow[]; source: string; useNarrative: boolean }) =>
				axios.post(apiRoutes.templates.import, payload),
			onSuccess: (response) => {
				queryClient.invalidateQueries({ queryKey: [apiRoutes.templates.get] });
				toast.success(response.data?.message || 'Template imported successfully');
			},
			onError: (error: any) => {
				const errorData = error.response?.data || {};
				const errorMessage = errorData.error || 'Failed to import template';
				const errorDetails = errorData.details;
				
				if (errorDetails && Array.isArray(errorDetails)) {
					// Show validation errors
					const errorList = errorDetails.slice(0, 5).join('\n');
					const moreErrors = errorDetails.length > 5 ? `\n... and ${errorDetails.length - 5} more errors` : '';
					toast.error(`${errorMessage}\n${errorList}${moreErrors}`, {
						duration: 10000,
					});
				} else {
					toast.error(errorMessage);
				}
				return Promise.reject(error);
			},
		})
	}

	export const useExportTemplatesMutation = () => {
		return useMutation({
			mutationFn: async (payload: { templateIds: string[] }) => {
				const response = await axios.post(apiRoutes.templates.export, payload, {
					responseType: 'blob',
				});
				return response;
			},
			onSuccess: (response, variables) => {
				// Get filename from Content-Disposition header (axios normalizes to lowercase)
				const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
				let filename = 'templates-export.xlsx';
				
				if (contentDisposition) {
					// Try RFC 5987 format first (filename*=UTF-8''...)
					let filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
					if (filenameMatch) {
						try {
							filename = decodeURIComponent(filenameMatch[1]);
						} catch {
							// If decoding fails, fall back to standard format
							filenameMatch = null;
						}
					}
					
					// Fallback to standard format (filename="..." or filename=...)
					if (!filenameMatch) {
						filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
						if (filenameMatch) {
							filename = filenameMatch[1].trim();
						}
					}
				}
				
				// Ensure .xlsx extension is always present
				if (!filename.toLowerCase().endsWith('.xlsx')) {
					const nameWithoutExt = filename.replace(/\.[^.]*$/, '');
					filename = `${nameWithoutExt}.xlsx`;
				}
				
				// Create download link
				const url = window.URL.createObjectURL(response.data);
				const a = document.createElement('a');
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);
				
				toast.success(`Successfully exported ${variables.templateIds.length} template(s)`);
			},
			onError: (error: any) => {
				const errorMessage = error.response?.data?.error || 'Failed to export templates';
				// If error response is a blob, try to parse it as JSON
				if (error.response?.data instanceof Blob) {
					error.response.data.text().then((text: string) => {
						try {
							const errorData = JSON.parse(text);
							toast.error(errorData.error || errorMessage);
						} catch {
							toast.error(errorMessage);
						}
					}).catch(() => {
						toast.error(errorMessage);
					});
				} else {
					toast.error(errorMessage);
				}
				return Promise.reject(error);
			},
		})
	}