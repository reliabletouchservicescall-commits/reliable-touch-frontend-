import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agenciesApi } from '../services/agenciesApi'
import { useAuthStore } from '../store/authStore'
import { applyBrand, clearBrand, cachedBrand, cacheBrand, syncBrandTokens } from './brand'

export const AGENCY_PROFILE_KEY = ['agency-profile', 'mine']

// The signed-in company user's agency profile (name, logo, colour). While mounted it paints the
// app in the company's colour. When the Agency Admin saves a change, SocketContext hears
// 'agency:branding' and refetches this, so everyone in the company sees it at once.
export function useAgencyBrand({ apply = false } = {}) {
  const user = useAuthStore((s) => s.user)
  const enabled = user?.role === 'agency' && Boolean(user?.agencyId)
  const cached = cachedBrand()

  const query = useQuery({
    queryKey: AGENCY_PROFILE_KEY,
    queryFn: () => agenciesApi.myProfile().then((r) => r.data.data.agency),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: cached && cached._id === String(user?.agencyId) ? cached : undefined,
  })
  const agency = query.data
  // JS colour tokens (charts, inline styles) follow the company colour from this render on
  if (apply && enabled) syncBrandTokens(agency?.branding?.primaryColor)

  useEffect(() => {
    if (!apply || !enabled) return
    applyBrand(agency?.branding?.primaryColor)
    if (agency && !query.isPlaceholderData) cacheBrand(agency)
  }, [apply, enabled, agency, query.isPlaceholderData])

  useEffect(() => (apply ? () => clearBrand() : undefined), [apply])

  return { agency, isLoading: query.isLoading }
}
