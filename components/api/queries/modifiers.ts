import { useQuery } from "@tanstack/react-query"
import apiRoutes from "../apiRoutes"
import { axios } from "../axios"

export interface ModifierOption {
  key: string;
  label: string;
  supportsType: boolean;
  hasEqualsField: boolean;
  requiresRange: boolean;
  group?: "custom";
}

export const useModifiersQuery = () => 
  useQuery({
    queryKey: [apiRoutes.modifiers.get],
    queryFn: () => axios.get(apiRoutes.modifiers.get),
  })
