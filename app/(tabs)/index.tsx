import React, { useState } from 'react';
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
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Slider from '@react-native-community/slider';
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

export default function DrawingScreen() {
  const [paths, setPaths] = useState<PathData[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [brushSize, setBrushSize] = useState(5);
  const [opacity, setOpacity] = useState(0.5);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameIndex, setRenameIndex] = useState<number | null>(null);
  const [renameText, setRenameText] = useState('');
  const [showControls, setShowControls] = useState(false); // Start minimized
  const { savedDrawings, saveSavedDrawings } = useSavedDrawings();

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      console.log('PanResponder - Grant:', { locationX, locationY });
      setCurrentPath([`M ${locationX} ${locationY}`]);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      console.log('PanResponder - Move:', { locationX, locationY });
      setCurrentPath((prev) => [...prev, `L ${locationX} ${locationY}`]);
    },
    onPanResponderRelease: () => {
      console.log('PanResponder - Release:', { currentPath });
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

  const handleSave = () => {
    if (saveName.trim()) {
      const updated = [...savedDrawings, { name: saveName.trim(), paths }];
      saveSavedDrawings(updated);
      setShowSaveModal(false);
      setSaveName('');
      Alert.alert('Success', 'Drawing saved!');
    } else {
      Alert.alert('Error', 'Please enter a name.');
    }
  };

  const handleRename = () => {
    if (renameIndex !== null && renameText.trim()) {
      const updated = [...savedDrawings];
      updated[renameIndex].name = renameText.trim();
      saveSavedDrawings(updated);
      setRenameModalVisible(false);
      setRenameText('');
      setRenameIndex(null);
      Alert.alert('Success', 'Drawing renamed!');
    } else {
      Alert.alert('Error', 'Please enter a name.');
    }
  };

  const deleteDrawing = (index: number) => {
    const updated = [...savedDrawings];
    updated.splice(index, 1);
    saveSavedDrawings(updated);
    Alert.alert('Success', 'Drawing deleted!');
  };

  const undo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const clearDrawing = () => {
    setPaths([]);
    setCurrentPath([]);
    Alert.alert('Success', 'Current drawing cleared!');
  };

  return (
    <View style={styles.container}>
      <View
        style={[styles.canvas, styles.canvasBorder]}
        {...panResponder.panHandlers}
      >
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {paths.map((path, index) => (
            <Path
              key={index}
              d={path.d}
              stroke="rgba(0, 0, 0, 0.5)"
              strokeWidth={path.strokeWidth}
              fill="none"
              opacity={path.opacity}
            />
          ))}
          {currentPath.length > 0 && (
            <Path
              d={currentPath.join(' ')}
              stroke="rgba(0, 0, 0, 0.5)"
              strokeWidth={brushSize}
              fill="none"
              opacity={opacity}
            />
          )}
        </Svg>
      </View>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowControls(!showControls)}
      >
        <Text style={styles.toggleButtonText}>
          {showControls ? 'Hide Controls' : 'Show Controls'}
        </Text>
      </TouchableOpacity>
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
          <FlatList
            data={savedDrawings}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item, index }) => (
              <View style={styles.listItem}>
                <Text>{item.name}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setRenameIndex(index);
                    setRenameText(item.name);
                    setRenameModalVisible(true);
                  }}
                >
                  <Text style={styles.buttonText}>Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteDrawing(index)}>
                  <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
            ListHeaderComponent={<Text style={styles.listHeader}>Saved Drawings</Text>}
          />
        </View>
      )}
      {/* Save Modal */}
      <Modal visible={showSaveModal} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <Text>Enter drawing name:</Text>
          <TextInput style={styles.input} value={saveName} onChangeText={setSaveName} />
          <Button title="Save" onPress={handleSave} />
          <Button title="Cancel" onPress={() => setShowSaveModal(false)} />
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
  container: { flex: 1, backgroundColor: '#fff' },
  canvas: { flex: 1, backgroundColor: 'transparent' },
  canvasBorder: {
    borderWidth: 2,
    borderColor: 'black',
    margin: 5,
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
  controls: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
    paddingHorizontal: 10,
  },
  clearButtonContainer: {
    borderWidth: 1,
    borderColor: 'gray',
    borderRadius: 5,
    marginHorizontal: 10,
    marginVertical: 5,
    alignSelf: 'center',
  },
  sliderContainer: {
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    borderWidth: 1,
    borderColor: 'gray',
    borderRadius: 5,
    width: '40%', // Ensures space between Undo and Save
  },
  slider: { width: '100%', height: 40 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1 },
  listHeader: { fontWeight: 'bold', padding: 10 },
  buttonText: { color: 'blue', marginLeft: 10 },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 50,
    padding: 20,
    borderRadius: 10,
  },
  input: { borderWidth: 1, borderColor: 'gray', width: '80%', padding: 10, margin: 10 },
});