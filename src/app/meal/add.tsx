import { router, Stack } from 'expo-router';
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
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { Card } from '../../components/Card';
import { useAppStore } from '../../store/useAppStore';
import { genId } from '../../core/id';
import { mealCalories, mealMacros } from '../../core/calc';
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
  const [notes, setNotes] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeStatus, setRecognizeStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [recognizeMsg, setRecognizeMsg] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);

  // 手动添加表单
  const [mName, setMName] = useState('');
  const [mPortion, setMPortion] = useState('');
  const [mCal, setMCal] = useState('');
  const [mP, setMP] = useState('');
  const [mC, setMC] = useState('');
  const [mF, setMF] = useState('');

  const totalKcal = mealCalories(items);
  const macros = mealMacros(items);

  /** 选图后自动识别 */
  const pickAndRecognize = async (useCamera: boolean) => {
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

    if (result.canceled || !result.assets[0]?.uri) return;
    const uri = result.assets[0].uri;
    setImageUri(uri);
    await runRecognize(uri);
  };

  const runRecognize = async (uri: string) => {
    setRecognizing(true);
    setRecognizeStatus('idle');
    setRecognizeMsg('');
    try {
      const data = await recognizeMealImage(uri);
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
      setItems((prev) => [...prev, ...aiItems]);
      const total = aiItems.reduce((s, i) => s + i.caloriesKcal, 0);
      setRecognizeStatus('ok');
      setRecognizeMsg(`AI 识别完成：识别出 ${aiItems.length} 个食物项，合计约 ${Math.round(total)} kcal。可在下方逐项查看/修改份量与营养素。`);
    } catch (e) {
      setRecognizeStatus('fail');
      setRecognizeMsg(e instanceof Error ? e.message : '请检查网络或重试');
    } finally {
      setRecognizing(false);
    }
  };

  const addManualItem = () => {
    const name = mName.trim();
    if (!name) {
      Alert.alert('提示', '请输入食物名称');
      return;
    }
    const item: FoodItem = {
      id: genId('food_'),
      name,
      portionGrams: Number(mPortion) || 0,
      caloriesKcal: Number(mCal) || 0,
      proteinG: Number(mP) || 0,
      carbsG: Number(mC) || 0,
      fatG: Number(mF) || 0,
      source: 'manual',
    };
    setItems((prev) => [...prev, item]);
    setMName(''); setMPortion(''); setMCal(''); setMP(''); setMC(''); setMF('');
    setShowManual(false);
  };

  const saveItemEdit = (updated: FoodItem) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setEditingItem(null);
  };

  const handleSave = () => {
    if (items.length === 0) {
      Alert.alert('提示', '请先拍照识别或手动添加食物');
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 餐食类型 */}
        <View style={styles.typeRow}>
          {MEAL_TYPES.map((mt) => (
            <Pressable
              key={mt}
              style={[styles.typeBtn, mealType === mt && styles.typeBtnActive]}
              onPress={() => setMealType(mt)}
            >
              <Text style={[styles.typeBtnText, mealType === mt && styles.typeBtnTextActive]}>
                {MEAL_TYPE_LABELS[mt]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 拍照识别主入口 */}
        <View style={styles.cameraCard}>
          {imageUri ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: imageUri }} style={styles.bigImage} resizeMode="cover" />
              {recognizing && (
                <View style={styles.overlay}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={styles.overlayText}>AI 识别中…</Text>
                </View>
              )}
              <Pressable
                style={styles.reRecognizeBtn}
                onPress={() => imageUri && runRecognize(imageUri)}
                disabled={recognizing}
              >
                <Text style={styles.reRecognizeText}>重新识别</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.cameraEmoji}>📷</Text>
              <Text style={styles.cameraTitle}>拍照识别餐食</Text>
              <Text style={styles.cameraHint}>拍一张餐食照片，AI 自动识别食物和热量</Text>
              <View style={styles.cameraBtnRow}>
                <Pressable style={[styles.cameraBtn, styles.cameraBtnPrimary]} onPress={() => pickAndRecognize(true)}>
                  <Text style={styles.cameraBtnText}>📷 拍照</Text>
                </Pressable>
                <Pressable style={[styles.cameraBtn, styles.cameraBtnSecondary]} onPress={() => pickAndRecognize(false)}>
                  <Text style={styles.cameraBtnText}>🖼 相册</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* AI 识别结果反馈 */}
        {recognizeStatus !== 'idle' && (
          <View style={[styles.resultBanner, recognizeStatus === 'ok' ? styles.resultOk : styles.resultFail]}>
            <Text style={styles.resultIcon}>{recognizeStatus === 'ok' ? '✅' : '⚠️'}</Text>
            <Text style={styles.resultMsg}>{recognizeMsg}</Text>
          </View>
        )}

        {/* 汇总条 */}
        {items.length > 0 && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              共 {items.length} 项 · <Text style={styles.summaryKcal}>{totalKcal} kcal</Text>
            </Text>
            <Text style={styles.summaryMacro}>
              蛋白 {macros.protein}g · 碳水 {macros.carbs}g · 脂肪 {macros.fat}g
            </Text>
          </View>
        )}

        {/* 食物列表 */}
        {items.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>食物明细</Text>
              <Pressable onPress={() => setItems([])}>
                <Text style={styles.clearText}>清空</Text>
              </Pressable>
            </View>
            {items.map((it) => (
              <Pressable
                key={it.id}
                style={styles.foodRow}
                onPress={() => setEditingItem(it)}
              >
                <View style={styles.foodInfo}>
                  <View style={styles.foodNameRow}>
                    <Text style={styles.foodName}>{it.name}</Text>
                    {it.source === 'ai' && <Text style={styles.aiTag}>AI</Text>}
                  </View>
                  <Text style={styles.foodMeta}>份量 {it.portionGrams}g</Text>
                  <View style={styles.macroRow}>
                    <Text style={[styles.macroChip, { color: theme.colors.primary }]}>蛋白 {it.proteinG}g</Text>
                    <Text style={[styles.macroChip, { color: theme.colors.secondary }]}>碳水 {it.carbsG}g</Text>
                    <Text style={[styles.macroChip, { color: theme.colors.accent }]}>脂肪 {it.fatG}g</Text>
                  </View>
                </View>
                <View style={styles.foodRight}>
                  <Text style={styles.foodKcal}>{it.caloriesKcal}</Text>
                  <Text style={styles.foodKcalUnit}>kcal</Text>
                  <Text style={styles.editHint}>点击修改</Text>
                </View>
              </Pressable>
            ))}
          </Card>
        )}

        {/* 手动添加 */}
        <Pressable style={styles.manualToggle} onPress={() => setShowManual((v) => !v)}>
          <Text style={styles.manualToggleText}>
            {showManual ? '收起手动添加 ▲' : '＋ 手动添加食物 ▼'}
          </Text>
        </Pressable>

        {showManual && (
          <Card style={styles.section}>
            <TextInput style={styles.input} placeholder="食物名称" value={mName} onChangeText={setMName} />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="份量(g)" value={mPortion} onChangeText={setMPortion} keyboardType="numeric" />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="热量(kcal)" value={mCal} onChangeText={setMCal} keyboardType="numeric" />
            </View>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="蛋白(g)" value={mP} onChangeText={setMP} keyboardType="numeric" />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="碳水(g)" value={mC} onChangeText={setMC} keyboardType="numeric" />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="脂肪(g)" value={mF} onChangeText={setMF} keyboardType="numeric" />
            </View>
            <Pressable style={styles.addBtn} onPress={addManualItem}>
              <Text style={styles.addBtnText}>添加</Text>
            </Pressable>
          </Card>
        )}

        {/* 备注 */}
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="备注（可选）"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {/* 保存 */}
        <Pressable style={[styles.saveBtn, items.length === 0 && styles.saveBtnDisabled]} onPress={handleSave} disabled={items.length === 0}>
          <Text style={styles.saveBtnText}>保存餐食</Text>
        </Pressable>
      </ScrollView>

      {/* 编辑食物项弹窗 */}
      <EditItemModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={saveItemEdit}
        onDelete={(id) => {
          setItems((prev) => prev.filter((x) => x.id !== id));
          setEditingItem(null);
        }}
      />
    </SafeAreaView>
  );
}

/** 编辑/删除单个食物项的弹窗 */
function EditItemModal({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: FoodItem | null;
  onClose: () => void;
  onSave: (item: FoodItem) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [portion, setPortion] = useState('');
  const [cal, setCal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');

  React.useEffect(() => {
    if (item) {
      setName(item.name);
      setPortion(String(item.portionGrams));
      setCal(String(item.caloriesKcal));
      setP(String(item.proteinG));
      setC(String(item.carbsG));
      setF(String(item.fatG));
    }
  }, [item]);

  if (!item) return null;

  const handleSave = () => {
    onSave({
      ...item,
      name: name.trim() || item.name,
      portionGrams: Number(portion) || 0,
      caloriesKcal: Number(cal) || 0,
      proteinG: Number(p) || 0,
      carbsG: Number(c) || 0,
      fatG: Number(f) || 0,
    });
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>修改食物</Text>
          <TextInput style={styles.input} placeholder="名称" value={name} onChangeText={setName} />
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="份量(g)" value={portion} onChangeText={setPortion} keyboardType="numeric" />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="热量(kcal)" value={cal} onChangeText={setCal} keyboardType="numeric" />
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="蛋白(g)" value={p} onChangeText={setP} keyboardType="numeric" />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="碳水(g)" value={c} onChangeText={setC} keyboardType="numeric" />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="脂肪(g)" value={f} onChangeText={setF} keyboardType="numeric" />
          </View>
          <View style={styles.modalActions}>
            <Pressable style={[styles.modalBtn, styles.modalDeleteBtn]} onPress={() => onDelete(item.id)}>
              <Text style={styles.modalBtnText}>删除</Text>
            </Pressable>
            <Pressable style={[styles.modalBtn, styles.modalSaveBtn]} onPress={handleSave}>
              <Text style={styles.modalBtnText}>保存</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  typeBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  typeBtnText: { color: theme.colors.text, fontSize: theme.fontSizes.sm, fontWeight: theme.fontWeights.medium },
  typeBtnTextActive: { color: theme.colors.textInverse, fontWeight: theme.fontWeights.semibold },
  cameraCard: {
    width: '100%',
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cameraPlaceholder: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraEmoji: { fontSize: 48, marginBottom: theme.spacing.sm },
  cameraTitle: { fontSize: theme.fontSizes.lg, fontWeight: theme.fontWeights.semibold, color: theme.colors.text },
  cameraHint: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, marginTop: theme.spacing.xs, textAlign: 'center', marginBottom: theme.spacing.md },
  cameraBtnRow: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xs },
  cameraBtn: {
    paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.pill, alignItems: 'center',
  },
  cameraBtnPrimary: { backgroundColor: theme.colors.primary },
  cameraBtnSecondary: { backgroundColor: theme.colors.secondary },
  cameraBtnText: { color: '#fff', fontSize: theme.fontSizes.md, fontWeight: theme.fontWeights.semibold },
  imageWrap: { position: 'relative' },
  bigImage: { width: '100%', height: 220 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  overlayText: { color: '#fff', marginTop: theme.spacing.sm, fontSize: theme.fontSizes.md },
  reRecognizeBtn: {
    position: 'absolute', bottom: theme.spacing.sm, right: theme.spacing.sm,
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
  },
  reRecognizeText: { color: '#fff', fontSize: theme.fontSizes.sm, fontWeight: '600' },
  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md, marginBottom: theme.spacing.md,
  },
  summaryText: { fontSize: theme.fontSizes.md, color: theme.colors.text, fontWeight: '600' },
  summaryKcal: { color: theme.colors.primaryDark, fontWeight: theme.fontWeights.bold },
  summaryMacro: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
  section: { width: '100%', marginBottom: theme.spacing.md },
  sectionLabel: { fontSize: theme.fontSizes.md, fontWeight: theme.fontWeights.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  clearText: { color: theme.colors.danger, fontSize: theme.fontSizes.sm },
  foodRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  foodInfo: { flex: 1, marginRight: theme.spacing.sm },
  foodNameRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  foodName: { fontSize: theme.fontSizes.md, color: theme.colors.text, fontWeight: '500' },
  aiTag: {
    fontSize: theme.fontSizes.xs, color: theme.colors.primary, fontWeight: '600',
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  foodMeta: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, marginTop: 2 },
  macroRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: 4 },
  macroChip: { fontSize: theme.fontSizes.xs, fontWeight: '500' },
  foodRight: { alignItems: 'flex-end', minWidth: 70 },
  foodKcal: { color: theme.colors.primaryDark, fontSize: theme.fontSizes.xl, fontWeight: '700', lineHeight: 28 },
  foodKcalUnit: { color: theme.colors.primaryDark, fontSize: theme.fontSizes.xs, marginTop: -2 },
  editHint: { color: theme.colors.textMuted, fontSize: theme.fontSizes.xs, marginTop: 4, textDecorationLine: 'underline' },
  resultBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm,
    padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.md,
  },
  resultOk: { backgroundColor: theme.colors.success + '15' },
  resultFail: { backgroundColor: theme.colors.danger + '15' },
  resultIcon: { fontSize: 16, marginTop: 2 },
  resultMsg: { flex: 1, fontSize: theme.fontSizes.sm, color: theme.colors.text, lineHeight: 20 },
  manualToggle: {
    paddingVertical: theme.spacing.md, alignItems: 'center',
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.md,
  },
  manualToggleText: { color: theme.colors.primaryDark, fontSize: theme.fontSizes.md, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm,
    padding: theme.spacing.sm, marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface, color: theme.colors.text, fontSize: theme.fontSizes.md,
  },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  addBtn: {
    alignSelf: 'flex-start', paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm, backgroundColor: theme.colors.primary, marginTop: theme.spacing.xs,
  },
  addBtnText: { color: theme.colors.textInverse, fontWeight: theme.fontWeights.medium },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  saveBtn: {
    marginTop: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary,
    alignItems: 'center', width: '100%',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: theme.colors.textInverse, fontSize: theme.fontSizes.lg, fontWeight: theme.fontWeights.semibold },
  // modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.lg },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg },
  modalTitle: { fontSize: theme.fontSizes.lg, fontWeight: theme.fontWeights.semibold, color: theme.colors.text, marginBottom: theme.spacing.md },
  modalActions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm },
  modalBtn: { flex: 1, paddingVertical: theme.spacing.md, borderRadius: theme.radius.sm, alignItems: 'center' },
  modalDeleteBtn: { backgroundColor: theme.colors.danger },
  modalSaveBtn: { backgroundColor: theme.colors.primary },
  modalBtnText: { color: '#fff', fontSize: theme.fontSizes.md, fontWeight: '600' },
});
