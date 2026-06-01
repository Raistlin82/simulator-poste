import { createContext, useContext, useCallback } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '../../../utils/logger';
import { API_URL } from '../../../utils/api';
import { useAuth } from '../../../contexts/AuthContext';

const ConfigContext = createContext(null);
const CONFIG_BUNDLE_QUERY_KEY = ['config-bundle'];

const fetchConfigBundle = async () => {
  const [configRes, masterRes] = await Promise.all([
    axios.get(`${API_URL}/config`),
    axios.get(`${API_URL}/master-data`)
  ]);

  return {
    config: configRes.data,
    masterData: masterRes.data
  };
};

// eslint-disable-next-line react-refresh/only-export-components
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
};

export const ConfigProvider = ({ children }) => {
  // Wait for authentication before fetching protected resources
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const queryEnabled = !authLoading && isAuthenticated;

  const {
    data: configBundle,
    error: configBundleError,
    isLoading: isConfigBundleLoading,
    refetch: refetchConfigBundle,
  } = useQuery({
    queryKey: CONFIG_BUNDLE_QUERY_KEY,
    queryFn: fetchConfigBundle,
    enabled: queryEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  const fetchConfig = useCallback(async () => {
    const result = await refetchConfigBundle();
    if (result.error) {
      throw result.error;
    }
    return result.data;
  }, [refetchConfigBundle]);

  const setConfig = useCallback((nextConfigOrUpdater) => {
    queryClient.setQueryData(CONFIG_BUNDLE_QUERY_KEY, (current) => {
      const previousConfig = current?.config ?? null;
      const nextConfig = typeof nextConfigOrUpdater === 'function'
        ? nextConfigOrUpdater(previousConfig)
        : nextConfigOrUpdater;

      return {
        config: nextConfig,
        masterData: current?.masterData ?? null
      };
    });
  }, [queryClient]);

  const { mutateAsync: updateConfigMutation } = useMutation({
    mutationFn: async (newConfig) => {
      const res = await axios.post(`${API_URL}/config`, newConfig);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(CONFIG_BUNDLE_QUERY_KEY, (current) => ({
        config: data,
        masterData: current?.masterData ?? null
      }));
    }
  });

  const updateConfig = useCallback(async (newConfig) => {
    try {
      const data = await updateConfigMutation(newConfig);
      return { success: true, data };
    } catch (err) {
      logger.error('Failed to update config', err);
      return { success: false, error: err.message };
    }
  }, [updateConfigMutation]);

  const config = configBundle?.config ?? null;
  const masterData = configBundle?.masterData ?? null;
  const loading = authLoading || (queryEnabled && isConfigBundleLoading);
  const error = configBundleError?.message ?? null;

  const value = {
    config,
    setConfig,
    masterData,
    loading,
    error,
    refetch: fetchConfig,
    updateConfig
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};
