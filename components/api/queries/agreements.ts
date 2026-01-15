import { useQuery } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"

export interface AgreementOption {
  _id: string;
  id: string;
  name: string;
}

export const useAgreementsQuery = () => 
  useQuery({
    queryKey: [apiRoutes.agreements.get],
    queryFn: () => axios.get(apiRoutes.agreements.get),
  })
