import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Button,
  Text,
  Alert,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import Svg, { Path } from 'react-native-svg';
import { useSavedDrawings } from '../../hooks/useSavedDrawings';

interface PathData {
  d: string;
  strokeWidth: number;
  opacity: number;
}

interface SavedDrawing {
  name: string;
  paths: PathData[];
}

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { savedDrawings, loadSavedDrawings } = useSavedDrawings();
  const [selectedDrawing, setSelectedDrawing] = useState<PathData[]>([]);
  const [showList, setShowList] = useState(false); // Start minimized
  const selectedDrawingId = useRef<string | null>(null); // Track selected drawing ID

  // Reload drawings periodically to sync with index.tsx
  useEffect(() => {
    const interval = setInterval(() => {
      loadSavedDrawings(); // Refresh saved drawings
    }, 5000); // Increased to 5 seconds to reduce overhead
    return () => clearInterval(interval);
  }, [loadSavedDrawings]);

  // Update selectedDrawing only if it matches the current selectedDrawingId
  useEffect(() => {
    if (selectedDrawingId.current) {
      const selected = savedDrawings.find(drawing => drawing.name === selectedDrawingId.current);
      if (selected && selected.paths !== selectedDrawing) {
        setSelectedDrawing(selected.paths);
      }
    }
  }, [savedDrawings]);

  const selectDrawing = (drawing: SavedDrawing) => {
    setSelectedDrawing(drawing.paths);
    selectedDrawingId.current = drawing.name; // Store selected drawing ID
    Alert.alert('Success', `Loaded "${drawing.name}"`);
  };

  if (!permission) {
    return <Text>Loading permissions...</Text>;
  }
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>Camera permission is required.</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={'back' as CameraType} />
      <Svg style={styles.canvas}>
        {selectedDrawing.map((path, index) => (
          <Path
            key={index}
            d={path.d}
            stroke="rgba(0, 0, 0, 0.5)"
            strokeWidth={path.strokeWidth}
            fill="none"
            opacity={path.opacity}
          />
        ))}
      </Svg>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowList(!showList)}
      >
        <Text style={styles.toggleButtonText}>
          {showList ? 'Hide Drawings' : 'Show Drawings'}
        </Text>
      </TouchableOpacity>
      {showList && (
        <FlatList
          data={savedDrawings}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => selectDrawing(item)} style={styles.listItem}>
              <Text>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListHeaderComponent={<Text style={styles.listHeader}>Select Drawing to Overlay</Text>}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  toggleButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 10,
    borderRadius: 5,
  },
  toggleButtonText: { color: 'blue', fontWeight: 'bold' },
  list: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    maxHeight: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  listItem: { padding: 10, borderBottomWidth: 1 },
  listHeader: { fontWeight: 'bold', padding: 10 },
});