// // app/hooks/useSavedDrawings.ts
// import { useState, useEffect } from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// interface PathData {
//   d: string;
//   strokeWidth: number;
//   opacity: number;
// }

// interface SavedDrawing {
//   name: string;
//   paths: PathData[];
// }

// export const useSavedDrawings = () => {
//   const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);

//   const loadSavedDrawings = async () => {
//     try {
//       const stored = await AsyncStorage.getItem('floaterDrawings');
//       console.log('useSavedDrawings - Loaded raw data:', stored);
//       if (stored) {
//         const loaded = JSON.parse(stored);
//         if (
//           Array.isArray(loaded) &&
//           loaded.every(
//             (item: SavedDrawing) =>
//               typeof item === 'object' &&
//               typeof item.name === 'string' &&
//               Array.isArray(item.paths) &&
//               item.paths.every(
//                 (p: PathData) =>
//                   typeof p === 'object' &&
//                   typeof p.d === 'string' &&
//                   typeof p.strokeWidth === 'number' &&
//                   typeof p.opacity === 'number'
//               )
//           )
//         ) {
//           console.log('useSavedDrawings - Setting saved drawings:', loaded);
//           setSavedDrawings(loaded);
//         } else {
//           console.log('useSavedDrawings - Invalid data format');
//           setSavedDrawings([]);
//         }
//       } else {
//         console.log('useSavedDrawings - No saved drawings found');
//         setSavedDrawings([]);
//       }
//     } catch (e) {
//       console.error('useSavedDrawings - Load error:', e);
//       setSavedDrawings([]);
//     }
//   };

//   const saveSavedDrawings = async (updated: SavedDrawing[]) => {
//     try {
//       await AsyncStorage.setItem('floaterDrawings', JSON.stringify(updated));
//       setSavedDrawings(updated);
//     } catch (e) {
//       console.error('useSavedDrawings - Save error:', e);
//     }
//   };

//   // Load on mount
//   useEffect(() => {
//     loadSavedDrawings();
//   }, []);

//   return { savedDrawings, loadSavedDrawings, saveSavedDrawings };
// };



// import { useState, useEffect } from 'react';
// import { supabase } from '../lib/supabase';

// interface PathData {
//   d: string;
//   strokeWidth: number;
//   opacity: number;
// }

// interface SavedDrawing {
//   id?: string;
//   name: string;
//   paths: PathData[];
// }

// export const useSavedDrawings = () => {
//   const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);

//   const loadSavedDrawings = async () => {
//     try {
//       const { data, error } = await supabase
//         .from('drawings')
//         .select('*')
//         .order('created_at', { ascending: false });

//       if (error) throw error;

//       const drawings = data.map((row) => ({
//         id: row.id,
//         name: row.name,
//         paths: row.paths,
//       }));

//       setSavedDrawings(drawings);
//     } catch (e) {
//       console.error('Load error:', e);
//     }
//   };

//   const saveSavedDrawings = async (updated: SavedDrawing[]) => {
//     // Find the new drawing (last one that has no id yet)
//     const newDrawing = updated.find((d) => !d.id);
//     if (!newDrawing) {
//       setSavedDrawings(updated);
//       return;
//     }

//     try {
//       const { error } = await supabase
//         .from('drawings')
//         .insert({ name: newDrawing.name, paths: newDrawing.paths });

//       if (error) throw error;

//       await loadSavedDrawings(); // Refresh from Supabase
//     } catch (e) {
//       console.error('Save error:', e);
//     }
//   };

//   const deleteDrawing = async (id: string) => {
//     try {
//       const { error } = await supabase
//         .from('drawings')
//         .delete()
//         .eq('id', id);

//       if (error) throw error;

//       await loadSavedDrawings();
//     } catch (e) {
//       console.error('Delete error:', e);
//     }
//   };

//   const renameDrawing = async (id: string, newName: string) => {
//     try {
//       const { error } = await supabase
//         .from('drawings')
//         .update({ name: newName })
//         .eq('id', id);

//       if (error) throw error;

//       await loadSavedDrawings();
//     } catch (e) {
//       console.error('Rename error:', e);
//     }
//   };

//   useEffect(() => {
//     loadSavedDrawings();
//   }, []);

//   return { savedDrawings, loadSavedDrawings, saveSavedDrawings, deleteDrawing, renameDrawing };
// };

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface PathData {
  d: string;
  strokeWidth: number;
  opacity: number;
}

interface SavedDrawing {
  id?: string;
  name: string;
  paths: PathData[];
  image_url?: string;
  canvas_width?: number;
  canvas_height?: number;
}

export const useSavedDrawings = () => {
  const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);

  const loadSavedDrawings = async () => {
    try {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const drawings = data.map((row) => ({
        id: row.id,
        name: row.name,
        paths: row.paths,
        image_url: row.image_url,
        canvas_width: row.canvas_width,
        canvas_height: row.canvas_height,
      }));

      setSavedDrawings(drawings);
    } catch (e) {
      console.error('Load error:', e);
    }
  };

  const uploadImage = async (imageUri: string, drawingName: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const filename = `${drawingName.replace(/\s+/g, '_')}_${Date.now()}.png`;

      const { error } = await supabase.storage
        .from('drawings')
        .upload(filename, blob, { contentType: 'image/png', upsert: true });

      if (error) throw error;

      const { data } = supabase.storage.from('drawings').getPublicUrl(filename);
      return data.publicUrl;
    } catch (e) {
      console.error('Image upload error:', e);
      return null;
    }
  };

  const saveSavedDrawings = async (
    updated: SavedDrawing[],
    imageUri?: string,
    canvasWidth?: number,
    canvasHeight?: number
  ) => {
    const newDrawing = updated.find((d) => !d.id);
    if (!newDrawing) {
      setSavedDrawings(updated);
      return;
    }

    try {
      let image_url: string | null = null;
      if (imageUri) {
        image_url = await uploadImage(imageUri, newDrawing.name);
      }

      const { error } = await supabase.from('drawings').insert({
        name: newDrawing.name,
        paths: newDrawing.paths,
        image_url,
        canvas_width: canvasWidth ?? null,
        canvas_height: canvasHeight ?? null,
      });

      if (error) throw error;

      await loadSavedDrawings();
    } catch (e) {
      console.error('Save error:', e);
    }
  };

  const deleteDrawing = async (id: string) => {
    try {
      const drawing = savedDrawings.find((d) => d.id === id);
      const { error } = await supabase.from('drawings').delete().eq('id', id);
      if (error) throw error;

      if (drawing?.image_url) {
        const filename = drawing.image_url.split('/').pop();
        if (filename) {
          await supabase.storage.from('drawings').remove([filename]);
        }
      }

      await loadSavedDrawings();
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  const renameDrawing = async (id: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('drawings')
        .update({ name: newName })
        .eq('id', id);

      if (error) throw error;
      await loadSavedDrawings();
    } catch (e) {
      console.error('Rename error:', e);
    }
  };

  useEffect(() => {
    loadSavedDrawings();
  }, []);

  return { savedDrawings, loadSavedDrawings, saveSavedDrawings, deleteDrawing, renameDrawing };
};