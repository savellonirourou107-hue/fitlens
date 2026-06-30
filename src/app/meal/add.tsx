import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { useAppStore } from '../../store/useAppStore';
import { genId } from '../../core/id';
import { MEAL_TYPE_LABELS } from '../../types';
import type { Meal, FoodItem, MealType } from '../../types';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { recognizeMealImage } from '../../api/client';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function MealAddScreen() {
  const addMeal = useAppStore((s) => s.addMeal);

  const [mealType, setMealType] = useState<MealType>('lunch');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemPortion, setItemPortion] = useState('');
  const [itemCalories, setItemCalories] = useState('');
  const [itemProtein, setItemProtein] = useState('');
  const [itemCarbs, setItemCarbs] = useState('');
  const [itemFat, setItemFat] = useState('');
  const [notes, setNotes] = useState('');
  const [recognizing, setRecognizing] = useState(false);

  const handlePickImage = async (useCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    };
    const result =
      useCamera === true
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  /** 调后端 AI 识别图片中的餐食，结果填入 items（用户可继续手动修正） */
  const handleRecognize = async () => {
    if (!imageUri) {
      Alert.alert('提示', '请先选择或拍摄餐食图片');
      return;
    }
    setRecognizing(true);
    try {
      const data = await recognizeMealImage(imageUri);
      const aiItems: FoodItem[] = data.items.map((it) => ({
        id: genId('food_'),
        name: it.name,
        portionGrams: it.portionGrams,
        caloriesKcal: it.caloriesKcal,
        proteinG: it.proteinG,
        carbsG: it.carbsG,
        fatG: it.fatG,
        source: 'ai',
      }));
      setItems([...items, ...aiItems]);
      Alert.alert('识别完成', `AI 识别出 ${aiItems.length} 个食物项，可手动修正`);
    } catch (e) {
      Alert.alert('识别失败', e instanceof Error ? e.message : '未知错误');
    } finally {
      setRecognizing(false);
    }
  };

  const handleAddItem = () => {
    const name = itemName.trim();
    if (!name) {
      Alert.alert('提示', '请输入食物名称');
      return;
    }
    const foodItem: FoodItem = {
      id: genId('food_'),
      name,
      portionGrams: Number(itemPortion) || 0,
      caloriesKcal: Number(itemCalories) || 0,
      proteinG: Number(itemProtein) || 0,
      carbsG: Number(itemCarbs) || 0,
      fatG: Number(itemFat) || 0,
      source: 'manual',
    };
    setItems([...items, foodItem]);
    setItemName('');
    setItemPortion('');
    setItemCalories('');
    setItemProtein('');
    setItemCarbs('');
    setItemFat('');
  };

  const handleSave = () => {
    if (items.length === 0) {
      Alert.alert('提示', '请至少添加一个食物项目');
      return;
    }
    const meal: Meal = {
      id: genId('meal_'),
      date: format(new Date(), 'yyyy-MM-dd'),
      mealType,
      items,
      imageUri,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addMeal(meal);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: '记录餐食' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 餐食类型 */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>餐食类型</Text>
          <View style={styles.typeRow}>
            {MEAL_TYPES.map((mt) => (
              <Pressable
                key={mt}
                style={[
                  styles.typeBtn,
                  mealType === mt && { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => setMealType(mt)}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    mealType === mt && { color: theme.colors.textInverse },
                  ]}
                >
                  {MEAL_TYPE_LABELS[mt]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* 拍照 */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>餐食图片</Text>
          <View style={styles.imageRow}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.thumbnail, styles.placeholder]} />
            )}
            <View style={styles.imageBtns}>
              <Pressable
                style={styles.imageBtn}
                onPress={() => handlePickImage(true)}
              >
                <Text style={styles.imageBtnText}>拍照</Text>
              </Pressable>
              <Pressable
                style={styles.imageBtn}
                onPress={() => handlePickImage(false)}
              >
                <Text style={styles.imageBtnText}>相册</Text>
              </Pressable>
            </View>
          </View>
        </Card>

        {/* 添加食物 */}
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>添加食物</Text>
          <TextInput
            style={styles.input}
            placeholder="食物名称"
            value={itemName}
            onChangeText={setItemName}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="份量(g)"
              value={itemPortion}
              onChangeText={setItemPortion}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="热量(kcal)"
              value={itemCalories}
              onChangeText={setItemCalories}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="蛋白质(g)"
              value={itemProtein}
              onChangeText={setItemProtein}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="碳水(g)"
              value={itemCarbs}
              onChangeText={setItemCarbs}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="脂肪(g)"
              value={itemFat}
              onChangeText={setItemFat}
              keyboardType="numeric"
            />
          </View>
          <Pressable style={styles.addBtn} onPress={handleAddItem}>
            <Text style={styles.addBtnText}>+ 添加项</Text>
          </Pressable>
        </Card>

        {/* 已添加列表 */}
        {items.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>已添加食物 ({items.length})</Text>
              <Pressable onPress={() => setItems([])}>
                <Text style={styles.clearText}>清空</Text>
              </Pressable>
            </View>
            {items.map((it) => (
              <View key={it.id} style={styles.foodRow}>
                <View style={styles.foodInfo}>
                  <Text style={styles.foodName}>{it.name}</Text>
                  <Text style={styles.foodMeta}>
                    {it.portionGrams}g · P{it.proteinG} C{it.carbsG} F{it.fatG}
                    {it.source === 'ai' ? ' · AI' : ''}
                  </Text>
                </View>
                <View style={styles.foodRight}>
                  <Text style={styles.foodKcal}>{it.caloriesKcal} kcal</Text>
                  <Pressable onPress={() => setItems(items.filter((x) => x.id !== it.id))}>
                    <Text style={styles.delBtn}>删除</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* 备注 */}
        <Card style={styles.section}>
          <TextInput
            style={[styles.input, { minHeight: 60 }]}
            placeholder="备注（可选）"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </Card>

        {/* 保存 */}
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>保存</Text>
        </Pressable>

        {/* AI 识别 */}
        <Pressable
          style={[styles.aiBtn, recognizing && styles.aiBtnDisabled]}
          disabled={recognizing}
          onPress={handleRecognize}
        >
          {recognizing ? (
            <View style={styles.aiBtnContent}>
              <ActivityIndicator color={theme.colors.textInverse} size="small" />
              <Text style={styles.aiBtnText}>AI 识别中…</Text>
            </View>
          ) : (
            <Text style={styles.aiBtnText}>✨ AI 识别图片餐食</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    alignItems: 'center',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  section: { width: '100%', marginBottom: theme.spacing.md },
  sectionLabel: {
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  typeBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeBtnText: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.medium,
  },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
  },
  placeholder: { borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed' },
  imageBtns: { flexDirection: 'row', gap: theme.spacing.sm },
  imageBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  imageBtnText: { color: theme.colors.text, fontSize: theme.fontSizes.sm },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.fontSizes.md,
  },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  addBtn: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    marginTop: theme.spacing.xs,
  },
  addBtnText: { color: theme.colors.textInverse, fontWeight: theme.fontWeights.medium },
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  foodInfo: { flex: 1, marginRight: theme.spacing.sm },
  foodName: { fontSize: theme.fontSizes.md, color: theme.colors.text },
  foodMeta: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  foodRight: { alignItems: 'flex-end' },
  foodKcal: { color: theme.colors.textMuted, fontSize: theme.fontSizes.sm, marginBottom: 4 },
  delBtn: { color: theme.colors.danger, fontSize: theme.fontSizes.xs },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  clearText: { color: theme.colors.danger, fontSize: theme.fontSizes.sm },
  saveBtn: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    width: '100%',
  },
  saveBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
  },
  aiBtn: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    width: '100%',
  },
  aiBtnDisabled: { opacity: 0.6 },
  aiBtnContent: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  aiBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
  },
});
