import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Button,
  Alert,
  PanResponder,
  Text,
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import ViewShot from 'react-native-view-shot';
import { useSavedDrawings } from '../../hooks/useSavedDrawings';

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

export default function DrawingScreen() {
  const [paths, setPaths] = useState<PathData[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [brushSize, setBrushSize] = useState(5);
  const [opacity, setOpacity] = useState(0.5);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameText, setRenameText] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<ViewShot>(null);
  const { savedDrawings, saveSavedDrawings, deleteDrawing, renameDrawing } = useSavedDrawings();

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setCurrentPath([`M ${locationX} ${locationY}`]);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setCurrentPath((prev) => [...prev, `L ${locationX} ${locationY}`]);
    },
    onPanResponderRelease: () => {
      if (currentPath.length > 0) {
        const newPath: PathData = {
          d: currentPath.join(' '),
          strokeWidth: brushSize,
          opacity,
        };
        setPaths((prev) => [...prev, newPath]);
        setCurrentPath([]);
      }
    },
  });

  const handleSave = async () => {
    if (!saveName.trim()) {
      Alert.alert('Error', 'Please enter a name.');
      return;
    }

    setIsSaving(true);
    try {
      let imageUri: string | undefined;
      if (canvasRef.current) {
        imageUri = await canvasRef.current.capture?.();
      }
      const updated = [...savedDrawings, { name: saveName.trim(), paths }];
      await saveSavedDrawings(updated, imageUri, canvasSize.width, canvasSize.height);
      setShowSaveModal(false);
      setSaveName('');
      Alert.alert('Success', 'Drawing saved!');
    } catch (e) {
      console.error('Save failed:', e);
      Alert.alert('Error', 'Failed to save drawing.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRename = () => {
    if (renameTarget && renameText.trim()) {
      renameDrawing(renameTarget.id, renameText.trim());
      setRenameModalVisible(false);
      setRenameText('');
      setRenameTarget(null);
      Alert.alert('Success', 'Drawing renamed!');
    } else {
      Alert.alert('Error', 'Please enter a name.');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteDrawing(id),
      },
    ]);
  };

  const undo = () => setPaths((prev) => prev.slice(0, -1));

  const clearDrawing = () => {
    setPaths([]);
    setCurrentPath([]);
    Alert.alert('Success', 'Current drawing cleared!');
  };

  return (
    <View style={styles.container}>
      {/* Canvas - fills entire available space */}
      <ViewShot
        ref={canvasRef}
        style={styles.canvas}
        options={{ format: 'png', quality: 1 }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCanvasSize({ width, height });
        }}
      >
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {paths.map((path, index) => (
              <Path
                key={index}
                d={path.d}
                stroke={`rgba(0,0,0,${path.opacity})`}
                strokeWidth={path.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {currentPath.length > 0 && (
              <Path
                d={currentPath.join(' ')}
                stroke={`rgba(0,0,0,${opacity})`}
                strokeWidth={brushSize}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        </View>
      </ViewShot>

      {/* Toggle Button */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowControls(!showControls)}
      >
        <Text style={styles.toggleButtonText}>
          {showControls ? 'Hide Controls' : 'Show Controls'}
        </Text>
      </TouchableOpacity>

      {/* Controls Panel */}
      {showControls && (
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <View style={styles.buttonContainer}>
              <Button title="Undo" onPress={undo} />
            </View>
            <View style={styles.buttonContainer}>
              <Button title="Save" onPress={() => setShowSaveModal(true)} />
            </View>
          </View>

          <View style={styles.clearButtonContainer}>
            <Button title="Clear" onPress={clearDrawing} />
          </View>

          <View style={styles.sliderContainer}>
            <Text>Brush Size: {brushSize.toFixed(1)}</Text>
            <Slider
              style={styles.slider}
              value={brushSize}
              onValueChange={setBrushSize}
              minimumValue={1}
              maximumValue={20}
              step={1}
            />
            <Text>Opacity: {opacity.toFixed(1)}</Text>
            <Slider
              style={styles.slider}
              value={opacity}
              onValueChange={setOpacity}
              minimumValue={0.1}
              maximumValue={1}
              step={0.1}
            />
          </View>

          <Text style={styles.canvasSizeText}>
            Canvas: {Math.round(canvasSize.width)} × {Math.round(canvasSize.height)} px
          </Text>

          <FlatList
            data={savedDrawings}
            keyExtractor={(item) => item.id ?? item.name}
            renderItem={({ item }) => (
              <View style={styles.listItem}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
                ) : (
                  <View style={styles.thumbnailPlaceholder} />
                )}
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>{item.name}</Text>
                  {item.canvas_width && item.canvas_height && (
                    <Text style={styles.listItemDimensions}>
                      {Math.round(item.canvas_width)} × {Math.round(item.canvas_height)} px
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (!item.id) return;
                    setRenameTarget({ id: item.id, name: item.name });
                    setRenameText(item.name);
                    setRenameModalVisible(true);
                  }}
                >
                  <Text style={styles.buttonText}>Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => item.id && handleDelete(item.id)}>
                  <Text style={[styles.buttonText, { color: 'red' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
            ListHeaderComponent={<Text style={styles.listHeader}>Saved Drawings</Text>}
            ListEmptyComponent={<Text style={styles.emptyText}>No saved drawings yet.</Text>}
          />
        </View>
      )}

      {/* Save Modal */}
      <Modal visible={showSaveModal} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <Text>Enter drawing name:</Text>
          <TextInput
            style={styles.input}
            value={saveName}
            onChangeText={setSaveName}
            placeholder="e.g. left eye cluster"
            autoFocus
          />
          <Button
            title={isSaving ? 'Saving...' : 'Save'}
            onPress={handleSave}
            disabled={isSaving}
          />
          <Button title="Cancel" onPress={() => setShowSaveModal(false)} disabled={isSaving} />
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={renameModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <Text>Rename drawing:</Text>
          <TextInput style={styles.input} value={renameText} onChangeText={setRenameText} />
          <Button title="Rename" onPress={handleRename} />
          <Button title="Cancel" onPress={() => setRenameModalVisible(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  canvas: {
    flex: 1,
    backgroundColor: '#fff',
    width: '100%',
    borderWidth: 2,
    borderColor: '#333',
  },

  toggleButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },

  toggleButtonText: {
    color: 'blue',
    fontWeight: 'bold',
  },

  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    maxHeight: '50%',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    zIndex: 5,
    borderTopWidth: 2,
    borderTopColor: '#333',
  },

  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
    paddingHorizontal: 10,
  },

  clearButtonContainer: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 5,
    marginHorizontal: 10,
    marginVertical: 5,
    alignSelf: 'center',
  },

  buttonContainer: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 5,
    width: '40%',
  },

  sliderContainer: {
    marginVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 10,
  },

  slider: {
    width: '100%',
    height: 40,
  },

  canvasSizeText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginBottom: 6,
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },

  listItemInfo: {
    flex: 1,
  },

  listItemName: {
    fontSize: 14,
  },

  listItemDimensions: {
    fontSize: 11,
    color: '#999',
  },

  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },

  thumbnailPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: '#ccc',
  },

  listHeader: {
    fontWeight: 'bold',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },

  emptyText: {
    color: 'gray',
    padding: 10,
    textAlign: 'center',
  },

  buttonText: {
    color: 'blue',
    marginLeft: 10,
  },

  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 50,
    padding: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#333',
  },

  input: {
    borderWidth: 1,
    borderColor: '#999',
    width: '80%',
    padding: 10,
    margin: 10,
    borderRadius: 5,
  },
});