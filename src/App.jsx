import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { authApi } from './services/authApi'
import AppRouter from './routes/AppRouter'

export default function App() {
  const { refreshToken, setAccessToken, clearAuth } = useAuthStore()

  // On mount: silently restore session from persisted refresh token
  useEffect(() => {
    if (!refreshToken) return

    authApi
      .refresh(refreshToken)
      .then(({ data }) => {
        setAccessToken(data.data.accessToken)
        return authApi.getMe()
      })
      .then(({ data }) => {
        useAuthStore.setState({
          user: data.data.user,
          isAuthenticated: true,
        })
      })
      .catch(() => clearAuth())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <AppRouter />
}
