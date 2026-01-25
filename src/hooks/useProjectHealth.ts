/**
 * useProjectHealth - React Hook für Projekt-Gesundheitsstatus
 *
 * Verwendet React Query für Caching und automatisches Refetching.
 */

import { useQuery } from "@tanstack/react-query";
import { getProjectHealth } from "@/services/projectHealth";
import type { ProjectHealth } from "@/types/projectHealth";

interface UseProjectHealthOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useProjectHealth(
  projectId: string | null | undefined,
  options: UseProjectHealthOptions = {}
) {
  const { enabled = true, refetchInterval } = options;

  return useQuery<ProjectHealth, Error>({
    queryKey: ["projectHealth", projectId],
    queryFn: () => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      return getProjectHealth(projectId);
    },
    enabled: enabled && !!projectId,
    refetchInterval,
    staleTime: 30000, // 30 Sekunden als "frisch" betrachten
    gcTime: 5 * 60 * 1000, // 5 Minuten im Cache behalten (früher cacheTime)
  });
}

export default useProjectHealth;
