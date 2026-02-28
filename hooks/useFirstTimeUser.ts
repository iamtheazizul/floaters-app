// app/hooks/useFirstTimeUser.ts
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useFirstTimeUser = () => {
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);

  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const hasVisited = await AsyncStorage.getItem('hasVisited');
        console.log('useFirstTimeUser - hasVisited:', hasVisited);
        if (hasVisited === null) {
          console.log('useFirstTimeUser - First time detected, setting hasVisited');
          setIsFirstTime(true);
          await AsyncStorage.setItem('hasVisited', 'true');
        } else {
          console.log('useFirstTimeUser - Not first time');
          setIsFirstTime(false);
        }
      } catch (e) {
        console.error('useFirstTimeUser - Error checking first time:', e);
        setIsFirstTime(false);
      }
      console.log('useFirstTimeUser - isFirstTime set to:', isFirstTime);
    };
    checkFirstTime();
  }, []);

  return { isFirstTime };
};