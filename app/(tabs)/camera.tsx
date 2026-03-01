import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Button,
  Text,
  Alert,
  FlatList,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Gyroscope } from 'expo-sensors';
import Svg, { G, Path } from 'react-native-svg';
import { useSavedDrawings } from '../../hooks/useSavedDrawings';
import {
  createPhysicsState,
  makeFloaterBody,
  resetPhysicsState,
  stepPhysics,
} from '../../lib/floaterPhysics';

interface PathData {
  d: string;
  strokeWidth: number;
  opacity: number;
}

interface SavedDrawing {
  id?: string;
  name: string;
  paths: PathData[];
  canvas_width?: number;
  canvas_height?: number;
}

const LAG_PERCENT = 60;
const GYRO_TO_INPUT = 24;
const GYRO_LOG_GAIN = 0.22;
const GYRO_MAX_VIEW_VEL = 14;
const GYRO_DEADZONE = 0.05;

function mapGyroRateToViewVelocity(rate: number) {
  if (Math.abs(rate) < GYRO_DEADZONE) {
    return 0;
  }
  const scaled = rate * GYRO_TO_INPUT;
  const magnitude = Math.abs(scaled);
  const compressed = Math.log1p(magnitude * GYRO_LOG_GAIN) / GYRO_LOG_GAIN;
  return Math.sign(scaled) * Math.min(compressed, GYRO_MAX_VIEW_VEL);
}

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { savedDrawings, loadSavedDrawings } = useSavedDrawings();
  const [selectedDrawing, setSelectedDrawing] = useState<SavedDrawing | null>(null);
  const [showList, setShowList] = useState(false);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [floaterOffset, setFloaterOffset] = useState({ x: 0, y: 0 });
  const selectedDrawingId = useRef<string | null>(null);
  const physicsStateRef = useRef(createPhysicsState());
  const rafRef = useRef<number | null>(null);
  const lastFrameMsRef = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      loadSavedDrawings();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadSavedDrawings]);

  useEffect(() => {
    if (selectedDrawingId.current) {
      const selected = savedDrawings.find(
        (drawing) => drawing.id === selectedDrawingId.current || drawing.name === selectedDrawingId.current,
      );
      if (selected) {
        setSelectedDrawing(selected);
      }
    }
  }, [savedDrawings]);

  useEffect(() => {
    const state = physicsStateRef.current;
    state.floaters = [makeFloaterBody()];
    resetPhysicsState(state);
    setFloaterOffset({ x: 0, y: 0 });
  }, [selectedDrawing?.id]);

  useEffect(() => {
    Gyroscope.setUpdateInterval(16);
    const subscription = Gyroscope.addListener((reading) => {
      const state = physicsStateRef.current;
      state.rawViewVel.x = mapGyroRateToViewVelocity(reading.y);
      state.rawViewVel.y = mapGyroRateToViewVelocity(-reading.x);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const tick = (nowMs: number) => {
      const state = physicsStateRef.current;
      const prev = lastFrameMsRef.current ?? nowMs;
      const dt = Math.min(0.03, (nowMs - prev) / 1000);
      lastFrameMsRef.current = nowMs;
      stepPhysics(state, LAG_PERCENT, dt, nowMs / 1000);

      const floater = state.floaters[0];
      if (floater) {
        setFloaterOffset({ x: floater.offset.x, y: floater.offset.y });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      lastFrameMsRef.current = null;
    };
  }, []);

  const selectDrawing = (drawing: SavedDrawing) => {
    setSelectedDrawing(drawing);
    selectedDrawingId.current = drawing.id ?? drawing.name;
    Alert.alert('Success', `Loaded "${drawing.name}"`);
  };

  const onOverlayLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setOverlaySize({ width, height });
  };

  const drawingMetrics = useMemo(() => {
    const drawingWidth = selectedDrawing?.canvas_width ?? overlaySize.width;
    const drawingHeight = selectedDrawing?.canvas_height ?? overlaySize.height;
    const safeDrawingWidth = Math.max(1, drawingWidth);
    const safeDrawingHeight = Math.max(1, drawingHeight);
    const scale = Math.min(
      overlaySize.width / safeDrawingWidth || 1,
      overlaySize.height / safeDrawingHeight || 1,
    );
    return {
      drawingWidth: safeDrawingWidth,
      drawingHeight: safeDrawingHeight,
      scale,
    };
  }, [overlaySize.height, overlaySize.width, selectedDrawing?.canvas_height, selectedDrawing?.canvas_width]);

  const overlayTransform = useMemo(
    () =>
      `translate(${overlaySize.width / 2 + floaterOffset.x}, ${overlaySize.height / 2 + floaterOffset.y}) scale(${drawingMetrics.scale || 1}) translate(${-drawingMetrics.drawingWidth / 2}, ${-drawingMetrics.drawingHeight / 2})`,
    [
      drawingMetrics.drawingHeight,
      drawingMetrics.drawingWidth,
      drawingMetrics.scale,
      floaterOffset.x,
      floaterOffset.y,
      overlaySize.height,
      overlaySize.width,
    ],
  );

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
      <Svg style={styles.canvas} onLayout={onOverlayLayout}>
        <G transform={overlayTransform}>
          {(selectedDrawing?.paths ?? []).map((path, index) => (
            <Path
              key={index}
              d={path.d}
              stroke="rgba(0, 0, 0, 0.5)"
              strokeWidth={path.strokeWidth}
              fill="none"
              opacity={path.opacity}
            />
          ))}
        </G>
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
          keyExtractor={(item, index) => item.id ?? `${item.name}-${index}`}
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
