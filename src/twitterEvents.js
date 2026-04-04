// Twitter Events Utility Functions
export const trackTwitterEvent = (eventId, parameters = {}) => {
    if (typeof window !== 'undefined' && window.twq) {
      window.twq('event', eventId, parameters);
    } else {
      console.warn('X Twitter pixel not loaded yet');
      if (typeof window !== 'undefined') {
        window.twitterEventQueue = window.twitterEventQueue || [];
        window.twitterEventQueue.push({ eventId, parameters });
      }
    }
  };
  
export const trackPurchase = (value, currency = 'KES', contents = []) => {
    trackTwitterEvent('tw-ql57w-ql57x', {
      value: value,
      currency: currency,
      contents: contents,
      conversion_id: 'goal-kings-subscription'
    });
  };
  
  // Twitter Pixel Queue Hook
export  const useTwitterPixelQueue = () => {
    useEffect(() => {
      const processQueue = () => {
        if (window.twitterEventQueue && window.twitterEventQueue.length > 0) {
          window.twitterEventQueue.forEach(({ eventId, parameters }) => {
            if (window.twq) {
              window.twq('event', eventId, parameters);
            }
          });
          window.twitterEventQueue = [];
        }
      };
  
      const interval = setInterval(() => {
        if (window.twq) {
          processQueue();
          clearInterval(interval);
        }
      }, 100);
  
      setTimeout(() => {
        clearInterval(interval);
      }, 10000);
  
      return () => clearInterval(interval);
    }, []);
  };