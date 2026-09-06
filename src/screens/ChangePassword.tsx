import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import IconButton from '../components/IconButton';

export default function ChangePassword() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação da senha não coincide.');
      return;
    }
    if (newPassword.length < 8) {
      setError('A nova senha deve possuir pelo menos 8 caracteres.');
      return;
    }
    if (newPassword === currentPassword || newPassword === '12345678') {
      setError('Escolha uma senha nova e diferente da senha temporária.');
      return;
    }

    try {
      setSaving(true);
      await changePassword(currentPassword, newPassword);
      alert('Senha alterada com sucesso. Faça login novamente com a nova senha.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível alterar a senha.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Criar nova senha</Text>
        <Text style={styles.subtitle}>
          {user?.must_change_password
            ? 'Sua senha temporária precisa ser substituída antes de continuar.'
            : 'Atualize a senha da sua conta.'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.label}>Senha atual ou temporária</Text>
        <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" />
        <Text style={styles.label}>Nova senha</Text>
        <Text style={styles.help}>Mínimo de 8 caracteres. Não utilize 12345678.</Text>
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
        <Text style={styles.label}>Confirmar nova senha</Text>
        <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <IconButton
            name="lock"
            label="Salvar nova senha"
            size="large"
            borderColor="#e53924"
            onPress={submit}
            disabled={saving}
            loading={saving}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: '100%', backgroundColor: '#fdecea', justifyContent: 'center', alignItems: 'center', padding: 20 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#FFF', borderRadius: 12, padding: 30, elevation: 5 },
  title: { fontSize: 24, fontWeight: '700', color: '#1c1c1e', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b6b70', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: '#1c1c1e', marginBottom: 6 },
  help: { fontSize: 12, color: '#6b6b70', marginBottom: 6 },
  input: { height: 50, borderWidth: 1, borderColor: '#f0b5ab', borderRadius: 8, paddingHorizontal: 14, fontSize: 16, marginBottom: 16, backgroundColor: '#fdecea' },
  button: { height: 50, backgroundColor: '#1c1c1e', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  error: { color: '#c62828', fontSize: 14, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
});
