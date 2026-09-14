import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Copy, Link2, UserPlus } from 'lucide-react-native';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow } from './tokens';

export function ConvidarCorretoresCard({ managerId }: { managerId?: string }) {
  const [inviteLink, setInviteLink] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch {
      return '';
    }
  };

  const handleGenerateLink = async () => {
    try {
      setGeneratingLink(true);
      setCopied(false);
      const response = await api.post('/users/onboarding-link', {
        invitedRole: 'corretor_level_3',
        managerId,
      });
      const token = response.data.token;
      const origin =
        typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://abiatar.bitimob.com.br';
      setInviteLink(token ? `${origin}/cadastro/${token}` : response.data.onboarding_url);
      setValidUntil(formatDate(response.data.valid_until));
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Falha ao gerar link de convite.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      alert(`Copie o link: ${inviteLink}`);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.inviteHead}>
        <View style={[styles.kpiIcon, { backgroundColor: colors.coral050 }]}>
          <UserPlus size={15} color={colors.coral600} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fonts.panelTitle}>Convide novos corretores</Text>
          <Text style={styles.sectionSub}>Gere um link de convite vinculado à sua equipe.</Text>
        </View>
      </View>
      {inviteLink ? (
        <View style={styles.inviteLinkBox}>
          <Text style={styles.inviteLinkText} numberOfLines={2}>{inviteLink}</Text>
          {validUntil ? (
            <Text style={styles.validText}>Válido até {validUntil}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <TouchableOpacity style={styles.copyBtn} onPress={() => void handleCopyLink()}>
              <Copy size={13} color={colors.slate600} />
              <Text style={styles.copyBtnText}>{copied ? 'Copiado!' : 'Copiar link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.regenerateBtn} onPress={() => void handleGenerateLink()} disabled={generatingLink}>
              <Link2 size={13} color={colors.coral600} />
              <Text style={styles.regenerateBtnText}>{generatingLink ? 'Gerando...' : 'Gerar novo link'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={() => void handleGenerateLink()}
          disabled={generatingLink}
        >
          <Link2 size={14} color="#fff" />
          <Text style={styles.generateBtnText}>{generatingLink ? 'Gerando...' : 'Gerar link de cadastro'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function NovaConvidarCorretores({ managerId }: { managerId?: string }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ConvidarCorretoresCard managerId={managerId} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48, gap: 16, maxWidth: 900, width: '100%', alignSelf: 'center', justifyContent: 'flex-start' },
  card: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 12, ...shadow.card,
  },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16, marginTop: 2 },
  inviteLinkBox: { gap: 10, alignItems: 'stretch' },
  inviteLinkText: { color: colors.blue700, fontFamily: font.body, fontWeight: '600', fontSize: 11.5, lineHeight: 17 },
  validText: { color: colors.slate500, fontFamily: font.body, fontWeight: '500', fontSize: 10.5 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.sm,
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border,
  },
  copyBtnText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 10 },
  regenerateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.sm,
    backgroundColor: colors.coral050, borderWidth: 1, borderColor: colors.coral300,
  },
  regenerateBtnText: { color: colors.coral600, fontFamily: font.body, fontWeight: '700', fontSize: 10 },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.coral600, borderRadius: radius.md, paddingVertical: 12,
  },
  generateBtnText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 12 },
});