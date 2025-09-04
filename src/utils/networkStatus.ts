import { useState, useEffect } from 'react';
import { Network } from './capacitorMocks';

export interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    connected: true,
    connectionType: 'unknown'
  });

  useEffect(() => {
    let mounted = true;

    const initializeNetwork = async () => {
      try {
        const status = await Network.getStatus();
        if (mounted) {
          setNetworkStatus({
            connected: status.connected,
            connectionType: status.connectionType
          });
        }
      } catch (error) {
        console.error('Error getting network status:', error);
      }
    };

    const networkListener = Network.addListener('networkStatusChange', (status) => {
      if (mounted) {
        setNetworkStatus({
          connected: status.connected,
          connectionType: status.connectionType
        });
        
        console.log('Network status changed:', status);
      }
    });

    initializeNetwork();

    return () => {
      mounted = false;
      networkListener.remove();
    };
  }, []);

  return networkStatus;
};