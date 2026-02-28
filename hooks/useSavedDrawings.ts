// app/hooks/useSavedDrawings.ts
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PathData {
  d: string;
  strokeWidth: number;
  opacity: number;
}

interface SavedDrawing {
  name: string;
  paths: PathData[];
}

export const useSavedDrawings = () => {
  const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);

  const loadSavedDrawings = async () => {
    try {
      const stored = await AsyncStorage.getItem('floaterDrawings');
      console.log('useSavedDrawings - Loaded raw data:', stored);
      if (stored) {
        const loaded = JSON.parse(stored);
        if (
          Array.isArray(loaded) &&
          loaded.every(
            (item: SavedDrawing) =>
              typeof item === 'object' &&
              typeof item.name === 'string' &&
              Array.isArray(item.paths) &&
              item.paths.every(
                (p: PathData) =>
                  typeof p === 'object' &&
                  typeof p.d === 'string' &&
                  typeof p.strokeWidth === 'number' &&
                  typeof p.opacity === 'number'
              )
          )
        ) {
          console.log('useSavedDrawings - Setting saved drawings:', loaded);
          setSavedDrawings(loaded);
        } else {
          console.log('useSavedDrawings - Invalid data format');
          setSavedDrawings([]);
        }
      } else {
        console.log('useSavedDrawings - No saved drawings found');
        setSavedDrawings([]);
      }
    } catch (e) {
      console.error('useSavedDrawings - Load error:', e);
      setSavedDrawings([]);
    }
  };

  const saveSavedDrawings = async (updated: SavedDrawing[]) => {
    try {
      await AsyncStorage.setItem('floaterDrawings', JSON.stringify(updated));
      setSavedDrawings(updated);
    } catch (e) {
      console.error('useSavedDrawings - Save error:', e);
    }
  };

  // Load on mount
  useEffect(() => {
    loadSavedDrawings();
  }, []);

  return { savedDrawings, loadSavedDrawings, saveSavedDrawings };
};