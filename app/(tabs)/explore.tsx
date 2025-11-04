import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { readAsStringAsync } from "expo-file-system/legacy";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import * as ImageManipulator from "expo-image-manipulator";


export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [loading, setLoading] = useState(false);

  // Pick an image from gallery
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please grant access to your media library."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      extractText(result.assets[0].uri);
    }
  };

  // Take a new picture
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please grant camera permissions.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      extractText(result.assets[0].uri);
    }
  };

  
  // Extract text from image using OCR.space
  const extractText = async (uri: string) => {
    try {
      setLoading(true);
      setExtractedText("");
      setAiResult("");

      // Step 1: Compress and resize image until under 1MB
      let compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }], // resize for a good baseline
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Step 2: If still >1MB, reduce quality further
      const getFileSize = async (fileUri: string) => {
        const info = await FileSystem.getInfoAsync(fileUri);
        return info.size ?? 0;
      };

      let size = await getFileSize(compressed.uri);
      let quality = 0.6;

      while (size > MAX_FILE_SIZE && quality > 0.1) {
        compressed = await ImageManipulator.manipulateAsync(
          compressed.uri,
          [],
          { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
        );
        size = await getFileSize(compressed.uri);
        quality -= 0.1;
      }

      console.log("✅ Final image size:", (size / 1024).toFixed(2), "KB");

      // Step 3: Convert to base64
      const base64 = await readAsStringAsync(compressed.uri, {
        encoding: "base64",
      });

      // Step 4: Send to OCR
      const formData = new FormData();
      formData.append("apikey", "K85683965888957"); // store securely if needed
      formData.append("base64Image", `data:image/jpeg;base64,${base64}`);

      const response = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData as any,
      });

      const data = await response.json();
      console.log("OCR Response:", data);

      const text = data.ParsedResults?.[0]?.ParsedText?.trim() || "";
      setExtractedText(text);
      console.log("Extracted Text:", text);

      if (text) {
        analyzeWithAI(text);
      } else {
        Alert.alert("No text detected", "Try another image with clearer text.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to extract text.");
    } finally {
      setLoading(false);
    }
  };

  // Send extracted text to your AI backend
  const analyzeWithAI = async (text: string) => {
    try {
      setLoading(true);
      const res = await fetch("https://your-secure-api.com/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      setAiResult(data.result || "No result from AI.");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not connect to AI service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.title}>
        ExplainIt AI
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Upload or take a picture — we'll extract and simplify the text.
      </ThemedText>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>📷 Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>🖼️ Upload Image</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#9b5de5"
          style={{ marginTop: 20 }}
        />
      )}

      {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}

      {extractedText ? (
        <View style={styles.resultBox}>
          <Text style={styles.sectionTitle}>📝 Extracted Text:</Text>
          <Text style={styles.resultText}>{extractedText}</Text>
        </View>
      ) : null}

      {aiResult ? (
        <View style={styles.resultBox}>
          <Text style={styles.sectionTitle}>🤖 AI Explanation:</Text>
          <Text style={styles.resultText}>{aiResult}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#000",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 40,
  },
  subtitle: {
    color: "#aaa",
    textAlign: "center",
    marginVertical: 10,
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: 20,
    gap: 10,
  },
  button: {
    backgroundColor: "#9b5de5",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  preview: {
    width: 280,
    height: 280,
    borderRadius: 12,
    marginTop: 20,
  },
  resultBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    width: "100%",
  },
  sectionTitle: {
    color: "#9b5de5",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 6,
  },
  resultText: {
    color: "#ddd",
    fontSize: 14,
  },
});
