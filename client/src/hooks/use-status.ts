import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useStatus() {
  return useQuery({
    queryKey: [api.status.path],
    queryFn: async () => {
      const res = await fetch(api.status.path);
      if (!res.ok) throw new Error("Failed to fetch status");
      return api.status.responses[200].parse(await res.json());
    },
  });
}
