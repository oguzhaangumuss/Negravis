/**
 * Oracle API Hook
 * Custom React hook for Oracle API interactions with error handling and loading states
 */

import { useState, useCallback } from 'react';
import { oracleApi, OracleQueryResponse, PriceResponse, WeatherResponse, SystemStatusResponse } from '../services/oracleApi';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseOracleApiReturn {
  // Query states
  queryState: ApiState<OracleQueryResponse['data']>;
  priceState: ApiState<PriceResponse['data']>;
  weatherState: ApiState<WeatherResponse['data']>;
  statusState: ApiState<SystemStatusResponse['data']>;

  // Query functions
  executeQuery: (query: string, options?: { sources?: string[]; method?: string; timeout?: number }) => Promise<void>;
  getPrice: (symbol: string, options?: { sources?: string[]; method?: string }) => Promise<void>;
  getWeather: (location: string) => Promise<void>;
  getSystemStatus: () => Promise<void>;
  
  // Utility functions
  clearErrors: () => void;
  resetStates: () => void;
}

const initialState = <T>(): ApiState<T> => ({
  data: null,
  loading: false,
  error: null
});

export const useOracleApi = (): UseOracleApiReturn => {
  const [queryState, setQueryState] = useState<ApiState<OracleQueryResponse['data']>>(initialState);
  const [priceState, setPriceState] = useState<ApiState<PriceResponse['data']>>(initialState);
  const [weatherState, setWeatherState] = useState<ApiState<WeatherResponse['data']>>(initialState);
  const [statusState, setStatusState] = useState<ApiState<SystemStatusResponse['data']>>(initialState);

  // Execute general oracle query
  const executeQuery = useCallback(async (
    query: string, 
    options?: { sources?: string[]; method?: string; timeout?: number }
  ) => {
    setQueryState({ data: null, loading: true, error: null });
    
    try {
      const response = await oracleApi.query(query, options);
      
      if (response.success) {
        setQueryState({ data: response.data, loading: false, error: null });
      } else {
        setQueryState({ 
          data: null, 
          loading: false, 
          error: response.error || 'Query failed' 
        });
      }
    } catch (error: unknown) {
      setQueryState({ 
        data: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Network error occurred' 
      });
    }
  }, []);

  // Get cryptocurrency price
  const getPrice = useCallback(async (
    symbol: string, 
    options?: { sources?: string[]; method?: string }
  ) => {
    setPriceState({ data: null, loading: true, error: null });
    
    try {
      const response = await oracleApi.getPrice(symbol, options);
      
      if (response.success) {
        setPriceState({ data: response.data, loading: false, error: null });
      } else {
        setPriceState({ 
          data: null, 
          loading: false, 
          error: response.error || `Failed to get ${symbol} price` 
        });
      }
    } catch (error: unknown) {
      setPriceState({ 
        data: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Network error occurred' 
      });
    }
  }, []);

  // Get weather data
  const getWeather = useCallback(async (location: string) => {
    setWeatherState({ data: null, loading: true, error: null });
    
    try {
      const response = await oracleApi.getWeather(location);
      
      if (response.success) {
        setWeatherState({ data: response.data, loading: false, error: null });
      } else {
        setWeatherState({ 
          data: null, 
          loading: false, 
          error: response.error || `Failed to get weather for ${location}` 
        });
      }
    } catch (error: unknown) {
      setWeatherState({ 
        data: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Network error occurred' 
      });
    }
  }, []);

  // Get system status
  const getSystemStatus = useCallback(async () => {
    setStatusState({ data: null, loading: true, error: null });
    
    try {
      const response = await oracleApi.getSystemStatus();
      
      if (response.success) {
        setStatusState({ data: response.data, loading: false, error: null });
      } else {
        setStatusState({ 
          data: null, 
          loading: false, 
          error: response.error || 'Failed to get system status' 
        });
      }
    } catch (error: unknown) {
      setStatusState({ 
        data: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Network error occurred' 
      });
    }
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setQueryState(prev => ({ ...prev, error: null }));
    setPriceState(prev => ({ ...prev, error: null }));
    setWeatherState(prev => ({ ...prev, error: null }));
    setStatusState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset all states
  const resetStates = useCallback(() => {
    setQueryState(initialState);
    setPriceState(initialState);
    setWeatherState(initialState);
    setStatusState(initialState);
  }, []);

  return {
    queryState,
    priceState,
    weatherState,
    statusState,
    executeQuery,
    getPrice,
    getWeather,
    getSystemStatus,
    clearErrors,
    resetStates
  };
};

export default useOracleApi;