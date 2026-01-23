import { useQuery } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"

export const useDefectNarrativesQuery = () => 
	useQuery({
		queryKey: [apiRoutes.defectNarratives.get],
		queryFn: () => axios.get(apiRoutes.defectNarratives.get),
	})
